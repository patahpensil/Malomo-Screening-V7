'use strict';
/* Tes lapisan aplikasi Malomo V7: siklus 4H di atas engine (kontrak §9–§10, portofolio §6, FETCH_FAILED/gap §1, kausalitas),
   transport pola live (antrean, Retry-After, cache, retry 30/60/120, ticker watchdog), stream posisi, label UI/UX,
   dan pemindaian statis (tanpa endpoint order/API key, tanpa klaim win rate). Data sintetis deterministik, bukan pasar. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../engine/core'),M2=require('../engine/m2'),R=require('../engine/m3m4'),P=require('../engine/pipeline');
const Cy=require('../app/cycle'),L=require('../app/labels'),Tr=require('../app/transport'),Lv=require('../app/live'),S=require('./synthetic');
const ROOT=path.resolve(__dirname,'..'),H4=C.H4;
let count=0;const failures=[];
const queue=[];
function test(name,fn){queue.push([name,fn]);}
const FROZEN=M2.frozenFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_v2_normalizations.json'),'utf8')));
const RAW=S.generate({n:1600});
const candlesOf=(raw,pred=()=>true)=>{const o={};for(const s in raw)o[s]=raw[s].filter(pred).map(Cy.toCandle);return o;};
const ALL=candlesOf(RAW);
const LAST_OPEN=RAW.BTCUSDT[RAW.BTCUSDT.length-1][0];
const build=(now,extra={})=>Cy.buildState(Object.assign({rawBySymbol:candlesOf(RAW,k=>k[0]<=now),now,frozen:FROZEN},extra));
const FULL=build(LAST_OPEN+10000);
const recId=r=>r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc;
// Siklus contoh dengan ENTRY_CONSIDER dan REJECTED_RISK pada T yang sama.
const byT=new Map();for(const r of FULL.history){const k=r.decision_available_utc;if(!byT.has(k))byT.set(k,[]);byT.get(k).push(r);}
const busyT=[...byT.entries()].filter(([,v])=>v.some(r=>r.status==='ENTRY_CONSIDER')&&v.some(r=>r.status==='REJECTED_RISK')).map(([k])=>Date.parse(k)).pop();

const EVENT=['WAITING_RETEST','WAITING_ZONE','WAITING_CONTINUATION','CHOCH_CANDIDATE','CONFIRMED','INVALID','EXPIRED','CENSORED','PREZONE_CENSORED','UNSUPPORTED_FOR_SCORING','CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION'];
const SCORE=['SCORED','NOT_APPLICABLE','INCOMPLETE','DATA_INCOMPLETE','CALIBRATION_INCOMPLETE','SCORE_INCOMPLETE','AUDIT_INCOMPLETE','NO_SCORE'];
const STATUS=['CLOSE_CANDIDATE','ENTRY_CONSIDER','NO_ENTRY','REJECTED_DIRECTION','REJECTED_INTEGRITY','REJECTED_RISK','CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION','RESEARCH_ONLY'];
const FIELDS=['schema','event_status','score_status','status','reasons','research_only','synthetic_fixture','venue','symbol','timeframe','break_utc','confirmation_utc','decision_available_utc',
  'entry_reference_time_utc','side','signal_family','market_structure_direction','m1_origin_direction','scores','equity_sim','atr_entry','atr_frozen','entry_reference_open','stop_price','target_price',
  'qty','risk_pct','gross_pct','rr_target','max_holding_hours','invalidation','normalization_version','risk_mandate_version','m5_snapshot','data_quality_flags','source_labels','audit_trail'];

// ---------- siklus ----------
test('toCandle: kolom kline Binance → candle engine (taker buy base di indeks 9)',()=>{
  const c=Cy.toCandle([1,'2','3','1','2.5','10',14399999,'25',7,'4','10','0']);
  assert.deepEqual(c,{t:1,open:2,high:3,low:1,close:2.5,volume:10,ct:14399999,quoteVolume:25,trades:7,takerBuyBase:4});
});
test('Skenario sintetis memuat semua jalur keputusan (ENTRY_CONSIDER, REJECTED_RISK, REJECTED_DIRECTION, bentrok)',()=>{
  const st=new Set(FULL.history.map(r=>r.status));
  for(const s of ['ENTRY_CONSIDER','REJECTED_RISK','REJECTED_DIRECTION','MULTI_METHOD_COLLISION'])assert(st.has(s),'tidak ada '+s);
  assert(busyT,'tidak ada T dengan ENTRY_CONSIDER + REJECTED_RISK');
});
test('Kontrak §9–§10 untuk seluruh record: tiga lapis status sah, reasons, null bukan 0, M6 = M1+…+M5',()=>{
  for(const r of FULL.history){
    for(const f of FIELDS)assert(f in r,'field hilang '+f);
    assert(EVENT.includes(r.event_status));assert(SCORE.includes(r.score_status),r.score_status);assert(STATUS.includes(r.status));
    assert.equal(r.research_only,true);assert.equal(r.synthetic_fixture,false);assert.notEqual(r.normalization_version,'SYNTHETIC_FIXTURE_ONLY');
    if(['CLOSE_CANDIDATE','ENTRY_CONSIDER'].includes(r.status))assert.equal(r.reasons.length,0);else assert(r.reasons.length>0,'reasons kosong untuk '+r.status);
    assert.equal(r.confirmation_utc,r.decision_available_utc);assert.equal(r.entry_reference_time_utc,r.decision_available_utc);
    if(r.signal_family==='PULLBACK_CONTINUATION')assert.equal(r.break_utc,null);else assert(r.break_utc&&Date.parse(r.break_utc)<=Date.parse(r.confirmation_utc));
    if(r.signal_family!=='REVERSAL_RETEST')assert.equal(r.m1_origin_direction,null);
    const s=r.scores;
    if(r.status==='ENTRY_CONSIDER'){
      assert.equal(r.score_status,'SCORED');assert.equal(r.event_status,'CONFIRMED');assert.equal(s.m4_100,100);assert.equal(s.m2_integrity_20,20);
      assert(Math.abs(s.m6_confluense_500-(s.m1_100+s.m2_100+s.m3_100+s.m4_100+s.m5_100))<1e-9);
      assert(Math.abs(s.m2_100-(s.m2_signal_quality_80+20))<1e-12);assert(Math.abs(s.m6_display_pct_not_winrate-s.m6_confluense_500/5)<1e-9);
      assert.equal(s.m5_100,55);assert(r.risk_pct<=1+1e-9);assert(r.qty>0&&r.stop_price>0);
      const d=Math.abs(r.entry_reference_open-r.stop_price);assert(Math.abs(d-1.5*r.atr_entry)<1e-9*Math.max(1,d));
      assert(Math.abs(Math.abs(r.target_price-r.entry_reference_open)-2*d)<1e-9*Math.max(1,d));
    }else{assert.equal(s.m6_confluense_500,null);assert.equal(s.m6_display_pct_not_winrate,null);}
    if(r.status==='REJECTED_RISK'){assert(r.reasons.every(x=>['GROSS_CAP','PAIR_ACTIVE','POSITION_OR_RISK_CAP','PLAN_RISK_INVALID'].includes(x)));assert(Number.isFinite(s.m4_100_audit_partial)&&s.m4_100_audit_partial<100);}
    if(Number.isFinite(s.m1_100)&&Number.isFinite(s.m2_signal_quality_80))assert(Math.abs(s.m1_plus_m2q_0_180_display_only-(s.m1_100+s.m2_signal_quality_80))<1e-12);
  }
});
test('Ranking per T mengikuti tie-break §8.1.5 dan alokasi berurutan (ENTRY_CONSIDER tidak pernah di bawah REJECTED_RISK yang skornya lebih tinggi tanpa alasan)',()=>{
  for(const [,recs] of byT){
    const ranked=recs.filter(r=>r.rank_provisional).sort((a,b)=>a.rank_provisional-b.rank_provisional);
    for(let i=1;i<ranked.length;i++){const a=ranked[i-1],b=ranked[i];
      const m6=r=>r.scores.m1_100+r.scores.m2_100+r.scores.m3_100+100+r.scores.m5_100;
      assert(m6(a)>m6(b)||(m6(a)===m6(b)&&(a.scores.m2_signal_quality_80>=b.scores.m2_signal_quality_80)),'urutan M6 salah');}
  }
});
test('Setara dengan pipeline.replay (engine) untuk semua T sebelum close terakhir — melewati T tanpa event tidak mengubah portofolio',()=>{
  const now=LAST_OPEN+10000,closed={};for(const s in RAW)closed[s]=RAW[s].filter(k=>k[0]+H4<=now).map(Cy.toCandle);
  const rep=P.replay(closed,{frozen:FROZEN,startMs:0,endMs:FULL.T-H4});
  const a=FULL.history.filter(r=>Date.parse(r.decision_available_utc)<FULL.T).map(r=>recId(r)+'|'+r.status+'|'+r.scores.m6_confluense_500+'|'+r.reasons.join(','));
  const b=rep.records.map(r=>recId(r)+'|'+r.status+'|'+r.scores.m6_confluense_500+'|'+r.reasons.join(','));
  assert.deepEqual(a,b);
});
test('Kausal (T08 analog): menambah candle masa depan tidak mengubah keputusan masa lalu',()=>{
  const cut=FULL.T-200*H4,early=build(cut+10000);
  const late=new Map(FULL.history.map(r=>[recId(r),JSON.stringify(Cy.publicRecord(r))]));
  let n=0;for(const r of early.history){if(Date.parse(r.decision_available_utc)>=early.T)continue;assert.equal(JSON.stringify(Cy.publicRecord(r)),late.get(recId(r)),recId(r));n++;}
  assert(n>50,'terlalu sedikit record dibandingkan: '+n);
});
test('Idempoten: siklus yang sama dibangun dua kali menghasilkan record identik (tanpa duplikasi)',()=>{
  const a=build(busyT+10000),b=build(busyT+10000);
  assert.equal(JSON.stringify(a.history.map(Cy.publicRecord)),JSON.stringify(b.history.map(Cy.publicRecord)));
  assert.equal(new Set(a.history.map(recId)).size,a.history.length);
});
test('Dua fase §1: open(t+1) belum ada → CLOSE_CANDIDATE, harga & M6 null; open tersedia → ENTRY_REVIEW',()=>{
  const now=busyT+10000,raw=candlesOf(RAW,k=>k[0]<=now&&k[0]!==busyT);   // candle berjalan belum muncul
  const st=Cy.buildState({rawBySymbol:raw,now,frozen:FROZEN});
  assert.equal(st.T,busyT);assert.equal(st.cycle.summary.phase,'CLOSE_CANDIDATE');
  const cc=st.cycle.records.filter(r=>r.status==='CLOSE_CANDIDATE');assert(cc.length>=2);
  for(const r of cc){assert.equal(r.entry_reference_open,null);assert.equal(r.qty,null);assert.equal(r.gross_pct,null);assert.equal(r.scores.m6_confluense_500,null);assert.deepEqual(r.reasons,[]);}
  const ready=build(now);assert.equal(ready.cycle.summary.phase,'ENTRY_REVIEW');
  assert(ready.cycle.records.some(r=>r.status==='ENTRY_CONSIDER'));assert(ready.cycle.records.some(r=>r.status==='REJECTED_RISK'));
  for(const r of ready.cycle.records.filter(r=>r.status==='ENTRY_CONSIDER'))assert.equal(r.entry_reference_open,RAW[r.symbol].find(k=>k[0]===busyT)[1]);
});
test('Portofolio §6: ≤3 posisi, risiko terbuka ≤3%, gross ≤100%, 1 posisi per pair, slot tepat 24 jam (stop/target tidak membebaskan slot)',()=>{
  const pos=FULL.history.filter(r=>r.status==='ENTRY_CONSIDER').map(r=>({s:r.symbol,t:Date.parse(r.entry_reference_time_utc),risk:r.risk_pct,gross:r.gross_pct}));
  let earlyStop=0;
  for(const p of pos){
    const act=pos.filter(q=>q.t<=p.t&&q.t+24*3600e3>p.t);
    assert(act.length<=3);assert(act.reduce((s,q)=>s+q.risk,0)<=3+1e-9);assert(act.reduce((s,q)=>s+q.gross,0)<=100+1e-9);
    assert.equal(new Set(act.map(q=>q.s)).size,act.length,'dua posisi pada pair sama');
  }
  for(const p of FULL.book.closed.concat(FULL.book.active)){assert.equal(p.slotReleaseMs-p.entryMs,24*3600e3);if(p.outcome.code==='STOP_HIT'&&p.outcome.atMs<p.slotReleaseMs)earlyStop++;}
  assert(earlyStop>0,'skenario tidak menguji stop sebelum slot lepas');
  // Posisi yang stop lebih awal tetap memblokir pair sampai slot lepas.
  const sp=FULL.book.closed.find(p=>p.outcome.code==='STOP_HIT'&&p.outcome.atMs<p.slotReleaseMs);
  assert(!FULL.history.some(r=>r.status==='ENTRY_CONSIDER'&&r.symbol===sp.symbol&&Date.parse(r.decision_available_utc)>sp.entryMs&&Date.parse(r.decision_available_utc)<sp.slotReleaseMs));
  assert(FULL.book.rejectionCounts.GROSS_CAP>0&&FULL.book.rejectionCounts.PAIR_ACTIVE>0);
});
test('Outcome riset: stop dievaluasi lebih dulu; target; horizon 24 jam; berjalan; SHORT simetris',()=>{
  const t0=Date.UTC(2026,0,1),c=(i,o,h,l,cl)=>({t:t0+i*H4,open:o,high:h,low:l,close:cl});
  const pos={side:'LONG',entryMs:t0,entry:100,stop:97,target:106};
  assert.deepEqual(Cy.outcome(pos,[c(0,100,107,96,101)],t0+H4),{code:'STOP_HIT',atMs:t0+H4,r:-1});
  assert.equal(Cy.outcome(pos,[c(0,100,101,99,100),c(1,100,106,99,105)],t0+2*H4).code,'TARGET_HIT');
  const six=[0,1,2,3,4,5].map(i=>c(i,100,101,99,i===5?101.5:100));
  const h=Cy.outcome(pos,six,t0+6*H4);assert.equal(h.code,'HORIZON_EXIT');assert(Math.abs(h.r-0.5)<1e-12);
  const o=Cy.outcome(pos,six.slice(0,3),t0+3*H4+1);assert.equal(o.code,'OPEN');assert.equal(o.candlesSeen,3);
  assert.equal(Cy.outcome(pos,six,t0+3*H4).candlesSeen,3,'candle yang belum close tidak boleh dipakai');
  const sh={side:'SHORT',entryMs:t0,entry:100,stop:103,target:94};
  assert.equal(Cy.outcome(sh,[c(0,100,104,93,99)],t0+H4).code,'STOP_HIT');assert.equal(Cy.outcome(sh,[c(0,100,101,94,95)],t0+H4).code,'TARGET_HIT');
});
test('FETCH_FAILED §1: pair gagal & data belum mencakup close terakhir → DATA_INCOMPLETE sementara, reason di depan, M6 null',()=>{
  const now=busyT+10000,raw=candlesOf(RAW,k=>k[0]<=now);
  raw.DOGEUSDT=raw.DOGEUSDT.filter(x=>x.t<busyT-H4);                     // cache lama tanpa candle terakhir
  const st=Cy.buildState({rawBySymbol:raw,now,frozen:FROZEN,failed:['DOGEUSDT']});
  assert.equal(st.cycle.summary.data_status,'DATA_INCOMPLETE');assert.deepEqual(st.cycle.summary.fetch_failed,['DOGEUSDT']);
  assert(st.cycle.records.length>0);
  for(const r of st.cycle.records){assert.notEqual(r.status,'ENTRY_CONSIDER');assert.equal(r.scores.m6_confluense_500,null);
    if(r.status==='NO_ENTRY'){assert.equal(r.reasons[0],'FETCH_FAILED');assert.equal(r.score_status,'DATA_INCOMPLETE');}}
  assert.equal(st.health.find(h=>h.symbol==='DOGEUSDT').fetch,'FETCH_FAILED');
  // Keputusan lama tetap utuh (bukan gap permanen).
  const before=new Map(build(now).history.filter(r=>Date.parse(r.decision_available_utc)<busyT-H4).map(r=>[recId(r),r.status]));
  for(const r of st.history)if(before.has(recId(r)))assert.equal(r.status,before.get(recId(r)));
  // Gagal ulang tetapi data sudah mencakup close terakhir → tidak ditandai.
  const ok=Cy.buildState({rawBySymbol:candlesOf(RAW,k=>k[0]<=now),now,frozen:FROZEN,failed:['DOGEUSDT']});
  assert.equal(ok.cycle.summary.data_status,'OK');assert.equal(ok.health.find(h=>h.symbol==='DOGEUSDT').fetch,'RETRYING_CACHED');
});
test('CONFIRMED_GAP §1: candle hilang tidak diinterpolasi; jendela sesudah gap belum pulih',()=>{
  const now=LAST_OPEN+10000,raw=candlesOf(RAW,k=>k[0]<=now),gapT=raw.SOLUSDT[raw.SOLUSDT.length-50].t;
  raw.SOLUSDT=raw.SOLUSDT.filter(x=>x.t!==gapT);
  const st=Cy.buildState({rawBySymbol:raw,now,frozen:FROZEN});
  const h=st.health.find(x=>x.symbol==='SOLUSDT');assert.equal(h.gaps,1);assert(h.recovery.m3>0,'M3 harus belum pulih');
  assert.equal(st.context.m3.status,'INCOMPLETE');assert.equal(st.cycle.summary.m3_status,'INCOMPLETE');
  assert(!st.history.some(r=>Date.parse(r.decision_available_utc)>gapT&&r.status==='ENTRY_CONSIDER'),'tidak boleh ada entry dengan M3 melintasi gap');
});
test('Papan Event: kartu menunggu tanpa skor; terkonfirmasi tertaut record; bentrok dipisah',()=>{
  const b=FULL.board;
  for(const x of b.waiting){assert(['WAITING_RETEST','WAITING_ZONE','WAITING_CONTINUATION','CHOCH_CANDIDATE'].includes(x.event_status));assert.equal(x.score_status,'NOT_APPLICABLE');assert(!('scores' in x));assert(x.progress&&x.progress.candle<=x.progress.of);}
  for(const x of b.confirmed){assert(x.record);assert.equal(x.event_status,'CONFIRMED');}
  for(const x of b.conflict)assert(['CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION'].includes(x.event_status));
  for(const x of b.ended)assert(['INVALID','EXPIRED','PREZONE_CENSORED','CENSORED'].includes(x.event_status));
  assert(b.waiting.length+b.confirmed.length+b.ended.length>0);
});
test('Konteks: matriks korelasi simetris, diagonal 1, rata-rata |ρ| = komponen M3; M1 per pair = engine',()=>{
  const cx=FULL.context,m=cx.matrix;assert(m);let s=0,n=0;
  for(let i=0;i<6;i++){assert.equal(m[i][i],1);for(let j=0;j<6;j++){assert(Math.abs(m[i][j]-m[j][i])<1e-12);if(j>i){s+=Math.abs(m[i][j]);n++;}}}
  assert(Math.abs(s/n-cx.m3.components.meanAbsCorr)<1e-12);assert.equal(cx.m3.score,FULL.cycle.summary.m3);
  for(const r of cx.rows){const a=FULL.analyses.get(r.symbol);assert.equal(r.m1.score,a.m1At(a.c.length-1).score);assert(r.chart.candles.length<=60);}
});
test('Log audit JSONL: tiap baris JSON sah, memuat cek konflik + record, tanpa field internal',()=>{
  const lines=Cy.auditLines(FULL).trim().split('\n').map(l=>JSON.parse(l));
  assert(lines.some(x=>x.type==='CONFLICT_CHECK'&&x.checked===true));assert(lines.some(x=>x.type==='CYCLE'));
  const recs=lines.filter(x=>x.type==='DECISION_RECORD');assert.equal(recs.length,FULL.history.length);
  for(const r of recs)assert(!Object.keys(r).some(k=>k.startsWith('_')));
});
test('Kalibrasi live = array beku per keluarga (258/189/44), tanpa fitting ulang',()=>{
  const c=FULL.calibration;assert.equal(c.policy,'FROZEN_COMPLETE_TRAIN_ECDF');
  assert.equal(c.families.BREAKOUT_RETEST.n,258);assert.equal(c.families.PULLBACK_CONTINUATION.n,189);assert.equal(c.families.REVERSAL_RETEST.n,44);
  for(const r of FULL.history.filter(r=>r.calibration_policy))assert.equal(r.calibration_policy,'FROZEN_COMPLETE_TRAIN_ECDF');
});
test('Kinerja: membangun siklus 6 pair × 1.500 candle di bawah 3 detik',()=>{
  const now=LAST_OPEN+10000,raw=candlesOf(RAW,k=>k[0]<=now&&k[0]>now-1500*H4),t=Date.now();Cy.buildState({rawBySymbol:raw,now,frozen:FROZEN});
  assert(Date.now()-t<3000,'terlalu lambat: '+(Date.now()-t)+' ms');
});

// ---------- label ----------
test('Label: semua kode PRD §9 punya label UI/UX §6; null → "—"; waktu UTC + WITA; round half up 2 desimal',()=>{
  for(const k of EVENT)assert(L.EVENT[k],k);for(const k of SCORE)assert(L.SCORE[k],k);for(const k of STATUS)assert(L.STATUS[k],k);for(const k of L.PRD_REASONS)assert(L.REASON[k],k);
  assert.equal(L.score(null),'—');assert.equal(L.score(undefined),'—');assert.equal(L.score(NaN),'—');assert.equal(L.score(0),'0.00');assert.equal(L.score(1.125),'1.13');assert.equal(L.score(395),'395.00');
  assert.equal(L.time(Date.UTC(2026,9,10,8)),'08:00 UTC · 16:00 WITA');assert.equal(L.time(Date.UTC(2026,9,10,20)),'20:00 UTC · 04:00 WITA');
  assert.equal(L.sideText('LONG'),'▲ LONG');assert.equal(L.sideText('SHORT'),'▼ SHORT');
  assert.equal(L.reasonLabel('M3_HISTORY_INCOMPLETE:BTCUSDT'),'Riwayat M3 (181 close) belum cukup (BTCUSDT)');assert.equal(L.reasonLabel('XYZ'),'XYZ');
  assert.equal(L.price(null),'—');assert.equal(L.price(60123.456),'60123.46');assert.equal(L.price(0.123456789),'0.123457');
  assert.equal(L.esc('<b a="1">'),'&lt;b a=&quot;1&quot;&gt;');assert.equal(L.duration(3723000),'01:02:03');
});

// ---------- transport ----------
function fakeClock(){let t=1e12;const sleeps=[];return {now:()=>t,sleep:async ms=>{sleeps.push(ms);t+=ms;},sleeps,advance:ms=>{t+=ms;}};}
const res=(status,body,headers={})=>({status,ok:status>=200&&status<300,headers:{get:k=>headers[k]??null},json:async()=>body});
test('Transport: antrean 200 ms, cooldown 429 memakai Retry-After, error HTTP dilempar, path non-publik ditolak',async()=>{
  const ck=fakeClock(),calls=[];const replies=[res(429,null,{'Retry-After':'5'}),res(200,{a:1}),res(500,null)];
  const tr=Tr.createTransport({now:ck.now,sleep:ck.sleep,fetchImpl:async u=>{calls.push(u);return replies.shift();}});
  assert.deepEqual(await tr.request('/fapi/v1/time'),{a:1});
  assert.equal(calls.length,2);assert(ck.sleeps.includes(200));assert(ck.sleeps.includes(5000),'cooldown Retry-After 5 s');
  await assert.rejects(tr.request('/fapi/v1/time'),/HTTP 500/);
  for(const p of ['/fapi/v1/order?symbol=BTCUSDT','/fapi/v2/account','/fapi/v1/listenKey','/fapi/v1/klines'])await assert.rejects(tr.request(p),/tidak diizinkan/);
  assert.equal(calls.length,3);
});
test('Transport: exchangeInfo (R32) publik diizinkan persis; varian path lain ditolak sebelum jaringan',async()=>{
  const ck=fakeClock(),calls=[];
  const tr=Tr.createTransport({now:ck.now,sleep:ck.sleep,fetchImpl:async u=>{calls.push(u);return res(200,{symbols:[]});}});
  assert.deepEqual(await tr.exchangeInfo(),{symbols:[]});assert.equal(calls[0],Tr.REST+'/fapi/v1/exchangeInfo');
  for(const p of ['/fapi/v1/exchangeInfo?symbol=BTCUSDT','/fapi/v2/exchangeInfo','/fapi/v1/leverageBracket'])await assert.rejects(tr.request(p),/tidak diizinkan/);
  assert.equal(calls.length,1);
});
test('Transport: sinkron jam server; cache kline sampai candle berjalan close; tanpa candle berjalan → tidak di-cache',async()=>{
  const ck=fakeClock();let n=0,serverOffset=7000;const t0=Math.floor((ck.now()+serverOffset)/H4)*H4;
  const rows=withForming=>[[t0-H4,1,1,1,1,1,t0-1],...(withForming?[[t0,1,1,1,1,1,t0+H4-1]]:[])];
  let forming=true;
  const tr=Tr.createTransport({now:ck.now,sleep:ck.sleep,fetchImpl:async u=>{if(u.includes('/time'))return res(200,{serverTime:ck.now()+serverOffset});n++;return res(200,rows(forming));}});
  await tr.syncClock();assert(Math.abs(tr.serverNow()-(ck.now()+serverOffset))<=200,'offset jam');
  await tr.klines('BTCUSDT');await tr.klines('BTCUSDT');assert.equal(n,1,'harus dari cache');
  ck.advance(H4);await tr.klines('BTCUSDT');assert.equal(n,2,'candle berjalan sudah close → ambil ulang');
  tr.clearCache();forming=false;const t1=Math.floor(tr.serverNow()/H4)*H4;void t1;await tr.klines('ETHUSDT');await tr.klines('ETHUSDT');assert.equal(n,4);
});
test('Retry FETCH_FAILED: 1 + 3 percobaan dengan jeda 30/60/120 detik; berhasil di tengah berhenti',async()=>{
  const sl=[],fails=[];let k=0;
  const r=await Tr.withRetry(async()=>{throw new Error('x'+(++k));},{sleep:async ms=>{sl.push(ms);},onAttemptFailed:f=>fails.push(f)});
  assert.equal(r.ok,false);assert.equal(r.attempts,4);assert.deepEqual(sl,[30000,60000,120000]);assert.equal(fails.length,4);
  assert.deepEqual(fails.map(f=>f.nextDelayMs),[30000,60000,120000,null]);
  let j=0;const s2=[];const ok=await Tr.withRetry(async()=>{if(++j<3)throw new Error('gagal');return 'data';},{sleep:async ms=>{s2.push(ms);}});
  assert.deepEqual(ok,{ok:true,value:'data',attempts:3});assert.deepEqual(s2,[30000,60000]);
  const c=await Tr.withRetry(async()=>{throw new Error('x');},{sleep:async()=>{},cancelled:()=>true});assert.equal(c.cancelled,true);assert.equal(c.attempts,1);
});
function FakeWS(){const list=[];class W{constructor(url){this.url=url;this.readyState=1;list.push(this);}close(){if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose();}send(){}
  emit(o){this.onmessage&&this.onmessage({data:JSON.stringify(o)});}}W.list=list;return W;}
test('Ticker: harga dari stream, pesan rusak diabaikan, watchdog 20 detik, reconnect bertahap maks 30 detik',()=>{
  const W=FakeWS(),ck=fakeClock(),timers=[];
  const tk=Tr.createTicker({symbols:['BTCUSDT','ETHUSDT'],WebSocketImpl:W,now:ck.now,setTimer:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimer:()=>{}});
  assert(W.list[0].url.includes('btcusdt@ticker/ethusdt@ticker'));
  W.list[0].emit({stream:'btcusdt@ticker',data:{s:'BTCUSDT',c:'60000.5',P:'1.2'}});W.list[0].onmessage({data:'{rusak'});
  assert.equal(tk.prices.BTCUSDT.price,60000.5);assert(tk.isLive());
  ck.advance(21000);tk.watchdog();assert.equal(W.list[0].readyState,3);assert.equal(timers[0].ms,2000);
  for(let i=0;i<12;i++){timers[timers.length-1].fn();W.list[W.list.length-1].close();}
  assert.equal(timers[timers.length-1].ms,30000);tk.stop();
});
// ---------- live per posisi ----------
test('Live posisi: CVD taker (m=true → jual), orderbook imbalance, jendela CVD 5 menit, OI dasar sekali, sync tidak membuka ulang',async()=>{
  const W=FakeWS(),ck=fakeClock();
  const lv=Lv.createLive({WebSocketImpl:W,now:ck.now,setTimer:()=>0,clearTimer:()=>{},openInterest:async()=>1000+ck.now()%7});
  lv.sync(['BTCUSDT']);assert.equal(W.list.length,2);assert(W.list[0].url.includes('/market/stream?streams=btcusdt@aggTrade'));assert(W.list[1].url.includes('/public/stream?streams=btcusdt@depth20@500ms'));
  W.list[0].emit({stream:'btcusdt@aggTrade',data:{s:'BTCUSDT',p:'100',q:'2',m:false,T:ck.now()}});
  W.list[0].emit({stream:'btcusdt@aggTrade',data:{s:'BTCUSDT',p:'100',q:'0.5',m:true,T:ck.now()}});
  assert.equal(lv.data('BTCUSDT').cvd,150);assert.equal(lv.cvd5('BTCUSDT'),150);
  W.list[1].emit({stream:'btcusdt@depth20@500ms',data:{s:'BTCUSDT',b:[['99','3']],a:[['101','1']]}});
  assert(Math.abs(lv.data('BTCUSDT').imb-(297-101)/(297+101))<1e-12);
  lv.sync(['BTCUSDT']);assert.equal(W.list.length,2,'himpunan sama tidak membuka ulang');
  await lv.pollOI();const base=lv.data('BTCUSDT').oiBase;ck.advance(1);await lv.pollOI();assert.equal(lv.data('BTCUSDT').oiBase,base);
  ck.advance(6*60000);lv.tick();assert.equal(lv.cvd5('BTCUSDT'),0);assert.equal(lv.data('BTCUSDT').cvd,150);
  assert.equal(W.list[0].readyState,3,'stream diam > 20 detik ditutup');assert.equal(lv.data('BTCUSDT').wsOn,false);
  lv.sync(['ETHUSDT','BTCUSDT']);assert.equal(W.list.length,4);lv.stop();
});

// ---------- pemindaian statis ----------
const SRC=['app/index.html','app/main.js','app/ui.js','app/cycle.js','app/transport.js','app/live.js','app/labels.js','app/exec.js','app/sw.js',...fs.readdirSync(path.join(ROOT,'engine')).map(f=>'engine/'+f)];
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
test('Statis: tanpa endpoint order/akun, tanpa API key/signature, hanya REST publik + WebSocket pasar',()=>{
  for(const f of SRC){const s=read(f);
    for(const bad of [/\/fapi\/v\d\/order/i,/\/fapi\/v\d\/(account|balance|positionRisk|leverage|listenKey)/i,/X-MBX-APIKEY/i,/apiKey|api_key|secretKey/i,/[?&]signature=/i,/method:\s*['"](POST|DELETE|PUT)/i])
      assert(!bad.test(s),f+' memuat '+bad);}
  const hosts=new Set();for(const f of SRC)for(const m of read(f).matchAll(/(https?|wss):\/\/([a-z0-9.-]+)/gi))hosts.add(m[2]);
  assert.deepEqual([...hosts].filter(h=>!['fapi.binance.com','fstream.binance.com','fonts.googleapis.com','fonts.gstatic.com'].includes(h)),[]);
});
test('Statis UI §1: M6 tidak diklaim win rate/akurasi/peluang; tanpa ambang M6; tanpa tombol order',()=>{
  for(const f of ['app/index.html','app/ui.js','app/main.js','app/labels.js','app/exec.js']){const s=read(f);
    for(const m of s.matchAll(/win rate/gi)){const ctx=s.slice(Math.max(0,m.index-12),m.index);assert(/bukan\s*$/i.test(ctx)||/not_?$/i.test(ctx),f+': "win rate" tanpa "bukan"');}
    assert(!/akurasi|probabilitas profit|sinyal pasti|peluang menang\b(?!.*bukan)/i.test(s.replace(/bukan peluang menang/gi,'')),f+' memuat klaim terlarang');
    assert(!/\b(350|375|400)\b.*M6|M6.*\b(350|375|400)\b/.test(s),f+' memuat ambang M6');
    assert(!/>\s*(Beli|Jual|Buy|Sell|Order|Entry sekarang)\s*</i.test(s),f+' memuat tombol order');
  }
});

(async()=>{
  for(const [name,fn] of queue){try{await fn();count++;console.log('PASS '+name);}catch(e){failures.push(name);console.log('FAIL '+name+' — '+String(e&&e.message||e).split('\n')[0]);}}
  console.log(`\n${count} PASS, ${failures.length} FAIL`);
  if(failures.length)process.exit(1);
})();
