# Situs personal — kerangka

Status: **kerangka, belum layak terbit.** Seluruh isi masih kosong dan ditandai
`BELUM DIISI` di halaman. Yang selesai adalah wadahnya: struktur, sistem desain,
semantik, aksesibilitas, dan SEO.

Ini disengaja. PART 4.2 dari brief melarang AI mengarang isi, dan PART 6
menyatakan esai harus ditulis manusia. Jadi tidak ada satu kalimat pun di situs
ini yang berbicara atas nama pemiliknya.

## Berkas

| Berkas | Isi |
|---|---|
| `index.html` | Halaman utama, Bagian 1 sampai 8 |
| `tulisan-1.html` | Catatan kerja 1. Kerangka 5 bagian wajib (PART 6.1) |
| `tulisan-2.html` | Catatan kerja 2 |
| `tulisan-3.html` | Catatan kerja 3 |

Tanpa build step. Buka berkasnya langsung, atau jalankan
`python3 -m http.server` dari folder ini.

## Yang harus diisi sebelum terbit

| No | Blok | Lokasi |
|---|---|---|
| 1 | Nama yang dipakai di situs | `<title>`, JSON-LD `Person`, kolofon di keempat berkas |
| 2 | Klaim pusat | `index.html`, `<h1 id="klaim">` |
| 3 | Empat butir strip bukti | `index.html`, `ul.bukti` |
| 4 | Kalimat pengakuan pembatasan karya | `index.html`, `div.pembatasan` |
| 5 | Tiga entri karya milik sendiri + gambar WebP | `index.html`, Kelompok B |
| 6 | 4 sampai 6 baris jejak | `index.html`, `#jejak` |
| 7 | 5 sampai 7 pernyataan cara kerja | `index.html`, `ul.prinsip` |
| 8 | Kalimat pemicu ajakan | `index.html`, `p.pemicu` |
| 9 | Kanal kontak dan janji waktu balas | `index.html`, `p.kanal` dan `p.balas` |
| 10 | Teks lengkap tulisan 1 | `tulisan-1.html` |
| 11 | Teks lengkap tulisan 2 | `tulisan-2.html` |
| 12 | Teks lengkap tulisan 3 | `tulisan-3.html` |
| 13 | Domain sebenarnya | ganti `GANTI-DENGAN-DOMAIN-ANDA.tld` (9 tempat) |

Nomor 10 adalah syarat terberat. Brief-nya sendiri melarang situs ini terbit
sebelum nomor 10 selesai, dan alasannya benar: kerangka rapi yang kosong justru
memperkuat kecurigaan yang ingin dibantah situs ini.

Setiap blok `BELUM DIISI` sudah memuat spesifikasi isinya dan target panjangnya.
Beberapa berisi komentar HTML dengan markup penggantinya, siap disalin.

## Anggaran isi layar pertama (hasil pengukuran, bukan taksiran)

Diukur di Chromium dengan Source Serif 4 dan Inter yang benar-benar termuat.

| Blok | Batas brief | Batas terukur | Kenapa |
|---|---|---|---|
| Klaim pusat | 15 kata | **77 karakter (~9 kata)** | Di atas itu judul jadi 4+ baris di layar 390px |
| Paragraf pendukung | 30 kata | **216 karakter (~25 kata)** | Menjaga bagian pembuka di bawah 70vh pada 390×844 |
| Tiap butir bukti | 9 kata | **45 karakter (~6 kata)** | Empat butir menumpuk vertikal di mobile |

Pada anggaran itu bagian pembuka terukur 587px = **69,6vh** di 390×844, dan
536px = **59,6vh** di 1440×900. Pada panjang maksimum versi brief, angkanya
91,1vh dan 70,2vh — lewat batas.

Strip bukti tetap terlihat tanpa scroll di kedua ukuran layar, bahkan pada
panjang isi maksimum.

## Pertentangan di dalam brief, dan cara ini diselesaikan

1. **PART 9 "satu kolom di semua ukuran" vs PART 5 Bagian 2 "strip bukti
   horizontal di desktop".** Diselesaikan: halaman tetap satu kolom; strip bukti
   diperlakukan sebagai pengecualian lokal karena isinya empat fakta pendek,
   bukan teks bacaan. Untuk memaksa satu kolom penuh, hapus dua blok
   `@media` pada `.bukti`.
2. **PART 8.3 "aksen maksimal 3 tempat" vs PART 8.5 "tautan hover jadi
   aksen".** Diselesaikan: "tempat" dihitung sebagai peran, bukan jumlah elemen.
   Tiga perannya diberi komentar di CSS: hover tautan, garis pengakuan
   pembatasan, dan tautan ajakan.
3. **PART 12 "jangan jalankan sebelum nomor 10 terisi" vs PART 4.2 "render blok
   kosong sebagai placeholder".** Diselesaikan: PART 4.2 yang dipakai, karena
   PART 4.2 secara eksplisit mengatur perilaku saat blok masih kosong. Yang
   dihasilkan adalah wadah, bukan situs siap terbit.
4. **PART 5 Bagian 1 "maksimal 70vh" vs panjang maksimum isinya sendiri.**
   Tidak bisa dipenuhi bersamaan di 390×844. Lihat tabel anggaran di atas.

## Keputusan desain yang perlu dicatat

- `--measure: 36.5rem` (657px, teks 609px). Angka ini bukan tebakan: lebar glif
  rata-rata Source Serif 4 pada 18px terukur 9,39px, bukan ~8,6px seperti
  perkiraan awal. Dengan 609px, ukuran baris terukur 64 karakter rata-rata
  (rentang 59 sampai 67).
- Ukuran huruf dasar memakai `font-size:112.5%`, bukan `18px`, supaya preferensi
  ukuran huruf pengguna tetap dihormati. Hasil akhirnya tetap 18px.
- Tanpa JavaScript. Mode gelap murni `prefers-color-scheme`, tanpa tombol.
- Source Serif 4 berat 400 dan 600 dilayani satu berkas variable font yang sama,
  jadi tiga berat hanya menghasilkan dua unduhan.
