'use strict';
/* Tes PRD v1.0.12 — R34 universe dinamis 100 pair (hard gate, ranking close harian 00:00 UTC = 08:00 WITA).
   Inti: rumus & bobot M1–M6 TIDAK berubah — skor setiap record identik dihitung bersama 6 pair maupun bersama universe. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const UV=require('../app/universe'),Cy=require('../app/cycle'),C=require('../engine/core'),M2=require('../engine/m2'),S=require('./synthetic');
const ROOT=path.resolve(__dirname,'..'),H4=C.H4,DAY=UV.DAY;
let count=0;const failures=[];const queue=[];
const test=(n,f)=>queue.push([n,f]);

// ---------- ranking ----------
const sym=(symbol,o={})=>Object.assign({symbol,contractType:'PERPETUAL',quoteAsset:'USDT',status:'TRADING',baseAsset:symbol.replace(/USDT$/,''),underlyingType:'COIN'},o);
test('eligible: hanya USDT perpetual TRADING; stablecoin, indeks, kuartalan, USDC-margined, non-TRADING dikeluarkan',()=>{
  const ei={symbols:[sym('BTCUSDT'),sym('ETHUSDT'),sym('USDCUSDT'),sym('FDUSDUSDT'),sym('BTCDOMUSDT',{underlyingType:'INDEX'}),
    sym('BTCUSDT_261225',{contractType:'CURRENT_QUARTER'}),sym('ETHUSDC',{quoteAsset:'USDC'}),sym('LUNAUSDT',{status:'SETTLING'}),sym('SUIUSDT',{underlyingType:undefined})]};
  assert.deepEqual(UV.eligible(ei),['BTCUSDT','ETHUSDT','SUIUSDT']);
  assert.deepEqual(UV.eligible(null),[]);assert.deepEqual(UV.eligible({symbols:'x'}),[]);
});
test('pool: urut quoteVolume 24 jam ↓, hanya eligible, dibatasi n',()=>{
  const t=[{symbol:'A',quoteVolume:'5'},{symbol:'B',quoteVolume:'9'},{symbol:'X',quoteVolume:'99'},{symbol:'C',quoteVolume:'9'},{symbol:'D',quoteVolume:'1'}];
  assert.deepEqual(UV.pool(t,['A','B','C','D'],3),['B','C','A']);assert.deepEqual(UV.pool(null,['A']),[]);
});
test('Volume harian: candle yang close tepat 00:00 UTC (open = hari sebelumnya); tidak ada → null',()=>{
  const day=Date.UTC(2026,9,11),rows=[[day-2*DAY,0,0,0,0,0,0,'111'],[day-DAY,0,0,0,0,0,0,'222.5'],[day,0,0,0,0,0,0,'7']];
  assert.equal(UV.dailyQuoteVolume(rows,day),222.5);assert.equal(UV.dailyQuoteVolume(rows.slice(2),day),null);assert.equal(UV.dailyQuoteVolume(null,day),null);
  assert.equal(UV.dailyQuoteVolume([[day-DAY,0,0,0,0,0,0,'abc']],day),null);
});
test('rank: volume ↓, seri → simbol ↑, maksimal 100, nomor peringkat 1..n',()=>{
  const v={};for(let i=0;i<130;i++)v['P'+String(i).padStart(3,'0')+'USDT']=1000-i;v.ZZZUSDT=1000;v.AAAUSDT=1000;
  const r=UV.rank(v);assert.equal(r.length,100);assert.deepEqual(r.slice(0,3).map(x=>x.symbol),['AAAUSDT','P000USDT','ZZZUSDT']);
  assert.deepEqual(r.map(x=>x.rank),Array.from({length:100},(_,i)=>i+1));assert(r.every((x,i)=>i===0||r[i-1].quoteVolume>=x.quoteVolume));
});
test('Batas hari = close harian 00:00 UTC = 08:00 WITA; universe tersimpan hanya dipakai di hari yang sama',()=>{
  const d=Date.UTC(2026,9,11);
  assert.equal(UV.dayStartOf(d+DAY-1),d,'07:59:59 WITA masih hari sebelumnya');assert.equal(UV.dayStartOf(d+DAY),d+DAY,'08:00 WITA → ranking baru');
  const u={dayStart:d,list:[{rank:1,symbol:'BTCUSDT'}]};assert(UV.isFor(u,d));assert(!UV.isFor(u,d+DAY));assert(!UV.isFor({dayStart:d,list:[]},d));assert(!UV.isFor(null,d));
});

test('R35 rankRolling: volume 24 jam berjalan dari stream, hanya eligible, top 100, seri → simbol',()=>{
  const tk={};for(let i=0;i<120;i++)tk['Q'+String(i).padStart(3,'0')+'USDT']={quoteVolume:5000-i};tk.USDCUSDT={quoteVolume:9e9};tk.NOVOLUSDT={};
  const elig=Object.keys(tk).filter(s=>s!=='USDCUSDT');
  const r=UV.rankRolling(tk,elig);assert.equal(r.length,100);assert.equal(r[0].symbol,'Q000USDT');assert(!r.some(x=>x.symbol==='USDCUSDT'||x.symbol==='NOVOLUSDT'));
  assert.deepEqual(UV.rankRolling({},elig),[]);
});
test('R35 stream !ticker@arr: seed REST + pembaruan array, harga & volume, pesan rusak diabaikan, watchdog 20 detik',()=>{
  const Tr=require('../app/transport');const list=[];let t=1e12;
  class W{constructor(u){this.url=u;this.readyState=1;list.push(this);}close(){this.readyState=3;this.onclose&&this.onclose();}}
  const timers=[];const mk=Tr.createMarketTicker({WebSocketImpl:W,now:()=>t,setTimer:(f,ms)=>{timers.push(ms);return 1;},clearTimer:()=>{}});
  assert(list[0].url.endsWith('/market/stream?streams=!ticker@arr'));
  mk.seed([{symbol:'AUSDT',lastPrice:'1.5',priceChangePercent:'2',quoteVolume:'1000'}]);assert.deepEqual([mk.tickers.AUSDT.price,mk.tickers.AUSDT.quoteVolume],[1.5,1000]);
  list[0].onmessage({data:JSON.stringify({stream:'!ticker@arr',data:[{s:'AUSDT',c:'1.6',P:'3',q:'2000'},{s:'BUSDT',c:'0',q:'5'}]})});list[0].onmessage({data:'{rusak'});
  assert.deepEqual([mk.tickers.AUSDT.price,mk.tickers.AUSDT.quoteVolume],[1.6,2000]);assert(!mk.tickers.BUSDT,'harga 0 diabaikan');assert(mk.isLive());
  t+=21000;mk.watchdog();assert.equal(list[0].readyState,3);assert.equal(timers[0],2000);mk.stop();
});

// ---------- gate & invarian skor ----------
const FROZEN=M2.frozenFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_v2_normalizations.json'),'utf8')));
const CORE=S.generate({n:1600});
const EXTRA_RAW=S.generate({n:1600,seed:11});const RENAME={BTCUSDT:'AAAUSDT',ETHUSDT:'BBBUSDT',SOLUSDT:'CCCUSDT',BNBUSDT:'DDDUSDT',DOGEUSDT:'EEEUSDT',XRPUSDT:'FFFUSDT'};
const RAW=Object.assign({},CORE);for(const [a,b] of Object.entries(RENAME))RAW[b]=EXTRA_RAW[a];
const NOW=CORE.BTCUSDT[CORE.BTCUSDT.length-1][0]+10000;
const cand=raw=>Object.fromEntries(Object.entries(raw).map(([s,r])=>[s,r.filter(k=>k[0]<=NOW).map(Cy.toCandle)]));
const ALL=Object.keys(RAW),FROM=UV.dayStartOf(NOW)-20*DAY;   // gate aktif 20 hari terakhir supaya banyak keputusan teruji
const coreOnly=Cy.buildState({rawBySymbol:cand(CORE),now:NOW,frozen:FROZEN});
const wide=Cy.buildState({rawBySymbol:cand(RAW),now:NOW,frozen:FROZEN,symbols:ALL});
const allowed=new Set(['BTCUSDT','ETHUSDT','AAAUSDT','CCCUSDT','EEEUSDT']);
const gated=Cy.buildState({rawBySymbol:cand(RAW),now:NOW,frozen:FROZEN,symbols:ALL,gate:{fromMs:FROM,allowed}});
const key=r=>r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc;
const SC=['m1_100','m2_signal_quality_80','m2_integrity_20','m3_100','m5_100','m1_plus_m2q_0_180_display_only'];

test('Basket M3 tetap 6 pair inti walaupun universe lebih besar: M3 identik di setiap close',()=>{
  assert.equal(wide.cycle.summary.m3_status,'SCORED');
  // record bentrok tidak diberi M3 (null, PRD §9) — dibandingkan hanya record yang punya nilai M3
  const num=x=>typeof x==='number'&&Number.isFinite(x);
  const m3=new Map(coreOnly.history.filter(r=>num(r.scores.m3_100)).map(r=>[r.decision_available_utc,r.scores.m3_100]));let n=0;
  for(const r of wide.history)if(num(r.scores.m3_100)&&m3.has(r.decision_available_utc)){assert.equal(r.scores.m3_100,m3.get(r.decision_available_utc),r.decision_available_utc);n++;}
  assert(n>100,'cakupan '+n);
  assert.deepEqual(wide.context.pairs,C.PAIRS);
});
test('INVARIAN SKOR: setiap event pair inti punya skor M1/M2/M3/M5 identik dihitung bersama 6 pair atau bersama universe',()=>{
  const w=new Map(wide.history.map(r=>[key(r),r]));let n=0;
  for(const r of coreOnly.history){const x=w.get(key(r));assert(x,'record hilang '+key(r));
    for(const k of SC)assert.equal(x.scores[k],r.scores[k],key(r)+' '+k);
    assert.equal(x.event_status,r.event_status);n++;}
  assert(n>200,'cakupan '+n);
  // pair tambahan memakai rumus yang sama: skor = fungsi data pair itu sendiri
  const extra=wide.history.filter(r=>r.symbol==='AAAUSDT');assert(extra.length>20);
  const alone=Cy.buildState({rawBySymbol:Object.assign(cand(CORE),{AAAUSDT:cand(RAW).AAAUSDT}),now:NOW,frozen:FROZEN,symbols:[...C.PAIRS,'AAAUSDT']});
  const a=new Map(alone.history.map(r=>[key(r),r]));
  for(const r of extra){const x=a.get(key(r));assert(x);for(const k of SC)assert.equal(x.scores[k],r.scores[k],key(r)+' '+k);}
});
test('Setiap pair menampilkan skor berbeda: M1+M2q bervariasi antar pair (bukan konstanta)',()=>{
  const v=new Set(wide.history.filter(r=>Number.isFinite(r.scores.m1_plus_m2q_0_180_display_only)).map(r=>r.scores.m1_plus_m2q_0_180_display_only.toFixed(6)));
  assert(v.size>100,'variasi skor '+v.size);
  const bySym=new Map();for(const r of wide.history)if(r.status==='ENTRY_CONSIDER')(bySym.get(r.symbol)||bySym.set(r.symbol,[]).get(r.symbol)).push(r.scores.m6_confluense_500);
  assert(bySym.size>=6,'pair dengan ENTRY_CONSIDER '+bySym.size);
});
test('HARD GATE: sejak fromMs hanya pair universe yang punya keputusan; sebelum fromMs semua pair diunduh dipakai',()=>{
  const after=gated.history.filter(r=>Date.parse(r.decision_available_utc)>=FROM),before=gated.history.filter(r=>Date.parse(r.decision_available_utc)<FROM);
  assert(after.length>20,'cakupan '+after.length);
  for(const r of after)assert(allowed.has(r.symbol),'lolos gate: '+r.symbol);
  assert(before.some(r=>!allowed.has(r.symbol)),'riwayat sebelum gate memakai semua pair');
  for(const r of gated.cycle.records)assert(allowed.has(r.symbol));
  // skor record yang lolos gate sama persis dengan tanpa gate (gate tidak mengubah rumus)
  const w=new Map(wide.history.map(r=>[key(r),r]));
  for(const r of after){const x=w.get(key(r));if(!x)continue;for(const k of SC)assert.equal(x.scores[k],r.scores[k]);}
  // pair di luar universe tidak tampil di Papan Event / Konteks, kecuali punya posisi berjalan
  const act=new Set(gated.book.active.map(p=>p.symbol));
  for(const c of [...gated.board.waiting,...gated.board.confirmed,...gated.board.ended])assert(allowed.has(c.symbol)||act.has(c.symbol),c.symbol);
  for(const r of gated.context.rows)assert(C.PAIRS.includes(r.symbol)||allowed.has(r.symbol)||act.has(r.symbol));
  assert.deepEqual(gated.universe.symbols.sort(),[...allowed].sort());
});
test('toView (Web Worker): angka identik, tanpa fungsi/peta analisis, label rezim BTC sama, bisa di-structuredClone',()=>{
  const v=Cy.toView(gated);assert(!('analyses' in v));
  const cl=structuredClone(v);assert.equal(cl.history.length,gated.history.length);
  for(let i=0;i<gated.history.length;i++){assert.deepEqual(cl.history[i],Cy.publicRecord(gated.history[i]));}
  for(const r of gated.history){const rg=Cy.btcRegime(gated.analyses,r);assert.deepEqual(cl.regimes[Cy.recKey(r)]||null,rg);}
  assert.equal(cl.book.active.length,gated.book.active.length);assert.equal(Cy.auditLines(cl),Cy.auditLines(gated));
});
test('FETCH_FAILED: pair universe yang gagal sejak percobaan pertama (tanpa data) tetap menahan keputusan close (PRD §1)',()=>{
  const raw=cand(RAW);delete raw.CCCUSDT;
  const st=Cy.buildState({rawBySymbol:raw,now:NOW,frozen:FROZEN,symbols:Object.keys(raw),failed:['CCCUSDT'],gate:{fromMs:FROM,allowed}});
  assert.deepEqual(st.cycle.summary.fetch_failed,['CCCUSDT']);assert.equal(st.cycle.summary.data_status,'DATA_INCOMPLETE');
  assert(st.cycle.records.every(r=>r.status!=='ENTRY_CONSIDER'),'tidak boleh ada ENTRY_CONSIDER saat data belum lengkap');
});
test('mergeCandles: data terbaru menang, urut, dibatasi 1.500; celah tidak diisi',()=>{
  const c=t=>({t,close:t});const old=[c(1),c(2),c(3)],fresh=[{t:3,close:99},c(4)];
  assert.deepEqual(Cy.mergeCandles(old,fresh).map(x=>[x.t,x.close]),[[1,1],[2,2],[3,99],[4,4]]);
  assert.equal(Cy.mergeCandles(Array.from({length:1600},(_,i)=>c(i)),[c(1600)]).length,1500);
  assert.deepEqual(Cy.mergeCandles([c(1)],[c(5)]).map(x=>x.t),[1,5]);
});

(async()=>{
  for(const [name,fn] of queue){try{await fn();count++;console.log('PASS '+name);}catch(e){failures.push(name);console.log('FAIL '+name+' — '+String(e&&e.message||e).split('\n')[0]);}}
  console.log(`\n${count} PASS, ${failures.length} FAIL`);
  if(failures.length)process.exit(1);
})();
