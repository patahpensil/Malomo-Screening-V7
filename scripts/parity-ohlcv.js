#!/usr/bin/env node
'use strict';
/* Paritas penuh engine ↔ bukti 2024 dari candle mentah. Butuh arsip OHLCV 4H Binance USDⓈ-M 2024 untuk 6 pair di
   data/ohlcv-2024/<SYMBOL>.csv (format kline Binance: open_time,open,high,low,close,volume,close_time,quote_volume,count,
   taker_buy_volume,taker_buy_quote_volume,ignore; header opsional). Tanpa data → SKIP (bukan PASS).
   Yang dibandingkan:
     1. Himpunan event CONFIRMED (keluarga, pair, side, waktu konfirmasi) vs 772 event CSV kausal.
     2. Breakout: M1 dan generation30 vs CSV kanonis 410 event.
     3. Skor kualitas 80 kausal (train prior-only, eval beku) vs m2_quality80_causal_for_decision. */
const fs=require('node:fs'),path=require('node:path');
const C=require('../engine/core'),M2=require('../engine/m2'),P=require('../engine/pipeline');
const ROOT=path.resolve(__dirname,'..'),DIR=process.argv[2]||path.join(ROOT,'data','ohlcv-2024');
const E=p=>path.join(ROOT,'evidence',p);
const GH=process.env.GITHUB_ACTIONS==='true',say=(k,m)=>console.log(GH?`::${k}::${m}`:m);
function csv(p){const [h,...rows]=fs.readFileSync(p,'utf8').trim().split(/\r?\n/);const k=h.split(',');return rows.map(r=>{const v=r.split(',');return Object.fromEntries(k.map((x,i)=>[x,v[i]]));});}
function klines(p){
  return fs.readFileSync(p,'utf8').trim().split(/\r?\n/).filter(l=>/^\d/.test(l)).map(l=>{const v=l.split(',').map(Number);
    return {t:v[0],open:v[1],high:v[2],low:v[3],close:v[4],volume:v[5],ct:v[6],quoteVolume:v[7],trades:v[8],takerBuyBase:v[9]};});
}
const missing=C.PAIRS.filter(s=>!fs.existsSync(path.join(DIR,s+'.csv')));
if(missing.length){console.log('SKIP paritas OHLCV — arsip belum ada untuk: '+missing.join(', ')+' (di '+DIR+')');process.exit(0);}
const FAM={BREAKOUT:'BREAKOUT_RETEST',PULLBACK:'PULLBACK_CONTINUATION',REVERSAL:'REVERSAL_RETEST'};
const ev772=csv(E('ECDF_PRIOR_ONLY_ALL_FAMILIES_772_EVENTS_2024.csv')),canon=csv(E('CANONICAL_SCORES_410_EVENTS_2024.csv'));
// Jendela populasi bukti per keluarga (awal kalibrasi s.d. event terakhir yang outcome 24 jamnya masih ada di arsip).
const win={};for(const r of ev772){const f=FAM[r.signal_family],t=Date.parse(r.confirmation_available_utc);win[f]=win[f]||[Infinity,-Infinity];win[f][0]=Math.min(win[f][0],t);win[f][1]=Math.max(win[f][1],t);}
const inWin=(f,T)=>win[f]&&T>=win[f][0]&&T<=win[f][1];
// Regresi v1.0.8: 11 break Reversal yang gagal kronologi pivot wajib TIDAK dibangkitkan (status apa pun).
const NOT_GEN=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','reversal_not_generated_2024.json'),'utf8')).events;
const trainEnd=Math.max(...ev772.filter(r=>r.period==='TRAIN').map(r=>Date.parse(r.confirmation_available_utc)));
const frozen=M2.frozenFrom(JSON.parse(fs.readFileSync(E('frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(E('frozen_v2_normalizations.json'),'utf8')));
const engine=[];
const an=new Map();
for(const s of C.PAIRS){const a=P.analyzeSymbol(s,klines(path.join(DIR,s+'.csv')),Infinity,{archive:true});an.set(s,a);
  if(a.flags.length)console.log('Catatan data '+s+': '+a.flags.length+' flag ('+[...new Set(a.flags.map(f=>f.reason))].join(',')+')');
  for(const ev of a.events)if(ev.status==='CONFIRMED'){const T=a.c[ev.tc].t+C.H4;if(inWin(ev.family,T))engine.push({a,ev,T,key:ev.family+'|'+s+'|'+ev.side+'|'+C.iso(T)});}}
const want=new Map(ev772.map(r=>[FAM[r.signal_family]+'|'+r.pair+'|'+r.side+'|'+r.confirmation_available_utc,r]));
const got=new Map(engine.map(x=>[x.key,x]));
const miss=[...want.keys()].filter(k=>!got.has(k)),extra=[...got.keys()].filter(k=>!want.has(k));
const notGenBad=NOT_GEN.filter(k=>got.has(k));
say(notGenBad.length?'error':'notice',`Regresi Reversal: ${NOT_GEN.length-notGenBad.length}/${NOT_GEN.length} event terlarang tidak dibangkitkan`);
// Regresi v1.0.8: Breakout boleh memakai ulang pivot setelah event selesai (BTCUSDT SHORT level 68830, dua konfirmasi).
const btc=['BREAKOUT_RETEST|BTCUSDT|SHORT|2024-05-27T08:00:00Z','BREAKOUT_RETEST|BTCUSDT|SHORT|2024-05-27T12:00:00Z'].map(k=>got.get(k));
const reuseOk=btc.every(Boolean)&&btc[0].ev.level===68830&&btc[1].ev.level===68830;
say(reuseOk?'notice':'error','Regresi Breakout pakai ulang pivot 68830 (BTCUSDT SHORT 27 Mei 08:00 & 12:00): '+(reuseOk?'terdeteksi':'GAGAL'));
for(const f of Object.values(FAM)){const w=[...want.keys()].filter(k=>k.startsWith(f+'|')),g=[...got.keys()].filter(k=>k.startsWith(f+'|'));
  say('notice',`${f}: bukti ${w.length}, engine ${g.length}, cocok ${w.filter(k=>got.has(k)).length}, ekstra ${g.filter(k=>!want.has(k)).length}`);}
say('notice',`Event CONFIRMED: engine ${got.size}, bukti ${want.size}, cocok ${[...want.keys()].filter(k=>got.has(k)).length}, hilang ${miss.length}, ekstra ${extra.length}`);
if(miss.length)say('warning','contoh hilang: '+miss.slice(0,5).join('  '));
if(extra.length)say('warning','contoh ekstra: '+extra.slice(0,5).join('  '));
// Skor kualitas kausal: riwayat prior-only dibangun dari event engine sendiri.
const hist=engine.filter(x=>x.T<=trainEnd).map(x=>{const f=M2.features(x.a.c,x.ev.tc,x.ev.sideN,x.ev.family);return {family:x.ev.family,t:x.T,raw:Object.assign({},f.raw,{rawT:x.ev.rawT,rawR:x.ev.rawR})};});
const prov=M2.provider({frozen,trainEndMs:trainEnd,history:hist});
let qBad=0,qN=0,m1Bad=0,m1N=0,gBad=0;
const cmap=new Map(canon.map(c=>['BREAKOUT_RETEST|'+c.pair+'|'+(c.side==='1'?'LONG':'SHORT')+'|'+c.decision_available_utc.replace(' ','T').replace('+00:00','Z'),c]));
for(const [k,x] of got){
  const r=want.get(k);if(!r)continue;
  const q=M2.quality(x.ev,M2.features(x.a.c,x.ev.tc,x.ev.sideN,x.ev.family),prov,x.T),w=Number(r.m2_quality80_causal_for_decision||NaN);
  qN++;if(Number.isNaN(w)?q.quality80!==null:!(Math.abs(q.quality80-w)<1e-6)){qBad++;if(process.env.PDEBUG)console.log('Q',k,r.period,q.status,q.priorN,r.prior_same_family_train_events,q.quality80,w);}
  const c=cmap.get(k);if(c){m1N++;const m=x.a.m1At(x.ev.tc);if(!(Math.abs((m.score??NaN)-Number(c.m1_100))<1e-6))m1Bad++;
    if(!(Math.abs(x.ev.generation.generation30-Number(c.signal_generation_30))<1e-9))gBad++;}
}
say('notice',`Skor kualitas 80 kausal: ${qN-qBad}/${qN} cocok · M1 Breakout: ${m1N-m1Bad}/${m1N} · generation30 Breakout: ${m1N-gBad}/${m1N}`);
const ok=!miss.length&&!extra.length&&!qBad&&!m1Bad&&!gBad&&!notGenBad.length&&reuseOk;
say(ok?'notice':'error',ok?'PARITAS PENUH: PASS':'PARITAS PENUH: FAIL');process.exit(ok?0:1);
