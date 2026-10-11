'use strict';
/* Tes PRD v1.0.11 — R32 rencana eksekusi siap salin (pembulatan tick/step, qty dari risiko, leverage aman, aturan pair,
   validasi input) dan R33 label rezim BTC (informatif, bukan gate). Dipakai untuk uang nyata: setiap invarian keamanan
   diuji juga pada ribuan kasus acak deterministik. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const X=require('../app/exec'),Cy=require('../app/cycle'),C=require('../engine/core'),M1=require('../engine/m1'),M2=require('../engine/m2'),S=require('./synthetic');
const ROOT=path.resolve(__dirname,'..'),H4=C.H4;
let count=0;const failures=[];const queue=[];
const test=(n,f)=>queue.push([n,f]);

// ---------- utilitas tes ----------
function rng(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
// Cek "kelipatan tepat" berbasis string + BigInt (independen dari implementasi snap).
function isMultiple(str,stepStr){
  const dec=Math.max((str.split('.')[1]||'').length,(stepStr.split('.')[1]||'').length);
  const toInt=v=>{const [a,b='']=v.split('.');return BigInt(a+b.padEnd(dec,'0'));};
  const st=toInt(stepStr);return st>0n&&toInt(str)%st===0n;
}
const rulesFor=(sym,tick,step,minQty,minNotional,status='TRADING')=>({symbol:sym,status,tickSize:tick,stepSize:step,minQty,maxQty:Infinity,minNotional});
const SET={capital:'1000',riskPct:'0.5',costBps:'18'};

// ---------- desimal & pembulatan ----------
test('decimalsOf/makeGrid: trailing zero diabaikan, input tidak sah ditolak',()=>{
  assert.equal(X.decimalsOf('0.10'),1);assert.equal(X.decimalsOf('0.00001000'),5);assert.equal(X.decimalsOf('1'),0);assert.equal(X.decimalsOf('10'),0);assert.equal(X.decimalsOf('1.000'),0);
  for(const bad of ['', 'abc','-0.1','1e-5','0.1.2'])assert.equal(X.decimalsOf(bad),null,bad);
  assert.equal(X.makeGrid('0'),null);assert.equal(X.makeGrid('0.000'),null);
  const g=X.makeGrid('0.000010');assert.deepEqual([g.dec,g.scale,g.unit],[5,1e5,1]);
  const g10=X.makeGrid('10');assert.deepEqual([g10.dec,g10.scale,g10.unit],[0,1,10]);
  const g25=X.makeGrid('0.25');assert.deepEqual([g25.dec,g25.unit],[2,25]);
});
test('snap: 4 arah × tick 0.1 / 0.01 / 0.00001 / 0.0000001 / 0.25 / 10, hasil kelipatan tepat dan maksimal 1 tick',()=>{
  const cases=[['0.1',60123.456],['0.01',2512.3456],['0.00001',0.1623477],['0.0000001',0.00001234567],['0.25',101.13],['10',12345]];
  for(const [t,x] of cases){
    const g=X.makeGrid(t),d=X.snap(x,g,'down'),u=X.snap(x,g,'up');
    assert(d.num<=x+1e-12&&u.num>=x-1e-12,t);assert(x-d.num<Number(t)+1e-12&&u.num-x<Number(t)+1e-12,t);
    assert(isMultiple(d.str,t)&&isMultiple(u.str,t),t+' '+d.str+' '+u.str);
    assert.equal(d.str.split('.')[1]?.length||0,g.dec);
  }
});
test('snap: nilai yang sudah di grid tidak bergeser oleh galat float (0.3, 0.7, 1.1, 0.00003)',()=>{
  for(const [t,x,want] of [['0.1',0.3,'0.3'],['0.1',0.7,'0.7'],['0.1',1.1,'1.1'],['0.00001',0.00003,'0.00003'],['0.01',0.29,'0.29'],['0.001',4.35,'4.350']]){
    const g=X.makeGrid(t);assert.equal(X.snap(x,g,'down').str,want,t+' down');assert.equal(X.snap(x,g,'up').str,want,t+' up');
  }
});
test('snap regresi (ditemukan uji acak): nilai besar sedikit di bawah grid tetap dibulatkan ke bawah, bukan naik',()=>{
  const g=X.makeGrid('0.5');
  assert.equal(X.snap(7480710.499863009,g,'down').str,'7480710.0');assert.equal(X.snap(7480710.499863009,g,'up').str,'7480710.5');
  const g1=X.makeGrid('0.1');assert.equal(X.snap(123456.0999,g1,'down').str,'123456.0');assert.equal(X.snap(123456.0001,g1,'up').str,'123456.1');
  // ribuan nilai besar acak: hasil down ≤ x ≤ hasil up, selisih < 1 tick
  const rnd=rng(7);
  for(let k=0;k<20000;k++){const t=['0.1','0.5','0.01','1','10'][k%5],gg=X.makeGrid(t),x=Number(t)*(1e3+rnd()*1e7)+rnd()*Number(t);
    const d=X.snap(x,gg,'down'),u=X.snap(x,gg,'up');assert(Number(d.str)<=x&&Number(u.str)>=x,`${x} ${t} → ${d.str}/${u.str}`);assert(isMultiple(d.str,t)&&isMultiple(u.str,t));}
});

// ---------- aturan pair ----------
const EI={symbols:[
  {symbol:'BTCUSDT',status:'TRADING',filters:[{filterType:'PRICE_FILTER',minPrice:'261.10',maxPrice:'809484',tickSize:'0.10'},{filterType:'LOT_SIZE',stepSize:'0.001',maxQty:'1000',minQty:'0.001'},{filterType:'MARKET_LOT_SIZE',stepSize:'0.001',maxQty:'120',minQty:'0.001'},{filterType:'MIN_NOTIONAL',notional:'100'}]},
  {symbol:'ETHUSDT',status:'TRADING',filters:[{filterType:'PRICE_FILTER',tickSize:'0.01'},{filterType:'LOT_SIZE',stepSize:'0.001',maxQty:'10000',minQty:'0.001'},{filterType:'MIN_NOTIONAL',notional:'20'}]},
  // varian gabungan seperti contoh dokumentasi
  {symbol:'SOLUSDT',status:'TRADING',filters:[{filterType:'PRICE_FILTER',tickSize:'0.0100',minQty:'0.01',maxQty:'1000000',stepSize:'0.01',notional:'5.0'}]},
  {symbol:'BNBUSDT',status:'SETTLING',filters:[{filterType:'PRICE_FILTER',tickSize:'0.010'},{filterType:'LOT_SIZE',stepSize:'0.01',maxQty:'100000',minQty:'0.01'},{filterType:'MIN_NOTIONAL',notional:'5'}]},
  {symbol:'DOGEUSDT',status:'TRADING',filters:[{filterType:'PRICE_FILTER',tickSize:'abc'},{filterType:'LOT_SIZE',stepSize:'1',minQty:'1'},{filterType:'MIN_NOTIONAL',notional:'5'}]},
  {symbol:'XRPUSDT',status:'TRADING',filters:[{filterType:'LOT_SIZE',stepSize:'0.1',minQty:'0.1'},{filterType:'MIN_NOTIONAL',notional:'5'}]},
  {symbol:'OTHERUSDT',status:'TRADING',filters:[{filterType:'PRICE_FILTER',tickSize:'0.1'},{filterType:'LOT_SIZE',stepSize:'1',minQty:'1'},{filterType:'MIN_NOTIONAL',notional:'5'}]},
]};
test('parseRules: format resmi + varian gabungan; tick tidak sah/hilang → pair tanpa aturan (bukan tebakan)',()=>{
  const r=X.parseRules(EI,C.PAIRS);
  assert.deepEqual(Object.keys(r).sort(),['BNBUSDT','BTCUSDT','ETHUSDT','SOLUSDT']);
  assert.deepEqual(r.BTCUSDT,{symbol:'BTCUSDT',status:'TRADING',tickSize:'0.10',stepSize:'0.001',minQty:0.001,maxQty:1000,minNotional:100});
  assert.equal(r.SOLUSDT.tickSize,'0.0100');assert.equal(r.SOLUSDT.stepSize,'0.01');assert.equal(r.SOLUSDT.minNotional,5);
  assert.equal(r.BNBUSDT.status,'SETTLING');assert(!('OTHERUSDT' in r),'hanya 6 pair aplikasi');
  assert.deepEqual(X.parseRules(null,C.PAIRS),{});assert.deepEqual(X.parseRules({symbols:'x'},C.PAIRS),{});
});

// ---------- validasi pengaturan ----------
test('validateSettings: modal wajib > 0, risiko 0,5–1%, biaya 0–50 bps, koma desimal diterima',()=>{
  assert.equal(X.validateSettings({capital:''}).errors.capital,'EMPTY');
  for(const c of ['0','-5','abc','1e12'])assert.equal(X.validateSettings({capital:c}).errors.capital,'INVALID',c);
  const ok=X.validateSettings({capital:'1000,5',riskPct:'0,75',costBps:'9'});assert(ok.ok);assert.equal(ok.capital,1000.5);assert.equal(ok.riskPct,0.75);assert.equal(ok.costBps,9);
  for(const r of ['0.4','1.1','0','-1','x'])assert.equal(X.validateSettings({capital:'1',riskPct:r}).errors.riskPct,'INVALID',r);
  for(const r of ['0.5','1'])assert(X.validateSettings({capital:'1',riskPct:r}).ok,r);
  for(const c of ['-1','51','x'])assert.equal(X.validateSettings({capital:'1',costBps:c}).errors.costBps,'INVALID',c);
  const d=X.validateSettings({capital:'5'});assert.equal(d.riskPct,0.5);assert.equal(d.costBps,18);
});

// ---------- rencana ----------
const DOGE=rulesFor('DOGEUSDT','0.000010','1',1,5);
const dogeInput={symbol:'DOGEUSDT',side:'LONG',entry:0.162347,stop:0.162347-0.00618,target:0.162347+2*0.00618};
test('Contoh dihitung manual (DOGE LONG, modal 1000, risiko 0,5%, biaya 18 bps): angka tepat',()=>{
  const p=X.plan(dogeInput,SET,DOGE);
  assert.equal(p.status,'READY');assert.deepEqual(p.priceStr,{entry:'0.16234',stop:'0.15616',target:'0.17470'});
  // qty = floor(5 / (0.00618 + 0.0018×0.16234)) = floor(772.53…) = 772
  assert.equal(p.qtyStr,'772');assert(Math.abs(p.lossAtStop-772*(0.00618+0.0018*0.16234))<1e-9);assert(p.lossAtStop<=5);
  // leverage aman = floor(1/(2×0.00618/0.16234 + 0.01)) = floor(11.6…) = 11
  assert.equal(p.leverage,11);assert(Math.abs(p.margin-772*0.16234/11)<1e-9);assert(p.liqPct/100>=2*p.stopPct/100);
});
test('Arah pembulatan aman: LONG semua ke bawah, SHORT semua ke atas (entry tidak lebih mahal, SL menjauh, TP mendekat)',()=>{
  const g='0.01';const R=rulesFor('ETHUSDT',g,'0.001',0.001,20);
  const L=X.plan({symbol:'ETHUSDT',side:'LONG',entry:2512.3456,stop:2450.1234,target:2636.789},SET,R);
  assert.deepEqual(L.priceStr,{entry:'2512.34',stop:'2450.12',target:'2636.78'});
  const Sh=X.plan({symbol:'ETHUSDT',side:'SHORT',entry:2512.3456,stop:2574.5678,target:2387.9012},SET,R);
  assert.deepEqual(Sh.priceStr,{entry:'2512.35',stop:'2574.57',target:'2387.91'});
});
test('Status: modal kosong → NEED_SETTINGS; input salah → INVALID_SETTINGS; aturan tidak ada → UNROUNDED tanpa string salin',()=>{
  assert.equal(X.plan(dogeInput,{capital:''},DOGE).status,'NEED_SETTINGS');
  assert.equal(X.plan(dogeInput,{capital:'1000',riskPct:'2'},DOGE).status,'INVALID_SETTINGS');
  const u=X.plan(dogeInput,SET,null);assert.equal(u.status,'UNROUNDED');assert.equal(u.priceStr,null);assert.equal(u.qtyStr,null);assert(u.lossAtStop<=5+1e-9);
  assert.equal(X.plan({symbol:'DOGEUSDT',side:'LONG',entry:null,stop:1,target:2},SET,DOGE).status,'NO_PLAN');
  assert.equal(X.plan({symbol:'DOGEUSDT',side:'X',entry:1,stop:0.9,target:1.2},SET,DOGE).status,'NO_PLAN');
});
test('Tidak bisa dieksekusi: min notional, min qty, pair bukan TRADING, margin > modal, geometri rusak setelah pembulatan',()=>{
  const btc={symbol:'BTCUSDT',side:'LONG',entry:60000,stop:58800,target:62400};
  const small=X.plan(btc,{capital:'100',riskPct:'0.5'},rulesFor('BTCUSDT','0.10','0.001',0.001,100));
  assert.equal(small.status,'NOT_EXECUTABLE');assert(small.reasons.includes('BELOW_MIN_NOTIONAL')&&small.reasons.includes('BELOW_MIN_QTY'),small.reasons.join());
  const ok=X.plan(btc,{capital:'10000',riskPct:'1'},rulesFor('BTCUSDT','0.10','0.001',0.001,100));assert.equal(ok.status,'READY');
  assert.equal(X.plan(btc,{capital:'10000',riskPct:'1'},rulesFor('BTCUSDT','0.10','0.001',0.001,100,'SETTLING')).status,'PAIR_NOT_TRADING');
  // jarak stop 0,005% di alt (leverage dibatasi 50×) → margin 2× modal
  const tiny=X.plan({symbol:'SOLUSDT',side:'LONG',entry:200,stop:199.99,target:200.02},{capital:'1000',riskPct:'1',costBps:'0'},rulesFor('SOLUSDT','0.01','0.01',0.01,5));
  assert(tiny.reasons.includes('MARGIN_EXCEEDS_CAPITAL'),tiny.reasons.join());assert.equal(tiny.leverage,50);
  const geo=X.plan({symbol:'SOLUSDT',side:'LONG',entry:200.004,stop:200.001,target:200.009},SET,rulesFor('SOLUSDT','0.01','0.01',0.01,5));
  assert.equal(geo.status,'NOT_EXECUTABLE');assert(geo.reasons.includes('PLAN_GEOMETRY'));
});
test('Leverage aman: rumus, batas bawah 1×, batas pribadi BTC 150× / ETH 125× / alt 50×',()=>{
  assert.equal(X.safeLeverage(0.0186,'BTCUSDT'),Math.floor(1/(2*0.0186+0.004)));
  assert.equal(X.safeLeverage(0.0256,'ETHUSDT'),Math.floor(1/(2*0.0256+0.005)));
  assert.equal(X.safeLeverage(0.6,'SOLUSDT'),1);assert.equal(X.safeLeverage(0,'SOLUSDT'),null);
  assert.equal(X.safeLeverage(1e-6,'BTCUSDT'),150);assert.equal(X.safeLeverage(1e-6,'ETHUSDT'),125);assert.equal(X.safeLeverage(1e-6,'XRPUSDT'),50);
});

// ---------- properti acak (uang nyata: invarian tidak boleh dilanggar satu kali pun) ----------
test('Properti 5.000 kasus acak: risiko nyata ≤ batas, kelipatan tick/step tepat, arah pembulatan, likuidasi ≥ 2× jarak SL',()=>{
  const rnd=rng(20261011),TICKS=['0.1','0.01','0.001','0.0001','0.00001','0.000001','0.0000001','0.25','0.5','1','10'],STEPS=['0.001','0.01','0.1','1','10','100'];
  const SYMS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT','XRPUSDT'];
  let ready=0;
  for(let k=0;k<5000;k++){
    const tick=TICKS[Math.floor(rnd()*TICKS.length)],step=STEPS[Math.floor(rnd()*STEPS.length)],sym=SYMS[Math.floor(rnd()*SYMS.length)];
    const price=Number(tick)*Math.round(10**(1+rnd()*6)*(1+rnd())),atrFrac=0.002+rnd()*0.06,side=rnd()<0.5?'LONG':'SHORT',s=side==='LONG'?1:-1;
    const entry=price*(1+(rnd()-0.5)*1e-3),dist=1.5*atrFrac*entry,stop=entry-s*dist,target=entry+s*2*dist;
    if(!(stop>0))continue;
    const set={capital:String(Math.round(10**(1+rnd()*5))),riskPct:String(0.5+rnd()*0.5),costBps:String(Math.round(rnd()*50))};
    const p=X.plan({symbol:sym,side,entry,stop,target},set,rulesFor(sym,tick,step,Number(step),0));
    if(p.status==='NOT_EXECUTABLE'&&p.reasons.includes('PLAN_GEOMETRY'))continue;
    assert(['READY','NOT_EXECUTABLE'].includes(p.status),p.status);
    const ps=p.priceStr;
    for(const k2 of ['entry','stop','target'])assert(isMultiple(ps[k2],tick),k2+' '+ps[k2]+' tick '+tick);
    assert(isMultiple(p.qtyStr,step),'qty '+p.qtyStr+' step '+step);
    const E=Number(ps.entry),SL=Number(ps.stop),TP=Number(ps.target),Q=Number(p.qtyStr);
    const dirMsg=`${side} raw ${entry},${stop},${target} → ${ps.entry},${ps.stop},${ps.target} tick ${tick}`;
    if(s===1){assert(E<=entry*(1+1e-12)&&SL<=stop*(1+1e-12)&&TP<=target*(1+1e-12),dirMsg);}else{assert(E>=entry*(1-1e-12)&&SL>=stop*(1-1e-12)&&TP>=target*(1-1e-12),dirMsg);}
    // risiko dihitung ulang independen dari string harga
    const cap=Number(set.capital),budget=cap*Number(set.riskPct)/100,lossInd=Q*(Math.abs(E-SL)+Number(set.costBps)/1e4*Math.max(E,SL));
    assert(lossInd<=budget*(1+1e-9)+1e-12,`rugi ${lossInd} > anggaran ${budget}`);
    assert(Number(set.riskPct)<=1+1e-12,"risk");
    // leverage aman: perkiraan jarak likuidasi ≥ 2 × jarak SL
    const sf=Math.abs(E-SL)/E;assert(Number.isInteger(p.leverage)&&p.leverage>=1);
    assert(1/p.leverage-X.mmrOf(sym)>=2*sf-1e-12||p.leverage===1,`L ${p.leverage} sf ${sf}`);
    if(p.status==='READY')ready++;
  }
  assert(ready>1000,'kasus READY terlalu sedikit: '+ready);
});

// ---------- record PRD tidak berubah ----------
const FROZEN=M2.frozenFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_v2_normalizations.json'),'utf8')));
const RAW=S.generate({n:1600});
const STATE=Cy.buildState({rawBySymbol:Object.fromEntries(Object.entries(RAW).map(([s,r])=>[s,r.map(Cy.toCandle)])),now:RAW.BTCUSDT[RAW.BTCUSDT.length-1][0]+10000,frozen:FROZEN});
test('R32/R33 lapisan tampilan: rencana & label tidak mengubah record audit, status, skor, atau portofolio',()=>{
  const before=JSON.stringify(STATE.history.map(Cy.publicRecord))+JSON.stringify(STATE.book.active.map(p=>[p.symbol,p.entry,p.stop,p.target,p.qty]));
  const rules=Object.fromEntries(C.PAIRS.map(s=>[s,rulesFor(s,'0.01','0.001',0.001,5)]));
  let n=0;
  for(const r of STATE.history){
    Cy.btcRegime(STATE.analyses,r);
    if(r.status==='ENTRY_CONSIDER'){const p=X.plan({symbol:r.symbol,side:r.side,entry:r.entry_reference_open,stop:r.stop_price,target:r.target_price},SET,rules[r.symbol]);assert(['READY','NOT_EXECUTABLE'].includes(p.status));n++;}
  }
  assert(n>0);
  const after=JSON.stringify(STATE.history.map(Cy.publicRecord))+JSON.stringify(STATE.book.active.map(p=>[p.symbol,p.entry,p.stop,p.target,p.qty]));
  assert.equal(after,before);
  for(const r of STATE.history)assert(!('btc_regime' in r)&&!('exec_plan' in r));
});

// ---------- R33 ----------
test('Rezim BTC: lima kondisi (searah, berlawanan, transisi, data tidak ada, sinyal BTC sendiri)',()=>{
  const T=Date.UTC(2026,9,10,8),iso=new Date(T).toISOString().replace('.000Z','Z');
  const fake=label=>new Map([['BTCUSDT',{idxOf:new Map([[T-H4,5]]),m1At:()=>({structure:{label}})}]]);
  const rec=(symbol,side,t=iso)=>({symbol,side,decision_available_utc:t});
  assert.deepEqual(Cy.btcRegime(fake('BULLISH'),rec('SOLUSDT','LONG')),{code:'ALIGNED',label:'BULLISH'});
  assert.deepEqual(Cy.btcRegime(fake('BEARISH'),rec('SOLUSDT','SHORT')),{code:'ALIGNED',label:'BEARISH'});
  assert.deepEqual(Cy.btcRegime(fake('BEARISH'),rec('SOLUSDT','LONG')),{code:'OPPOSED',label:'BEARISH'});
  assert.deepEqual(Cy.btcRegime(fake('BULLISH'),rec('XRPUSDT','SHORT')),{code:'OPPOSED',label:'BULLISH'});
  assert.deepEqual(Cy.btcRegime(fake('TRANSITION'),rec('ETHUSDT','LONG')),{code:'BTC_TRANSITION',label:'TRANSITION'});
  assert.deepEqual(Cy.btcRegime(fake('INCOMPLETE'),rec('ETHUSDT','LONG')),{code:'UNAVAILABLE',label:'INCOMPLETE'});
  assert.deepEqual(Cy.btcRegime(fake('BULLISH'),rec('ETHUSDT','LONG','2026-10-10T12:00:00Z')),{code:'UNAVAILABLE',label:null});
  assert.deepEqual(Cy.btcRegime(new Map(),rec('ETHUSDT','LONG')),{code:'UNAVAILABLE',label:null});
  assert.equal(Cy.btcRegime(fake('BULLISH'),rec('BTCUSDT','LONG')),null);
});
test('Rezim BTC atas siklus sintetis = label struktur M1 BTC (definisi Tahap A2 §15) pada close yang sama',()=>{
  const a=STATE.analyses.get('BTCUSDT');let n=0;const seen=new Set();
  for(const r of STATE.history){
    const rg=Cy.btcRegime(STATE.analyses,r);if(r.symbol==='BTCUSDT'){assert.equal(rg,null);continue;}
    const i=a.idxOf.get(Date.parse(r.decision_available_utc)-H4),lab=M1.structure(a.piv,i).label;
    const want=lab==='INCOMPLETE'?'UNAVAILABLE':lab==='TRANSITION'?'BTC_TRANSITION':((r.side==='LONG')===(lab==='BULLISH')?'ALIGNED':'OPPOSED');
    assert.equal(rg.code,want);seen.add(rg.code);n++;
  }
  assert(n>20&&seen.size>=2,'cakupan '+n+' '+[...seen]);
});

(async()=>{
  for(const [name,fn] of queue){try{await fn();count++;console.log('PASS '+name);}catch(e){failures.push(name);console.log('FAIL '+name+' — '+String(e&&e.message||e).split('\n')[0]);}}
  console.log(`\n${count} PASS, ${failures.length} FAIL`);
  if(failures.length)process.exit(1);
})();
