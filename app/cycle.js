/* Malomo V7 — susunan satu siklus 4H untuk tampilan (fungsi murni, tanpa DOM/jaringan).
   Semua keputusan berasal dari engine PRD v1.0.8 (pipeline.decide). Modul ini hanya:
   - mengubah kline Binance menjadi candle engine,
   - menjalankan decide secara kronologis atas candle yang diunduh supaya portofolio simulasi §6 (slot 24 jam,
     ekuitas 100 tanpa kompaun) terbentuk dari keputusan sebelumnya,
   - menandai FETCH_FAILED (§1) bila data pair belum berhasil diambil untuk close terakhir,
   - menyiapkan data layar S1–S6 (UI/UX §3). Tidak ada order dan tidak ada skor tambahan. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../engine/core'),require('../engine/m2'),require('../engine/m3m4'),require('../engine/pipeline'));
  else{const M=root.Malomo;M.cycle=factory(M.core,M.m2,M.m3m4,M.pipeline);}
})(typeof globalThis!=='undefined'?globalThis:this,function(C,M2,R,P){
  'use strict';
  const {H4,PAIRS,fin,iso}=C;
  const KLINE_LIMIT=1500;              // batas maksimum endpoint klines Binance USDⓈ-M (≈250 hari 4H)
  const BOARD_LOOKBACK=30;             // Papan Event: event selesai dalam 30 candle terakhir (5 hari); hanya tampilan
  const CHART_CANDLES=60;
  const WAITING=['WAITING_RETEST','WAITING_ZONE','WAITING_CONTINUATION','CHOCH_CANDIDATE'];
  const ENDED=['INVALID','EXPIRED','PREZONE_CENSORED','CENSORED'];

  // Kline Binance: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]
  function toCandle(k){
    return {t:Number(k[0]),open:Number(k[1]),high:Number(k[2]),low:Number(k[3]),close:Number(k[4]),volume:Number(k[5]),
      ct:Number(k[6]),quoteVolume:Number(k[7]),trades:Number(k[8]),takerBuyBase:Number(k[9])};
  }
  const lastClosedT=now=>Math.floor(now/H4)*H4;   // close candle terakhir = open candle yang sedang berjalan

  /* Outcome riset posisi (§6 butir 4, §8.1.8): stop/target hanya mencatat hasil dan TIDAK membebaskan slot.
     Candle 4H yang sudah close di [entry, entry+24 jam). Stop dievaluasi lebih dahulu bila keduanya tersentuh. */
  function outcome(pos,candles,now){
    const end=pos.entryMs+R.MANDATE.holdMs,s=pos.side==='LONG'?1:-1,dist=Math.abs(pos.entry-pos.stop);
    const win=candles.filter(x=>x.t>=pos.entryMs&&x.t<end&&x.t+H4<=now);
    for(const x of win){
      const stopHit=s===1?x.low<=pos.stop:x.high>=pos.stop,targetHit=s===1?x.high>=pos.target:x.low<=pos.target;
      if(stopHit)return {code:'STOP_HIT',atMs:x.t+H4,r:-1};
      if(targetHit)return {code:'TARGET_HIT',atMs:x.t+H4,r:R.MANDATE.rr};
    }
    const need=R.MANDATE.holdMs/H4;
    if(win.length>=need){const last=win[need-1];return {code:'HORIZON_EXIT',atMs:last.t+H4,r:dist>0?s*(last.close-pos.entry)/dist:null};}
    return {code:'OPEN',atMs:null,r:null,candlesSeen:win.length,of:need};
  }

  function buildState({rawBySymbol,now,frozen,failed=[],pairs=PAIRS,frozenMeta=null}){
    const T=lastClosedT(now),analyses=new Map(),rowsAt=new Map();
    for(const s of pairs){
      const rows=rawBySymbol&&rawBySymbol[s];if(!rows||!rows.length)continue;
      analyses.set(s,P.analyzeSymbol(s,rows,now,{archive:false}));
      rowsAt.set(s,new Map(rows.filter(r=>r.t<=now).map(r=>[r.t,r])));
    }
    // Pair yang gagal diambil dan datanya belum mencakup close terakhir → FETCH_FAILED untuk siklus ini.
    const lastCloseOf=s=>{const a=analyses.get(s);return a&&a.c.length?a.c[a.c.length-1].t+H4:null;};
    const fetchFailed=pairs.filter(s=>failed.includes(s)&&!(lastCloseOf(s)>=T));
    const provider=M2.provider({frozen});
    const closes=P.closesOf(analyses);
    // T yang perlu diputuskan: setiap close yang punya event CONFIRMED + close terakhir.
    // Melewati T tanpa event setara dengan decide kosong (release slot idempoten, diulang pada T berikutnya).
    const Ts=new Set([T]);
    for(const [,a] of analyses)for(const k of a.byTc.keys()){const t=a.c[k].t+H4;if(t<=T)Ts.add(t);}
    const order=[...Ts].sort((a,b)=>a-b);
    let portfolio={positions:[]},current=null;const log=[],history=[];
    for(const Tk of order){
      const entryOpen=s=>{const r=rowsAt.get(s)&&rowsAt.get(s).get(Tk);return r&&fin(r.open)&&r.open>0?r.open:null;};
      const res=P.decide(Tk,analyses,{provider,portfolio,entryOpen,log,pairs,closes});
      portfolio=res.portfolio;
      for(const r of res.records)history.push(r);
      if(Tk===T)current=res;
    }
    // FETCH_FAILED: siklus terakhir berstatus DATA_INCOMPLETE sementara (bukan gap permanen), reason dicatat di depan.
    if(fetchFailed.length){
      // Ranking & alokasi bergantung pada semua pair (kandidat pair yang gagal bisa lebih tinggi), jadi keputusan yang
      // bergantung lintas pair ditahan sampai data lengkap. Gate per-event (arah, integritas, bentrok) tetap apa adanya.
      for(const r of current.records)if(['NO_ENTRY','CLOSE_CANDIDATE','ENTRY_CONSIDER','REJECTED_RISK'].includes(r.status)){
        r.status='NO_ENTRY';r.score_status='DATA_INCOMPLETE';
        r.reasons=['FETCH_FAILED',...r.reasons.filter(x=>!['FETCH_FAILED','GROSS_CAP','PAIR_ACTIVE','POSITION_OR_RISK_CAP','PLAN_RISK_INVALID'].includes(x))];
        r.scores.m4_100=null;delete r.scores.m4_100_audit_partial;r.scores.m6_confluense_500=null;r.scores.m6_display_pct_not_winrate=null;
      }
      current.summary.counts={};for(const r of current.records)current.summary.counts[r.status]=(current.summary.counts[r.status]||0)+1;
      current.summary.no_entry=!current.records.some(r=>r.status==='ENTRY_CONSIDER');
    }
    const cycle={T,nextCloseMs:T+H4,records:current.records,summary:Object.assign({},current.summary,{
      data_status:fetchFailed.length?'DATA_INCOMPLETE':'OK',fetch_failed:fetchFailed,
      phase:current.records.some(r=>r.status==='CLOSE_CANDIDATE')?'CLOSE_CANDIDATE':'ENTRY_REVIEW'}),
      conflictLogs:current.conflictLogs};
    const positions=history.filter(r=>r.status==='ENTRY_CONSIDER').map(r=>{
      const entryMs=Date.parse(r.entry_reference_time_utc);
      const pos={id:r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc,symbol:r.symbol,side:r.side,family:r.signal_family,
        entryMs,slotReleaseMs:entryMs+R.MANDATE.holdMs,entry:r.entry_reference_open,stop:r.stop_price,target:r.target_price,qty:r.qty,
        riskPct:r.risk_pct,grossPct:r.gross_pct,invalidation:r.invalidation,m6:r.scores.m6_confluense_500,record:r};
      pos.outcome=outcome(pos,analyses.get(r.symbol).c,now);
      pos.active=pos.slotReleaseMs>now;
      return pos;
    });
    const active=positions.filter(p=>p.active);
    const book={active,closed:positions.filter(p=>!p.active).reverse(),
      openRiskPct:active.reduce((s,p)=>s+p.riskPct,0),grossPct:active.reduce((s,p)=>s+p.grossPct,0),
      maxPositions:R.MANDATE.maxPositions,riskOpenMaxPct:100*R.MANDATE.riskOpen,grossMaxPct:100*R.MANDATE.gross,
      rejections:history.filter(r=>r.status==='REJECTED_RISK').reverse(),rejectionCounts:{},
      replayFromMs:order.length?firstCandleMs(analyses):null,equity:R.MANDATE.equity};
    for(const r of book.rejections)for(const x of r.reasons)book.rejectionCounts[x]=(book.rejectionCounts[x]||0)+1;
    return {now,T,cycle,history,book,board:board(analyses,history,T),context:context(analyses,T,pairs),
      health:health(analyses,pairs,T,fetchFailed,failed),calibration:calibration(frozen,frozenMeta),log,analyses};
  }
  const firstCandleMs=analyses=>{let m=Infinity;for(const [,a] of analyses)if(a.c.length)m=Math.min(m,a.c[0].t);return fin(m)?m:null;};

  // S3 Papan Event: event tunggu (tanpa skor) + event yang selesai dalam BOARD_LOOKBACK candle terakhir.
  function board(analyses,history,T){
    const recBy=new Map(history.map(r=>[r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc,r]));
    const cols={waiting:[],confirmed:[],conflict:[],ended:[],research:[]};
    for(const p of P.pending(analyses))cols.waiting.push(Object.assign({},p,{family:p.signal_family}));
    const since=T-BOARD_LOOKBACK*H4;
    for(const [s,a] of analyses)for(const ev of a.events){
      if(ev.endIdx===null||ev.endIdx===undefined)continue;
      const endMs=a.c[ev.endIdx].t+H4;if(endMs<=since||endMs>T)continue;
      const card={symbol:s,side:ev.side,signal_family:ev.family,event_status:ev.status,level:ev.level,endMs,
        started_utc:iso(a.c[ev.t0??ev.createdIdx].t+H4)};
      if(ev.status==='CONFIRMED'){
        const rec=recBy.get(s+'|'+ev.side+'|'+ev.family+'|'+iso(endMs));card.record=rec||null;
        if(rec&&(rec.event_status==='CONFLICTING_DIRECTIONS'||rec.event_status==='MULTI_METHOD_COLLISION')){card.event_status=rec.event_status;cols.conflict.push(card);}
        else cols.confirmed.push(card);
      }else if(ENDED.includes(ev.status))cols.ended.push(card);
    }
    for(const k of ['confirmed','conflict','ended'])cols[k].sort((a,b)=>b.endMs-a.endMs||a.symbol.localeCompare(b.symbol));
    cols.waiting.sort((a,b)=>a.symbol.localeCompare(b.symbol)||a.side.localeCompare(b.side));
    return cols;
  }

  // S5 Konteks Pasar: M1 per pair pada candle terakhir, M3 + matriks korelasi (60 return berakhir t−1) dan J (180 return).
  function context(analyses,T,pairs){
    const rows=[];
    for(const s of pairs){
      const a=analyses.get(s);if(!a||!a.c.length){rows.push({symbol:s,m1:null,chart:null});continue;}
      const k=a.c.length-1,m1=a.m1At(k),from=Math.max(0,k-CHART_CANDLES+1);
      const piv=[...a.piv.highs,...a.piv.lows].filter(p=>p.confirm<=k&&p.i>=from).map(p=>({i:p.i-from,price:p.price,type:p.type}));
      const levels=a.events.filter(e=>WAITING.includes(e.status)).map(e=>({price:e.level,side:e.side,family:e.family,status:e.status}));
      rows.push({symbol:s,lastCloseMs:a.c[k].t+H4,close:a.c[k].close,m1,chart:{candles:a.c.slice(from),pivots:piv,levels}});
    }
    const tOpen=T-H4,closes=P.closesOf(analyses),m3=R.m3(closes,tOpen,pairs);
    let matrix=null;
    if(m3.status==='SCORED'){
      const ret={};for(const s of pairs){const m=closes.get(s),cl=[];for(let k=61;k>=1;k--)cl.push(m.get(tOpen-k*H4));ret[s]=cl.slice(1).map((v,i)=>Math.log(v/cl[i]));}
      matrix=pairs.map(x=>pairs.map(y=>x===y?1:C.pearson(ret[x],ret[y])));
    }
    return {rows,m3,matrix,pairs};
  }

  function health(analyses,pairs,T,fetchFailed,failed){
    return pairs.map(s=>{
      const a=analyses.get(s),n=a?a.c.length:0,flags=a?a.flags:[];
      const cnt=r=>flags.filter(f=>f.reason===r).length;
      const lastCloseMs=n?a.c[n-1].t+H4:null;
      return {symbol:s,candles:n,lastCloseMs,upToDate:lastCloseMs>=T,
        fetch:fetchFailed.includes(s)?'FETCH_FAILED':failed.includes(s)?'RETRYING_CACHED':'OK',
        gaps:cnt('CONFIRMED_GAP'),duplicates:cnt('DUPLICATE_OPEN_TIME'),invalid:cnt('DATA_INCOMPLETE'),
        recovery:{m3:Math.max(0,181-n),m1:Math.max(0,121-n),rvol:Math.max(0,21-n)}};
    });
  }
  function calibration(frozen,meta){
    const out={};for(const f of M2.FAMILIES){const x=frozen&&frozen[f];out[f]=x?{version:x.version,n:x.e4.length}:null;}
    return {policy:'FROZEN_COMPLETE_TRAIN_ECDF',families:out,files:meta||null};
  }
  // Log audit JSON lines: catatan cek konflik & ringkasan siklus dari engine, lalu record keputusan.
  function auditLines(state){
    const lines=state.log.map(x=>JSON.stringify(x));
    for(const r of state.history)lines.push(JSON.stringify(Object.assign({type:'DECISION_RECORD'},publicRecord(r))));
    return lines.join('\n')+'\n';
  }
  // Record kontrak §10 tanpa field internal (_features, _q).
  function publicRecord(r){const o={};for(const k of Object.keys(r))if(k[0]!=='_')o[k]=r[k];return o;}

  return {KLINE_LIMIT,BOARD_LOOKBACK,toCandle,lastClosedT,outcome,buildState,auditLines,publicRecord};
});
