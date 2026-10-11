# Malomo Screening V7

Spesifikasi riset **enam metodologi trading berbobot (M1–M5) dan M6 CONFLUENSE** untuk enam pair Binance USDⓈ-M Futures (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `DOGEUSDT`, `XRPUSDT`), candle 4H, waktu UTC.

> **Riset saja.** Repo ini berisi spesifikasi, bukti, dan alat verifikasi. Tidak ada kode order, koneksi exchange, atau deploy. Skor M6 adalah **indeks desain (0–500), bukan probabilitas menang**, dan belum ada backtest komposit M1–M5 yang membuktikan edge ekonomi.

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

## Catatan bukti

- `evidence/CANONICAL_SCORES_410_EVENTS_2024.csv` adalah reproduksi historis **full-train in-sample**. Jangan dipakai untuk mengevaluasi keputusan atau ranking.
- Skor kausal resmi untuk evaluasi historis ada di `evidence/ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv`, kolom `m2_quality80_causal_for_decision` (sel kosong = `null`, bukan 0).
- Snapshot M5 = 55 dan statistik M4 (285/125) berasal dari populasi Breakout 2024 tanpa gate arah (`BREAKOUT_2024_NO_DIRECTION_GATE`).

Detail lengkap ada di PRD §12.1.
