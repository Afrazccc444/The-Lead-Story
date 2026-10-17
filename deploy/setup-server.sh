#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  The Lead Story — one-time setup on a fresh Ubuntu server
#  (tested target: Ubuntu 22.04 / 24.04, e.g. a Namecheap VPS).
#
#  Usage, from the server's terminal:
#    git clone https://github.com/<you>/The-Lead-Story.git
#    bash The-Lead-Story/deploy/setup-server.sh yourdomain.com
#  (DuckDNS names also work:  … setup-server.sh name.duckdns.org <duckdns-token>)
#
#  It installs Node.js, Google Chrome (for PDFs) and Caddy (for HTTPS),
#  builds the site, runs it as its own low-privilege user, restarts it if
#  it ever stops, backs it up nightly, and shows the owner recovery key.
#  Safe to re-run.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?Usage: bash deploy/setup-server.sh yourdomain.com [duckdns-token]}"
DUCK_TOKEN="${2:-}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

step() { printf '\n\033[1;31m▶ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✘ %s\033[0m\n' "$*"; exit 1; }

# Root logins (common on VPS servers) get a dedicated "leadstory" user for the
# site itself: Chrome refuses to run as root, and a website should never have
# full control of the machine.
if [ "$(id -u)" = 0 ]; then
  SUDO=""
  RUN_AS=leadstory
  id "$RUN_AS" >/dev/null 2>&1 || adduser --system --group --home "/home/$RUN_AS" --shell /bin/bash "$RUN_AS" >/dev/null
  if [ "$APP_DIR" != "/home/$RUN_AS/$(basename "$APP_DIR")" ]; then
    step "Moving the code to /home/$RUN_AS"
    rm -rf "/home/$RUN_AS/$(basename "$APP_DIR")"
    cp -a "$APP_DIR" "/home/$RUN_AS/"
    APP_DIR="/home/$RUN_AS/$(basename "$APP_DIR")"
  fi
  chown -R "$RUN_AS:$RUN_AS" "/home/$RUN_AS"
  as_app() { sudo -u "$RUN_AS" -H bash -c "cd '$APP_DIR' && $*"; }
  app_crontab() { crontab -u "$RUN_AS" "$@"; }
else
  SUDO="sudo"
  RUN_AS="$(whoami)"
  as_app() { bash -c "cd '$APP_DIR' && $*"; }
  app_crontab() { crontab "$@"; }
fi
APP_HOME="$(getent passwd "$RUN_AS" | cut -d: -f6)"
DATA_DIR="$APP_HOME/lead-story-data"

step "Checking the web ports are free"
# Another web server (e.g. Apache) on port 80/443 would block HTTPS — never remove it silently.
BUSY="$($SUDO ss -ltnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -v caddy || true)"
if [ -n "$BUSY" ]; then
  echo "$BUSY"
  fail "Another program is already using port 80/443 (shown above). If it is an unused Apache or Nginx, stop it with:
    $SUDO systemctl disable --now apache2 nginx
  then run this script again. If other websites rely on it, ask for help first."
fi

TOTAL_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$TOTAL_MB" -lt 2000 ] && ! grep -q '^/swapfile ' /proc/swaps; then
  step "Adding 2 GB of swap space (this server has only ${TOTAL_MB} MB of memory)"
  $SUDO fallocate -l 2G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null
  $SUDO swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

step "Installing Node.js 24"
$SUDO apt-get update -y
$SUDO apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https
if ! node -v 2>/dev/null | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi

step "Installing a browser for making PDFs"
if [ "$(dpkg --print-architecture)" = "amd64" ]; then
  if ! command -v google-chrome >/dev/null; then
    curl -fsSLo /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    $SUDO apt-get install -y /tmp/chrome.deb
    rm -f /tmp/chrome.deb
  fi
  BROWSER="$(command -v google-chrome)"
else
  $SUDO snap install chromium
  BROWSER=/snap/bin/chromium
fi

step "Installing Caddy (gives the site HTTPS automatically)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | $SUDO gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y caddy
fi

step "Building the website"
as_app "npm ci && npm run build"

step "Saving the server settings"
as_app "mkdir -p '$DATA_DIR' && printf '%s\n' 'NODE_ENV=production' 'PORT=4000' 'DATA_DIR=$DATA_DIR' 'PDF_BROWSER_PATH=$BROWSER' > server/.env"

step "Starting the newsletter and making it start on every boot"
$SUDO tee /etc/systemd/system/lead-story.service >/dev/null <<EOF
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
$SUDO systemctl daemon-reload
$SUDO systemctl enable lead-story >/dev/null
$SUDO systemctl restart lead-story

if [ -n "$DUCK_TOKEN" ]; then
  step "Pointing $DOMAIN at this server (and keeping it up to date)"
  SUB="${DOMAIN%.duckdns.org}"
  DUCK_URL="https://www.duckdns.org/update?domains=$SUB&token=$DUCK_TOKEN&ip="
  curl -fsS "$DUCK_URL" && echo
  (app_crontab -l 2>/dev/null | grep -v 'duckdns.org/update' || true; echo "*/5 * * * * curl -fsS '$DUCK_URL' >/dev/null 2>&1") | app_crontab -
fi

step "Daily backups at 03:15 (kept for 14 days in $DATA_DIR/backups)"
(app_crontab -l 2>/dev/null | grep -v 'tools/backup.js' || true; echo "15 3 * * * cd '$APP_DIR/server' && $(command -v node) --disable-warning=ExperimentalWarning src/tools/backup.js >> '$DATA_DIR/backup.log' 2>&1") | app_crontab -

step "Opening the firewall for web traffic (if it is switched on)"
if command -v ufw >/dev/null && $SUDO ufw status | grep -q 'Status: active'; then
  $SUDO ufw allow OpenSSH >/dev/null
  $SUDO ufw allow 80/tcp >/dev/null
  $SUDO ufw allow 443/tcp >/dev/null
  echo "Allowed ports 80 and 443."
else
  echo "No active firewall — nothing to change."
fi

step "Turning on HTTPS for $DOMAIN"
# A bare domain (example.com) also gets www.example.com, which forwards to it.
if [ "$(tr -cd '.' <<<"$DOMAIN" | wc -c)" = 1 ]; then
  $SUDO tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy localhost:4000
}

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
EOF
else
  $SUDO tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy localhost:4000
}
EOF
fi
$SUDO systemctl restart caddy

step "Checking it works"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    printf '\n\033[1;32m✔ The Lead Story is running.\033[0m\n'
    printf '   Website:        https://%s\n   Editor’s desk:  https://%s/admin\n   Admin app:      https://%s/owner\n\n' "$DOMAIN" "$DOMAIN" "$DOMAIN"
    KEY_FILE="$DATA_DIR/OWNER-RECOVERY-KEY.txt"
    if [ -f "$KEY_FILE" ]; then
      printf '\033[1mYOUR OWNER RECOVERY KEY\033[0m (keep it private):\n\n   %s\n\n' "$(sed -n 3p "$KEY_FILE")"
      echo "Open https://$DOMAIN/admin/login, click “Owner: forgot your username or password?”,"
      echo "paste the key, and choose your own username and password."
      echo "You can show the current key again any time with:  sudo cat $KEY_FILE"
    fi
    echo
    echo "(HTTPS starts working once $DOMAIN points to this server — the first visit can take a minute.)"
    exit 0
  fi
  sleep 2
done
fail "The site didn't start. See what went wrong with:  ${SUDO:+sudo }journalctl -u lead-story -n 50"
