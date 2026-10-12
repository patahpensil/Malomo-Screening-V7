/* Malomo V7 — Detail Pair (PRD v1.0.17 R39). Fungsi murni, tanpa DOM/jaringan.
   INFORMASI SAJA: tidak menjadi gate, tidak masuk skor M1–M6, tidak mengubah keputusan.
   - EMA 21/30/50 dari candle 4H yang SUDAH close: EMA_t = α·close_t + (1−α)·EMA_{t−1}, α = 2/(n+1), EMA_0 = close_0
     (setara pandas ewm(span=n, adjust=False)). Nilai baru dianggap matang setelah ≥ 3n candle; kurang dari itu → null.
   - Data Binance publik: premiumIndex (funding, mark, index), /futures/data (OI historis, rasio long/short, taker buy/sell).
     Nilai tidak sah → null (bukan 0). */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else (root.Malomo=root.Malomo||{}).pairinfo=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const H4=4*3600*1000,EMAS=Object.freeze([21,30,50]),WARMUP=3,CHART=60;
  const fin=x=>typeof x==='number'&&Number.isFinite(x);
  const toNum=v=>{const n=typeof v==='string'&&v.trim()!==''?Number(v):typeof v==='number'?v:NaN;return Number.isFinite(n)?n:null;};

  function ema(values,n){
    const a=2/(n+1),out=new Array(values.length).fill(null);let prev=null;
    for(let i=0;i<values.length;i++){const x=values[i];if(!fin(x)){prev=null;continue;}prev=prev===null?x:a*x+(1-a)*prev;out[i]=prev;}
    return out;
  }
  const closedOf=(candles,now)=>(candles||[]).filter(x=>fin(x.close)&&x.t+H4<=now).sort((a,b)=>a.t-b.t);
  /* Ringkasan EMA pada candle 4H terakhir yang close + seri untuk grafik (CHART candle terakhir). */
  function emaInfo(candles,now,periods=EMAS){
    const c=closedOf(candles,now),closes=c.map(x=>x.close),series={},last={};
    for(const n of periods){const s=ema(closes,n);series[n]=s;last[n]=c.length>=WARMUP*n?s[s.length-1]:null;}
    const close=c.length?c[c.length-1].close:null;
    const pos={};for(const n of periods)pos[n]=fin(last[n])&&fin(close)?(close>last[n]?'ABOVE':close<last[n]?'BELOW':'AT'):null;
    const vals=periods.map(n=>last[n]);
    const order=vals.every(fin)?(vals[0]>vals[1]&&vals[1]>vals[2]?'BULL_STACK':vals[0]<vals[1]&&vals[1]<vals[2]?'BEAR_STACK':'MIXED'):null;
    const k=Math.max(0,c.length-CHART);
    return {close,closeMs:c.length?c[c.length-1].t+H4:null,candles:c.length,last,pos,order,
      chart:{candles:c.slice(k),ema:Object.fromEntries(periods.map(n=>[n,series[n].slice(k).map((v,i)=>k+i>=WARMUP*n-1?v:null)]))}};
  }

  // ---------- data /futures/data ----------
  /* Seri waktu dari baris Binance: urut naik, nilai numerik sah saja. Ringkasan: terakhir, 4 jam & 24 jam sebelumnya. */
  function series(rows,field){
    const pts=(Array.isArray(rows)?rows:[]).map(r=>({t:toNum(r&&r.timestamp),v:toNum(r&&r[field])})).filter(p=>fin(p.t)&&fin(p.v)).sort((a,b)=>a.t-b.t);
    const last=pts.length?pts[pts.length-1]:null,back=k=>pts.length>k?pts[pts.length-1-k]:null;
    const chg=(b)=>last&&b&&b.v!==0?100*(last.v/b.v-1):null;
    return {points:pts,last:last?last.v:null,at:last?last.t:null,prev4h:back(1)?back(1).v:null,prev24h:back(6)?back(6).v:null,chg4hPct:chg(back(1)),chg24hPct:chg(back(6))};
  }
  /* Rasio long/short akun atau posisi: {longShortRatio, longAccount, shortAccount} (porsi 0–1). */
  function ratio(rows){
    const r=series(rows,'longShortRatio'),lastRow=(Array.isArray(rows)?rows:[]).filter(x=>toNum(x&&x.timestamp)===r.at)[0]||null;
    const L=lastRow?toNum(lastRow.longAccount):null,S=lastRow?toNum(lastRow.shortAccount):null;
    return Object.assign(r,{longPct:fin(L)?100*L:null,shortPct:fin(S)?100*S:null});
  }
  function taker(rows){
    const r=series(rows,'buySellRatio'),lastRow=(Array.isArray(rows)?rows:[]).filter(x=>toNum(x&&x.timestamp)===r.at)[0]||null;
    const b=lastRow?toNum(lastRow.buyVol):null,s=lastRow?toNum(lastRow.sellVol):null;
    return Object.assign(r,{buyVol:b,sellVol:s,buyPct:fin(b)&&fin(s)&&b+s>0?100*b/(b+s):null});
  }
  function openInterest(rows){const v=series(rows,'sumOpenInterestValue'),q=series(rows,'sumOpenInterest');return Object.assign(v,{lastQty:q.last});}
  /* premiumIndex: funding terakhir (per 8 jam atau interval pair), waktu funding berikut, mark, index, basis mark−index (%). */
  function funding(p){
    if(!p||typeof p!=='object')return null;
    const mark=toNum(p.markPrice),index=toNum(p.indexPrice),rate=toNum(p.lastFundingRate),next=toNum(p.nextFundingTime);
    return {mark,index,ratePct:fin(rate)?100*rate:null,nextMs:fin(next)&&next>0?next:null,basisPct:fin(mark)&&fin(index)&&index>0?100*(mark/index-1):null};
  }
  const LABEL={ABOVE:'di atas',BELOW:'di bawah',AT:'tepat di',BULL_STACK:'EMA21 > EMA30 > EMA50 (susunan naik)',BEAR_STACK:'EMA21 < EMA30 < EMA50 (susunan turun)',MIXED:'susunan campuran'};
  return {EMAS,WARMUP,CHART,H4,ema,emaInfo,series,ratio,taker,openInterest,funding,LABEL};
});
