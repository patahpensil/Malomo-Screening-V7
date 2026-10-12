/* Malomo V7 — orkestrasi aplikasi: ambil data publik → engine PRD → tampilan (PRD v1.0.13 R35: tiga layar Decision,
   Semua Pair, Jurnal). Siklus mengikuti close 4H (jam server Binance). Tanpa order, tanpa API key.
   localStorage: layar & filter terakhir, pengaturan rencana siap salin (R32), snapshot universe per close, dan ledger
   Decision terkunci (R35) — semuanya hanya di browser ini. */
(function(root){
  'use strict';
  const M=root.Malomo,C=M.core,Cy=M.cycle,U=M.ui,L=M.labels,Tr=M.transport,X=M.exec,UV=M.universe,LG=M.ledger,PF=M.portfolio,PI=M.pairinfo;
  const $=id=>document.getElementById(id);
  const SCREENS=['decision','pairs','jurnal'];
  const app={state:null,loading:true,frozen:null,frozenJson:null,meta:{files:{},build:null},raw:{},failed:new Set(),cycleId:0,progress:null,
    universe:null,snap:null,eligible:null,ei:null,ledger:LG.empty(),manual:PF.emptyManual(),detail:null,
    view:{screen:'decision',pf:{structure:'',status:'',sort:'rank',q:''},jf:{pair:'',side:'',family:'',taken:'',outcome:'',m6min:'',m6max:''},sheet:null},timers:{},
    exec:{settings:{capital:'',riskPct:String(X.DEFAULTS.riskPct),costBps:String(X.DEFAULTS.costBps)},draft:null,dirty:false,savedAt:null,saveError:false,justSaved:false,
      rules:{},rulesAt:null,rulesError:null,rulesErrorAt:null,rulesLoading:false}};
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
  // Pair sinyal yang slotnya masih berjalan ATAU hasilnya belum final (≤ 48 jam) tetap diunduh, supaya hasil jurnal
  // tidak berubah menjadi NO_DATA hanya karena pair keluar dari 100 besar volume atau aplikasi lama tidak dibuka.
  const carrySymbols=()=>{const now=transport.serverNow();return [...new Set([...LG.active(app.ledger,now),...LG.unresolved(app.ledger,now)].map(e=>e.symbol))];};
  const manualSymbols=()=>PF.openManual(app.manual).map(p=>p.symbol);   // R38: candle pair posisi manual (hanya untuk hasil, bukan skor)
  const relevant=()=>new Set([...snapSymbols(),...C.PAIRS,...carrySymbols(),...manualSymbols()]);   // pair yang menentukan keputusan close ini

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
      if(PF.resolveManual(app.manual,app.raw,now).length)store('manual',app.manual);
    }else app.error=err;
    app.loading=false;
    live.sync(liveSyms());live.pollOI();
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

  // ---------- R39 Detail Pair (informasi saja; bukan gate, tidak masuk skor) ----------
  const liveSyms=()=>[...new Set([...LG.active(app.ledger,transport.serverNow()).map(e=>e.symbol),...(app.detail?[app.detail.sym]:[])])];
  const FD={oi:['openInterestHist',PI.openInterest],gls:['globalLongShortAccountRatio',PI.ratio],tla:['topLongShortAccountRatio',PI.ratio],tlp:['topLongShortPositionRatio',PI.ratio],taker:['takerlongshortRatio',PI.taker]};
  function renderDetail(){const el=$('detail');if(!el)return;el.innerHTML=U.pairDetail(ctx(),app.detail);el.hidden=!app.detail;}
  function renderDetailLive(){if(!app.detail)return;const v=U.detailLive(ctx(),app.detail),m=$('dt-market'),b=$('dt-book');if(m)m.innerHTML=v.market;if(b)b.innerHTML=v.book;}
  const errText=err=>String(err&&err.message||err||'gagal').replace(/^Binance /,'');
  async function loadDetailCandles(d){
    const now=transport.serverNow();let c=app.raw[d.sym];
    try{if(!c||!c.length)c=(await transport.klines(d.sym,300)).map(Cy.toCandle);
      if(app.detail!==d)return;d.data.ema=PI.emaInfo(c,now);delete d.err.ema;}
    catch(err){if(app.detail===d)d.err.ema=errText(err);}
    if(app.detail===d)renderDetail();
  }
  async function loadDetailFunding(d){
    try{const f=PI.funding(await transport.premiumIndex(d.sym));if(app.detail!==d)return;d.data.funding=f;delete d.err.funding;}
    catch(err){if(app.detail===d)d.err.funding=errText(err);}
    d.fundingAt=transport.serverNow();if(app.detail===d)renderDetail();
  }
  async function loadDetailStats(d){
    await Promise.all(Object.entries(FD).map(async([k,[kind,parse]])=>{
      try{const rows=await transport.futuresData(kind,d.sym,'4h',42);if(app.detail!==d)return;d.data[k]=parse(rows);delete d.err[k];}
      catch(err){if(app.detail===d)d.err[k]=errText(err);}
    }));
    d.statsAt=transport.serverNow();if(app.detail===d)renderDetail();
  }
  function openDetail(sym){
    if(!sym)return;
    // lebar grafik = lebar panel nyata (panel maks 720 px, padding 16 + kartu 12 di tiap sisi)
    const vw=(root.innerWidth||720),w=Math.round(Math.min(720,vw)-2*16-2*13);
    app.detail={sym,data:{},err:{},openedAt:transport.serverNow(),w:Math.max(260,w)};const d=app.detail;
    renderDetail();live.sync(liveSyms());live.pollOI();
    loadDetailCandles(d);loadDetailFunding(d);loadDetailStats(d);
  }
  function closeDetail(){app.detail=null;renderDetail();live.sync(liveSyms());}
  // Selama terbuka: bagian live tiap detik; funding tiap 30 detik; statistik & EMA diperbarui setelah candle 4H baru close.
  function tickDetail(now){
    const d=app.detail;if(!d)return;renderDetailLive();
    if(d.fundingAt&&now-d.fundingAt>30000){d.fundingAt=now;loadDetailFunding(d);}
    // statistik 4 jam Binance terbit sesaat setelah close → muat ulang 60 detik setelah close 4H baru
    if(d.statsAt&&Cy.lastClosedT(now)>Cy.lastClosedT(d.statsAt)&&now-Cy.lastClosedT(now)>60000){d.statsAt=now;loadDetailStats(d);loadDetailCandles(d);}
  }

  // ---------- tampilan ----------
  function setScreen(s){
    if(!SCREENS.includes(s))s='decision';app.view.screen=s;store('screen',s);
    document.querySelectorAll('[data-screen]').forEach(a=>a.classList.toggle('active',a.dataset.screen===s));
    render();$('content').focus({preventScroll:true});
  }
  const liveView=()=>({prices:market?market.prices:{},data:live.data,cvd5:live.cvd5});
  function ctx(){return {app,state:app.state,ledger:app.ledger,manual:app.manual,now:transport.serverNow(),live:liveView(),ex:app.exec,market:market?market.tickers:{}};}
  // R38: lembar isian dirender HANYA saat dibuka/ditutup/error (bukan tiap detik) supaya isian tidak terhapus.
  function renderSheet(){const el=$('sheet');if(!el)return;el.innerHTML=U.sheet(ctx(),app.view.sheet);el.hidden=!app.view.sheet;if(app.view.sheet){const f=el.querySelector('input');if(f)f.focus();}}
  const sheetVals=()=>{const o={};document.querySelectorAll('#sheet [data-sh]').forEach(x=>{o[x.dataset.sh]=x.value;});return o;};
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
    tickClock();live.tick();if(market)market.watchdog();tickDetail(transport.serverNow());
    const now=transport.serverNow();
    if(app.view.screen==='decision'&&app.state){const el=$('dec-list');if(el)el.innerHTML=U.decisionList(ctx());const mn=$('man-list');if(mn)mn.innerHTML=U.manualList(ctx());}
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
      if(a==='pair'){ev.preventDefault();openDetail(act.dataset.sym);return;}
      if(a==='detail-close'){closeDetail();return;}
      if(a==='copy-val'){ev.stopPropagation();const txt=act.dataset.val||'';(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{act.textContent='Tersalin';},()=>{act.textContent='Gagal';});return;}
      // R36: pengaturan modal hanya berlaku setelah tombol Simpan ditekan dan nilainya sah.
      if(a==='save-exec'){const ex=app.exec,v=X.validateSettings(ex.draft);
        if(!v.ok){ex.saveError=true;render();return;}
        ex.settings={capital:String(ex.draft.capital).trim(),riskPct:String(ex.draft.riskPct).trim(),costBps:String(ex.draft.costBps).trim()};
        ex.savedAt=transport.serverNow();ex.dirty=false;ex.saveError=false;ex.justSaved=true;
        store('exec',Object.assign({},ex.settings,{savedAt:ex.savedAt}));render();
        const ok=store('exec');if(!ok||ok.capital!==ex.settings.capital){ex.justSaved=false;ex.storeFailed=true;render();}
        return;}
      if(a==='cancel-exec'){const ex=app.exec;ex.draft=Object.assign({},ex.settings);ex.dirty=false;ex.saveError=false;render();return;}
      // ---------- R38 Saya ambil / posisi manual ----------
      if(a==='take-open'){const en=app.ledger.entries[act.dataset.key];if(!en)return;
        const pl=X.plan({symbol:en.symbol,side:en.side,entry:en.entry,stop:en.stop,target:en.target,target2:en.target2,tp1Frac:en.tp1Frac},app.exec.settings,app.exec.rules[en.symbol]||null);
        app.view.sheet={type:'take',key:en.key,errors:{},prefill:{entry:pl.priceStr?pl.priceStr.entry:String(en.entry),qty:pl.qtyStr||(Number.isFinite(pl.qty)?String(+pl.qty.toPrecision(8)):'')}};renderSheet();return;}
      if(a==='take-save'){const sh=app.view.sheet,v=sheetVals(),r=PF.take(app.ledger,sh.key,{entry:v.entry,qty:v.qty,now:transport.serverNow()});
        if(!r.ok){sh.errors=r.errors;sh.prefill=v;renderSheet();return;}
        store('ledger',app.ledger);app.view.sheet=null;renderSheet();render();return;}
      if(a==='untake'){if(!confirm('Batalkan tanda "Diambil" untuk posisi ini?'))return;if(PF.untake(app.ledger,act.dataset.key)){store('ledger',app.ledger);render();}return;}
      if(a==='man-open'){app.view.sheet={type:'manual',errors:{},prefill:{}};renderSheet();return;}
      if(a==='man-save'){const sh=app.view.sheet,v=sheetVals(),cap=X.validateSettings(app.exec.settings);
        const r=PF.addManual(app.manual,v,{now:transport.serverNow(),capital:cap.ok?cap.capital:null});
        if(!r.ok){sh.errors=r.errors;sh.prefill=v;renderSheet();return;}
        store('manual',app.manual);app.view.sheet=null;renderSheet();
        const sym=app.manual.positions[r.id].symbol;if(!app.raw[sym]){bg.queue.add(sym);pumpBackground();}
        render();return;}
      if(a==='man-close-open'){const p=app.manual.positions[act.dataset.id];if(!p)return;const t=market&&market.tickers[p.symbol];
        app.view.sheet={type:'close',id:p.id,errors:{},prefill:{exit:t&&t.price>0?String(t.price):''}};renderSheet();return;}
      if(a==='man-close-save'){const sh=app.view.sheet,v=sheetVals(),r=PF.closeManual(app.manual,sh.id,{exit:v.exit,now:transport.serverNow()});
        if(!r.ok){sh.errors=r.errors;sh.prefill=v;renderSheet();return;}
        store('manual',app.manual);app.view.sheet=null;renderSheet();render();return;}
      if(a==='man-delete'){if(!confirm('Hapus posisi manual ini? (untuk salah input)'))return;if(PF.removeManual(app.manual,act.dataset.id)){store('manual',app.manual);render();}return;}
      if(a==='sheet-cancel'){app.view.sheet=null;renderSheet();return;}
      if(a==='download-manual'){const cost=X.validateSettings(app.exec.settings);
        download('malomo_v7_manual_'+C.iso(transport.serverNow()).slice(0,10)+'.csv',PF.csvManual(PF.closedManual(app.manual),{costBps:cost.ok?cost.costBps:X.DEFAULTS.costBps}),'text/csv;charset=utf-8');return;}
      if(a==='download-journal'){const rows=LG.filter(LG.finished(app.ledger),journalFilter());
        const cs=X.validateSettings(app.exec.settings),cost=cs.ok?cs.costBps:X.DEFAULTS.costBps;
        download('malomo_v7_jurnal_'+C.iso(transport.serverNow()).slice(0,10)+'.csv',LG.csv(rows,{pnl:e=>PF.pnl(PF.fromTaken(e),cost)}),'text/csv;charset=utf-8');return;}
    });
    document.addEventListener('change',ev=>{
      const p=ev.target.closest('[data-pf]');if(p){app.view.pf[p.dataset.pf]=p.value;store('pf',app.view.pf);render();return;}
      const j=ev.target.closest('[data-jf]');if(j){app.view.jf[j.dataset.jf]=j.value;store('jf',app.view.jf);render();return;}
    });
    // Mengetik di form pengaturan hanya mengubah draf (belum dipakai) + menandai "Belum disimpan".
    document.addEventListener('input',ev=>{
      const x=ev.target.closest('[data-exec]');if(!x)return;const k=x.dataset.exec;if(!['capital','riskPct','costBps'].includes(k))return;
      const ex=app.exec;ex.draft[k]=x.value;ex.dirty=['capital','riskPct','costBps'].some(f=>String(ex.draft[f]).trim()!==String(ex.settings[f]).trim());ex.justSaved=false;
      const st=document.getElementById('exec-save-status');if(st)st.outerHTML=U.execSaveStatus(ex);
      const b=document.querySelector('[data-save-badge]');if(b)b.outerHTML=ex.dirty?'<span class="chip warn" data-save-badge="dirty">● belum disimpan</span>':'<span class="chip primary" data-save-badge="saved">✓ tersimpan</span>';
    });
    document.addEventListener('keydown',ev=>{if(ev.key!=='Escape')return;if(app.view.sheet){app.view.sheet=null;renderSheet();}else if(app.detail)closeDetail();});
    // R39 hover grafik detail: garis bantu + tooltip candle terdekat.
    document.addEventListener('pointermove',ev=>{const svg=ev.target.closest&&ev.target.closest('[data-chart]');const tip=$('dt-tip');
      if(!svg||!tip||!app.detail||!app.detail.data.ema){if(tip&&!tip.hidden&&!svg){tip.hidden=true;const xh=document.querySelector('[data-chart] .xhair');if(xh)xh.setAttribute('visibility','hidden');}return;}
      const r=svg.getBoundingClientRect(),W=+svg.dataset.w,n=+svg.dataset.n,pl=+svg.dataset.pl,pr=+svg.dataset.pr,xv=(ev.clientX-r.left)/r.width*W;
      const i=Math.max(0,Math.min(n-1,Math.floor((xv-pl)/((W-pl-pr)/n))));const cx=pl+(W-pl-pr)/n*(i+0.5);
      const xh=svg.querySelector('.xhair');xh.setAttribute('x1',cx);xh.setAttribute('x2',cx);xh.setAttribute('visibility','visible');
      tip.innerHTML=U.chartTip(app.detail.data.ema.chart,i);tip.hidden=false;tip.dataset.i=i;});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&app.state&&Cy.lastClosedT(transport.serverNow())>app.state.T)runCycle();});
  }

  async function boot(){
    for(const [k,obj] of [['pf',app.view.pf],['jf',app.view.jf]]){const v=store(k);if(v&&typeof v==='object')for(const f of Object.keys(obj))if(typeof v[f]==='string')obj[f]=v[f];}
    const xs=store('exec');if(xs&&typeof xs==='object'){for(const k of ['capital','riskPct','costBps'])if(typeof xs[k]==='string')app.exec.settings[k]=xs[k];if(Number.isFinite(xs.savedAt))app.exec.savedAt=xs.savedAt;}
    app.exec.draft=Object.assign({},app.exec.settings);
    app.ledger=LG.load(store('ledger'));app.manual=PF.loadManual(store('manual'));
    bind();setScreen(location.hash.slice(1)||store('screen')||'decision');
    try{await loadStatic();}catch(err){app.error=err;app.loading=false;render();return;}
    initWorker();
    market=Tr.createMarketTicker({onUpdate:()=>{}});
    app.timers.tick=setInterval(tick,1000);
    app.timers.oi=setInterval(()=>live.pollOI(),15000);
    await runCycle();
    if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  root.MalomoApp={app,renderSheet,openDetail,closeDetail,rebuildNow,runCycle,render,transport,live,journalFilter,get ticker(){return market;},get market(){return market;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(globalThis);
