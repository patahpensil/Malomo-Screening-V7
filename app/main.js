/* Malomo V7 — orkestrasi aplikasi: ambil data publik → engine PRD → tampilan.
   Siklus mengikuti close 4H (jam server Binance). Tanpa order, tanpa API key, tanpa penyimpanan keputusan di luar memori;
   localStorage hanya untuk kenyamanan tampilan (layar & filter terakhir) dan pengaturan rencana siap salin R32
   (modal, risiko, biaya) yang hanya hidup di browser ini. */
(function(root){
  'use strict';
  const M=root.Malomo,C=M.core,Cy=M.cycle,U=M.ui,L=M.labels,Tr=M.transport,X=M.exec,UV=M.universe;
  const $=id=>document.getElementById(id);
  const SCREENS=['siklus','event','portofolio','pasar','audit'];
  const app={state:null,loading:true,frozen:null,frozenJson:null,meta:{files:{},build:null},raw:{},failed:new Set(),cycleId:0,progress:null,
    universe:null,ei:null,
    view:{screen:'siklus',selected:null,tab:'skor',filters:{pair:'',side:'',family:'',status:'',btc:''}},timers:{},
    exec:{settings:{capital:'',riskPct:String(X.DEFAULTS.riskPct),costBps:String(X.DEFAULTS.costBps)},rules:{},rulesAt:null,rulesError:null,rulesErrorAt:null,rulesLoading:false}};
  const transport=Tr.createTransport();
  const live=M.live.createLive({openInterest:s=>transport.openInterest(s)});
  let ticker=null;

  function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem('malomo_v7_'+k));localStorage.setItem('malomo_v7_'+k,JSON.stringify(v));}catch{return null;}}

  async function sha256(text){
    try{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');}catch{return null;}
  }
  async function loadStatic(){
    const files=['frozen_cdf_normalization.json','frozen_v2_normalizations.json'];
    const texts=await Promise.all(files.map(f=>fetch('data/'+f,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(f+' HTTP '+r.status);return r.text();})));
    let manifest={};try{manifest=await fetch('data/MANIFEST_SHA256.json',{cache:'no-cache'}).then(r=>r.json());}catch{/* tanpa manifest: hash tetap ditampilkan */}
    for(let i=0;i<files.length;i++){const h=await sha256(texts[i]),want=manifest['evidence/'+files[i]];app.meta.files[files[i]]={sha256:h,match:want&&h?want===h:null};}
    app.frozenJson=[JSON.parse(texts[0]),JSON.parse(texts[1])];
    app.frozen=M.m2.frozenFrom(app.frozenJson[0],app.frozenJson[1]);
    try{app.meta.build=await fetch('build-info.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null);}catch{app.meta.build=null;}
  }

  // ---------- engine di Web Worker (R34), cadangan di thread utama ----------
  let worker=null,wid=0;const waiting=new Map();
  function initWorker(){
    try{
      worker=new Worker('worker.js');
      worker.onmessage=e=>{const m=e.data||{};const w=waiting.get(m.id);if(!w)return;waiting.delete(m.id);if(m.type==='state')w.resolve(m.state);else w.reject(new Error(m.message||'worker error'));};
      worker.onerror=e=>{console.error('worker',e.message||e);const ws=[...waiting.values()];waiting.clear();worker=null;for(const w of ws)w.reject(new Error('worker gagal'));};
      worker.postMessage({type:'init',cdf:app.frozenJson[0],v2:app.frozenJson[1]});
    }catch{worker=null;}
  }
  const gateOf=a=>a.gate?{fromMs:a.gate.fromMs,allowed:new Set(a.gate.allowed)}:null;
  function computeLocal(a){return Cy.toView(Cy.buildState({rawBySymbol:a.rawBySymbol,now:a.now,frozen:app.frozen,failed:a.failed,symbols:a.symbols,gate:gateOf(a),frozenMeta:a.frozenMeta}));}
  function compute(a){
    if(!worker)return Promise.resolve().then(()=>computeLocal(a));
    const id=++wid;return new Promise((resolve,reject)=>{waiting.set(id,{resolve,reject});worker.postMessage({type:'build',id,args:a});});
  }

  // ---------- universe 100 pair (R34): ranking pada close harian 00:00 UTC = 08:00 WITA ----------
  const universeSymbols=()=>app.universe?app.universe.list.map(x=>x.symbol):C.PAIRS.slice();
  function carrySymbols(){
    const now=transport.serverNow(),c=store('carry');
    return Array.isArray(c)?c.filter(x=>x&&typeof x.symbol==='string'&&x.until>now).map(x=>x.symbol):[];
  }
  const fetchSet=()=>[...new Set([...universeSymbols(),...C.PAIRS,...carrySymbols()])];
  function applyRanks(){
    const rk=new Map((app.universe?app.universe.list:[]).map(x=>[x.symbol,x.rank]));
    for(const [s,r] of Object.entries(app.exec.rules))r.rank=rk.has(s)?rk.get(s):null;
  }
  async function loadExchangeInfo(){
    const ex=app.exec;if(ex.rulesLoading)return app.ei;ex.rulesLoading=true;
    const res=await Tr.withRetry(()=>transport.exchangeInfo(),{delays:[5000,15000,30000]});
    ex.rulesLoading=false;
    if(res.ok){
      app.ei=res.value;
      const parsed=X.parseRules(res.value,[...new Set([...UV.eligible(res.value),...C.PAIRS,...fetchSet()])]);
      ex.rules=parsed;ex.rulesAt=transport.serverNow();ex.rulesError=Object.keys(parsed).length?null:'FORMAT';ex.rulesErrorAt=ex.rulesError?transport.serverNow():null;applyRanks();
    }else{ex.rulesError=String(res.error&&res.error.message||res.error);ex.rulesErrorAt=transport.serverNow();}
    render();return app.ei;
  }
  async function ensureUniverse(){
    const day=UV.dayStartOf(transport.serverNow());
    if(UV.isFor(app.universe,day)&&app.universe.source!=='stale'&&app.universe.source!=='core')return;
    const cached=store('universe');
    if(UV.isFor(cached,day)){app.universe=Object.assign({},cached,{source:'cache'});applyRanks();return;}
    try{
      app.progress='Menyusun universe 100 pair (volume harian close 08:00 WITA)…';render();
      const ei=app.ei&&app.exec.rulesAt&&UV.dayStartOf(app.exec.rulesAt)===day?app.ei:await loadExchangeInfo();
      if(!ei)throw new Error('exchangeInfo tidak tersedia');
      const tk=await Tr.withRetry(()=>transport.ticker24hr(),{delays:[5000,15000]});
      if(!tk.ok)throw tk.error;
      const pool=UV.pool(tk.value,UV.eligible(ei));
      if(!pool.length)throw new Error('tidak ada pair USDT perpetual yang memenuhi syarat');
      const vols={};let done=0;
      // Semua candle harian kumpulan kandidat WAJIB berhasil; satu gagal → ranking hari ini tidak ditetapkan (bukan tebakan).
      await Promise.all(pool.map(s=>Tr.withRetry(()=>transport.dailyKlines(s),{delays:[3000,10000]}).then(r=>{
        if(!r.ok)throw new Error('kline harian '+s+': '+(r.error&&r.error.message||r.error));
        const v=UV.dailyQuoteVolume(r.value,day);if(v!==null)vols[s]=v;
        done++;if(done%10===0){app.progress=`Menyusun universe: ${done}/${pool.length} pair…`;render();}
      })));
      const list=UV.rank(vols);
      if(!list.length)throw new Error('tidak ada candle harian yang close 00:00 UTC');
      app.universe={dayStart:day,at:transport.serverNow(),list,source:'live'};
      store('universe',{dayStart:day,at:app.universe.at,list});
    }catch(err){
      const msg=String(err&&err.message||err);
      app.universe=cached&&Array.isArray(cached.list)&&cached.list.length?Object.assign({},cached,{source:'stale',error:msg,errorAt:transport.serverNow()})
        :{dayStart:day,list:C.PAIRS.map(symbol=>({rank:null,symbol,quoteVolume:null})),source:'core',error:msg,errorAt:transport.serverNow()};
    }finally{app.progress=null;}
    applyRanks();
  }

  // ---------- siklus data ----------
  let rebuildTimer=null,buildSeq=0;
  function rebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(rebuildNow,50);}
  async function rebuildNow(){
    if(!app.frozen||!Object.keys(app.raw).length){render();return;}
    const seq=++buildSeq,now=transport.serverNow();
    const args={rawBySymbol:app.raw,now,failed:[...app.failed],symbols:Object.keys(app.raw),frozenMeta:app.meta.files,
      gate:{fromMs:UV.dayStartOf(now),allowed:universeSymbols()}};
    let st=null,err=null;
    try{st=await compute(args);}catch(e){console.error(e);try{st=computeLocal(args);}catch(e2){err=e2;console.error(e2);}}
    if(seq!==buildSeq)return;
    if(st){st.universeInfo=app.universe;app.state=st;app.error=null;
      store('carry',st.book.active.map(p=>({symbol:p.symbol,until:p.slotReleaseMs})));}
    else app.error=err;
    app.loading=false;
    live.sync(app.state?app.state.book.active.map(p=>p.symbol):[]);live.pollOI();
    render();
  }
  // Candle 4H: unduhan penuh (1.500) sekali, siklus berikutnya cukup 10 candle terakhir lalu digabung (R34).
  async function fetchCandles(s){
    const old=app.raw[s],now=transport.serverNow();
    const incr=old&&old.length&&old[old.length-1].t>=Cy.lastClosedT(now)-8*C.H4;
    const rows=await transport.klines(s,incr?10:Cy.KLINE_LIMIT);
    const fresh=rows.map(Cy.toCandle);
    return incr?Cy.mergeCandles(old,fresh):fresh;
  }
  function ensureTicker(symbols){
    const key=symbols.slice().sort().join(',');
    if(ticker&&ticker._key===key)return;
    if(ticker)ticker.stop();
    ticker=Tr.createTicker({symbols,onTick:()=>{}});ticker._key=key;
  }
  async function runCycle(){
    const id=++app.cycleId;app.loading=!app.state;render();
    try{await transport.syncClock();}catch{/* jam perangkat dipakai sampai sinkron berhasil */}
    await ensureUniverse();
    if(id!==app.cycleId)return;
    const F=fetchSet();
    for(const s of Object.keys(app.raw))if(!F.includes(s)){delete app.raw[s];app.failed.delete(s);}
    ensureTicker(F);
    // Siklus baru disusun setelah SEMUA pair selesai percobaan pertamanya (berhasil atau gagal), supaya tidak pernah
    // tampil keputusan dari campuran data baru/lama. Hasil percobaan ulang berikutnya langsung menyusun ulang siklus.
    const first=new Set(F);let got=0;
    const settle=s=>{if(id!==app.cycleId)return;if(first.delete(s)){got++;if(!app.state&&got%10===0){app.progress=`Mengunduh candle 4H: ${got}/${F.length} pair…`;render();}}if(!first.size){app.progress=null;rebuild();}};
    await Promise.all(F.map(s=>Tr.withRetry(()=>fetchCandles(s),{
      cancelled:()=>id!==app.cycleId,
      onAttemptFailed:()=>{if(id!==app.cycleId)return;app.failed.add(s);settle(s);}
    }).then(res=>{
      if(id!==app.cycleId)return;
      if(res.ok){app.raw[s]=res.value;app.failed.delete(s);}
      settle(s);
    })));
    if(id===app.cycleId)schedule();
  }
  // Jadwal: 5 detik setelah close 4H berikutnya. Bila open candle berikutnya belum muncul (fase CLOSE_CANDIDATE), cek ulang 15 detik lagi.
  function schedule(){
    clearTimeout(app.timers.cycle);
    const now=transport.serverNow(),next=Cy.lastClosedT(now)+C.H4+5000;
    const waitingOpen=app.state&&app.state.cycle.summary.phase==='CLOSE_CANDIDATE'&&now-app.state.T<10*60000;
    app.timers.cycle=setTimeout(runCycle,waitingOpen?15000:Math.max(1000,next-now));
  }
  function rulesDue(){
    const ex=app.exec,now=transport.serverNow();
    if(ex.rulesLoading)return false;
    if(ex.rulesError)return now-ex.rulesErrorAt>10*60000;
    return !ex.rulesAt||now-ex.rulesAt>X.RULES_TTL_MS;
  }

  // ---------- tampilan ----------
  function setScreen(s){
    if(!SCREENS.includes(s))s='siklus';app.view.screen=s;store('screen',s);
    document.querySelectorAll('[data-screen]').forEach(a=>a.classList.toggle('active',a.dataset.screen===s));
    render();$('content').focus({preventScroll:true});
  }
  function findRecord(id){if(!app.state||!id)return null;return app.state.history.find(r=>U.recId(r)===id)||null;}
  function render(){
    const st=app.state,v=app.view;
    $('stepper').innerHTML=U.stepper(st);
    $('health').innerHTML=app.progress&&!st?`<span class="dot neutral"></span><span>${L.esc(app.progress)}</span>`:!st&&app.failed.size?`<span class="dot warn"></span><span>Mengambil ulang (FETCH_FAILED): ${L.esc([...app.failed].join(', '))}</span>`:U.health(st,app.loading);
    $('nextClose').textContent=st?L.time(st.cycle.nextCloseMs):'—';
    let html;
    if(!st&&app.failed.size&&!app.error)html=`<div class="empty"><b>Data Binance belum berhasil diambil (FETCH_FAILED).</b><br>Dicoba ulang otomatis dengan jeda 30/60/120 detik, lalu lagi pada close 4H berikutnya. Tidak ada skor yang dihitung tanpa data.</div>`;
    else if(app.error&&!st)html=`<div class="empty"><b>Gagal menyusun siklus.</b><br>${L.esc(app.error.message)}</div>`;
    else html=v.screen==='event'?U.board(st):v.screen==='portofolio'?U.portofolio(st,liveView(),transport.serverNow(),app.exec):v.screen==='pasar'?U.pasar(st):v.screen==='audit'?U.audit(st,app.meta):U.siklus(st,v);
    $('content').innerHTML=html;
    const rec=findRecord(v.selected),insp=$('inspector');
    if(rec){insp.innerHTML=U.inspector(rec,st,v,app.exec);insp.hidden=false;}else{insp.hidden=true;insp.innerHTML='';}
    document.querySelector('.workspace').classList.toggle('no-insp',!rec);
    tickClock();
  }
  const liveView=()=>({prices:ticker?ticker.prices:{},data:live.data,cvd5:live.cvd5});
  function tickClock(){
    const now=transport.serverNow(),next=Cy.lastClosedT(now)+C.H4;
    $('countdown').textContent=L.duration(next-now);
  }
  function tick(){
    tickClock();live.tick();if(ticker)ticker.watchdog();
    if(app.view.screen==='portofolio'&&app.state){const el=$('slots');if(el)el.innerHTML=U.slots(app.state,liveView(),transport.serverNow(),app.exec);}
    if(app.frozen&&rulesDue())loadExchangeInfo();
    // Universe gagal ditetapkan (memakai daftar lama / 6 pair inti) → coba lagi tiap 5 menit.
    const u=app.universe;if(u&&(u.source==='stale'||u.source==='core')&&transport.serverNow()-u.errorAt>5*60000&&!app.timers.catchup){app.timers.catchup=setTimeout(()=>{app.timers.catchup=null;runCycle();},100);}
    // Close 4H terlewati (mis. tab tidur) → jalankan siklus sekarang.
    if(app.state&&Cy.lastClosedT(transport.serverNow())>app.state.T&&!app.timers.catchup){app.timers.catchup=setTimeout(()=>{app.timers.catchup=null;runCycle();},5000);}
  }

  function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);}
  function bind(){
    window.addEventListener('hashchange',()=>setScreen(location.hash.slice(1)));
    document.addEventListener('click',ev=>{
      const t=ev.target;
      const act=t.closest('[data-action]');
      if(act){
        const a=act.dataset.action,rec=findRecord(app.view.selected);
        if(a==='close-insp'){app.view.selected=null;render();return;}
        if(a==='copy-val'){ev.stopPropagation();const txt=act.dataset.val||'';(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{act.textContent='Tersalin';},()=>{act.textContent='Gagal';});return;}
        if(a==='copy-json'&&rec){const txt=JSON.stringify(Cy.publicRecord(rec),null,2);(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{act.textContent='Tersalin';},()=>{act.textContent='Gagal menyalin';});return;}
        if(a==='download-json'&&rec){download(rec.symbol+'_'+rec.side+'_'+rec.decision_available_utc.replace(/[:]/g,'')+'.json',JSON.stringify(Cy.publicRecord(rec),null,2),'application/json');return;}
        if(a==='download-audit'&&app.state){download('malomo_v7_audit_'+C.iso(app.state.T).replace(/[:]/g,'')+'.jsonl',Cy.auditLines(app.state),'application/x-ndjson');return;}
      }
      const tab=t.closest('[data-tab]');if(tab){app.view.tab=tab.dataset.tab;render();return;}
      const tap=t.closest('[data-tap]');if(tap){tap.classList.toggle('tap');return;}
      const r=t.closest('[data-rec]');if(r){app.view.selected=r.dataset.rec;app.view.tab='skor';render();}
    });
    document.addEventListener('change',ev=>{
      const x=ev.target.closest('[data-exec]');
      if(x){const k=x.dataset.exec;if(!['capital','riskPct','costBps'].includes(k))return;app.exec.settings[k]=String(x.value).trim();store('exec',app.exec.settings);render();return;}
      const f=ev.target.closest('[data-filter]');if(!f)return;
      const k={pair:'pair',arah:'side',keluarga:'family',status:'status',btc:'btc'}[f.dataset.filter];
      app.view.filters[k]=f.value;store('filters',app.view.filters);render();
    });
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&app.view.selected){app.view.selected=null;render();}});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&app.state&&Cy.lastClosedT(transport.serverNow())>app.state.T)runCycle();});
  }

  async function boot(){
    const f=store('filters');if(f&&typeof f==='object')Object.assign(app.view.filters,f);
    const xs=store('exec');if(xs&&typeof xs==='object')for(const k of ['capital','riskPct','costBps'])if(typeof xs[k]==='string')app.exec.settings[k]=xs[k];
    bind();setScreen(location.hash.slice(1)||store('screen')||'siklus');
    try{await loadStatic();}catch(err){app.error=err;app.loading=false;render();return;}
    initWorker();
    app.timers.tick=setInterval(tick,1000);
    app.timers.oi=setInterval(()=>live.pollOI(),15000);
    await runCycle();
    if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  root.MalomoApp={app,rebuildNow,runCycle,render,transport,live,get ticker(){return ticker;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(globalThis);
