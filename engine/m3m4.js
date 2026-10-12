/* Malomo V7 — M3 Quantitative Dependence (PRD §5), M4 Risk & Portofolio simulasi (§6), M5 snapshot (§7). */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'));
  else (root.Malomo=root.Malomo||{}).m3m4=factory(root.Malomo.core);
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const {clip,fin,quantile,pearson,H4,PAIRS}=C;

  /* M3 pada timestamp keputusan T (close candle t). closesBySymbol: Map simbol → Map(openTime → close).
     Kedua jendela berakhir pada candle sebelum t (return candle t tidak dipakai). Butuh 181 close sinkron. */
  function m3(closesBySymbol,tOpen,pairs=PAIRS){
    const need=181,rets={};
    for(const s of pairs){
      const m=closesBySymbol.get(s);if(!m)return {score:null,status:'INCOMPLETE',reasons:['M3_PAIR_MISSING:'+s]};
      const cl=[];for(let k=need;k>=1;k--){const v=m.get(tOpen-k*H4);if(!(fin(v)&&v>0))return {score:null,status:'INCOMPLETE',reasons:['M3_HISTORY_INCOMPLETE:'+s]};cl.push(v);}
      const r=[];for(let k=1;k<cl.length;k++)r.push(Math.log(cl[k]/cl[k-1]));rets[s]=r;   // 180 return, terakhir = candle t−1
    }
    const corrs=[];
    for(let a=0;a<pairs.length;a++)for(let b=a+1;b<pairs.length;b++){
      const x=rets[pairs[a]].slice(-60),y=rets[pairs[b]].slice(-60),cr=pearson(x,y);
      if(!fin(cr))return {score:null,status:'INCOMPLETE',reasons:['M3_ZERO_VARIANCE']};corrs.push(Math.abs(cr));
    }
    const A=corrs.reduce((s,v)=>s+v,0)/corrs.length,Qc=1-clip(A),correlation60=60*Qc;
    const q10={};for(const s of pairs)q10[s]=quantile(rets[s],0.1);
    let hits=0;for(let k=0;k<180;k++){let cnt=0;for(const s of pairs)if(rets[s][k]<q10[s])cnt++;if(cnt>=3)hits++;}
    const J=hits/180,Qj=1-clip(J/0.15),tail40=40*Qj;
    return {score:correlation60+tail40,status:'SCORED',reasons:[],components:{correlation60,tail40,meanAbsCorr:A,J,pairsCorr:corrs.length}};
  }

  const MANDATE=Object.freeze({version:'RESEARCH_1_3_1X_V1',equity:100,riskTrade:0.01,riskOpen:0.03,gross:1.0,maxPositions:3,stopAtr:1.5,rr:2,rr2:null,tp1Frac:1,capPerPosition:true,holdMs:24*3600*1000});
  /* Mandat LIVE (PRD v1.0.15 R37, keputusan pengguna 2026-10-12): maks 10 posisi, risiko 1%/trade, risiko terbuka ≤10%,
     batas notional (gross) DIHAPUS (total dan per posisi), TP1 = 2R (tutup 50%), TP2 = 3R (sisa 50%), SL tetap, horizon 24 jam.
     Rumus M4 (40D+35P+25N) dan seluruh bobot/skor M1–M6 TIDAK berubah — hanya parameter kapasitas & exit.
     MANDATE riset di atas tetap dipakai oleh tes paritas/verifikasi PRD riset. */
  const LIVE=Object.freeze({version:'LIVE_10P_1PCT_TP2R3R_V1',equity:100,riskTrade:0.01,riskOpen:0.10,gross:Infinity,maxPositions:10,stopAtr:1.5,rr:2,rr2:3,tp1Frac:0.5,capPerPosition:false,holdMs:24*3600*1000});
  const EPS=1e-12;
  // Portofolio simulasi (v1.0.5): slot terisi 24 jam tetap; stop/target hanya outcome, tidak membebaskan slot.
  function release(portfolio,tMs){return {positions:(portfolio.positions||[]).filter(p=>!(p.slotReleaseMs<=tMs))};}
  function plan(side,entry,atrEntry,M=MANDATE){
    const s=side==='LONG'?1:-1,dist=M.stopAtr*atrEntry,stop=entry-s*dist,target=entry+s*M.rr*dist,target2=fin(M.rr2)?entry+s*M.rr2*dist:null;
    const ok=fin(entry)&&entry>0&&fin(atrEntry)&&atrEntry>0&&stop>0&&(target2===null||target2>0);
    if(!ok)return {ok:false,entry,stop,target,target2};
    const byRisk=M.riskTrade*M.equity/Math.abs(entry-stop);
    const qty=M.capPerPosition===false?byRisk:Math.min(byRisk,M.equity/entry);
    const risk=qty*Math.abs(entry-stop),notional=qty*entry;
    return {ok:true,entry,stop,target,target2,qty,risk,notional,riskPct:100*risk/M.equity,grossPct:100*notional/M.equity,stopDistance:dist};
  }
  // M4 = 40D + 35P + 25N, dengan reason terpisah. Untuk kandidat layak entry ketiganya wajib 1 (M4=100).
  function check(symbol,pl,portfolio,M=MANDATE){
    const pos=portfolio.positions||[],reasons=[];
    const D=pl.ok&&pl.risk<=M.riskTrade*M.equity+EPS?1:0;
    if(!D)reasons.push('PLAN_RISK_INVALID');
    const openRisk=pos.reduce((s,p)=>s+p.risk,0),gross=pos.reduce((s,p)=>s+p.notional,0);
    const pairActive=pos.some(p=>p.symbol===symbol);
    const capFail=pos.length+1>M.maxPositions||(D&&openRisk+pl.risk>M.riskOpen*M.equity+EPS);
    if(pairActive)reasons.push('PAIR_ACTIVE');
    if(capFail)reasons.push('POSITION_OR_RISK_CAP');
    const P=!pairActive&&!capFail?1:0;
    const N=D&&gross+pl.notional<=M.gross*M.equity+EPS?1:0;
    if(D&&!N)reasons.push('GROSS_CAP');
    return {D,P,N,m4:40*D+35*P+25*N,reasons,openRiskPct:100*openRisk/M.equity,grossPct:100*gross/M.equity};
  }

  const M5=Object.freeze({score:55,snapshot:'M5_AUDIT_2024_CLOSED_BAR_9BPS_V1',scope:'BREAKOUT_2024_NO_DIRECTION_GATE',indicators:{C:1,P:1,K:0,R:0}});
  return {m3,MANDATE,LIVE,release,plan,check,M5};
});
