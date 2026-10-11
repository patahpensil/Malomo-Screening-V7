# Malomo Screening V7

Spesifikasi riset **enam metodologi trading berbobot (M1–M5) dan M6 CONFLUENSE** untuk enam pair inti Binance USDⓈ-M Futures (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `DOGEUSDT`, `XRPUSDT`; basket M3), candle 4H, waktu UTC. Sejak v1.0.12 aplikasi live menghitung 100 pair volume harian tertinggi (PRD §17) dengan rumus yang sama.

> **Riset saja.** Repo ini berisi spesifikasi, bukti, engine, dan alat verifikasi. **Tidak ada kode order** dan tidak ada API key; koneksi ke Binance (tahap 2) hanya membaca data pasar publik. Skor M6 adalah **indeks desain (0–500), bukan probabilitas menang**, dan belum ada backtest komposit M1–M5 yang membuktikan edge ekonomi.

**Sumber kebenaran tunggal adalah PRD.** Semua logika (skor, generator, kalibrasi, status, risiko, portofolio, keputusan) mengikuti PRD v1.0.8. Dari aplikasi `ict-screening` hanya diambil **pola live** dan **sebagian UI kartu Decision** — lihat [Hubungan dengan ICT Screening](#hubungan-dengan-ict-screening).

## Isi

| Berkas | Fungsi |
|---|---|
| `PRD_FINAL_ENAM_METODOLOGI_M1_M6_CONFLUENSE_2026-10-10.md` | **Spesifikasi normatif tunggal** (v1.0.14-FINAL-DESIGN): rumus M1–M6, status tiga lapis, kontrak JSON, acceptance test, riwayat revisi |
| `LAPORAN_VALIDASI_PRD_FINAL_M1_M6_2026-10-10.md` | Batas bukti dan ringkasan verifikasi tiap revisi |
| `verify_final_prd.py` | Verifier offline (Python 3 standar, tanpa dependensi) |
| `VALIDASI_PRD_FINAL_M1_M6.json` | Hasil verifier terakhir |
| `MANIFEST_SHA256.json` | Hash SHA-256 semua berkas paket |
| `evidence/` | Data bukti 2024: skor kanonis 410 event Breakout (in-sample), skor kausal ECDF prior-only 772 event, array kalibrasi beku, kontrak generator v2 |
| `docs/uiux/REFERENSI_UIUX_SCREENING_MALOMO_V1.md` | Referensi UI/UX untuk menampilkan output PRD |
| `engine/` | Engine JavaScript M1–M6 (lihat bagian Engine) |
| `app/` | Aplikasi web/PWA enam layar (lihat bagian Aplikasi) |
| `scripts/` | Tes, uji browser, penyusun situs |

## Ringkasan model

| Metode | Komponen | Skala |
|---|---|---:|
| M1 Struktur & Regime | Struktur 45 + Trend Efficiency 25 + ADX 10 + NATR Typicality 20 | 0–100 |
| M2 Signal Generation | Kualitas sinyal 80 (generation 30 + momentum 25 + participation 25) + Integritas audit 20 | 0–100 |
| M3 Quantitative Dependence | Korelasi silang 60 + Joint downside tail 40 | 0–100 |
| M4 Risk & Position | Risiko per trade 40 + Risiko agregat 35 + Gross notional 25 | 0–100 |
| M5 Strategy Validation | Snapshot audit beku `M5_AUDIT_2024_CLOSED_BAR_9BPS_V1` = 55 | 0–100 |
| **M6 CONFLUENSE** | **M1 + M2 + M3 + M4 + M5** | **0–500** |

M6 hanya dipakai untuk **mengurutkan** kandidat yang sudah lolos gerbang event, arah, integritas, data, dan risiko. Tidak ada ambang minimum M6.

## Verifikasi

```bash
python3 verify_final_prd.py
```

Hasil yang diharapkan: **32 PASS, 0 FAIL**. Cakupannya kontrak, aritmetika, konsistensi bahasa–kode, dan bukti 2024 (termasuk reproduksi ulang 400 skor kausal train dan 281 skor eval dari fitur mentah). Tes T04/T05/T09/T14/T15 berlabel `STATIC_CONTRACT_CHECK` dan **bukan** validasi engine. Lulus verifier **tidak** berarti strategi menguntungkan.

## Engine (tahap 1)

Fungsi murni JavaScript (UMD: jalan di Node dan browser), kausal, tanpa DOM, jaringan, atau order. Seluruh logika engine ditulis dari PRD v1.0.8; tidak ada logika yang diambil dari `ict-screening` (fungsi ADX di sana memakai seed Wilder klasik, sedangkan PRD mewajibkan `ewm(alpha=1/14, adjust=False)`).

| Modul | Isi (PRD v1.0.8) |
|---|---|
| `engine/core.js` | Validasi candle & gap (§1), `ewm(alpha=1/14, adjust=False)` identik pandas, ATR/DI/ADX, pivot 5-bar ketat, ECDF tie kanan, kuantil linear, Pearson (§2) |
| `engine/m1.js` | Struktur BULLISH/BEARISH/TRANSITION, TE14, ADX, NATR typicality (§3) |
| `engine/generators.js` | Breakout–Retest, Pullback Continuation (setup i+2, jendela i+3..i+26), Reversal–Retest (`M1_origin`) (§4.2–§4.4) |
| `engine/m2.js` | Fitur E4/ClosePos/RVOL/Taker, kalibrasi beku & prior-only (≥30, ketat <), kualitas 80, integritas 20 berbasis log (§2, §4.5–§4.6) |
| `engine/m3m4.js` | M3 korelasi 60 + ekor 40, rencana & M4 dengan reason code, portofolio simulasi slot 24 jam, snapshot M5 (§5–§7) |
| `engine/pipeline.js` | Kanonisasi, gate arah, CLOSE_CANDIDATE → ENTRY_REVIEW, ranking tie-break, keluaran kontrak JSON §10, replay arsip (§8–§10) |

```bash
npm run test:engine      # 32 tes engine + 3 tes paritas skor M2 terhadap evidence
npm run test:prd         # verifier PRD (Python)
npm run parity:ohlcv     # paritas penuh dari candle 2024; SKIP bila data/ohlcv-2024/<PAIR>.csv belum ada
```

Yang sudah terbukti:
- `ewm`/ATR/ADX identik pandas; M3 identik numpy.
- **Paritas penuh dari candle asli Binance 2024** (arsip resmi data.binance.vision, checksum resmi; `npm run parity:ohlcv`): Breakout 410/410, Pullback 298/298, dan Reversal 64/64 event identik tanpa ekstra; M1 410/410; generation30 410/410; skor kualitas 80 kausal **772/772**.
- Paritas ini menemukan tiga perbedaan engine terhadap kode yang diuji, kini sudah diperbaiki sesuai teks PRD: (1) Breakout §4.2 "sampai event selesai tidak boleh mengganti level" → satu event aktif per sisi, dan pivot dilepas setelah event selesai; (2) Pullback §4.3 "jangan mengganti impuls di tengah setup" → satu setup aktif per sisi; (3) Reversal §4.4 syarat harga **dan** kronologi pivot `l2<l1<h1` (SHORT) / `h2<h1<l1` (LONG), satu event aktif per sisi — dikonfirmasi penyusun PRD (jawaban audit paritas 11 Okt 2026, usulan v1.0.8). Selain itu E4 Breakout memakai penyebut + 1e−12 seperti array beku (mencegah ECDF bergeser satu langkah pada kasus searah murni).

### Catatan terbuka engine (perlu keputusan PRD)

1. **Zona Pullback dilompati dalam satu candle.** Sesuai teks PRD, zona dinilai dari kedalaman `d` pada close candle (memakai `minLow`). Jika satu candle membawa `d` dari < 0.25 langsung ke 0.75–0.85, zona dianggap tidak tersentuh dan setup akhirnya `PREZONE_CENSORED`. Perlu konfirmasi apakah kode `pullback_v2` memakai rentang intrabar.
2. **Reason `PLAN_RISK_INVALID`.** Dipakai bila stop ≤ 0 atau rencana tidak finite (M4 `D=0`). Kode ini belum ada di daftar reason PRD.
3. **Kode reason rinci engine.** Selain enam kode PRD, engine mengisi `reasons[]` dengan kode rinci agar tidak kosong (mis. `DIRECTION_GATE`, `M3_HISTORY_INCOMPLETE:<pair>`, `CALIBRATION_INCOMPLETE`). Semua diberi label di UI; perlu diresmikan atau dipetakan di PRD.
4. **Candle pertama deret.** TR dan ±DM pada candle pertama dianggap tak terdefinisi (previous close belum ada). Arsip historis mungkin memakai 0 atau `high−low`; pengaruhnya meluruh < 0.01% setelah warmup.

## Aplikasi (tahap 2–3)

Aplikasi web statis (PWA) di atas engine yang sama, tanpa server, tanpa API key, tanpa order. Live di GitHub Pages: https://patahpensil.github.io/Malomo-Screening-V7/ (deploy otomatis hanya bila semua tes lulus). Aplikasi selalu memakai data Binance real-time; data sintetis hanya ada di tes skenario. API Binance Futures menolak server di AS (HTTP 451), jadi CI menguji data asli lewat arsip resmi data.binance.vision, dan uji API langsung dilewati bila server CI diblokir.

| Modul | Isi |
|---|---|
| `app/transport.js` | Pola A: antrean REST 200 ms, timeout 20 s, cooldown 429/418 + `Retry-After`, sinkron jam server, cache kline 4H sampai candle berjalan close, retry `FETCH_FAILED` 30/60/120 s (PRD §1), WebSocket ticker + watchdog 20 s + reconnect bertahap. Hanya path publik baca-saja yang diizinkan. |
| `app/live.js` | Pola A: aggTrade (CVD), depth20 (orderbook), poll Open Interest untuk posisi simulasi aktif — tampilan saja, tidak masuk skor (PRD §4.5) |
| `app/cycle.js` | `btcRegime` (PRD §16 R33): label rezim BTC informatif, bukan gate. Satu siklus 4H: kline → engine `decide` kronologis atas 1.500 candle terakhir (portofolio simulasi §6: slot 24 jam, ekuitas 100 tanpa kompaun), dua fase `CLOSE_CANDIDATE` → `ENTRY_REVIEW`, penandaan `FETCH_FAILED`/`CONFIRMED_GAP`, outcome riset stop/target/horizon 24 jam |
| `app/ui.js`, `app/labels.js`, `app/ledger.js` | PRD §18 R35 — tiga layar: Decision (hard gate, skor dikunci di ledger browser), Semua Pair (universe realtime + M1), Jurnal Sinyal (hasil SL/TP/horizon + unduh CSV); kamus label. Menggantikan referensi UI/UX enam layar. |
| `app/exec.js` | PRD §16 R32 — rencana siap salin: harga dibulatkan ke `tickSize` ke arah aman (aritmetika bilangan bulat tick), qty dari modal & risiko 0,5–1% dibulatkan ke `stepSize`, leverage maksimum aman otomatis, cek minimum notional/minQty/margin, parser `/fapi/v1/exchangeInfo` publik. Tidak mengubah record audit. |
| `app/universe.js`, `app/worker.js` | PRD §17 R34 — universe 100 pair USDT perpetual volume harian tertinggi (ranking tiap close harian 00:00 UTC = 08:00 WITA, hard gate; stablecoin/indeks dikeluarkan); engine dijalankan di Web Worker agar 100 pair tidak membekukan layar. Basket M3 tetap 6 pair inti; rumus skor tidak berubah. |
| `app/main.js` | Jadwal siklus 5 detik setelah close 4H (jam server), cek ulang 15 detik bila open berikutnya belum muncul; aturan pair `exchangeInfo` diperbarui tiap 24 jam |

```bash
npm test               # engine 35 + paritas M2 3 + aplikasi 26 + rencana siap salin/rezim BTC 16 + universe 14 + ledger 9 + verifier PRD 32
npm run test:browser   # susun _site/ lalu uji bug Chromium (desktop 1440 px + mobile 390 px, skenario terkendali)
node scripts/fetch-recent-archive.js && ARCHIVE_DIR=data/recent node scripts/test-browser-live.js   # data Binance asli
node scripts/live-check.js   # API Binance langsung (REST + WebSocket); butuh jaringan yang tidak diblokir Binance
npm run build          # _site/ saja; layani dengan server statis apa pun
```

Batas yang disengaja:
- Portofolio simulasi direplay dari candle pertama yang diunduh (±250 hari); tidak dicampur dengan akun Binance asli.
- Kalibrasi live = array beku 2024 (`FROZEN_COMPLETE_TRAIN_ECDF`), tanpa fitting ulang.
- Selama ada pair `FETCH_FAILED` untuk close terakhir, keputusan yang bergantung lintas pair (ranking/alokasi) ditahan sebagai `NO_ENTRY` + `DATA_INCOMPLETE`.
- Notifikasi Telegram (Referensi UI/UX §7) **belum dibangun**: butuh token bot yang tidak boleh disimpan di aplikasi statis; perlu keputusan terpisah.

## Tahap A — uji arsitektur (backtest komposit)

Backtest seluruh cara kerja aplikasi atas **30 pair USDⓈ-M paling likuid**, Feb 2024 – Okt 2026, data asli Binance (arsip resmi), biaya 9/18 bps + funding. Setiap lapis arsitektur dimatikan atau diganti (ablation); hasil per tahun hanya untuk uji konsistensi. Rincian dan usulan perbaikan: **PRD §14**.

| Ringkasan (9 bps) | R/trade | t |
|---|---:|---:|
| Sinyal lolos gerbang, per sinyal (7.190) | −0.004 | −0.38 |
| Sistem penuh PRD (2.234) | +0.032 | 1.56 |
| Sistem penuh, 18 bps | +0.010 | 0.49 |

Kesimpulan: belum ada edge yang signifikan; generator sinyal adalah akar masalah; ranking M6 setara acak; seluruh event Reversal bentrok; satu-satunya perbaikan gerbang yang konsisten 3/3 tahun adalah lapis rezim BTC. **Belum layak untuk uang nyata.**

```bash
node scripts/backtest/fetch-universe.js          # unduh data (butuh akses data.binance.vision); arsip juga di cabang data-bt
node scripts/backtest/run.js data/bt 30          # → results/tahap-a/summary.json, trades.csv.gz
```

### Tahap A2 — riset generator baru (PRD §15)

28 konfigurasi (Breakout/Pullback PRD dengan exit baru, Donchian, time-series momentum, kompresi volatilitas, momentum lintas-pair, funding kontrarian; masing-masing dengan/tanpa rezim BTC) diuji dengan protokol dan syarat lulus yang sama. **Tidak ada yang lulus.** Kandidat paling konsisten (Breakout PRD + rezim BTC) gagal uji ketahanan. Rekomendasi: belum untuk uang nyata; paper forward test lapis rezim BTC; aplikasi diposisikan sebagai alat bantu screening.

```bash
node scripts/backtest/a2.js data/bt 30           # → results/tahap-a2/summary.json
```

## Hubungan dengan ICT Screening

Batas adopsi dari [`patahpensil/ict-screening`](https://github.com/patahpensil/ict-screening) (disepakati 11 Okt 2026). Di luar dua hal pada tabel A dan B, semuanya mengikuti PRD.

**A. Pola live yang diadopsi** (dari `app/market.js` dan `app/live.js`)

| Pola ICT | Dipakai di Malomo untuk |
|---|---|
| Antrean request REST (jeda 200 ms, timeout 20 detik, cooldown 429/418 + `Retry-After`) | Lapisan transport. Bila tetap gagal, siklus ditandai `FETCH_FAILED` dan dicoba ulang 30/60/120 detik (PRD §1) |
| Sinkron jam server Binance (`/fapi/v1/time`) | Penentuan candle 4H sudah close (aturan closed-bar PRD) |
| Cache candle sampai candle berikutnya close | Candle 4H universe diunduh penuh sekali, lalu 10 candle terakhir per siklus |
| WebSocket ticker + watchdog 20 detik + reconnect bertahap | Harga live di kartu Decision |
| Stream per posisi: aggTrade (CVD), depth20 (orderbook), poll Open Interest | Sel data live di kartu Decision — **hanya tampilan, tidak pernah masuk skor** (PRD §4.5) |

**B. Sebagian UI kartu Decision yang diadopsi** (`.dec-card`)

- Header: tag RUNNING berdenyut, simbol, badge LONG/SHORT, baris meta (keluarga sinyal, waktu masuk, lama berjalan).
- Harga live dan R-multiple berjalan.
- Bilah progres stop → entry → target.
- Grid level: SL · ENTRY · TP (2R) · RR.
- Sel data: Open Interest · CVD · Orderbook, ditambah sel ke-4 yang diisi sesuai PRD — hitung mundur slot 24 jam dan level invalidasi.

Isi kartu berasal dari posisi simulasi `ENTRY_CONSIDER` (PRD §6), bukan dari tracker ICT.

**C. Tidak diadopsi — tetap PRD**

| Di ICT Screening | Di Malomo V7 (PRD) |
|---|---|
| Universe Top 100 dari 250 pair, scan tiap 60 detik | Top 100 volume harian, ditetapkan tiap close harian 08:00 WITA (keputusan pengguna, PRD §17); siklus per close 4H |
| Engine turtle/intraday, tombol LONG/SKIP/SHORT | M1–M6 Confluense, status tiga lapis (`event_status` / `score_status` / `status`) |
| ARMED → RUNNING saat harga menyentuh entry | Entry hipotetis di open candle berikutnya (fase `ENTRY_REVIEW`) |
| Keluar di SL atau exit 20 hari, jurnal otomatis win/loss | Slot 24 jam tetap; stop/target hanya dicatat sebagai outcome riset |
| Risiko 0,5%, maks 5 posisi per arah, stop saat drawdown 20% | Risiko 1% / terbuka 3% / gross 1× / 3 slot / 1 posisi per pair |
| Tema CSS, watchlist, kalkulator, layout ICT | Layar dan token warna sesuai `docs/uiux/REFERENSI_UIUX_SCREENING_MALOMO_V1.md` |

## Tahapan

| Tahap | Isi | Status |
|---|---|---|
| 1 | Engine M1–M6 + tes + paritas skor M2 | Selesai |
| 2 | Data live Binance (pola A) dan kartu Decision (pola B) | Selesai |
| 3 | Enam layar referensi UI/UX, PWA, GitHub Pages bergerbang tes | Selesai (uji browser 20/20) |
| — | Paritas OHLCV 2024 dari candle asli | Selesai (772/772 event + skor) |
| A | Uji arsitektur: backtest komposit 30 pair likuid 2024–2026 + usulan perbaikan (PRD §14) | Selesai — belum ada edge signifikan |
| A2 | Riset generator baru + rezim BTC, 28 konfigurasi (PRD §15) | Selesai — tidak ada yang lulus |
| v1.0.11 | Lapisan penggunaan nyata: rencana siap salin (R32) + label rezim BTC (R33), PRD §16 | Selesai (uji browser 23/23) |
| v1.0.12 | Universe 100 pair volume harian (R34, hard gate), PRD §17 | Selesai (uji browser 24/24; 75 pair asli identik) |
| v1.0.13 | Tiga layar Decision / Semua Pair / Jurnal, skor dikunci, universe realtime (R35), PRD §18 | Selesai (uji browser 17/17; ledger data asli identik) |
| v1.0.14 | Jurnal hanya sinyal Decision; tombol Simpan pengaturan (R36), PRD §18.7 | Selesai (uji browser 19/19) |

## Catatan bukti

- `evidence/CANONICAL_SCORES_410_EVENTS_2024.csv` adalah reproduksi historis **full-train in-sample**. Jangan dipakai untuk mengevaluasi keputusan atau ranking.
- Skor kausal resmi untuk evaluasi historis ada di `evidence/ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv`, kolom `m2_quality80_causal_for_decision` (sel kosong = `null`, bukan 0).
- Snapshot M5 = 55 dan statistik M4 (285/125) berasal dari populasi Breakout 2024 tanpa gate arah (`BREAKOUT_2024_NO_DIRECTION_GATE`).

Detail lengkap ada di PRD §12.1.
