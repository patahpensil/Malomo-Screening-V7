'use strict';
/* Uji dengan DATA BINANCE ASLI (bukan tiruan) memakai jalur kode aplikasi yang sama (app/transport.js, app/live.js,
   app/cycle.js, engine/). Mengecek: jam server, kline 4H 6 pair, validasi candle §1, siklus engine penuh + kontrak §9–§10,
   Open Interest, WebSocket ticker, aggTrade (CVD) dan depth20 (orderbook).
   Keluar 0 = lulus, 1 = gagal, 3 = Binance menolak lokasi server (HTTP 451/403 geo) sehingga uji tidak bisa dijalankan. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../engine/core'),M2=require('../engine/m2'),Cy=require('../app/cycle'),Tr=require('../app/transport'),Lv=require('../app/live');
const ROOT=path.resolve(__dirname,'..');
const FROZEN=M2.frozenFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_v2_normalizations.json'),'utf8')));
const gh=process.env.GITHUB_ACTIONS==='true';
const note=(kind,msg)=>{console.log((gh?`::${kind}::`:kind.toUpperCase()+': ')+msg);};
const summary=[];
let pass=0;const fails=[];
async function step(name,fn){try{const r=await fn();pass++;console.log('PASS '+name+(r?' — '+r:''));summary.push('| ✅ | '+name+' | '+(r||'')+' |');}
  catch(e){fails.push(name);console.log('FAIL '+name+' — '+e.message);summary.push('| ❌ | '+name+' | '+String(e.message).replace(/\|/g,'/')+' |');}}
const wait=(cond,ms,label)=>new Promise((res,rej)=>{const t0=Date.now();const iv=setInterval(()=>{if(cond()){clearInterval(iv);res();}else if(Date.now()-t0>ms){clearInterval(iv);rej(new Error('timeout '+ms+' ms: '+label));}},200);});

(async()=>{
  const tr=Tr.createTransport();
  // Deteksi blokir lokasi lebih dulu supaya hasilnya jelas.
  try{const r=await fetch(Tr.REST+'/fapi/v1/time');if(r.status===451||r.status===403){const b=await r.text();note('warning','Binance menolak lokasi server uji (HTTP '+r.status+'): '+b.slice(0,160));process.exit(3);}}
  catch(e){note('warning','Binance tidak terjangkau dari server uji: '+e.message);process.exit(3);}
  let raw={},rows={},state=null;
  await step('REST /fapi/v1/time: sinkron jam server',async()=>{const off=await tr.syncClock();assert(Math.abs(off)<120000,'selisih jam '+off);return 'offset '+Math.round(off)+' ms';});
  await step('REST /fapi/v1/klines 4H × 6 pair (limit 1500): lengkap, valid §1, ada candle berjalan',async()=>{
    const out=[];
    for(const s of C.PAIRS){
      const k=await tr.klines(s,Cy.KLINE_LIMIT);assert(Array.isArray(k)&&k.length>=1000,s+' baris '+k.length);
      rows[s]=k;raw[s]=k.map(Cy.toCandle);
      const now=tr.serverNow(),p=C.prepare(raw[s],now);
      const bad=p.flags.filter(f=>f.reason==='DATA_INCOMPLETE');assert.equal(bad.length,0,s+' candle tidak valid: '+bad.length);
      const gaps=p.flags.filter(f=>f.reason==='CONFIRMED_GAP').length;
      const forming=raw[s].find(x=>x.t<=now&&x.t+C.H4>now);assert(forming,s+' tanpa candle berjalan');
      assert.equal(p.candles[p.candles.length-1].t+C.H4,Cy.lastClosedT(now),s+' candle close terakhir tidak sesuai jam server');
      out.push(s+' '+p.candles.length+' close'+(gaps?' · '+gaps+' gap':''));
    }
    return out.join(', ');
  });
  await step('Siklus engine penuh atas data asli + kontrak §9–§10',async()=>{
    const t0=Date.now();state=Cy.buildState({rawBySymbol:raw,now:tr.serverNow(),frozen:FROZEN});const ms=Date.now()-t0;
    const EV=['CONFIRMED','CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION'],ST=['CLOSE_CANDIDATE','ENTRY_CONSIDER','NO_ENTRY','REJECTED_DIRECTION','REJECTED_INTEGRITY','REJECTED_RISK','CONFLICTING_DIRECTIONS','MULTI_METHOD_COLLISION'];
    for(const r of state.history){
      assert(EV.includes(r.event_status));assert(ST.includes(r.status));
      if(['CLOSE_CANDIDATE','ENTRY_CONSIDER'].includes(r.status))assert.equal(r.reasons.length,0);else assert(r.reasons.length>0);
      if(r.status==='ENTRY_CONSIDER'){const s=r.scores;assert(Math.abs(s.m6_confluense_500-(s.m1_100+s.m2_100+s.m3_100+s.m4_100+s.m5_100))<1e-9);assert(r.qty>0&&r.stop_price>0);}
      else assert.equal(r.scores.m6_confluense_500,null);
    }
    const act=state.book.active;
    assert(act.length<=3&&state.book.openRiskPct<=3+1e-9&&state.book.grossPct<=100+1e-9&&new Set(act.map(p=>p.symbol)).size===act.length);
    const c={};for(const r of state.history)c[r.status]=(c[r.status]||0)+1;
    const cy=state.cycle.summary;
    note('notice',`Siklus asli close ${cy.decision_available_utc}: M3 ${cy.m3===null?'null':cy.m3.toFixed(2)} · kandidat close ini ${state.cycle.records.length} · posisi aktif ${act.length} · riwayat ${JSON.stringify(c)}`);
    return `${state.history.length} record, ${ms} ms, M3 ${cy.m3_status}`;
  });
  await step('REST /fapi/v1/openInterest × 6 pair',async()=>{const o=[];for(const s of C.PAIRS){const v=await tr.openInterest(s);assert(v>0,s+' OI '+v);o.push(s+' '+v);}return o.join(', ');});
  await step('WebSocket ticker 6 pair (/market/stream …@ticker): harga live konsisten dengan kline',async()=>{
    assert(typeof WebSocket==='function','Node tanpa WebSocket global');
    const tk=Tr.createTicker({symbols:C.PAIRS,onTick:()=>{}});
    try{
      await wait(()=>C.PAIRS.every(s=>tk.prices[s]),25000,'ticker 6 pair');
      for(const s of C.PAIRS){const last=raw[s][raw[s].length-1].close,px=tk.prices[s].price;assert(Math.abs(px/last-1)<0.05,s+' ticker '+px+' vs kline '+last);}
      assert(tk.isLive());
      return C.PAIRS.map(s=>s+' '+tk.prices[s].price).join(', ');
    }finally{tk.stop();}
  });
  await step('WebSocket posisi: aggTrade (/market → CVD) dan depth20 (/public → orderbook)',async()=>{
    const lv=Lv.createLive({openInterest:s=>tr.openInterest(s)});
    try{
      lv.sync(['BTCUSDT','ETHUSDT']);
      await wait(()=>lv.data('BTCUSDT').wsOn&&(lv.data('BTCUSDT').cvdWin||[]).length>0,25000,'aggTrade BTCUSDT');
      await wait(()=>lv.data('BTCUSDT').imb!==undefined&&lv.data('ETHUSDT').imb!==undefined,25000,'depth20');
      await lv.pollOI();assert(lv.data('BTCUSDT').oi>0);
      const d=lv.data('BTCUSDT');return `CVD ${d.cvd.toFixed(0)} USD (${d.cvdWin.length} trade) · bid ${(50+50*d.imb).toFixed(0)}% · OI ${d.oi}`;
    }finally{lv.stop();}
  });
  console.log(`\n${pass} PASS, ${fails.length} FAIL`);
  if(gh&&process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### Uji data Binance asli\n\n| | Uji | Hasil |\n|---|---|---|\n'+summary.join('\n')+'\n\n');
  for(const f of fails)note('error','Uji Binance asli gagal: '+f);
  process.exit(fails.length?1:0);
})();
