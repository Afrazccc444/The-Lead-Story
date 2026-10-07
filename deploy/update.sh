#!/usr/bin/env bash
# Brings the online server up to date with the latest code on GitHub:
#   bash ~/the-lead-story/deploy/update.sh
# Articles, photos and the password are not touched (they live in ~/lead-story-data).
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
npm ci
npm run build
sudo systemctl restart lead-story
echo "Updated and restarted."
