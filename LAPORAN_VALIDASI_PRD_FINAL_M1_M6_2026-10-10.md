# LAPORAN VALIDASI — PRD FINAL M1–M6 CONFLUENSE

**Tanggal:** 10 Oktober 2026.  
**Status:** **VALIDASI KONTRAK/RUMUS LULUS**; **uji profitabilitas M6 Confluense belum dilakukan** dan **tidak diklaim**.

## Tujuan

Memastikan spesifikasi akhir perhitungan lima metodologi dan penjumlahan Confluense dapat direproduksi tanpa menyamakan skor dengan probabilitas kemenangan. Dokumen PRD menggunakan angka bobot penelitian 2024 yang sudah terkunci dan mengganti M6 lama berdasarkan instruksi pengguna; tidak membuat aplikasi atau transaksi.

## Verifikasi yang dijalankan

- **Revisi v1.0.1:** ditambah T21–T23 (status tiga lapis, schema JSON, rekonsiliasi sampel 258/152/410); total **26/26 PASS**.
- **Revisi v1.0.2:** ditambah T24 (field waktu `break_utc`/`confirmation_utc`, aturan `ATR_entry` dan `M1_origin`); total **27/27 PASS**.
- **Revisi v1.0.3:** ditambah T25 (metode `ewm(alpha=1/14, adjust=False)` normatif untuk ATR/DI/ADX; jendela Pullback `i+3`..`i+26`); total **28/28 PASS**.
- **Revisi v1.0.4:** ditambah T26 (kontrak log `conflict4`, label CSV in-sample, label cakupan M5/M4); total **29/29 PASS**.
- **Revisi v1.0.5:** ditambah T27 (reason data/gap dan M4, slot 24 jam tetap, field tampilan); T04/T05/T09/T14/T15 dilabeli `STATIC_CONTRACT_CHECK` (bukan validasi engine); total **30/30 PASS**.
- **Revisi v1.0.6:** ditambah T28 — CSV skor kausal 772 event diverifikasi independen (hash, jumlah, hitungan pembanding, kebijakan null, 400 skor train dan 281 skor eval direproduksi dari fitur mentah); total **31/31 PASS**.
- **Revisi v1.0.7 (audit menyeluruh):** rumus komponen M1/M2 diverifikasi ulang 410/410 terhadap CSV kanonis; seluruh token kode di PRD terdaftar; field JSON ATR dirapikan; pemetaan label CSV audit; T29 ditambahkan; total kini **32/32 PASS**. Tidak ditemukan bug rumus. Label Spearman §12.1 dikoreksi: angka mengukur `signal_generation_30` (eval +0.115 direproduksi tepat), bukan kualitas 80.
- **Revisi v1.0.8 (paritas engine vs candle asli 2024):** teks §4.2–§4.5 diselaraskan dengan generator arsip berdasarkan jawaban audit paritas 11 Okt 2026 — Breakout satu event aktif per sisi dengan pivot boleh dipakai ulang, Pullback satu setup aktif per sisi, Reversal syarat kronologi pivot `l2<l1<h1`/`h2<h1<l1`, epsilon E4 khusus Breakout v1. Engine JavaScript mereproduksi 772/772 event bukti tanpa ekstra serta M1, generation30, dan kualitas 80 kausal 772/772 dari arsip kline resmi data.binance.vision (checksum cocok). Tes I07–I09 ditambahkan di §11. Verifier tetap **32/32 PASS**. Tidak ada perubahan bobot atau rumus skor.
- **Revisi v1.0.9 (Tahap A — uji arsitektur):** §14 baru mencatat backtest komposit atas 30 pair USDⓈ-M paling likuid (Feb 2024–Okt 2026, data asli, biaya 9/18 bps + funding) dengan ablation per lapis. Hasil: edge per sinyal ≈ 0 (−0.004R, 7.190 trade); sistem penuh +0.032R/trade (t 1.56) pada 9 bps dan +0.010R pada 18 bps; ranking M6 setara acak; seluruh event Reversal bentrok. Usulan perbaikan dan kriteria Tahap B dicatat; aturan normatif tidak berubah. Verifier tetap **32/32 PASS**.
- **Revisi v1.0.10 (Tahap A2 — riset generator baru):** §15 mencatat 28 konfigurasi (7 keluarga generator × 2 varian × dengan/tanpa rezim BTC) atas 30 pair likuid 2024–2026, biaya 18 bps + funding. Tidak ada yang lulus kriteria §14.6. Kandidat paling konsisten (Breakout PRD + rezim BTC) gagal uji ketahanan (91% hasil dari dua pair). Rekomendasi: belum ada uang nyata; paper forward test lapis rezim BTC; aplikasi diposisikan sebagai alat bantu screening. Verifier tetap **32/32 PASS**.
- **Revisi v1.0.11 (lapisan penggunaan nyata):** §16 mencatat keputusan pengguna memakai uang nyata dan menambah dua lapisan tampilan: R32 rencana siap salin (pembulatan tick/step ke arah aman, qty dari modal dan risiko 0,5–1%, leverage maksimum aman otomatis, aturan pair dari `exchangeInfo` publik) dan R33 label rezim BTC informatif. Uji acak menemukan dan memperbaiki satu bug pembulatan (toleransi galat float terlalu longgar pada harga besar); regresinya kini dites. Suite baru `test-exec.js` 15/15, tes browser 23/23, verifier tetap **32/32 PASS**. Engine, skor, keputusan, dan record audit tidak berubah.
- **Revisi v1.0.12 (universe 100 pair):** §17 — aplikasi live menghitung 100 pair USDT perpetual dengan volume harian tertinggi, ranking tiap close harian 00:00 UTC (08:00 WITA), hard gate; basket M3 tetap enam pair; rumus dan bobot tidak berubah. Invarian skor diuji: skor M1/M2/M3/M5 setiap event identik dihitung bersama 6 pair maupun bersama universe. Uji beban dengan 75 pair asli: 8.988 record browser identik dengan engine Node. Suite baru `test-universe.js` 11/11, browser 24/24, browser data asli 10/10, verifier tetap **32/32 PASS**.
- **Revisi v1.0.13 (tiga layar, Tahap 1):** §18 — layar Decision (hard gate, skor dikunci di ledger), Semua Pair (universe realtime, M1 per pair), Jurnal Sinyal (hasil SL/TP/horizon + CSV); universe 100 pair realtime dari volume 24 jam berjalan dengan snapshot per close 4H sebagai gate; layar riset lama dan unduh log audit dihapus. Uji menemukan dan memperbaiki satu bug sejak R34: pair penentu yang gagal diunduh sejak percobaan pertama tidak menahan keputusan. Suite baru `test-ledger.js` 9/9, universe 14/14, browser 17/17, browser data asli 10/10 (ledger browser identik dengan Node), verifier tetap **32/32 PASS**. Rumus dan bobot tidak berubah.
- **23/23 PASS** (v1.0.0), 0 FAIL pada `verify_final_prd.py`: 20 kontrak sintetik (rentang bobot, pemisahan M2 80+20, rumus penjumlahan 0–500, kasus kosong, status konflik, guard risiko, state, tie-break) dan 3 pemeriksaan sumber data.
- **410/410 baris** pada `CANONICAL_SCORES_410_EVENTS_2024.csv` memenuhi identitas penjumlahan komponen M1 serta kualitas sinyal M2 0–80; lulus pemeriksaan batas numerik. Ini bukan verifikasi ulang skor integritas M2 20, sebab nilai audit tersebut memang `NOT_RECOMPUTED_FROM_EVENT_PROVENANCE` pada arsip 410 event yang tersedia.
- **33/33 PASS** adalah status uji generator penelitian v2 dalam `closure_contracts.json` yang dibaca ulang; jangan diklaim sebagai 33 tes baru pada engine/live.
- Verifikasi jumlah array kalibrasi penelitian: **258 Breakout, 189 Pullback, 44 Reversal**, dengan CDF keluarga terpisah. Hanya data yang sah pada waktu keputusan boleh menentukan skor historis.
- Contoh Confluense: `M1=85`, `M2=85` (kualitas65+audit20), `M3=70`, `M4=100`, `M5=55` → **M6=395/500 =79% indeks**, bukan win rate.
- **10 fingerprint Git blob SHA** untuk dokumen pada **delapan repository GitHub** ditangkap melalui konektor GitHub read-only; semua file yang tercantum berhasil diakses. Fingerprint dimasukkan ke PRD sebagai sumber audit agen.

## Batas yang tidak boleh disamarkan

1. **M6 aditif merupakan keputusan baru pengguna**; belum terdapat satu backtest menyeluruh untuk skor M1+M2+M3+M4+M5 dengan integritas 20 yang direkonstruksi pada setiap event.
2. Audit M5=55 berasal dari protokol penelitian event 2024. Pemakaiannya sebagai konstanta global adalah **desain administratif v1**, bukan bukti seluruh keluarga strategi mempunyai reliabilitas sama.
3. M1 dan M2 berbagi bukti price path pada horizon berbeda. M2 integritas 20 dan M5 mengandung pemeriksaan proses. Menjumlahkannya tepat secara aritmetika namun **tidak membuktikan informasi independen**.
4. Nilai fee, equity, ATR stop, target, serta ambang volume adalah asumsi penelitian 2024. **Tidak ada order, fill aktual, funding, atau strategi live yang diuji di sini**.
5. Syarat untouched validation 2025–2026 telah **dihapus sebagai kewajiban kerja** atas instruksi pengguna; hal ini **tidak menjadikan hasil 2024 konfirmatori**.

## Keputusan akhir

**PRD final v1 dapat diberikan ke agen sebagai dokumen normatif tanpa pilihan bobot atau threshold yang tersisa untuk diputuskan sendiri.** Bila input yang diwajibkan tidak ada, status output sudah ditentukan (`INCOMPLETE`/`NO_ENTRY`), bukan berarti agen boleh menyulap angka. Pembobotan lama M1–M5 dipertahankan. M6 diganti `CONFLUENSE` dengan rumus tambah langsung, dipakai untuk prioritas **entry consideration** setelah syarat sinyal, integritas, dan risiko.

**Dokumen inti:** `PRD_FINAL_ENAM_METODOLOGI_M1_M6_CONFLUENSE_2026-10-10.md`.  
**Data dan metode uji:** `verify_final_prd.py`, `VALIDASI_PRD_FINAL_M1_M6.json`, folder `evidence/`.
