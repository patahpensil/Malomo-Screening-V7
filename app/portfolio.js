/* Malomo V7 — Posisi nyata pengguna (PRD v1.0.16 R38). Fungsi murni, tanpa DOM/jaringan, tanpa order, tanpa API key.
   - "Saya ambil": catatan pengguna pada entri jurnal Decision (harga entry & qty yang benar-benar terisi). Hanya menambah
     field `taken` — skor, harga sinyal, dan hasil sinyal tidak pernah diubah.
   - Posisi manual: posisi di luar sinyal Malomo, dicatat pengguna. Tanpa skor M1–M6. Hasil otomatis dari candle 4H yang
     sudah close (SL dulu, lalu TP1/TP2; SL tetap setelah TP1; tanpa horizon) atau ditutup sendiri dengan harga keluar.
   - Panel risiko memakai posisi nyata (diambil + manual). Semua angka adalah catatan pengguna, bukan saldo akun Binance. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else (root.Malomo=root.Malomo||{}).portfolio=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const H4=4*3600*1000,HOLD=24*3600*1000,VERSION=1,MAX_MANUAL=2000;
  const fin=x=>typeof x==='number'&&Number.isFinite(x);
  const num=v=>{if(typeof v==='number')return v;if(typeof v!=='string')return NaN;const s=v.trim().replace(',','.');return s===''?NaN:Number(s);};
  const LIMIT=Object.freeze({maxPositions:10,openRiskPct:10,ddEvalPct:20,ddMaxPct:50});

  // ---------- "Saya ambil" ----------
  /* Tandai entri jurnal sebagai diambil. entry & qty wajib > 0. Entri yang sinyalnya sudah selesai tetap boleh ditandai
     (pengguna mungkin mencatat terlambat). Mengembalikan {ok, errors}. */
  function take(ledger,key,{entry,qty,now}={}){
    const e=ledger&&ledger.entries&&ledger.entries[key],errors={};
    if(!e)return {ok:false,errors:{key:'NOT_FOUND'}};
    const en=num(entry),q=num(qty);
    if(!(fin(en)&&en>0))errors.entry='INVALID';
    if(!(fin(q)&&q>0))errors.qty='INVALID';
    if(fin(en)&&en>0&&(e.side==='LONG'?!(e.stop<en):!(e.stop>en)))errors.entry='BEYOND_STOP';   // entry di luar SL → posisi tidak sah
    if(Object.keys(errors).length)return {ok:false,errors};
    e.taken={atMs:fin(now)?now:null,entry:en,qty:q};
    return {ok:true,errors:{}};
  }
  function untake(ledger,key){const e=ledger&&ledger.entries&&ledger.entries[key];if(!e||!e.taken)return false;delete e.taken;return true;}
  const validTaken=t=>t&&fin(t.entry)&&t.entry>0&&fin(t.qty)&&t.qty>0;

  // ---------- posisi manual ----------
  const emptyManual=()=>({version:VERSION,positions:{}});
  /* Validasi & tambah posisi manual. TP opsional: tanpa TP → hanya SL; TP1 saja → seluruh qty di TP1; TP1+TP2 → tp1Frac/sisa.
     qty kosong → dihitung dari risiko% × modal ÷ jarak SL (bila modal ada). */
  function validateManual(raw,{capital=null}={}){
    const r=raw||{},errors={},side=r.side==='SHORT'?'SHORT':r.side==='LONG'?'LONG':null,s=side==='LONG'?1:-1;
    const symbol=String(r.symbol||'').trim().toUpperCase();
    const entry=num(r.entry),stop=num(r.stop),t1=num(r.target),t2=num(r.target2),qtyIn=num(r.qty),riskPct=num(r.riskPct);
    if(!/^[A-Z0-9]{2,30}USDT$/.test(symbol))errors.symbol='INVALID';
    if(!side)errors.side='INVALID';
    if(!(fin(entry)&&entry>0))errors.entry='INVALID';
    if(!(fin(stop)&&stop>0))errors.stop='INVALID';
    if(side&&fin(entry)&&fin(stop)&&!(s===1?stop<entry:stop>entry))errors.stop='WRONG_SIDE';
    const hasT1=String(r.target??'').trim()!=='',hasT2=String(r.target2??'').trim()!=='';
    if(hasT1&&!(fin(t1)&&t1>0&&side&&fin(entry)&&(s===1?t1>entry:t1<entry)))errors.target='WRONG_SIDE';
    if(hasT2&&!hasT1)errors.target2='NEED_TP1';
    else if(hasT2&&!(fin(t2)&&t2>0&&fin(t1)&&(s===1?t2>t1:t2<t1)))errors.target2='WRONG_SIDE';
    let qty=fin(qtyIn)&&qtyIn>0?qtyIn:null;
    if(String(r.qty??'').trim()!==''&&qty===null)errors.qty='INVALID';
    if(qty===null&&!errors.qty){
      if(!(fin(riskPct)&&riskPct>0&&riskPct<=100))errors.riskPct='INVALID';
      else if(!(fin(capital)&&capital>0))errors.qty='NEED_CAPITAL';
      else if(fin(entry)&&fin(stop)&&entry!==stop)qty=capital*riskPct/100/Math.abs(entry-stop);
    }
    const ok=!Object.keys(errors).length;
    return {ok,errors,value:ok?{symbol,side,entry,stop,target:hasT1?t1:null,target2:hasT2?t2:null,tp1Frac:hasT2?0.5:1,qty}:null};
  }
  function addManual(m,raw,{now,capital=null}={}){
    const v=validateManual(raw,{capital});if(!v.ok)return v;
    const id='M'+(fin(now)?now:Date.now()).toString(36)+Object.keys(m.positions).length.toString(36);
    m.positions[id]=Object.assign({id,openedMs:fin(now)?now:null,closed:null,tp1AtMs:null},v.value);
    pruneManual(m);return {ok:true,errors:{},id};
  }
  /* Tutup sendiri: sisa qty keluar di harga yang diisi. */
  function closeManual(m,id,{exit,now}={}){
    const p=m.positions[id],x=num(exit);if(!p||p.closed)return {ok:false,errors:{id:'NOT_OPEN'}};
    if(!(fin(x)&&x>0))return {ok:false,errors:{exit:'INVALID'}};
    p.closed={code:'USER_CLOSE',atMs:fin(now)?now:null,exit:x};return {ok:true,errors:{}};
  }
  function removeManual(m,id){if(!m.positions[id])return false;delete m.positions[id];return true;}
  /* Hasil otomatis dari candle 4H yang sudah close, mulai candle PERTAMA yang dibuka setelah posisi dicatat (candle tempat
     posisi dibuka diabaikan: high/low-nya bisa terjadi sebelum entry). Tanpa horizon. */
  function manualOutcome(p,candles,now){
    const s=p.side==='LONG'?1:-1,from=Math.ceil(p.openedMs/H4)*H4;
    const win=(candles||[]).filter(x=>x.t>=from&&x.t+H4<=now).sort((a,b)=>a.t-b.t);
    let tp1=p.tp1AtMs;
    for(const x of win){
      if(tp1&&x.t+H4<=tp1)continue;
      const stopHit=s===1?x.low<=p.stop:x.high>=p.stop,hit=px=>fin(px)&&(s===1?x.high>=px:x.low<=px);
      if(!tp1){
        if(stopHit)return {code:'STOP_HIT',atMs:x.t+H4,exit:p.stop,tp1AtMs:null};
        if(hit(p.target)){
          if(!fin(p.target2))return {code:'TARGET_HIT',atMs:x.t+H4,exit:p.target,tp1AtMs:null};
          tp1=x.t+H4;
          if(hit(p.target2))return {code:'TARGET_HIT',atMs:x.t+H4,exit:p.target2,tp1AtMs:tp1};
        }
      }else{
        if(stopHit)return {code:'TP1_STOP',atMs:x.t+H4,exit:p.stop,tp1AtMs:tp1};
        if(hit(p.target2))return {code:'TARGET_HIT',atMs:x.t+H4,exit:p.target2,tp1AtMs:tp1};
      }
    }
    return {code:'OPEN',tp1AtMs:tp1||null};
  }
  function resolveManual(m,candlesBySymbol,now){
    const changed=[];
    for(const p of Object.values(m.positions)){
      if(p.closed||!fin(p.openedMs))continue;
      const c=candlesBySymbol&&candlesBySymbol[p.symbol];if(!c||!c.length)continue;
      const o=manualOutcome(p,c,now);
      if(o.code!=='OPEN'){p.closed={code:o.code,atMs:o.atMs,exit:o.exit};p.tp1AtMs=o.tp1AtMs;changed.push(p.id);}
      else if(o.tp1AtMs&&!p.tp1AtMs){p.tp1AtMs=o.tp1AtMs;changed.push(p.id);}
    }
    return changed;
  }
  function pruneManual(m){
    const done=Object.values(m.positions).filter(p=>p.closed).sort((a,b)=>(a.closed.atMs||0)-(b.closed.atMs||0));
    const extra=Object.keys(m.positions).length-MAX_MANUAL;for(const p of done.slice(0,Math.max(0,extra)))delete m.positions[p.id];
  }
  function loadManual(obj){
    const m=emptyManual();if(!obj||obj.version!==VERSION||typeof obj.positions!=='object')return m;
    for(const [id,p] of Object.entries(obj.positions)){
      if(p&&p.id===id&&/USDT$/.test(String(p.symbol))&&['LONG','SHORT'].includes(p.side)&&[p.entry,p.stop,p.qty].every(v=>fin(v)&&v>0))m.positions[id]=p;
    }
    return m;
  }
  const openManual=m=>Object.values(m.positions).filter(p=>!p.closed).sort((a,b)=>(b.openedMs||0)-(a.openedMs||0));
  const closedManual=m=>Object.values(m.positions).filter(p=>p.closed).sort((a,b)=>(b.closed.atMs||0)-(a.closed.atMs||0));

  // ---------- untung/rugi posisi nyata ----------
  /* Posisi seragam: {side, entry, stop, target, target2, tp1Frac, qty, tp1AtMs, done:{code, exit}|null}.
     PnL USDT = Σ bagian qty × (harga keluar − entry) × arah − biaya round-trip (bps × notional entry, perkiraan). */
  function pnl(pos,costBps=0){
    if(!pos.done)return null;
    const s=pos.side==='LONG'?1:-1,two=fin(pos.target2),f=two?(fin(pos.tp1Frac)?pos.tp1Frac:0.5):1,c=pos.done.code,q=pos.qty;
    const leg=(frac,px)=>frac*q*s*(px-pos.entry);let g;
    if(c==='STOP_HIT')g=leg(1,pos.stop);
    else if(c==='TARGET_HIT')g=two?leg(f,pos.target)+leg(1-f,pos.target2):leg(1,pos.done.exit);
    else if(c==='TP1_STOP')g=leg(f,pos.target)+leg(1-f,pos.stop);
    else if(c==='TP1_HORIZON')g=leg(f,pos.target)+leg(1-f,pos.done.exit);
    else if(c==='HORIZON_EXIT')g=leg(1,pos.done.exit);
    else if(c==='USER_CLOSE')g=pos.tp1AtMs&&fin(pos.target)?leg(f,pos.target)+leg(1-f,pos.done.exit):leg(1,pos.done.exit);
    else return null;   // NO_DATA dll.: tidak ditebak
    return g-(fin(costBps)?costBps/1e4:0)*q*pos.entry;
  }
  // Entri jurnal yang diambil → posisi seragam (entry & qty dari catatan pengguna; SL/TP dari sinyal yang dibekukan).
  const fromTaken=e=>({kind:'taken',key:e.key,symbol:e.symbol,side:e.side,entry:e.taken.entry,qty:e.taken.qty,stop:e.stop,target:e.target,target2:e.target2??null,tp1Frac:e.tp1Frac??1,
    tp1AtMs:e.outcome&&e.outcome.tp1AtMs||null,openMs:e.entryMs,done:e.outcome&&e.outcome.code!=='OPEN'?{code:e.outcome.code,exit:e.outcome.exit,atMs:e.outcome.atMs}:null});
  const fromManual=p=>({kind:'manual',key:p.id,symbol:p.symbol,side:p.side,entry:p.entry,qty:p.qty,stop:p.stop,target:p.target,target2:p.target2,tp1Frac:p.tp1Frac,
    tp1AtMs:p.tp1AtMs||null,openMs:p.openedMs,done:p.closed?{code:p.closed.code,exit:p.closed.exit,atMs:p.closed.atMs}:null});
  // Risiko tersisa (USDT) bila SL kena: bagian qty yang masih terbuka × jarak entry–SL.
  const openRisk=pos=>{const rem=pos.tp1AtMs&&fin(pos.target2)?1-(fin(pos.tp1Frac)?pos.tp1Frac:0.5):1;return Math.max(0,rem*pos.qty*(pos.side==='LONG'?pos.entry-pos.stop:pos.stop-pos.entry));};

  /* Angka panel risiko dari posisi NYATA: entri jurnal yang diambil + posisi manual.
     capital null → persen tidak dihitung (tampil "—"), jumlah posisi tetap dihitung. */
  function real(ledger,manual,{now,capital=null,costBps=0}={}){
    const taken=Object.values(ledger&&ledger.entries||{}).filter(e=>validTaken(e.taken)).map(fromTaken);
    const all=[...taken,...Object.values(manual&&manual.positions||{}).map(fromManual)];
    const open=all.filter(p=>!p.done),done=all.filter(p=>p.done&&fin(p.done.atMs)).sort((a,b)=>a.done.atMs-b.done.atMs);
    const riskUsdt=open.reduce((s,p)=>s+openRisk(p),0);
    let cum=0,peak=0,n=0;for(const p of done){const v=pnl(p,costBps);if(!fin(v))continue;cum+=v;peak=Math.max(peak,cum);n++;}
    const pct=v=>fin(capital)&&capital>0?100*v/capital:null;
    const longs=open.filter(p=>p.side==='LONG').length;
    return {positions:open.length,longs,shorts:open.length-longs,taken:taken.filter(p=>!p.done).length,manual:open.length-taken.filter(p=>!p.done).length,
      riskUsdt,openRiskPct:pct(riskUsdt),cumUsdt:cum,cumPct:pct(cum),ddUsdt:peak-cum,ddPct:pct(peak-cum),closed:n,hasCapital:fin(capital)&&capital>0};
  }

  // CSV posisi manual (UTF-8 + BOM).
  const isoUtc=ms=>fin(ms)?new Date(ms).toISOString().replace('.000Z','Z'):'';
  const cell=v=>{const t=String(v??'');return /[",\n;]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
  const MCOLS=[['dibuka_utc',p=>isoUtc(p.openedMs)],['pair',p=>p.symbol],['arah',p=>p.side],['entry',p=>p.entry],['sl',p=>p.stop],['tp1',p=>p.target??''],['tp2',p=>p.target2??''],
    ['qty',p=>p.qty],['waktu_tp1_utc',p=>isoUtc(p.tp1AtMs)],['hasil',p=>p.closed?p.closed.code:'OPEN'],['ditutup_utc',p=>isoUtc(p.closed&&p.closed.atMs)],['harga_keluar',p=>p.closed?p.closed.exit:''],
    ['pnl_usdt_perkiraan',(p,o)=>{const v=pnl(fromManual(p),o.costBps);return fin(v)?v.toFixed(4):'';}]];
  function csvManual(rows,{costBps=0}={}){return '\ufeff'+[MCOLS.map(c=>c[0]).join(','),...rows.map(p=>MCOLS.map(c=>cell(c[1](p,{costBps}))).join(','))].join('\r\n')+'\r\n';}

  return {VERSION,LIMIT,HOLD,take,untake,validTaken,emptyManual,validateManual,addManual,closeManual,removeManual,manualOutcome,resolveManual,loadManual,
    openManual,closedManual,pnl,fromTaken,fromManual,openRisk,real,csvManual,MCOLS:MCOLS.map(c=>c[0])};
});
