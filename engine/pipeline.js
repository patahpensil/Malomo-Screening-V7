/* Malomo V7 — pipeline keputusan per close 4H (PRD v1.0.7 §8–§10):
   INGEST → VALIDASI → INDIKATOR → M1 → GENERATOR M2 → KANONISASI → SKOR M2/AUDIT → M3 → M5 → CLOSE_CANDIDATE
   → NEXT_OPEN → CEK RISIKO M4 → RANKING M6 → ENTRY_CONSIDER | REJECTED_* | NO_ENTRY → LOG AUDIT.
   Tidak ada order. Semua keluaran berlabel research_only. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./m1'),require('./generators'),require('./m2'),require('./m3m4'));
  else{const M=root.Malomo;M.pipeline=factory(M.core,M.m1,M.generators,M.m2,M.m3m4);}
})(typeof globalThis!=='undefined'?globalThis:this,function(C,M1,G,M2,R){
  'use strict';
  const {H4,fin,iso,PAIRS}=C;
  const SCHEMA='PRD_M1_M6_CONFLUENSE_V1',SCORE_VERSION='MALOMO_V7_ENGINE_PRD_1.0.7';
  const FAMILY_ORDER=['BREAKOUT_RETEST','PULLBACK_CONTINUATION','REVERSAL_RETEST'];

  // Analisis satu simbol atas candle yang sudah close. Semua langkah kausal, jadi indeks k hanya bergantung pada c[0..k].
  const closesOf=analyses=>{const m=new Map();for(const [s,a] of analyses)m.set(s,new Map(a.c.map(x=>[x.t,x.close])));return m;};
  function analyzeSymbol(symbol,raw,nowMs,{archive=false}={}){
    const prep=C.prepare(raw,nowMs);
    const c=prep.candles.slice(prep.segStart),valid=prep.valid.slice(prep.segStart);
    const ind=C.indicators(c),piv=C.pivots(c);
    const events=G.finalize(G.all(c,ind,piv,{symbol}),archive);
    const byTc=new Map();for(const ev of events)if(ev.status==='CONFIRMED'){const k=ev.tc;if(!byTc.has(k))byTc.set(k,[]);byTc.get(k).push(ev);}
    const idxOf=new Map(c.map((x,i)=>[x.t,i]));
    return {symbol,c,valid,ind,piv,events,byTc,idxOf,flags:prep.flags,m1Cache:new Map(),
      m1At(i){if(!this.m1Cache.has(i))this.m1Cache.set(i,M1.score(c,ind,piv,i,0,valid));return this.m1Cache.get(i);}};
  }

  const tieKey=r=>[-(r._m6??-Infinity),-(r._q80??-Infinity),-(r._m1??-Infinity),r.symbol,r.side==='LONG'?0:1,r.signal_family];
  function cmp(a,b){const x=tieKey(a),y=tieKey(b);for(let i=0;i<x.length;i++){if(x[i]<y[i])return -1;if(x[i]>y[i])return 1;}return 0;}

  function invalidationOf(ev,c){
    if(ev.family==='PULLBACK_CONTINUATION'){
      const price=ev.sideN===1?ev.H0-0.85*(ev.H0-ev.L0):ev.L0+0.85*(ev.H0-ev.L0);
      return {rule:ev.sideN===1?'DEPTH_ABOVE_0_85_OR_LOW_BELOW_IMPULSE_ORIGIN':'DEPTH_ABOVE_0_85_OR_HIGH_ABOVE_IMPULSE_ORIGIN',level:ev.sideN===1?ev.L0:ev.H0,price};
    }
    return ev.sideN===1?{rule:'CLOSE_BELOW_LEVEL_MINUS_R',level:ev.level,price:ev.level-ev.r}:{rule:'CLOSE_ABOVE_LEVEL_PLUS_R',level:ev.level,price:ev.level+ev.r};
  }

  /* Satu siklus keputusan pada T (= close candle t = decision_available_utc).
     analyses: Map simbol → analyzeSymbol(...). entryOpen(symbol) → open candle t+1 atau null (fase CLOSE_CANDIDATE).
     provider: M2.provider(...). portfolio: {positions}. log: array tujuan catatan audit. */
  function decide(T,analyses,{provider,portfolio={positions:[]},entryOpen=()=>null,log=[],pairs=PAIRS,closes=null}={}){
    const tOpen=T-H4,records=[],conflictLogs=[];
    // M3 sekali per timestamp (konteks bersama). `closes` boleh diberikan pemanggil (peta yang sama) agar replay tidak membangun ulang tiap T.
    if(!closes){closes=new Map();for(const [s,a] of analyses)closes.set(s,new Map(a.c.map(x=>[x.t,x.close])));}
    const m3=R.m3(closes,tOpen,pairs);
    for(const [symbol,a] of analyses){
      const i=a.idxOf.get(tOpen);
      const evs=i===undefined?[]:(a.byTc.get(i)||[]);
      if(!evs.length)continue;
      // §9 kanonisasi: duplikat identik digabung; dua arah → CONFLICTING_DIRECTIONS; >1 keluarga → MULTI_METHOD_COLLISION.
      const groups=new Map();
      for(const ev of evs){const k=ev.side+'|'+ev.family;if(!groups.has(k))groups.set(k,{ev,dup:0});else groups.get(k).dup++;}
      const uniq=[...groups.values()];
      const sides=new Set(uniq.map(u=>u.ev.side)),fams={};
      for(const u of uniq)(fams[u.ev.side]=fams[u.ev.side]||new Set()).add(u.ev.family);
      const conflict=sides.size>1;
      const entry={key:symbol+'|4h|'+iso(T),sidesChecked:['LONG','SHORT'],familiesEvaluated:FAMILY_ORDER.slice(),
        found:uniq.map(u=>u.ev.side+':'+u.ev.family),result:conflict?'CONFLICTING_DIRECTIONS':Object.values(fams).some(f=>f.size>1)?'MULTI_METHOD_COLLISION':'UNIQUE',checked:true,conflict};
      conflictLogs.push(entry);log.push({type:'CONFLICT_CHECK',...entry});
      const m1=a.m1At(i);
      for(const u of uniq){
        const ev=u.ev,rec=baseRecord(ev,a,T,m1);
        rec.source_labels=[ev.family];rec.duplicate_count=u.dup;
        if(conflict||fams[ev.side].size>1){
          const st=conflict?'CONFLICTING_DIRECTIONS':'MULTI_METHOD_COLLISION';
          rec.event_status=st;rec.status=st;rec.score_status='NOT_APPLICABLE';rec.reasons=[st];records.push(rec);continue;
        }
        // Skor M2 kualitas + integritas.
        const feat=M2.features(a.c,i,ev.sideN),q=M2.quality(ev,feat,provider,T);
        const causalOk=a.valid.slice(Math.max(0,i-180),i+1).every(Boolean)&&q.status!=='DATA_INCOMPLETE';
        const integ=M2.integrity({causalOk,dedupOk:true,conflictLog:entry});
        rec._features=feat.raw;rec._q=q;
        rec.normalization_version=q.version||null;rec.calibration_policy=q.policy||null;rec.prior_same_family_events=q.priorN??null;
        rec.scores.m2_signal_quality_80=q.quality80;rec.scores.m2_integrity_20=integ.integrity20;
        rec.scores.m2_components=q.status==='SCORED'?{generation30:q.generation30,momentum25:q.momentum25,participation25:q.participation25,ecdf:q.q,generation_parts:q.generationParts}:null;
        rec.scores.m2_integrity_components=integ.status==='SCORED'?{causal10:integ.causal10,dedup6:integ.dedup6,conflict4:integ.conflict4}:null;
        rec.scores.m3_100=m3.score;rec.scores.m3_components=m3.components||null;
        rec.scores.m5_100=R.M5.score;
        rec.scores.m1_plus_m2q_0_180_display_only=fin(m1.score)&&fin(q.quality80)?m1.score+q.quality80:null;
        // §8.1.2 gate arah.
        const dirOk=ev.family==='REVERSAL_RETEST'?(ev.side==='SHORT'?ev.m1Origin==='BULLISH':ev.m1Origin==='BEARISH')
          :m1.direction===(ev.side==='LONG'?'BULLISH':'BEARISH');
        if(!dirOk){rec.status='REJECTED_DIRECTION';rec.score_status=allScored(m1,q,m3)?'SCORED':'NO_SCORE';rec.reasons=['DIRECTION_GATE'];records.push(rec);continue;}
        if(!allScored(m1,q,m3)){
          rec.score_status=q.status==='CALIBRATION_INCOMPLETE'?'CALIBRATION_INCOMPLETE':q.status==='DATA_INCOMPLETE'?'DATA_INCOMPLETE':q.status==='SCORE_INCOMPLETE'?'SCORE_INCOMPLETE':'NO_SCORE';
          rec.status='NO_ENTRY';rec.reasons=[...(m1.reasons||[]),...(q.reasons||[]),...(m3.reasons||[])];if(!rec.reasons.length)rec.reasons=['NO_SCORE'];records.push(rec);continue;
        }
        if(integ.status!=='SCORED'||integ.integrity20<20){rec.score_status=integ.status==='SCORED'?'SCORED':'AUDIT_INCOMPLETE';rec.status='REJECTED_INTEGRITY';rec.reasons=integ.reasons.length?integ.reasons:['INTEGRITY_BELOW_20'];records.push(rec);continue;}
        rec.scores.m2_100=q.quality80+20;rec.score_status='SCORED';
        rec._m1=m1.score;rec._q80=q.quality80;rec._m6pre=m1.score+rec.scores.m2_100+m3.score+100+R.M5.score;
        rec._atrEntry=a.ind.atr[i];
        rec.status='CLOSE_CANDIDATE';rec.reasons=[];records.push(rec);
      }
    }
    // Fase ENTRY_REVIEW: open candle berikutnya diketahui → rencana & M4, alokasi berurutan menurut ranking.
    let pf=R.release(portfolio,T);
    const cands=records.filter(r=>r.status==='CLOSE_CANDIDATE');
    for(const r of cands)r._m6=r._m6pre;
    cands.sort(cmp);
    cands.forEach((r,k)=>{r.rank_provisional=k+1;});
    for(const r of cands){
      const open=entryOpen(r.symbol);
      if(!fin(open))continue;                        // tetap CLOSE_CANDIDATE, harga null
      const pl=R.plan(r.side,open,r._atrEntry),chk=R.check(r.symbol,pl,pf);
      Object.assign(r,{entry_reference_open:open,atr_entry:r._atrEntry,stop_price:pl.stop,target_price:pl.target,qty:pl.ok?pl.qty:null,
        risk_pct:pl.ok?pl.riskPct:null,gross_pct:pl.ok?pl.grossPct:null});
      if(chk.m4===100){
        r.status='ENTRY_CONSIDER';r.scores.m4_100=100;r.scores.m6_confluense_500=r._m6;r.scores.m6_display_pct_not_winrate=r._m6/5;
        pf={positions:[...pf.positions,{symbol:r.symbol,side:r.side,entryMs:T,slotReleaseMs:T+R.MANDATE.holdMs,risk:pl.risk,notional:pl.notional,entry:open,stop:pl.stop,target:pl.target}]};
      }else{r.status='REJECTED_RISK';r.scores.m4_100_audit_partial=chk.m4;r.reasons=chk.reasons;}
    }
    for(const r of records){delete r._m6pre;delete r._m6;delete r._m1;delete r._q80;delete r._atrEntry;}
    // Urutan keluaran = ranking tie-break untuk yang punya skor, lalu sisanya.
    records.sort((a,b)=>(a.rank_provisional??1e9)-(b.rank_provisional??1e9)||a.symbol.localeCompare(b.symbol)||a.side.localeCompare(b.side)||a.signal_family.localeCompare(b.signal_family));
    const summary={decision_available_utc:iso(T),m3:m3.score,m3_status:m3.status,counts:{},no_entry:!records.some(r=>r.status==='ENTRY_CONSIDER')};
    for(const r of records)summary.counts[r.status]=(summary.counts[r.status]||0)+1;
    log.push({type:'CYCLE',...summary});
    return {T,records,portfolio:pf,summary,conflictLogs};
  }
  const allScored=(m1,q,m3)=>m1.status==='SCORED'&&q.status==='SCORED'&&m3.status==='SCORED';

  function baseRecord(ev,a,T,m1){
    const c=a.c;
    return {schema:SCHEMA,event_status:'CONFIRMED',score_status:null,status:null,reasons:[],research_only:true,synthetic_fixture:false,
      venue:'BINANCE_USDM_FUTURES',symbol:ev.symbol,timeframe:'4h',
      break_utc:ev.family==='PULLBACK_CONTINUATION'?null:iso(c[ev.t0].t+H4),confirmation_utc:iso(T),decision_available_utc:iso(T),entry_reference_time_utc:iso(T),
      side:ev.side,signal_family:ev.family,market_structure_direction:m1.direction,m1_origin_direction:ev.family==='REVERSAL_RETEST'?ev.m1Origin:null,
      scores:{m1_100:m1.score,m1_components:m1.components,m2_signal_quality_80:null,m2_integrity_20:null,m2_100:null,m3_100:null,m4_100:null,m5_100:null,
        m6_confluense_500:null,m6_display_pct_not_winrate:null,m1_plus_m2q_0_180_display_only:null},
      equity_sim:R.MANDATE.equity,atr_entry:null,atr_frozen:ev.atrFrozen??null,entry_reference_open:null,stop_price:null,target_price:null,qty:null,
      risk_pct:null,gross_pct:null,rr_target:R.MANDATE.rr,max_holding_hours:24,invalidation:invalidationOf(ev,c),
      normalization_version:null,risk_mandate_version:R.MANDATE.version,m5_snapshot:R.M5.snapshot,m5_scope:R.M5.scope,score_version:SCORE_VERSION,
      data_quality_flags:a.flags.map(f=>f.reason),source_labels:[ev.family],audit_trail:[]};
  }

  // Event yang masih menunggu pada ujung deret (untuk Papan Event): tanpa skor.
  function pending(analyses){
    const out=[];
    for(const [,a] of analyses)for(const ev of a.events)if(['WAITING_RETEST','WAITING_ZONE','WAITING_CONTINUATION','CHOCH_CANDIDATE'].includes(ev.status))
      out.push({symbol:ev.symbol,side:ev.side,signal_family:ev.family,event_status:ev.status,score_status:'NOT_APPLICABLE',status:null,level:ev.level,
        started_utc:iso(a.c[ev.t0??ev.createdIdx].t+H4),progress:ev.family==='PULLBACK_CONTINUATION'
          ?(ev.status==='WAITING_ZONE'?{window:'zone',candle:a.c.length-1-ev.createdIdx,of:24}:{window:'trigger',candle:a.c.length-1-ev.z,of:12})
          :{window:'retest',candle:a.c.length-1-ev.t0,of:G.RULES.W}});
    return out;
  }

  /* Replay arsip: semua T dalam [startMs, endMs]. trainEndMs: event dengan T ≤ trainEndMs dinilai ECDF prior-only
     (riwayat event CONFIRMED keluarga sama, waktu ketat lebih awal, ≥ 30), setelahnya array beku. */
  function replay(candlesBySymbol,{frozen,trainEndMs=null,startMs,endMs,pairs=PAIRS}){
    const analyses=new Map();for(const s of pairs)analyses.set(s,analyzeSymbol(s,candlesBySymbol[s],Infinity,{archive:true}));
    const history=[],prov=M2.provider({frozen,trainEndMs,history:trainEndMs===null?null:history});
    const times=new Set();for(const [,a] of analyses)for(const x of a.c)times.add(x.t+H4);
    const Ts=[...times].filter(T=>T>=startMs&&T<=endMs).sort((a,b)=>a-b);
    let portfolio={positions:[]};const out=[],log=[],closes=closesOf(analyses);
    for(const T of Ts){
      const entryOpen=s=>{const a=analyses.get(s),k=a.idxOf.get(T);return k===undefined?null:a.c[k].open;};
      const res=decide(T,analyses,{provider:prov,portfolio,entryOpen,log,pairs,closes});
      portfolio=res.portfolio;out.push(...res.records);
      // Riwayat kalibrasi prior-only: seluruh event CONFIRMED (sebelum kanonisasi) dengan fitur lengkap.
      if(trainEndMs!==null&&T<=trainEndMs)for(const [,a] of analyses){
        const i=a.idxOf.get(T-H4);for(const ev of (i===undefined?[]:a.byTc.get(i)||[])){
          const f=M2.features(a.c,i,ev.sideN);if(f.reasons.length)continue;
          history.push({family:ev.family,t:T,raw:Object.assign({},f.raw,{rawT:ev.rawT,rawR:ev.rawR})});
        }
      }
    }
    return {records:out,log,analyses};
  }
  return {SCHEMA,SCORE_VERSION,analyzeSymbol,closesOf,decide,pending,replay,compare:cmp};
});
