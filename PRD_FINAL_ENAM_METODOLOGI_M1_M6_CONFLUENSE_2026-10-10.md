# PRD FINAL — ENAM METODOLOGI TRADING BERBOBOT & M6 CONFLUENSE

**Versi:** 1.0.17-FINAL-DESIGN (revisi konsistensi dokumen atas 1.0.0; lihat Riwayat revisi)  
**Tanggal keputusan:** 10 Oktober 2026  
**Bahasa spesifikasi:** Indonesia; nama field dan status Inggris untuk kontrak antar-agen.  
**Ruang lingkup:** spesifikasi metodologi penelitian dan protokol keluaran agen; **bukan permintaan membuat aplikasi, mengirim order, commit, push, atau deploy**.  
**Status:** **FINAL untuk keputusan desain deterministik dan bobot penelitian**; bukan pernyataan bahwa skor mengandung *edge* ekonomi atau peluang berhasil.  
**Keputusan pengguna terbaru yang memiliki prioritas:** **M6 diganti menjadi `CONFLUENSE` = penjumlahan numerik skor M1+M2+M3+M4+M5** untuk mengurutkan kandidat pertimbangan entry. **Persyaratan penelitian untouched independent OOS 2025–2026 dihapus dari daftar tugas**, tanpa mengubah fakta tentang keterbatasan bukti historis.

> **Kontrak kejujuran empiris:** bobot M1–M5 dipertahankan dari pilihan baseline penelitian setelah uji 2024, **bukan hasil estimasi bobot optimum teruji secara konfirmatori**. Penjumlahan M6 adalah **keputusan desain baru pengguna, belum backtest gabungan penuh**. Karena M1/M2 dapat berbagi informasi harga, M3 menilai risiko bersama, M4 kepatuhan, dan M5 kualitas penelitian, 500 poin **bukan probabilitas kemenangan, bukan lima bukti alpha yang independen, dan bukan jaminan entry profitable**. Agen dilarang menyatakan sebaliknya.

### Riwayat revisi

| Versi | Tanggal | Perubahan | Sifat |
|---|---|---|---|
| 1.0.0 | 10 Okt 2026 | Rilis final desain | — |
| 1.0.1 | 10 Okt 2026 | (R1) Status dipisah menjadi tiga lapis `event_status` / `score_status` / `status` keputusan + `reasons[]`, ditambah `WAITING_ZONE`; `SCORE_INCOMPLETE`, `NO_SCORE`, `INCOMPLETE` diresmikan sebagai kode `score_status` (§9). (R2) Kontrak JSON dilengkapi `event_status`, `score_status`, `reasons[]`, `gross_pct`, `invalidation`, `max_holding_hours`, serta contoh kandidat ditolak (§10). (R3) Rekonsiliasi angka sampel Breakout train 258 vs 257 (§12.1). | Konsistensi dokumen; **tidak mengubah bobot, rumus M1–M6, parameter, atau hasil historis** |
| 1.0.2 | 10 Okt 2026 | (R4) `ATR_entry=ATR14[tc]` candle konfirmasi/trigger; `ATR_frozen=ATR14[t0−1]` hanya untuk buffer/zona; catatan seed ATR arsip `ewm` vs Wilder (§2, §6). (R5) `decision_available_utc` = close candle konfirmasi; field `break_utc`, `confirmation_utc` (§2, §10). (R6) Setup Pullback lahir pada close `i+2`; pengamatan mulai `i+3`; daftar invalidasi tertutup (§4.3). (R7) Reversal memakai snapshot `M1_origin` (pivot terkonfirmasi s.d. close `t0−1`); field `m1_origin_direction` (§4.4, §8.1.2, §10). | Penegasan definisi sesuai kode generator/simulasi historis 2024 (dikonfirmasi penyusun PRD); **tidak mengubah bobot, rumus M1–M6, parameter, atau populasi event historis** |
| 1.0.3 | 10 Okt 2026 | (R8) Metode ATR/DI/ADX normatif diganti menjadi metode yang diuji: `ewm(alpha=1/14, adjust=False)` — membalik catatan v1.0.2 yang mempertahankan seed Wilder klasik (§2). (R9) Jendela pra-zona Pullback dikonfirmasi `i+3`..`i+26` inklusif, ekstrem diperbarui untuk `t>created_t`, sentuhan zona diperiksa sebelum batas jendela (§4.3). | Menyelaraskan PRD dengan kode yang diuji (410/410 M1 cocok; 27/27 `PREZONE_CENSORED` pada offset +24); **tidak mengubah bobot, rumus skor, atau populasi event historis** |
| 1.0.4 | 10 Okt 2026 | (R10) `conflict4` menjadi bukti proses berbasis log audit; log hilang → `AUDIT_INCOMPLETE`/`REJECTED_INTEGRITY` (§4.6). (R11) CSV kanonis dilabeli full-train in-sample; evaluasi keputusan historis wajib ECDF prior-only; tabel cakupan 228/158/14 (§12.1). (R12) Cakupan snapshot M5=55 dan statistik M4 dilabeli `BREAKOUT_2024_NO_DIRECTION_GATE` (§7, §12.1). | Ketepatan kontrak audit dan pelabelan bukti; **tidak mengubah bobot, rumus skor, atau angka historis** |
| 1.0.5 | 10 Okt 2026 | (R13) Pengambilan data: `FETCH_FAILED`/`CONFIRMED_GAP` sebagai reason, retry eksplisit, tanpa interpolasi (§1). (R14) Portofolio simulasi: `ENTRY_CONSIDER` dibukukan, `equity_sim=100` tanpa kompaun, slot terisi 24 jam tetap, stop/target tidak membebaskan slot — mengoreksi teks lama "atau sampai penutupan lebih awal" (§6). (R15) Tiga slot = kapasitas maksimum; reason `GROSS_CAP`/`PAIR_ACTIVE`/`POSITION_OR_RISK_CAP`; rincian 68/42/15 (§6, §12.1). (R16) T04/T05/T09/T14/T15 = `STATIC_CONTRACT_CHECK`; daftar tes engine I01–I06 (§11). (R17) Field tampilan `m1_plus_m2q_0_180_display_only` (§10). | Menyelaraskan PRD dengan `revalidate.py`/arsip 2024; **tidak mengubah bobot, rumus skor, atau angka historis** |
| 1.0.6 | 10 Okt 2026 | (R18) CSV skor kausal 772 event ditambahkan ke `evidence/`, kolom resmi ditetapkan, catatan "belum disertakan" ditutup; angka 257 terverifikasi; catatan audit selisih diagnostik Reversal dan identitas bentrok (§12.1). | Melengkapi bukti; **tidak mengubah bobot, rumus skor, atau angka historis** |
| 1.0.7 | 10 Okt 2026 | Audit menyeluruh: (R19) §0 butir 5 memakai kode resmi §9 (menghapus dua kode lama yang tidak terdaftar di §9). (R20) Definisi warmup indikator ewm (§1). (R21) `ENTRY_REVIEW` ditegaskan sebagai nama fase. (R22) Field JSON `atr_entry_frozen` diganti `atr_entry` + `atr_frozen`; contoh ditolak dilengkapi `equity_sim`/ATR (§10). (R23) Tabel pemetaan label CSV audit → kontrak PRD (§12.1). (R24) Label Spearman §12.1: mengukur `signal_generation_30`, bukan kualitas 80; train −0.054 berasal dari sampel 257. Rumus diverifikasi ulang 410/410 terhadap CSV kanonis (struktur, TE+ADX, grid vol20, generation Breakout, momentum, participation, grid ECDF k/258). | Konsistensi bahasa–kode; **tidak mengubah bobot, rumus skor, atau angka historis** |
| 1.0.8 | 11 Okt 2026 | Paritas engine terhadap candle asli Binance 2024 dan jawaban audit generator arsip: (R25) Breakout — satu event aktif per (pair,side), event lama diselesaikan dulu lalu fresh cross dievaluasi pada candle sama, pivot boleh dipakai ulang setelah event selesai (§4.2). (R26) Pullback — satu setup aktif per (symbol,side), impuls baru tidak membuka setup kedua (§4.3). (R27) Reversal — syarat harga **dan** kronologi indeks pivot `l2<l1<h1` / `h2<h1<l1`, protected = `l1`/`h1` terbaru, satu event aktif per sisi, protected pivot tidak dipakai ulang (§4.4). (R28) Epsilon penyebut E4 mengikuti versi generator: Breakout v1 `+1e−12`, Pullback/Reversal v2 tanpa epsilon (§4.5). (R29) Tes engine I07–I09: regresi 11 Reversal terlarang, pakai ulang pivot Breakout, paritas 772/772 (§11). | Menyelaraskan PRD dengan generator arsip yang diuji; **tidak mengubah bobot, rumus skor, parameter, atau populasi event historis** |
| 1.0.9 | 11 Okt 2026 | (R30) §14 baru: hasil Tahap A — uji arsitektur sistem (backtest komposit, ablation per lapis) atas 30 pair USDⓈ-M paling likuid, Feb 2024–Okt 2026, data asli Binance; temuan per lapis, usulan perbaikan (benahi/tambah/kurangi), dan kriteria lanjut ke Tahap B. | **Temuan dan usulan**, belum mengubah aturan normatif §1–§13; perubahan aturan hanya lewat revisi terpisah setelah disetujui pengguna |
| 1.0.10 | 11 Okt 2026 | (R31) §15 baru: hasil Tahap A2 — riset generator sinyal baru dan lapis rezim BTC (28 konfigurasi dikunci sebelum hasil dilihat), uji ketahanan kandidat terbaik, kesimpulan, dan rekomendasi arah berikutnya. | **Temuan dan usulan**, belum mengubah aturan normatif §1–§13 |
| 1.0.11 | 11 Okt 2026 | §16 baru, disetujui pengguna untuk penggunaan uang nyata: (R32) rencana eksekusi siap salin — harga dibulatkan ke `tickSize` Binance ke arah aman, qty dari modal & risiko pengguna (0,5–1%) dibulatkan ke `stepSize`, leverage maksimum aman dihitung otomatis, aturan pair dari `/fapi/v1/exchangeInfo` publik. (R33) label rezim BTC informatif (bukan gate) + filter tampilan. Kalimat kuantisasi §6 diberi rujukan ke §16. Tanpa kill switch (keputusan pengguna). | **Lapisan tampilan**; tidak mengubah bobot, rumus skor, generator, keputusan, record audit, atau portofolio simulasi §6 |
| 1.0.12 | 11 Okt 2026 | §17 baru, keputusan pengguna: (R34) universe aplikasi live = **100 pair USDT perpetual dengan volume harian tertinggi**, ranking ditetapkan setiap close candle harian 00:00 UTC (08:00 WITA), berlaku sebagai **hard gate** sampai close harian berikutnya; basket M3 tetap enam pair §1; tidak ada perubahan bobot atau rumus skor. Penyesuaian R32: alt di luar 30 besar memakai asumsi MMR 2,5% dan batas leverage 20×. | **Cakupan pair aplikasi**; rumus dan bobot M1–M6, generator, gate keputusan, kontrak §10, dan portofolio §6 tidak berubah |
| 1.0.13 | 12 Okt 2026 | §18 baru, keputusan pengguna (Tahap 1): (R35) aplikasi menjadi tiga layar — **Decision** (hard gate = status layak dipertimbangkan, skor dikunci saat masuk), **Semua Pair** (universe realtime + M1 per pair), **Jurnal Sinyal** (hasil SL/TP/horizon + unduh CSV); universe 100 pair kini **realtime** dari volume 24 jam berjalan (stream publik), gate keputusan memakai snapshot universe pada close 4H; layar riset lama, inspektor, dan unduh log audit dihapus. Perbaikan: pair penentu yang gagal diunduh sejak percobaan pertama kini tetap menahan keputusan (§1). | **Lapisan tampilan & cakupan data**; rumus dan bobot M1–M6, generator, gate keputusan, kontrak §10, dan portofolio §6 tidak berubah. Referensi UI/UX enam layar digantikan §18 |
| 1.0.14 | 12 Okt 2026 | Koreksi pengguna atas §18: (R36) Jurnal hanya mencatat sinyal yang **benar-benar masuk Decision** pada close berjalan saat aplikasi aktif — sinyal masa lalu dari replay tidak dicatat dan entri replay versi 1.0.13 dibuang saat dimuat; pengaturan modal/risiko/biaya hanya berlaku setelah tombol **Simpan** ditekan, dengan status tersimpan/belum disimpan yang selalu terlihat. | Lapisan tampilan; rumus dan bobot tidak berubah |
| 1.0.15 | 12 Okt 2026 | §19 baru, keputusan pengguna untuk penggunaan uang nyata: (R37) **mandat risiko LIVE** aplikasi — maksimal **10 posisi** bersamaan, risiko **1% per trade**, risiko terbuka ≤ **10%**, **batas notional (gross) dihapus**, exit **TP1 = 2R (tutup 50%) + TP2 = 3R (sisa 50%)**, SL tetap di tempat setelah TP1, horizon 24 jam tetap; panel risiko portofolio (peringatan saja); rencana siap salin menampilkan TP1/TP2 dengan qty dibagi; perbaikan hasil jurnal (data yang belum terunduh tidak lagi menjadi "data tidak ada"). Mandat riset §6 tetap dipakai untuk reproduksi riset. Hasil uji data asli 2024–2026 dicatat apa adanya (§19.2), termasuk bahwa 10 posisi lebih buruk daripada 3 posisi dalam backtest. | **Bobot, rumus skor M1–M6, rumus M4, gate, dan ranking TIDAK berubah** (diuji: skor identik di kedua mandat) |
| 1.0.16 | 12 Okt 2026 | §20 baru, keputusan pengguna: (R38) **posisi nyata pengguna** — tombol **Saya ambil** di kartu Decision (harga entry & qty yang benar-benar terisi; batal ambil), **posisi manual** di luar sinyal Malomo (tanpa skor; hasil otomatis dari candle 4H atau ditutup sendiri), panel risiko kini dihitung dari posisi nyata (diambil + manual) dengan baris pembanding semua sinyal, jurnal mendapat filter/kolom Diambil dan tabel posisi manual terpisah + CSV. | Catatan pengguna; **bobot, rumus skor, gate, ranking, harga & hasil sinyal TIDAK berubah** |
| 1.0.17 | 12 Okt 2026 | §21 baru, keputusan pengguna: (R39) **Detail Pair** — klik nama pair di mana pun (Decision, Semua Pair, Jurnal, posisi manual) membuka panel berisi harga & pasar 24 jam, grafik 4H dengan **EMA 21/30/50**, funding/mark/index, Open Interest historis, **rasio long/short** (semua akun, top trader akun & posisi, taker beli/jual), orderbook & CVD live, data Malomo, dan aturan pair. Endpoint publik baru: `premiumIndex` dan lima statistik `/futures/data`. | **Informasi saja — bukan gate, tidak masuk skor**; bobot, rumus, gate, ranking tidak berubah |

## 0. Hirarki kewenangan dan larangan interpretasi

1. Dokumen ini mengikat **untuk protokol penelitian enam pair Binance USDⓈ-M Futures, candle 4H, waktu UTC**. Jika dokumen checkpoint lama berisi `UNVALIDATED M6`, larangan menjumlah lintasmetode, parameter berstatus kandidat, atau tugas data independen, **keputusan di versi final ini mengesampingkan khusus hal-hal tersebut**; seluruh hasil pengujian terdahulu tetap catatan historis dan tidak boleh diubah.
2. Nilai bobot ditetapkan **persis** seperti Tabel 1. Tidak ada penyesuaian otomatis, pembobotan ulang, normalisasi lintasmetode, confidence premium, probabilitas, dan tidak ada penalti indikator lain.
3. Angka parameter eksekusi yang sebelumnya berstatus baseline/kandidat (misalnya `b=0.05 ATR`, `r=0.10 ATR`, `W=6`) **dipilih final sebagai kebijakan desain v1.0 untuk reproduksi**, bukan diklaim optimum pasar. Pemilihan ini eksplisit agar agen tidak bertanya lagi.
4. Semua operasi memakai **data teramati sampai titik keputusan**. Label penilaian peristiwa tidak boleh bergeser sesudah peristiwa, CDF tidak boleh dilatih dari masa depan terhadap peristiwa yang dinilai, dan tidak boleh membaca candle yang belum tutup.
5. Nilai `0` adalah skor terukur yang sah. Kode non-skor — `score_status` selain `SCORED` (mis. `INCOMPLETE`, `DATA_INCOMPLETE`, `CALIBRATION_INCOMPLETE`), `event_status` selain `CONFIRMED` (mis. `UNSUPPORTED_FOR_SCORING`, `INVALID`, `EXPIRED`, `CONFLICTING_DIRECTIONS`), serta `status` keputusan selain `ENTRY_CONSIDER` — **bukan 0** (daftar resmi §9). Skor M6 numerik hanya ada jika kelima skor valid dan event layak diranking.
6. **Satu peristiwa hanya boleh mempunyai satu tipe Signal Generation yang dinilai**. Jika beberapa keluarga label bersaing pada key yang sama, jangan menambah skor, mengambil maksimum diam-diam, atau memvote arah. Tandai `MULTI_METHOD_COLLISION` dan hentikan ranking event tersebut.
7. Agen bertugas **menghitung, mengaudit, mengurutkan, dan melaporkan** kandidat. `ENTRY_CONSIDER` berarti usulan penelitian, **bukan eksekusi transaksi**.

## 1. Target, cakupan data, dan output

**Tujuan:** memperoleh lima skor independen secara administratif (bukan diasumsikan independen secara statistik) untuk sebuah kandidat sinyal yang valid, lalu membentuk satu skor aritmetis `M6_CONFLUENSE_0_500`, mengurutkan kandidat dengan aturan deterministik, dan mengeluarkan rencana entry hipotetis serta alasan penolakan jika ada.

**Universe v1:** `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `DOGEUSDT`, `XRPUSDT`. Venue penelitian `Binance USD-M Futures`. `timeframe=4h` untuk semua OHLCV dan indikator. `timezone=UTC`; contoh jadwal tutup candle 00:00/04:00/08:00/12:00/16:00/20:00 UTC. Tidak ada mixed spot/futures feed. Perlu 180 candle return masa lampau untuk M3, 120 NATR untuk M1, 20 candle untuk RVOL20; tidak boleh mengisi gap dengan interpolasi. **Warmup indikator (v1.0.7):** metode `ewm(alpha=1/14, adjust=False)` (§2) tidak memiliki panjang seed tetap; deret ATR/DI/ADX dihitung sejak candle pertama arsip (replay 2024: mulai 2024-01-01T00:00Z, 2.010 candle per pair, event pertama 2024-03-21), dan skor pertama hanya sah bila seluruh jendela M1/M3/RVOL di atas terpenuhi (minimal 181 close berurutan).

**Universe aplikasi live (v1.0.12, §17):** kandidat sinyal pada aplikasi live diambil dari 100 pair USDT perpetual dengan volume harian tertinggi (ranking tiap close harian 00:00 UTC, hard gate). Keenam pair di atas tetap menjadi basket M3 (§5) dan tetap selalu diunduh; rumus skor setiap pair identik.

**Kolom candle:** `symbol`, `open_time_utc`, `open`, `high`, `low`, `close`, `base_volume`, `close_time_utc`, `quote_volume`, `trade_count`, `taker_buy_base_volume`. Validasi `O,H,L,C>0`, `H>=max(O,C,L)`, `L<=min(O,C,H)`, `volume>=0`, `0<=taker_buy<=volume`, tidak ada duplicate open time, interval waktu tepat 4 jam, timestamp close dapat disusun UTC dari open+4h; nilai tak valid → `DATA_INCOMPLETE` untuk skor yang memakainya.

**Pengambilan data dan gap (v1.0.5).** Bedakan tiga kondisi; dua yang pertama dicatat sebagai `reason_code` di `reasons[]`, bukan status baru:

| Kondisi | Arti | Perlakuan |
|---|---|---|
| `FETCH_FAILED` (reason) | Permintaan data ke sumber gagal (timeout, rate limit, server tidak tersedia) | Coba ulang dengan jeda dan batas percobaan eksplisit (nilai operasional default v1: 3 percobaan, jeda 30/60/120 detik; bukan parameter riset). Selama belum berhasil, siklus berstatus `score_status=DATA_INCOMPLETE` sementara dan **tidak** dicatat sebagai gap permanen |
| `DATA_INCOMPLETE` (score_status) | Data wajib belum tersedia atau gagal validasi | Jangan memaksakan skor; tidak diisi 0 |
| `CONFIRMED_GAP` (reason) | Interval tetap tidak tersedia setelah pemeriksaan sumber **berhasil** | **Tanpa interpolasi.** Jendela yang melintasi gap tidak sah: M3 baru valid kembali setelah tersedia 180 return 4H lengkap dan sinkron sesudah gap; M1 setelah 120 observasi NATR valid ditambah warmup indikatornya; RVOL setelah 20 volume valid |

Candle bervolume 0 adalah candle sah; hanya fitur yang mensyaratkan `volume>0` pada candle tersebut yang `INCOMPLETE`. Verifikasi arsip 2024 (Januari–November): 2.010 candle per pair × 6 pair = 12.060 candle, **0 gap, 0 duplikat, 0 volume nol** — konsisten dengan larangan interpolasi, tetapi mekanisme retry dan pemulihan gap **belum diuji** oleh dataset tanpa gap tersebut.

**Kaidah waktu:** candle indeks `t` adalah interval `[open_time_t, open_time_t+4h)`; `decision_available_utc=open_time_t+4h` **setelah** penutupan; tidak boleh menggunakan high/low atau volume candle `t+1` untuk skor `t`. Harga entry aktual hipotetis `open(t+1)` baru tersedia ketika candle berikutnya dibuka. Rencana memiliki dua fase (`ENTRY_REVIEW` adalah **nama fase**, bukan kode status): (a) `CLOSE_CANDIDATE` setelah close `t`, memakai `close(t)` sebagai harga rencana sementara; (b) `ENTRY_REVIEW` ketika `open(t+1)` diketahui dan syarat risiko dihitung ulang dengan harga tersebut. Tidak ada order pasar nyata.

### Tabel 1 — bobot terkunci

| Metode | Komponen utama | Skala keluaran |
|---|---|---:|
| **M1 Struktur & Regime** | Struktur 45 + Trend Efficiency 25 + ADX 10 + NATR Typicality 20 | **0–100** |
| **M2 Signal Generation & Confirmation** | Sinyal 30 + Momentum 25 + Participation 25 + Integritas Audit **20** | **0–100** |
| **M3 Quantitative Dependence** | Cross-Pair Correlation Concentration 60 + Joint Downside Tail 40 | **0–100** |
| **M4 Risk & Position Management** | Planned Risk/Sizing 40 + Aggregate Risk 35 + Gross Notional 25 | **0–100** |
| **M5 Strategy Testing & Validation** | Causality 30 + Chronological Split 25 + Cost Resilience 25 + Temporal Robustness 20 | **0–100** |
| **M6 CONFLUENSE** | **M1 + M2 + M3 + M4 + M5**, tanpa bobot tambahan | **0–500** |

**Perubahan eksplisit M2 untuk memenuhi M6:** `M2_signal_quality_0_80` dan `M2_integrity_0_20` **tetap disajikan terpisah**, tetapi untuk keperluan **penjumlahan mekanis** ditetapkan `M2_score_0_100 = quality80 + integrity20`. Ini adalah *indeks administratif campuran*, bukan peningkatan informasi prediktif. Nilai audit 20 **tidak pernah dipindah** ke subskor kualitas 80 dan tidak dipakai mengalikan ukuran posisi.

## 2. Utilitas deterministik bersama

`clip(x,a,b)=min(max(x,a),b)`. Semua skor dihitung dengan float64 tanpa pembulatan antar-tahap; presentasi `round_half_up(2 desimal)` hanya sesudah skor total dihitung. Nilai NaN/inf dan pembagian dengan nol → `INCOMPLETE`, tidak diperbaiki dengan 0.

**Pivot 5-bar:** pivot high di `i` sah jika `high[i]` **lebih besar secara ketat** daripada high `i−2,i−1,i+1,i+2`; pivot low analog **lebih kecil secara ketat**. Nilai yang sama tidak boleh membentuk dua pivot. Pivot `i` baru terlihat setelah candle `i+2` tutup; keputusan `t` boleh menggunakan pivot dengan `i+2<=t`. Untuk generator Reversal v2 yang sudah diuji, pivot yang dicatat pada close `t` baru dapat menjadi protected pivot untuk event pada `t+1` (konvensi konservatif). Swing untuk M1 dan event tetap dipilih dengan urutan `(confirmation_utc,pivot_index)` deterministik.

**Trend label M1:** dua high dan dua low terakhir yang telah confirmed: `BULLISH` jika high terbaru > high terdahulu DAN low terbaru > low terdahulu; `BEARISH` jika keduanya lebih rendah; selain itu `TRANSITION`. Jika jumlah swing tidak cukup → `INCOMPLETE`. BOS/CHoCH disimpan sebagai label event hanya berdasar *close* melewati level yang diketahui sebelumnya, tanpa bonus angka lain.

**ATR14 Wilder:** `TR_t=max(H_t−L_t,abs(H_t−C_(t−1)),abs(L_t−C_(t−1)))`, **metode normatif (v1.0.3) = metode yang diuji pada arsip 2024**: `ATR = TR.ewm(alpha=1/14, adjust=False).mean()`; `+DI = 100*(+DM).ewm(alpha=1/14, adjust=False).mean()/ATR`, `−DI` analog dengan `−DM`; `DX = 100*abs(+DI−(−DI))/(+DI+(−DI))` dengan penyebut 0 → NaN (bukan 0); `ADX14 = DX.ewm(alpha=1/14, adjust=False).mean()`. Rekursinya identik dengan smoothing Wilder (`X_t=(13 X_(t−1)+x_t)/14`); bedanya hanya seed (nilai pertama, bukan rata-rata 14 nilai pertama). **Dilarang** memakai EMA `span=14` (alpha=2/15), `adjust=True`, atau default library lain yang berbeda. **Dua ATR yang berbeda fungsi (v1.0.2):** `ATR_frozen=ATR14[t0−1]` (candle sebelum break/CHoCH) **hanya** untuk buffer `b`, toleransi `r`, dan presisi retest/zona; `ATR_entry=ATR14[tc]` pada **candle konfirmasi/trigger `tc`** yang telah close — candle terakhir sebelum entry `open(tc+1)` — **hanya** untuk stop, target, dan sizing M4. Untuk Pullback, `tc` = candle trigger micro-break. Kedua nilai diabadikan saat dihitung dan tidak dihitung ulang. Cek `ATR>0` sebelum skor/event bergantung ATR.

**Catatan seed (v1.0.3):** arsip historis 2024 (`audit_remaining.py`) menghitung ATR, +DM/−DM, dan ADX dengan `ewm(alpha=1/14, adjust=False)`; dikonfirmasi 410/410 nilai M1 cocok. Karena itu metode tersebut ditetapkan normatif agar implementasi baru mereproduksi angka yang diuji. Seed Wilder klasik (rata-rata 14 nilai pertama) **tidak** dipakai; selisih keduanya meluruh dengan faktor `(13/14)^n` (≈0.005% setelah 134 candle, ≈0.0002% setelah 180 candle) sehingga bukan alasan mengubah keputusan, tetapi metode yang diuji tetap yang mengikat.

**Pemetaan arah:** `side=+1` LONG, `side=−1` SHORT. `signed_distance=side*(close−level)`. `event_key=(symbol,'4h',decision_available_utc,side)`. **`decision_available_utc` = waktu close candle konfirmasi/trigger `tc`** untuk ketiga keluarga sinyal (bukan waktu break); ranking dan deteksi `CONFLICTING_DIRECTIONS`/`MULTI_METHOD_COLLISION` memakai waktu ini. Waktu break disimpan terpisah sebagai `break_utc` (close candle break; `null` untuk Pullback) dan `confirmation_utc` (= `decision_available_utc`). Karena close candle 4H = open candle berikutnya, `entry_reference_time_utc` **bernilai sama** dengan `decision_available_utc`; jangan menambah 4 jam dua kali. Arsip yang menyimpan `open_time` candle wajib dikonversi `+4h` untuk memperoleh waktu keputusan. Semua key disimpan UTC ISO8601; ordinal pasangan alfabetis untuk tie-break; tidak boleh membuat entry dari timestamp open candle yang salah diberi label sebagai waktu keputusan.

**Kalibrasi:** `ECDF_versioned(x;V)=count(v in V : v<=x)/len(V)` dengan `V` array float64 terurut, **menggunakan kanan pada nilai sama**, `0<=ECDF<=1`. Untuk model 2024, simpan/sertakan array referensi beku dalam paket reproduksi (`frozen_cdf_normalization.json` dan `frozen_v2_normalizations.json`); tiap sinyal mempunyai **CDF jenisnya sendiri**, bukan CDF gabungan. Array referensi dikalibrasi pada Mar–Agu 2024 dan sah digunakan **secara kausal untuk peristiwa setelah akhir kalibrasi**. Peristiwa selama periode kalibrasi dinilai memakai expanding prior-only ECDF dari jenis sama dengan minimal **30 event terdahulu**, eksklusif dari timestamp yang sedang dinilai; jika `<30` → `CALIBRATION_INCOMPLETE`, bukan nilai 0. Batas 30 adalah **kebijakan kestabilan v1 yang dinyatakan eksplisit, bukan angka optimum empiris**. Peristiwa pasca-2024 tetap memakai array beku versi ini (tidak fitting ulang otomatis). Arsip CDF in-sample lama hanya untuk reproduksi sejarah dan **tidak boleh menggantikan ECDF prior-only saat mensimulasikan keputusan masa lalu**. Selalu simpan `normalization_version`, sampel, min/max/tie policy, hash file normalisasi.

## 3. M1 — Market Structure & Regime Detection

**Rumus final:** `M1 = structure45 + te25 + adx10 + vol20`; `0<=M1<=100`. Arah sebagai field `market_structure_direction`, **bukan turunan tanda skor**.

- `structure45 = 45` jika `BULLISH` atau `BEARISH`, `22.5` jika `TRANSITION`; `INCOMPLETE` jika kurang dari dua high atau dua low. BOS/CHoCH dicatat tanpa plus poin.
- `TE14=abs(C_t-C_(t−14)) / sum_(j=t−13..t) abs(C_j-C_(j−1))`; `te25=25*clip(TE14,0,1)`. Penyebut nol → `INCOMPLETE`.
- `adx10=10*clip(ADX14_t/50,0,1)`; ADX tidak memberi arah, angka 50 adalah skala skor dan **bukan hard gate**.
- `NATR_t=ATR14_t/C_t`. Dengan 120 nilai NATR valid pada **120 candle tepat sebelum t**, `p = count(NATR_(t−120..t−1)<=NATR_t)/120`, `vol20=20*clip(1-2*abs(p−0.5),0,1)`. Jika riwayat kurang → `INCOMPLETE`. Indikator ini mengukur volatilitas yang biasa/typical, bukan keuntungan atau arah.
- Ketidakpastian, wick sweep, label BOS/CHoCH: konteks saja, **penalti 0**. Jangan menghitung kondisi harga ini kembali di M1 sebagai indikator kelima.

**Contoh:** state bullish → 45; TE=0.6 →15; ADX=25 →5; percentile NATR=0.5 →20; maka `M1=85/100`. Hasil sama untuk bearish dengan kualitas ukuran setara: arah tetap field berbeda.

## 4. M2 — Signal Generation & Confirmation

**Rumus final:** `M2_signal_quality80 = generation30 + momentum25 + participation25`; `M2_integrity20 = causal10+dedup6+conflict4`; `M2_score100=M2_signal_quality80+M2_integrity20` **hanya untuk event eligible dan metadata valid**.

### 4.1 Jenis sinyal dan satu pemilik skor

Hanya tiga generator yang menerima `generation30` numerik:

| `signal_family` | Bobot internal | Status final skor |
|---|---|---|
| `BREAKOUT_RETEST` (LONG breakout, SHORT breakdown) | **Retest Confirmation 15 + Precision 10 + Timing 5** | `CONFIRMED` saja |
| `PULLBACK_CONTINUATION` | **Pullback Quality 5 + Location 10 + Trigger 5 + Timing 10** | `CONFIRMED` (micro-break close) saja |
| `REVERSAL_RETEST` | **Trigger Quality 15 + Retest Quality 15** | `CONFIRMED` saja |
| `MEAN_REVERSION` | Tidak ada | `UNSUPPORTED_FOR_SCORING` |
| `PATTERN_BASED` (candlestick/chart) | Tidak ada | `UNSUPPORTED_FOR_SCORING` |

Yang dua terakhir boleh dilaporkan sebagai label penelitian, tetapi **tidak diberi 0, tidak dipakai menyumbang poin M2, dan tidak dianggap terpilih**. Indikator overlap dinilai per `event_key` setelah seluruh keluarga dievaluasi; benturan label strategi dinyatakan `MULTI_METHOD_COLLISION` dan tidak dipaksa memilih skor maksimum.

### 4.2 Breakout/Breakdown–Retest: generator dan skor 15/10/5

**Kontrak v1 terpilih dari grid pengujian:** `b=0.05*ATR_frozen`, `r=0.10*ATR_frozen`, `W=6` candle berikutnya; pivot 5-bar terakhir sebagai `L` (resistance untuk LONG, support untuk SHORT), level harus confirmed **sebelum** candle break. Fresh cross: LONG `C_(t−1)<=L+b` dan `C_t>L+b`; SHORT `C_(t−1)>=L−b` dan `C_t<L−b`. **Event aktif (v1.0.8):** maksimal **satu event aktif per `(pair,side)`**. Urutan tiap candle `t`: (1) selesaikan event aktif lebih dahulu (invalidasi → konfirmasi → expired) dan kosongkan sisinya; (2) jika sisi itu kosong, periksa fresh close cross terhadap pivot terakhir yang sudah terkonfirmasi pada candle `t` yang **sama**. Selama event masih aktif, level tidak diganti pivot baru. Pivot **boleh dipakai ulang** setelah event-nya selesai asalkan terjadi fresh cross baru; Breakout **tidak** memiliki daftar pivot terpakai permanen. Contoh arsip: BTCUSDT SHORT level 68830 terkonfirmasi 2024-05-27 08:00 dan 12:00 UTC (dua event dari pivot sama).

Pada break close `t0` → `WAITING_RETEST`. Dalam candle `t0+1..t0+W` secara kronologis: **periksa invalidasi close lebih dahulu** (LONG `C<L−r`; SHORT `C>L+r`), lalu `TouchedZone=(high>=L-r && low<=L+r)`, catat **retest pertama** tanpa pernah menggantinya; jika setelah pernah touch ada close LONG `C>L+b` / SHORT `C<L−b` → `CONFIRMED`; pada candle jendela terakhir jika belum confirmed → `EXPIRED`. Retest tidak boleh dihitung di candle break. Retest dan close konfirmasi boleh pada candle sama. Data terakhir terpotong sebelum t0+W → `CENSORED`, bukan expired.

`C=1` khusus confirmed. `E=low` candle retest pertama untuk LONG, `E=high` pertama untuk SHORT. `P=clip(1-abs(E-L)/(0.5*ATR_frozen),0,1)`. `tau=confirmation_index-t0` integer 1..W; `F=clip(1-(tau-1)/W,0,1)`; `generation30=15*C+10*P+5*F`. Status selain confirmed **tidak memperoleh skor numerik**.

### 4.3 Pullback Continuation: generator dan skor 5/10/5/10

Generator penelitian v2 yang dibekukan: ada tren M1 bullish (LONG) atau bearish (SHORT), pivot impuls dipilih dari **pivot high terakhir untuk LONG atau pivot low terakhir untuk SHORT** dengan pivot lawan terkonfirmasi terakhir yang mendahuluinya; panjang impuls `H0-L0>0`. Satu `(symbol,side,impulse_pivot_index)` hanya menghasilkan satu setup; jangan mengganti impuls di tengah setup. **Slot setup (v1.0.8):** maksimal **satu setup aktif per `(symbol,side)`**; selama setup masih `WAITING_ZONE` atau `WAITING_CONTINUATION`, pivot impuls baru pada sisi yang sama **tidak** membuka setup kedua (dilewati, tidak diantrekan). **Kelahiran setup (v1.0.2):** setup lahir pada **close candle `i+2`**, saat pivot impuls `i` resmi terkonfirmasi (sesuai generator historis: 868/868 setup). Pivot tidak boleh dipakai retroaktif pada waktu `i`. Pengamatan zona, ekstrem retracement (`minLow`/`maxHigh` baru diperbarui untuk `t > created_t`, yaitu mulai **candle `i+3`**), dan jendela 24 candle dimulai dari candle `i+3`, sehingga jendela pra-zona = candle `i+3` s.d. `i+26` **inklusif** (dikonfirmasi pada kode `pullback_v2`; 27/27 `PREZONE_CENSORED` historis tepat pada offset +24). Pemeriksaan sentuhan zona dilakukan **sebelum** pemeriksaan batas jendela, sehingga sentuhan tepat pada candle `i+26` sah dan setup lanjut ke `WAITING_CONTINUATION`; `PREZONE_CENSORED` hanya bila sampai close `i+26` zona belum tersentuh. Retracement dihitung memakai ekstrem yang diamati sejak setup (`minLow` LONG, `maxHigh` SHORT). Kedalaman LONG `d=(H0-minLow)/(H0-L0)`, SHORT `d=(maxHigh-L0)/(H0-L0)`.

Zona pertama sentuh ketika `0.25<=d<=0.75`, simpan `z` dan `d_z`; status `INVALID` **hanya** karena salah satu dari daftar tertutup berikut: (1) kedalaman pernah melewati `0.85`, atau (2) harga melampaui asal impuls (LONG `low<L0`, SHORT `high>H0`); urutan **invalidasi lebih dahulu daripada trigger**. Candle OHLC rusak/tidak lengkap → `DATA_INCOMPLETE`, bukan `INVALID`. Candle valid yang belum menyentuh zona tetap `WAITING_ZONE`, bukan invalid. Setelah zona pertama, trigger LONG `C_t>max(H_(t−1),H_(t−2))` atau SHORT `C_t<min(L_(t−1),L_(t−2))`, pada candle tutup, paling lambat `z+12` inklusif. Tanpa touch zona selama 24 candle sejak setup dibuat → `PREZONE_CENSORED`; setelah sentuh tetapi tanpa trigger pada z+12 → `EXPIRED`; jika arsip berhenti lebih awal → `CENSORED`. Wick tidak boleh menjadi trigger. Hanya sinyal confirmed memperoleh skor.

`p`=indeks pivot impuls asal koreksi dan `z`=candle sentuh zona pertama. `Q=abs(C_p-C_z)/sum_(j=p+1..z) abs(C_j-C_(j-1))`, harus finite dan penyebut>0; `Location=clip(1-abs(d_z-0.50)/0.35,0,1)`; `Trigger=1` hanya micro-break close yang valid; `age=trigger_index-z` (integer 0..12), `Timing=clip(1-age/12,0,1)`; **`generation30=5Q+10Location+5Trigger+10Timing`**. Jika `Q` tidak terdefinisi, status `SCORE_INCOMPLETE`. Ini kelanjutan lokal, **bukan BOS struktural baru**. Volume/ADX/RVOL tidak dimasukkan ke Q/T agar tidak memberi poin kedua pada bukti yang sama.

### 4.4 Reversal–Retest: generator dan skor 15/15

Syarat kandidat (v1.0.8, sesuai generator arsip `reversal_v2`): ambil dua pivot high terakhir (`h2` terdahulu, `h1` terbaru) dan dua pivot low terakhir (`l2`, `l1`) yang **telah terkonfirmasi sampai close `t0−1`**; harga `H[x]`/`L[x]` pada indeks pivot. Kandidat **SHORT** (tren asal bullish HH-HL) hanya bila `H[h1]>H[h2]` **dan** `L[l1]>L[l2]` **dan** kronologi indeks `l2<l1<h1`; protected pivot = `l1` (HL terbaru); candle close **di bawah** `L[l1]` minus buffer. Kandidat **LONG** (tren asal bearish LH-LL) hanya bila `H[h1]<H[h2]` **dan** `L[l1]<L[l2]` **dan** `h2<h1<l1`; protected pivot = `h1` (LH terbaru); close **di atas** `H[h1]` plus buffer. Perbandingan indeks **ketat**: pivot high dan low pada candle yang sama tidak memenuhi kronologi. Generator selalu memakai pivot terakhir yang tersedia dan **tidak** mencari pivot lama alternatif. Status awal CHoCH hanyalah `CHOCH_CANDIDATE`, **bukan reversal struktural confirmed**; pivot yang terkonfirmasi pada close `t` baru dapat dipakai mulai candle `t+1`. Maksimal **satu event aktif per `(symbol,side)`**, dan satu `(symbol,side,protected_pivot_index)` hanya satu event seumur hidup (protected pivot **tidak** dipakai ulang, berbeda dari Breakout). Tidak ada batas umur pivot atau cooldown tambahan.

**Snapshot struktur asal (v1.0.2):** `M1_origin` = label struktur M1 yang dihitung **hanya dari pivot yang telah terkonfirmasi sampai close candle `t0−1`** (sebelum candle break diproses). Reversal SHORT mensyaratkan `M1_origin=BULLISH`; Reversal LONG mensyaratkan `M1_origin=BEARISH`; `M1_origin=TRANSITION` atau `INCOMPLETE` → `REJECTED_DIRECTION`. Jika label M1 yang dihitung ulang dengan pivot yang baru terkonfirmasi pada candle break berubah menjadi `TRANSITION`, kandidat **tidak** otomatis ditolak selama `M1_origin` sah. Pada data historis, snapshot ini sah 44/44 event train (pembacaan ulang termasuk pivot baru akan menolak 9/44 secara keliru). `M1_origin` dicatat di field `m1_origin_direction`.

Gunakan `ATR_frozen=ATR_(break−1)>0`, `b=0.05 ATR`, `r=0.10 ATR`, `W=6`; close invalidasi mengalahkan touch, touch baru boleh sejak candle setelah break, touch+close konfirmasi boleh pada candle sama, lalu `CONFIRMED`/`INVALID`/`EXPIRED`/`CENSORED` sesuai aturan Breakout.

`raw_T=(side*(C_break-L)-b)/ATR_frozen`, `raw_R=(side*(C_confirm-L)-b)/ATR_frozen`. `T=ECDF_reversal_trigger(raw_T)`, `R=ECDF_reversal_retest(raw_R)` dari **dua array Reversal v2 yang dipisahkan, versi dan waktu kalibrasi terverifikasi**. `generation30=15T+15R`. Tidak ada bonus CHoCH, sweep, volume, atau status. Tanpa array yang sah untuk saat keputusan → `CALIBRATION_INCOMPLETE`, bukan tebakan normalisasi.

### 4.5 Momentum 15/10 dan Participation 10/15 (identik untuk ketiga keluarga)

Hitung pada candle konfirmasi `t` untuk arah `side`, hanya candle tutup:

- `rr_j=ln(C_j/C_(j−1))`, `j=t−3..t`. `raw_E4=side*sum(rr_j)/sum(abs(rr_j))`. Jika penyebut 0 → `INCOMPLETE`.
- `raw_ClosePos=side*(2*(C_t-L_t)/(H_t-L_t)-1)`. Jika `H_t=L_t` → `INCOMPLETE`.
- `RVOL20=volume_t / mean(volume_(t−20)..volume_(t−1))`, denominator>0 dan `RVOL20>0`; `raw_RVOL=ln(RVOL20)`.
- `raw_Taker=side*(2*taker_buy_base_volume_t/volume_t-1)`, `volume_t>0`, `0<=taker_buy<=volume_t`.

Dapatkan `E4q`, `ClosePosq`, `RVOLq`, `Takerq` dengan **ECDF beku/kausal per keluarga** yang sama persis dengan fitur dan versi kalibrasi. `momentum25=15*E4q+10*ClosePosq`. `participation25=10*RVOLq+15*Takerq`. MACD, RSI, quote volume, trade count, CVD proxy, ATR candle, dan BOS **tidak menerima tambahan poin**. Jika satu fitur/calibration missing maka M2 kualitas `INCOMPLETE`, bukan prorata. **Penyebut E4 per versi generator (v1.0.8):** generator fitur **Breakout v1** (pembentuk array beku `train-2024-03-21--2024-08-31-4h-breakout-retest-v1`) memakai `raw_E4=side*sum(rr_j)/(sum(abs(rr_j))+1e-12)`, sehingga kasus searah murni bernilai sedikit di bawah 1 dan **tidak boleh** dibulatkan ke 1 agar ECDF beku identik; generator **Pullback/Reversal v2** memakai `sum(abs(rr_j))` **tanpa** epsilon. Untuk semua keluarga, `sum(abs(rr_j))=0` → `INCOMPLETE` (bukan 0).

### 4.6 Audit integritas 10/6/4 dan skor M2 resmi untuk M6

`causal10=10` jika seluruh event/swing/candle dan fitur tersedia pada waktu keputusan dan normalisasi tidak memakai masa depan, jika jelas gagal →0; `dedup6=6` jika identitas unik dan provenance semua label terpelihara, jelas gagal →0; `conflict4` adalah **bukti kepatuhan proses yang wajib dapat dibuktikan dari log audit (v1.0.4)**: canonicalization §9 untuk key `(symbol,4h,decision_available_utc)` wajib menulis catatan audit yang memuat key, kedua `side` yang diperiksa, seluruh keluarga sinyal yang dievaluasi, dan hasilnya. Perlakuan: (a) pemeriksaan dijalankan, log tersedia, tidak ada konflik → `conflict4=4`; (b) pemeriksaan dijalankan dan terdapat LONG/SHORT pada key yang sama → event `CONFLICTING_DIRECTIONS`, tidak diskor dan tidak diranking (bukan `conflict4=0`); (c) pemeriksaan tidak dijalankan atau catatan log tidak tersedia → `score_status=AUDIT_INCOMPLETE`, `status=REJECTED_INTEGRITY`, `reasons=["CONFLICT_CHECK_NOT_LOGGED"]`, M6 tidak numerik. Kode historis 2024 (`route_and_test.py`) telah menguji **deteksi** konflik berdasarkan pair dan waktu konfirmasi, tetapi belum menghitung `conflict4` per kandidat; kontrak log ini adalah kewajiban implementasi, bukan perubahan bobot. Jika audit lain tak dapat diperiksa → `AUDIT_INCOMPLETE`.

`integrity20=causal10+dedup6+conflict4`. **Skor M2 untuk kandidat yang dapat diranking mensyaratkan `integrity20=20`.** Bila <20, catat nilai audit parsial untuk penjelasan tetapi **M2_score100/M6 tidak numerik dan status `REJECTED_INTEGRITY`**. Bila semua lolos, `M2_score100=quality80+20`. Audit ini bukan momentum/prediktor tambahan, tetapi tetap dijumlahkan ke M6 atas keputusan pengguna dengan labelnya jelas.

## 5. M3 — Quantitative & Statistical Dependence

**Unit skor:** konteks bersama enam pair **pada timestamp yang sama**, bukan arah suatu pair. Tabel return `r_(i,j)=ln(C_(i,j)/C_(i,j−1))` memerlukan 60/180 return yang berurutan dan sinkron; **kedua jendela secara ketat berakhir pada candle sebelum t**, tidak memanfaatkan return kandidat pada t.

- Seluruh **15 kombinasi** dari enam pair: `corr_ij=Pearson(r_i,r_j)` pada 60 return candle sebelum t; `A=mean_15(abs(corr_ij))`; `Qc=1-clip(A,0,1)`; `correlation60=60*Qc`. Jika varians 0 / data tidak cukup → `INCOMPLETE`.
- Pada 180 return sebelum t, hitung kuantil 10% per pair dengan **interpolasi linear standar** (sorted array posisi `(n−1)*0.1`), lalu untuk setiap candle hitung berapa pair return-nya **strictly <** kuantil tersebut; `J=(jumlah candle dengan >=3 dari 6 di bawah kuantil)/180`; `Qj=1-clip(J/0.15,0,1)`; `tail40=40*Qj`.
- `M3=correlation60+tail40` jika kedua komponen valid. Higher=risiko konsentrasi historis lebih rendah, **bukan** peluang sinyal naik/turun. Seluruh kandidat di timestamp yang sama memiliki M3 identik.

## 6. M4 — Risk & Position Management

**Mandat simulasi final untuk PRD:** `equity_sim>0`, `risk_trade_max=1% equity`, `risk_open_max=3% equity`, `gross_notional_max=100% equity`, `max_concurrent_positions=3`, `one_open_position_per_pair=true`. Ini **kebijakan desain penelitian dari grid historis**, bukan rekomendasi universal atau bukti sudah aman secara eksekusi riil.

**Entry referensi** ditetapkan `O_(t+1)` hanya setelah terbuka. Harga stop/target/qty pada dokumen penelitian disimpan sebagai float64 tanpa kuantisasi tick; **bukan harga order yang dapat langsung dikirim ke exchange**. Tidak ada pembuatan order dalam lingkup PRD ini. Sejak v1.0.11, lapisan tampilan §16 (R32) boleh menurunkan **rencana siap salin** yang dikuantisasi ke tick/step Binance dari record ini untuk pengguna; record, simulasi, dan ekuitas acuan §6 tetap float64 tanpa kuantisasi. `ATR_entry=ATR14[tc]>0` dari close candle konfirmasi/trigger `tc` (bukan `ATR_frozen`; sesuai simulasi M4 historis); `stop_distance=1.5*ATR_entry`; LONG `stop=entry−stop_distance`, SHORT `stop=entry+stop_distance`, `target=entry+side*(2*stop_distance)`. Stop long harus >0; jika tidak → `REJECTED_RISK`. Angka 1.5 ATR dan 2R berasal dari baseline grid simulasi, bukan stop struktural wajib.

Ukuran posisi simulasi: `qty = min( (0.01*equity_sim)/abs(entry-stop), equity_sim/entry )`. `new_risk=qty*abs(entry-stop)`; `new_notional=qty*entry`. `D=1` jika entry/stop/qty finite positif dan new_risk <=1% equity, lainnya 0. `P=1` jika jumlah planned open risk **setelah** kandidat ditambah ≤3% ekuitas dan jumlah posisi ≤3 serta pair belum aktif; lainnya 0. `N=1` jika gross notional termasuk kandidat ≤1× ekuitas; lainnya 0. `M4=40D+35P+25N`.

Untuk kandidat **layak entry**, ketiga pemeriksaan harus bernilai 1, sehingga `M4=100`. Jika ada gagal, simpan skor audit M4 parsial dan alasan `REJECTED_RISK`, **jangan beri M6 angka untuk pemilihan entry**. **Portofolio simulasi (v1.0.5, sesuai `revalidate.py` yang menghasilkan 285/125):** (1) setiap kandidat `ENTRY_CONSIDER` yang diterima **dibukukan sebagai posisi hipotetis**; (2) ekuitas acuan dinormalisasi `equity_sim=100` unit dan **tidak dikompaun** selama replay; (3) posisi **menempati slot kapasitas selama 24 jam tetap** sejak `entry_reference_time_utc` (`slot_release_utc = entry + 24h`); (4) stop/target dipakai untuk **outcome penelitian** dan **tidak membebaskan slot lebih awal**; (5) portofolio simulasi **tidak dicampur** dengan posisi akun Binance asli. Posisi aktif diurutkan berdasarkan `entry_decision_utc`, pair alfabetis; pada timestamp penilaian baru, posisi dengan `slot_release_utc<=timestamp` lebih dulu dikeluarkan dari kapasitas. Jika pembebasan slot lebih awal berdasarkan stop/target diterapkan, hasil 285/125 **tidak lagi** berlaku sebagai bukti uji aturan tersebut.

**Kapasitas (v1.0.5):** tiga posisi adalah **kapasitas maksimum**, bukan jaminan tiga posisi selalu dapat dibuka; dengan risiko 1% dan stop 1.5 ATR, batas gross 1× umumnya lebih dulu mengikat. Setiap penolakan M4 wajib mencatat penyebab terpisah di `reasons[]`: `GROSS_CAP`, `PAIR_ACTIVE`, atau `POSITION_OR_RISK_CAP`. Untuk audit OHLC stop/target yang sama-sama tersentuh, stop dievaluasi lebih dahulu. Biaya proksi backtest round-trip dasar 9 bps, stress 18 bps, tanpa asumsi funding/order-book.

## 7. M5 — Strategy Testing & Validation

**M5 adalah skor kualitas protokol backtest yang telah dievaluasi**. Nilainya **per versi strategi/protokol dan jendela pengujian**, bukan berubah karena satu candle bullish. Data hasil audit historis yang sudah tersedia menghasilkan `M5=55/100` pada baseline 2024. Untuk menjalankan M6 v1 dengan dataset riset yang sama, gunakan **snapshot beku M5=55, versi `M5_AUDIT_2024_CLOSED_BAR_9BPS_V1`**, pada setiap kandidat; bukan 55 hasil prakiraan trading atau bukti sukses. **Cakupan snapshot (v1.0.4): `BREAKOUT_2024_NO_DIRECTION_GATE`** — dihitung hanya dari 410 event Breakout 2024 **sebelum** gate arah §8.1.2 diterapkan (174 event lolos gate, 236 = 57.6% tidak lolos). Snapshot ini dipakai sebagai **konstanta administratif** untuk ketiga keluarga sinyal dan **tidak boleh diklaim** sebagai hasil pengujian kualitas Pullback atau Reversal, maupun populasi yang lolos gate arah. Karena nilainya sama untuk semua kandidat, snapshot ini tidak memengaruhi urutan ranking.

| Indikator audit | Poin jika lulus | Kondisi lulus yang dapat dihitung |
|---|---:|---|
| `C` Causal/Closed-Bar | 30 | Semua input keputusan sebelum atau tepat close t; entry proksi paling awal open t+1, dan tidak ada fitur outcome masa depan |
| `P` Chronological Split | 25 | Urutan train/eval kronologis dan gap antar label `>=24h` (atau horizon label yang dideklarasikan bila lebih panjang) |
| `K` Cost Resilience | 25 | Mean net train **dan** eval >0 pada biaya dasar 9bps **serta** stress 18bps |
| `R` Temporal Robustness | 20 | Tanda mean net train/eval sama dan tanda mean net eval tetap setelah bulan November 2024 dikeluarkan |

`M5=30*C+25*P+25*K+20*R`, `C,P,K,R∈{0,1}`. Baseline historis memiliki `(1,1,0,0)` = **55**; 258 train dan 152 eval event: mean train −0.479%, eval +0.037% pada 9 bps, eval 18bps −0.053%, evaluasi tanpa November −0.137%. Jika dataset audit yang dibutuhkan **tidak diketahui**, jangan memberi 55 tanpa mengacu eksplisit ke snapshot tersebut; status `AUDIT_INCOMPLETE`. **Tidak ada kewajiban mengadakan data untouched OOS** berdasarkan keputusan pengguna, tetapi klaim generalisasi tetap dilarang.

## 8. M6 — CONFLUENSE (pengganti Multi-Strategy Decision Logic)

**Ejaan field resmi:** `M6_CONFLUENSE`; alias tampilan `Confluence`. **Rumus final yang diminta pengguna, tanpa koefisien tambahan:**

```text
M6_CONFLUENSE_0_500 = M1_SCORE_0_100 + M2_SCORE_0_100
                      + M3_SCORE_0_100 + M4_SCORE_0_100
                      + M5_SCORE_0_100
M6_DISPLAY_PERCENT  = (M6_CONFLUENSE_0_500 / 500) * 100
```

Persentase tampilan adalah **persentase indeks**, **bukan win rate**. Tidak boleh membobot ulang M1–M5, mengambil rata-rata berbobot tambahan, mengisi missing dengan nol, atau menjumlah skor keluarga sinyal ganda. M2 masuk sebesar **kualitas sinyal80 + integritas20**, M4 masuk sebagai **skor kepatuhan risiko**, M5 sebagai **audit kualitas penelitian**; output wajib menampilkan kelima skor serta subskor M2. Karena user menghendaki penjumlahan eksplisit, potensi tumpang-tindih lintasmetode **diterima sebagai konsekuensi indeks desain**, tetapi **tidak boleh diklaim independen**.

### 8.1 Aturan pertimbangan entry yang final dan dapat diuji

1. Pada close `t`, kumpulkan semua event tiga keluarga numerik yang telah `CONFIRMED`, beserta UTC, side, dan sumber. Tipe yang belum confirmed/unsupported/duplikat/konflik tidak layak diranking.
2. `BREAKOUT_RETEST`/`PULLBACK_CONTINUATION` harus searah `market_structure_direction` M1 (`BULLISH=LONG`, `BEARISH=SHORT`); `TRANSITION` menolak kedua tipe ini. Gate arah kedua tipe ini memakai M1 pada close candle konfirmasi `tc`. **`REVERSAL_RETEST` adalah pengecualian yang eksplisit:** arah kandidat wajib konsisten dengan break protected pivot dari struktur lama yang berlawanan, bukan otomatis ditolak karena M1 masih memegang arah lama; gate-nya memakai `M1_origin` sesuai §4.4 (`TRANSITION` → `REJECTED_DIRECTION`).
3. Harus tersedia semua M1/M2/M3, dan audit M2 penuh 20; kalau tidak → `NO_SCORE`. Score M5 wajib snapshot audit yang teridentifikasi. Tidak boleh mengisi nilai per data yang belum ada.
4. Pada open t+1, `entry` diketahui → hitung rencana stop/target dan kelayakan M4; calon yang melanggar mandat risiko tidak boleh dipilih. Untuk menghindari masalah melingkar dalam alokasi, **rank awal** menggunakan M4=100 **bersyarat** atas kepatuhan per-trade; kemudian proses kandidat secara urut dan verifikasi ulang aggregate P/N pada posisi berjalan. Yang lolos akhirnya mendapat M4=100 dan M6 numerik; yang gagal mendapat `REJECTED_RISK` tanpa skor M6 aktif.
5. Urutan prioritas apabila lebih dari satu kandidat pada titik waktu sama: `(M6 descending, M2_signal_quality80 descending, M1 descending, symbol ascending, side LONG before SHORT, signal_family alphabetical)`. Ini tie-break administratif, **bukan tambahan bobot**. `ENTRY_CONSIDER` diberikan kandidat tertinggi yang muat dalam batas portofolio; kandidat lain yang juga muat boleh diberi `ENTRY_CONSIDER` sesuai sisa slot. Maksimum tiga posisi dan satu per pair dihormati.
6. **Tidak ada ambang angka minimum M6**. Memilih cutoff 350/375/400 dari data yang tidak diuji akan melanggar prinsip pembobotan berbasis bukti. Di versi ini, entry dipertimbangkan hanya jika kondisi event, arah, audit, data, dan risiko sudah terpenuhi; **M6 menentukan urutan prioritas**, bukan menggantikan gerbang keselamatan.
7. Jika **tidak ada kandidat layak**, keluaran `NO_ENTRY`. Jika signal valid tetapi slot/pagu tidak tersedia, keluaran `REJECTED_RISK`. Jika dua arah muncul di pair-waktu sama, `CONFLICTING_DIRECTIONS`, jangan mengundi. Jika beberapa keluarga `CONFIRMED` bersamaan pada key identik, `MULTI_METHOD_COLLISION` dan tidak diranking. Jangan pernah menaikkan skor karena jumlah label.
8. Entry hipotetis hanya sejak t+1 open, tidak retroaktif pada candle konfirmasi. Exit penelitian: stop/target atau batas horizon 24 jam. Tampilkan `entry_reference_open`, `stop_price`, `target_price`, `qty`, `risk_pct`, `gross_pct`, `RR_target=2.0`, `invalidation`, `data_quality_flags`, `score_version`; angka eksekusi nyata dan slippage aktual **tidak dikarang**.

### 8.2 Contoh kalkulasi M6 yang lulus tes aritmetika

Contoh numerik **ilustrasi kontrak, bukan sinyal pasar**:

| Metode | Komponen | Skor |
|---|---|---:|
| M1 | 45 struktur + 15 TE + 5 ADX + 20 VOL | **85.00** |
| M2 kualitas | Signal 27 + Momentum 20 + Participation 18 | 65.00/80 |
| M2 integritas | Causal 10 + Dedup 6 + Conflict 4 | 20.00/20 |
| M2 **total indeks** | kualitas65 + audit20 | **85.00** |
| M3 | korelasi40 + tail30 | **70.00** |
| M4 | risk40 + budget35 + gross25 | **100.00** |
| M5 | causal30 + split25 + cost0 + robustness0 | **55.00** |
| **M6 CONFLUENSE** | **85+85+70+100+55** | **395.00 / 500** |

`M6_DISPLAY_PERCENT=79.00%`; **bukan** probabilitas menang 79%. Jika M2 audit gagal walaupun kualitas 65, **jangan** mengeluarkan `395`; status akhir `REJECTED_INTEGRITY`.

### 8.3 Sumber risiko double-counting dan penjelasan yang wajib ditulis agen

- M1 `TE14` dan M2 `raw_E4` mengukur efisiensi price path pada horizon berbeda; hubungan statistik lintasmetode tidak dibuktikan independen. Penjumlahan **sesuai mandat pengguna**, bukan bukti bertambahnya lima unit alpha.
- M1 ATR typicality, M3 dependensi basket, M4 exposure/budget, M5 cost robustness adalah **konteks risiko/audit**, bukan empat sinyal arah.
- M2 integritas dan M5 kausalitas sama-sama menilai administrasi/data audit pada level berbeda. **Angkanya memang termasuk dua kali dalam indeks desain yang diperintahkan; jangan menyebutnya konfirmasi pasar ganda**.
- Pada satu waktu untuk enam pair, M3 sama; untuk snapshot audit 2024, M5=55 sama untuk semua kandidat; untuk kandidat yang lolos M4=100 sama. Karena itu ketiganya sering **tidak mengubah ranking antarkandidat** di saat sama. Pembeda praktis biasanya M1 dan kualitas M2, tanpa menyiratkan keterpisahan statistik.

## 9. State machine, pemilihan kanonis, dan kegagalan

**Urutan setiap close:** `INGEST_CLOSED_BARS → DATA_VALIDATION → PIVOTS/ATR/ADX/ECDF → M1_STRUCTURE → ALL_M2_GENERATORS → EVENT_CANONICALIZATION → M2_QUALITY/AUDIT → M3 → M5_SNAPSHOT → CLOSE_CANDIDATE → NEXT_OPEN → M4_RISK_CHECK → M6_RANK → ENTRY_CONSIDER | REJECT | NO_ENTRY → AUDIT_LOG`.

**State dan aturan prioritas:** `INVALID` sebelum `CONFIRMED`, sebelum `EXPIRED`; `CENSORED` hanya bila data berhenti; pending tidak mendapatkan score. Validasi data yang tidak lengkap mendahului pemaksaan skor. Contradictory directions > collision > individual score. Semua siklus idempotent: hash key sama tidak boleh menggandakan setup, entry, atau catatan.

**Kode status resmi — tiga lapis terpisah (v1.0.1).** Setiap record kandidat/event membawa **tepat satu nilai per lapis**. Lapis tidak boleh dicampur; kode di luar daftar ini tidak sah.

| Lapis (field) | Menjawab pertanyaan | Kode yang diizinkan |
|---|---|---|
| `event_status` | Event sedang/berakhir di tahap apa dalam generator? | `WAITING_RETEST`, `WAITING_ZONE`, `WAITING_CONTINUATION`, `CHOCH_CANDIDATE`, `CONFIRMED`, `INVALID`, `EXPIRED`, `CENSORED`, `PREZONE_CENSORED`, `UNSUPPORTED_FOR_SCORING`, `CONFLICTING_DIRECTIONS`, `MULTI_METHOD_COLLISION` |
| `score_status` | Apakah skor dapat dihitung? | `SCORED`, `NOT_APPLICABLE`, `INCOMPLETE`, `DATA_INCOMPLETE`, `CALIBRATION_INCOMPLETE`, `SCORE_INCOMPLETE`, `AUDIT_INCOMPLETE`, `NO_SCORE` |
| `status` (keputusan) | Apa keputusan akhir untuk kandidat ini? | `CLOSE_CANDIDATE`, `ENTRY_CONSIDER`, `NO_ENTRY`, `REJECTED_DIRECTION`, `REJECTED_INTEGRITY`, `REJECTED_RISK`, `CONFLICTING_DIRECTIONS`, `MULTI_METHOD_COLLISION`, `RESEARCH_ONLY` |

Definisi kode yang ditambahkan/diresmikan pada v1.0.1:

- `WAITING_ZONE` (`event_status`): setup Pullback sudah terbentuk tetapi kedalaman koreksi belum pernah menyentuh zona `0.25<=d<=0.75`. Berakhir menjadi `WAITING_CONTINUATION` (zona tersentuh), `INVALID`, `PREZONE_CENSORED`, atau `CENSORED` sesuai §4.3.
- `INCOMPLETE` (`score_status`): kegagalan hitung generik — swing kurang, penyebut nol, NaN/inf, riwayat window kurang (§2, §3, §5).
- `SCORE_INCOMPLETE` (`score_status`): event `CONFIRMED` tetapi komponen `generation30` tidak terdefinisi, misalnya `Q` Pullback tidak finite (§4.3).
- `NO_SCORE` (`score_status`): satu atau lebih dari M1/M2/M3/M5 tidak tersedia sehingga M6 tidak dapat dibentuk (§8.1.3). Kode `score_status` yang lebih spesifik (mis. `DATA_INCOMPLETE`) dicantumkan di `reasons[]`.
- `SCORED`: seluruh skor yang dibutuhkan pada tahap tersebut valid. `NOT_APPLICABLE`: tahap event belum memerlukan skor (mis. masih `WAITING_*`).

Aturan pemetaan lintaslapis:

1. Hanya `event_status=CONFIRMED` yang boleh masuk perhitungan skor dan ranking; event `WAITING_*`/`CHOCH_CANDIDATE` membawa `score_status=NOT_APPLICABLE` dan tidak membawa `status` keputusan (`null`).
2. `CONFLICTING_DIRECTIONS` dan `MULTI_METHOD_COLLISION` dicatat di `event_status` **dan** diteruskan sebagai `status` keputusan (sesuai §8.1.7); skornya tidak dihitung untuk ranking.
3. `status=ENTRY_CONSIDER` mensyaratkan `event_status=CONFIRMED` dan `score_status=SCORED`. Sebaliknya `score_status≠SCORED` pada event `CONFIRMED` menghasilkan `status=NO_ENTRY` (atau `REJECTED_INTEGRITY` untuk audit M2 <20).
4. `reasons[]` adalah daftar `reason_code` detail (boleh lebih dari satu, urut sesuai urutan pipeline §9) dan **wajib tidak kosong** untuk setiap `status` selain `CLOSE_CANDIDATE` dan `ENTRY_CONSIDER`.

Status berbeda tidak boleh dikonversi menjadi `0/100` otomatis.

**Satu event per key:** bila label sinyal identik dari pembacaan berulang, simpan satu event dengan `source_labels[]` dan `duplicate_count`, bukan event baru. Jika keluarga berbeda pada `event_key` sama, `MULTI_METHOD_COLLISION`; jika LONG dan SHORT pada `(symbol,4h,decision_available_utc)` sama, `CONFLICTING_DIRECTIONS` mengalahkan collision. Pencocokan **waktu persis** adalah kebijakan v1; tidak ada penggabungan heuristik berdasarkan jarak candle ±N tanpa uji.

## 10. Kontrak keluaran yang wajib dipenuhi agen

```json
{
  "schema": "PRD_M1_M6_CONFLUENSE_V1",
  "event_status": "CONFIRMED",
  "score_status": "SCORED",
  "status": "ENTRY_CONSIDER",
  "reasons": [],
  "research_only": true,
  "synthetic_fixture": true,
  "venue": "BINANCE_USDM_FUTURES",
  "symbol": "BTCUSDT",
  "timeframe": "4h",
  "break_utc": "2024-09-30T16:00:00Z",
  "confirmation_utc": "2024-10-01T04:00:00Z",
  "decision_available_utc": "2024-10-01T04:00:00Z",
  "entry_reference_time_utc": "2024-10-01T04:00:00Z",
  "side": "LONG",
  "signal_family": "BREAKOUT_RETEST",
  "market_structure_direction": "BULLISH",
  "m1_origin_direction": null,
  "scores": {
    "m1_100": 85.0,
    "m2_signal_quality_80": 65.0,
    "m2_integrity_20": 20.0,
    "m2_100": 85.0,
    "m3_100": 70.0,
    "m4_100": 100.0,
    "m5_100": 55.0,
    "m6_confluense_500": 395.0,
    "m6_display_pct_not_winrate": 79.0,
    "m1_plus_m2q_0_180_display_only": 150.0
  },
  "equity_sim": 100.0,
  "atr_entry": 2.0,
  "atr_frozen": 2.0,
  "entry_reference_open": 100.0,
  "stop_price": 97.0,
  "target_price": 106.0,
  "qty": 0.3333333333333333,
  "risk_pct": 1.0,
  "gross_pct": 33.333333333333336,
  "rr_target": 2.0,
  "max_holding_hours": 24,
  "invalidation": {
    "rule": "CLOSE_BELOW_LEVEL_MINUS_R",
    "level": 99.0,
    "price": 98.8
  },
  "normalization_version": "SYNTHETIC_FIXTURE_ONLY",
  "risk_mandate_version": "RESEARCH_1_3_1X_V1",
  "m5_snapshot": "M5_AUDIT_2024_CLOSED_BAR_9BPS_V1",
  "data_quality_flags": [],
  "source_labels": ["BREAKOUT_RETEST"],
  "audit_trail": ["SYNTHETIC_FIXTURE_ONLY_NOT_A_REAL_SIGNAL"]
}
```

**Contoh kandidat ditolak (fixture sintetis, v1.0.1):**

```json
{
  "schema": "PRD_M1_M6_CONFLUENSE_V1",
  "event_status": "CONFIRMED",
  "score_status": "SCORED",
  "status": "REJECTED_RISK",
  "reasons": ["GROSS_CAP"],
  "research_only": true,
  "synthetic_fixture": true,
  "venue": "BINANCE_USDM_FUTURES",
  "symbol": "ETHUSDT",
  "timeframe": "4h",
  "break_utc": null,
  "confirmation_utc": "2024-10-01T04:00:00Z",
  "decision_available_utc": "2024-10-01T04:00:00Z",
  "entry_reference_time_utc": "2024-10-01T04:00:00Z",
  "side": "LONG",
  "signal_family": "PULLBACK_CONTINUATION",
  "market_structure_direction": "BULLISH",
  "m1_origin_direction": null,
  "scores": {
    "m1_100": 80.0,
    "m2_signal_quality_80": 60.0,
    "m2_integrity_20": 20.0,
    "m2_100": 80.0,
    "m3_100": 70.0,
    "m4_100_audit_partial": 75.0,
    "m5_100": 55.0,
    "m6_confluense_500": null,
    "m6_display_pct_not_winrate": null,
    "m1_plus_m2q_0_180_display_only": 140.0
  },
  "equity_sim": 100.0,
  "atr_entry": 2.0,
  "atr_frozen": 2.0,
  "entry_reference_open": 100.0,
  "stop_price": 97.0,
  "target_price": 106.0,
  "qty": 0.3333333333333333,
  "risk_pct": 1.0,
  "gross_pct": 33.333333333333336,
  "rr_target": 2.0,
  "max_holding_hours": 24,
  "invalidation": null,
  "normalization_version": "SYNTHETIC_FIXTURE_ONLY",
  "risk_mandate_version": "RESEARCH_1_3_1X_V1",
  "m5_snapshot": "M5_AUDIT_2024_CLOSED_BAR_9BPS_V1",
  "data_quality_flags": [],
  "source_labels": ["PULLBACK_CONTINUATION"],
  "audit_trail": ["SYNTHETIC_FIXTURE_ONLY_NOT_A_REAL_SIGNAL"]
}
```

Pada contoh ditolak, diasumsikan posisi berjalan sudah memakai gross 80% ekuitas sehingga 80%+33.33% > 100%; `m4_100_audit_partial=75` = `40D+35P+0N` (gross cap gagal) hanya untuk penjelasan; `m6_confluense_500` dan persentase tampilan **wajib `null`**, bukan 0.

**Ketentuan field tambahan v1.0.1:**

| Field | Ketentuan |
|---|---|
| `event_status`, `score_status`, `status` | Satu kode per lapis sesuai §9 |
| `reasons[]` | Array `reason_code`; kosong hanya untuk `CLOSE_CANDIDATE`/`ENTRY_CONSIDER`, wajib terisi untuk status lain |
| `gross_pct` | `100*qty*entry/equity_sim` setelah entry diketahui; `null` sebelum `ENTRY_REVIEW` |
| `invalidation` | Objek `{rule, level, price}` aturan pembatalan setup dari keluarga sinyal (Breakout/Reversal: close melewati `L∓r`; Pullback: aturan invalidasi §4.3); `null` bila tidak relevan pada tahap tersebut |
| `atr_entry`, `atr_frozen` | `ATR14[tc]` untuk stop/target/sizing dan `ATR14[t0−1]` untuk buffer/zona (§2, v1.0.7; menggantikan nama lama `atr_entry_frozen` yang rancu) |
| `max_holding_hours` | `24` untuk simulasi v1 (batas horizon §8.1.8); juga lama slot kapasitas terisi (§6) |
| `scores.m1_plus_m2q_0_180_display_only` | `M1 + M2_signal_quality80` (0–180), **field tampilan saja (v1.0.5)**: memperlihatkan bagian kualitas yang paling membedakan kandidat pada siklus yang sama; bukan skor baru, tidak mengubah bobot, tidak menggantikan M6, tidak dipakai di ranking selain tie-break §8.1.5 yang sudah ada |
| `break_utc` | Close candle break (Breakout/Reversal); `null` untuk Pullback (v1.0.2) |
| `confirmation_utc` | Close candle konfirmasi/trigger; **sama dengan** `decision_available_utc` dan `entry_reference_time_utc` (v1.0.2) |
| `m1_origin_direction` | Hanya Reversal: label `M1_origin` (§4.4); `null` untuk Breakout/Pullback (v1.0.2) |

**Kewajiban validasi JSON:** contoh di atas adalah **fixture sintetis**, bukan sinyal BTCUSDT/ETHUSDT nyata. Angka ilustratif yang konsisten: equity=100, entry=100, ATR=2, stop=97, target=106, qty=1/3, planned stop risk=1%, gross=33.33%; level fixture `L=99`, `r=0.10*ATR_frozen=0.2`, harga invalidasi `98.8`. Dalam peristiwa aktual `ENTRY_CONSIDER` **harus** memiliki input harga, stop, target, qty, risk, dan `normalization_version` yang benar-benar terverifikasi, **tidak boleh** memakai nilai `SYNTHETIC_FIXTURE_ONLY`. Sebelum actual next-open, status `CLOSE_CANDIDATE` dengan harga null sah. Semua calon yang tidak lulus harus memuat `status`, `reasons[]`, waktu, symbol, side, jenis sinyal, dan *provenance*, serta **`m6_confluense_500=null`**, bukan 0. Agen dilarang memproduksi hasil konkret tanpa data. Seluruh asumsi historis yang telah dipilih adalah kebijakan desain eksplisit; jika suatu input ternyata tidak tersedia, keluaran `INCOMPLETE` sudah menjadi **hasil final yang deterministik**, bukan alasan meminta agen menciptakan nilai atau bertanya parameter baru.

## 11. Acceptance tests (harus dijalankan sebelum PRD dianggap terimplementasi)

| ID | Pengujian | Ekspektasi wajib |
|---|---|---|
| T01 | Bobot masing-masing M1–M5 | Masing-masing tepat 100 maksimum; M2 80+20 |
| T02 | Penjumlahan contoh M6 | `395.00/500`, `79.00%` display |
| T03 | Score M1 contoh bullish | `85.00` dan arah BULLISH terpisah |
| T04 | Breakout wick-only melewati pivot | Tidak trigger; close wajib |
| T05 | Retest satu candle setelah break | Diperbolehkan, candle break tidak |
| T06 | Close invalidasi dan retest di candle sama | `INVALID` menang |
| T07 | Pullback `Q=.8`, `d=.5`, `age=2` | `27.3333333333/30` |
| T08 | M2 CDF menaati causal cut dan ties | Event t tidak berubah oleh appending candle masa depan |
| T09 | M3 enam pair kurang 180 return | `INCOMPLETE`, bukan 0 |
| T10 | M4 gross cap dilanggar | `REJECTED_RISK`, M6 tidak numerik |
| T11 | Dua arah pada pair-time sama | `CONFLICTING_DIRECTIONS`, tidak ranking |
| T12 | Dua keluarga pada event key sama | `MULTI_METHOD_COLLISION`, tidak dijumlah |
| T13 | Label duplicate exact | Satu event, tidak mendapat bonus |
| T14 | Mean Reversion/Pattern saja | `UNSUPPORTED_FOR_SCORING`, tanpa M6 |
| T15 | M5 frozen snapshot historis | Nilai `55`, bukan 100 |
| T16 | Kandidat berbeda, M6 lebih tinggi | Ranking M6 descending tanpa threshold |
| T17 | Sama-sama lulus M4 tetapi slot hanya satu | Pilih ranking lebih tinggi dahulu; sisanya `REJECTED_RISK` |
| T18 | M2 integrity 16/20 | Catat audit 16; `REJECTED_INTEGRITY` tanpa M6 angka |
| T19 | Skor M2 taker missing | `DATA_INCOMPLETE`, tanpa 0-filling |
| T20 | Determinisme ulang dan urutan input diacak | Event/result/hash sama |
| T21 | Konsistensi status tiga lapis (v1.0.1) | Setiap contoh JSON memakai tepat satu kode sah per lapis; `ENTRY_CONSIDER` ⇒ `CONFIRMED`+`SCORED`+`reasons=[]`; status lain ⇒ `reasons` tidak kosong |
| T22 | Kelengkapan schema JSON (v1.0.1) | Field wajib §8.1.8/§10 ada; `gross_pct=100*qty*entry/equity`; kandidat ditolak memiliki `m6_confluense_500=null` |
| T23 | Rekonsiliasi jumlah sampel (v1.0.1) | Event train CSV = `population_n` CDF Breakout = 258; eval = 152; total = 410 |
| T24 | Konsistensi waktu dan field v1.0.2 | `confirmation_utc = decision_available_utc = entry_reference_time_utc`; `break_utc < confirmation_utc` untuk Breakout/Reversal, `null` untuk Pullback; `m1_origin_direction` ada (null bila bukan Reversal) |
| T25 | Metode indikator & jendela Pullback (v1.0.3) | PRD menetapkan `ewm(alpha=1/14, adjust=False)` untuk ATR/DI/ADX; tidak ada lagi bagian yang masih menunggu verifikasi; jendela pra-zona `i+3`..`i+26` inklusif |
| T26 | Kontrak audit & label bukti (v1.0.4) | `conflict4` berbasis log dengan reason `CONFLICT_CHECK_NOT_LOGGED`; CSV kanonis berlabel full-train in-sample; snapshot M5 berlabel `BREAKOUT_2024_NO_DIRECTION_GATE` |
| T27 | Operasional & tampilan (v1.0.5) | Reason `FETCH_FAILED`/`CONFIRMED_GAP` dan `GROSS_CAP`/`PAIR_ACTIVE`/`POSITION_OR_RISK_CAP` terdefinisi; slot 24 jam tetap; `m1_plus_m2q_0_180_display_only = m1_100 + m2_signal_quality_80` pada kedua contoh JSON |
| T28 | CSV skor kausal 772 event (v1.0.6) | SHA-256 cocok; 772/491/281/400/91; `prior_same_family_train_events` dihitung ulang cocok; tidak ada skor pada `CALIBRATION_INCOMPLETE`; skor train kausal dan eval direproduksi dari fitur mentah + ECDF (toleransi 1e−8) |
| T29 | Audit bahasa–kode (v1.0.7) | Setiap token kode huruf besar di PRD termasuk daftar resmi §9/reason atau daftar identifier terdaftar; field `atr_entry`/`atr_frozen`/`equity_sim` ada di kedua contoh JSON; rumus komponen M1/M2 cocok 410/410 baris CSV kanonis |

**Klasifikasi tes (v1.0.5):** T04, T05, T09, T14, dan T15 pada `verify_final_prd.py` adalah **`STATIC_CONTRACT_CHECK`** — hanya memeriksa aritmetika/konstanta kontrak, **bukan** bukti validasi engine, dan tidak boleh dihitung sebagai uji integrasi sistem. Saat engine diimplementasikan, wajib ditambahkan tes berbasis candle OHLCV sintetis yang menjalankan generator sebenarnya, minimal:

| ID | Skenario candle sintetis | Ekspektasi |
|---|---|---|
| I01 | Wick menembus level, close tidak | Tidak ada break/trigger |
| I02 | Close invalidasi pada candle yang sama dengan sentuhan retest | `INVALID` |
| I03 | Satu candle hilang (`CONFIRMED_GAP`) pada satu pair | M3 seluruh pair dan M1 pair tersebut `INCOMPLETE` sampai jendela lengkap pulih; tanpa interpolasi |
| I04 | LONG dan SHORT pada key yang sama | `CONFLICTING_DIRECTIONS`; log `conflict4` tercatat |
| I05 | Kandidat kedua melampaui gross 1× / pair aktif / slot | `REJECTED_RISK` dengan reason `GROSS_CAP` / `PAIR_ACTIVE` / `POSITION_OR_RISK_CAP`; M6 `null` |
| I06 | Stop tersentuh sebelum 24 jam | Outcome tercatat, slot **tetap terisi** sampai `entry+24h` |
| I07 | Regresi Reversal (v1.0.8): 11 break 2024 yang gagal kronologi pivot (mis. BNBUSDT LONG 2024-03-28, pivot high dan low pada candle sama) | **Tidak** dibangkitkan |
| I08 | Regresi Breakout (v1.0.8): BTCUSDT SHORT level 68830 | Dua event terkonfirmasi 2024-05-27 08:00 dan 12:00 UTC dari pivot sama |
| I09 | Paritas arsip candle asli Binance 2024 (v1.0.8) | Breakout 410/410, Pullback 298/298, Reversal 64/64 tanpa ekstra; M1 410/410; generation30 410/410; kualitas 80 kausal 772/772 |

Lulus acceptance test berarti **spesifikasi dapat dihitung secara deterministik**, **bukan** menunjukkan strategi memperoleh keuntungan. Pada paket riset sebelum perubahan ini, kontrak generator v2 memiliki **33/33 PASS**; itu **bukan** bukti bahwa M6 Confluense baru telah diuji secara ekonomi. Pengujian aritmetika versi final disertakan terpisah pada laporan validasi PRD.

## 12. Matriks provenance repository GitHub — konsep vs keputusan lokal

Repository adalah **sumber konsep yang diteliti**, **bukan** pihak yang membuktikan atau memilih bobot penelitian ini. Angka bobot dan keputusan M6 berasal dari audit internal terdahulu dan instruksi pengguna, **tidak dinisbahkan kepada pemilik repository**.

| Sumber primer yang diverifikasi 10 Okt 2026 | Konsep yang diadopsi | Lokasi penerapan dalam PRD |
|---|---|---|
| [SKE-Labs — agent-trading-skills](https://github.com/SKE-Labs/agent-trading-skills) termasuk [correlation-risk](https://github.com/SKE-Labs/agent-trading-skills/blob/main/skills/risk-management/correlation-risk/SKILL.md) dan [double top/bottom](https://github.com/SKE-Labs/agent-trading-skills/blob/main/skills/chart-patterns/double-top-bottom/SKILL.md) | Definisi formalisasi pola & konsentrasi risiko | M3/M4, pola tanpa bobot |
| [TraderMonty — edge-signal-aggregator](https://github.com/tradermonty/claude-trading-skills/blob/main/skills/edge-signal-aggregator/SKILL.md) | Agregasi, provenance, deduplikasi, deteksi pertentangan | M6, event hygiene |
| [AgiproLabs — correlation-analysis](https://github.com/agiprolabs/claude-trading-skills/blob/main/skills/correlation-analysis/SKILL.md), [position-sizing](https://github.com/agiprolabs/claude-trading-skills/blob/main/skills/position-sizing/SKILL.md), [walk-forward-validation](https://github.com/agiprolabs/claude-trading-skills/blob/main/skills/walk-forward-validation/SKILL.md) | Korelasi, tail, ukuran posisi, uji temporal | M3/M4/M5 |
| [HKUDS — Vibe-Trading candlestick](https://github.com/HKUDS/Vibe-Trading/blob/main/agent/src/skills/candlestick/SKILL.md) | Pola candlestick sebagai label sinyal yang harus diuji | Taksonomi M2 pattern tanpa skor |
| [staskh — trading_skills](https://github.com/staskh/trading_skills) | Pemisahan data teknikal, portfolio, dan pelaporan agen | Schema output & provenance |
| [Binance — binance-skills-hub](https://github.com/binance/binance-skills-hub) | Ekosistem akses data crypto via skill, bukan sumber bobot | Sumber ekosistem, bukan validasi fill |
| [MobiusQuant — OpenMobius-skill](https://github.com/MobiusQuant/OpenMobius-skill) | Struktur dan taksonomi ICT/SMC | Pivot/CHoCH sebagai klasifikasi tanpa bonus |
| [Alpaca — backtest](https://github.com/alpacahq/alpaca-skills/blob/main/skills/trading-api/backtest/SKILL.md) | Backtest dapat direproduksi, pengungkapan asumsi | M5, audit/hasil hipotetis |

**Arsip bukti dan rumus lokal:** `REPRO_REFRESH_METODOLOGI_1-6_2024_2026-10-09.zip`, `REPRO_PENUTUPAN_HUTANG_METODOLOGI_2026-10-10.zip`, `REPRO_AUDIT_KAUSALITAS_ECDF_M6_2026-10-10.zip` (folder Library `Riset Metodologi Trading GitHub`). Dokumen checkpoint `KEPUTUSAN_TERKUNCI_METODOLOGI_TRADING_GITHUB_2026-10-09.md` dipertahankan sebagai sejarah perubahan; **PRD final baru ini adalah spesifikasi normatif**. Sumber repository diverifikasi melalui read-only GitHub fetch; **tidak dilakukan commit/push**.

## 12.1 Bukti numerik yang mendasari pilihan bobot (snapshot penelitian, bukan optimasi global)

| Metode / keluarga | Data uji yang sudah ada | Keputusan dibekukan dan interpretasi |
|---|---|---|
| M1 | 410 event sinyal enam pair 4H 2024; formula struktur/TE/ADX/volatilitas dihitung ulang | 45/25/10/20; skor merepresentasikan status/kualitas pengamatan, bukan edge |
| M2 Breakout–Retest | 258 confirmed train dan 152 evaluasi; seluruh 410 event memiliki horizon outcome lengkap (diverifikasi ulang dari `CANONICAL_SCORES_410_EVENTS_2024.csv`) | 15/10/5; Spearman skor–return −0.054 pada train dan +0.115 evaluasi (tidak stabil). **Label versi (v1.0.7, diverifikasi dari CSV kanonis):** angka ini adalah Spearman antara **`signal_generation_30`** (komponen 15/10/5, **bukan** kualitas 80) dan `net_6`. Eval +0.115 direproduksi tepat (152 event). Train −0.054 hanya tereproduksi pada sampel 257 event; pada 258 event hasilnya −0.051, dan event yang dikeluarkan tidak dapat diidentifikasi dari paket (21 kandidat). Pembanding: kualitas 80 in-sample −0.035/+0.089; kualitas 80 kausal (`m2_quality80_causal_for_decision`) −0.030 (228 train)/+0.089 (152 eval). Semua tetap lemah dan tidak stabil |
| M2 Pullback v2 | 189 sinyal train untuk CDF dan generator v2 yang diuji 2024 | 5/10/5/10, kalibrasi khusus keluarga; rekonstruksi generator legacy tidak disamakan |
| M2 Reversal v2 | 44 event train untuk CDF Reversal v2; sejarah evaluasi reversal lama 32 confirmed (generator berbeda) | 15/15; tidak meminjam distribusi ke keluarga lain |
| M2 Momentum/Participation | 258 event train Breakout untuk CDF terpisah E/L/V/B; 410 skor berulang cocok sampai selisih 1.11e−16 | 15/10 dan 10/15; satu keluarga bukti partisipasi per indeks |
| M3 | 1.823 jendela lengkap 4H enam pair (1.283 sebelum Sep dan 540 Sep–Nov 2024) | 60/40; korelasi antarkedua subfitur Spearman +0.025; konteks diversifikasi |
| M4 | 410 event Breakout (cakupan `BREAKOUT_2024_NO_DIRECTION_GATE`) dan sembilan kombinasi stop/target; 285 diterima dan 125 ditolak dalam simulasi kapasitas | 40/35/25, mandat 1%/3%/1× dan maksimal 3 slot. Rincian 125 penolakan: `GROSS_CAP` 68, `PAIR_ACTIVE` 42, `POSITION_OR_RISK_CAP` 15. Versi audit awal tanpa pemeriksaan gross gabungan menghasilkan 327/83; **versi yang mengikat adalah audit lanjutan dengan gross 1× (285/125)**. Statistik 285/125 adalah **bukti sejarah simulasi**, bukan perkiraan jumlah kandidat yang akan diterima saat seluruh aturan PRD (termasuk gate arah) diterapkan; aturan M4 tidak bergantung pada angka ini |
| M5 | Audit 410 event Breakout (cakupan `BREAKOUT_2024_NO_DIRECTION_GATE`); indikator lulus `(1,1,0,0)` | 30/25/25/20 memberi snapshot 55/100; bukan persentase kemenangan |
| M6 baru | **Belum ada backtest komposit M1+M2+M3+M4+M5 menyeluruh** | Penjumlahan langsung **ditetapkan oleh pengguna sebagai keputusan desain**, bukan bobot yang diklaim pernah dioptimalkan |

**Status skor pada CSV kanonis dan versi prior-only (v1.0.4):** `CANONICAL_SCORES_410_EVENTS_2024.csv` adalah **reproduksi historis full-train in-sample** (CDF dibangun dari seluruh periode train, termasuk event yang dinilai). File ini **tidak boleh** dipakai sebagai skor keputusan kausal, untuk evaluasi ranking M6, atau untuk mensimulasikan keputusan masa lalu. Evaluasi keputusan historis wajib memakai skor **ECDF prior-only** §2 (minimal 30 observasi terdahulu; kurang dari itu → `CALIBRATION_INCOMPLETE`). Hasil audit kausalitas (dilaporkan penyusun PRD dari `REPRO_AUDIT_KAUSALITAS_ECDF_M6_2026-10-10.zip`):

| Keluarga | Event train | Skor berubah vs full-train | Event dengan ≥30 observasi terdahulu (skor prior-only numerik) |
|---|---:|---:|---:|
| Breakout | 258 | 257 | 228 |
| Pullback | 189 | 188 | 158 |
| Reversal | 44 | 43 | 14 |

Konsekuensi: pada replay keputusan selama periode kalibrasi 2024, event di bawah ambang 30 observasi (30 Breakout, 31 Pullback, 30 Reversal) berstatus `CALIBRATION_INCOMPLETE`; untuk event setelah periode kalibrasi, array beku tetap dipakai sesuai §2 dan tidak terdampak. **CSV skor kausal per event (v1.0.6):** `evidence/ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv` (SHA-256 `b38b6ddaa99f1fd12bbe8187158d84356186c4b9d36faee612c7d9a6becf3118`, versi `M2_ECDF_STRICT_PRIOR_AUDIT_20261010_V1`) memuat seluruh **772 event berlabel** (491 train + 281 eval; Breakout 410, Pullback 298, Reversal 64). Kolom resmi:

| Kolom | Arti |
|---|---|
| `m2_quality80_causal_for_decision` | **Satu-satunya skor M2 kualitas yang sah untuk evaluasi keputusan historis**; sel kosong = `null` |
| `score_status` | `CAUSAL_SCORE_VALID` (681) atau `CALIBRATION_INCOMPLETE` (91, seluruhnya train) |
| `prior_same_family_train_events` | Jumlah event train keluarga sama dengan waktu konfirmasi **lebih awal secara ketat**; untuk eval = total train keluarga |
| `normalization_policy` | `EXPANDING_PRIOR_ONLY_TRAIN_UTC_STRICT_LT_TIMESTAMP` (train) / `FROZEN_COMPLETE_TRAIN_ECDF_EVAL_ONLY` (eval) |
| `m2_quality80_full_train_insample_reference` | Skor in-sample historis — **referensi diagnostik saja**, tidak untuk keputusan |
| `m2_quality80_strict_prior_diagnostic` | Skor prior-only tanpa ambang 30 — diagnostik saja |

Verifikasi independen (T28, dihitung ulang dari kolom fitur mentah dan array beku di paket): jumlah 772/491/281/400/91 cocok; `prior_same_family_train_events` cocok 772/772; tidak ada skor terisi pada event `CALIBRATION_INCOMPLETE`; 400/400 skor train kausal direproduksi tepat (selisih 0) dari ECDF prior-only kebijakan tie kanan §2; 281/281 skor eval direproduksi dari array beku (selisih <1e−10, pembulatan CSV); 410/410 referensi in-sample Breakout cocok dengan `CANONICAL_SCORES_410_EVENTS_2024.csv`. Angka "skor berubah" 257/188/43 kini **terverifikasi**: event train pertama tiap keluarga tidak memiliki pembanding (tak terdefinisi), dan seluruh event train sisanya berubah dibanding referensi in-sample.

**Pemetaan label CSV audit ke kontrak PRD (v1.0.7):** CSV memakai label arsip; saat dibaca agen wajib dipetakan sebagai berikut dan **tidak** dianggap kode status baru:

| Kolom CSV | Nilai CSV | Padanan kontrak PRD |
|---|---|---|
| `score_status` | `CAUSAL_SCORE_VALID` | `score_status=SCORED` |
| `score_status` | `CALIBRATION_INCOMPLETE` | `score_status=CALIBRATION_INCOMPLETE` |
| `signal_family` | `BREAKOUT` / `PULLBACK` / `REVERSAL` | `BREAKOUT_RETEST` / `PULLBACK_CONTINUATION` / `REVERSAL_RETEST` |
| `period` | `TRAIN` / `EVAL` | `train` / `eval` pada CSV kanonis |
| `side` | `LONG` / `SHORT` | `side=+1` / `side=−1` |
| `confirmation_available_utc` | ISO-8601 UTC | `confirmation_utc` = `decision_available_utc` |

Catatan audit CSV: (a) untuk 36 dari 44 event Reversal train, `m2_signal_generation30_archived` dan referensi in-sample berbeda satu–dua langkah ECDF (kelipatan 15/44) dari ECDF array beku dengan tie kanan; selisih ini hanya pada kolom diagnostik dan **tidak** memengaruhi kolom kausal. (b) CSV ini adalah audit skor, bukan keputusan kanonis: tidak memuat `event_status`; terdapat 73 identitas `(pair, waktu, side)` dengan lebih dari satu keluarga (→ `MULTI_METHOD_COLLISION`) dan 1 pasangan pair-waktu dengan dua arah (DOGEUSDT 2024-03-31T08:00Z, Breakout SHORT vs Pullback LONG, keduanya `CALIBRATION_INCOMPLETE`) yang tetap harus diproses aturan §9 sebelum ranking.

**Rekonsiliasi angka sampel Breakout (v1.0.1):** jumlah event Breakout train adalah **258** (dipakai di M5, `frozen_cdf_normalization.json` `population_n=258`, dan CSV kanonis). Angka **257** yang tercantum pada v1.0.0 **bukan jumlah event**, melainkan — menurut keterangan penyusun PRD — jumlah skor train yang **berubah** ketika dihitung ulang dengan ECDF kronologis prior-only dalam arsip `REPRO_AUDIT_KAUSALITAS_ECDF_M6_2026-10-10.zip`. Angka 257 telah **diverifikasi** pada v1.0.6 dari `evidence/ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv` (257 dari 257 skor yang dapat dihitung berubah; event pertama tak terdefinisi). Konsekuensinya: skor event train pada CSV kanonis adalah skor CDF in-sample (reproduksi sejarah), bukan skor keputusan kausal menurut §2. Tidak ada event yang dihapus dan tidak ada backtest yang diulang karena rekonsiliasi ini.

**Paritas engine (v1.0.8):** implementasi engine yang mengikuti §4.2–§4.5 versi ini mereproduksi dari candle asli Binance USDⓈ-M 4H 2024 (arsip resmi, checksum cocok) seluruh 772 event bukti (Breakout 410, Pullback 298, Reversal 64) tanpa event ekstra, M1 410/410, generation30 410/410, dan kualitas 80 kausal 772/772. Ini membuktikan kesesuaian implementasi dengan generator arsip, **bukan** profitabilitas atau *edge* ekonomi M6.

Penyebutan "final" mengunci **aturan kalkulasi**. Klaim kausal, statistik profitabilitas, atau validasi live **tidak ditambah/dikarang**. Data uji internal membenarkan bahwa komponen dapat dihitung dan mengekspos sensitivitas serta keterbatasan; tidak membuktikan bobot optimal.


### 12.2 Fingerprint sumber GitHub untuk audit agen

Fingerprint berikut adalah **Git blob SHA**, **bukan commit SHA**. Agen bisa memakai `repository_full_name + path + blob_sha` untuk mengecek bahwa file rujukan yang dibacanya tidak berubah sejak audit ini. Jika konten berubah, **jangan diam-diam mengganti parameter PRD**; PRD v1 ini tetap mengikat.

| Repo / berkas | Git blob SHA |
|---|---|
| `SKE-Labs/agent-trading-skills/skills/risk-management/correlation-risk/SKILL.md` | `206029121018df9472beb6fa58a941db9e61af94` |
| `tradermonty/claude-trading-skills/skills/edge-signal-aggregator/SKILL.md` | `27fc42e48b54d3af4b386ad3f450ee46e58afa2d` |
| `agiprolabs/claude-trading-skills/skills/correlation-analysis/SKILL.md` | `b8e63ebb430dc9fe174ac7dcb1ac9d6a85254e2a` |
| `agiprolabs/claude-trading-skills/skills/position-sizing/SKILL.md` | `b5a22d7a84ccb8238b549b6a2edef3e3ad668f6d` |
| `agiprolabs/claude-trading-skills/skills/walk-forward-validation/SKILL.md` | `59f6a262afed5b73e0a723fa959055f4c47260ae` |
| `HKUDS/Vibe-Trading/agent/src/skills/candlestick/SKILL.md` | `aed85f6f7c0dcfb27039ef1957d611a174608727` |
| `alpacahq/alpaca-skills/skills/trading-api/backtest/SKILL.md` | `806d1be5e2500cf5066247ce55f9c6c0e2ee7579` |
| `MobiusQuant/OpenMobius-skill/README.md` | `cc5703dbce329aeb45a7468e10cca2ebfab15789` |
| `staskh/trading_skills/README.md` | `20654fec39dd7710d3e62d5ff056045a1ecfa9e3` |
| `binance/binance-skills-hub/README.md` | `58b079a56a83b9475ee2ba6396850f8d1cfae32e` |

## 13. Keputusan akhir untuk agen

- **Wajib** hitung M1, M2, M3, M4, dan M5 sesuai kontrak di atas; **wajib** hitung M6 dengan penjumlahan sederhana. Jika kelima skor valid, M6 maksimum 500. **Jangan** mengubah bobot setelah melihat hasil transaksi.
- **Wajib** mempertahankan skor M2 kualitas 80 dan audit 20 dalam dua field, meskipun M2 total 100 turut masuk M6.
- **Wajib** membedakan `CLOSE_CANDIDATE`, `ENTRY_CONSIDER`, `REJECTED_*`, `NO_ENTRY`; ranking Confluense tidak menggantikan pemeriksaan arah, integritas, dan risiko.
- **Wajib** memakai definisi, window, waktu, status, tie-break, dan form output dokumen ini tanpa improvisasi nilai baru. Tidak ada penugasan tambahan untuk validasi independen 2025–2026, tidak ada deployment atau publikasi.
- **Dilarang** menyebut skor gabungan sebagai probabilitas keberhasilan, *backtested winning edge*, atau sertifikat profit. Jika bukti ekonomik belum ada, tulis fakta tersebut secara eksplisit **tanpa mengubah rumus atau menunda penyelesaian desain PRD**.

**Status keputusan: FINAL_DESIGN — M1…M5 bobot tetap, M6 CONFLUENSE aditif, tanpa pertanyaan desain tambahan kepada agen.**

## 14. Tahap A — Uji arsitektur sistem (backtest komposit 2024–2026) dan usulan perbaikan (v1.0.9)

**Sifat bagian ini:** catatan hasil uji dan **usulan** perbaikan. Aturan normatif §1–§13 **tidak berubah** oleh bagian ini; setiap usulan yang diterima pengguna wajib dituangkan sebagai revisi PRD terpisah dan diuji ulang dengan protokol yang sama.

### 14.1 Desain uji (dikunci sebelum hasil dilihat)

| Aspek | Ketentuan |
|---|---|
| Yang diuji | **Arsitektur dan cara kerja aplikasi**, lapis demi lapis: generator sinyal → gate arah M1 → aturan bentrok → skor/ranking M6 → kapasitas portofolio → exit → biaya. Engine yang dipakai identik dengan aplikasi (PRD v1.0.8, paritas 772/772). |
| Data | Kline 4H dan funding rate **asli** Binance USDⓈ-M dari arsip resmi data.binance.vision (checksum resmi), 1 Jan 2024 – 9 Okt 2026; keputusan mulai 1 Feb 2024 (warmup). |
| Universe | 30 pair USDⓈ-M dengan total quote volume terbesar pada periode tersebut dari ±75 kandidat (minimal 12 bulan data): BTC, ETH, SOL, XRP, DOGE, 1000PEPE, BNB, SUI, ADA, WIF, ENA, LINK, AVAX, WLD, TRUMP, HYPE, LTC, 1000SHIB, NEAR, ORDI, BCH, FIL, 1000BONK, FARTCOIN, UNI, AAVE, ARB, NEIRO, DOT, TIA (semua …USDT). M3 tetap basket enam pair §1. Bias: pair yang sudah delisting tidak ikut (survivorship). |
| Kalibrasi | Array beku 2024 (kebijakan FROZEN_COMPLETE_TRAIN_ECDF) untuk semua event. |
| Trade | Entry open(t+1); stop 1.5·ATR_entry; target 2R; horizon 24 jam; stop dievaluasi lebih dulu bila stop dan target tersentuh pada candle yang sama; candle melintasi gap tidak dinilai. |
| Biaya | 9 bps dan 18 bps round-trip atas notional + funding rate asli selama posisi terbuka. Ukuran posisi §6 (risiko 1%, notional ≤ 1× ekuitas, tanpa kompaun). |
| Metode | **Ablation**: tiap lapis dimatikan atau diganti, sistem lain tetap. Seluruh periode dinilai sekaligus; hasil per tahun (2024, 2025, 2026) hanya **uji konsistensi** — perubahan dianggap memperbaiki bila rata-rata R per trade positif di ketiga tahun. Signifikansi: t-stat rata-rata R. |
| Reproduksi | `scripts/backtest/fetch-universe.js` (data) dan `scripts/backtest/run.js` (uji); hasil di `results/tahap-a/summary.json` dan `trades.csv.gz`. Alokator ablation direkonsiliasi dengan portofolio engine: jumlah posisi sistem baseline identik (2.234). |

### 14.2 Hasil utama

| Populasi (biaya 9 bps) | n trade | R rata-rata | t | 2024 | 2025 | 2026 |
|---|---:|---:|---:|---:|---:|---:|
| Sinyal lolos semua gerbang, dinilai per sinyal (tanpa batas kapasitas) | 7.190 | −0.004 | −0.38 | +0.052 | −0.021 | −0.044 |
| Sinyal yang ditolak gate arah M1 | 4.838 | +0.005 | +0.38 | +0.006 | +0.017 | −0.010 |
| Sinyal bentrok (`MULTI_METHOD_COLLISION`) | 2.232 | −0.025 | −1.24 | −0.028 | −0.075 | +0.047 |
| **Sistem penuh PRD** (ranking M6, kapasitas §6) | 2.234 | **+0.032** | 1.56 | +0.046 | +0.042 | +0.003 |
| Sistem penuh PRD, biaya **18 bps** | 2.234 | +0.010 | 0.49 | +0.025 | +0.021 | −0.022 |

Keterangan sistem penuh 9 bps: win 46.7%, profit factor 1.08, akumulasi +72% ekuitas acuan (tanpa kompaun) dengan drawdown maksimum 36%, rangkaian rugi terpanjang 15. Exit: 60% habis waktu 24 jam, 29% stop, 11% target. Funding rata-rata −0.008% per trade (kecil). Distribusi status: **seluruh 990 event Reversal berakhir `MULTI_METHOD_COLLISION`** (bentrok dengan Breakout pada key yang sama), sehingga keluarga Reversal tidak pernah dapat ditradingkan.

### 14.3 Ablation per lapis (sistem penuh, R rata-rata per trade)

| Kode | Perubahan arsitektur | 9 bps: R (t) | 2024 / 2025 / 2026 | 18 bps: R | Konsisten 3/3 (9 bps) |
|---|---|---:|---|---:|:-:|
| A0 | Baseline PRD | +0.032 (1.56) | +0.046 / +0.042 / +0.003 | +0.010 | ya |
| G1 | Hanya generator Breakout | −0.008 (−0.32) | −0.006 / 0.000 / −0.019 | −0.030 | tidak |
| G2 | Hanya generator Pullback | +0.009 (0.37) | +0.064 / −0.019 / −0.020 | −0.014 | tidak |
| D1 | Gate arah M1 pair dimatikan | +0.013 (0.69) | +0.020 / +0.018 / −0.001 | −0.009 | tidak |
| D2 | Gate rezim BTC menggantikan gate pair | +0.015 (0.59) | +0.012 / +0.019 / +0.016 | −0.008 | ya |
| D3 | Gate pair **dan** searah struktur M1 BTC | +0.026 (0.91) | +0.010 / +0.052 / +0.011 | +0.002 | ya |
| D4 | Gate pair + tolak trade berlawanan struktur M1 BTC | +0.029 (1.32) | +0.017 / +0.046 / +0.020 | +0.006 | ya |
| R1 | Ranking acak (median) | +0.034 (1.68) | +0.069 / +0.029 / 0.000 | +0.014 | ya |
| R2 | Ranking M1+M2q | +0.032 (1.56) | sama persis dengan A0 | +0.010 | ya |
| R3 | Ranking likuiditas | +0.024 (1.18) | +0.055 / +0.031 / −0.021 | +0.001 | tidak |
| K1 | Kapasitas 1 slot | +0.022 (0.65) | +0.026 / +0.008 / +0.035 | −0.001 | ya |
| K2 | Kapasitas 5 slot / tanpa batas slot | +0.032 | sama persis dengan A0 | +0.010 | ya |
| C1 | Lewati close dengan ≥4 sinyal serentak | +0.035 (1.62) | +0.013 / +0.049 / +0.043 | +0.012 | ya |
| X1 | Horizon 48 jam | −0.003 (−0.10) | −0.006 / −0.022 / +0.024 | −0.025 | tidak |
| X2 | Stop 2·ATR, target 3R, horizon 48 jam | +0.033 (1.11) | +0.086 / −0.006 / +0.021 | +0.016 | tidak |
| U1 | Universe hanya enam pair inti §1 | −0.006 (−0.17) | +0.067 / −0.013 / −0.092 | −0.038 | tidak |
| B1 | Gate pair + rezim BTC + lewati ≥4 serentak | +0.051 (1.69) | −0.022 / +0.084 / +0.104 | +0.028 | tidak |

Diagnostik tambahan (sinyal lolos gerbang, per sinyal, 9 bps): kuintil M6 **tidak monoton** di ketiga tahun; ranking M6 sama persis dengan ranking M1+M2q karena M3, M4, dan M5 bernilai sama untuk semua kandidat pada satu close; urutan M6 terbalik dan urutan acak menghasilkan R yang setara. Sinyal pada close dengan ≥7 sinyal serentak: +0.149 (2024), −0.162 (2025), −0.255 (2026) — tanda berbalik antartahun.

### 14.4 Kesimpulan per lapis

| Lapis | Temuan | Status |
|---|---|---|
| Generator sinyal (§4) | Edge per sinyal ≈ 0 (−0.004R, 7.190 trade); hanya 2024 positif. Breakout sendirian tidak positif; Pullback hanya 2024. **Akar masalah sistem.** | Perlu dibenahi |
| Reversal (§4.4) | 990/990 event bentrok dengan Breakout → tidak pernah diranking | Tidak berfungsi dalam arsitektur saat ini |
| Gate arah M1 pair (§8.1.2) | Sinyal yang ditolak tidak lebih buruk dari yang diterima | Tidak menambah edge |
| Aturan bentrok (§9) | Sinyal bentrok rata-rata negatif | Bekerja; dipertahankan |
| Skor M1–M5 & ranking M6 (§8) | Tidak memisahkan trade baik/buruk; setara acak | Tidak menambah edge |
| Kapasitas portofolio (§6) | Pengikat sebenarnya adalah risiko terbuka 3% dan gross 1×, bukan batas 3 slot; kapasitas inilah yang membuat sistem positif tipis | Bekerja sebagai manajemen risiko |
| Exit (§6) | 60% trade berakhir karena waktu; tidak ada varian exit yang konsisten | Bukan sumber perbaikan utama |
| Biaya | Pada 18 bps seluruh varian ≈ 0 atau negatif | Penentu kelayakan |

**Kesimpulan Tahap A:** arsitektur v1.0.9 **belum memiliki edge yang signifikan secara statistik** (seluruh varian t < 2) dan **tidak tahan biaya 18 bps**. Hasil positif tipis sistem penuh berasal dari pembatasan kapasitas, bukan dari kemampuan skor memilih sinyal. Sistem **belum layak** dipakai dengan uang nyata.

### 14.5 Usulan perbaikan (menunggu persetujuan pengguna)

| Jenis | Usulan | Dasar dari hasil uji |
|---|---|---|
| **Benahi** | **Generator sinyal** sebagai prioritas riset berikutnya: definisi setup baru diuji dengan protokol §14.1 sebelum dipakai. Setiap hipotesis wajib dinyatakan sebelum diuji. | Edge per sinyal ≈ 0 (§14.2) |
| **Benahi** | **Exit dan horizon** dirancang ulang bersama generator (target 2R hanya tercapai 11% dalam 24 jam). | 60% exit karena waktu; tidak ada varian exit konsisten (X1, X2) |
| **Tambah** | **Lapis rezim pasar BTC**: tolak trade yang berlawanan dengan struktur M1 BTCUSDT (D4) atau wajib searah (D3). | Satu-satunya perubahan gerbang yang positif di ketiga tahun (D2–D4) dengan drawdown lebih rendah; belum signifikan |
| **Tambah** | **Eksekusi biaya rendah** (order maker/limit, target ≤ 9 bps round-trip) sebagai prasyarat penggunaan nyata. | Semua varian ≈ 0 atau negatif pada 18 bps |
| **Tambah (hipotesis)** | Filter kepadatan sinyal (lewati close dengan ≥4 sinyal serentak) untuk diuji lanjut di Tahap B, **belum** untuk dipakai. | C1 konsisten 3/3 di sistem, tetapi efek per sinyal berbalik tanda antartahun |
| **Kurangi** | **Ranking M6** sebagai penentu prioritas: ganti dengan aturan sederhana yang terdokumentasi, atau tampilkan M6 hanya sebagai informasi. M3 dan M5 tidak perlu ikut dijumlahkan untuk ranking. | Ranking M6 = ranking M1+M2q = setara acak (R1, R2) |
| **Kurangi** | **Reversal–Retest** sebagai keluarga terpisah: hapus dari skor, atau rumuskan ulang prioritas bentroknya lalu uji ulang. | 990/990 bentrok |
| **Kurangi** | **Gate arah M1 per pair** sebagai satu-satunya gerbang arah: digantikan atau dilengkapi lapis rezim BTC. | Sinyal yang ditolak gate ≈ sinyal yang diterima (D1) |
| **Pertahankan** | Aturan bentrok §9, batas risiko §6 (1% / 3% / gross 1×), universe 30 pair likuid. | Bentrok negatif; kapasitas menahan drawdown; universe 6 pair saja lebih buruk (U1) |

### 14.6 Kriteria lanjut ke Tahap B (uji forward)

Arsitektur hasil revisi boleh masuk forward test dengan uang nyata hanya bila, dengan protokol §14.1 atas seluruh data 2024–2026 **dan biaya 18 bps + funding**: (1) R rata-rata per trade ≥ +0.05 dengan t ≥ 2.0; (2) positif di setiap tahun; (3) drawdown maksimum ≤ 25% ekuitas acuan pada risiko 1% per trade. Arsitektur v1.0.9 **belum memenuhi** ketiganya; Tahap B hanya boleh berupa **paper forward test** untuk pengumpulan data. Lulus kriteria ini pun **bukan** jaminan profit.

## 15. Tahap A2 — Riset generator sinyal baru dan lapis rezim BTC (v1.0.10)

**Sifat bagian ini:** catatan hasil riset dan usulan; aturan normatif §1–§13 tidak berubah.

### 15.1 Desain (dikunci sebelum hasil dilihat)

Data, universe 30 pair, periode (Feb 2024–Okt 2026), biaya, funding, dan ukuran posisi sama dengan §14.1. Tujuh keluarga hipotesis, masing-masing dua varian parameter, diuji **tanpa** dan **dengan** lapis rezim BTC (trade hanya bila searah label struktur M1 BTCUSDT pada close keputusan; label `TRANSITION` → tidak ada trade) = **28 konfigurasi**, semuanya dilaporkan:

| Kode | Generator | Exit |
|---|---|---|
| H1a/b | Breakout–Retest §4.2 + gate arah M1 pair + aturan bentrok §9 | a: stop 1.5·ATR, 2R, 24 jam · b: trailing 3·ATR, maks 7 hari |
| H2a/b | Pullback §4.3 + gate arah M1 pair + aturan bentrok §9 | sama dengan H1 |
| H3a/b | Donchian: close menembus high/low 20 / 55 hari | stop 2·ATR; keluar saat close menembus kanal 10 / 20 hari |
| H4a/b | Momentum deret waktu: arah = tanda return 30 / 60 hari, dievaluasi harian 00:00 UTC | stop 3·ATR; keluar saat tanda berbalik |
| H5a/b | Kompresi volatilitas: NATR ≤ persentil 20% (120 candle) lalu close menembus range 20 candle | stop 1.5·ATR; target 2R / 3R; maks 72 jam |
| H6a/b | Momentum lintas-pair mingguan (Senin 00:00 UTC): long 3 terkuat, short 3 terlemah menurut return 7 / 28 hari | stop 3·ATR; tahan 7 hari |
| H7a/b | Funding kontrarian: funding ≥ +0.05% / +0.10% per 8 jam → short; ≤ −0.05% / −0.10% → long | stop 2·ATR; 24 / 72 jam |

Dua cara evaluasi: (1) **per pair** (satu posisi per pair, tanpa batas jumlah pair) = edge mentah generator; (2) **portofolio mandat §6** (≤3 posisi, risiko 1%/trade, terbuka ≤3%, gross ≤1×). Syarat lulus = §14.6 (biaya 18 bps + funding: R ≥ +0.05 dengan t ≥ 2, positif setiap tahun, drawdown portofolio ≤ 25%).

### 15.2 Hasil (biaya 18 bps + funding)

| Kode | Konfigurasi | Rezim | n per pair | R per pair (t) | n portofolio | R portofolio (t) | Portofolio 2024 / 2025 / 2026 | DD | Lulus |
|---|---|---|---:|---:|---:|---:|---|---:|:-:|
| H1a | Breakout PRD, exit PRD | — | 2729 | −0.013 (−0.73) | 1708 | −0.013 (−0.55) | −0.037 / +0.001 / −0.003 | 58% | tidak |
| H1b | Breakout PRD, trailing 3ATR ≤7 hari | — | 2217 | −0.048 (−1.19) | 787 | −0.055 (−0.88) | +0.015 / −0.086 / −0.095 | 93% | tidak |
| H2a | Pullback PRD, exit PRD | — | 3739 | −0.034 (−2.12) | 1832 | +0.003 (0.13) | +0.058 / −0.021 / −0.026 | 62% | tidak |
| H2b | Pullback PRD, trailing 3ATR ≤7 hari | — | 2720 | +0.009 (0.24) | 775 | −0.012 (−0.18) | +0.172 / −0.130 / −0.044 | 89% | tidak |
| H3a | Donchian 20 hari, exit kanal 10 hari | — | 1314 | −0.018 (−0.18) | 263 | −0.115 (−0.66) | +0.048 / −0.314 / −0.068 | 51% | tidak |
| H3b | Donchian 55 hari, exit kanal 20 hari | — | 641 | +0.030 (0.24) | 160 | +0.216 (0.63) | +0.826 / −0.378 / +0.212 | 33% | tidak |
| H4a | TSMOM 30 hari, flip harian | — | 2879 | −0.031 (−0.76) | 159 | +0.065 (0.33) | +0.295 / +0.263 / −0.301 | 29% | tidak |
| H4b | TSMOM 60 hari, flip harian | — | 2088 | +0.045 (0.75) | 122 | +0.007 (0.03) | +0.604 / +0.166 / −0.604 | 34% | tidak |
| H5a | Squeeze, target 2R ≤72j | — | 2980 | +0.038 (1.53) | 912 | +0.061 (1.36) | +0.193 / +0.087 / −0.104 | 57% | tidak |
| H5b | Squeeze, target 3R ≤72j | — | 2770 | +0.051 (1.72) | 806 | +0.068 (1.28) | +0.261 / +0.105 / −0.162 | 64% | tidak |
| H6a | XS-momentum 7 hari, top/bottom 3, tahan 7 hari | — | 814 | −0.013 (−0.28) | 408 | −0.095 (−1.59) | +0.055 / −0.110 / −0.240 | 49% | tidak |
| H6b | XS-momentum 28 hari, top/bottom 3, tahan 7 hari | — | 813 | +0.037 (0.77) | 408 | −0.024 (−0.35) | −0.032 / −0.029 / −0.008 | 31% | tidak |
| H7a | Funding ±0.05%/8j kontrarian, 24j | — | 669 | −0.036 (−1.31) | 357 | −0.015 (−0.39) | −0.004 / −0.034 / −0.032 | 9% | tidak |
| H7b | Funding ±0.10%/8j kontrarian, 72j | — | 103 | −0.034 (−0.34) | 74 | −0.032 (−0.24) | −0.083 / +0.226 / −0.033 | 9% | tidak |
| H1a | Breakout PRD, exit PRD | searah BTC | 1391 | +0.014 (0.54) | 851 | +0.025 (0.73) | +0.002 / +0.031 / +0.047 | 32% | tidak |
| H1b | Breakout PRD, trailing 3ATR ≤7 hari | searah BTC | 1209 | −0.068 (−1.31) | 510 | +0.007 (0.09) | +0.031 / −0.136 / +0.180 | 67% | tidak |
| H2a | Pullback PRD, exit PRD | searah BTC | 1988 | −0.014 (−0.63) | 951 | +0.043 (1.31) | +0.112 / +0.018 / −0.003 | 34% | tidak |
| H2b | Pullback PRD, trailing 3ATR ≤7 hari | searah BTC | 1655 | −0.055 (−1.17) | 555 | −0.028 (−0.36) | +0.185 / −0.193 / −0.055 | 73% | tidak |
| H3a | Donchian 20 hari, exit kanal 10 hari | searah BTC | 837 | +0.003 (0.02) | 227 | −0.162 (−0.79) | −0.054 / −0.386 / −0.039 | 49% | tidak |
| H3b | Donchian 55 hari, exit kanal 20 hari | searah BTC | 401 | −0.143 (−1.06) | 135 | −0.302 (−1.32) | +0.029 / −0.463 / −0.448 | 49% | tidak |
| H4a | TSMOM 30 hari, flip harian | searah BTC | 1917 | +0.001 (0.03) | 145 | +0.408 (1.25) | +1.510 / −0.073 / −0.072 | 15% | tidak |
| H4b | TSMOM 60 hari, flip harian | searah BTC | 1369 | +0.090 (1.14) | 110 | +0.185 (0.58) | +1.056 / +0.048 / −0.421 | 25% | tidak |
| H5a | Squeeze, target 2R ≤72j | searah BTC | 1306 | +0.043 (1.16) | 457 | +0.031 (0.50) | +0.153 / +0.012 / −0.076 | 35% | tidak |
| H5b | Squeeze, target 3R ≤72j | searah BTC | 1239 | +0.048 (1.09) | 412 | +0.045 (0.60) | +0.251 / +0.063 / −0.204 | 56% | tidak |
| H6a | XS-momentum 7 hari, top/bottom 3, tahan 7 hari | searah BTC | 249 | −0.067 (−0.92) | 249 | −0.067 (−0.92) | −0.214 / −0.009 / +0.083 | 30% | tidak |
| H6b | XS-momentum 28 hari, top/bottom 3, tahan 7 hari | searah BTC | 249 | +0.048 (0.59) | 249 | +0.048 (0.59) | −0.058 / +0.120 / +0.117 | 17% | tidak |
| H7a | Funding ±0.05%/8j kontrarian, 24j | searah BTC | 186 | −0.092 (−1.75) | 107 | +0.022 (0.32) | +0.054 / −0.006 / −0.050 | 6% | tidak |
| H7b | Funding ±0.10%/8j kontrarian, 72j | searah BTC | 43 | −0.069 (−0.45) | 25 | +0.023 (0.10) | −0.139 / −0.533 / +0.465 | 4% | tidak |

**Tidak ada satu pun dari 28 konfigurasi yang lulus.** Pola yang konsisten: hampir semua keluarga pengikut tren dan breakout positif pada 2024 (BTC +121%), lalu melemah atau negatif pada 2025 (BTC −6%) dan 2026 (BTC −6% s.d. Okt). Label struktur BTC berada di `TRANSITION` 39% (2024), 45% (2025), dan 41% (2026) waktu.

### 15.3 Kandidat paling konsisten dan uji ketahanannya

H1a dengan lapis rezim BTC (generator Breakout PRD + gate arah pair + searah struktur BTC + exit PRD, tanpa ranking M6) adalah satu-satunya konfigurasi yang **positif di ketiga tahun pada evaluasi per pair maupun portofolio**, di biaya 9 bps (portofolio +0.049R, t 1.42) dan 18 bps (+0.025R, t 0.73). Uji ketahanan pada 18 bps:

| Uji | Hasil |
|---|---|
| Biaya 25 bps | +0.007R (t 0.19); 2024 negatif |
| Stop 1.0 / 2.0·ATR | −0.020R / +0.028R; tidak konsisten 3/3 |
| Target 1.5R / 3R | +0.035R / +0.048R; target 3R negatif 2024 |
| Horizon 12 / 48 jam | −0.016R / +0.008R |
| Konsentrasi pair | Total +21.5% ekuitas acuan; DOGEUSDT (+12.3%) dan ORDIUSDT (+7.3%) menyumbang 91%; tanpa keduanya +2.0%; hanya 16 dari 30 pair positif |

**Kesimpulan:** kandidat ini **tidak tahan** perubahan parameter tetangga, biaya, maupun penghapusan dua pair; tidak memenuhi §14.6.

### 15.4 Kesimpulan Tahap A2 dan rekomendasi

1. **Belum ditemukan edge yang memenuhi syarat** pada 4H untuk 30 pair USDⓈ-M paling likuid periode 2024–2026, baik dari generator PRD yang diperbaiki maupun dari enam keluarga generator baru. Penggunaan uang nyata (Tahap B dengan order sungguhan) **tidak direkomendasikan**.
2. **Lapis rezim BTC** tetap satu-satunya komponen yang konsisten memperbaiki kestabilan antartahun (§14.3 D2–D4, §15.3) dan layak dibawa ke **paper forward test** bersama generator Breakout PRD tanpa ranking M6 — sebagai pengumpulan data, bukan sinyal trading.
3. **Biaya eksekusi** menentukan: kandidat terbaik turun dari +0.049R (9 bps) ke +0.007R (25 bps). Eksekusi maker/limit adalah prasyarat bagi strategi apa pun di kelas ini.
4. **Posisi aplikasi saat ini** sebaiknya dinyatakan sebagai **alat bantu screening dan analisis** (menyaring setup, struktur, risiko, dan konteks pasar untuk keputusan manusia), bukan generator sinyal otomatis.
5. **Arah riset berikutnya** (masing-masing wajib protokol §14.1 dan hipotesis dikunci lebih dulu): (a) strategi untuk rezim `TRANSITION`/range, karena 40–45% waktu pasar berada di rezim ini dan semua generator tren gagal di sana; (b) timeframe harian dengan universe yang sama untuk menambah horizon dan menurunkan porsi biaya per trade; (c) memperpanjang data ke 2022–2023 bila arsip tersedia, untuk menambah siklus pasar.
6. **Peringatan uji berganda:** 28 konfigurasi diuji. Hasil positif tunggal (mis. t ≈ 2 pada satu tahun) wajar muncul secara kebetulan dan tidak boleh dijadikan dasar keputusan tanpa konsistensi antartahun dan uji ketahanan.

**Reproduksi:** `node scripts/backtest/a2.js <data/bt> 30` → `results/tahap-a2/summary.json`.

## 16. Lapisan penggunaan nyata: rencana siap salin dan label rezim BTC (v1.0.11)

**Keputusan pengguna (11 Okt 2026):** aplikasi dipakai dengan **uang nyata** atas keputusan dan tanggung jawab pengguna, walaupun §14–§15 belum menemukan edge yang memenuhi syarat. Bagian ini hanya menambah **lapisan tampilan** untuk eksekusi manual; aturan normatif §1–§13 (generator, skor M1–M6, gate, keputusan, record §10, portofolio simulasi §6) **tidak berubah**. Tidak ada pengiriman order dan tidak ada API key. **Kill switch tidak diterapkan** (keputusan pengguna); acuan kondisi buruk normal dari backtest (§15, Breakout + rezim BTC, 18 bps): kalah beruntun terpanjang 10, drawdown terburuk ≈ 32% pada risiko 1% per trade.

### 16.1 R32 — Rencana eksekusi siap salin

**Data (publik, tanpa API key).** `GET /fapi/v1/exchangeInfo` ditambahkan ke daftar putih transport. Per pair aplikasi diambil `tickSize` (`PRICE_FILTER`), `stepSize`/`minQty`/`maxQty` (`LOT_SIZE`), minimum notional (`MIN_NOTIONAL.notional`), dan `status`. Diambil saat aplikasi dibuka dan diperbarui tiap 24 jam (gagal → dicoba ulang 30/60/120 detik, lalu tiap 10 menit). Field tidak sah atau hilang → pair **tanpa aturan**; tidak ada nilai tebakan.

**Input pengguna** (tersimpan hanya di browser perangkat itu):

| Input | Default | Batas sah |
|---|---|---|
| Modal alokasi (USDT) | kosong, wajib | > 0 |
| Risiko per trade | 0,5% | 0,5% – 1% |
| Perkiraan biaya round-trip | 18 bps | 0 – 50 bps |

Leverage **bukan input**; dihitung otomatis per sinyal.

**Perhitungan** (dasar: `entry_reference_open`, `stop_price`, `target_price` record §6):

1. **Pembulatan ke kelipatan `tickSize` ke arah aman.** LONG: entry, stop, dan target dibulatkan ke bawah; SHORT: ke atas. Akibatnya entry limit tidak lebih mahal dari rencana, stop menjauh dari entry, dan target mendekat ke entry. Aritmetika memakai bilangan bulat kelipatan tick; nilai yang sudah tepat di grid tidak digeser oleh galat float (toleransi beberapa ulp, jauh di bawah satu tick).
2. **Qty** = `floor_step( modal × risiko% ÷ (|entry − stop| + biaya × max(entry, stop)) )`. Rugi bila SL kena, termasuk biaya, tidak pernah melebihi `modal × risiko%`.
3. **Leverage maksimum aman** `L = floor(1 ÷ (2 × jarak_stop + MMR))`, minimal 1×, maksimal batas pribadi pengguna (BTC 150×, ETH 125×, alt 50×). Menjamin perkiraan jarak likuidasi `1/L − MMR ≥ 2 × jarak_stop`. MMR adalah asumsi konservatif (BTC 0,4%, ETH 0,5%, alt 1%) karena nilai pasti hanya tersedia lewat endpoint berkunci; angka likuidasi selalu berlabel **perkiraan**.
4. **Margin** = notional ÷ L.
5. **Tidak bisa dieksekusi** bila qty < `minQty`, qty > `maxQty`, notional < minimum notional, margin > modal, atau urutan SL/entry/TP tidak sah setelah pembulatan. Pair dengan `status ≠ TRADING` → "Pair tidak sedang diperdagangkan".

**Status tampilan:** `READY` (siap salin) · `UNROUNDED` (aturan pair tidak tersedia: angka mentah, tanpa tombol salin) · `NEED_SETTINGS` · `INVALID_SETTINGS` · `NOT_EXECUTABLE` · `PAIR_NOT_TRADING` · `NO_PLAN`.

**Tampilan.** Panel "Rencana siap salin" pada kartu Decision posisi berjalan dan tab Rencana untuk record `ENTRY_CONSIDER` — **semua keluarga sinyal termasuk Reversal**. Isi: entry limit, SL, TP, qty (masing-masing dengan tombol salin), leverage maksimum aman, margin dan notional, rugi bila SL kena (USDT dan % modal, termasuk biaya), untung bila TP kena (setelah biaya), RR, jarak SL, dan perkiraan jarak/harga likuidasi. Catatan tetap: "Set leverage di Binance ≤ L×. Pasang limit order; bila tidak terisi, lewati — jangan kejar dengan market order. Rencana ini tidak mengirim order."

### 16.2 R33 — Label rezim BTC (informatif, bukan gate)

Sumber: label struktur M1 BTCUSDT (pivot terkonfirmasi s.d. candle konfirmasi) pada close yang sama dengan sinyal — definisi identik dengan lapis rezim §15.

| Kondisi | Label |
|---|---|
| LONG + BTC `BULLISH`, atau SHORT + BTC `BEARISH` | Searah BTC |
| Arah sinyal berlawanan dengan struktur BTC | Berlawanan dengan BTC |
| BTC `TRANSITION` | BTC transisi |
| Data BTC tidak mencakup close itu, atau swing belum cukup | Rezim BTC: — |
| Sinyal pada BTCUSDT | tidak ditampilkan |

Label **tidak** mengubah status, skor, ranking M6, alasan penolakan, maupun record audit; altcoin dapat bergerak tanpa mengikuti BTC. Filter tampilan opsional "Searah BTC saja" hanya menyaring daftar kandidat. Catatan di kartu: backtest 2024–2026 menunjukkan sinyal searah BTC rata-rata lebih baik di ketiga tahun, tetapi belum signifikan secara statistik.

### 16.3 Yang tidak berubah dan tes

Tidak berubah: generator, skor M1–M6, Reversal tetap aktif, ranking M6, gate, record §10, replay portofolio §6 (ekuitas acuan 100, float64), paritas 772/772. Tes wajib sebelum deploy (`scripts/test-exec.js`, `scripts/test-browser.js`): pembulatan empat arah pada berbagai ukuran tick; 5.000 kasus acak (risiko nyata ≤ batas, kelipatan tick/step tepat, arah pembulatan, likuidasi ≥ 2× jarak SL) dan 20.000 kasus pembulatan nilai besar; contoh hitung manual; penolakan minimum notional/minQty/margin/geometri/status pair; validasi input; parser `exchangeInfo` (format resmi dan varian gabungan); lima kondisi label rezim BTC dan kesamaannya dengan definisi §15; record audit tidak berubah; tes browser desktop dan mobile (panel, tombol salin, penyimpanan pengaturan, filter, `exchangeInfo` gagal).

## 17. Universe dinamis 100 pair (v1.0.12)

**Keputusan pengguna (11 Okt 2026):** pair yang dihitung dan ditampilkan aplikasi live adalah **100 pair dengan volume perdagangan harian tertinggi**, ditetapkan ulang setiap **close candle harian 08:00 WITA (00:00 UTC)**, sebagai **hard gate**. Tujuan pengguna: menilai sendiri skor setiap pair — karena itu **bobot dan rumus M1–M6 tidak diubah**; setiap pair dihitung dengan rumus yang persis sama dan menghasilkan skor sesuai datanya sendiri.

### 17.1 R34 — Penetapan universe

1. **Kontrak yang boleh diranking** (dari `/fapi/v1/exchangeInfo`, publik): kontrak perpetual, quote USDT, status `TRADING`, base bukan stablecoin (USDC, FDUSD, TUSD, BUSD, USDP, DAI, USDE, PYUSD, USD1, RLUSD, USDS, EURI, AEUR, XUSD, BFUSD, USDF), underlying bukan indeks.
2. **Volume yang diranking:** quote volume (USDT) **candle harian yang baru close pada 00:00 UTC** (`/fapi/v1/klines` interval 1d, publik). Agar permintaan terbatas, candle harian hanya diambil untuk 150 pair eligible dengan volume 24 jam berjalan tertinggi (`/fapi/v1/ticker/24hr`, publik); ranking final tetap berdasarkan candle harian yang sudah close.
3. **Ranking:** volume harian ↓; seri → simbol ↑; ambil 100 teratas. Pair tanpa candle harian penuh untuk hari itu (mis. listing baru) tidak ikut ranking hari itu.
4. **Berlaku** sejak close 00:00 UTC sampai close harian berikutnya; disimpan di browser untuk hari yang sama sehingga membuka ulang aplikasi tidak mengunduh ulang.
5. **Wajib lengkap:** bila satu saja permintaan candle harian kumpulan kandidat gagal setelah dicoba ulang, ranking hari itu **tidak** ditetapkan (tanpa tebakan). Aplikasi memakai daftar terakhir yang tersimpan (diberi peringatan "memakai daftar tanggal …"), atau bila tidak ada, hanya enam pair inti (peringatan), dan mencoba ulang tiap 5 menit.

### 17.2 Hard gate dan perhitungan

- **Gate:** untuk close 4H sejak 00:00 UTC hari berjalan, hanya pair dalam universe yang diteruskan ke penentuan keputusan (§8–§9). Pair di luar universe tidak dihitung, tidak tampil di Siklus 4H, Papan Event, maupun Konteks Pasar.
- **Rumus tidak berubah:** generator, M1, M2, M4, M5, gate arah/integritas/risiko, tie-break §8.1.5, dan kontrak §10 identik. **M3 tetap basket enam pair §1** (§5): nilainya sama untuk semua kandidat pada close yang sama — perbedaan M6 antarpair berasal dari M1 dan kualitas M2 (§8.3).
- **Posisi berjalan:** pair yang keluar dari universe tetap diunduh dan dipantau sampai slot 24 jamnya selesai, tetapi tidak menghasilkan keputusan baru.
- **Riwayat replay (perkiraan):** daftar universe historis per hari tidak tersedia dari API; replay portofolio simulasi §6 untuk close sebelum hari berjalan memakai semua pair yang diunduh saat ini (universe hari ini + enam pair inti + posisi berjalan). Keputusan pada close hari berjalan memakai gate yang tepat.
- **Data:** unduhan penuh 1.500 candle 4H per pair saat pertama dibuka; siklus berikutnya cukup 10 candle terakhir yang digabung (celah tetap terdeteksi, tidak diisi). FETCH_FAILED tetap mengikuti §1 untuk seluruh pair yang diunduh.
- **Perhitungan di Web Worker:** engine yang sama dijalankan di luar thread tampilan agar 100 pair tidak membekukan layar; bila worker tidak tersedia, dihitung di thread utama. Keluaran identik (tes).

### 17.3 Penyesuaian R32 untuk pair kecil

Pair dengan peringkat volume di atas 30 (atau peringkat tidak diketahui) memakai asumsi MMR 2,5% dan batas leverage 20× (BTC/ETH tetap §16.1). Ini hanya membuat leverage maksimum aman lebih kecil; qty, risiko per trade, dan skor tidak berubah.

### 17.4 Batas bukti

Tahap A/A2 (§14–§15) hanya menguji 30 pair teratas; pair peringkat 31–100 **belum diuji** dan umumnya memiliki spread serta slippage lebih besar. Kalibrasi ECDF beku berasal dari enam pair 2024; untuk pair lain penerapannya ekstrapolasi. Hal ini tidak mengubah skor, tetapi wajib diingat saat menilai hasil.

### 17.5 Tes

`scripts/test-universe.js`: filter kontrak (stablecoin, indeks, non-perpetual, non-TRADING), kumpulan kandidat, volume candle harian 00:00 UTC, ranking & tie-break, batas hari 08:00 WITA; **invarian skor** — setiap event pair inti memiliki M1/M2/M3/M5 identik dihitung bersama enam pair maupun bersama universe, dan skor pair tambahan identik bila dihitung terpisah; M3 tetap basket enam pair; hard gate per close; keluaran Web Worker identik. `scripts/test-browser.js`: universe tiruan (stablecoin bervolume raksasa tersaring, pair non-TRADING tidak diunduh), peringkat tampil, kegagalan ranking → cadangan + peringatan. `scripts/test-browser-live.js` dengan kline 4H ASLI arsip data.binance.vision (20 pair di CI): universe dari volume harian asli, record browser identik dengan engine Node.

## 18. Tiga layar penggunaan nyata: Decision, Semua Pair, Jurnal (v1.0.13)

**Keputusan pengguna (12 Okt 2026, Tahap 1):** aplikasi disederhanakan untuk trading dengan uang nyata. **Referensi UI/UX enam layar digantikan** oleh tiga layar di bawah. Rumus, bobot, generator, gate, dan kontrak §1–§13 **tidak berubah**. Tahap 2 (skor untuk semua 100 pair dan nilai skor layak untuk Decision) adalah riset terpisah yang wajib dirancang, diuji backtest, dan disetujui pengguna sebelum dipakai.

### 18.1 R35 — Universe realtime (mengganti ranking harian §17.1)

- **Sumber:** stream publik semua pair (statistik 24 jam berjalan, diperbarui ±1 detik) dengan snapshot awal dari ticker 24 jam REST; tanpa API key. Satu koneksi memberi harga terakhir dan volume 24 jam semua pair.
- **Ranking:** kontrak yang sama dengan §17.1 butir 1 (perpetual, USDT, TRADING, bukan stablecoin/indeks); urut quote volume 24 jam berjalan ↓, seri → simbol ↑; 100 teratas. Diperbarui setiap 5 detik di layar.
- **Gate keputusan:** pada setiap close 4H, daftar 100 pair saat itu **dibekukan sebagai snapshot** dan menjadi hard gate keputusan close tersebut (disimpan di browser, dipakai ulang bila aplikasi dibuka ulang dalam siklus yang sama). Pair yang masuk 100 besar di tengah siklus diunduh di latar dan ikut keputusan mulai close berikutnya.
- Pair penentu keputusan (snapshot + enam pair inti + pair dengan Decision berjalan) yang gagal diunduh — termasuk yang gagal sejak percobaan pertama — menahan keputusan lintas pair sesuai §1.

### 18.2 R35 — Layar Decision (hard gate, skor dikunci)

- **Isi:** setiap pair berstatus layak dipertimbangkan (seluruh gate PRD lolos, termasuk slot dan risiko portofolio simulasi §6) yang slot 24 jamnya masih berjalan. Urutan: close terbaru, lalu M6.
- **Skor dikunci:** saat pertama kali terlihat, record dibekukan ke **ledger** di browser: M1, M2 kualitas, M2, M3, M4, M5, M6, M1+M2q, harga entry/SL/TP, waktu, peringkat volume pada snapshot, label rezim BTC, invalidasi, versi. Entri **tidak pernah ditimpa** oleh refresh data, pergantian universe, atau replay ulang; yang boleh berubah hanya hasil selama masih berjalan.
- **Sumber entri:** live (dibekukan pada siklus close-nya) atau replay (sinyal lampau yang pertama terlihat lewat replay saat aplikasi dibuka); diberi label.
- **Kartu:** skor terkunci, harga live dan R, progres SL→entry→TP, rencana siap salin (R32), label rezim BTC (R33), OI, CVD, orderbook, dan peringatan invalidasi.
- **Belum ada batas skor layak.** Backtest Tahap A menunjukkan urutan M6 setara acak; batas hanya dipasang bila riset Tahap 2 menemukan nilai yang konsisten di 2024, 2025, dan 2026.

### 18.3 R35 — Layar Semua Pair

Tabel universe realtime: peringkat, pair, harga, perubahan 24 jam, volume 24 jam, struktur M1 dan skor M1 pada candle 4H terakhir yang close (rumus §3, identik untuk semua pair), status (Decision / setup menunggu / tidak ada), dan M6 bila pair ada di Decision. Filter struktur & status, pencarian, urut volume atau M1. M6 untuk pair tanpa sinyal tetap tidak ada (null, bukan 0) — skor per pair untuk semua 100 pair adalah riset Tahap 2.

### 18.4 R35 — Layar Jurnal Sinyal

- **Isi per sinyal selesai:** waktu keputusan (UTC + WITA), pair, peringkat volume, arah, keluarga, sumber, skor terkunci (M1, M2 kualitas, M1+M2q, M2–M6), label rezim BTC, struktur M1, entry, SL, TP, RR, hasil (kena TP / kena SL / keluar 24 jam / data tidak ada), waktu keluar, harga keluar, R, durasi, invalidasi.
- **Aturan hasil (sama dengan §6):** candle 4H yang sudah close dalam 24 jam sejak entry; SL dievaluasi lebih dahulu bila SL dan TP tersentuh di candle yang sama; tanpa keduanya → keluar pada close candle ke-6. Hasil final tidak berubah lagi. Bila candle pair tidak lagi tersedia dan 48 jam sudah lewat → "data tidak ada" (bukan tebakan).
- **Ringkasan dan filter:** jumlah kena TP / kena SL / keluar 24 jam, rata-rata R; filter pair, arah, keluarga, hasil, sumber, rentang M6.
- **Unduh CSV** (UTF-8, kolom tetap) untuk evaluasi pengguna. Hasil adalah hasil sinyal menurut candle Binance, bukan fill order akun pengguna.
- Ledger dibatasi 5.000 entri terbaru; disimpan hanya di browser perangkat itu.

### 18.5 Yang dihapus

Layar Siklus 4H (tabel kandidat), inspektor beserta tab Skor/Rencana/Audit/JSON, Papan Event, Portofolio Simulasi (kartu Decision dipindah ke layar Decision), Konteks Pasar, Audit & Data, deretan tahapan pipeline, dan **unduh log audit**. Seluruh perhitungan di baliknya tetap berjalan.

### 18.6 Tes

`scripts/test-ledger.js`: pembekuan hanya status layak dipertimbangkan; entri tidak pernah ditimpa; hasil SL-lebih-dahulu/TP/horizon dan harga keluar; hasil final tetap; "data tidak ada"; ringkasan, filter M6, CSV (escape, BOM, WITA), pemuatan aman, batas 5.000; hasil ledger identik dengan hasil engine §6. `scripts/test-universe.js`: ranking 24 jam berjalan, stream semua pair (seed, pembaruan, watchdog), regresi FETCH_FAILED pair tanpa data. `scripts/test-browser.js` (desktop + mobile): kartu Decision = ledger engine, rencana siap salin, **skor dikunci** setelah seluruh candle diubah dan dihitung ulang (engine memang menghasilkan skor lain, entri ledger tidak berubah), Semua Pair (M1 = engine, filter, urut), Jurnal (ringkasan, filter, CSV), layar lama terhapus, skenario FETCH_FAILED / universe gagal / exchangeInfo gagal / CLOSE_CANDIDATE. `scripts/test-browser-live.js` dengan kline 4H asli 20 pair: record dan ledger browser identik dengan Node.

### 18.7 R36 — Koreksi pengguna (v1.0.14)

1. **Jurnal = hanya sinyal yang masuk Decision.** Ledger membekukan record layak dipertimbangkan **hanya untuk close yang sedang berjalan** saat aplikasi menghitungnya. Sinyal close sebelumnya yang terlihat lewat replay tidak dicatat. Konsekuensinya: bila aplikasi tidak dibuka selama satu siklus 4H, sinyal siklus itu tidak tercatat. Entri berlabel replay dari versi 1.0.13 dibuang saat dimuat; kolom dan filter "sumber" dihapus.
2. **Simpan pengaturan.** Isian modal, risiko, dan biaya disimpan ke draf saat diketik dan **baru berlaku setelah tombol Simpan ditekan** serta lolos validasi §16.1. Status selalu terlihat — di judul form (badge) dan di bawah tombol: tersimpan (beserta nilai dan waktunya), belum disimpan, belum ada pengaturan, isian tidak sah (tidak disimpan), atau gagal menyimpan di browser. Tombol Batalkan mengembalikan draf ke nilai tersimpan.
3. **Tes:** ledger (hanya close berjalan, migrasi entri replay, hasil = engine bila aplikasi selalu terbuka); browser (isian tidak sah tidak tersimpan, status belum disimpan, rencana tetap memakai nilai tersimpan sampai Simpan ditekan, status tetap setelah reload, pertama dibuka tanpa replay, migrasi).

## 19. Mandat risiko LIVE, TP1/TP2, dan panel risiko portofolio (v1.0.15)

Keputusan pengguna 12 Oktober 2026 untuk penggunaan uang nyata. Bagian ini **tidak mengubah** bobot Tabel 1, rumus M1–M6, rumus M4 (`40·D + 35·P + 25·N`), gate arah/integritas/bentrok, ataupun ranking M6. Yang berubah hanya parameter kapasitas portofolio dan aturan exit yang dipakai aplikasi live.

### 19.1 R37 — Mandat risiko LIVE

| Parameter | Mandat riset §6 (`RESEARCH_1_3_1X_V1`, tetap untuk reproduksi riset) | Mandat LIVE aplikasi (`LIVE_10P_1PCT_TP2R3R_V1`) |
|---|---|---|
| Posisi bersamaan maksimal | 3 | **10** |
| Risiko per trade | 1% | **1%** |
| Risiko terbuka maksimal | 3% | **10%** |
| Batas notional total / per posisi | 100% ekuitas | **dihapus** (qty = 1% ekuitas ÷ jarak stop) |
| Stop | 1,5 × ATR_entry | 1,5 × ATR_entry |
| Take profit | 2R (seluruh posisi) | **TP1 = 2R (tutup 50%) + TP2 = 3R (tutup 50% sisa)** |
| Stop setelah TP1 | — | **tetap di tempat** (tidak dipindah ke entry) |
| Horizon / slot | 24 jam | 24 jam |

1. Bila lebih dari 10 sinyal lolos gate pada close yang sama, alokasi tetap berurutan menurut ranking M6 §8.1.5; 10 adalah batas, bukan target. Sinyal yang tidak kebagian slot tetap berstatus `REJECTED_RISK` dengan reason `POSITION_OR_RISK_CAP` atau `PAIR_ACTIVE`. Reason `GROSS_CAP` tidak muncul lagi di mandat LIVE.
2. Record keputusan memuat `target2_price`, `rr_target2`, `tp1_fraction`, dan `risk_mandate_version`. `target_price` = TP1.
3. **Hasil (outcome) TP1/TP2**, dihitung dari candle 4H yang sudah close dan dievaluasi stop lebih dahulu pada candle yang sama:
   - `STOP_HIT`: SL sebelum TP1, −1R.
   - `TP1_STOP`: TP1 lalu SL, 0,5·2 − 0,5·1 = **+0,5R**.
   - `TARGET_HIT`: TP1 lalu TP2 (boleh pada candle yang sama), 0,5·2 + 0,5·3 = **+2,5R**.
   - `TP1_HORIZON`: TP1 lalu keluar pada close candle ke-6.
   - `HORIZON_EXIT`: keluar pada close candle ke-6 tanpa TP1.
   
   Entri jurnal lama tanpa TP2 tetap dinilai dengan aturan TP tunggal.
4. **Rencana siap salin** (R32): TP2 dibulatkan ke `tickSize` ke arah aman (mendekat ke entry). Qty total dibagi dua: qty TP1 = floor(qty × 50%) ke `stepSize`, qty TP2 = sisa. Kedua bagian wajib memenuhi qty minimum dan notional minimum pair; bila tidak, statusnya `NOT_EXECUTABLE` dengan alasan `SPLIT_BELOW_MIN`. Rugi bila SL kena (termasuk biaya) tetap ≤ risiko yang diisi pengguna. Risiko default pengaturan = 1%.
5. **Panel risiko portofolio** di layar Decision. Panel ini hanya peringatan: tidak memblokir sinyal, tidak mengubah skor, dan tidak ada kill switch. Isinya:
   - posisi aktif / 10;
   - risiko terbuka, yaitu jumlah bagian posisi yang masih menanggung SL × risiko tersimpan, dibanding batas 10%;
   - drawdown dari puncak kurva hasil kumulatif jurnal (tanpa kompaun), dibanding titik evaluasi 20% dan batas rugi 50% yang ditetapkan pengguna;
   - hasil kumulatif jurnal.
   
   Semua angka dihitung dari jurnal Decision dengan anggapan setiap sinyal diambil. Ini bukan saldo akun Binance.
6. **Perbaikan hasil jurnal.** Pair yang hasilnya belum final tetap diunduh walaupun keluar dari 100 besar atau slot 24 jamnya sudah lewat. Status "data tidak ada" hanya diberikan bila candle di jendela 24 jam memang hilang padahal data sudah melewati jendela itu, atau entry lebih tua dari jangkauan unduhan (≈240 hari). Data yang sekadar belum terunduh tidak lagi menjadi "data tidak ada" setelah 48 jam.

### 19.2 Hasil uji data asli sebelum keputusan (dicatat apa adanya)

Uji memakai kline 4H dan funding asli Binance, Februari 2024 – Oktober 2026, 30 pair paling likuid + 6 pair inti, ranking M6, risiko 1%, hasil dijumlahkan tanpa kompaun (% ekuitas). Pengecekan alat: baris "sekarang" identik dengan Tahap A §14.

| Aturan (biaya 9 bps) | Trade | R rata-rata | Total | Drawdown maks | Hari terburuk |
|---|---|---|---|---|---|
| 3 posisi, TP 2R, gross ≤100% (mandat riset) | 2.234 | +0,032 | +72% | 36% | −3,1% |
| 3 posisi, TP1 2R/TP2 3R 50/50, SL tetap | 2.320 | +0,035 | +81% | 46% | −3,2% |
| 5 posisi, TP 2R | 3.443 | +0,000 | +1% | 81% | −5,3% |
| 10 posisi, TP 2R | 4.880 | +0,003 | +13% | 121% | −10,4% |
| **10 posisi, TP1 2R/TP2 3R 50/50, SL tetap (dipilih)** | 4.880 | +0,010 | +47% | 120% | −10,4% |
| 10 posisi, TP1/TP2, SL pindah ke entry setelah TP1 | 4.880 | −0,005 | −24% | 127% | −10,4% |

Dengan biaya 18 bps, semua varian 10 posisi negatif. Contohnya, aturan yang dipilih: R −0,014, total −68%, drawdown 163%. Per tahun, aturan yang dipilih menghasilkan 2024 +0,051R, 2025 +0,004R, dan 2026 −0,027R pada biaya 9 bps. Temuan ini disampaikan kepada pengguna sebelum keputusan; pengguna tetap memilih 10 posisi dengan syarat sinyal tetap melewati pembobotan dan gate yang sama. Drawdown di atas 50% berarti batas rugi pengguna terlampaui dalam backtest. Panel risiko (butir 5) menampilkan jarak ke batas itu secara langsung.

Verifikasi engine aplikasi atas data yang sama:
- mandat LIVE menghasilkan 4.880 sinyal Decision dengan **maksimal tepat 10 posisi** dan **risiko terbuka maksimal tepat 10%**;
- jumlah sinyal identik dengan simulasi independen;
- 2.010 sinyal yang ada di kedua mandat memiliki **skor identik (0 berbeda)**;
- hasil jurnal (ledger) identik dengan hasil engine untuk seluruh 4.880 sinyal.

### 19.3 Tes

`scripts/test-app.js` (R37):
- default aplikasi = mandat LIVE, dan mandat riset tidak berubah;
- **pembobotan tidak berubah**: record, M1/M2/M3/M5, ranking, dan M6 identik dengan mandat riset;
- portofolio LIVE: ≤10 posisi, risiko terbuka ≤10%, 1% per trade, tanpa `GROSS_CAP`, TP1 = 2R, TP2 = 3R, qty tanpa batas notional;
- setara dengan replay engine bermandat LIVE;
- outcome TP1/TP2 untuk LONG dan SHORT, plus posisi lama tanpa TP2.

`scripts/test-exec.js`:
- contoh manual TP1/TP2;
- `SPLIT_BELOW_MIN` dan geometri;
- 3.000 rencana acak: semua harga kelipatan tick, qty TP1 + TP2 = qty, rugi ≤ anggaran, urutan TP benar.

`scripts/test-ledger.js`:
- TP1/TP2 di jurnal (TP1 tercatat walau sisa berjalan, +0,5R / +2,5R, teks, kolom CSV);
- aturan "data tidak ada" baru.

`scripts/test-browser.js`:
- kartu menampilkan TP1/TP2;
- rencana TP1/TP2 = engine;
- panel risiko = hitungan independen dari jurnal, untuk risiko default dan risiko tersimpan.

## 20. Posisi nyata pengguna: Saya ambil, posisi manual, panel risiko (v1.0.16)

Keputusan pengguna 12 Oktober 2026. Aplikasi tetap tanpa API key dan tanpa order, sehingga tidak bisa melihat akun Binance. Semua data di bagian ini adalah **catatan yang diisi pengguna**. Bagian ini tidak mengubah bobot, rumus skor M1–M6, gate, ranking, harga sinyal, maupun hasil sinyal di jurnal.

### 20.1 R38 — Saya ambil

1. Setiap kartu Decision punya tombol **Saya ambil**. Lembar isian terisi otomatis dari rencana siap salin (entry dan qty yang sudah dibulatkan). Pengguna mengubahnya bila order terisi di harga atau qty lain. Syarat: entry > 0 dan qty > 0, dan entry tidak boleh sudah melewati SL.
2. Yang disimpan hanya field tambahan `taken` = {waktu, entry, qty} pada entri jurnal. SL, TP1, TP2, skor, dan hasil sinyal tetap dari sinyal yang dibekukan. **Batal ambil** menghapus field itu.
3. Untung/rugi posisi diambil, dalam USDT, dihitung untuk setiap bagian qty: (harga keluar sinyal − entry aktual) × qty × arah, dengan TP1/TP2 mengikuti §19, lalu dikurangi biaya bps × notional entry sebagai perkiraan. Hasil "data tidak ada" tidak ditebak.

### 20.2 R38 — Posisi manual

1. Isian: pair (USDT perpetual), arah, entry, SL, TP1 opsional, TP2 opsional (butuh TP1; pembagian 50/50), dan qty. Bila qty kosong, qty dihitung dari risiko% × modal tersimpan ÷ jarak SL. SL dan TP wajib di sisi yang benar.
2. Posisi manual **tidak punya skor** dan diberi label MANUAL.
3. Hasil otomatis dihitung dari candle 4H yang sudah close, **mulai candle pertama yang dibuka setelah posisi dicatat**. Candle tempat posisi dibuka diabaikan karena high/low-nya bisa terjadi sebelum entry. Aturannya: SL dievaluasi lebih dahulu, lalu TP1/TP2, dan SL tetap di tempat setelah TP1. **Tidak ada horizon 24 jam.**
4. Posisi bisa **ditutup sendiri**: sisa qty keluar pada harga yang diisi, defaultnya harga terakhir. **Hapus** dipakai untuk salah input.
5. Candle pair posisi manual tetap diunduh selama posisi terbuka, hanya untuk menghitung hasil. Pair itu tidak ikut gate atau skor.

### 20.3 Panel risiko dan jurnal

1. Panel risiko (§19.1 butir 5) kini dihitung dari **posisi nyata**, yaitu posisi diambil yang masih terbuka ditambah posisi manual:
   - posisi terbuka / 10;
   - risiko terbuka = Σ qty yang masih menanggung SL × jarak entry–SL (setengah qty setelah TP1), dalam USDT dan % modal tersimpan;
   - drawdown dari puncak dan hasil kumulatif dari posisi nyata yang sudah selesai, dalam USDT dan % modal, tanpa kompaun.
   
   Tanpa modal tersimpan, angka persen tampil "—" disertai peringatan. Baris **pembanding** menampilkan angka semua sinyal Malomo seperti di §19, dengan anggapan semuanya diambil. Panel tetap hanya peringatan.
2. Jurnal mendapat:
   - filter **Diambil** (ya/tidak), kolom Diambil beserta hasil USDT, dan kartu ringkasan "Diambil · hasil";
   - kolom CSV `diambil`, `entry_aktual`, `qty_aktual`, `pnl_usdt_perkiraan`.
   
   Posisi manual yang selesai tampil di tabel terpisah **Posisi manual selesai** dengan CSV sendiri. Tabel ini **tidak dicampur** ke statistik sinyal Malomo.
3. Penyimpanan ada di browser perangkat ini: entri jurnal di `malomo_v7_ledger` dan posisi manual di `malomo_v7_manual`.

### 20.4 Tes

`scripts/test-portfolio.js`:
- Saya ambil: validasi, hanya field `taken` yang bertambah, muat ulang, batal;
- untung/rugi USDT (SL, TP1 lalu SL, TP1+TP2, biaya, data tidak ada);
- validasi posisi manual;
- hasil otomatis (candle pembukaan diabaikan, tanpa horizon, TP1 dan TP2 pada candle sama);
- tutup sendiri, hapus, muat ulang aman, CSV;
- angka panel dari posisi nyata;
- filter dan kolom CSV jurnal.

`scripts/test-browser.js`, desktop dan mobile:
- lembar isian Saya ambil terisi dari rencana; qty 0 ditolak; isian tidak terhapus oleh pembaruan per detik;
- tanda Diambil tersimpan;
- angka panel;
- posisi manual dengan SL di sisi salah ditolak, lalu posisi yang sah;
- panel menghitung 2 posisi;
- tutup sendiri: hasil USDT, jurnal manual, CSV;
- filter Diambil;
- batal ambil.

## 21. Detail Pair (v1.0.17)

Keputusan pengguna 12 Oktober 2026. Detail Pair adalah **pelengkap informasi**: tidak menjadi gate, tidak masuk skor M1–M6, dan tidak mengubah keputusan, ranking, rencana, maupun jurnal. Semua data berasal dari endpoint publik Binance USDⓈ-M, tanpa API key dan tanpa order.

### 21.1 R39 — Cara buka dan isi

Panel dibuka dengan mengklik nama pair di kartu Decision, tabel Semua Pair, tabel Jurnal, atau posisi manual. Panel ditutup dengan tombol Tutup, klik di luar panel, atau tombol Escape. Membuka panel tidak memindahkan layar.

1. **Harga & pasar 24 jam:** harga terakhir, % perubahan, high/low, dan volume, semuanya dari stream `!ticker@arr`, plus peringkat volume universe. Diperbarui tiap detik.
2. **Grafik 4H + EMA 21/30/50:**
   - grafik memuat 60 candle close terakhir, dengan nilai EMA, posisi close terhadap tiap EMA, dan susunan EMA (naik / turun / campuran);
   - rumus EMA: EMA_t = α·close_t + (1−α)·EMA_{t−1}, α = 2/(n+1), EMA_0 = close_0, setara pandas `ewm(span=n, adjust=False)`;
   - hanya candle yang **sudah close** yang dipakai;
   - nilai EMA dianggap matang setelah ≥ 3n candle; kurang dari itu tampil "—", bukan 0;
   - sumber candle: candle yang sudah diunduh aplikasi, atau 300 candle 4H publik untuk pair di luar unduhan;
   - grafik punya hover: garis bantu dan tooltip OHLC + EMA.
3. **Funding, mark & index:** dari `GET /fapi/v1/premiumIndex`, berisi funding rate terakhir, waktu funding berikutnya, mark price, index price, dan basis mark − index. Diperbarui tiap 30 detik.
4. **Open Interest per 4 jam:** dari `GET /futures/data/openInterestHist` (period 4h, 42 titik ≈ 7 hari), berisi nilai OI terakhir, perubahan 4 jam dan 24 jam, dan sparkline.
5. **Long / Short per 4 jam, 7 hari:** masing-masing dengan rasio terakhir, porsi long/short atau porsi beli, perubahan 24 jam, dan sparkline.
   - `globalLongShortAccountRatio`: semua akun;
   - `topLongShortAccountRatio`: top trader, akun;
   - `topLongShortPositionRatio`: top trader, posisi;
   - `takerlongshortRatio`: taker beli/jual.
   
   Binance hanya menyediakan statistik ini untuk 30 hari terakhir.
6. **Orderbook & CVD live:** stream depth20 dan aggTrade untuk pair yang dibuka, sama seperti kartu Decision §18.
7. **Data Malomo:** status (Decision / setup menunggu / tidak ada sinyal), struktur dan skor M1 pada close terakhir, serta skor sinyal yang sedang ada di Decision.
8. **Aturan pair:** tick size, step size, min notional, status, leverage maksimum aman (dari jarak SL sinyal bila ada; bila tidak, batas pribadi R32/R34), dan MMR asumsi.

Nilai yang tidak sah atau tidak tersedia tampil "—" atau "tidak tersedia", tidak pernah 0. Statistik dan EMA dimuat ulang 60 detik setelah setiap close 4H baru selama panel terbuka.

### 21.2 Warna grafik

Candle memakai warna LONG/SHORT aplikasi. EMA 21 = #3E9FD6, EMA 30 = #C27E1F, EMA 50 = #A766DE. Ketiganya lolos validator palet untuk latar gelap #13140F: lightness band, chroma, pemisahan buta warna ΔE ≥ 10, dan kontras ≥ 3:1. Identitas EMA tidak hanya bergantung pada warna: ada legenda dan label langsung 21/30/50 di ujung garis.

### 21.3 Tes

`scripts/test-pairinfo.js`:
- EMA 21/30/50 identik pandas (400 close, selisih < 1e-9, fixture `pandas_ema_span_reference.json`);
- hanya candle close, pemanasan 3n → null, susunan EMA, grafik 60 candle;
- parser premiumIndex, OI historis, rasio long/short akun & posisi, taker (urutan, perubahan 4 jam & 24 jam, nilai rusak → null);
- daftar endpoint: hanya `premiumIndex` dan lima statistik yang diizinkan; order dan endpoint lain ditolak sebelum jaringan.

`scripts/test-browser.js`, desktop dan mobile:
- panel dibuka dari Semua Pair, Decision, dan Jurnal tanpa pindah layar, dengan 8 bagian lengkap;
- EMA di layar = hitungan Node atas candle yang sama;
- grafik berisi 3 garis EMA dan 60 candle;
- rasio long/short, funding, OI, dan aturan pair sesuai data;
- tooltip hover, tanpa scroll horizontal;
- tutup dengan Escape dan tombol.

`scripts/live-check.js` menambah pemeriksaan endpoint asli: premiumIndex + 5 statistik untuk BTCUSDT.
