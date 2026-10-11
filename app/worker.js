/* Malomo V7 — Web Worker siklus (PRD v1.0.12 R34). Menjalankan engine PRD yang SAMA (engine/*.js + cycle.js) di luar
   thread tampilan supaya 100 pair tidak membekukan layar. Tidak ada jaringan di sini; candle dikirim dari main.js.
   Keluaran = cycle.toView(state): angka identik dengan buildState, tanpa peta analisis (fungsi tidak bisa dikirim). */
/* global importScripts */
importScripts('engine/core.js','engine/m1.js','engine/generators.js','engine/m2.js','engine/m3m4.js','engine/pipeline.js','cycle.js');
let frozen=null;
self.onmessage=e=>{
  const m=e.data||{};
  try{
    if(m.type==='init'){frozen=self.Malomo.m2.frozenFrom(m.cdf,m.v2);self.postMessage({type:'ready'});return;}
    if(m.type==='build'){
      if(!frozen)throw new Error('Kalibrasi beku belum dimuat di worker');
      const a=m.args,gate=a.gate?{fromMs:a.gate.fromMs,allowed:new Set(a.gate.allowed)}:null;
      const st=self.Malomo.cycle.buildState({rawBySymbol:a.rawBySymbol,now:a.now,frozen,failed:a.failed,symbols:a.symbols,gate,frozenMeta:a.frozenMeta});
      self.postMessage({type:'state',id:m.id,state:self.Malomo.cycle.toView(st)});
    }
  }catch(err){self.postMessage({type:'error',id:m.id,message:String(err&&err.message||err)});}
};
