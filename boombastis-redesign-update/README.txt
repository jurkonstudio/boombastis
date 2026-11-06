Update homepage Boombastis (gaya staff-card, teks mengetik di hero).

File yang diganti:
  scripts/build.mjs
  assets/site.css
  assets/home.js

Cara di Codespace:
  1. Upload folder ini (atau zip-nya lalu unzip) ke root repo.
  2. Di terminal, dari root repo:
       bash boombastis-redesign-update/replace.sh
  3. Cek http://localhost:8000 (atau preview Codespace), lalu commit & push:
       git add -A && git commit -m "Redesign homepage" && git push

Backup file lama otomatis disimpan di folder .backup-<waktu>.
Preview ada di folder preview/.
