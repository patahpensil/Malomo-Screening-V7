/* Malomo V7 — Ledger Decision terkunci + Jurnal Sinyal (PRD v1.0.13 R35; v1.0.14 R36). Fungsi murni, tanpa DOM/jaringan.
   - HANYA sinyal yang benar-benar masuk Decision dicatat (R36): record ENTRY_CONSIDER pada close yang sedang berjalan saat
     aplikasi menghitungnya. Sinyal masa lalu dari replay TIDAK dicatat (jurnal bukan backtest).
   - Entri dibekukan SEKALI: skor M1–M6, harga entry/SL/TP, waktu, peringkat volume, label rezim BTC. Refresh data,
     pergantian universe, atau replay ulang TIDAK pernah menimpanya.
   - Yang boleh berubah hanya hasil (outcome) selama masih berjalan: dihitung dari candle 4H yang sudah close dengan aturan
     PRD §6 (stop dievaluasi lebih dahulu, horizon 24 jam) memakai harga yang dibekukan.
   Hasil adalah hasil sinyal menurut candle Binance, bukan fill order akun pengguna. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else (root.Malomo=root.Malomo||{}).ledger=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const H4=4*3600*1000,HOLD=24*3600*1000,MAX_ENTRIES=5000,VERSION=1;
  const fin=x=>typeof x==='number'&&Number.isFinite(x);
  const keyOf=r=>r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc;
  const empty=()=>({version:VERSION,entries:{}});

  /* Bekukan record ENTRY_CONSIDER close yang sedang berjalan (T = currentT) yang belum ada. Record close lain diabaikan;
     entri yang sudah ada tidak disentuh sama sekali. */
  function freeze(ledger,records,{regimes={},ranks={},currentT,now}={}){
    const L=ledger&&ledger.entries?ledger:empty();const added=[];
    for(const r of records||[]){
      if(!r||r.status!=='ENTRY_CONSIDER')continue;
      const k=keyOf(r);if(L.entries[k])continue;
      const s=r.scores||{},T=Date.parse(r.decision_available_utc),entryMs=Date.parse(r.entry_reference_time_utc);
      if(![T,entryMs,r.entry_reference_open,r.stop_price,r.target_price].every(fin))continue;
      if(!fin(currentT)||T!==currentT)continue;   // R36: hanya Decision pada close berjalan
      const e={key:k,symbol:r.symbol,side:r.side,family:r.signal_family,source:'live',
        decisionMs:T,entryMs,frozenAtMs:fin(now)?now:null,
        entry:r.entry_reference_open,stop:r.stop_price,target:r.target_price,rr:r.rr_target,atrEntry:r.atr_entry,
        target2:fin(r.target2_price)?r.target2_price:null,rr2:fin(r.rr_target2)?r.rr_target2:null,tp1Frac:fin(r.target2_price)&&fin(r.tp1_fraction)?r.tp1_fraction:1,mandate:r.risk_mandate_version||null,
        invalidation:r.invalidation||null,structure:r.market_structure_direction||null,rank:fin(ranks[r.symbol])?ranks[r.symbol]:null,
        regime:regimes[k]||null,
        scores:{m1:s.m1_100,m2q:s.m2_signal_quality_80,m2:s.m2_100,m3:s.m3_100,m4:s.m4_100,m5:s.m5_100,m6:s.m6_confluense_500,m1m2q:s.m1_plus_m2q_0_180_display_only},
        versions:{score:r.score_version,normalization:r.normalization_version,risk:r.risk_mandate_version},
        outcome:{code:'OPEN',atMs:null,exit:null,r:null}};
      L.entries[k]=Object.freeze?deepFreezeCopy(e):e;added.push(k);
    }
    prune(L);return {ledger:L,added};
  }
  // Salinan biasa (objek di localStorage tetap JSON); "beku" dijaga oleh aturan tulis di modul ini.
  function deepFreezeCopy(e){return JSON.parse(JSON.stringify(e));}

  /* Hasil per entri dari candle 4H yang sudah close: [entryMs, entryMs+24 jam), stop lebih dahulu, lalu target, lalu horizon.
     Hanya entri OPEN yang diperbarui; hasil final tidak pernah berubah lagi. Aturan identik dengan cycle.outcome (dites).
     R37: entri dengan target2 → TP1 (tutup tp1Frac) lalu TP2 (sisa); SL tetap di tempat setelah TP1.
     Entri lama tanpa target2 tetap memakai aturan TP tunggal (tidak dihitung ulang). */
  function outcomeOf(e,candles,now){
    const s=e.side==='LONG'?1:-1,dist=Math.abs(e.entry-e.stop),end=e.entryMs+HOLD;
    const win=(candles||[]).filter(x=>x.t>=e.entryMs&&x.t<end&&x.t+H4<=now).sort((a,b)=>a.t-b.t);
    const rOf=px=>dist>0?s*(px-e.entry)/dist:null;
    const two=fin(e.target2),f=two?(fin(e.tp1Frac)?e.tp1Frac:0.5):1;
    let tp1At=null;
    for(const x of win){
      const stopHit=s===1?x.low<=e.stop:x.high>=e.stop,hit=px=>s===1?x.high>=px:x.low<=px;
      if(tp1At===null){
        if(stopHit)return {code:'STOP_HIT',atMs:x.t+H4,exit:e.stop,r:-1,tp1AtMs:null};
        if(hit(e.target)){
          if(!two)return {code:'TARGET_HIT',atMs:x.t+H4,exit:e.target,r:dist>0?Math.abs(e.target-e.entry)/dist:null,tp1AtMs:null};
          tp1At=x.t+H4;
          if(hit(e.target2))return {code:'TARGET_HIT',atMs:x.t+H4,exit:e.target2,r:f*rOf(e.target)+(1-f)*rOf(e.target2),tp1AtMs:tp1At};
        }
      }else{
        if(stopHit)return {code:'TP1_STOP',atMs:x.t+H4,exit:e.stop,r:f*rOf(e.target)+(1-f)*rOf(e.stop),tp1AtMs:tp1At};
        if(hit(e.target2))return {code:'TARGET_HIT',atMs:x.t+H4,exit:e.target2,r:f*rOf(e.target)+(1-f)*rOf(e.target2),tp1AtMs:tp1At};
      }
    }
    const need=HOLD/H4;
    if(win.length>=need){const last=win[need-1];
      if(tp1At!==null)return {code:'TP1_HORIZON',atMs:last.t+H4,exit:last.close,r:f*rOf(e.target)+(1-f)*rOf(last.close),tp1AtMs:tp1At};
      return {code:'HORIZON_EXIT',atMs:last.t+H4,exit:last.close,r:rOf(last.close),tp1AtMs:null};}
    return {code:'OPEN',atMs:null,exit:null,r:null,candlesSeen:win.length,of:need,tp1AtMs:tp1At};
  }
  /* Perbarui hasil entri OPEN. NO_DATA hanya bila hasil memang tidak dapat ditentukan (bukan tebakan):
     - ada candle, jendela 24 jam sudah lewat, tetapi candle di jendela itu hilang padahal data sudah melewati jendela
       (atau riwayat dimulai setelah entry) → NO_DATA;
     - tidak ada candle sama sekali dan entry lebih tua dari jangkauan unduhan (≈240 hari) → NO_DATA.
     Data yang sekadar belum terunduh (pair keluar 100 besar, aplikasi lama tidak dibuka, gagal ambil) → tetap OPEN
     sampai candle-nya diunduh (R37 perbaikan: sebelumnya menjadi NO_DATA setelah 48 jam). */
  const REACH=240*24*3600*1000;
  function resolve(ledger,candlesBySymbol,now){
    const changed=[];
    for(const e of Object.values(ledger.entries)){
      if(e.outcome&&e.outcome.code!=='OPEN')continue;
      const c=candlesBySymbol&&candlesBySymbol[e.symbol];
      if(c&&c.length){const o=outcomeOf(e,c,now);
        if(o.code!=='OPEN'){e.outcome={code:o.code,atMs:o.atMs,exit:o.exit,r:o.r,tp1AtMs:o.tp1AtMs??null};changed.push(e.key);continue;}
        if(o.tp1AtMs&&!e.outcome.tp1AtMs){e.outcome=Object.assign({},e.outcome,{tp1AtMs:o.tp1AtMs});changed.push(e.key);}   // TP1 sudah kena, sisa masih berjalan
        const end=e.entryMs+HOLD,first=c.reduce((m,x)=>Math.min(m,x.t),Infinity),last=c.reduce((m,x)=>Math.max(m,x.t),-Infinity);
        if(now>=end&&(last>=end||first>e.entryMs)){e.outcome={code:'NO_DATA',atMs:null,exit:null,r:null,tp1AtMs:null};changed.push(e.key);}
      }
      else if(now>e.entryMs+REACH){e.outcome={code:'NO_DATA',atMs:null,exit:null,r:null,tp1AtMs:null};changed.push(e.key);}
    }
    return changed;
  }
  const active=(ledger,now)=>Object.values(ledger.entries).filter(e=>now<e.entryMs+HOLD)
    .sort((a,b)=>b.decisionMs-a.decisionMs||(b.scores.m6??-1)-(a.scores.m6??-1)||(a.symbol<b.symbol?-1:1));
  // Entri yang hasilnya belum final dan masih bisa ditentukan (dalam jangkauan unduhan) — candle pair-nya harus tetap diunduh.
  const unresolved=(ledger,now)=>Object.values(ledger.entries).filter(e=>(!e.outcome||e.outcome.code==='OPEN')&&now<=e.entryMs+REACH);
  const finished=ledger=>Object.values(ledger.entries).filter(e=>e.outcome&&e.outcome.code!=='OPEN')
    .sort((a,b)=>b.decisionMs-a.decisionMs||(a.symbol<b.symbol?-1:1));
  function summary(rows){
    const s={n:rows.length,TARGET_HIT:0,STOP_HIT:0,HORIZON_EXIT:0,TP1_STOP:0,TP1_HORIZON:0,NO_DATA:0,sumR:0,nR:0};
    for(const e of rows){s[e.outcome.code]=(s[e.outcome.code]||0)+1;if(fin(e.outcome.r)){s.sumR+=e.outcome.r;s.nR++;}}
    s.avgR=s.nR?s.sumR/s.nR:null;return s;
  }
  function filter(rows,f={}){
    return rows.filter(e=>(!f.pair||e.symbol===f.pair)&&(!f.side||e.side===f.side)&&(!f.family||e.family===f.family)
      &&(!f.outcome||e.outcome.code===f.outcome)&&(!fin(f.m6min)||(fin(e.scores.m6)&&e.scores.m6>=f.m6min))&&(!fin(f.m6max)||(fin(e.scores.m6)&&e.scores.m6<=f.m6max)));
  }
  function prune(L){
    const ks=Object.keys(L.entries);if(ks.length<=MAX_ENTRIES)return;
    ks.sort((a,b)=>L.entries[a].decisionMs-L.entries[b].decisionMs);
    for(const k of ks.slice(0,ks.length-MAX_ENTRIES))delete L.entries[k];
  }
  /* Muat dari penyimpanan: hanya entri sah yang benar-benar masuk Decision (source live) diterima; entri replay dari versi
     1.0.13 dan data rusak dibuang, tidak diperbaiki. */
  function load(obj){
    const L=empty();if(!obj||obj.version!==VERSION||typeof obj.entries!=='object')return L;
    for(const [k,e] of Object.entries(obj.entries)){
      if(e&&e.key===k&&e.source==='live'&&typeof e.symbol==='string'&&['LONG','SHORT'].includes(e.side)&&[e.decisionMs,e.entryMs,e.entry,e.stop,e.target].every(fin)&&e.scores&&e.outcome)L.entries[k]=e;
    }
    return L;
  }

  // ---------- CSV (UTF-8 + BOM agar Excel membaca karakter dengan benar) ----------
  const WITA=8*3600*1000;
  const isoUtc=ms=>fin(ms)?new Date(ms).toISOString().replace('.000Z','Z'):'';
  const wita=ms=>fin(ms)?new Date(ms+WITA).toISOString().slice(0,16).replace('T',' '):'';
  const OUT={OPEN:'berjalan',TARGET_HIT:'kena TP',TARGET_HIT_2:'kena TP1 + TP2',STOP_HIT:'kena SL',HORIZON_EXIT:'keluar 24 jam',TP1_STOP:'TP1 lalu SL',TP1_HORIZON:'TP1 lalu keluar 24 jam',NO_DATA:'data tidak ada'};
  const outcomeText=e=>{const c=e&&e.outcome?e.outcome.code:'OPEN';return c==='TARGET_HIT'&&fin(e.target2)?OUT.TARGET_HIT_2:OUT[c]||c;};
  const num=(v,d)=>fin(v)?(d===undefined?String(v):v.toFixed(d)):'';
  const cell=v=>{const s=String(v??'');return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const COLS=[['waktu_keputusan_utc',e=>isoUtc(e.decisionMs)],['waktu_keputusan_wita',e=>wita(e.decisionMs)],['pair',e=>e.symbol],['arah',e=>e.side],
    ['keluarga',e=>e.family],['peringkat_volume',e=>e.rank??''],['rezim_btc',e=>e.regime?e.regime.code:''],['struktur_m1',e=>e.structure||''],
    ['m1',e=>num(e.scores.m1,4)],['m2_kualitas',e=>num(e.scores.m2q,4)],['m1_plus_m2q',e=>num(e.scores.m1m2q,4)],['m2',e=>num(e.scores.m2,4)],['m3',e=>num(e.scores.m3,4)],
    ['m4',e=>num(e.scores.m4,4)],['m5',e=>num(e.scores.m5,4)],['m6',e=>num(e.scores.m6,4)],
    ['entry',e=>num(e.entry)],['sl',e=>num(e.stop)],['tp1',e=>num(e.target)],['tp2',e=>num(e.target2)],['bagian_tp1',e=>num(e.tp1Frac)],['rr_tp1',e=>num(e.rr)],['rr_tp2',e=>num(e.rr2)],
    ['waktu_tp1_utc',e=>isoUtc(e.outcome.tp1AtMs)],
    ['hasil',e=>outcomeText(e)],['waktu_keluar_utc',e=>isoUtc(e.outcome.atMs)],['harga_keluar',e=>num(e.outcome.exit)],['r',e=>num(e.outcome.r,4)],
    ['durasi_jam',e=>fin(e.outcome.atMs)?((e.outcome.atMs-e.entryMs)/3600000).toFixed(0):''],['invalidasi',e=>e.invalidation?e.invalidation.rule+' '+num(e.invalidation.price):''],['mandat_risiko',e=>e.mandate||'']];
  function csv(rows){return '﻿'+[COLS.map(c=>c[0]).join(','),...rows.map(e=>COLS.map(c=>cell(c[1](e))).join(','))].join('\r\n')+'\r\n';}

  return {VERSION,MAX_ENTRIES,HOLD,keyOf,empty,freeze,outcomeOf,resolve,active,unresolved,outcomeText,finished,summary,filter,load,csv,COLS:COLS.map(c=>c[0]),OUTCOME_TEXT:OUT};
});
