#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  The Lead Story — one-time setup on a fresh Ubuntu server
#  (written for a Google Cloud "e2-micro" free-tier machine).
#
#  Usage, from the server's terminal:
#    git clone https://github.com/<you>/the-lead-story.git
#    bash the-lead-story/deploy/setup-server.sh <name>.duckdns.org <duckdns-token>
#
#  It installs Node.js, Google Chrome (for PDFs) and Caddy (for HTTPS),
#  builds the site, asks for the admin password, and sets everything to
#  start automatically and restart itself if it ever stops. Safe to re-run.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?Usage: bash deploy/setup-server.sh <name>.duckdns.org [duckdns-token]}"
DUCK_TOKEN="${2:-}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$HOME/lead-story-data"
RUN_AS="$(whoami)"

step() { printf '\n\033[1;31m▶ %s\033[0m\n' "$*"; }

step "Adding 2 GB of swap space (the free server has only 1 GB of memory)"
if ! grep -q '^/swapfile ' /proc/swaps; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

step "Installing Node.js 24"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https
if ! node -v 2>/dev/null | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

step "Installing a browser for making PDFs"
if [ "$(dpkg --print-architecture)" = "amd64" ]; then
  if ! command -v google-chrome >/dev/null; then
    curl -fsSLo /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo apt-get install -y /tmp/chrome.deb
    rm -f /tmp/chrome.deb
  fi
  BROWSER="$(command -v google-chrome)"
else
  sudo snap install chromium
  BROWSER=/snap/bin/chromium
fi

step "Installing Caddy (gives the site HTTPS automatically)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

step "Building the website"
cd "$APP_DIR"
npm ci
npm run build

step "Saving the server settings"
mkdir -p "$DATA_DIR"
cat > "$APP_DIR/server/.env" <<EOF
NODE_ENV=production
PORT=4000
DATA_DIR=$DATA_DIR
PDF_BROWSER_PATH=$BROWSER
EOF

step "Admin password"
# Set here, so nobody else can claim the Editor's desk before you do.
if [ -f "$DATA_DIR/lead-story.db" ]; then
  echo "A password already exists. Press Enter to keep it, or type a new one."
  ALLOW_EMPTY=1
else
  echo "Choose the password for the Editor's desk (at least 8 characters)."
  ALLOW_EMPTY=0
fi
while true; do
  read -rsp 'Admin password: ' PW && echo
  if [ -z "$PW" ] && [ "$ALLOW_EMPTY" = 1 ]; then echo "Keeping the current password."; break; fi
  if [ "${#PW}" -lt 8 ]; then echo "Too short — use at least 8 characters."; continue; fi
  read -rsp 'Type it again: ' PW2 && echo
  if [ "$PW" != "$PW2" ]; then echo "They didn't match — try again."; continue; fi
  (cd "$APP_DIR/server" && printf '%s' "$PW" | node --disable-warning=ExperimentalWarning src/tools/set-password.js)
  break
done
unset PW PW2

step "Starting the newsletter and making it start on every boot"
sudo tee /etc/systemd/system/lead-story.service >/dev/null <<EOF
[Unit]
Description=The Lead Story newsletter
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_AS
WorkingDirectory=$APP_DIR/server
ExecStart=$(command -v node) --disable-warning=ExperimentalWarning src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable lead-story >/dev/null
sudo systemctl restart lead-story

if [ -n "$DUCK_TOKEN" ]; then
  step "Pointing $DOMAIN at this server (and keeping it up to date)"
  SUB="${DOMAIN%.duckdns.org}"
  DUCK_URL="https://www.duckdns.org/update?domains=$SUB&token=$DUCK_TOKEN&ip="
  curl -fsS "$DUCK_URL" && echo
  (crontab -l 2>/dev/null | grep -v 'duckdns.org/update' || true; echo "*/5 * * * * curl -fsS '$DUCK_URL' >/dev/null 2>&1") | crontab -
fi

step "Daily backups at 03:15 (kept for 14 days in $DATA_DIR/backups)"
(crontab -l 2>/dev/null | grep -v 'tools/backup.js' || true; echo "15 3 * * * cd '$APP_DIR/server' && $(command -v node) --disable-warning=ExperimentalWarning src/tools/backup.js >> '$DATA_DIR/backup.log' 2>&1") | crontab -

step "Turning on HTTPS for $DOMAIN"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy localhost:4000
}
EOF
sudo systemctl restart caddy

step "Checking it works"
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    printf '\n\033[1;32m✔ The Lead Story is online:\033[0m  https://%s\n   Editor’s desk:            https://%s/admin\n\n' "$DOMAIN" "$DOMAIN"
    echo "(The very first visit can take up to a minute while the HTTPS certificate is issued.)"
    exit 0
  fi
  sleep 2
done
echo "The server didn't answer. See what went wrong with:  sudo journalctl -u lead-story -n 50"
exit 1
