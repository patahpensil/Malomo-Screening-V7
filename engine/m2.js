/* Malomo V7 — M2 fitur momentum/participation, kalibrasi ECDF per keluarga, skor kualitas 80 dan integritas 20
   (PRD v1.0.7 §2 Kalibrasi, §4.4–§4.6). Semua ECDF tie kanan; tiap keluarga memakai array-nya sendiri. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'));
  else (root.Malomo=root.Malomo||{}).m2=factory(root.Malomo.core);
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const {fin,ecdf,sortedCopy}=C;
  const MIN_PRIOR=30;
  const FAMILIES=['BREAKOUT_RETEST','PULLBACK_CONTINUATION','REVERSAL_RETEST'];

  // §4.5 fitur mentah pada candle konfirmasi t untuk arah s (+1/−1). Hanya candle tutup.
  function features(c,t,s,family){
    const reasons=[],f={e4:NaN,closepos:NaN,rvol:NaN,taker:NaN};
    // Arsip Breakout 2024 (canonical, array beku train-2024-03-21…breakout-retest-v1) menghitung penyebut + 1e−12;
    // arsip Pullback/Reversal v2 tanpa epsilon. Diikuti persis agar ECDF beku tidak bergeser satu langkah pada
    // kasus searah murni (E4 = 1 vs 0.99999999994 di array). Penyebut 0 tetap INCOMPLETE (§4.5).
    if(t>=4){let num=0,den=0;for(let j=t-3;j<=t;j++){const r=Math.log(c[j].close/c[j-1].close);num+=r;den+=Math.abs(r);}
      f.e4=den>0?s*num/(den+(family==='BREAKOUT_RETEST'?1e-12:0)):NaN;}
    if(!fin(f.e4))reasons.push('E4_INCOMPLETE');
    const x=c[t];f.closepos=x.high>x.low?s*(2*(x.close-x.low)/(x.high-x.low)-1):NaN;
    if(!fin(f.closepos))reasons.push('CLOSEPOS_INCOMPLETE');
    if(t>=20){let m=0;for(let j=t-20;j<=t-1;j++)m+=c[j].volume;m/=20;const rv=m>0?x.volume/m:NaN;f.rvol=rv>0?Math.log(rv):NaN;}
    if(!fin(f.rvol))reasons.push('RVOL_INCOMPLETE');
    f.taker=fin(x.takerBuyBase)&&x.volume>0&&x.takerBuyBase>=0&&x.takerBuyBase<=x.volume?s*(2*x.takerBuyBase/x.volume-1):NaN;
    if(!fin(f.taker))reasons.push('TAKER_INCOMPLETE');
    return {raw:f,reasons};
  }

  // Array beku dari paket evidence (frozen_cdf_normalization.json + frozen_v2_normalizations.json).
  function frozenFrom(cdf1,cdf2){
    const F=cdf1.features,pb=cdf2.pullback.features,rv=cdf2.reversal.features,rs=cdf2.reversal_signal_cdf.features;
    const pack=(e,l,v,b,version)=>({e4:sortedCopy(e),closepos:sortedCopy(l),rvol:sortedCopy(v),taker:sortedCopy(b),version});
    return {
      BREAKOUT_RETEST:pack(F.E.sorted_train,F.L.sorted_train,F.V.sorted_train,F.B.sorted_train,cdf1.version),
      PULLBACK_CONTINUATION:pack(pb.mo_e4_raw.values,pb.mo_close_raw.values,pb.pa_rvol_raw.values,pb.pa_taker_raw.values,cdf2.pullback.scope),
      REVERSAL_RETEST:Object.assign(pack(rv.mo_e4_raw.values,rv.mo_close_raw.values,rv.pa_rvol_raw.values,rv.pa_taker_raw.values,cdf2.reversal.scope),
        {trigger:sortedCopy(rs.trigger_raw.values),retest:sortedCopy(rs.retest_raw.values),signalVersion:cdf2.reversal_signal_cdf.scope}),
    };
  }

  /* Penyedia kalibrasi.
     - FROZEN: array beku (keputusan setelah akhir kalibrasi, termasuk live).
     - Replay periode kalibrasi: ECDF prior-only expanding dari event train keluarga sama dengan waktu konfirmasi
       lebih awal SECARA KETAT; < 30 → CALIBRATION_INCOMPLETE (bukan 0). */
  function provider({frozen,trainEndMs=null,history=null}){
    return {
      arrays(family,tMs){
        if(trainEndMs===null||tMs>trainEndMs||!history)return {ok:true,policy:'FROZEN_COMPLETE_TRAIN_ECDF',arrays:frozen[family],version:frozen[family].version,n:null};
        const prior=history.filter(h=>h.family===family&&h.t<tMs);
        if(prior.length<MIN_PRIOR)return {ok:false,policy:'EXPANDING_PRIOR_ONLY',n:prior.length,reason:'CALIBRATION_INCOMPLETE'};
        const col=k=>sortedCopy(prior.map(h=>h.raw[k]));
        const a={e4:col('e4'),closepos:col('closepos'),rvol:col('rvol'),taker:col('taker')};
        if(family==='REVERSAL_RETEST'){a.trigger=col('rawT');a.retest=col('rawR');}
        return {ok:true,policy:'EXPANDING_PRIOR_ONLY',arrays:a,version:'PRIOR_ONLY_'+family,n:prior.length};
      }
    };
  }

  // Skor kualitas 80 = generation30 + momentum25 + participation25. Missing → INCOMPLETE, tanpa prorata.
  function quality(ev,feat,prov,tMs){
    if(feat.reasons.length)return {status:'DATA_INCOMPLETE',reasons:feat.reasons,quality80:null};
    const cal=prov.arrays(ev.family,tMs);
    if(!cal.ok)return {status:'CALIBRATION_INCOMPLETE',reasons:['CALIBRATION_INCOMPLETE'],quality80:null,priorN:cal.n,policy:cal.policy};
    const A=cal.arrays,f=feat.raw;
    let gen=null,genParts=null;
    if(ev.family==='REVERSAL_RETEST'){
      const T=ecdf(A.trigger,ev.rawT),R=ecdf(A.retest,ev.rawR);
      if(fin(T)&&fin(R)){gen=15*T+15*R;genParts={T,R,rawT:ev.rawT,rawR:ev.rawR};}
    }else if(ev.generation&&fin(ev.generation.generation30)){gen=ev.generation.generation30;genParts=ev.generation;}
    if(!fin(gen))return {status:'SCORE_INCOMPLETE',reasons:['GENERATION30_UNDEFINED'],quality80:null};
    const q={E:ecdf(A.e4,f.e4),L:ecdf(A.closepos,f.closepos),V:ecdf(A.rvol,f.rvol),B:ecdf(A.taker,f.taker)};
    const momentum25=15*q.E+10*q.L,participation25=10*q.V+15*q.B;
    return {status:'SCORED',reasons:[],generation30:gen,generationParts:genParts,momentum25,participation25,
      quality80:gen+momentum25+participation25,q,raw:f,policy:cal.policy,version:cal.version,priorN:cal.n};
  }

  // §4.6 integritas 10/6/4. conflict4 berbasis log (v1.0.4): log hilang → AUDIT_INCOMPLETE, bukan 0 diam-diam.
  function integrity({causalOk,dedupOk,conflictLog}){
    if(causalOk===undefined||dedupOk===undefined)return {status:'AUDIT_INCOMPLETE',integrity20:null,reasons:['AUDIT_INCOMPLETE']};
    if(!conflictLog||!conflictLog.checked)return {status:'AUDIT_INCOMPLETE',integrity20:null,causal10:causalOk?10:0,dedup6:dedupOk?6:0,conflict4:null,reasons:['CONFLICT_CHECK_NOT_LOGGED']};
    const causal10=causalOk?10:0,dedup6=dedupOk?6:0,conflict4=conflictLog.conflict?0:4;
    return {status:'SCORED',causal10,dedup6,conflict4,integrity20:causal10+dedup6+conflict4,reasons:[]};
  }
  return {MIN_PRIOR,FAMILIES,features,frozenFrom,provider,quality,integrity};
});
