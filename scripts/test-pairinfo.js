'use strict';
/* Tes PRD v1.0.17 R39 — Detail Pair (informasi saja, bukan gate): EMA 21/30/50 identik pandas ewm(span, adjust=False),
   hanya candle close, masa pemanasan; parser data publik Binance (premiumIndex, OI historis, rasio long/short, taker)
   dengan nilai tidak sah → null (bukan 0); daftar endpoint transport hanya baca-saja. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const PI=require('../app/pairinfo'),Tr=require('../app/transport');
const H4=4*3600*1000;
let count=0;const failures=[];const queue=[];const test=(n,f)=>queue.push([n,f]);
const REF=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/pandas_ema_span_reference.json'),'utf8'));

test('EMA 21/30/50 identik pandas ewm(span=n, adjust=False) untuk 400 close (selisih < 1e-9)',()=>{
  for(const n of [21,30,50]){const a=PI.ema(REF.closes,n),b=REF['ema'+n];assert.equal(a.length,b.length);
    for(let i=0;i<a.length;i++)assert(Math.abs(a[i]-b[i])<1e-9*Math.max(1,Math.abs(b[i])),`EMA${n}[${i}] ${a[i]} vs ${b[i]}`);}
});
test('emaInfo: hanya candle yang sudah close; pemanasan 3n (kurang → null, bukan 0); posisi close & susunan EMA; grafik 60 candle',()=>{
  const t0=Date.UTC(2026,0,1),cs=REF.closes.map((c,i)=>({t:t0+i*H4,open:c,high:c*1.01,low:c*0.99,close:c}));
  const now=t0+400*H4;   // semua close
  const a=PI.emaInfo(cs,now);assert.equal(a.candles,400);
  for(const n of [21,30,50])assert(Math.abs(a.last[n]-REF['ema'+n][399])<1e-9*REF['ema'+n][399]);
  for(const n of [21,30,50])assert.equal(a.pos[n],a.close>a.last[n]?'ABOVE':'BELOW');
  assert.equal(a.chart.candles.length,60);for(const n of [21,30,50])assert.equal(a.chart.ema[n].length,60);
  const formingIncluded=PI.emaInfo([...cs,{t:now,open:1,high:1e9,low:0,close:1e9}],now+60000);assert.equal(formingIncluded.candles,400,'candle berjalan diabaikan');
  assert.equal(formingIncluded.last[21],a.last[21]);
  const short=PI.emaInfo(cs.slice(0,100),t0+100*H4);assert(Number.isFinite(short.last[21]));assert.equal(short.last[50],null,'100 < 150 candle → EMA50 null');assert.equal(short.order,null);
  // susunan naik/turun
  const up=Array.from({length:300},(_,i)=>({t:t0+i*H4,open:100+i,high:101+i,low:99+i,close:100+i}));
  assert.equal(PI.emaInfo(up,t0+300*H4).order,'BULL_STACK');
  const dn=up.map((x,i)=>Object.assign({},x,{close:1000-i,open:1000-i,high:1001-i,low:999-i}));assert.equal(PI.emaInfo(dn,t0+300*H4).order,'BEAR_STACK');
});
test('Parser Binance: premiumIndex, OI historis, rasio long/short akun & posisi, taker — perubahan 4 jam/24 jam; nilai rusak → null',()=>{
  const f=PI.funding({markPrice:'101.5',indexPrice:'101.0',lastFundingRate:'0.00012',nextFundingTime:1760000000000});
  assert.equal(f.mark,101.5);assert(Math.abs(f.ratePct-0.012)<1e-12);assert.equal(f.nextMs,1760000000000);assert(Math.abs(f.basisPct-100*(101.5/101-1))<1e-12);
  assert.deepEqual(PI.funding({markPrice:'x'}),{mark:null,index:null,ratePct:null,nextMs:null,basisPct:null});assert.equal(PI.funding(null),null);
  const t=k=>1760000000000+k*H4;
  const ls=[...Array(8)].map((_,k)=>({symbol:'SOLUSDT',longShortRatio:String(1+k*0.1),longAccount:String((1+k*0.1)/(2+k*0.1)),shortAccount:String(1/(2+k*0.1)),timestamp:t(k)})).reverse();   // urutan acak tetap diurutkan
  const r=PI.ratio(ls);assert(Math.abs(r.last-1.7)<1e-12);assert.equal(r.at,t(7));assert(Math.abs(r.chg4hPct-100*(1.7/1.6-1))<1e-9);assert(Math.abs(r.chg24hPct-100*(1.7/1.1-1))<1e-9);
  assert(Math.abs(r.longPct+r.shortPct-100)<1e-9);assert.equal(r.points.length,8);
  const oi=PI.openInterest([{sumOpenInterest:'10',sumOpenInterestValue:'1000',timestamp:t(0)},{sumOpenInterest:'11',sumOpenInterestValue:'1200',timestamp:t(1)},{sumOpenInterest:'bad',sumOpenInterestValue:'',timestamp:t(2)}]);
  assert.equal(oi.last,1200);assert.equal(oi.lastQty,11);assert(Math.abs(oi.chg4hPct-20)<1e-12);assert.equal(oi.chg24hPct,null,'kurang dari 7 titik → null');
  const tk=PI.taker([{buySellRatio:'1.25',buyVol:'500',sellVol:'400',timestamp:t(0)}]);assert.equal(tk.last,1.25);assert(Math.abs(tk.buyPct-100*500/900)<1e-12);
  const empty=PI.ratio('x');assert.equal(empty.last,null);assert.equal(empty.longPct,null);assert.deepEqual(empty.points,[]);
});
test('Transport R39: hanya premiumIndex & lima statistik /futures/data yang diizinkan; endpoint lain/order ditolak sebelum jaringan',async()=>{
  const hits=[];const T=Tr.createTransport({fetchImpl:async u=>{hits.push(u);return {ok:true,status:200,json:async()=>[]};},sleep:async()=>{},gapMs:0});
  await T.premiumIndex('SOLUSDT');for(const k of Tr.FUTURES_DATA)await T.futuresData(k,'SOLUSDT','4h',42);
  assert.equal(hits.length,6);assert(hits.every(u=>u.startsWith('https://fapi.binance.com/')));
  assert(hits.includes('https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=SOLUSDT&period=4h&limit=42'));
  for(const bad of ['/fapi/v1/order?symbol=SOLUSDT','/fapi/v2/account','/futures/data/basis?symbol=SOLUSDT&period=4h&limit=5','/fapi/v1/premiumIndex','/futures/data/openInterestHist?symbol=SOLUSDT&period=4h&limit=42&x=1'])
    await assert.rejects(T.request(bad),/tidak diizinkan/,bad);
  await assert.rejects(T.futuresData('basis','SOLUSDT'),/tidak diizinkan/);assert.equal(hits.length,6);
});

(async()=>{
  for(const [name,fn] of queue){try{await fn();count++;console.log('PASS '+name);}catch(e){failures.push(name);console.log('FAIL '+name+' — '+String(e&&e.message||e).split('\n')[0]);}}
  console.log(`\n${count} PASS, ${failures.length} FAIL`);
  if(failures.length)process.exit(1);
})();
