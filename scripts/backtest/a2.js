'use strict';
/* Tahap A2 — riset generator sinyal baru + lapis rezim BTC (hipotesis dikunci sebelum hasil dilihat; PRD §15).
   Pemakaian: node scripts/backtest/a2.js <dir data/bt> [topN=30]
   Universe, data, biaya, dan mandat risiko sama dengan Tahap A (§14.1). Keputusan pada close 4H, entry open berikutnya.
   Evaluasi: (1) per pair berurutan (satu posisi per pair, tanpa batas jumlah pair) = edge mentah generator;
             (2) portofolio mandat PRD (≤3 posisi, risiko 1%/trade, risiko terbuka ≤3%, gross ≤1×, 1 posisi/pair).
   Syarat lulus (§14.6): biaya 18 bps + funding, R rata-rata ≥ +0.05 dan t ≥ 2, positif tiap tahun, DD portofolio ≤ 25%. */
const fs=require('node:fs'),path=require('node:path');
const L=require('./lib');
const {C,H4,P}=L;const M1=require('../../engine/m1'),G=require('../../engine/generators');
const DIR=path.resolve(process.argv[2]||'data/bt'),TOPN=Number(process.argv[3]||30);
const OUT=path.resolve(__dirname,'../../results/tahap-a2');fs.mkdirSync(OUT,{recursive:true});
const cov=JSON.parse(fs.readFileSync(path.join(DIR,'coverage.json'),'utf8'));
const universe=Object.entries(cov.coverage).filter(([,v])=>v&&v.candles>=12*30*6).sort((a,b)=>b[1].quoteVolume-a[1].quoteVolume).slice(0,TOPN).map(([s])=>s);
const START=Date.UTC(2024,1,1);
const DAY=6;   // candle 4H per hari
// ---------- data per pair ----------
const D=new Map();
for(const s of universe){
  const c=L.loadKlines(DIR,s),ind=C.indicators(c),piv=C.pivots(c),f=L.loadFunding(DIR,s);
  D.set(s,{s,c,ind,piv,f,idx:new Map(c.map((x,i)=>[x.t,i]))});
}
// Rezim BTC: label struktur M1 BTCUSDT dari pivot yang terkonfirmasi s.d. candle i (kausal).
const btc=D.get('BTCUSDT'),btcReg=btc.c.map((_,i)=>M1.structure(btc.piv,i).label);
const regimeAt=T=>{const i=btc.idx.get(T-H4);return i===undefined?'NA':btcReg[i];};
const regOk=(mode,side,T)=>{if(mode==='none')return true;const r=regimeAt(T);
  if(mode==='aligned')return (side===1&&r==='BULLISH')||(side===-1&&r==='BEARISH');
  if(mode==='notCounter')return !((side===1&&r==='BEARISH')||(side===-1&&r==='BULLISH'));return true;};
// ---------- simulasi trade generik ----------
/* sig: {s, i (indeks candle keputusan), side, prio}. exit: {stopAtr, rr|null, maxBars, trailAtr|null, chanExit|null, flip|null}
   Urutan per candle: stop (termasuk trailing yang berlaku dari candle sebelumnya) → target → aturan close (channel/flip/waktu). */
function trade(sig,ex,costBps){
  const d=D.get(sig.s),c=d.c,e=sig.i+1;if(e>=c.length)return null;
  const side=sig.side,entry=c[e].open,atr=d.ind.atr[sig.i];if(!(entry>0&&atr>0))return null;
  const dist=ex.stopAtr*atr;let stop=entry-side*dist;const target=ex.rr?entry+side*ex.rr*dist:null;if(side===1&&stop<=0)return null;
  let best=entry,exit=null,why=null,k=e;
  for(;k<c.length;k++){
    const x=c[k],sHit=side===1?x.low<=stop:x.high>=stop;
    if(sHit){exit=side===1?Math.min(x.open,stop):Math.max(x.open,stop);why='STOP';break;}   // open sudah melewati stop (gap) → isi di open
    if(target!==null&&(side===1?x.high>=target:x.low<=target)){exit=target;why='TARGET';break;}
    best=side===1?Math.max(best,x.close):Math.min(best,x.close);
    if(ex.trailAtr){const a=d.ind.atr[k],ts=best-side*ex.trailAtr*a;if(side===1?ts>stop:ts<stop)stop=ts;}
    if(ex.chanExit&&k-ex.chanExit>=0){let m=side===1?Infinity:-Infinity;for(let j=k-ex.chanExit;j<k;j++)m=side===1?Math.min(m,c[j].low):Math.max(m,c[j].high);
      if(side===1?x.close<m:x.close>m){exit=x.close;why='CHANNEL';break;}}
    if(ex.flip&&ex.flip(d,k,side)){exit=x.close;why='FLIP';break;}
    if(k-e+1>=ex.maxBars){exit=x.close;why='TIME';break;}
  }
  if(exit===null)return null;   // belum selesai di ujung data → tidak dinilai
  const T=c[e].t,exitT=c[k].t+H4,gross=side*(exit-entry)/entry;let fund=0;
  for(const f of d.f){if(f.t<=T)continue;if(f.t>exitT)break;fund-=side*f.rate;}
  const net=gross-costBps/1e4+fund,riskFrac=dist/entry;
  return {s:sig.s,side,T,exitT,why,R:net/riskFrac,net,fund,riskFrac,notionalFrac:Math.min(0.01/riskFrac,1),eqPct:100*net*Math.min(0.01/riskFrac,1),prio:sig.prio??0};
}
// (1) per pair berurutan
function perPair(sigs,ex,cost){
  const by=new Map();for(const g of sigs){if(!by.has(g.s))by.set(g.s,[]);by.get(g.s).push(g);}
  const out=[];for(const [,arr] of by){arr.sort((a,b)=>a.i-b.i);let busy=-Infinity;
    for(const g of arr){const T=D.get(g.s).c[g.i].t+H4;if(T<busy)continue;const t=trade(g,ex,cost);if(t){out.push(t);busy=t.exitT;}}}
  return out;
}
// (2) portofolio mandat PRD; prioritas dalam satu waktu = prio menurun lalu simbol
function portfolio(sigs,ex,cost){
  const byT=new Map();for(const g of sigs){const T=D.get(g.s).c[g.i].t+H4;if(!byT.has(T))byT.set(T,[]);byT.get(T).push(g);}
  let pos=[];const acc=[];
  for(const T of [...byT.keys()].sort((a,b)=>a-b)){
    pos=pos.filter(p=>p.exitT>T);
    for(const g of byT.get(T).sort((a,b)=>(b.prio??0)-(a.prio??0)||a.s.localeCompare(b.s))){
      if(pos.length>=3||pos.some(p=>p.s===g.s))continue;
      const t=trade(g,ex,cost);if(!t)continue;
      const risk=100*t.notionalFrac*t.riskFrac,gross=100*t.notionalFrac;
      if(pos.reduce((a,p)=>a+p.risk,0)+risk>3+1e-9||pos.reduce((a,p)=>a+p.gross,0)+gross>100+1e-9)continue;
      pos.push({s:g.s,exitT:t.exitT,risk,gross});acc.push(t);
    }
  }
  return acc;
}
const yr=t=>L.yearOf(t.T);
function evalSet(trades){const all=L.stats(trades),y={};for(const Y of [2024,2025,2026])y[Y]=L.stats(trades.filter(t=>yr(t)===Y));return {all,y};}
// ---------- generator ----------
const inRange=(d,i)=>d.c[i].t+H4>=START&&i>=360&&i+1<d.c.length;
function gPRD(family,regime){
  const out=[];
  for(const [s,d] of D){
    const evs=G.all(d.c,d.ind,d.piv,{symbol:s}).filter(e=>e.status==='CONFIRMED');
    const key=new Map();for(const e of evs){const k=e.tc;if(!key.has(k))key.set(k,[]);key.get(k).push(e);}
    for(const [tc,list] of key){
      if(new Set(list.map(e=>e.family)).size>1||new Set(list.map(e=>e.side)).size>1)continue;   // bentrok §9 → tidak ditrade
      const e=list[0];if(e.family!==family||!inRange(d,tc))continue;
      const st=M1.structure(d.piv,tc).label;if(st!==(e.side==='LONG'?'BULLISH':'BEARISH'))continue;   // gate arah M1 pair
      const side=e.side==='LONG'?1:-1,T=d.c[tc].t+H4;if(!regOk(regime,side,T))continue;
      out.push({s,i:tc,side,prio:0});
    }
  }
  return out;
}
function gDonchian(N,regime){
  const out=[];
  for(const [s,d] of D){const c=d.c;
    for(let i=N+1;i<c.length;i++){if(!inRange(d,i))continue;
      let hi=-Infinity,lo=Infinity,hp=-Infinity,lp=Infinity;for(let j=i-N;j<i;j++){hi=Math.max(hi,c[j].high);lo=Math.min(lo,c[j].low);}
      for(let j=i-N-1;j<i-1;j++){hp=Math.max(hp,c[j].high);lp=Math.min(lp,c[j].low);}
      const T=c[i].t+H4;
      if(c[i].close>hi&&c[i-1].close<=hp&&regOk(regime,1,T))out.push({s,i,side:1,prio:(c[i].close-hi)/d.ind.atr[i]});
      if(c[i].close<lo&&c[i-1].close>=lp&&regOk(regime,-1,T))out.push({s,i,side:-1,prio:(lo-c[i].close)/d.ind.atr[i]});
    }}
  return out;
}
function gTSMOM(Lb,regime){
  const out=[];
  for(const [s,d] of D){const c=d.c;
    for(let i=Lb;i<c.length;i++){if(!inRange(d,i)||new Date(c[i].t+H4).getUTCHours()!==0)continue;   // dievaluasi harian 00:00 UTC
      const r=c[i].close/c[i-Lb].close-1,side=r>0?1:-1;if(!regOk(regime,side,c[i].t+H4))continue;
      out.push({s,i,side,prio:Math.abs(r)/(d.ind.natr[i]||1)});
    }}
  return out;
}
const tsFlip=Lb=>(d,k,side)=>new Date(d.c[k].t+H4).getUTCHours()===0&&k>=Lb&&Math.sign(d.c[k].close/d.c[k-Lb].close-1)!==side;
function gSqueeze(regime){
  const out=[];
  for(const [s,d] of D){const c=d.c,n=d.ind.natr;
    for(let i=141;i<c.length;i++){if(!inRange(d,i))continue;
      let cnt=0;for(let j=i-121;j<i-1;j++)if(n[j]<=n[i-1])cnt++;if(cnt/120>0.2)continue;   // NATR candle sebelumnya di 20% terbawah
      let hi=-Infinity,lo=Infinity;for(let j=i-20;j<i;j++){hi=Math.max(hi,c[j].high);lo=Math.min(lo,c[j].low);}
      const T=c[i].t+H4;
      if(c[i].close>hi&&regOk(regime,1,T))out.push({s,i,side:1,prio:0});
      if(c[i].close<lo&&regOk(regime,-1,T))out.push({s,i,side:-1,prio:0});
    }}
  return out;
}
function gXSMom(Lb,K,regime){
  const out=[],times=new Map();
  for(const [s,d] of D)for(let i=Lb;i<d.c.length;i++){const T=d.c[i].t+H4,dt=new Date(T);if(dt.getUTCDay()!==1||dt.getUTCHours()!==0||!inRange(d,i))continue;
    if(!times.has(T))times.set(T,[]);times.get(T).push({s,i,r:d.c[i].close/d.c[i-Lb].close-1});}
  for(const [T,arr] of times){if(arr.length<10)continue;arr.sort((a,b)=>b.r-a.r);
    for(const x of arr.slice(0,K))if(regOk(regime,1,T))out.push({s:x.s,i:x.i,side:1,prio:x.r});
    for(const x of arr.slice(-K))if(regOk(regime,-1,T))out.push({s:x.s,i:x.i,side:-1,prio:-x.r});}
  return out;
}
function gFunding(th,regime){
  const out=[];
  for(const [s,d] of D)for(const f of d.f){const i=d.idx.get(f.t-H4);if(i===undefined||!inRange(d,i))continue;   // funding pada batas candle: keputusan di close itu
    if(f.rate>=th&&regOk(regime,-1,f.t))out.push({s,i,side:-1,prio:f.rate});
    if(f.rate<=-th&&regOk(regime,1,f.t))out.push({s,i,side:1,prio:-f.rate});}
  return out;
}
// ---------- daftar konfigurasi (dikunci) ----------
const PRDX={stopAtr:1.5,rr:2,maxBars:6};
const TRAIL={stopAtr:1.5,rr:null,maxBars:42,trailAtr:3};
const CONF=[];
for(const reg of ['none','aligned']){
  CONF.push(['H1a Breakout PRD, exit PRD',reg,()=>gPRD('BREAKOUT_RETEST',reg),PRDX]);
  CONF.push(['H1b Breakout PRD, trailing 3ATR ≤7h',reg,()=>gPRD('BREAKOUT_RETEST',reg),TRAIL]);
  CONF.push(['H2a Pullback PRD, exit PRD',reg,()=>gPRD('PULLBACK_CONTINUATION',reg),PRDX]);
  CONF.push(['H2b Pullback PRD, trailing 3ATR ≤7h',reg,()=>gPRD('PULLBACK_CONTINUATION',reg),TRAIL]);
  CONF.push(['H3a Donchian 20h, exit kanal 10h',reg,()=>gDonchian(20*DAY,reg),{stopAtr:2,rr:null,maxBars:90*DAY,chanExit:10*DAY}]);
  CONF.push(['H3b Donchian 55h, exit kanal 20h',reg,()=>gDonchian(55*DAY,reg),{stopAtr:2,rr:null,maxBars:90*DAY,chanExit:20*DAY}]);
  CONF.push(['H4a TSMOM 30h, flip harian',reg,()=>gTSMOM(30*DAY,reg),{stopAtr:3,rr:null,maxBars:90*DAY,flip:tsFlip(30*DAY)}]);
  CONF.push(['H4b TSMOM 60h, flip harian',reg,()=>gTSMOM(60*DAY,reg),{stopAtr:3,rr:null,maxBars:90*DAY,flip:tsFlip(60*DAY)}]);
  CONF.push(['H5a Squeeze, target 2R ≤72j',reg,()=>gSqueeze(reg),{stopAtr:1.5,rr:2,maxBars:18}]);
  CONF.push(['H5b Squeeze, target 3R ≤72j',reg,()=>gSqueeze(reg),{stopAtr:1.5,rr:3,maxBars:18}]);
  CONF.push(['H6a XS-momentum 7h, top/bottom 3, tahan 7h',reg,()=>gXSMom(7*DAY,3,reg),{stopAtr:3,rr:null,maxBars:7*DAY}]);
  CONF.push(['H6b XS-momentum 28h, top/bottom 3, tahan 7h',reg,()=>gXSMom(28*DAY,3,reg),{stopAtr:3,rr:null,maxBars:7*DAY}]);
  CONF.push(['H7a Funding ±0.05%/8j kontrarian, 24j',reg,()=>gFunding(0.0005,reg),{stopAtr:2,rr:null,maxBars:6}]);
  CONF.push(['H7b Funding ±0.10%/8j kontrarian, 72j',reg,()=>gFunding(0.001,reg),{stopAtr:2,rr:null,maxBars:18}]);
}
const results=[];const t0=Date.now();
for(const [name,reg,gen,ex] of CONF){
  const sigs=gen();const row={name,regime:reg,signals:sigs.length,ex:Object.fromEntries(Object.entries(ex).filter(([k])=>k!=='flip'))};
  for(const cost of [9,18,25]){row['pair@'+cost]=evalSet(perPair(sigs,ex,cost));row['pf@'+cost]=evalSet(portfolio(sigs,ex,cost));}
  const p=row['pf@18'],q=row['pair@18'];
  row.pass={pair:q.all.n>=50&&q.all.meanR>=0.05&&q.all.tStat>=2&&[2024,2025,2026].every(Y=>q.y[Y].n&&q.y[Y].meanR>0),
    portfolio:p.all.n>=50&&p.all.meanR>=0.05&&p.all.tStat>=2&&[2024,2025,2026].every(Y=>p.y[Y].n&&p.y[Y].meanR>0)&&p.all.maxDDPct<=25};
  results.push(row);
  const f=x=>x.n?`${x.meanR>=0?'+':''}${x.meanR.toFixed(3)}`:'  —  ';
  console.log(`${name.padEnd(44)} ${reg.padEnd(8)} sig=${String(sigs.length).padStart(5)} | pair18 n=${String(q.all.n).padStart(5)} R=${f(q.all)} t=${q.all.tStat?.toFixed(2).padStart(5)} [${f(q.y[2024])} ${f(q.y[2025])} ${f(q.y[2026])}] | pf18 n=${String(p.all.n).padStart(4)} R=${f(p.all)} t=${p.all.tStat?.toFixed(2).padStart(5)} [${f(p.y[2024])} ${f(p.y[2025])} ${f(p.y[2026])}] eq=${p.all.sumEqPct?.toFixed(0)}% DD=${p.all.maxDDPct?.toFixed(0)}% ${row.pass.pair?'LULUS-PAIR ':''}${row.pass.portfolio?'LULUS-PF':''}`);
}
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({design:{universe,start:new Date(START).toISOString(),costs:[9,18,25],criteria:'18 bps + funding: R≥0.05, t≥2, positif 2024/2025/2026, DD portofolio ≤25%'},results},null,1));
console.log('selesai '+((Date.now()-t0)/1000).toFixed(0)+' s');
module.exports={D,trade,perPair,portfolio,evalSet,CONF,regimeAt,gPRD,gDonchian,gTSMOM,gSqueeze,gXSMom,gFunding,tsFlip,DAY};
