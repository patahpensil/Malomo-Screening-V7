/* Malomo V7 — kamus label dan format tampilan (Referensi UI/UX §5–§6). Hanya tampilan: tidak mengubah angka engine.
   Kode kontrak tetap tersedia di tooltip supaya UI dan log audit bisa dicocokkan. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else (root.Malomo=root.Malomo||{}).labels=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EVENT={WAITING_RETEST:'Menunggu retest',WAITING_ZONE:'Menunggu zona pullback',WAITING_CONTINUATION:'Menunggu trigger',
    CHOCH_CANDIDATE:'Kandidat CHoCH',CONFIRMED:'Terkonfirmasi',INVALID:'Batal (invalidasi)',EXPIRED:'Kedaluwarsa',CENSORED:'Data terpotong',
    PREZONE_CENSORED:'Zona tak tersentuh (24 candle)',UNSUPPORTED_FOR_SCORING:'Label riset, tanpa skor',
    CONFLICTING_DIRECTIONS:'Arah bertentangan',MULTI_METHOD_COLLISION:'Bentrok keluarga sinyal'};
  const SCORE={SCORED:'Skor sah',NOT_APPLICABLE:'Belum perlu skor',INCOMPLETE:'Tidak dapat dihitung',DATA_INCOMPLETE:'Data belum lengkap',
    CALIBRATION_INCOMPLETE:'Kalibrasi belum cukup',SCORE_INCOMPLETE:'Komponen skor tak terdefinisi',AUDIT_INCOMPLETE:'Audit belum terbukti',NO_SCORE:'Skor belum lengkap'};
  const STATUS={CLOSE_CANDIDATE:'Kandidat, menunggu open',ENTRY_CONSIDER:'Layak dipertimbangkan',NO_ENTRY:'Tidak ada entry',
    REJECTED_DIRECTION:'Ditolak: arah',REJECTED_INTEGRITY:'Ditolak: integritas',REJECTED_RISK:'Ditolak: risiko',
    CONFLICTING_DIRECTIONS:'Ditolak: arah bertentangan',MULTI_METHOD_COLLISION:'Ditolak: bentrok keluarga',RESEARCH_ONLY:'Riset saja'};
  // reasons[]: enam kode PRD (UI/UX §6) + kode rinci engine (mis. jendela M1/M3 belum cukup), ditandai `engine`.
  const REASON={FETCH_FAILED:'Gagal ambil data, sedang coba ulang',CONFIRMED_GAP:'Candle hilang di sumber',GROSS_CAP:'Batas gross 1× penuh',
    PAIR_ACTIVE:'Pair sudah punya posisi',POSITION_OR_RISK_CAP:'Slot atau risiko terbuka penuh',CONFLICT_CHECK_NOT_LOGGED:'Log cek konflik tidak ada',
    CONFLICTING_DIRECTIONS:'Arah bertentangan',MULTI_METHOD_COLLISION:'Bentrok keluarga sinyal',
    DIRECTION_GATE:'Tidak searah struktur M1',PLAN_RISK_INVALID:'Rencana risiko tidak valid',INTEGRITY_BELOW_20:'Integritas M2 di bawah 20',
    AUDIT_INCOMPLETE:'Audit belum terbukti',CALIBRATION_INCOMPLETE:'Kalibrasi belum cukup',DATA_INCOMPLETE:'Data belum lengkap',NO_SCORE:'Skor belum lengkap',
    GENERATION30_UNDEFINED:'Komponen generation30 tak terdefinisi',
    M1_SWING_INSUFFICIENT:'Swing M1 belum cukup',M1_TE_INCOMPLETE:'TE14 tak dapat dihitung',M1_ADX_INCOMPLETE:'ADX14 belum tersedia',
    M1_NATR_HISTORY_INCOMPLETE:'Riwayat NATR 120 belum cukup',M3_HISTORY_INCOMPLETE:'Riwayat M3 (181 close) belum cukup',
    M3_PAIR_MISSING:'Data pair M3 tidak ada',M3_ZERO_VARIANCE:'Varians return nol',
    E4_INCOMPLETE:'Momentum E4 tak dapat dihitung',CLOSEPOS_INCOMPLETE:'ClosePos tak dapat dihitung',RVOL_INCOMPLETE:'RVOL20 tak dapat dihitung',TAKER_INCOMPLETE:'Taker tak dapat dihitung'};
  const PRD_REASONS=['FETCH_FAILED','CONFIRMED_GAP','GROSS_CAP','PAIR_ACTIVE','POSITION_OR_RISK_CAP','CONFLICT_CHECK_NOT_LOGGED'];
  const FAMILY={BREAKOUT_RETEST:'Breakout–Retest',PULLBACK_CONTINUATION:'Pullback',REVERSAL_RETEST:'Reversal–Retest',MEAN_REVERSION:'Mean Reversion',PATTERN_BASED:'Pattern'};
  const STRUCT={BULLISH:'Bullish',BEARISH:'Bearish',TRANSITION:'Transisi',INCOMPLETE:'Swing belum cukup'};
  const OUTCOME={OPEN:'Berjalan',STOP_HIT:'Stop tersentuh',TARGET_HIT:'Target tersentuh',HORIZON_EXIT:'Horizon 24 jam',NO_DATA:'Data belum ada'};
  // Kelas warna status (token UI/UX §5): primary, warn, reject, neutral.
  function tone(code){
    if(code==='ENTRY_CONSIDER'||code==='CONFIRMED'||code==='SCORED')return 'primary';
    if(/^REJECTED_|CONFIRMED_GAP|CONFLICTING|COLLISION|INVALID/.test(code||''))return 'reject';
    if(/INCOMPLETE|FETCH_FAILED|NO_SCORE|NO_ENTRY|EXPIRED|CENSORED/.test(code||''))return 'warn';
    return 'neutral';
  }
  const reasonLabel=code=>{const s=String(code),base=s.split(':')[0],sym=s.includes(':')?' ('+s.split(':')[1]+')':'';return (REASON[base]||s)+sym;};
  const fin=x=>typeof x==='number'&&Number.isFinite(x);
  const pad=n=>String(n).padStart(2,'0');
  const MONTHS=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const WITA=8*3600*1000;
  // Waktu dua zona (UI/UX §1.6): UTC utama + padanan WITA.
  function hm(ms){const d=new Date(ms);return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());}
  function date(ms){const d=new Date(ms);return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]+' '+d.getUTCFullYear();}
  function time(ms){if(!fin(ms))return '—';return hm(ms)+' UTC · '+hm(ms+WITA)+' WITA';}
  function dateTime(ms){if(!fin(ms))return '—';return date(ms)+' '+hm(ms)+' UTC · '+hm(ms+WITA)+' WITA';}
  const parseIso=s=>s?Date.parse(s):NaN;
  function duration(ms){
    if(!fin(ms))return '—';const neg=ms<0;let s=Math.floor(Math.abs(ms)/1000);
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);s%=60;
    return (neg?'−':'')+pad(h)+':'+pad(m)+':'+pad(s);
  }
  function durationShort(ms){if(!fin(ms))return '—';const m=Math.max(0,Math.round(ms/60000));return m>=60?Math.floor(m/60)+'j '+(m%60)+'m':m+'m';}
  // Skor: 2 desimal round half up hanya untuk tampilan; null tidak pernah jadi 0.
  function score(x){if(!fin(x))return '—';return (Math.floor(x*100+0.5+1e-9)/100).toFixed(2);}
  // Harga: float64 dipotong untuk tampilan menurut besaran; bukan harga order (belum dikuantisasi tick).
  function price(v){if(!fin(v))return '—';const a=Math.abs(v);return a>=100?v.toFixed(2):a>=1?v.toFixed(4):v.toFixed(6);}
  function pct(v){return fin(v)?(Math.floor(v*100+0.5+1e-9)/100).toFixed(2)+'%':'—';}
  function compactUsd(v){if(!fin(v))return '—';const a=Math.abs(v),s=v<0?'−':'';return s+'$'+(a>=1e9?(a/1e9).toFixed(2)+'B':a>=1e6?(a/1e6).toFixed(2)+'M':a>=1e3?(a/1e3).toFixed(1)+'K':a.toFixed(0));}
  const sideText=s=>s==='LONG'?'▲ LONG':s==='SHORT'?'▼ SHORT':'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return {EVENT,SCORE,STATUS,REASON,PRD_REASONS,FAMILY,STRUCT,OUTCOME,tone,reasonLabel,time,dateTime,date,hm,parseIso,duration,durationShort,score,price,pct,compactUsd,sideText,esc,WITA};
});
