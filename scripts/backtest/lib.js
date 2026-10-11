'use strict';
/* Tahap A — pustaka backtest komposit di atas engine PRD v1.0.8 (tanpa mengubah engine).
   - Data: kline 4H + funding asli (data.binance.vision).
   - Gap: deret dipecah per segmen tanpa gap; jendela tidak pernah melintasi gap (tanpa interpolasi, PRD §1).
   - Keputusan: pipeline.decide per close 4H; M3 tetap basket enam pair PRD; kalibrasi = array beku (FROZEN).
   - Trade: entry open(t+1), stop k·ATR_entry, target R·stop, horizon H jam; stop lebih dulu bila keduanya tersentuh
     di candle yang sama; biaya round-trip (bps) atas notional + funding asli selama posisi terbuka. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const ROOT=path.resolve(__dirname,'../..');
const C=require(ROOT+'/engine/core'),M2=require(ROOT+'/engine/m2'),R=require(ROOT+'/engine/m3m4'),P=require(ROOT+'/engine/pipeline');
const H4=C.H4,CORE=C.PAIRS;
const FROZEN=M2.frozenFrom(JSON.parse(fs.readFileSync(ROOT+'/evidence/frozen_cdf_normalization.json','utf8')),JSON.parse(fs.readFileSync(ROOT+'/evidence/frozen_v2_normalizations.json','utf8')));

function loadKlines(dir,sym){
  const txt=zlib.gunzipSync(fs.readFileSync(path.join(dir,'kline',sym+'.csv.gz'))).toString();
  return txt.split('\n').filter(l=>/^\d/.test(l)).map(l=>{const v=l.split(',').map(Number);
    return {t:v[0],open:v[1],high:v[2],low:v[3],close:v[4],volume:v[5],ct:v[6],quoteVolume:v[7],trades:v[8],takerBuyBase:v[9]};});
}
function loadFunding(dir,sym){
  const f=path.join(dir,'funding',sym+'.csv.gz');if(!fs.existsSync(f))return [];
  return zlib.gunzipSync(fs.readFileSync(f)).toString().split('\n').filter(l=>/^\d/.test(l)).map(l=>{const v=l.split(',');return {t:Number(v[0]),rate:Number(v[v.length-1])};})
    .filter(x=>Number.isFinite(x.rate)).sort((a,b)=>a.t-b.t);
}
// Pecah deret menjadi segmen tanpa gap/duplikat (setiap segmen dianalisis terpisah).
function segments(candles,minLen=200){
  const c=candles.slice().sort((a,b)=>a.t-b.t),out=[];let cur=[];
  for(const x of c){if(cur.length&&x.t-cur[cur.length-1].t!==H4){if(cur.length>=minLen)out.push(cur);cur=[];}cur.push(x);}
  if(cur.length>=minLen)out.push(cur);return out;
}
/* Jalankan seluruh keputusan PRD untuk universe. Mengembalikan semua record + candle per simbol untuk evaluasi trade. */
function runDecisions({candlesBy,startMs,endMs,portfolioPairs=null}){
  const segBy=new Map(),allCloses=new Map();
  for(const [s,c] of candlesBy){
    const segs=segments(c).map(seg=>P.analyzeSymbol(s,seg,Infinity,{archive:true}));segBy.set(s,segs);
    const m=new Map();for(const a of segs)for(const x of a.c)m.set(x.t,x.close);allCloses.set(s,m);
  }
  const Ts=new Set();
  for(const [,segs] of segBy)for(const a of segs)for(const k of a.byTc.keys()){const T=a.c[k].t+H4;if(T>=startMs&&T<=endMs)Ts.add(T);}
  const order=[...Ts].sort((a,b)=>a-b),prov=M2.provider({frozen:FROZEN});
  let pf={positions:[]};const records=[],log=[];
  const openAt=new Map();for(const [s,c] of candlesBy)openAt.set(s,new Map(c.map(x=>[x.t,x.open])));
  for(const T of order){
    const an=new Map();
    for(const [s,segs] of segBy){const a=segs.find(a=>a.idxOf.has(T-H4));if(a&&(!portfolioPairs||portfolioPairs.includes(s)||CORE.includes(s)))an.set(s,a);}
    if(!CORE.every(s=>an.has(s))){/* basket M3 tidak lengkap → decide tetap jalan, M3 INCOMPLETE */}
    const res=P.decide(T,an,{provider:prov,portfolio:pf,entryOpen:s=>{const o=openAt.get(s).get(T);return Number.isFinite(o)?o:null;},log,pairs:CORE,closes:allCloses});
    pf=res.portfolio;for(const r of res.records)records.push(r);
  }
  return {records,segBy};
}
// Simulasi satu trade dari record PRD (entry open t+1) dengan aturan exit yang dapat divariasikan.
function simulate(rec,candles,funding,{stopAtr=1.5,rr=2,horizonH=24,costBps=9}={}){
  const T=Date.parse(rec.entry_reference_time_utc),side=rec.side==='LONG'?1:-1;
  const idx=candles.findIndex(x=>x.t===T);if(idx<0)return null;
  const entry=candles[idx].open,atr=rec.atr_entry??rec._atrEntry;if(!(entry>0&&atr>0))return null;
  const dist=stopAtr*atr,stop=entry-side*dist,target=entry+side*rr*dist;if(side===1&&stop<=0)return null;
  const n=Math.round(horizonH/4);let exit=null,why=null,exitT=null;
  for(let k=0;k<n;k++){const x=candles[idx+k];if(!x||x.t!==T+k*H4)return null;   // data terpotong / gap → tidak dinilai
    const sHit=side===1?x.low<=stop:x.high>=stop,tHit=side===1?x.high>=target:x.low<=target;
    if(sHit){exit=stop;why='STOP';exitT=x.t+H4;break;}if(tHit){exit=target;why='TARGET';exitT=x.t+H4;break;}
    if(k===n-1){exit=x.close;why='TIME';exitT=x.t+H4;}}
  const gross=side*(exit-entry)/entry;let fund=0;
  for(const f of funding){if(f.t<=T)continue;if(f.t>exitT)break;fund-=side*f.rate;}   // long membayar funding positif
  const net=gross-costBps/1e4+fund,riskFrac=dist/entry;
  // Ukuran posisi PRD: qty = min(1%·eq/dist, eq/entry) → bagian ekuitas yang dipertaruhkan
  const notionalFrac=Math.min(0.01/riskFrac,1);
  return {T,symbol:rec.symbol,side:rec.side,family:rec.signal_family,why,entry,exit,gross,fund,net,R:net/riskFrac,riskFrac,notionalFrac,eqPct:100*net*notionalFrac,exitT};
}
function stats(trades){
  const n=trades.length;if(!n)return {n:0};
  const R=trades.map(t=>t.R),eq=trades.map(t=>t.eqPct),mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const mR=mean(R),sd=Math.sqrt(R.reduce((s,v)=>s+(v-mR)**2,0)/Math.max(1,n-1));
  const wins=R.filter(r=>r>0),loss=R.filter(r=>r<=0);
  let peak=0,cum=0,mdd=0,streak=0,maxStreak=0;
  for(const t of trades.slice().sort((a,b)=>a.T-b.T)){cum+=t.eqPct;peak=Math.max(peak,cum);mdd=Math.max(mdd,peak-cum);if(t.R<=0){streak++;maxStreak=Math.max(maxStreak,streak);}else streak=0;}
  return {n,meanR:mR,tStat:sd>0?mR/(sd/Math.sqrt(n)):null,winRate:wins.length/n,profitFactor:loss.length?wins.reduce((s,v)=>s+v,0)/Math.abs(loss.reduce((s,v)=>s+v,0)):null,
    sumEqPct:eq.reduce((s,v)=>s+v,0),maxDDPct:mdd,maxLossStreak:maxStreak,meanNetPct:100*mean(trades.map(t=>t.net)),
    exits:{STOP:trades.filter(t=>t.why==='STOP').length,TARGET:trades.filter(t=>t.why==='TARGET').length,TIME:trades.filter(t=>t.why==='TIME').length},
    meanFundingPct:100*mean(trades.map(t=>t.fund))};
}
const yearOf=ms=>new Date(ms).getUTCFullYear();
module.exports={C,P,R,M2,FROZEN,H4,CORE,loadKlines,loadFunding,segments,runDecisions,simulate,stats,yearOf};
