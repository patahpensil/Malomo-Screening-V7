/* Malomo V7 — M1 Market Structure & Regime (PRD v1.0.7 §2–§3).
   M1 = structure45 + te25 + adx10 + vol20; arah = field terpisah, bukan tanda skor. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'));
  else (root.Malomo=root.Malomo||{}).m1=factory(root.Malomo.core);
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const {clip,fin,confirmedUpTo}=C;

  // Label struktur dari dua high dan dua low terakhir yang confirm <= k.
  function structure(piv,k){
    const hs=confirmedUpTo(piv.highs,k),ls=confirmedUpTo(piv.lows,k);
    if(hs.length<2||ls.length<2)return {label:'INCOMPLETE',hs,ls};
    const h1=hs[hs.length-2],h2=hs[hs.length-1],l1=ls[ls.length-2],l2=ls[ls.length-1];
    const label=h2.price>h1.price&&l2.price>l1.price?'BULLISH':h2.price<h1.price&&l2.price<l1.price?'BEARISH':'TRANSITION';
    return {label,hs,ls,h1,h2,l1,l2};
  }

  // M1 pada candle t (sudah close). seg = indeks awal segmen tanpa gap (jendela tidak boleh melintasi gap).
  function score(c,ind,piv,t,seg=0,valid=null){
    const ok=(a,b)=>{if(a<seg)return false;if(valid)for(let i=a;i<=b;i++)if(!valid[i])return false;return true;};
    const st=structure(piv,t);
    const reasons=[];
    if(st.label==='INCOMPLETE')reasons.push('M1_SWING_INSUFFICIENT');
    let te=NaN;
    if(t-14>=0&&ok(t-14,t)){let s=0;for(let j=t-13;j<=t;j++)s+=Math.abs(c[j].close-c[j-1].close);te=s>0?Math.abs(c[t].close-c[t-14].close)/s:NaN;}
    if(!fin(te))reasons.push('M1_TE_INCOMPLETE');
    const adx=ind.adx[t];if(!fin(adx))reasons.push('M1_ADX_INCOMPLETE');
    let p=NaN;
    if(t-120>=0&&ok(t-120,t)&&fin(ind.natr[t])){
      let cnt=0,good=true;for(let j=t-120;j<=t-1;j++){const v=ind.natr[j];if(!fin(v)){good=false;break;}if(v<=ind.natr[t])cnt++;}
      if(good)p=cnt/120;
    }
    if(!fin(p))reasons.push('M1_NATR_HISTORY_INCOMPLETE');
    const direction=st.label==='INCOMPLETE'?null:st.label;
    if(reasons.length)return {score:null,status:'INCOMPLETE',direction,reasons,components:null,structure:st};
    const s45=st.label==='TRANSITION'?22.5:45,te25=25*clip(te),adx10=10*clip(adx/50),vol20=20*clip(1-2*Math.abs(p-0.5));
    return {score:s45+te25+adx10+vol20,status:'SCORED',direction,reasons:[],structure:st,
      components:{structure45:s45,te25,adx10,vol20,te14:te,adx14:adx,natr_pct:p}};
  }
  return {structure,score};
});
