/* Malomo V7 — Ledger Decision terkunci + Jurnal Sinyal (PRD v1.0.13 R35). Fungsi murni, tanpa DOM/jaringan.
   - Setiap record ENTRY_CONSIDER dibekukan SEKALI saat pertama terlihat: skor M1–M6, harga entry/SL/TP, waktu, peringkat
     volume, label rezim BTC. Refresh data, pergantian universe, atau replay ulang TIDAK pernah menimpanya.
   - Yang boleh berubah hanya hasil (outcome) selama masih berjalan: dihitung dari candle 4H yang sudah close dengan aturan
     PRD §6 (stop dievaluasi lebih dahulu, horizon 24 jam) memakai harga yang dibekukan.
   - sumber 'live' = dibekukan pada siklus close-nya; 'replay' = sinyal masa lalu yang pertama kali terlihat lewat replay.
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

  /* Bekukan record ENTRY_CONSIDER yang belum ada. Entri yang sudah ada tidak disentuh sama sekali. */
  function freeze(ledger,records,{regimes={},ranks={},currentT,now}={}){
    const L=ledger&&ledger.entries?ledger:empty();const added=[];
    for(const r of records||[]){
      if(!r||r.status!=='ENTRY_CONSIDER')continue;
      const k=keyOf(r);if(L.entries[k])continue;
      const s=r.scores||{},T=Date.parse(r.decision_available_utc),entryMs=Date.parse(r.entry_reference_time_utc);
      if(![T,entryMs,r.entry_reference_open,r.stop_price,r.target_price].every(fin))continue;
      const e={key:k,symbol:r.symbol,side:r.side,family:r.signal_family,source:fin(currentT)&&T>=currentT?'live':'replay',
        decisionMs:T,entryMs,frozenAtMs:fin(now)?now:null,
        entry:r.entry_reference_open,stop:r.stop_price,target:r.target_price,rr:r.rr_target,atrEntry:r.atr_entry,
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
     Hanya entri OPEN yang diperbarui; hasil final tidak pernah berubah lagi. */
  function outcomeOf(e,candles,now){
    const s=e.side==='LONG'?1:-1,dist=Math.abs(e.entry-e.stop),end=e.entryMs+HOLD;
    const win=(candles||[]).filter(x=>x.t>=e.entryMs&&x.t<end&&x.t+H4<=now).sort((a,b)=>a.t-b.t);
    for(const x of win){
      if(s===1?x.low<=e.stop:x.high>=e.stop)return {code:'STOP_HIT',atMs:x.t+H4,exit:e.stop,r:-1};
      if(s===1?x.high>=e.target:x.low<=e.target)return {code:'TARGET_HIT',atMs:x.t+H4,exit:e.target,r:dist>0?Math.abs(e.target-e.entry)/dist:null};
    }
    const need=HOLD/H4;
    if(win.length>=need){const last=win[need-1];return {code:'HORIZON_EXIT',atMs:last.t+H4,exit:last.close,r:dist>0?s*(last.close-e.entry)/dist:null};}
    return {code:'OPEN',atMs:null,exit:null,r:null,candlesSeen:win.length,of:need};
  }
  function resolve(ledger,candlesBySymbol,now){
    const changed=[];
    for(const e of Object.values(ledger.entries)){
      if(e.outcome&&e.outcome.code!=='OPEN')continue;
      const c=candlesBySymbol&&candlesBySymbol[e.symbol];
      if(c&&c.length){const o=outcomeOf(e,c,now);
        if(o.code!=='OPEN'){e.outcome={code:o.code,atMs:o.atMs,exit:o.exit,r:o.r};changed.push(e.key);}
        else if(now>e.entryMs+2*HOLD){e.outcome={code:'NO_DATA',atMs:null,exit:null,r:null};changed.push(e.key);}}   // candle tidak lagi diperbarui
      // Pair tidak lagi diunduh dan slot sudah lama lewat → hasil tidak dapat ditentukan (bukan ditebak).
      else if(now>e.entryMs+2*HOLD){e.outcome={code:'NO_DATA',atMs:null,exit:null,r:null};changed.push(e.key);}
    }
    return changed;
  }
  const active=(ledger,now)=>Object.values(ledger.entries).filter(e=>now<e.entryMs+HOLD)
    .sort((a,b)=>b.decisionMs-a.decisionMs||(b.scores.m6??-1)-(a.scores.m6??-1)||(a.symbol<b.symbol?-1:1));
  const finished=ledger=>Object.values(ledger.entries).filter(e=>e.outcome&&e.outcome.code!=='OPEN')
    .sort((a,b)=>b.decisionMs-a.decisionMs||(a.symbol<b.symbol?-1:1));
  function summary(rows){
    const s={n:rows.length,TARGET_HIT:0,STOP_HIT:0,HORIZON_EXIT:0,NO_DATA:0,sumR:0,nR:0};
    for(const e of rows){s[e.outcome.code]=(s[e.outcome.code]||0)+1;if(fin(e.outcome.r)){s.sumR+=e.outcome.r;s.nR++;}}
    s.avgR=s.nR?s.sumR/s.nR:null;return s;
  }
  function filter(rows,f={}){
    return rows.filter(e=>(!f.pair||e.symbol===f.pair)&&(!f.side||e.side===f.side)&&(!f.family||e.family===f.family)&&(!f.source||e.source===f.source)
      &&(!f.outcome||e.outcome.code===f.outcome)&&(!fin(f.m6min)||(fin(e.scores.m6)&&e.scores.m6>=f.m6min))&&(!fin(f.m6max)||(fin(e.scores.m6)&&e.scores.m6<=f.m6max)));
  }
  function prune(L){
    const ks=Object.keys(L.entries);if(ks.length<=MAX_ENTRIES)return;
    ks.sort((a,b)=>L.entries[a].decisionMs-L.entries[b].decisionMs);
    for(const k of ks.slice(0,ks.length-MAX_ENTRIES))delete L.entries[k];
  }
  /* Muat dari penyimpanan: hanya entri dengan bentuk sah yang diterima (data rusak dibuang, tidak diperbaiki). */
  function load(obj){
    const L=empty();if(!obj||obj.version!==VERSION||typeof obj.entries!=='object')return L;
    for(const [k,e] of Object.entries(obj.entries)){
      if(e&&e.key===k&&typeof e.symbol==='string'&&['LONG','SHORT'].includes(e.side)&&[e.decisionMs,e.entryMs,e.entry,e.stop,e.target].every(fin)&&e.scores&&e.outcome)L.entries[k]=e;
    }
    return L;
  }

  // ---------- CSV (UTF-8 + BOM agar Excel membaca karakter dengan benar) ----------
  const WITA=8*3600*1000;
  const isoUtc=ms=>fin(ms)?new Date(ms).toISOString().replace('.000Z','Z'):'';
  const wita=ms=>fin(ms)?new Date(ms+WITA).toISOString().slice(0,16).replace('T',' '):'';
  const OUT={OPEN:'berjalan',TARGET_HIT:'kena TP',STOP_HIT:'kena SL',HORIZON_EXIT:'keluar 24 jam',NO_DATA:'data tidak ada'};
  const num=(v,d)=>fin(v)?(d===undefined?String(v):v.toFixed(d)):'';
  const cell=v=>{const s=String(v??'');return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const COLS=[['waktu_keputusan_utc',e=>isoUtc(e.decisionMs)],['waktu_keputusan_wita',e=>wita(e.decisionMs)],['pair',e=>e.symbol],['arah',e=>e.side],
    ['keluarga',e=>e.family],['sumber',e=>e.source],['peringkat_volume',e=>e.rank??''],['rezim_btc',e=>e.regime?e.regime.code:''],['struktur_m1',e=>e.structure||''],
    ['m1',e=>num(e.scores.m1,4)],['m2_kualitas',e=>num(e.scores.m2q,4)],['m1_plus_m2q',e=>num(e.scores.m1m2q,4)],['m2',e=>num(e.scores.m2,4)],['m3',e=>num(e.scores.m3,4)],
    ['m4',e=>num(e.scores.m4,4)],['m5',e=>num(e.scores.m5,4)],['m6',e=>num(e.scores.m6,4)],
    ['entry',e=>num(e.entry)],['sl',e=>num(e.stop)],['tp',e=>num(e.target)],['rr_target',e=>num(e.rr)],
    ['hasil',e=>OUT[e.outcome.code]||e.outcome.code],['waktu_keluar_utc',e=>isoUtc(e.outcome.atMs)],['harga_keluar',e=>num(e.outcome.exit)],['r',e=>num(e.outcome.r,4)],
    ['durasi_jam',e=>fin(e.outcome.atMs)?((e.outcome.atMs-e.entryMs)/3600000).toFixed(0):''],['invalidasi',e=>e.invalidation?e.invalidation.rule+' '+num(e.invalidation.price):'']];
  function csv(rows){return '﻿'+[COLS.map(c=>c[0]).join(','),...rows.map(e=>COLS.map(c=>cell(c[1](e))).join(','))].join('\r\n')+'\r\n';}

  return {VERSION,MAX_ENTRIES,HOLD,keyOf,empty,freeze,outcomeOf,resolve,active,finished,summary,filter,load,csv,COLS:COLS.map(c=>c[0]),OUTCOME_TEXT:OUT};
});
