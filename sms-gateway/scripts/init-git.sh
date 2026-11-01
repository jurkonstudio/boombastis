#!/usr/bin/env bash
# Inisialisasi git dan commit pertama (aman dijalankan ulang).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -d .git ]; then
  echo "Repo git sudah ada, dilewati."
else
  git init -b main
fi

git add -A
if git diff --cached --quiet; then
  echo "Tidak ada perubahan untuk di-commit."
else
  git commit -m "SMS gateway: skema Supabase, panel admin, dokumentasi"
fi

echo
echo "Berikutnya, hubungkan ke GitHub lalu push:"
echo "  git remote add origin https://github.com/USERNAME/NAMA-REPO.git"
echo "  git push -u origin main"
