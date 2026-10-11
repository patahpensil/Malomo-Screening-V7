/* Malomo V7 — Universe dinamis 100 pair (PRD v1.0.12 R34; sejak v1.0.13 R35 ranking realtime volume 24 jam berjalan).
   Fungsi murni, tanpa DOM/jaringan.
   Ranking ditetapkan pada close candle harian 00:00 UTC (08:00 WITA) = volume quote (USDT) candle harian yang baru close,
   untuk kontrak USDT perpetual berstatus TRADING (stablecoin & indeks dikeluarkan). Daftar berlaku sampai close harian
   berikutnya. Hard gate: hanya pair dalam daftar yang boleh menghasilkan keputusan; rumus & bobot M1–M6 tidak berubah.
   Sumber publik tanpa API key: /fapi/v1/exchangeInfo, /fapi/v1/ticker/24hr (kumpulan kandidat), /fapi/v1/klines 1d. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else (root.Malomo=root.Malomo||{}).universe=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DAY=24*3600*1000;
  const SIZE=100;            // jumlah pair universe (keputusan pengguna)
  const POOL=150;            // kumpulan kandidat dari volume 24 jam berjalan; ranking final memakai candle harian yang sudah close
  // Stablecoin & aset patokan fiat sebagai base: volume besar tetapi bukan pasar berarah.
  const STABLE=Object.freeze(['USDC','FDUSD','TUSD','BUSD','USDP','DAI','USDE','PYUSD','USD1','RLUSD','USDS','EURI','AEUR','XUSD','BFUSD','USDF']);
  const dayStartOf=ms=>Math.floor(ms/DAY)*DAY;

  /* Kontrak yang boleh diranking: PERPETUAL, quote USDT, status TRADING, base bukan stablecoin, underlying bukan indeks. */
  function eligible(exchangeInfo){
    const out=[];const list=exchangeInfo&&Array.isArray(exchangeInfo.symbols)?exchangeInfo.symbols:[];
    for(const s of list){
      if(!s||typeof s.symbol!=='string')continue;
      if(s.contractType!=='PERPETUAL'||s.quoteAsset!=='USDT'||s.status!=='TRADING')continue;
      if(STABLE.includes(String(s.baseAsset||'').toUpperCase()))continue;
      if(s.underlyingType&&s.underlyingType!=='COIN')continue;
      out.push(s.symbol);
    }
    return out.sort();
  }
  /* Kumpulan kandidat: POOL pair eligible dengan quoteVolume 24 jam berjalan tertinggi (hanya untuk membatasi permintaan). */
  function pool(tickers,eligibleList,n=POOL){
    const ok=new Set(eligibleList);
    return (Array.isArray(tickers)?tickers:[]).filter(t=>t&&ok.has(t.symbol)&&Number(t.quoteVolume)>=0)
      .sort((a,b)=>Number(b.quoteVolume)-Number(a.quoteVolume)||(a.symbol<b.symbol?-1:1)).slice(0,n).map(t=>t.symbol);
  }
  /* Volume candle harian yang close tepat pada dayStart (openTime = dayStart − 1 hari). Kline Binance: [7] = quote volume.
     Tidak ada candle itu (mis. listing baru) → null: pair tidak ikut ranking hari ini (tanpa tebakan). */
  function dailyQuoteVolume(rows,dayStart){
    if(!Array.isArray(rows))return null;
    const k=rows.find(r=>Number(r[0])===dayStart-DAY);
    if(!k)return null;const v=Number(k[7]);return Number.isFinite(v)&&v>=0?v:null;
  }
  /* Ranking final: urut volume harian ↓, seri → simbol ↑; ambil SIZE teratas. */
  function rank(volBySymbol,n=SIZE){
    return Object.entries(volBySymbol).filter(([,v])=>Number.isFinite(v)&&v>=0)
      .sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1)).slice(0,n).map(([symbol,quoteVolume],i)=>({rank:i+1,symbol,quoteVolume}));
  }
  /* Validasi universe tersimpan: hari yang sama → dipakai ulang tanpa unduh ulang. */
  function isFor(u,dayStart){return !!(u&&u.dayStart===dayStart&&Array.isArray(u.list)&&u.list.length&&u.list.every(x=>x&&typeof x.symbol==='string'&&Number.isInteger(x.rank)));}
  /* R35 (v1.0.13): ranking realtime dari quote volume 24 jam BERJALAN (stream !ticker@arr / REST ticker/24hr).
     tickers: {SYMBOL:{quoteVolume}}; hanya simbol eligible; urut volume ↓, seri → simbol ↑; ambil SIZE teratas. */
  function rankRolling(tickers,eligibleList,n=SIZE){
    const v={};for(const s of eligibleList){const t=tickers&&tickers[s];if(t&&Number.isFinite(t.quoteVolume)&&t.quoteVolume>=0)v[s]=t.quoteVolume;}
    return rank(v,n);
  }
  return {DAY,SIZE,POOL,STABLE,dayStartOf,eligible,pool,dailyQuoteVolume,rank,rankRolling,isFor};
});
