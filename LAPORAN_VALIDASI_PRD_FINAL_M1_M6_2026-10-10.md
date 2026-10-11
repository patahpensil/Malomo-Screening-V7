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
