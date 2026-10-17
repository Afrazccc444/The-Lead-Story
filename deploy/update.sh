#!/usr/bin/env bash
# Brings the online server up to date with the latest code on GitHub:
#   bash /home/leadstory/The-Lead-Story/deploy/update.sh
# Articles, photos, accounts and the recovery key are not touched (they live in lead-story-data).
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="$(stat -c %U "$APP_DIR")"

# Run the build as the user that owns the site (not root).
if [ "$(id -u)" = 0 ] && [ "$OWNER" != root ]; then
  sudo -u "$OWNER" -H bash -c "cd '$APP_DIR' && git pull --ff-only && npm ci && npm run build"
  systemctl restart lead-story
else
  cd "$APP_DIR"
  git pull --ff-only
  npm ci
  npm run build
  sudo systemctl restart lead-story
fi
echo "Updated and restarted."
