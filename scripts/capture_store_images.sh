#!/usr/bin/env bash
# Captures the Chrome Web Store screenshots and promo tiles from store/shots/*.html into store/images/.
# Needs the harness server:  python3 -m http.server 8090 --bind 127.0.0.1   (from this folder)
# Then run:  python3 scripts/build_site_assets.py   to copy them into the website.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${BASE:-http://localhost:8090}"
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium)}"
PROFILE=$(mktemp -d /tmp/gv-shots-XXXX)
trap 'rm -rf "$PROFILE"' EXIT

shot() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir="$PROFILE" \
    --force-device-scale-factor=1 --window-size="$2" --virtual-time-budget=8000 --screenshot="$3" "$BASE/$1" 2>/dev/null
  echo "  $3"
}

for n in 1 2 3 4 5; do shot "store/shots/shot.html?n=$n" 1280,800 "store/images/screenshot-$n.png"; done
shot "store/shots/promo.html?size=small" 440,280 store/images/promo-small-440x280.png
shot "store/shots/promo.html?size=marquee" 1400,560 store/images/promo-marquee-1400x560.png
