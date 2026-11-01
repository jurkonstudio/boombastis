#!/usr/bin/env bash
# Kirim migrasi di supabase/migrations ke project Supabase lewat CLI.
set -euo pipefail
cd "$(dirname "$0")/.."

read -rp "Project ref Supabase (bagian depan URL, mis. abcdefghijkl): " REF
if [ -z "$REF" ]; then
  echo "Project ref kosong, dibatalkan." >&2
  exit 1
fi

npx --yes supabase@latest login
npx --yes supabase@latest link --project-ref "$REF"
npx --yes supabase@latest db push

echo
echo "Selesai. Lanjut: buat user admin + HP, lalu jalankan supabase/setup_admin.sql."
