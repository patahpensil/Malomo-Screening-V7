'use strict';
/* Tes engine Malomo V7 terhadap PRD v1.0.8: utilitas inti (paritas pandas/numpy), M1, generator (I01/I02/T04–T06,
   Pullback, Reversal), M2, M3, M4/portofolio (I05/I06), pipeline (T10–T20), dan kontrak JSON §10. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../engine/core'),M1=require('../engine/m1'),G=require('../engine/generators'),M2=require('../engine/m2'),R=require('../engine/m3m4'),P=require('../engine/pipeline');
const ROOT=path.resolve(__dirname,'..'),FIX=path.join(__dirname,'fixtures');
let count=0;const failures=[];
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(e){failures.push(name);console.log('FAIL '+name+' — '+String(e.message).split('\n')[0]);}}
const near=(a,b,eps=1e-9,msg)=>assert(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),(msg||'')+` ${a} ≠ ${b}`);
const H4=C.H4,T0=Date.UTC(2024,0,1);
// Candle sintetis dari tuple [open,high,low,close]; volume & taker deterministik.
const mk=(rows,t0=T0)=>rows.map(([o,h,l,c],i)=>({t:t0+i*H4,open:o,high:h,low:l,close:c,volume:1000+10*(i%7),quoteVolume:(1000+10*(i%7))*c,trades:100,takerBuyBase:550+5*(i%5)}));
const flat=(n,p=100)=>Array.from({length:n},()=>[p,p+1,p-1,p]);
// Jalur close berbentuk garis antar titik balik; high/low = close ± 0.5 → pivot ketat di titik balik.
function zigzag(points,step=1){const cl=[points[0]];for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k],n=Math.max(1,Math.round(Math.abs(b-a)/step));for(let j=1;j<=n;j++)cl.push(a+(b-a)*j/n);}
  return cl.map((c,i)=>{const o=i?(cl[i-1]+c)/2:c;return [o,Math.max(o,c)+0.5,Math.min(o,c)-0.5,c];});}
const analyze=c=>{const ind=C.indicators(c),piv=C.pivots(c);return {ind,piv};};
const ev1=JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_cdf_normalization.json'),'utf8'));
const ev2=JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_v2_normalizations.json'),'utf8'));
const FROZEN=M2.frozenFrom(ev1,ev2);

// ---------- inti ----------
const PD=JSON.parse(fs.readFileSync(path.join(FIX,'pandas_ewm_reference.json'),'utf8'));
test('ewm(alpha=1/14, adjust=False) identik pandas, termasuk peluruhan bobot saat NaN',()=>{
  const g=C.ewm(PD.gap_input.map(v=>v===null?NaN:v));PD.gap_ewm.forEach((v,i)=>near(g[i],v,1e-12));
});
test('ATR14 dan ADX14 identik referensi pandas (400 candle, toleransi 1e−9)',()=>{
  const c=PD.candles.map(x=>({t:x.t,open:x.open,high:x.high,low:x.low,close:x.close,volume:1}));const ind=C.indicators(c);
  PD.atr.forEach((v,i)=>v===null?assert(!Number.isFinite(ind.atr[i])):near(ind.atr[i],v));
  PD.adx.forEach((v,i)=>v===null?assert(!Number.isFinite(ind.adx[i])):near(ind.adx[i],v));
});
test('kuantil interpolasi linear = numpy; ECDF tie kanan (T08)',()=>{
  near(C.quantile(PD.quantile.x,0.1),PD.quantile.q10,1e-12);
  const V=[-0.3,0,0.2,0.2,0.7];assert.equal(C.ecdf(V,0.2),0.8);assert.equal(C.ecdf(V,-1),0);assert.equal(C.ecdf(V,9),1);
});
test('pivot 5-bar ketat: high sama tidak membentuk pivot; konfirmasi di i+2',()=>{
  const c=mk([...flat(5),[100,103,99,100],[100,103,99,100],...flat(5)]);assert.equal(C.pivots(c).highs.length,0);
  const d=mk([...flat(5),[100,103,99,100],...flat(5)]);const p=C.pivots(d).highs;assert.equal(p.length,1);assert.equal(p[0].i,5);assert.equal(p[0].confirm,7);
});
test('prepare: candle yang belum close dibuang; gap → CONFIRMED_GAP dan segmen dimulai sesudah gap (tanpa interpolasi)',()=>{
  const c=mk(flat(10));const r=C.prepare(c,c[9].t+H4-1);assert.equal(r.candles.length,9);
  const g=c.filter((_,i)=>i!==4),q=C.prepare(g,Infinity);assert(q.flags.some(f=>f.reason==='CONFIRMED_GAP'&&f.missing===1));assert.equal(q.segStart,4);
  const bad=mk(flat(3));bad[1].takerBuyBase=bad[1].volume+1;assert(C.prepare(bad,Infinity).flags.some(f=>f.reason==='DATA_INCOMPLETE'));
});

// ---------- M1 ----------
test('M1 = 45/22.5 + 25·TE + 10·ADX/50 + 20·tipikal; arah field terpisah; riwayat kurang → null (bukan 0)',()=>{
  const c=mk(zigzag([100,110,104,116,108,122,112,126,117,130,121,134,125,138,129,142,133,146,137,150,141,154,145,158,149,162,153,166,157,170]));
  const {ind,piv}=analyze(c),t=c.length-1,m=M1.score(c,ind,piv,t);
  assert.equal(m.status,'SCORED');assert.equal(m.direction,'BULLISH');
  let s=0;for(let j=t-13;j<=t;j++)s+=Math.abs(c[j].close-c[j-1].close);const te=Math.abs(c[t].close-c[t-14].close)/s;
  let cnt=0;for(let j=t-120;j<t;j++)if(ind.natr[j]<=ind.natr[t])cnt++;const p=cnt/120;
  near(m.score,45+25*C.clip(te)+10*C.clip(ind.adx[t]/50)+20*C.clip(1-2*Math.abs(p-0.5)),1e-12);
  const short=M1.score(c,ind,piv,100);assert.equal(short.score,null);assert.equal(short.status,'INCOMPLETE');
});
test('Contoh PRD §3: bullish, TE 0.6, ADX 25, persentil 0.5 → 85',()=>{near(45+25*0.6+10*C.clip(25/50)+20*C.clip(1-2*Math.abs(0.5-0.5)),85,1e-12);});

// ---------- Breakout ----------
// Pivot high di indeks 10 (high 105); candle lain datar high 101 / low 99.
const base=()=>{const r=flat(20);r[10]=[100,105,99,100];return r;};
test('I01/T04: wick menembus level tetapi close tidak → tidak ada break',()=>{
  const r=base();r.push([100,107,99.5,104.9],...flat(8));const c=mk(r),{ind,piv}=analyze(c);
  assert.equal(G.breakout(c,ind,piv,{symbol:'X'}).filter(e=>e.side==='LONG').length,0);
});
test('Breakout: retest + close konfirmasi di candle yang sama sah; generation30 = 15 + 10P + 5F',()=>{
  const r=base();r.push([100,107.5,99.5,107],[107,107,105.05,106],...flat(6,106));const c=mk(r),{ind,piv}=analyze(c);
  const e=G.breakout(c,ind,piv,{symbol:'X'}).find(x=>x.side==='LONG');
  assert.equal(e.status,'CONFIRMED');assert.equal(e.t0,20);assert.equal(e.tc,21);assert.equal(e.level,105);
  near(e.atrFrozen,ind.atr[19],1e-15);near(e.b,0.05*ind.atr[19],1e-15);
  const P_=C.clip(1-Math.abs(105.05-105)/(0.5*e.atrFrozen));near(e.generation.generation30,15+10*P_+5*1,1e-12);
});
test('T05: sentuhan pada candle break tidak dihitung sebagai retest → EXPIRED setelah W=6',()=>{
  const r=base();r.push([100,107.5,104.9,107],...Array.from({length:6},()=>[107,108,106.5,107.5]),...flat(2,107));const c=mk(r),{ind,piv}=analyze(c);
  const e=G.breakout(c,ind,piv,{symbol:'X'}).find(x=>x.side==='LONG');assert.equal(e.status,'EXPIRED');assert.equal(e.endIdx,26);
});
test('I02/T06: close invalidasi pada candle yang sama dengan sentuhan retest → INVALID',()=>{
  const r=base();r.push([100,107.5,99.5,107],[107,107,104,104.5],...flat(6,104));const c=mk(r),{ind,piv}=analyze(c);
  const e=G.breakout(c,ind,piv,{symbol:'X'}).find(x=>x.side==='LONG');assert.equal(e.status,'INVALID');assert.equal(e.endIdx,21);
});
test('Satu event per (pair, side, pivot); deret terpotong di arsip → CENSORED, live → tetap WAITING_RETEST',()=>{
  const r=base();r.push([100,107.5,99.5,107],[107,108,106.5,107.5]);const c=mk(r),{ind,piv}=analyze(c);
  const live=G.breakout(c,ind,piv,{symbol:'X'}).filter(x=>x.side==='LONG');assert.equal(live.length,1);assert.equal(live[0].status,'WAITING_RETEST');
  assert.equal(G.finalize(G.breakout(c,ind,piv,{symbol:'X'}),true).find(x=>x.side==='LONG').status,'CENSORED');
});

test('Breakout §4.2 (paritas arsip 410/410): pivot yang event-nya INVALID boleh membangkitkan event baru sesudahnya',()=>{
  const r=base();r.push([100,107.5,99.5,107],[107,107,104,104.5],[104.5,107.6,104.4,107.2],[107.2,107.3,105.05,106.5],...flat(4,106.5));const c=mk(r),{ind,piv}=analyze(c);
  const ev=G.breakout(c,ind,piv,{symbol:'X'}).filter(x=>x.side==='LONG');
  assert.equal(ev.length,2);assert.equal(ev[0].status,'INVALID');assert.equal(ev[1].keyIdx,ev[0].keyIdx);assert.equal(ev[1].t0,22);assert.equal(ev[1].status,'CONFIRMED');
});
test('Breakout §4.2: selama event masih aktif di satu sisi, pivot baru tidak membangkitkan event kedua',()=>{
  const r=base();r.push([100,107.5,106.2,107],[107,108,106.3,107.5],[107.5,112,107,108],[108,108.5,106.4,107.6],[107.6,108,106.3,107.7],[107.7,113,107.6,112.5],[112.5,113,111,112],...flat(4,112));
  const c=mk(r),{ind,piv}=analyze(c);assert(piv.highs.some(p=>p.i===22),'pivot baru terbentuk');
  const ev=G.breakout(c,ind,piv,{symbol:'X'}).filter(x=>x.side==='LONG');
  assert.equal(ev.filter(e=>e.t0>20&&e.t0<=26).length,0,'tidak boleh ada break baru sebelum event pertama selesai');
});
test('M2 E4 (paritas arsip): Breakout memakai penyebut + 1e−12 seperti array beku; Pullback/Reversal tanpa epsilon',()=>{
  const c=mk(zigzag([100,120]));const t=c.length-1;
  const b=M2.features(c,t,1,'BREAKOUT_RETEST').raw.e4,p=M2.features(c,t,1,'PULLBACK_CONTINUATION').raw.e4;
  assert.equal(p,1);assert(b<1&&b>1-1e-9);let d=0;for(let j=t-3;j<=t;j++)d+=Math.abs(Math.log(c[j].close/c[j-1].close));near(b,d/(d+1e-12),1e-15);
});
// ---------- Pullback ----------
const UP=[100,110,104,116,108,122];
test('Pullback: setup lahir di close i+2 saat tren BULLISH; zona 0.25–0.75; trigger micro-break; skor 5Q+10Loc+5+10Tim',()=>{
  const c=mk(zigzag([...UP,116,121,121.5]));const {ind,piv}=analyze(c);
  const e=G.pullback(c,ind,piv,{symbol:'X'}).find(x=>x.side==='LONG'&&x.p===piv.highs.at(-1).i);
  assert(e,'setup ada');assert.equal(e.createdIdx,e.p+2);assert.equal(e.H0,122.5);assert.equal(e.L0,107.5);
  assert.equal(e.status,'CONFIRMED');assert(e.dz>=0.25&&e.dz<=0.75);
  let s=0;for(let j=e.p+1;j<=e.z;j++)s+=Math.abs(c[j].close-c[j-1].close);const Q=Math.abs(c[e.p].close-c[e.z].close)/s;
  near(e.generation.generation30,5*Q+10*C.clip(1-Math.abs(e.dz-0.5)/0.35)+5+10*C.clip(1-(e.tc-e.z)/12),1e-12);
});
test('Pullback: kedalaman > 0.85 → INVALID (invalidasi lebih dahulu dari trigger)',()=>{
  const c=mk(zigzag([...UP,109.5,115]));const {ind,piv}=analyze(c);
  const e=G.pullback(c,ind,piv,{symbol:'X'}).find(x=>x.side==='LONG'&&x.p===piv.highs.at(-1).i);assert.equal(e.status,'INVALID');
});
test('Pullback: zona tak tersentuh sampai close i+26 → PREZONE_CENSORED tepat pada offset +24',()=>{
  const rows=zigzag([...UP,121]);for(let k=0;k<30;k++)rows.push([121,121.4,120.6,121]);
  const c=mk(rows),{ind,piv}=analyze(c);const e=G.pullback(c,ind,piv,{symbol:'X'}).find(x=>x.side==='LONG'&&x.p===piv.highs.at(-1).i);
  assert.equal(e.status,'PREZONE_CENSORED');assert.equal(e.endIdx,e.p+26);
});

// ---------- Reversal ----------
test('Reversal: M1_origin BULLISH, close di bawah HL terlindungi → SHORT; retest lalu close konfirmasi → CONFIRMED',()=>{
  const c=mk([...zigzag([...UP,108]),[108,108.2,106.8,107],[107,107.5,106.5,107.1],[107.1,107.2,105,105.5]]);const {ind,piv}=analyze(c);
  const e=G.reversal(c,ind,piv,{symbol:'X'}).find(x=>x.side==='SHORT');
  assert(e,'event ada');assert.equal(e.m1Origin,'BULLISH');assert.equal(e.level,107.5);
  assert.equal(e.status,'CONFIRMED');near(e.rawT,(-1*(c[e.t0].close-107.5)-e.b)/e.atrFrozen,1e-12);
  near(e.rawR,(-1*(c[e.tc].close-107.5)-e.b)/e.atrFrozen,1e-12);
});

// ---------- M2 ----------
test('T19: taker hilang → DATA_INCOMPLETE tanpa isi 0; fitur momentum sesuai rumus §4.5',()=>{
  const c=mk(zigzag([...UP,116,121]));const t=c.length-1;const f=M2.features(c,t,1);
  let n=0,d=0;for(let j=t-3;j<=t;j++){const r=Math.log(c[j].close/c[j-1].close);n+=r;d+=Math.abs(r);}near(f.raw.e4,n/d,1e-12);
  let m=0;for(let j=t-20;j<t;j++)m+=c[j].volume;near(f.raw.rvol,Math.log(c[t].volume/(m/20)),1e-12);
  c[t].takerBuyBase=undefined;const g=M2.features(c,t,1);assert(g.reasons.includes('TAKER_INCOMPLETE'));
  const q=M2.quality({family:'BREAKOUT_RETEST',generation:{generation30:20}},g,M2.provider({frozen:FROZEN}),0);assert.equal(q.status,'DATA_INCOMPLETE');assert.equal(q.quality80,null);
});
test('T18: integritas — log cek konflik hilang → AUDIT_INCOMPLETE; lengkap → 10+6+4',()=>{
  const a=M2.integrity({causalOk:true,dedupOk:true,conflictLog:null});assert.equal(a.status,'AUDIT_INCOMPLETE');assert(a.reasons.includes('CONFLICT_CHECK_NOT_LOGGED'));
  assert.equal(M2.integrity({causalOk:true,dedupOk:true,conflictLog:{checked:true,conflict:false}}).integrity20,20);
  assert.equal(M2.integrity({causalOk:false,dedupOk:true,conflictLog:{checked:true,conflict:false}}).integrity20,10);
});

// ---------- M3 ----------
const NM=JSON.parse(fs.readFileSync(path.join(FIX,'numpy_m3_reference.json'),'utf8'));
test('M3 identik numpy (korelasi 60 + ekor bersama 40, jendela berakhir di t−1)',()=>{
  const m=new Map(NM.pairs.map(s=>[s,new Map(NM.closes[s].map((v,i)=>[T0+i*H4,v]))]));
  const r=R.m3(m,T0+NM.t*H4,NM.pairs);assert.equal(r.status,'SCORED');
  near(r.components.correlation60,NM.correlation60,1e-10);near(r.components.tail40,NM.tail40,1e-12);near(r.score,NM.m3,1e-10);
});
test('T09: riwayat < 181 close → INCOMPLETE, bukan 0',()=>{
  const m=new Map(NM.pairs.map(s=>[s,new Map(NM.closes[s].map((v,i)=>[T0+i*H4,v]))]));
  const r=R.m3(m,T0+150*H4,NM.pairs);assert.equal(r.status,'INCOMPLETE');assert.equal(r.score,null);
});

// ---------- M4 & portofolio ----------
test('Rencana fixture §10: entry 100, ATR 2 → stop 97, target 106, qty 1/3, risiko 1%, gross 33.33%',()=>{
  const p=R.plan('LONG',100,2);near(p.stop,97,1e-15);near(p.target,106,1e-15);near(p.qty,1/3,1e-15);near(p.riskPct,1,1e-12);near(p.grossPct,100/3,1e-12);
});
test('T10/I05: gross 1× terlampaui → GROSS_CAP; pair aktif → PAIR_ACTIVE; slot penuh → POSITION_OR_RISK_CAP',()=>{
  const p=R.plan('LONG',100,2);
  assert.deepEqual(R.check('ETHUSDT',p,{positions:[{symbol:'BTCUSDT',risk:1,notional:80}]}).reasons,['GROSS_CAP']);
  assert(R.check('BTCUSDT',p,{positions:[{symbol:'BTCUSDT',risk:1,notional:10}]}).reasons.includes('PAIR_ACTIVE'));
  const three={positions:['A','B','C'].map(s=>({symbol:s,risk:0.5,notional:10}))};assert(R.check('D',p,three).reasons.includes('POSITION_OR_RISK_CAP'));
  const ok=R.check('ETHUSDT',p,{positions:[]});assert.equal(ok.m4,100);assert.deepEqual(ok.reasons,[]);
  assert.equal(R.check('ETHUSDT',p,{positions:[{symbol:'BTCUSDT',risk:1,notional:80}]}).m4,75);
});
test('I06: slot terisi 24 jam penuh; dilepas hanya oleh waktu, bukan stop/target',()=>{
  const pos={positions:[{symbol:'BTCUSDT',slotReleaseMs:T0+24*3600e3,risk:1,notional:30}]};
  assert.equal(R.release(pos,T0+24*3600e3-1).positions.length,1);assert.equal(R.release(pos,T0+24*3600e3).positions.length,0);
});
test('T15: snapshot M5 = 55 dengan cakupan BREAKOUT_2024_NO_DIRECTION_GATE',()=>{assert.equal(R.M5.score,55);assert.equal(R.M5.scope,'BREAKOUT_2024_NO_DIRECTION_GATE');});

// ---------- pipeline ----------
// Enam pair sintetis 230 candle; event disuntikkan supaya aturan kanonisasi/ranking/risiko teruji terpisah dari generator.
function world(){
  const out=new Map();
  NM.pairs.forEach((s,k)=>{
    const cl=NM.closes[s].concat(NM.closes[s].slice(-30));
    const rows=cl.map((v,i)=>{const o=i?cl[i-1]:v;return [o,Math.max(o,v)*1.002,Math.min(o,v)*0.998,v];});
    out.set(s,P.analyzeSymbol(s,mk(rows),Infinity));
  });
  return out;
}
const tIdx=200,TD=T0+(tIdx+1)*H4;
function inject(A,symbol,side,family,extra={}){
  const a=A.get(symbol),s=side==='LONG'?1:-1;
  const ev=Object.assign({family,symbol,side,sideN:s,keyIdx:tIdx-3,level:a.c[tIdx-1].close,t0:tIdx-1,tc:tIdx,atrFrozen:a.ind.atr[tIdx-2],b:0.01,r:0.02,status:'CONFIRMED',
    generation:{generation30:20},H0:110,L0:100,m1Origin:s===1?'BEARISH':'BULLISH',rawT:0.5,rawR:0.5},extra);
  if(!a.byTc.has(tIdx))a.byTc.set(tIdx,[]);a.byTc.get(tIdx).push(ev);a.m1Cache.set(tIdx,{score:70,status:'SCORED',direction:s===1?'BULLISH':'BEARISH',reasons:[],components:{}});
  return ev;
}
const prov=M2.provider({frozen:FROZEN});
test('T11: LONG dan SHORT pada pair-waktu sama → CONFLICTING_DIRECTIONS, tidak diranking, M6 null',()=>{
  const A=world();inject(A,'BTCUSDT','LONG','BREAKOUT_RETEST');inject(A,'BTCUSDT','SHORT','BREAKOUT_RETEST');
  const r=P.decide(TD,A,{provider:prov,entryOpen:()=>100}).records;assert.equal(r.length,2);
  for(const x of r){assert.equal(x.status,'CONFLICTING_DIRECTIONS');assert.equal(x.scores.m6_confluense_500,null);}
});
test('T12/T13: dua keluarga pada key sama → MULTI_METHOD_COLLISION; label identik digabung (duplicate_count)',()=>{
  const A=world();inject(A,'ETHUSDT','LONG','BREAKOUT_RETEST');inject(A,'ETHUSDT','LONG','PULLBACK_CONTINUATION');
  assert(P.decide(TD,A,{provider:prov}).records.every(x=>x.status==='MULTI_METHOD_COLLISION'));
  const B=world();inject(B,'ETHUSDT','LONG','BREAKOUT_RETEST');inject(B,'ETHUSDT','LONG','BREAKOUT_RETEST');
  const r=P.decide(TD,B,{provider:prov}).records;assert.equal(r.length,1);assert.equal(r[0].duplicate_count,1);
});
test('Gate arah §8.1.2: Breakout LONG saat M1 BEARISH → REJECTED_DIRECTION; Reversal SHORT perlu M1_origin BULLISH',()=>{
  const A=world();inject(A,'SOLUSDT','LONG','BREAKOUT_RETEST');A.get('SOLUSDT').m1Cache.get(tIdx).direction='BEARISH';
  assert.equal(P.decide(TD,A,{provider:prov}).records[0].status,'REJECTED_DIRECTION');
  const B=world();inject(B,'SOLUSDT','SHORT','REVERSAL_RETEST',{m1Origin:'TRANSITION'});
  assert.equal(P.decide(TD,B,{provider:prov}).records[0].status,'REJECTED_DIRECTION');
});
test('T16/T17: ranking M6 menurun tanpa ambang; slot terbatas → yang lebih tinggi ENTRY_CONSIDER, sisanya REJECTED_RISK',()=>{
  const A=world();inject(A,'BTCUSDT','LONG','BREAKOUT_RETEST',{generation:{generation30:30}});inject(A,'ETHUSDT','LONG','BREAKOUT_RETEST',{generation:{generation30:5}});
  const full={positions:[{symbol:'BNBUSDT',risk:0.5,notional:10,slotReleaseMs:TD+1},{symbol:'XRPUSDT',risk:0.5,notional:10,slotReleaseMs:TD+1}]};
  const res=P.decide(TD,A,{provider:prov,portfolio:full,entryOpen:()=>A.get('BTCUSDT').c[tIdx+1].open});
  const [a,b]=res.records;assert.equal(a.symbol,'BTCUSDT');assert.equal(a.status,'ENTRY_CONSIDER');assert.equal(b.status,'REJECTED_RISK');
  assert(b.reasons.includes('POSITION_OR_RISK_CAP'));assert.equal(b.scores.m6_confluense_500,null);
  near(a.scores.m6_confluense_500,a.scores.m1_100+a.scores.m2_100+a.scores.m3_100+100+55,1e-12);
  near(a.scores.m6_display_pct_not_winrate,a.scores.m6_confluense_500/5,1e-12);assert(a.scores.m6_confluense_500>0);
});
test('Tie-break §8.1.5: (M6↓, M2q↓, M1↓, simbol↑, LONG dulu, keluarga↑)',()=>{
  const r=[{_m6:390,_q80:50,_m1:95,symbol:'X',side:'LONG',signal_family:'B'},{_m6:395,_q80:60,_m1:80,symbol:'Y',side:'LONG',signal_family:'B'},
    {_m6:395,_q80:60,_m1:80,symbol:'Y',side:'SHORT',signal_family:'A'},{_m6:395,_q80:60,_m1:80,symbol:'A',side:'SHORT',signal_family:'A'}];
  r.sort(P.compare);assert.deepEqual(r.map(x=>x.symbol+x.side),['ASHORT','YLONG','YSHORT','XLONG']);
});
test('Fase CLOSE_CANDIDATE: tanpa open berikutnya harga null dan M6 null; T20 determinisme',()=>{
  const A=world();inject(A,'BTCUSDT','LONG','BREAKOUT_RETEST');const r=P.decide(TD,A,{provider:prov}).records[0];
  assert.equal(r.status,'CLOSE_CANDIDATE');assert.equal(r.entry_reference_open,null);assert.equal(r.scores.m6_confluense_500,null);assert.deepEqual(r.reasons,[]);
  const B=world();inject(B,'BTCUSDT','LONG','BREAKOUT_RETEST');assert.equal(JSON.stringify(P.decide(TD,B,{provider:prov}).records),JSON.stringify(P.decide(TD,A,{provider:prov}).records));
});
test('Kontrak JSON §10: field wajib ada; waktu konfirmasi = keputusan = referensi entry; status tiga lapis sah',()=>{
  const A=world();inject(A,'BTCUSDT','LONG','BREAKOUT_RETEST');inject(A,'ETHUSDT','SHORT','PULLBACK_CONTINUATION');A.get('ETHUSDT').m1Cache.get(tIdx).direction='BULLISH';
  const recs=P.decide(TD,A,{provider:prov,entryOpen:s=>A.get(s).c[tIdx+1].open}).records;
  const REQ=['schema','event_status','score_status','status','reasons','research_only','symbol','timeframe','break_utc','confirmation_utc','decision_available_utc','entry_reference_time_utc','side','signal_family','market_structure_direction','m1_origin_direction','scores','equity_sim','atr_entry','atr_frozen','entry_reference_open','stop_price','target_price','qty','risk_pct','gross_pct','rr_target','max_holding_hours','invalidation','normalization_version','risk_mandate_version','m5_snapshot','data_quality_flags','source_labels','audit_trail'];
  const EVENT=new Set(['WAITING_RETEST','WAITING_ZONE','WAITING_CONTINUATION','CHOCH_CANDIDATE','CONFIRMED','INVALID','EXPIRED','CENSORED','PREZONE_CENSORED','UNSUPPORTED_FOR_SCORING','CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION']);
  const SCORE=new Set(['SCORED','NOT_APPLICABLE','INCOMPLETE','DATA_INCOMPLETE','CALIBRATION_INCOMPLETE','SCORE_INCOMPLETE','AUDIT_INCOMPLETE','NO_SCORE']);
  const DEC=new Set(['CLOSE_CANDIDATE','ENTRY_CONSIDER','NO_ENTRY','REJECTED_DIRECTION','REJECTED_INTEGRITY','REJECTED_RISK','CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION','RESEARCH_ONLY']);
  for(const r of recs){
    for(const k of REQ)assert(k in r,'field '+k);
    assert(EVENT.has(r.event_status)&&SCORE.has(r.score_status)&&DEC.has(r.status));
    assert(r.confirmation_utc===r.decision_available_utc&&r.decision_available_utc===r.entry_reference_time_utc);
    if(r.status==='ENTRY_CONSIDER')assert.deepEqual(r.reasons,[]);else if(r.status!=='CLOSE_CANDIDATE')assert(r.reasons.length>0);
    if(r.status!=='ENTRY_CONSIDER')assert.equal(r.scores.m6_confluense_500,null);
    if(r.signal_family==='PULLBACK_CONTINUATION')assert.equal(r.break_utc,null);
    assert.equal(r.research_only,true);
  }
  assert(recs.some(r=>r.status==='REJECTED_DIRECTION'));
});

test('Replay end-to-end 6 pair sintetis: jalan, kausal, status sah, portofolio tidak melampaui mandat',()=>{
  const cbs={};NM.pairs.forEach(s=>{const cl=NM.closes[s];cbs[s]=mk(cl.map((v,i)=>{const o=i?cl[i-1]:v,w=0.001+0.003*(((i*7+s.length)%11)/11);return [o,Math.max(o,v)*(1+w),Math.min(o,v)*(1-w*0.9),v];}));});
  const res=P.replay(cbs,{frozen:FROZEN,startMs:T0,endMs:T0+400*H4});
  for(const r of res.records){assert(r.status);assert.equal(r.research_only,true);if(r.status!=='ENTRY_CONSIDER')assert.equal(r.scores.m6_confluense_500,null);}
  assert(res.log.filter(x=>x.type==='CYCLE').length>=150);
  const confirmed=[...res.analyses.values()].flatMap(a=>a.events).filter(e=>e.status==='CONFIRMED').length;assert(confirmed>0,'replay harus menghasilkan event');assert(res.records.length>0);
  const byT={};for(const r of res.records.filter(x=>x.status==='ENTRY_CONSIDER'))(byT[r.decision_available_utc]=byT[r.decision_available_utc]||[]).push(r);
  for(const k in byT)assert(byT[k].reduce((s,r)=>s+r.gross_pct,0)<=100+1e-9);
});
console.log(`\n${count} PASS, ${failures.length} FAIL`);
if(failures.length)process.exit(1);
