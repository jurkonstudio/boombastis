#!/usr/bin/env bash
# Jalankan dari root repo boombastis di Codespace:
#   bash replace.sh     (letakkan folder ini / file ini di root repo, atau sesuaikan HERE)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${REPO:-$PWD}"
if [ ! -f "$REPO/scripts/build.mjs" ]; then
  echo "Error: jalankan dari root repo (folder yang berisi scripts/build.mjs)."; exit 1
fi
STAMP=$(date +%Y%m%d-%H%M%S)
BAK="$REPO/.backup-$STAMP"
mkdir -p "$BAK/scripts" "$BAK/assets"
for f in scripts/build.mjs assets/site.css assets/home.js; do
  cp "$REPO/$f" "$BAK/$f"
  cp "$HERE/files/$f" "$REPO/$f"
  echo "replaced: $f"
done
node scripts/build.mjs
node tests/check.mjs
echo "Selesai. Backup file lama: $BAK"
echo "Lanjut: git add -A && git commit -m 'Redesign homepage' && git push"
