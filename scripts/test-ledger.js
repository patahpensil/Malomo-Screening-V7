'use strict';
/* Tes PRD v1.0.13 R35 — ledger Decision terkunci + Jurnal Sinyal: pembekuan sekali, tidak pernah ditimpa, hasil SL/TP/
   horizon dari candle 4H (stop lebih dahulu), harga keluar, NO_DATA, filter, ringkasan, CSV, pemuatan aman. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const LG=require('../app/ledger'),Cy=require('../app/cycle'),M2=require('../engine/m2'),S=require('./synthetic');
const ROOT=path.resolve(__dirname,'..'),H4=4*3600*1000;
let count=0;const failures=[];const queue=[];const test=(n,f)=>queue.push([n,f]);

const T0=Date.UTC(2026,9,10,8);
const rec=(o={})=>Object.assign({symbol:'SOLUSDT',side:'LONG',signal_family:'BREAKOUT_RETEST',status:'ENTRY_CONSIDER',decision_available_utc:new Date(T0).toISOString().replace('.000Z','Z'),
  entry_reference_time_utc:new Date(T0).toISOString().replace('.000Z','Z'),entry_reference_open:100,stop_price:97,target_price:106,rr_target:2,atr_entry:2,market_structure_direction:'BULLISH',
  invalidation:{rule:'CLOSE_BELOW_LEVEL_MINUS_R',price:98},score_version:'v',normalization_version:'n',risk_mandate_version:'r',
  scores:{m1_100:70,m2_signal_quality_80:60,m2_100:80,m3_100:25,m4_100:100,m5_100:55,m6_confluense_500:330,m1_plus_m2q_0_180_display_only:130}},o);
const c=(i,o,h,l,cl)=>({t:T0+i*H4,open:o,high:h,low:l,close:cl});

test('freeze: hanya ENTRY_CONSIDER; sumber live/replay; peringkat & rezim dicatat; field wajib tidak lengkap → diabaikan',()=>{
  const L=LG.empty();
  const {added}=LG.freeze(L,[rec(),rec({symbol:'XRPUSDT',status:'REJECTED_RISK'}),rec({symbol:'ETHUSDT',decision_available_utc:new Date(T0-H4).toISOString(),entry_reference_time_utc:new Date(T0-H4).toISOString()}),rec({symbol:'BNBUSDT',stop_price:null})],
    {regimes:{['SOLUSDT|LONG|BREAKOUT_RETEST|'+rec().decision_available_utc]:{code:'ALIGNED',label:'BULLISH'}},ranks:{SOLUSDT:7},currentT:T0,now:T0+5000});
  assert.equal(added.length,2);const e=Object.values(L.entries).find(x=>x.symbol==='SOLUSDT');
  assert.equal(e.source,'live');assert.equal(e.rank,7);assert.deepEqual(e.regime,{code:'ALIGNED',label:'BULLISH'});assert.equal(e.scores.m6,330);assert.equal(e.scores.m1m2q,130);
  assert.equal(Object.values(L.entries).find(x=>x.symbol==='ETHUSDT').source,'replay');
});
test('SKOR DIKUNCI: record yang sama dengan skor/harga lain tidak pernah menimpa entri yang sudah ada',()=>{
  const L=LG.empty();LG.freeze(L,[rec()],{currentT:T0,now:T0});
  const snap=JSON.stringify(L);
  const {added}=LG.freeze(L,[rec({entry_reference_open:111,stop_price:90,target_price:140,scores:{m1_100:1,m2_signal_quality_80:1,m2_100:1,m3_100:1,m4_100:1,m5_100:1,m6_confluense_500:5,m1_plus_m2q_0_180_display_only:2}})],{currentT:T0+H4,now:T0+H4});
  assert.equal(added.length,0);assert.equal(JSON.stringify(L),snap);
});
test('Hasil: stop dievaluasi lebih dahulu; target; horizon 24 jam (6 candle) dengan harga keluar = close candle ke-6',()=>{
  const e={side:'LONG',entry:100,stop:97,target:106,entryMs:T0};
  assert.deepEqual(LG.outcomeOf(e,[c(0,100,107,96,101)],T0+10*H4),{code:'STOP_HIT',atMs:T0+H4,exit:97,r:-1},'SL & TP di candle sama → SL');
  assert.deepEqual(LG.outcomeOf(e,[c(0,100,101,99,100),c(1,100,106.5,99,105)],T0+10*H4),{code:'TARGET_HIT',atMs:T0+2*H4,exit:106,r:2});
  const flat=[0,1,2,3,4,5].map(i=>c(i,100,101,99,100+i*0.3));
  const h=LG.outcomeOf(e,flat,T0+10*H4);assert.equal(h.code,'HORIZON_EXIT');assert.equal(h.exit,101.5);assert(Math.abs(h.r-0.5)<1e-12);assert.equal(h.atMs,T0+6*H4);
  assert.equal(LG.outcomeOf(e,flat.slice(0,3),T0+3*H4).code,'OPEN');
  assert.equal(LG.outcomeOf(e,flat,T0+3*H4).code,'OPEN','candle yang belum close tidak dihitung');
  const s={side:'SHORT',entry:100,stop:103,target:94,entryMs:T0};
  assert.equal(LG.outcomeOf(s,[c(0,100,103.2,99,101)],T0+H4).code,'STOP_HIT');assert.equal(LG.outcomeOf(s,[c(0,100,101,93.9,95)],T0+H4).code,'TARGET_HIT');
});
test('resolve: hasil final tidak berubah lagi; tanpa candle & lewat 48 jam → NO_DATA (bukan tebakan)',()=>{
  const L=LG.empty();LG.freeze(L,[rec(),rec({symbol:'ADAUSDT'})],{currentT:T0,now:T0});
  LG.resolve(L,{SOLUSDT:[c(0,100,101,96,97)]},T0+H4);
  const sol=Object.values(L.entries).find(x=>x.symbol==='SOLUSDT');assert.equal(sol.outcome.code,'STOP_HIT');
  LG.resolve(L,{SOLUSDT:[c(0,100,120,99,119)]},T0+2*H4);assert.equal(sol.outcome.code,'STOP_HIT','hasil final tidak ditimpa');
  const ada=Object.values(L.entries).find(x=>x.symbol==='ADAUSDT');assert.equal(ada.outcome.code,'OPEN');
  LG.resolve(L,{},T0+49*3600*1000);assert.equal(ada.outcome.code,'NO_DATA');
});
test('active/finished/summary/filter: slot 24 jam, urutan, rata-rata R tanpa NO_DATA, filter M6',()=>{
  const L=LG.empty();
  LG.freeze(L,[rec({symbol:'A1USDT'}),rec({symbol:'A2USDT',scores:Object.assign({},rec().scores,{m6_confluense_500:350})})],{currentT:T0,now:T0});
  assert.deepEqual(LG.active(L,T0+H4).map(x=>x.symbol),['A2USDT','A1USDT']);assert.equal(LG.active(L,T0+24*3600*1000).length,0);
  LG.resolve(L,{A1USDT:[c(0,100,107,99,106)],A2USDT:[c(0,100,101,96,97)]},T0+H4);
  const f=LG.finished(L),sm=LG.summary(f);assert.equal(sm.n,2);assert.equal(sm.TARGET_HIT,1);assert.equal(sm.STOP_HIT,1);assert.equal(sm.avgR,0.5);
  assert.deepEqual(LG.filter(f,{m6min:340}).map(x=>x.symbol),['A2USDT']);assert.deepEqual(LG.filter(f,{outcome:'TARGET_HIT'}).map(x=>x.symbol),['A1USDT']);
});
test('CSV: BOM, header tetap, satu baris per sinyal, nilai dengan koma/kutip di-escape, hasil berbahasa Indonesia',()=>{
  const L=LG.empty();LG.freeze(L,[rec({symbol:'X,"Y"USDT'})],{currentT:T0,now:T0});LG.resolve(L,{'X,"Y"USDT':[c(0,100,107,99,106)]},T0+H4);
  const out=LG.csv(LG.finished(L));assert(out.startsWith('﻿'));const lines=out.slice(1).trim().split('\r\n');
  assert.equal(lines[0],LG.COLS.join(','));assert.equal(lines.length,2);assert(lines[1].includes('"X,""Y""USDT"'));assert(lines[1].includes('kena TP'));
  assert(lines[1].includes('2026-10-10T08:00:00Z'));assert(lines[1].includes('2026-10-10 16:00'),'waktu WITA');
});
test('load: data rusak/versi lain dibuang; entri sah dipertahankan apa adanya',()=>{
  const L=LG.empty();LG.freeze(L,[rec()],{currentT:T0,now:T0});
  const raw=JSON.parse(JSON.stringify(L));raw.entries.bad={key:'bad',symbol:'Z'};raw.entries.bad2={key:'x',symbol:'ZUSDT',side:'LONG'};
  const back=LG.load(raw);assert.deepEqual(Object.keys(back.entries),Object.keys(L.entries));assert.deepEqual(back,L);
  assert.deepEqual(LG.load({version:99,entries:raw.entries}).entries,{});assert.deepEqual(LG.load(null).entries,{});
});
test('Hasil ledger = hasil outcome engine PRD §6 (cycle.outcome) untuk semua posisi siklus sintetis',()=>{
  const FROZEN=M2.frozenFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_v2_normalizations.json'),'utf8')));
  const RAW=S.generate({n:1600}),cand=Object.fromEntries(Object.entries(RAW).map(([s,r])=>[s,r.map(Cy.toCandle)]));
  const now=RAW.BTCUSDT[1599][0]+10000,st=Cy.buildState({rawBySymbol:cand,now,frozen:FROZEN});
  const L=LG.freeze(LG.empty(),st.history,{currentT:st.T,now}).ledger;LG.resolve(L,cand,now);let n=0;
  for(const p of [...st.book.closed,...st.book.active]){const e=L.entries[p.id];assert(e,'posisi tanpa entri ledger '+p.id);
    const want=p.outcome.code==='OPEN'?'OPEN':p.outcome.code;assert.equal(e.outcome.code,want,p.id);
    if(Number.isFinite(p.outcome.r))assert(Math.abs(e.outcome.r-p.outcome.r)<1e-9,p.id);n++;}
  assert(n>20,'cakupan '+n);
});
test('Batas ukuran: lebih dari 5.000 entri → entri tertua dibuang',()=>{
  const L=LG.empty(),recs=[];for(let i=0;i<5010;i++){const t=new Date(T0+i*H4).toISOString();recs.push(rec({symbol:'P'+i+'USDT',decision_available_utc:t,entry_reference_time_utc:t}));}
  LG.freeze(L,recs,{currentT:T0,now:T0});assert.equal(Object.keys(L.entries).length,5000);assert(!Object.values(L.entries).some(e=>e.symbol==='P0USDT'));
});

(async()=>{
  for(const [name,fn] of queue){try{await fn();count++;console.log('PASS '+name);}catch(e){failures.push(name);console.log('FAIL '+name+' — '+String(e&&e.message||e).split('\n')[0]);}}
  console.log(`\n${count} PASS, ${failures.length} FAIL`);
  if(failures.length)process.exit(1);
})();
