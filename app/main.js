/* Malomo V7 — orkestrasi aplikasi: ambil data publik → engine PRD → tampilan.
   Siklus mengikuti close 4H (jam server Binance). Tanpa order, tanpa API key, tanpa penyimpanan keputusan di luar memori;
   localStorage hanya untuk kenyamanan tampilan (layar & filter terakhir) dan pengaturan rencana siap salin R32
   (modal, risiko, biaya) yang hanya hidup di browser ini. */
(function(root){
  'use strict';
  const M=root.Malomo,C=M.core,Cy=M.cycle,U=M.ui,L=M.labels,Tr=M.transport,X=M.exec;
  const $=id=>document.getElementById(id);
  const SCREENS=['siklus','event','portofolio','pasar','audit'];
  const app={state:null,loading:true,frozen:null,meta:{files:{},build:null},raw:{},failed:new Set(),cycleId:0,
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
    app.frozen=M.m2.frozenFrom(JSON.parse(texts[0]),JSON.parse(texts[1]));
    try{app.meta.build=await fetch('build-info.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null);}catch{app.meta.build=null;}
  }

  // ---------- siklus data ----------
  let rebuildTimer=null;
  function rebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(rebuildNow,50);}
  function rebuildNow(){
    if(!app.frozen||!Object.keys(app.raw).length){render();return;}
    try{
      app.state=Cy.buildState({rawBySymbol:app.raw,now:transport.serverNow(),frozen:app.frozen,failed:[...app.failed],frozenMeta:app.meta.files});
      app.error=null;
    }catch(err){app.error=err;console.error(err);}
    app.loading=false;
    live.sync(app.state?app.state.book.active.map(p=>p.symbol):[]);live.pollOI();
    render();
  }
  async function runCycle(){
    const id=++app.cycleId;app.loading=!app.state;render();
    try{await transport.syncClock();}catch{/* jam perangkat dipakai sampai sinkron berhasil */}
    // Siklus baru disusun setelah SEMUA pair selesai percobaan pertamanya (berhasil atau gagal), supaya tidak pernah
    // tampil keputusan dari campuran data baru/lama. Hasil percobaan ulang berikutnya langsung menyusun ulang siklus.
    const first=new Set(C.PAIRS);
    const settle=s=>{if(id!==app.cycleId)return;first.delete(s);if(!first.size)rebuild();};
    await Promise.all(C.PAIRS.map(s=>Tr.withRetry(()=>transport.klines(s,Cy.KLINE_LIMIT),{
      cancelled:()=>id!==app.cycleId,
      onAttemptFailed:()=>{if(id!==app.cycleId)return;app.failed.add(s);settle(s);}
    }).then(res=>{
      if(id!==app.cycleId)return;
      if(res.ok){app.raw[s]=res.value.map(Cy.toCandle);app.failed.delete(s);}
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

  // ---------- aturan pair (R32): exchangeInfo publik, diperbarui tiap 24 jam; gagal → rencana tampil belum dibulatkan ----------
  async function loadRules(){
    const ex=app.exec;if(ex.rulesLoading)return;ex.rulesLoading=true;
    const res=await Tr.withRetry(()=>transport.exchangeInfo());
    ex.rulesLoading=false;
    if(res.ok){const parsed=X.parseRules(res.value,C.PAIRS);ex.rules=parsed;ex.rulesAt=transport.serverNow();ex.rulesError=Object.keys(parsed).length?null:'FORMAT';ex.rulesErrorAt=ex.rulesError?transport.serverNow():null;}
    else{ex.rulesError=String(res.error&&res.error.message||res.error);ex.rulesErrorAt=transport.serverNow();}
    render();
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
    $('health').innerHTML=!st&&app.failed.size?`<span class="dot warn"></span><span>Mengambil ulang (FETCH_FAILED): ${L.esc([...app.failed].join(', '))}</span>`:U.health(st,app.loading);
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
    if(app.frozen&&rulesDue())loadRules();
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
    ticker=Tr.createTicker({symbols:C.PAIRS,onTick:()=>{}});
    app.timers.tick=setInterval(tick,1000);
    app.timers.oi=setInterval(()=>live.pollOI(),15000);
    loadRules();
    await runCycle();
    if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  root.MalomoApp={app,rebuildNow,runCycle,render,transport,live,get ticker(){return ticker;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(globalThis);
