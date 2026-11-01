# Panduan Pengguna Boombastis

Panduan yang sama juga ada di aplikasi: **Lainnya > Panduan penggunaan**.

## Mulai dari nol

1. **Pilih paket**: Lainnya > Paket & pembayaran, transfer sesuai instruksi, tunggu admin mengonfirmasi.
2. **Pasang aplikasi gateway** di HP Android berisi SIM (menu Perangkat).
3. **Masukkan kode pairing** dari menu Perangkat ke aplikasi (berlaku 15 menit). Status jadi *Online*.
4. **Kirim SMS pertama** ke nomormu sendiri lewat menu Kirim.

## Kirim SMS

1. Menu **Kirim**, isi nomor tujuan (contoh `081234567890`).
2. Tulis pesan, maksimal 1000 karakter (160 karakter = 1 SMS).
3. Ketuk **Kirim SMS**, lalu pantau di **Pesan > Keluar**.

Pesan yang gagal mengembalikan kuota.

## Template pesan

| Jenis | Siapa yang bisa lihat | Dibuat oleh |
|---|---|---|
| Template umum | Semua pengguna | Admin |
| Milik saya | Hanya pemiliknya (maks. 50) | Pengguna |

**Memakai template**

1. Menu Kirim > **Pakai template**.
2. Pilih kategori, ketuk **Pakai**.
3. Isi kolom yang muncul (nama, nomor pesanan, dst.). Isi pesan terisi otomatis.
4. Periksa, ubah bila perlu, lalu kirim.

Bagian dalam kurung kurawal seperti `{nama}` adalah kolom isian. Pesan tidak bisa dikirim sebelum semuanya diisi.

**Menyimpan template sendiri**: tulis pesan di menu Kirim, ketuk **Simpan sebagai template**, beri nama.
Contoh: `Halo {nama}, pesananmu {no_pesanan} sudah dikirim.`
Nama variabel: huruf, angka, dan garis bawah saja.

### Untuk admin: kelola template umum

- Lewat panel: **Lainnya > Admin > Template** (tambah, ubah, hapus).
- Tambahan 9 template contoh: jalankan `supabase/migrations/20261101060000_more_templates.sql` di SQL Editor (opsional, aman diulang).

## Balasan otomatis

Lainnya > Balasan otomatis: aktifkan, atur jeda per pengirim dan batas harian, lalu tambah aturan (semua pesan / mengandung / sama persis / diawali kata). Prioritas terkecil dicek lebih dulu. Tiap balasan memakai kuota SMS.

## Masalah umum

| Gejala | Solusi |
|---|---|
| Pesan menunggu terus | Pastikan HP Online, ada sinyal dan pulsa/bonus SMS |
| Tombol Kirim nonaktif | Paket belum aktif atau habis |
| Pesan gagal | Baca keterangan merah di Pesan > Keluar |
| Template tidak bisa disimpan | Migrasi `20261101050000_templates.sql` belum dijalankan |
