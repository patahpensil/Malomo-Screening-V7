# Malomo Screening V7

Spesifikasi riset **enam metodologi trading berbobot (M1–M5) dan M6 CONFLUENSE** untuk enam pair Binance USDⓈ-M Futures (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `DOGEUSDT`, `XRPUSDT`), candle 4H, waktu UTC.

> **Riset saja.** Repo ini berisi spesifikasi, bukti, engine, dan alat verifikasi. **Tidak ada kode order** dan tidak ada API key; koneksi ke Binance (tahap 2) hanya membaca data pasar publik. Skor M6 adalah **indeks desain (0–500), bukan probabilitas menang**, dan belum ada backtest komposit M1–M5 yang membuktikan edge ekonomi.

**Sumber kebenaran tunggal adalah PRD.** Semua logika (skor, generator, kalibrasi, status, risiko, portofolio, keputusan) mengikuti PRD v1.0.7. Dari aplikasi `ict-screening` hanya diambil **pola live** dan **sebagian UI kartu Decision** — lihat [Hubungan dengan ICT Screening](#hubungan-dengan-ict-screening).

## Isi

| Berkas | Fungsi |
|---|---|
| `PRD_FINAL_ENAM_METODOLOGI_M1_M6_CONFLUENSE_2026-10-10.md` | **Spesifikasi normatif tunggal** (v1.0.7-FINAL-DESIGN): rumus M1–M6, status tiga lapis, kontrak JSON, acceptance test, riwayat revisi |
| `LAPORAN_VALIDASI_PRD_FINAL_M1_M6_2026-10-10.md` | Batas bukti dan ringkasan verifikasi tiap revisi |
| `verify_final_prd.py` | Verifier offline (Python 3 standar, tanpa dependensi) |
| `VALIDASI_PRD_FINAL_M1_M6.json` | Hasil verifier terakhir |
| `MANIFEST_SHA256.json` | Hash SHA-256 semua berkas paket |
| `evidence/` | Data bukti 2024: skor kanonis 410 event Breakout (in-sample), skor kausal ECDF prior-only 772 event, array kalibrasi beku, kontrak generator v2 |
| `docs/uiux/REFERENSI_UIUX_SCREENING_MALOMO_V1.md` | Referensi UI/UX untuk menampilkan output PRD |
| `engine/`, `scripts/` | Engine JavaScript dan tes (lihat bagian Engine) |

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

Fungsi murni JavaScript (UMD: jalan di Node dan browser), kausal, tanpa DOM, jaringan, atau order. Seluruh logika engine ditulis dari PRD v1.0.7; tidak ada logika yang diambil dari `ict-screening` (fungsi ADX di sana memakai seed Wilder klasik, sedangkan PRD mewajibkan `ewm(alpha=1/14, adjust=False)`).

| Modul | Isi (PRD v1.0.7) |
|---|---|
| `engine/core.js` | Validasi candle & gap (§1), `ewm(alpha=1/14, adjust=False)` identik pandas, ATR/DI/ADX, pivot 5-bar ketat, ECDF tie kanan, kuantil linear, Pearson (§2) |
| `engine/m1.js` | Struktur BULLISH/BEARISH/TRANSITION, TE14, ADX, NATR typicality (§3) |
| `engine/generators.js` | Breakout–Retest, Pullback Continuation (setup i+2, jendela i+3..i+26), Reversal–Retest (`M1_origin`) (§4.2–§4.4) |
| `engine/m2.js` | Fitur E4/ClosePos/RVOL/Taker, kalibrasi beku & prior-only (≥30, ketat <), kualitas 80, integritas 20 berbasis log (§2, §4.5–§4.6) |
| `engine/m3m4.js` | M3 korelasi 60 + ekor 40, rencana & M4 dengan reason code, portofolio simulasi slot 24 jam, snapshot M5 (§5–§7) |
| `engine/pipeline.js` | Kanonisasi, gate arah, CLOSE_CANDIDATE → ENTRY_REVIEW, ranking tie-break, keluaran kontrak JSON §10, replay arsip (§8–§10) |

```bash
npm test                 # 32 tes engine + 3 tes paritas skor M2 terhadap evidence
npm run test:prd         # verifier PRD (Python)
npm run parity:ohlcv     # paritas penuh dari candle 2024; SKIP bila data/ohlcv-2024/<PAIR>.csv belum ada
```

Yang sudah terbukti: `ewm`/ATR/ADX identik pandas; M3 identik numpy; skor kualitas M2 engine mereproduksi 681 skor kausal + 91 `null` dari CSV 772 event dan 410/410 skor in-sample Breakout. **Belum terbukti:** paritas generator & M1 dari candle mentah 2024 — butuh arsip kline Binance 4H 2024 untuk 6 pair di `data/ohlcv-2024/` (format kline Binance), lalu jalankan `npm run parity:ohlcv`.

### Catatan terbuka engine (perlu keputusan PRD)

1. **Zona Pullback dilompati dalam satu candle.** Sesuai teks PRD, zona dinilai dari kedalaman `d` pada close candle (memakai `minLow`). Jika satu candle membawa `d` dari < 0.25 langsung ke 0.75–0.85, zona dianggap tidak tersentuh dan setup akhirnya `PREZONE_CENSORED`. Perlu konfirmasi apakah kode `pullback_v2` memakai rentang intrabar.
2. **Reason `PLAN_RISK_INVALID`.** Dipakai bila stop ≤ 0 atau rencana tidak finite (M4 `D=0`). Kode ini belum ada di daftar reason PRD.
3. **Candle pertama deret.** TR dan ±DM pada candle pertama dianggap tak terdefinisi (previous close belum ada). Arsip historis mungkin memakai 0 atau `high−low`; pengaruhnya meluruh < 0.01% setelah warmup.

## Hubungan dengan ICT Screening

Batas adopsi dari [`patahpensil/ict-screening`](https://github.com/patahpensil/ict-screening) (disepakati 11 Okt 2026). Di luar dua hal pada tabel A dan B, semuanya mengikuti PRD.

**A. Pola live yang diadopsi** (dari `app/market.js` dan `app/live.js`)

| Pola ICT | Dipakai di Malomo untuk |
|---|---|
| Antrean request REST (jeda 200 ms, timeout 20 detik, cooldown 429/418 + `Retry-After`) | Lapisan transport. Bila tetap gagal, siklus ditandai `FETCH_FAILED` dan dicoba ulang 30/60/120 detik (PRD §1) |
| Sinkron jam server Binance (`/fapi/v1/time`) | Penentuan candle 4H sudah close (aturan closed-bar PRD) |
| Cache candle sampai candle berikutnya close | Candle 4H 6 pair diunduh sekali per siklus |
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
| Universe Top 100 dari 250 pair, scan tiap 60 detik | 6 pair tetap, siklus per close 4H |
| Engine turtle/intraday, tombol LONG/SKIP/SHORT | M1–M6 Confluense, status tiga lapis (`event_status` / `score_status` / `status`) |
| ARMED → RUNNING saat harga menyentuh entry | Entry hipotetis di open candle berikutnya (fase `ENTRY_REVIEW`) |
| Keluar di SL atau exit 20 hari, jurnal otomatis win/loss | Slot 24 jam tetap; stop/target hanya dicatat sebagai outcome riset |
| Risiko 0,5%, maks 5 posisi per arah, stop saat drawdown 20% | Risiko 1% / terbuka 3% / gross 1× / 3 slot / 1 posisi per pair |
| Tema CSS, watchlist, kalkulator, layout ICT | Layar dan token warna sesuai `docs/uiux/REFERENSI_UIUX_SCREENING_MALOMO_V1.md` |

## Tahapan

| Tahap | Isi | Status |
|---|---|---|
| 1 | Engine M1–M6 + tes + paritas skor M2 | Selesai (`npm test` 35/35) |
| 2 | Data live Binance (pola A) dan layar Decision (pola B) | Berikutnya |
| 3 | Layar lain sesuai referensi UI/UX, PWA, GitHub Pages | Menyusul |

## Catatan bukti

- `evidence/CANONICAL_SCORES_410_EVENTS_2024.csv` adalah reproduksi historis **full-train in-sample**. Jangan dipakai untuk mengevaluasi keputusan atau ranking.
- Skor kausal resmi untuk evaluasi historis ada di `evidence/ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv`, kolom `m2_quality80_causal_for_decision` (sel kosong = `null`, bukan 0).
- Snapshot M5 = 55 dan statistik M4 (285/125) berasal dari populasi Breakout 2024 tanpa gate arah (`BREAKOUT_2024_NO_DIRECTION_GATE`).

Detail lengkap ada di PRD §12.1.
