# REFERENSI UI/UX — SCREENING MALOMO V1

**Versi:** 1.0 · **Tanggal:** 10 Oktober 2026 · **Mengacu:** PRD FINAL M1–M6 CONFLUENSE v1.0.7
**Sifat dokumen:** referensi desain untuk tampilan output PRD. Ini **bukan** perintah membangun aplikasi, dan tidak mengubah satu pun rumus, bobot, status, atau aturan di PRD. Bila ada perbedaan, **PRD yang berlaku**.

---

## 1. Prinsip yang tidak boleh dilanggar UI

UI hanya menampilkan apa yang dihasilkan PRD. Ada tujuh larangan yang menjaga UI tetap jujur terhadap kontrak PRD:

1. **Tidak ada tombol order, buy/sell, atau koneksi eksekusi.** PRD berlingkup riset (`research_only=true`). Tombol paling jauh adalah "Salin rencana", "Jurnalkan", atau "Ekspor JSON".
2. **M6 bukan peluang menang.** Skor selalu ditulis `395 / 500` dengan label "indeks". Persentase tampilan wajib berlabel "% indeks, bukan win rate". Dilarang ada kata "akurasi", "probabilitas profit", "sinyal pasti", atau sejenisnya.
3. **`null` tidak pernah tampil sebagai 0.** Nilai kosong ditampilkan "—" disertai chip status (mis. "Kalibrasi belum cukup"). Bar skor untuk nilai `null` dikosongkan dan diberi pola arsir, bukan bar 0%.
4. **Arah tidak hanya dibedakan dengan warna.** LONG/SHORT selalu ditulis sebagai teks dengan ikon panah, karena sebagian pengguna buta warna dan screenshot bisa hitam-putih.
5. **Tidak ada threshold M6.** UI tidak boleh menampilkan garis "minimal 350", warna lampu lalu lintas berdasarkan angka M6, atau label "kuat/lemah" dari M6. PRD §8.1.6 tidak punya ambang.
6. **Waktu ditampilkan dua zona.** Waktu utama UTC (sesuai PRD), dengan padanan WITA (UTC+8) di sebelahnya, misalnya `08:00 UTC · 16:00 WITA`.
7. **Versi selalu terlihat.** `score_version`, `normalization_version`, `risk_mandate_version`, dan `m5_snapshot` ditampilkan di footer detail kandidat, supaya hasil bisa direproduksi.

---

## 2. Pola dari Kuantara Terminal yang diadopsi

Referensi utama adalah [Kuantara Terminal](https://kuantara.id/) (Kuantara Analytics). Yang diambil adalah **pola tata letak dan interaksi**, bukan merek, logo, nama fitur, atau aset visualnya.

| Pola di Kuantara Terminal | Dipakai di Malomo untuk |
|---|---|
| Workspace multi-panel, terbaik di desktop | Layout utama 3 kolom: navigasi · daftar · inspektor |
| List kiri, reader/detail kanan (Analyst Reports, IDX Stock News) | Tabel kandidat kiri, **Inspektor Kandidat** kanan |
| Tiga bagian Build · Document · Inspector (Market Report Builder) | Inspektor kandidat dibagi: Skor · Rencana · Audit |
| Kolom kanban Ideas → Initiate → Still Intact → At Risk → Exit (Kuantara Research) | **Papan Event**: kolom per `event_status` (Menunggu → Terkonfirmasi → Selesai) |
| Screener dengan filter gabungan dan kolom sinyal (IDX Foreign Flow Screener) | Filter kandidat per pair, side, keluarga sinyal, `status` |
| Skor komposit 0–100 dengan label regime | Kartu skor M1–M5 (0–100) + M6 (0–500) tanpa label "kuat/lemah" |
| Pembacaan percentile, z-score, probabilitas | Tooltip komponen: TE14, ADX, percentile NATR, nilai ECDF |
| Tampilan bertab (COT Report, Trading Journal) | Tab di inspektor: Skor · Rencana · Audit · JSON |
| Grid multi-chart (Weekend Market) | Konteks pasar: 6 mini-chart pair dalam grid 3×2 |
| Badge "PREMIUM" / "COMING SOON" | Badge versi dan badge `STATIC_CONTRACT_CHECK` / "Belum diuji engine" |
| Alert Telegram dari Settings | Notifikasi Telegram setelah setiap siklus 4H (§7) |
| Copy Indonesia, imperatif pendek, menekankan konteks | Copy UI berbahasa Indonesia; istilah kontrak tetap Inggris dalam `kode` |
| Tema gelap mendekati hitam (theme-color `#050505`) | Tema gelap sebagai default, selaras tema Graphite Patah yang sudah dipakai |

---

## 3. Arsitektur informasi (layar)

Navigasi kiri berisi enam layar. Urutannya mengikuti urutan pipeline PRD §9.

| # | Layar | Pertanyaan yang dijawab | Sumber data PRD |
|---|---|---|---|
| S1 | **Siklus 4H** (beranda) | Apa hasil close terakhir? Ada kandidat layak? | §8.1, §9, kontrak JSON §10 |
| S2 | **Inspektor Kandidat** (panel kanan) | Kenapa kandidat ini lolos atau ditolak? | `scores`, rencana, `reasons[]`, provenance |
| S3 | **Papan Event** | Setup mana yang masih menunggu retest/zona/trigger? | `event_status` §9, generator §4.2–4.4 |
| S4 | **Portofolio Simulasi** | Slot mana yang terisi dan kapan lepas? | §6 portofolio simulasi, M4 |
| S5 | **Konteks Pasar** | Bagaimana struktur tiap pair dan korelasi basket? | M1 §3, M3 §5 |
| S6 | **Audit & Data** | Datanya sehat? Versi kalibrasi apa yang aktif? | §1 data/gap, §2 ECDF, §12 bukti, verifier |

### S1 — Siklus 4H (beranda)

**Bar atas siklus:**
- Jam close berikutnya dengan hitung mundur: `Close berikutnya 12:00 UTC · 20:00 WITA · 01:42:10`.
- Indikator kesehatan data: titik hijau "Data lengkap", kuning "Mengambil ulang (FETCH_FAILED)", merah "Candle hilang (CONFIRMED_GAP)".
- Progres pipeline sebagai stepper horizontal, mengikuti urutan PRD §9:
  `Ingest → Validasi → Indikator → M1 → Generator M2 → Kanonisasi → Skor M2 → M3 → M5 → Kandidat close → Open berikutnya → Cek risiko M4 → Ranking M6 → Keputusan → Log audit`.
  Langkah yang gagal berwarna peringatan dengan reason code-nya.

**Ringkasan keputusan siklus (satu baris kartu):**
`Layak dipertimbangkan 1` · `Ditolak risiko 2` · `Ditolak arah 1` · `Bentrok 0` · `Tidak ada entry 0`.
Kalau hasilnya `NO_ENTRY`, tampilkan state kosong yang jelas: "Tidak ada kandidat layak di close 08:00 UTC", lalu satu baris alasan terbanyak.

**Tabel kandidat** (urut sesuai tie-break PRD §8.1.5, bukan bisa diurut bebas secara default):

| Kolom | Isi | Catatan |
|---|---|---|
| Peringkat | 1, 2, 3… | Hanya untuk kandidat `ENTRY_CONSIDER` / `REJECTED_RISK` yang punya skor |
| Pair | `BTCUSDT` | |
| Arah | ▲ LONG / ▼ SHORT | Teks + ikon |
| Keluarga | Breakout · Pullback · Reversal | Label pendek dari `signal_family` |
| M6 | `395 / 500` | Bar horizontal 0–500 tanpa garis ambang |
| M1 + M2q | `150 / 180` | Dari `m1_plus_m2q_0_180_display_only`; tooltip: "pembeda utama antar kandidat, hanya tampilan" |
| Status | chip `status` | Warna per §5 |
| Alasan | chip `reasons[]` | Kosong untuk `ENTRY_CONSIDER` |
| Waktu | `confirmation_utc` | UTC + WITA |

Filter di atas tabel: Pair · Arah · Keluarga · Status. Default filter menampilkan semua status, supaya penolakan tetap terlihat.

### S2 — Inspektor Kandidat (panel kanan)

Empat tab:

**Tab Skor**
- Header: `BTCUSDT ▲ LONG · Breakout–Retest · Terkonfirmasi 08:00 UTC`.
- Kartu M6 besar: `395 / 500` dengan teks kecil "79% indeks · bukan win rate".
- Lima baris skor M1–M5, masing-masing bar 0–100 yang bisa dibuka untuk melihat komponen:
  - M1: Struktur 45 · Efisiensi tren 25 · ADX 10 · NATR tipikal 20, plus `market_structure_direction` sebagai chip terpisah (bukan turunan skor).
  - M2: **dua bar terpisah** — Kualitas sinyal `65 / 80` (generation 30 · momentum 25 · participation 25) dan Integritas `20 / 20` (kausal 10 · dedup 6 · konflik 4). Total `85 / 100` ditampilkan kecil di bawahnya.
  - M3: Korelasi 60 · Ekor bersama 40, dengan catatan "sama untuk semua kandidat pada waktu ini".
  - M4: Rencana 40 · Agregat 35 · Gross 25.
  - M5: `55 / 100` dengan badge `BREAKOUT_2024_NO_DIRECTION_GATE` dan tooltip "snapshot audit tetap, sama untuk semua kandidat".
- Untuk Reversal: tampilkan juga `m1_origin_direction` dengan label "Struktur asal (sebelum break)".
- Kotak catatan permanen di bawah skor: "Skor ini indeks desain riset. M1 dan M2 bisa berbagi informasi harga; M2 integritas dan M5 sama-sama audit proses. Bukan lima bukti independen." (diringkas dari PRD §8.3).

**Tab Rencana** (hanya terisi setelah fase `ENTRY_REVIEW`; sebelum itu tampil "Menunggu open candle berikutnya")
- Entry referensi (open), Stop, Target (2R), Qty, Risiko %, Gross %.
- Invalidasi: aturan + harga, misalnya "Close di bawah 98.80 (L − r)".
- Batas waktu: `slot lepas 08:00 UTC besok` (24 jam tetap).
- Dua nilai ATR terpisah dengan label: "ATR entry (candle konfirmasi)" dan "ATR frozen (sebelum break)".
- Peringatan statis: "Harga belum dikuantisasi ke tick size Binance. Bukan harga order."

**Tab Audit**
- Tiga lapis status sebagai tiga chip berurutan: `event_status` · `score_status` · `status`.
- `reasons[]` dengan label manusia (§6).
- Timeline waktu: Break → Konfirmasi → Open entry → Slot lepas.
- `source_labels[]`, `duplicate_count`, log cek konflik (`conflict4`).
- Versi: `normalization_version`, `risk_mandate_version`, `m5_snapshot`, `score_version`.

**Tab JSON**
- JSON mentah kontrak §10, dengan tombol "Salin" dan "Unduh". Field `null` ditampilkan apa adanya.

### S3 — Papan Event (kanban)

Mengadopsi pola kolom kanban Kuantara Research. Setiap kartu adalah satu event (bukan kandidat).

| Kolom | `event_status` yang masuk |
|---|---|
| Menunggu | `WAITING_RETEST`, `WAITING_ZONE`, `WAITING_CONTINUATION`, `CHOCH_CANDIDATE` |
| Terkonfirmasi | `CONFIRMED` |
| Bentrok | `CONFLICTING_DIRECTIONS`, `MULTI_METHOD_COLLISION` |
| Selesai tanpa sinyal | `INVALID`, `EXPIRED`, `PREZONE_CENSORED`, `CENSORED` |
| Label riset | `UNSUPPORTED_FOR_SCORING` |

Isi kartu: pair, arah, keluarga, level `L`, dan progres jendela, misalnya "Retest: candle 3 dari 6" atau "Zona: candle 9 dari 24 (i+3 s.d. i+26)". Kartu di kolom "Menunggu" tidak menampilkan skor apa pun (`score_status=NOT_APPLICABLE`).

### S4 — Portofolio Simulasi

- **Tiga kartu slot.** Slot terisi menampilkan pair, arah, entry, stop, target, dan hitung mundur "lepas dalam 14j 20m". Slot kosong bertuliskan "Slot kosong — kapasitas maksimum, bukan target".
- **Dua meter horizontal:**
  - Risiko terbuka: `2.0% / 3.0%`.
  - Gross notional: `84% / 100%`, dengan tooltip "Batas gross umumnya tercapai sebelum batas 3 slot".
- **Catatan tetap:** "Ekuitas acuan 100 unit, tanpa kompaun. Slot terisi 24 jam penuh; stop/target hanya mencatat hasil." (PRD §6).
- **Log penolakan** dengan kolom waktu, pair, dan reason (`GROSS_CAP` / `PAIR_ACTIVE` / `POSITION_OR_RISK_CAP`), plus ringkasan jumlah per alasan.
- Hasil (outcome) per posisi ditampilkan terpisah dari status slot, supaya tidak tampak seolah stop membebaskan slot.

### S5 — Konteks Pasar

- **Grid 3×2 mini-chart** (pola Weekend Market): satu per pair, candle 4H, dengan pivot terkonfirmasi dan level aktif. Hanya candle yang sudah close.
- **Tabel M1 per pair:** struktur (BULLISH/BEARISH/TRANSITION), TE14, ADX14, percentile NATR, skor M1.
- **M3:** heatmap korelasi 6×6 (60 return) dan angka `J` (joint downside tail, 180 return), plus skor M3 dengan catatan "konteks bersama, bukan arah".
- Indikator yang **tidak** ada di PRD (RSI, MACD, EMA ribbon) **tidak** ditampilkan di layar ini, supaya tidak tercampur dengan logika screener Patah Pensill yang lain.

### S6 — Audit & Data

- **Kesehatan data per pair:** candle terakhir, jumlah gap terkonfirmasi, status pengambilan terakhir, jendela yang belum pulih ("M3 pulih dalam 112 candle").
- **Kalibrasi aktif:** versi array beku per keluarga (Breakout 258 · Pullback 189 · Reversal 44) dan hash file normalisasi.
- **Snapshot M5** dengan label cakupan dan larangan klaim.
- **Status verifier:** jumlah PASS/FAIL. Tes `STATIC_CONTRACT_CHECK` diberi badge abu-abu "Belum diuji engine".
- **Unduhan:** log audit siklus (JSON lines).

---

## 4. Layout dan responsif

**Desktop (≥1280 px)** — pola workspace multi-panel Kuantara:
```
┌──────────┬─────────────────────────────┬──────────────────────┐
│ Navigasi │ Bar siklus (jam · data · stepper)                  │
│  S1–S6   ├─────────────────────────────┬──────────────────────┤
│          │ Tabel kandidat / Papan /    │ Inspektor Kandidat   │
│          │ Portofolio / Konteks        │ [Skor|Rencana|Audit|JSON]
│          │                             │                      │
└──────────┴─────────────────────────────┴──────────────────────┘
```
- Navigasi kiri: rail ikon 64 px, bisa dibuka jadi 220 px.
- Inspektor kanan: 400–480 px, bisa ditutup.

**Tablet (768–1279 px):** navigasi jadi rail ikon. Inspektor muncul sebagai panel geser dari kanan di atas tabel.

**Mobile (<768 px):**
- Bottom tab bar berisi lima item: Siklus · Event · Portofolio · Pasar · Audit.
- Tabel kandidat berubah jadi kartu bertumpuk (pair + arah + M6 + chip status).
- Ketuk kartu untuk membuka Inspektor sebagai bottom sheet layar penuh, dengan tab di atas.
- Heatmap korelasi 6×6 tetap utuh dengan sel kecil, dan angka muncul saat diketuk.
- Tanpa scroll horizontal di level halaman; tabel lebar boleh scroll di dalam wadahnya sendiri.

---

## 5. Token visual

Tema gelap sebagai default, melanjutkan keluarga **Graphite Patah** (`#0A0B07`, permukaan graphite, aksen violet) yang sudah dipakai di PWA screener Patah Pensill, dan sejalan dengan nuansa near-black Kuantara. Nilai di bawah adalah **usulan awal** dan bisa disesuaikan dengan token Graphite Patah yang sebenarnya.

| Token | Nilai usulan | Dipakai untuk |
|---|---|---|
| `--bg` | `#0A0B07` | Latar halaman |
| `--surface` | `#13140F` | Panel, kartu |
| `--surface-2` | `#1B1C16` | Header tabel, input |
| `--border` | `#2A2B24` | Garis pemisah |
| `--text` | `#E9E9E1` | Teks utama |
| `--text-muted` | `#9B9C91` | Label, keterangan |
| `--primary` | `#8B7CF6` | Aksen, fokus, `ENTRY_CONSIDER` |
| `--long` | `#3FB68B` | Ikon/teks LONG |
| `--short` | `#E5735A` | Ikon/teks SHORT |
| `--warn` | `#E0A84A` | Status `*_INCOMPLETE`, `FETCH_FAILED` |
| `--reject` | `#D9605A` | Status `REJECTED_*`, `CONFIRMED_GAP` |
| `--neutral` | `#6F7066` | `WAITING_*`, `NOT_APPLICABLE` |

**Tipografi:**
- Teks UI: sans-serif dengan dukungan Indonesia yang baik (mis. Inter atau IBM Plex Sans).
- Angka: monospace atau `font-variant-numeric: tabular-nums` (mis. IBM Plex Mono / JetBrains Mono), supaya kolom harga dan skor sejajar.
- Skala: 12 / 14 / 16 / 20 / 28 px. Angka M6 di kartu besar 28 px.

**Format angka:**
- Skor: 2 desimal (round half up, hanya untuk tampilan).
- Harga: presisi asli float64 dipotong untuk tampilan sesuai pair, dengan catatan "belum dikuantisasi tick".
- Persentase: 2 desimal + `%`, selalu dengan label apa yang dipersentasekan.

---

## 6. Kamus label (kode → teks UI)

Kode kontrak tetap ditampilkan kecil di tooltip, supaya UI dan log audit bisa dicocokkan.

**`event_status`**

| Kode | Label UI |
|---|---|
| `WAITING_RETEST` | Menunggu retest |
| `WAITING_ZONE` | Menunggu zona pullback |
| `WAITING_CONTINUATION` | Menunggu trigger |
| `CHOCH_CANDIDATE` | Kandidat CHoCH |
| `CONFIRMED` | Terkonfirmasi |
| `INVALID` | Batal (invalidasi) |
| `EXPIRED` | Kedaluwarsa |
| `CENSORED` | Data terpotong |
| `PREZONE_CENSORED` | Zona tak tersentuh (24 candle) |
| `UNSUPPORTED_FOR_SCORING` | Label riset, tanpa skor |
| `CONFLICTING_DIRECTIONS` | Arah bertentangan |
| `MULTI_METHOD_COLLISION` | Bentrok keluarga sinyal |

**`score_status`**

| Kode | Label UI |
|---|---|
| `SCORED` | Skor sah |
| `NOT_APPLICABLE` | Belum perlu skor |
| `INCOMPLETE` | Tidak dapat dihitung |
| `DATA_INCOMPLETE` | Data belum lengkap |
| `CALIBRATION_INCOMPLETE` | Kalibrasi belum cukup |
| `SCORE_INCOMPLETE` | Komponen skor tak terdefinisi |
| `AUDIT_INCOMPLETE` | Audit belum terbukti |
| `NO_SCORE` | Skor belum lengkap |

**`status` keputusan**

| Kode | Label UI |
|---|---|
| `CLOSE_CANDIDATE` | Kandidat, menunggu open |
| `ENTRY_CONSIDER` | Layak dipertimbangkan |
| `NO_ENTRY` | Tidak ada entry |
| `REJECTED_DIRECTION` | Ditolak: arah |
| `REJECTED_INTEGRITY` | Ditolak: integritas |
| `REJECTED_RISK` | Ditolak: risiko |
| `CONFLICTING_DIRECTIONS` | Ditolak: arah bertentangan |
| `MULTI_METHOD_COLLISION` | Ditolak: bentrok keluarga |
| `RESEARCH_ONLY` | Riset saja |

**`reasons[]`**

| Kode | Label UI |
|---|---|
| `FETCH_FAILED` | Gagal ambil data, sedang coba ulang |
| `CONFIRMED_GAP` | Candle hilang di sumber |
| `GROSS_CAP` | Batas gross 1× penuh |
| `PAIR_ACTIVE` | Pair sudah punya posisi |
| `POSITION_OR_RISK_CAP` | Slot atau risiko terbuka penuh |
| `CONFLICT_CHECK_NOT_LOGGED` | Log cek konflik tidak ada |

Kata "Layak dipertimbangkan" sengaja dipilih, bukan "Entry" atau "Beli", karena `ENTRY_CONSIDER` adalah usulan riset (PRD §0 butir 7).

---

## 7. Notifikasi Telegram (format usulan)

Satu pesan per close 4H, termasuk ketika tidak ada kandidat, supaya ketiadaan sinyal juga terdokumentasi.

```
Malomo · close 08:00 UTC (16:00 WITA) · 10 Okt 2026
Layak dipertimbangkan: 1 · Ditolak risiko: 2 · Ditolak arah: 1

#1 BTCUSDT ▲ LONG · Breakout–Retest
M6 395/500 (indeks, bukan win rate) · M1+M2q 150/180
Entry ref 100.00 · Stop 97.00 · Target 106.00 · Risiko 1.00%
Invalidasi: close < 98.80 · Slot lepas 08:00 UTC besok

Riset saja. Bukan saran transaksi.
Versi: RESEARCH_1_3_1X_V1 · M5_AUDIT_2024_CLOSED_BAR_9BPS_V1
```

Jika data bermasalah, pesan diawali baris status data, misalnya `⚠ Data: DOGEUSDT CONFIRMED_GAP 04:00 UTC — M3 belum pulih`.

---

## 8. Daftar periksa penerimaan UI

UI dianggap sesuai PRD jika semua butir ini lulus:

- [ ] Tidak ada elemen yang menampilkan `null` sebagai `0`, `0%`, atau bar kosong tanpa arsir.
- [ ] Setiap tampilan M6 punya label "indeks" dan tidak ada label "win rate", "akurasi", atau "peluang".
- [ ] Tidak ada garis ambang, warna, atau label kualitas yang diturunkan dari angka M6.
- [ ] M2 selalu ditampilkan sebagai dua bagian: kualitas 80 dan integritas 20.
- [ ] Urutan default tabel kandidat sama persis dengan tie-break PRD §8.1.5.
- [ ] LONG/SHORT selalu berupa teks + ikon, bukan warna saja.
- [ ] Semua waktu tampil dalam UTC dengan padanan WITA.
- [ ] Tab Rencana kosong ("Menunggu open") sebelum fase `ENTRY_REVIEW`.
- [ ] Portofolio menampilkan slot terisi 24 jam penuh, terpisah dari outcome stop/target.
- [ ] Setiap penolakan menampilkan reason code dengan label manusia.
- [ ] Versi kalibrasi, mandat risiko, dan snapshot M5 terlihat di detail kandidat.
- [ ] Tidak ada tombol order atau integrasi eksekusi ke exchange.
- [ ] Tidak ada merek, logo, nama fitur, atau aset visual Kuantara yang disalin; hanya pola tata letak.
- [ ] Layout mobile tanpa scroll horizontal di level halaman.

---

## 9. Sumber referensi

- [Kuantara Terminal — kuantara.id](https://kuantara.id/) (struktur workspace multi-panel, pola list–detail, kanban riset, screener berfilter, skor komposit 0–100, alert Telegram, copy Indonesia).
- [Kuantara Analytics — LinkedIn](https://www.linkedin.com/in/kuantara-analytics-8236b1360/) (deskripsi produk).
- PRD FINAL M1–M6 CONFLUENSE v1.0.7 (semua kode status, field, rumus, dan aturan yang ditampilkan).
