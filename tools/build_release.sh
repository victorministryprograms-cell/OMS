#!/usr/bin/env bash
# Builds a release archive that can be uploaded to cPanel.
#
#   tools/build_release.sh [output.zip]
#
# Excludes local data (the SQLite database), local secrets and the archive
# itself, so nothing private ends up on the server.
set -euo pipefail

cd "$(dirname "$0")/.."

OUT="${1:-oms-release.zip}"
rm -f "$OUT"

zip -r -q "$OUT" . \
  -x ".git/*" \
     "data/*" \
     "node_modules/*" \
     "*.zip" \
     "*.log" \
     "*.db" \
     "*.sqlite" \
     "*.sqlite3" \
     "api/config.local.php" \
     ".DS_Store" \
     "Thumbs.db"

echo "built $OUT ($(du -h "$OUT" | cut -f1), $(unzip -l "$OUT" | tail -1 | awk '{print $2}') files)"
