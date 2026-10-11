'use strict';
/* Tahap A — uji arsitektur sistem PRD v1.0.8 (backtest komposit) atas universe pair paling likuid, Feb 2024 → Okt 2026.
   Pemakaian: node scripts/backtest/run.js <dir data/bt> [topN=30]   (data: cabang data-bt / scripts/backtest/fetch-universe.js)
   Yang diuji adalah cara kerja aplikasi, lapis demi lapis, atas SELURUH data 2024–2026:
   generator → gate arah → aturan bentrok → skor/ranking M6 → kapasitas portofolio → exit → biaya.
   Tiap lapis dimatikan/diganti (ablation). Hasil per tahun hanya uji KONSISTENSI: perubahan dianggap
   memperbaiki bila rata-rata R per trade positif di ketiga tahun, bukan dipilih dari satu tahun.
   Keluaran: results/tahap-a/summary.json + trades.csv.gz. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const L=require('./lib');
const {C,H4,CORE}=L;
const DIR=path.resolve(process.argv[2]||'data/bt'),TOPN=Number(process.argv[3]||30);
const OUT=path.resolve(__dirname,'../../results/tahap-a');fs.mkdirSync(OUT,{recursive:true});
const cov=JSON.parse(fs.readFileSync(path.join(DIR,'coverage.json'),'utf8'));
const START=Date.UTC(2024,1,1),END=Date.parse(cov.coverage.BTCUSDT.last)+H4;
// Universe: total quote volume selama jendela (likuiditas kumulatif), minimal 12 bulan data.
const ranked=Object.entries(cov.coverage).filter(([,v])=>v&&v.candles>=12*30*6).sort((a,b)=>b[1].quoteVolume-a[1].quoteVolume);
const universe=ranked.slice(0,TOPN).map(([s])=>s);for(const s of CORE)if(!universe.includes(s))universe.push(s);
console.log('Universe ('+universe.length+'): '+universe.join(' '));
const candlesBy=new Map(),fundingBy=new Map();
for(const s of universe){candlesBy.set(s,L.loadKlines(DIR,s));fundingBy.set(s,L.loadFunding(DIR,s));}
const t0=Date.now();
const {records,segBy}=L.runDecisions({candlesBy,startMs:START,endMs:END});
console.log('Keputusan: '+records.length+' record dalam '+((Date.now()-t0)/1000).toFixed(1)+' s');
const atrOf=r=>{if(Number.isFinite(r.atr_entry))return r.atr_entry;const T=Date.parse(r.decision_available_utc)-H4;for(const a of segBy.get(r.symbol)){const i=a.idxOf.get(T);if(i!==undefined)return a.ind.atr[i];}return null;};
const m6pre=r=>{const s=r.scores;return [s.m1_100,s.m2_signal_quality_80,s.m3_100].every(Number.isFinite)?s.m1_100+s.m2_signal_quality_80+20+s.m3_100+100+s.m5_100:null;};
const adxOf=r=>r.scores.m1_components?r.scores.m1_components.adx14:null;
for(const r of records){r._atr=atrOf(r);r._m6=m6pre(r);r._adx=adxOf(r);r._T=Date.parse(r.decision_available_utc);}
const sim=(r,p)=>{const x=L.simulate(Object.assign({},r,{atr_entry:r._atr}),candlesBy.get(r.symbol),fundingBy.get(r.symbol),p);if(x){x.rec=r;}return x;};
const BASE={stopAtr:1.5,rr:2,horizonH:24,costBps:9};
// Populasi
const isGate=r=>r.status==='ENTRY_CONSIDER'||r.status==='REJECTED_RISK';
const POP={
  SIG_GATE:records.filter(isGate),
  SIG_DIR_REJECT:records.filter(r=>r.status==='REJECTED_DIRECTION'&&r.score_status==='SCORED'),
  SIG_COLLISION:records.filter(r=>r.status==='MULTI_METHOD_COLLISION'),
  SYS:records.filter(r=>r.status==='ENTRY_CONSIDER'),
};
const period=T=>{const y=L.yearOf(T);return y===2024?'Y2024':y===2025?'Y2025':'Y2026';};
function breakdown(trades,keyFn){const g={};for(const t of trades){const k=keyFn(t);(g[k]=g[k]||[]).push(t);}const o={};for(const k of Object.keys(g).sort())o[k]=L.stats(g[k]);return o;}
const summary={design:{method:'ablation arsitektur atas seluruh data; per tahun = uji konsistensi',universe,start:new Date(START).toISOString(),end:new Date(END).toISOString(),base:BASE,costsBps:[9,18],
  calibration:'FROZEN_COMPLETE_TRAIN_ECDF (array beku 2024; Mar–Agu 2024 untuk 6 pair inti = in-sample kalibrasi)',m3:'basket 6 pair PRD',
  universeRanking:ranked.map(([s,v])=>({s,qvB:v.quoteVolume/1e9,first:v.first.slice(0,10),candles:v.candles}))},populations:{}};
const allTrades={};
for(const [name,recs] of Object.entries(POP)){
  for(const cost of [9,18]){
    const tr=recs.map(r=>sim(r,Object.assign({},BASE,{costBps:cost}))).filter(Boolean);
    allTrades[name+'@'+cost]=tr;
    summary.populations[name+'@'+cost]={all:L.stats(tr),byPeriod:breakdown(tr,t=>period(t.T)),byFamily:breakdown(tr,t=>t.family),
      byFamilyPeriod:breakdown(tr,t=>t.family+'|'+period(t.T)),bySide:breakdown(tr,t=>t.side),bySymbol:breakdown(tr,t=>t.symbol)};
  }
}
// Apakah skor memisahkan trade baik/buruk? Kuintil M6 & M1+M2q, ADX, M3 di SIG_GATE (biaya 9).
const g9=allTrades['SIG_GATE@9'];
const qt=(arr,f)=>{const v=arr.map(f).filter(Number.isFinite).sort((a,b)=>a-b);return [0.2,0.4,0.6,0.8].map(q=>v[Math.floor(q*(v.length-1))]);};
const bucket=(x,cuts)=>{let i=0;while(i<cuts.length&&x>cuts[i])i++;return 'Q'+(i+1);};
const cutsM6=qt(g9.filter(t=>t.T<Date.UTC(2025,0,1)),t=>t.rec._m6),cutsQ=qt(g9.filter(t=>t.T<Date.UTC(2025,0,1)),t=>t.rec.scores.m1_plus_m2q_0_180_display_only);
summary.scoreSeparation={cutsM6_IS:cutsM6,byM6:breakdown(g9,t=>bucket(t.rec._m6,cutsM6)+'|'+period(t.T)),
  byM1M2q:breakdown(g9,t=>bucket(t.rec.scores.m1_plus_m2q_0_180_display_only,cutsQ)+'|'+period(t.T)),
  byADX:breakdown(g9,t=>(t.rec._adx<20?'ADX<20':t.rec._adx<30?'ADX20-30':'ADX>=30')+'|'+period(t.T)),
  byM3:breakdown(g9,t=>(t.rec.scores.m3_100<40?'M3<40':t.rec.scores.m3_100<60?'M3_40-60':'M3>=60')+'|'+period(t.T)),
  byCore:breakdown(g9,t=>(CORE.includes(t.symbol)?'CORE6':'OTHER')+'|'+period(t.T))};
// Varian exit (pra-deklarasi): dipilih di IS, dilaporkan di OOS. Per-sinyal SIG_GATE, biaya 9 bps.
const VAR=[];
for(const stopAtr of [1,1.5,2])for(const rr of [1,1.5,2,3])for(const horizonH of [12,24,48,72])VAR.push({stopAtr,rr,horizonH,costBps:9});
summary.exitVariants=VAR.map(p=>{const tr=POP.SIG_GATE.map(r=>sim(r,p)).filter(Boolean);const b=breakdown(tr,t=>period(t.T));
  return {p,IS:b.Y2024,Y2025:b.Y2025,Y2026:b.Y2026};});
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,1));
// Ekspor trade baseline untuk audit.
const rows=['population,cost_bps,symbol,side,family,decision_utc,period,status,m6_pre,m1,q80,m3,adx,exit,R,net_pct,funding_pct'];
for(const [k,tr] of Object.entries(allTrades))for(const t of tr){const [pop,cost]=k.split('@');const r=t.rec;
  rows.push([pop,cost,t.symbol,t.side,t.family,r.decision_available_utc,period(t.T),r.status,r._m6?.toFixed(3),r.scores.m1_100?.toFixed(3),r.scores.m2_signal_quality_80?.toFixed(3),r.scores.m3_100?.toFixed(3),r._adx?.toFixed(2),t.why,t.R.toFixed(4),(100*t.net).toFixed(4),(100*t.fund).toFixed(4)].join(','));}
fs.writeFileSync(path.join(OUT,'trades.csv.gz'),zlib.gzipSync(rows.join('\n')+'\n'));
const p=x=>x&&x.n?`n=${x.n} meanR=${x.meanR.toFixed(3)} t=${x.tStat?.toFixed(2)} win=${(100*x.winRate).toFixed(1)}% PF=${x.profitFactor?.toFixed(2)} eq=${x.sumEqPct.toFixed(1)}% DD=${x.maxDDPct.toFixed(1)}%`:'n=0';
for(const k of Object.keys(summary.populations)){console.log('\n== '+k+' '+p(summary.populations[k].all));for(const [pp,v] of Object.entries(summary.populations[k].byPeriod))console.log('   '+pp+' '+p(v));}
console.log('\nSelesai dalam '+((Date.now()-t0)/1000).toFixed(1)+' s');
module.exports={summary};

// ---------------- Diagnostik lanjutan (pra-deklarasi kelas hipotesis perbaikan) ----------------
const BTC_SEGS=segBy.get('BTCUSDT');
const btcDir=T=>{for(const a of BTC_SEGS){const i=a.idxOf.get(T-H4);if(i!==undefined)return a.m1At(i).direction||'INCOMPLETE';}return 'NA';};
for(const r of records)r._btc=btcDir(r._T);
const aligned=r=>(r._btc==='BULLISH'&&r.side==='LONG')||(r._btc==='BEARISH'&&r.side==='SHORT')?'ALIGNED':r._btc==='TRANSITION'?'BTC_TRANSITION':'COUNTER';
summary.diagnostics={
  sideByPeriod:breakdown(g9,t=>t.side+'|'+period(t.T)),
  btcRegime:breakdown(g9,t=>aligned(t.rec)+'|'+period(t.T)),
  sysSideByPeriod:breakdown(allTrades['SYS@9'],t=>t.side+'|'+period(t.T)),
  sysBtcRegime:breakdown(allTrades['SYS@9'],t=>aligned(t.rec)+'|'+period(t.T)),
  liquidityTier:breakdown(g9,t=>{const k=universe.indexOf(t.symbol);return (k<10?'TOP10':k<20?'TOP11-20':'TOP21-30')+'|'+period(t.T);}),
};
// Nilai ranking M6: alokasi kapasitas PRD (3 slot, 1/pair, risiko ≤3%, gross ≤100%, slot 24 jam) dengan urutan berbeda.
function allocate(trades,orderFn,holdMs=24*3600e3){
  const byT=new Map();for(const t of trades){if(!byT.has(t.T))byT.set(t.T,[]);byT.get(t.T).push(t);}
  let pos=[];const acc=[];
  for(const T of [...byT.keys()].sort((a,b)=>a-b)){
    pos=pos.filter(p=>p.rel>T);
    for(const t of orderFn(byT.get(T))){
      const risk=100*t.notionalFrac*t.riskFrac,gross=100*t.notionalFrac;
      if(pos.length>=3||pos.some(p=>p.s===t.symbol)||pos.reduce((s,p)=>s+p.risk,0)+risk>3+1e-9||pos.reduce((s,p)=>s+p.gross,0)+gross>100+1e-9)continue;
      pos.push({s:t.symbol,rel:T+holdMs,risk,gross});acc.push(t);
    }
  }
  return acc;
}
let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const byPer=tr=>{const b=breakdown(tr,t=>period(t.T));return Object.fromEntries(Object.entries(b).map(([k,v])=>[k,{n:v.n,meanR:v.meanR,sumEqPct:v.sumEqPct}]));};
const m6Desc=a=>a.slice().sort((x,y)=>(y.rec._m6??-1)-(x.rec._m6??-1)||x.symbol.localeCompare(y.symbol));
const randomRuns=[];for(let k=0;k<200;k++)randomRuns.push(byPer(allocate(g9,a=>a.map(x=>[rnd(),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]))));
const pct=(arr,q)=>{const v=arr.slice().sort((a,b)=>a-b);return v[Math.floor(q*(v.length-1))];};
summary.rankingValue={m6Desc:byPer(allocate(g9,m6Desc)),m6Asc:byPer(allocate(g9,a=>m6Desc(a).reverse())),
  randomMeanR:Object.fromEntries(['Y2024','Y2025','Y2026'].map(p=>[p,{p05:pct(randomRuns.map(r=>r[p]?.meanR??0),0.05),p50:pct(randomRuns.map(r=>r[p]?.meanR??0),0.5),p95:pct(randomRuns.map(r=>r[p]?.meanR??0),0.95)}]))};
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,1));
const q=x=>x&&x.n?`n=${String(x.n).padStart(4)} R=${x.meanR.toFixed(3).padStart(6)} t=${(x.tStat??0).toFixed(2).padStart(5)} eq=${x.sumEqPct.toFixed(0)}%`:'n=0';
for(const [n,b] of Object.entries(summary.diagnostics)){console.log('## '+n);for(const [g,v] of Object.entries(b))console.log('  '+g.padEnd(26)+q(v));}
console.log('## rankingValue',JSON.stringify(summary.rankingValue,null,0));

// ---------------- Ablation arsitektur: tiap lapis dimatikan / diganti; konsistensi per tahun ----------------
const crowd=new Map();for(const r of POP.SIG_GATE)crowd.set(r._T,(crowd.get(r._T)||0)+1);
summary.diagnostics.crowding=breakdown(g9,t=>{const n=crowd.get(t.T);return (n===1?'1':n<=3?'2-3':n<=6?'4-6':'7+')+'|'+period(t.T);});
function allocN(trades,orderFn,{slots=3,holdMs=24*3600e3}={}){
  const byT=new Map();for(const t of trades){if(!byT.has(t.T))byT.set(t.T,[]);byT.get(t.T).push(t);}
  let pos=[];const acc=[];
  for(const T of [...byT.keys()].sort((a,b)=>a-b)){
    pos=pos.filter(p=>p.rel>T);
    for(const t of orderFn(byT.get(T))){
      const risk=100*t.notionalFrac*t.riskFrac,gross=100*t.notionalFrac;
      if(pos.length>=slots||pos.some(p=>p.s===t.symbol)||pos.reduce((s,p)=>s+p.risk,0)+risk>3+1e-9||pos.reduce((s,p)=>s+p.gross,0)+gross>100+1e-9)continue;
      pos.push({s:t.symbol,rel:T+holdMs,risk,gross});acc.push(t);
    }
  }
  return acc;
}
const ORD={m6:m6Desc,m1m2q:a=>a.slice().sort((x,y)=>(y.rec.scores.m1_plus_m2q_0_180_display_only??-1)-(x.rec.scores.m1_plus_m2q_0_180_display_only??-1)||x.symbol.localeCompare(y.symbol)),
  liquid:a=>a.slice().sort((x,y)=>universe.indexOf(x.symbol)-universe.indexOf(y.symbol))};
const tradesFor=(recs,p)=>recs.map(r=>sim(r,p)).filter(Boolean);
const POOL_GATE=POP.SIG_GATE,POOL_NOGATE=POP.SIG_GATE.concat(POP.SIG_DIR_REJECT);
const cache=new Map();const tf=(name,recs,p)=>{const k=name+JSON.stringify(p);if(!cache.has(k))cache.set(k,tradesFor(recs,p));return cache.get(k);};
const ARCH=[
  ['A0 Baseline PRD (gate M1 pair, ranking M6, 3 slot, exit 1.5ATR/2R/24j)',{}],
  ['G1 Generator: Breakout saja',{filter:r=>r.signal_family==='BREAKOUT_RETEST'}],
  ['G2 Generator: Pullback saja',{filter:r=>r.signal_family==='PULLBACK_CONTINUATION'}],
  ['D1 Gate arah M1 pair DIMATIKAN',{pool:'nogate'}],
  ['D2 Gate rezim BTC menggantikan gate pair',{pool:'nogate',filter:r=>aligned(r)==='ALIGNED'}],
  ['D3 Gate pair + gate rezim BTC',{filter:r=>aligned(r)==='ALIGNED'}],
  ['D4 Gate pair + tolak hanya counter-BTC',{filter:r=>aligned(r)!=='COUNTER'}],
  ['R1 Ranking acak (median 200 run) — lihat rankingValue',{order:'random'}],
  ['R2 Ranking M1+M2q',{order:'m1m2q'}],
  ['R3 Ranking likuiditas',{order:'liquid'}],
  ['K1 Kapasitas 1 slot',{slots:1}],
  ['K2 Kapasitas 5 slot',{slots:5}],
  ['K3 Tanpa batas kapasitas (per sinyal)',{slots:999}],
  ['C1 Lewati close dengan ≥4 sinyal serentak',{filter:r=>crowd.get(r._T)<4}],
  ['X1 Exit horizon 48 jam (slot 48 jam)',{exit:{horizonH:48},holdMs:48*3600e3}],
  ['X2 Exit 2ATR/3R/48 jam',{exit:{stopAtr:2,rr:3,horizonH:48},holdMs:48*3600e3}],
  ['U1 Universe 6 pair inti PRD',{filter:r=>CORE.includes(r.symbol)}],
  ['B1 Gate pair + rezim BTC + skip ≥4 serentak',{filter:r=>aligned(r)==='ALIGNED'&&crowd.get(r._T)<4}],
];
summary.architecture=[];
for(const cost of [9,18])for(const [name,o] of ARCH){
  const p=Object.assign({},BASE,{costBps:cost},o.exit||{}),recs=(o.pool==='nogate'?POOL_NOGATE:POOL_GATE).filter(o.filter||(()=>true));
  const tr=tf(o.pool||'gate',o.pool==='nogate'?POOL_NOGATE:POOL_GATE,p).filter(t=>recs.includes(t.rec));
  let acc;
  if(o.order==='random'){const runs=[];for(let k=0;k<50;k++)runs.push(allocN(tr,a=>a.map(x=>[rnd(),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]),{slots:o.slots||3,holdMs:o.holdMs}));
    runs.sort((a,b)=>L.stats(a).meanR-L.stats(b).meanR);acc=runs[25];}
  else acc=allocN(tr,ORD[o.order||'m6'],{slots:o.slots||3,holdMs:o.holdMs});
  const by=breakdown(acc,t=>period(t.T)),all=L.stats(acc);
  summary.architecture.push({name,cost,all,byYear:by,consistent:['Y2024','Y2025','Y2026'].every(k=>by[k]&&by[k].meanR>0)});
}
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,1));
console.log('## crowding');for(const [g,v] of Object.entries(summary.diagnostics.crowding))console.log('  '+g.padEnd(16)+q(v));
for(const a of summary.architecture){const y=k=>a.byYear[k]?a.byYear[k].meanR.toFixed(3).padStart(6):'   —  ';
  console.log(`${String(a.cost).padStart(2)}bps ${a.name.padEnd(62).slice(0,62)} n=${String(a.all.n).padStart(4)} R=${a.all.meanR.toFixed(3).padStart(6)} t=${a.all.tStat.toFixed(2).padStart(5)} eq=${a.all.sumEqPct.toFixed(0).padStart(4)}% DD=${a.all.maxDDPct.toFixed(0).padStart(3)}% | 24:${y('Y2024')} 25:${y('Y2025')} 26:${y('Y2026')} ${a.consistent?'✓3/3':''}`);}
// Jumlah record per keluarga × status (melihat lapis mana yang membuang event).
summary.statusByFamily={};for(const r of records){const k=r.signal_family;summary.statusByFamily[k]=summary.statusByFamily[k]||{};summary.statusByFamily[k][r.status]=(summary.statusByFamily[k][r.status]||0)+1;}
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,1));
console.log('## statusByFamily',JSON.stringify(summary.statusByFamily));
