'use strict';
/* Paritas lapisan skor M2 engine terhadap bukti 2024 (tanpa butuh OHLCV):
   - 772 event evidence/ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv: engine (M2.provider + M2.quality) dengan
     fitur mentah dari CSV wajib mereproduksi m2_quality80_causal_for_decision (train prior-only ≥30, eval array beku),
     null tepat pada 91 event CALIBRATION_INCOMPLETE, dan jumlah event pembanding yang sama.
   - 410 event Breakout: array beku engine mereproduksi referensi in-sample (CSV kanonis). */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M2=require('../engine/m2');
const ROOT=path.resolve(__dirname,'..'),E=p=>path.join(ROOT,'evidence',p);
let count=0;const failures=[];
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(e){failures.push(name);console.log('FAIL '+name+' — '+String(e.message).split('\n')[0]);}}
function csv(p){const [h,...rows]=fs.readFileSync(p,'utf8').trim().split(/\r?\n/);const k=h.split(',');return rows.map(r=>{const v=r.split(',');return Object.fromEntries(k.map((x,i)=>[x,v[i]]));});}
const num=v=>v===''||v===undefined||/nan/i.test(v)?NaN:Number(v);
const FAM={BREAKOUT:'BREAKOUT_RETEST',PULLBACK:'PULLBACK_CONTINUATION',REVERSAL:'REVERSAL_RETEST'};
const frozen=M2.frozenFrom(JSON.parse(fs.readFileSync(E('frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(E('frozen_v2_normalizations.json'),'utf8')));
const rows=csv(E('ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv'));
const ev=r=>({family:FAM[r.signal_family],t:Date.parse(r.confirmation_available_utc),
  raw:{e4:num(r.raw_e4),closepos:num(r.raw_closepos),rvol:num(r.raw_rvol),taker:num(r.raw_taker),rawT:num(r.raw_reversal_trigger),rawR:num(r.raw_reversal_retest)},
  generation:{generation30:num(r.m2_signal_generation30_archived)},rawT:num(r.raw_reversal_trigger),rawR:num(r.raw_reversal_retest)});
const train=rows.filter(r=>r.period==='TRAIN').map(ev);
const trainEnd=Math.max(...train.map(x=>x.t));
const prov=M2.provider({frozen,trainEndMs:trainEnd,history:train});

test('772 event: skor kualitas 80 engine = m2_quality80_causal_for_decision (toleransi 1e−8)',()=>{
  let bad=0,checked=0;
  for(const r of rows){
    const e=ev(r),q=M2.quality(e,{raw:e.raw,reasons:[]},prov,e.t),want=num(r.m2_quality80_causal_for_decision);
    if(Number.isNaN(want)){if(q.status!=='CALIBRATION_INCOMPLETE'||q.quality80!==null)bad++;continue;}
    checked++;if(q.status!=='SCORED'||Math.abs(q.quality80-want)>1e-8)bad++;
  }
  assert.equal(rows.length,772);assert.equal(checked,681);assert.equal(bad,0,bad+' baris berbeda');
});
test('Kebijakan & jumlah pembanding: train prior-only ketat (<), eval array beku; 91 CALIBRATION_INCOMPLETE semuanya train',()=>{
  let inc=0;
  for(const r of rows){
    const e=ev(r),q=M2.quality(e,{raw:e.raw,reasons:[]},prov,e.t);
    if(r.period==='TRAIN'){assert.equal(q.policy,'EXPANDING_PRIOR_ONLY');assert.equal(q.priorN,Number(r.prior_same_family_train_events));}
    else assert.equal(q.policy,'FROZEN_COMPLETE_TRAIN_ECDF');
    if(q.status==='CALIBRATION_INCOMPLETE'){inc++;assert.equal(r.period,'TRAIN');}
  }
  assert.equal(inc,91);
});
test('410 Breakout: array beku engine mereproduksi referensi in-sample CSV kanonis',()=>{
  const canon=csv(E('CANONICAL_SCORES_410_EVENTS_2024.csv'));
  const key=(p,s,t)=>p+'|'+s+'|'+t;
  const m=new Map(canon.map(c=>[key(c.pair,c.side==='1'?'LONG':'SHORT',c.decision_available_utc.replace(' ','T').replace('+00:00','Z')),Number(c.signal_quality_80)]));
  let n=0;
  for(const r of rows.filter(x=>x.signal_family==='BREAKOUT')){
    const e=ev(r),q=M2.quality(e,{raw:e.raw,reasons:[]},M2.provider({frozen}),e.t);
    const want=m.get(key(r.pair,r.side,r.confirmation_available_utc));assert(want!==undefined,'event kanonis tidak ditemukan');
    assert(Math.abs(q.quality80-want)<1e-9,r.event_key+' '+q.quality80+' ≠ '+want);n++;
  }
  assert.equal(n,410);
});
console.log(`\n${count} PASS, ${failures.length} FAIL`);
if(failures.length)process.exit(1);
