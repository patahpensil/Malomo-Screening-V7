/* Malomo V7 — generator sinyal M2 (PRD v1.0.7 §4.2–§4.4): Breakout–Retest, Pullback Continuation, Reversal–Retest.
   Satu lintasan maju atas candle yang sudah close; indeks event relatif terhadap deret yang diberikan.
   Status: WAITING_RETEST / WAITING_ZONE / WAITING_CONTINUATION / CHOCH_CANDIDATE → CONFIRMED / INVALID / EXPIRED /
   PREZONE_CENSORED. Bila deret berakhir sebelum event selesai, status tunggu dipertahankan (live) atau CENSORED (arsip). */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./m1'));
  else (root.Malomo=root.Malomo||{}).generators=factory(root.Malomo.core,root.Malomo.m1);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,M1){
  'use strict';
  const {clip,fin,confirmedUpTo}=C;
  const RULES=Object.freeze({b:0.05,r:0.10,W:6,pbZoneLo:0.25,pbZoneHi:0.75,pbInvalid:0.85,pbPrezone:24,pbTrigger:12});
  const last=a=>a.length?a[a.length-1]:null;

  // Mesin retest bersama Breakout & Reversal (§4.2): invalidasi close lebih dahulu, lalu touch, lalu konfirmasi.
  function stepRetest(ev,c,k){
    const x=c[k],s=ev.sideN,L=ev.level;ev.status='WAITING_RETEST';
    if(s*(x.close-L)<-ev.r){ev.status='INVALID';ev.endIdx=k;return;}
    if(x.high>=L-ev.r&&x.low<=L+ev.r&&ev.retestIdx===null){ev.retestIdx=k;ev.retestE=s===1?x.low:x.high;}
    if(ev.retestIdx!==null&&s*(x.close-L)>ev.b){ev.status='CONFIRMED';ev.tc=k;ev.endIdx=k;return;}
    if(k===ev.t0+RULES.W){ev.status='EXPIRED';ev.endIdx=k;}
  }

  function breakout(c,ind,piv,{symbol}={}){
    const events=[],used={LONG:new Set(),SHORT:new Set()},active=[];
    for(let t=1;t<c.length;t++){
      // Event selesai (apa pun hasilnya) melepas pivot-nya; pivot yang sama boleh membangkitkan event baru sesudahnya.
      for(const ev of active.splice(0))if(ev.status==='WAITING_RETEST'){stepRetest(ev,c,t);if(ev.status==='WAITING_RETEST')active.push(ev);else used[ev.side].delete(ev.keyIdx);}
      const A=ind.atr[t-1];if(!(fin(A)&&A>0))continue;
      for(const side of ['LONG','SHORT']){
        // §4.2: satu event aktif per (pair, side, pivot) dan level tidak diganti pivot baru sampai event selesai
        // → selama ada event aktif di sisi ini, tidak ada break baru (mereproduksi 410/410 event arsip 2024).
        if(active.some(e=>e.side===side))continue;
        const list=side==='LONG'?piv.highs:piv.lows,p=last(confirmedUpTo(list,t-1));   // level confirmed sebelum candle break
        if(!p||used[side].has(p.i))continue;
        const s=side==='LONG'?1:-1,b=RULES.b*A,L=p.price;
        if(s*(c[t-1].close-L)<=b&&s*(c[t].close-L)>b){
          used[side].add(p.i);
          const ev={family:'BREAKOUT_RETEST',symbol,side,sideN:s,keyIdx:p.i,level:L,t0:t,atrFrozen:A,b,r:RULES.r*A,
            status:'WAITING_RETEST',retestIdx:null,retestE:null,tc:null,endIdx:null};
          events.push(ev);active.push(ev);
        }
      }
    }
    for(const ev of events)if(ev.status==='CONFIRMED'){
      const P=clip(1-Math.abs(ev.retestE-ev.level)/(0.5*ev.atrFrozen)),tau=ev.tc-ev.t0,F=clip(1-(tau-1)/RULES.W);
      ev.generation={C:1,P,F,tau,generation30:15+10*P+5*F};
    }
    return events;
  }

  function reversal(c,ind,piv,{symbol}={}){
    const events=[],used={LONG:new Set(),SHORT:new Set()},active=[];
    for(let t=1;t<c.length;t++){
      for(const ev of active.splice(0))if(ev.status==='CHOCH_CANDIDATE'){stepRetest(ev,c,t);if(ev.status==='WAITING_RETEST')ev.status='CHOCH_CANDIDATE';if(ev.status==='CHOCH_CANDIDATE')active.push(ev);}
      const A=ind.atr[t-1];if(!(fin(A)&&A>0))continue;
      // M1_origin: struktur dari pivot yang confirm <= t−1 (sebelum candle break diproses), PRD v1.0.2 §4.4.
      const st=M1.structure(piv,t-1);
      if(st.label!=='BULLISH'&&st.label!=='BEARISH')continue;
      let side,prot;
      if(st.label==='BULLISH'){side='SHORT';prot=last(st.ls.filter(l=>l.i<st.h2.i));}   // HL terakhir sebelum HH terbaru
      else{side='LONG';prot=last(st.hs.filter(h=>h.i<st.l2.i));}                       // LH terakhir sebelum LL terbaru
      if(!prot||used[side].has(prot.i))continue;
      // "HL"/"LH" (§4.4): protected pivot wajib benar-benar higher low / lower high terhadap pivot sejenis sebelumnya.
      const same=side==='SHORT'?st.ls:st.hs,k=same.indexOf(prot),prev=k>0?same[k-1]:null;
      if(!prev||(side==='SHORT'?!(prot.price>prev.price):!(prot.price<prev.price)))continue;
      const s=side==='LONG'?1:-1,b=RULES.b*A,L=prot.price;
      if(s*(c[t-1].close-L)<=b&&s*(c[t].close-L)>b){
        used[side].add(prot.i);
        const ev={family:'REVERSAL_RETEST',symbol,side,sideN:s,keyIdx:prot.i,level:L,t0:t,atrFrozen:A,b,r:RULES.r*A,
          m1Origin:st.label,status:'CHOCH_CANDIDATE',retestIdx:null,retestE:null,tc:null,endIdx:null,
          rawT:(s*(c[t].close-L)-b)/A};
        events.push(ev);active.push(ev);
      }
    }
    for(const ev of events)if(ev.status==='CONFIRMED')ev.rawR=(ev.sideN*(c[ev.tc].close-ev.level)-ev.b)/ev.atrFrozen;
    return events;
  }

  function pullback(c,ind,piv,{symbol}={}){
    const events=[],active=[],R=RULES;
    const hiAt=new Map(piv.highs.map(p=>[p.i,p])),loAt=new Map(piv.lows.map(p=>[p.i,p]));
    for(let t=1;t<c.length;t++){
      for(const ev of active.splice(0)){stepPullback(ev,c,t);if(ev.status==='WAITING_ZONE'||ev.status==='WAITING_CONTINUATION')active.push(ev);}
      // Setup lahir pada close i+2 saat pivot impuls i resmi terkonfirmasi (v1.0.2; 868/868 historis).
      const i=t-2;if(i<0)continue;
      const st=M1.structure(piv,t);
      for(const side of ['LONG','SHORT']){
        // §4.3: satu setup per impuls dan impuls tidak diganti di tengah setup → satu setup aktif per (symbol, side).
        if(active.some(e=>e.side===side))continue;
        const imp=side==='LONG'?hiAt.get(i):loAt.get(i);if(!imp)continue;
        if(st.label!==(side==='LONG'?'BULLISH':'BEARISH'))continue;
        const opp=last(confirmedUpTo(side==='LONG'?piv.lows:piv.highs,t).filter(p=>p.i<i));if(!opp)continue;
        const H0=side==='LONG'?imp.price:opp.price,L0=side==='LONG'?opp.price:imp.price;
        if(!(H0-L0>0))continue;
        const ev={family:'PULLBACK_CONTINUATION',symbol,side,sideN:side==='LONG'?1:-1,keyIdx:i,p:i,createdIdx:t,H0,L0,
          ext:null,status:'WAITING_ZONE',z:null,dz:null,tc:null,endIdx:null,level:side==='LONG'?L0:H0};
        events.push(ev);active.push(ev);
      }
    }
    function stepPullback(ev,c,k){
      const x=c[k],L=ev.sideN===1;
      ev.ext=ev.ext===null?(L?x.low:x.high):(L?Math.min(ev.ext,x.low):Math.max(ev.ext,x.high));
      const d=L?(ev.H0-ev.ext)/(ev.H0-ev.L0):(ev.ext-ev.L0)/(ev.H0-ev.L0);
      // Invalidasi lebih dahulu: kedalaman > 0.85 atau melampaui asal impuls.
      if(d>R.pbInvalid||(L?x.low<ev.L0:x.high>ev.H0)){ev.status='INVALID';ev.endIdx=k;return;}
      if(ev.status==='WAITING_ZONE'){
        if(d>=R.pbZoneLo&&d<=R.pbZoneHi){ev.status='WAITING_CONTINUATION';ev.z=k;ev.dz=d;}
        else{if(k>=ev.createdIdx+R.pbPrezone){ev.status='PREZONE_CENSORED';ev.endIdx=k;}return;}
      }
      // Trigger micro-break close, paling lambat z+12 inklusif; wick tidak boleh menjadi trigger.
      if(k>=2){
        const trig=L?x.close>Math.max(c[k-1].high,c[k-2].high):x.close<Math.min(c[k-1].low,c[k-2].low);
        if(trig){ev.status='CONFIRMED';ev.tc=k;ev.endIdx=k;return;}
      }
      if(k>=ev.z+R.pbTrigger){ev.status='EXPIRED';ev.endIdx=k;}
    }
    for(const ev of events)if(ev.status==='CONFIRMED'){
      let s=0;for(let j=ev.p+1;j<=ev.z;j++)s+=Math.abs(c[j].close-c[j-1].close);
      const Q=s>0?Math.abs(c[ev.p].close-c[ev.z].close)/s:NaN;
      const Loc=clip(1-Math.abs(ev.dz-0.5)/0.35),age=ev.tc-ev.z,Tim=clip(1-age/R.pbTrigger);
      ev.generation=fin(Q)?{Q,Location:Loc,Trigger:1,Timing:Tim,age,generation30:5*Q+10*Loc+5+10*Tim}:{Q:null,generation30:null,scoreIncomplete:true};
    }
    return events;
  }

  // Status tunggu di ujung deret: live → tetap; arsip (finalize) → CENSORED.
  function finalize(events,archive){
    if(archive)for(const ev of events)if(['WAITING_RETEST','WAITING_ZONE','WAITING_CONTINUATION','CHOCH_CANDIDATE'].includes(ev.status))ev.status='CENSORED';
    return events;
  }
  function all(c,ind,piv,opts={}){
    return [...breakout(c,ind,piv,opts),...pullback(c,ind,piv,opts),...reversal(c,ind,piv,opts)];
  }
  return {RULES,breakout,pullback,reversal,all,finalize,stepRetest};
});
