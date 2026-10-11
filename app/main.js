/* Malomo V7 — orkestrasi aplikasi: ambil data publik → engine PRD → tampilan (PRD v1.0.13 R35: tiga layar Decision,
   Semua Pair, Jurnal). Siklus mengikuti close 4H (jam server Binance). Tanpa order, tanpa API key.
   localStorage: layar & filter terakhir, pengaturan rencana siap salin (R32), snapshot universe per close, dan ledger
   Decision terkunci (R35) — semuanya hanya di browser ini. */
(function(root){
  'use strict';
  const M=root.Malomo,C=M.core,Cy=M.cycle,U=M.ui,L=M.labels,Tr=M.transport,X=M.exec,UV=M.universe,LG=M.ledger;
  const $=id=>document.getElementById(id);
  const SCREENS=['decision','pairs','jurnal'];
  const app={state:null,loading:true,frozen:null,frozenJson:null,meta:{files:{},build:null},raw:{},failed:new Set(),cycleId:0,progress:null,
    universe:null,snap:null,eligible:null,ei:null,ledger:LG.empty(),
    view:{screen:'decision',pf:{structure:'',status:'',sort:'rank',q:''},jf:{pair:'',side:'',family:'',source:'',outcome:'',m6min:'',m6max:''}},timers:{},
    exec:{settings:{capital:'',riskPct:String(X.DEFAULTS.riskPct),costBps:String(X.DEFAULTS.costBps)},rules:{},rulesAt:null,rulesError:null,rulesErrorAt:null,rulesLoading:false}};
  const transport=Tr.createTransport();
  const live=M.live.createLive({openInterest:s=>transport.openInterest(s)});
  let market=null;

  function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem('malomo_v7_'+k));localStorage.setItem('malomo_v7_'+k,JSON.stringify(v));}catch{return null;}}

  async function sha256(text){
    try{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');}catch{return null;}
  }
  async function loadStatic(){
    const files=['frozen_cdf_normalization.json','frozen_v2_normalizations.json'];
    const texts=await Promise.all(files.map(f=>fetch('data/'+f,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(f+' HTTP '+r.status);return r.text();})));
    let manifest={};try{manifest=await fetch('data/MANIFEST_SHA256.json',{cache:'no-cache'}).then(r=>r.json());}catch{/* tanpa manifest: hash tetap dihitung */}
    for(let i=0;i<files.length;i++){const h=await sha256(texts[i]),want=manifest['evidence/'+files[i]];app.meta.files[files[i]]={sha256:h,match:want&&h?want===h:null};}
    app.frozenJson=[JSON.parse(texts[0]),JSON.parse(texts[1])];
    app.frozen=M.m2.frozenFrom(app.frozenJson[0],app.frozenJson[1]);
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

  // ---------- aturan pair & daftar kontrak (exchangeInfo publik) ----------
  function applyRanks(){
    const rk=new Map((app.universe?app.universe.list:[]).map(x=>[x.symbol,x.rank]));
    for(const [s,r] of Object.entries(app.exec.rules))r.rank=rk.has(s)?rk.get(s):null;
  }
  async function loadExchangeInfo(){
    const ex=app.exec;if(ex.rulesLoading)return app.ei;ex.rulesLoading=true;
    const res=await Tr.withRetry(()=>transport.exchangeInfo(),{delays:[5000,15000,30000]});
    ex.rulesLoading=false;
    if(res.ok){
      app.ei=res.value;app.eligible=UV.eligible(res.value);
      const parsed=X.parseRules(res.value,[...new Set([...app.eligible,...C.PAIRS])]);
      ex.rules=parsed;ex.rulesAt=transport.serverNow();ex.rulesError=Object.keys(parsed).length?null:'FORMAT';ex.rulesErrorAt=ex.rulesError?transport.serverNow():null;applyRanks();
    }else{ex.rulesError=String(res.error&&res.error.message||res.error);ex.rulesErrorAt=transport.serverNow();}
    render();return app.ei;
  }
  function rulesDue(){
    const ex=app.exec,now=transport.serverNow();
    if(ex.rulesLoading)return false;
    if(ex.rulesError)return now-ex.rulesErrorAt>10*60000;
    return !ex.rulesAt||now-ex.rulesAt>X.RULES_TTL_MS;
  }

  // ---------- universe realtime (R35): 100 pair volume 24 jam berjalan, stream !ticker@arr ----------
  const coreUniverse=err=>({at:transport.serverNow(),list:C.PAIRS.map(symbol=>({rank:null,symbol,quoteVolume:null})),source:'core',error:err,errorAt:transport.serverNow()});
  function computeUniverse(){
    if(!app.eligible||!market)return false;
    const list=UV.rankRolling(market.tickers,app.eligible);
    if(!list.length)return false;
    app.universe={at:transport.serverNow(),list,source:'live'};applyRanks();return true;
  }
  async function ensureUniverse(){
    if(!app.eligible)await loadExchangeInfo();
    if(!app.eligible){app.universe=coreUniverse('daftar kontrak (exchangeInfo) tidak tersedia');return;}
    if(!computeUniverse()){
      app.progress='Mengambil volume 24 jam semua pair…';render();
      const tk=await Tr.withRetry(()=>transport.ticker24hr(),{delays:[5000,15000]});app.progress=null;
      if(tk.ok)market.seed(tk.value);
      if(!computeUniverse())app.universe=coreUniverse(tk.ok?'tidak ada pair yang memenuhi syarat':'volume 24 jam tidak tersedia: '+String(tk.error&&tk.error.message||tk.error));
    }
  }
  // Snapshot universe pada close 4H = hard gate keputusan close itu (dipakai ulang bila aplikasi dibuka ulang di siklus sama).
  function ensureSnapshot(T){
    if(app.snap&&app.snap.T===T)return;
    const saved=store('snap');
    if(saved&&saved.T===T&&Array.isArray(saved.list)&&saved.list.length){app.snap=saved;return;}
    app.snap={T,list:app.universe.list.map(x=>({rank:x.rank,symbol:x.symbol})),source:app.universe.source};
    if(app.universe.source==='live')store('snap',app.snap);
  }
  const snapSymbols=()=>app.snap?app.snap.list.map(x=>x.symbol):C.PAIRS.slice();
  const carrySymbols=()=>LG.active(app.ledger,transport.serverNow()).map(e=>e.symbol);
  const relevant=()=>new Set([...snapSymbols(),...C.PAIRS,...carrySymbols()]);   // pair yang menentukan keputusan close ini

  // Pair yang baru masuk 100 besar di tengah siklus: candle diunduh di latar; ikut keputusan mulai close berikutnya.
  const bg={queue:new Set(),busy:false};
  function syncBackground(){
    if(!app.universe||app.universe.source!=='live'||!app.state)return;
    for(const x of app.universe.list)if(!app.raw[x.symbol]&&!bg.queue.has(x.symbol))bg.queue.add(x.symbol);
    pumpBackground();
  }
  async function pumpBackground(){
    if(bg.busy||!bg.queue.size)return;bg.busy=true;
    while(bg.queue.size){
      const s=bg.queue.values().next().value;bg.queue.delete(s);
      if(app.raw[s])continue;
      try{app.raw[s]=await fetchCandles(s);rebuildSoon();}catch{/* dicoba lagi saat siklus berikutnya */}
    }
    bg.busy=false;
  }

  // ---------- siklus data ----------
  let rebuildTimer=null,buildSeq=0,soonTimer=null;
  function rebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(rebuildNow,50);}
  function rebuildSoon(){if(soonTimer)return;soonTimer=setTimeout(()=>{soonTimer=null;rebuild();},30000);}
  async function rebuildNow(){
    if(!app.frozen||!Object.keys(app.raw).length){render();return;}
    const seq=++buildSeq,now=transport.serverNow(),rel=relevant();
    const args={rawBySymbol:app.raw,now,failed:[...app.failed].filter(s=>rel.has(s)),symbols:Object.keys(app.raw),frozenMeta:app.meta.files,
      gate:{fromMs:app.snap?app.snap.T:Cy.lastClosedT(now),allowed:snapSymbols()}};
    let st=null,err=null;
    try{st=await compute(args);}catch(e){console.error(e);try{st=computeLocal(args);}catch(e2){err=e2;console.error(e2);}}
    if(seq!==buildSeq)return;
    if(st){
      app.state=st;app.error=null;
      const ranks={};for(const x of (app.snap?app.snap.list:[]))if(Number.isInteger(x.rank))ranks[x.symbol]=x.rank;
      LG.freeze(app.ledger,st.history,{regimes:st.regimes||{},ranks,currentT:st.T,now});
      LG.resolve(app.ledger,app.raw,now);store('ledger',app.ledger);
    }else app.error=err;
    app.loading=false;
    live.sync(carrySymbols());live.pollOI();
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
  async function runCycle(){
    const id=++app.cycleId;app.loading=!app.state;render();
    try{await transport.syncClock();}catch{/* jam perangkat dipakai sampai sinkron berhasil */}
    await ensureUniverse();
    if(id!==app.cycleId)return;
    const T=Cy.lastClosedT(transport.serverNow());ensureSnapshot(T);
    const keep=new Set([...relevant(),...app.universe.list.map(x=>x.symbol)]);
    for(const s of Object.keys(app.raw))if(!keep.has(s)){delete app.raw[s];app.failed.delete(s);}
    const F=[...relevant()];
    // Siklus baru disusun setelah SEMUA pair penentu keputusan selesai percobaan pertamanya (berhasil atau gagal).
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

  // ---------- tampilan ----------
  function setScreen(s){
    if(!SCREENS.includes(s))s='decision';app.view.screen=s;store('screen',s);
    document.querySelectorAll('[data-screen]').forEach(a=>a.classList.toggle('active',a.dataset.screen===s));
    render();$('content').focus({preventScroll:true});
  }
  const liveView=()=>({prices:market?market.prices:{},data:live.data,cvd5:live.cvd5});
  function ctx(){return {app,state:app.state,ledger:app.ledger,now:transport.serverNow(),live:liveView(),ex:app.exec,market:market?market.tickers:{}};}
  function render(){
    const st=app.state,c=ctx();
    $('health').innerHTML=app.progress&&!st?`<span class="dot neutral"></span><span>${L.esc(app.progress)}</span>`:!st&&app.failed.size?`<span class="dot warn"></span><span>Mengambil ulang (FETCH_FAILED): ${L.esc([...app.failed].join(', '))}</span>`:U.health(st,app.loading);
    $('nextClose').textContent=st?L.time(st.cycle.nextCloseMs):'—';
    $('universe').innerHTML=U.universeLine(app.universe,app.snap);
    let html;
    if(!st&&app.failed.size&&!app.error)html=`<div class="empty"><b>Data Binance belum berhasil diambil (FETCH_FAILED).</b><br>Dicoba ulang otomatis dengan jeda 30/60/120 detik, lalu lagi pada close 4H berikutnya. Tidak ada skor yang dihitung tanpa data.</div>`;
    else if(app.error&&!st)html=`<div class="empty"><b>Gagal menyusun siklus.</b><br>${L.esc(app.error.message)}</div>`;
    else html=app.view.screen==='pairs'?U.pairsScreen(c,app.view.pf):app.view.screen==='jurnal'?U.journalScreen(c,app.view.jf):U.decisionScreen(c);
    $('content').innerHTML=html;
    tickClock();
  }
  function tickClock(){
    const now=transport.serverNow(),next=Cy.lastClosedT(now)+C.H4;
    $('countdown').textContent=L.duration(next-now);
  }
  let lastPairsRender=0,lastUniverse=0;
  function tick(){
    tickClock();live.tick();if(market)market.watchdog();
    const now=transport.serverNow();
    if(app.view.screen==='decision'&&app.state){const el=$('dec-list');if(el)el.innerHTML=U.decisionList(ctx());}
    // Universe realtime: ranking ulang tiap 5 detik dari stream; pair baru diunduh di latar.
    if(now-lastUniverse>5000&&app.eligible&&market&&app.state){lastUniverse=now;if(computeUniverse()){$('universe').innerHTML=U.universeLine(app.universe,app.snap);syncBackground();}}
    if(app.view.screen==='pairs'&&app.state&&now-lastPairsRender>5000){lastPairsRender=now;const el=$('pairs-body');if(el)el.innerHTML=U.pairsRows(ctx(),app.view.pf);}
    if(app.frozen&&rulesDue())loadExchangeInfo();
    const u=app.universe;if(u&&u.source==='core'&&now-u.errorAt>5*60000&&!app.timers.catchup){app.timers.catchup=setTimeout(()=>{app.timers.catchup=null;runCycle();},100);}
    // Close 4H terlewati (mis. tab tidur) → jalankan siklus sekarang.
    if(app.state&&Cy.lastClosedT(now)>app.state.T&&!app.timers.catchup){app.timers.catchup=setTimeout(()=>{app.timers.catchup=null;runCycle();},5000);}
  }

  function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);}
  const numOrNull=v=>{const n=Number(String(v).replace(',','.'));return String(v).trim()!==''&&Number.isFinite(n)?n:null;};
  function journalFilter(){const jf=app.view.jf;return Object.assign({},jf,{m6min:numOrNull(jf.m6min),m6max:numOrNull(jf.m6max)});}
  function bind(){
    window.addEventListener('hashchange',()=>setScreen(location.hash.slice(1)));
    document.addEventListener('click',ev=>{
      const act=ev.target.closest('[data-action]');if(!act)return;
      const a=act.dataset.action;
      if(a==='copy-val'){ev.stopPropagation();const txt=act.dataset.val||'';(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{act.textContent='Tersalin';},()=>{act.textContent='Gagal';});return;}
      if(a==='download-journal'){const rows=LG.filter(LG.finished(app.ledger),journalFilter());
        download('malomo_v7_jurnal_'+C.iso(transport.serverNow()).slice(0,10)+'.csv',LG.csv(rows),'text/csv;charset=utf-8');return;}
    });
    document.addEventListener('change',ev=>{
      const x=ev.target.closest('[data-exec]');
      if(x){const k=x.dataset.exec;if(!['capital','riskPct','costBps'].includes(k))return;app.exec.settings[k]=String(x.value).trim();store('exec',app.exec.settings);render();return;}
      const p=ev.target.closest('[data-pf]');if(p){app.view.pf[p.dataset.pf]=p.value;store('pf',app.view.pf);render();return;}
      const j=ev.target.closest('[data-jf]');if(j){app.view.jf[j.dataset.jf]=j.value;store('jf',app.view.jf);render();return;}
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&app.state&&Cy.lastClosedT(transport.serverNow())>app.state.T)runCycle();});
  }

  async function boot(){
    for(const [k,obj] of [['pf',app.view.pf],['jf',app.view.jf]]){const v=store(k);if(v&&typeof v==='object')for(const f of Object.keys(obj))if(typeof v[f]==='string')obj[f]=v[f];}
    const xs=store('exec');if(xs&&typeof xs==='object')for(const k of ['capital','riskPct','costBps'])if(typeof xs[k]==='string')app.exec.settings[k]=xs[k];
    app.ledger=LG.load(store('ledger'));
    bind();setScreen(location.hash.slice(1)||store('screen')||'decision');
    try{await loadStatic();}catch(err){app.error=err;app.loading=false;render();return;}
    initWorker();
    market=Tr.createMarketTicker({onUpdate:()=>{}});
    app.timers.tick=setInterval(tick,1000);
    app.timers.oi=setInterval(()=>live.pollOI(),15000);
    await runCycle();
    if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  root.MalomoApp={app,rebuildNow,runCycle,render,transport,live,journalFilter,get ticker(){return market;},get market(){return market;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(globalThis);
