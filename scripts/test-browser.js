'use strict';
/* Uji bug di browser (Chromium headless) sebelum live — PRD v1.0.13 R35 (tiga layar Decision, Semua Pair, Jurnal):
   situs _site/ dilayani lokal, Binance REST & WebSocket (termasuk !ticker@arr) di-mock dengan data sintetis deterministik.
   Desktop 1440 px dan mobile 390 px, ditambah skenario FETCH_FAILED, universe gagal, exchangeInfo gagal, CLOSE_CANDIDATE.
   Angka di layar dibandingkan dengan engine + ledger yang dijalankan di Node atas data yang sama. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let pw;try{pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch{pw=require('/opt/npm-tools/node_modules/playwright');}
const {chromium}=pw;
const ROOT=path.resolve(__dirname,'..'),SITE=path.join(ROOT,'_site');
const C=require('../engine/core'),M2=require('../engine/m2'),Cy=require('../app/cycle'),X=require('../app/exec'),UV=require('../app/universe'),LG=require('../app/ledger'),PI=require('../app/pairinfo'),S=require('./synthetic');
const H4=C.H4;
if(!fs.existsSync(path.join(SITE,'index.html'))){console.error('Jalankan node scripts/build-site.js dulu');process.exit(1);}
const FROZEN=M2.frozenFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_v2_normalizations.json'),'utf8')));
// Universe tiruan R34: 6 pair inti + 6 pair tambahan (seri sintetis lain, diganti nama) + stablecoin bervolume raksasa
// yang wajib tersaring + pair SETTLING yang tidak boleh diunduh.
const RAW=S.generate({n:1600});
const EXTRA=S.generate({n:1600,seed:11}),RENAME={BTCUSDT:'AAAUSDT',ETHUSDT:'BBBUSDT',SOLUSDT:'CCCUSDT',BNBUSDT:'DDDUSDT',DOGEUSDT:'EEEUSDT',XRPUSDT:'FFFUSDT'};
for(const [a,b] of Object.entries(RENAME))RAW[b]=EXTRA[a];
const SYMS=Object.keys(RAW);
const DAILY_VOL=Object.fromEntries(SYMS.map((s,i)=>[s,1e9-i*1e7]));DAILY_VOL.USDCUSDT=9e12;DAILY_VOL.OLDUSDT=5e12;
// Pilih close dengan ENTRY_CONSIDER + REJECTED_RISK, sekaligus ada posisi aktif saat itu.
const lastOpen=RAW.BTCUSDT[RAW.BTCUSDT.length-1][0];
const full=Cy.buildState({rawBySymbol:Object.fromEntries(Object.entries(RAW).map(([s,r])=>[s,r.map(Cy.toCandle)])),now:lastOpen+10000,frozen:FROZEN,symbols:SYMS});
const byT=new Map();for(const r of full.history){const k=Date.parse(r.decision_available_utc);if(!byT.has(k))byT.set(k,[]);byT.get(k).push(r.status);}
// close dengan ENTRY_CONSIDER + REJECTED_RISK (Decision baru + penolakan risiko pada close yang sama)
const T=[...byT.entries()].filter(([,v])=>v.includes('ENTRY_CONSIDER')&&v.includes('REJECTED_RISK')).map(([k])=>k).pop();
const NOW=T+10000;
const UNIVERSE=UV.rank(Object.fromEntries(SYMS.map(s=>[s,DAILY_VOL[s]])));
const CANDLES=Object.fromEntries(Object.entries(RAW).map(([s,r])=>[s,r.filter(k=>k[0]<=NOW).slice(-1500).map(Cy.toCandle)]));
const expect=Cy.buildState({rawBySymbol:CANDLES,now:NOW,frozen:FROZEN,symbols:SYMS,gate:{fromMs:T,allowed:new Set(UNIVERSE.map(x=>x.symbol))}});
const VIEW=Cy.toView(expect);
// R36: jurnal hanya berisi sinyal yang masuk Decision saat aplikasi berjalan. Skenario utama: aplikasi dianggap sudah
// terbuka di setiap close sebelumnya → SEED = ledger yang dibekukan close demi close (disimpan di localStorage sebelum dibuka).
const RANKS=Object.fromEntries(UNIVERSE.map(x=>[x.symbol,x.rank]));
const SEED=LG.empty();for(const t of [...new Set(VIEW.history.map(r=>Date.parse(r.decision_available_utc)))].filter(t=>t<T).sort((a,b)=>a-b))
  LG.freeze(SEED,VIEW.history.filter(r=>Date.parse(r.decision_available_utc)===t),{regimes:VIEW.regimes,ranks:RANKS,currentT:t,now:t});
const SEED_JSON=JSON.stringify(SEED);
const LEDGER=LG.load(JSON.parse(SEED_JSON));LG.freeze(LEDGER,VIEW.history,{regimes:VIEW.regimes,ranks:RANKS,currentT:T,now:NOW});
LG.resolve(LEDGER,CANDLES,NOW);
const CURRENT=Object.values(LEDGER.entries).filter(e=>e.decisionMs===T);
const ACTIVE=LG.active(LEDGER,NOW),FINISHED=LG.finished(LEDGER);
// R37 panel risiko (hitungan independen dari jurnal): posisi aktif, risiko terbuka, drawdown dari puncak, hasil kumulatif.
function riskOf(rp){const act=ACTIVE,open=act.filter(x=>x.outcome.code==='OPEN');
  const openRiskPct=open.reduce((s,x)=>s+(x.outcome.tp1AtMs?1-x.tp1Frac:1),0)*rp;
  let cum=0,peak=0;for(const x of FINISHED.filter(x=>Number.isFinite(x.outcome.r)&&Number.isFinite(x.outcome.atMs)).sort((a,b)=>a.outcome.atMs-b.outcome.atMs)){cum+=x.outcome.r*rp;peak=Math.max(peak,cum);}
  return {positions:act.length,openRiskPct,ddPct:peak-cum,cumPct:cum};}
// R39 data Detail Pair tiruan (deterministik): premiumIndex + 42 baris statistik 4 jam per jenis.
const PREMIUM=sym=>{const c=RAW[sym]?Number(RAW[sym].find(k=>k[0]===T)[4]):1;return {symbol:sym,markPrice:String(c*1.0002),indexPrice:String(c),lastFundingRate:'0.00012',nextFundingTime:T+4*3600e3};};
const FDATA=(kind,sym)=>Array.from({length:42},(_,k)=>{const ts=T-(41-k)*4*3600e3,v=0.8+0.01*k;
  if(kind==='openInterestHist')return {symbol:sym,sumOpenInterest:String(1000+k),sumOpenInterestValue:String(1e6+1e4*k),timestamp:ts};
  if(kind==='takerlongshortRatio')return {buySellRatio:String(v),buyVol:String(100*v),sellVol:'100',timestamp:ts};
  return {symbol:sym,longShortRatio:String(v+(kind==='topLongShortPositionRatio'?0.5:kind==='topLongShortAccountRatio'?0.25:0)),longAccount:String(v/(1+v)),shortAccount:String(1/(1+v)),timestamp:ts};});
const coreOnly=Cy.buildState({rawBySymbol:Object.fromEntries(C.PAIRS.map(s=>[s,RAW[s].filter(k=>k[0]<=NOW).slice(-1500).map(Cy.toCandle)])),now:NOW,frozen:FROZEN});

// exchangeInfo tiruan (format resmi: filter terpisah) untuk rencana siap salin R32.
const TICK={BTCUSDT:'0.10',ETHUSDT:'0.01',SOLUSDT:'0.0100',BNBUSDT:'0.010',DOGEUSDT:'0.000010',XRPUSDT:'0.0001',AAAUSDT:'0.10',BBBUSDT:'0.01',CCCUSDT:'0.001',DDDUSDT:'0.010',EEEUSDT:'0.000001',FFFUSDT:'0.0001',USDCUSDT:'0.0001',OLDUSDT:'0.001'};
const EI={symbols:[...SYMS,'USDCUSDT','OLDUSDT'].map(s=>({symbol:s,contractType:'PERPETUAL',quoteAsset:'USDT',baseAsset:s.replace(/USDT$/,''),underlyingType:'COIN',status:s==='OLDUSDT'?'SETTLING':'TRADING',
  filters:[{filterType:'PRICE_FILTER',tickSize:TICK[s],minPrice:'0.000001',maxPrice:'1000000'},{filterType:'LOT_SIZE',stepSize:'0.001',minQty:'0.001',maxQty:'1000000'},{filterType:'MIN_NOTIONAL',notional:'5'}]}))};
const RULES=X.parseRules(EI,SYMS);for(const x of UNIVERSE)RULES[x.symbol].rank=x.rank;
const DAY=UV.DAY,DAYSTART=UV.dayStartOf(NOW);
const dailyRows=s=>[[DAYSTART-2*DAY,1,1,1,1,1,DAYSTART-DAY-1,String(DAILY_VOL[s]*0.9)],[DAYSTART-DAY,1,1,1,1,1,DAYSTART-1,String(DAILY_VOL[s])],[DAYSTART,1,1,1,1,1,DAYSTART+DAY-1,'5']];
const TICKER=[...SYMS,'USDCUSDT','OLDUSDT'].map(s=>({symbol:s,quoteVolume:String(DAILY_VOL[s]),lastPrice:String(RAW[s]?RAW[s].find(k=>k[0]===T)[4]:1),priceChangePercent:'0.5'}));
const isMultiple=(str,step)=>{const dec=Math.max((str.split('.')[1]||'').length,(step.split('.')[1]||'').length),toInt=v=>{const [a,b='']=v.split('.');return BigInt(a+b.padEnd(dec,'0'));};return toInt(str)%toInt(step)===0n;};
const OUTSIDE=[];   // permintaan candle untuk pair di luar universe (harus kosong)
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  let f=path.join(SITE,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/'||req.url.startsWith('/#'))f=path.join(SITE,'index.html');
  if(!f.startsWith(SITE)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',TYPES[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
});

async function setup(browser,viewport,{failSymbol=null,noForming=false,eiFail=false,tickerFail=false,seed=SEED_JSON}={}){
  const context=await browser.newContext({viewport,serviceWorkers:'block',acceptDownloads:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text());});
  await page.clock.setFixedTime(new Date(NOW));
  // WebSocket palsu: ticker 6 pair + aggTrade/depth untuk stream posisi.
  await page.addInitScript(prices=>{
    window.__ws=[];
    window.WebSocket=class{constructor(url){this.url=url;this.readyState=0;window.__ws.push(this);
      setTimeout(()=>{this.readyState=1;this.onopen&&this.onopen();this.pump();},30);}
      pump(){if(this.readyState!==1)return;const u=this.url,send=(stream,data)=>this.onmessage&&this.onmessage({data:JSON.stringify({stream,data})});
        for(const [s,p] of Object.entries(prices)){const l=s.toLowerCase();
          if(u.includes(l+'@ticker'))send(l+'@ticker',{s,c:String(p),P:'0.5'});
          if(u.includes(l+'@aggTrade'))send(l+'@aggTrade',{s,p:String(p),q:'2',m:false,T:Date.now()});
          if(u.includes(l+'@depth20'))send(l+'@depth20@500ms',{s,b:[[String(p*0.999),'5']],a:[[String(p*1.001),'3']]});}
        if(u.includes('!ticker@arr'))send('!ticker@arr',Object.entries(prices).map(([s,p])=>({e:'24hrTicker',s,c:String(p),P:'0.5',q:String(window.__vol[s])})));
        this._t=setTimeout(()=>this.pump(),500);}
      close(){if(this.readyState===3)return;this.readyState=3;clearTimeout(this._t);this.onclose&&this.onclose();}send(){}};
  },Object.fromEntries(Object.entries(RAW).map(([s,r])=>[s,r.find(k=>k[0]===T)[4]])));
  await page.addInitScript(v=>{window.__vol=v;},DAILY_VOL);
  if(seed)await page.addInitScript(j=>{if(!localStorage.getItem('malomo_v7_ledger'))localStorage.setItem('malomo_v7_ledger',j);},seed);
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.route('https://fapi.binance.com/**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/fapi/v1/time')return route.fulfill({json:{serverTime:NOW}});
    if(u.pathname==='/fapi/v1/ticker/24hr')return tickerFail?route.fulfill({status:503,body:'unavailable'}):route.fulfill({json:TICKER});
    if(u.pathname==='/fapi/v1/exchangeInfo')return eiFail?route.fulfill({status:503,body:'unavailable'}):route.fulfill({json:EI});
    if(u.pathname==='/fapi/v1/openInterest')return route.fulfill({json:{symbol:u.searchParams.get('symbol'),openInterest:'12345.6'}});
    if(u.pathname==='/fapi/v1/klines'){
      const s=u.searchParams.get('symbol'),lim=Number(u.searchParams.get('limit'));
      if(s==='USDCUSDT'||s==='OLDUSDT'){OUTSIDE.push(s);return route.fulfill({status:404,body:'di luar universe'});}
      if(u.searchParams.get('interval')==='1d')return route.fulfill({json:dailyRows(s)});
      if(s===failSymbol||failSymbol==='ALL')return route.fulfill({status:503,body:'unavailable'});
      const rows=RAW[s].filter(k=>k[0]<=NOW&&!(noForming&&k[0]===T)).slice(-lim);
      return route.fulfill({json:rows});
    }
    // R39 Detail Pair
    if(u.pathname==='/fapi/v1/premiumIndex')return route.fulfill({json:PREMIUM(u.searchParams.get('symbol'))});
    if(u.pathname.startsWith('/futures/data/'))return route.fulfill({json:FDATA(u.pathname.split('/').pop(),u.searchParams.get('symbol'))});
    return route.fulfill({status:404,body:'not mocked'});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/#decision');
  return {context,page,errors};
}
async function common(page,viewport){
  // Tanpa scroll horizontal di level halaman (UI/UX §4, §8).
  const sw=await page.evaluate(()=>[document.documentElement.scrollWidth,window.innerWidth]);
  assert(sw[0]<=sw[1],`scroll horizontal ${sw[0]} > ${sw[1]} di ${viewport.width}px`);
  const text=await page.evaluate(()=>document.body.innerText);
  for(const m of text.matchAll(/win rate/gi))assert(/bukan\s*$/i.test(text.slice(Math.max(0,m.index-8),m.index)),'"win rate" tanpa "bukan"');
  assert(!/akurasi|probabilitas profit|sinyal pasti/i.test(text));
  assert(!/\bNaN\b|undefined|\[object Object\]/.test(text),'teks rusak (NaN/undefined) di layar');
  assert(!/\b0\.00 \/ 500/.test(text),'null M6 tampil sebagai 0');
}
const nav=async(page,viewport,screen)=>{await page.locator((viewport.width<768?'.tabbar ':'.rail ')+`[data-screen="${screen}"]`).click();};

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  let pass=0;const fails=[];
  const run=async(name,fn)=>{try{await fn();pass++;console.log('PASS '+name);}catch(e){const msg=String(e.message).split('\n')[0];fails.push(name+' — '+msg);console.log('FAIL '+name+' — '+msg);}};
  const SET={capital:'2500',riskPct:'0.75',costBps:'18'};
  try{
    assert(ACTIVE.length>0&&FINISHED.length>20,'skenario harus punya Decision aktif & jurnal ('+ACTIVE.length+'/'+FINISHED.length+')');
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const mob=viewport.width<768;
      const {context,page,errors}=await setup(browser,viewport);
      await run(`[${viewport.width}px] Decision: kartu = ledger engine (hard gate), skor dikunci tampil, status & universe`,async()=>{
        await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:30000});await page.waitForSelector('#dec-list .dec-card',{timeout:30000});
        const keys=await page.locator('#dec-list .dec-card').evaluateAll(n=>n.map(x=>x.dataset.dec));
        assert.deepEqual(keys,ACTIVE.map(x=>x.key));
        for(let i=0;i<ACTIVE.length;i++){const en=ACTIVE[i],card=page.locator('#dec-list .dec-card').nth(i);
          assert.equal(await card.locator('[data-score="m6"]').innerText(),C.display2(en.scores.m6).toFixed(2)+' / 500');
          assert.equal(await card.locator('[data-score="m1m2q"]').innerText(),C.display2(en.scores.m1m2q).toFixed(2)+' / 180');
          const t=await card.innerText();for(const k of ['skor dikunci','OPEN INTEREST','CVD (TAKER)','ORDERBOOK','INVALIDASI','Rencana siap salin'])assert(t.includes(k),'kartu tanpa '+k);}
        assert.equal(await page.locator('#dec-list [data-exec-status="NEED_SETTINGS"]').count(),ACTIVE.length);
        // R37: setiap kartu menampilkan TP1 & TP2 (mandat LIVE) dan panel risiko = hitungan dari jurnal (risiko default 1%).
        for(let i=0;i<ACTIVE.length;i++){const lv=await page.locator('#dec-list .dec-card').nth(i).locator('.dec-lv').innerText();assert(lv.includes('TP1')&&lv.includes('TP2'),'kartu tanpa TP1/TP2');assert(Number.isFinite(ACTIVE[i].target2));}
        // R38: panel = posisi NYATA (belum ada yang diambil, modal belum disimpan); baris pembanding = semua sinyal (R37).
        const RK=riskOf(1);
        assert.equal(await page.locator('[data-risk="positions"] .v').innerText(),'0 / 10');assert.equal(await page.locator('[data-risk="open"] .v').innerText(),'—');
        assert.equal(await page.locator('[data-risk-nocap]').count(),1);
        assert.equal(await page.locator('[data-risk-all]').innerText(),`Pembanding — semua sinyal Malomo (anggap semua diambil @1%): ${RK.positions} posisi · risiko terbuka ${RK.openRiskPct.toFixed(1)}% · drawdown ${RK.ddPct.toFixed(1)}% · kumulatif ${RK.cumPct>=0?'+':''}${RK.cumPct.toFixed(1)}%.`);
        assert((await page.locator('[data-risk-panel]').innerText()).includes('tidak memblokir'));
        assert.equal(await page.locator('#dec-list [data-action="take-open"]').count(),ACTIVE.length);assert.equal(await page.locator('[data-empty="manual"]').count(),1);
        assert((await page.locator('#health').innerText()).includes('Data lengkap'));
        assert.equal(await page.locator('[data-universe]').getAttribute('data-universe'),String(UNIVERSE.length));
        await page.waitForFunction(()=>!/menyambung|memuat/.test(document.querySelector('#dec-list .dec-card .dec-data').innerText),null,{timeout:20000});
        assert(/[+−-]?\d+\.\d\dR/.test(await page.locator('#dec-list .dec-card').first().innerText()),'R live tidak tampil');
        await common(page,viewport);
      });
      await run(`[${viewport.width}px] Rencana siap salin: isi modal → angka = exec engine, kelipatan tick, tersimpan`,async()=>{
        const f=page.locator('.exec-form');if(!(await f.evaluate(el=>el.open)))await f.locator('summary').click();
        assert.equal(await page.locator('#exec-save-status').getAttribute('data-save'),'none');
        // isian tidak sah → tidak disimpan, ditandai
        await f.locator('[data-exec="capital"]').fill('-5');await page.locator('[data-action="save-exec"]').click();
        assert.equal(await page.locator('[data-save="invalid"]').count(),1);assert.equal(await page.evaluate(()=>localStorage.getItem('malomo_v7_exec')),null);
        await page.locator('.exec-form [data-exec="riskPct"]').fill(SET.riskPct);await page.locator('.exec-form [data-exec="capital"]').fill(SET.capital);
        // diketik tetapi belum disimpan → status "Belum disimpan", rencana belum memakai isian
        assert.equal(await page.locator('#exec-save-status').getAttribute('data-save'),'dirty');assert.equal(await page.locator('[data-save-badge]').getAttribute('data-save-badge'),'dirty');
        assert.equal(await page.locator('#dec-list [data-exec-status="NEED_SETTINGS"]').count(),ACTIVE.length);
        await page.locator('[data-action="save-exec"]').click();
        assert.equal(await page.locator('#exec-save-status').getAttribute('data-save'),'saved');
        assert((await page.locator('#exec-save-status').innerText()).includes('Tersimpan'));
        assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('malomo_v7_exec'))).capital,SET.capital);
        await page.waitForSelector('#dec-list [data-exec-status="READY"],#dec-list [data-exec-status="NOT_EXECUTABLE"]',{timeout:10000});
        let split=0;
        for(let i=0;i<ACTIVE.length;i++){const en=ACTIVE[i],pl=X.plan({symbol:en.symbol,side:en.side,entry:en.entry,stop:en.stop,target:en.target,target2:en.target2,tp1Frac:en.tp1Frac},SET,RULES[en.symbol]),card=page.locator('#dec-list .dec-card').nth(i);
          assert.equal(await card.locator('.exec').getAttribute('data-exec-status'),pl.status,en.symbol);if(pl.status!=='READY')continue;
          for(const k of ['entry','stop','target','target2']){const v=await card.locator(`[data-exv="${k}"]`).innerText();assert.equal(v,pl.priceStr[k]);assert(isMultiple(v,TICK[en.symbol]));}
          assert.equal(await card.locator('[data-exv="qty1"]').innerText(),pl.qty1Str);assert.equal(await card.locator('[data-exv="qty2"]').innerText(),pl.qty2Str);split++;
          assert.equal(await card.locator('[data-exv="qty"]').innerText(),pl.qtyStr);assert.equal(await card.locator('[data-exv="lev"]').innerText(),pl.leverage+'×');}
        assert(split>0,'tidak ada rencana TP1/TP2 READY yang diuji');
        // Pembanding memakai risiko tersimpan (0,75%).
        assert((await page.locator('[data-risk-all]').innerText()).includes('@0.75%'));assert.equal(await page.locator('[data-risk-nocap]').count(),0);
        await page.reload();await page.waitForSelector('#dec-list .dec-card');await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:30000});assert.equal(await page.locator('.exec-form [data-exec="capital"]').inputValue(),SET.capital);
        assert.equal(await page.locator('#exec-save-status').getAttribute('data-save'),'saved','setelah reload tetap tersimpan');
        assert.equal(await page.locator('[data-save-badge]').getAttribute('data-save-badge'),'saved','status simpan terlihat di judul form walau form tertutup');
      });
      await run(`[${viewport.width}px] R38 Saya ambil + posisi manual: isian, panel risiko posisi nyata, tutup, jurnal`,async()=>{
        const cap=Number(SET.capital);
        // 1) Saya ambil pada kartu pertama yang masih berjalan: isian terisi dari rencana, simpan → tanda Diambil + panel.
        const idx=ACTIVE.findIndex(x=>x.outcome.code==='OPEN');assert(idx>=0,'tidak ada sinyal berjalan');const en=ACTIVE[idx];
        const pl=X.plan({symbol:en.symbol,side:en.side,entry:en.entry,stop:en.stop,target:en.target,target2:en.target2,tp1Frac:en.tp1Frac},SET,RULES[en.symbol]);
        await page.locator(`[data-action="take-open"][data-key="${en.key}"]`).click();await page.waitForSelector('[data-sheet="take"]');
        assert.equal(await page.locator('#sheet [data-sh="entry"]').inputValue(),pl.priceStr?pl.priceStr.entry:String(en.entry));
        if(pl.qtyStr)assert.equal(await page.locator('#sheet [data-sh="qty"]').inputValue(),pl.qtyStr);
        await page.locator('#sheet [data-sh="qty"]').fill('0');await page.locator('[data-action="take-save"]').click();
        assert.equal(await page.locator('#sheet .exf.bad').count(),1,'qty 0 ditolak');
        await page.waitForTimeout(1200);assert.equal(await page.locator('#sheet [data-sh="qty"]').inputValue(),'0','isian tidak terhapus oleh pembaruan per detik');
        await page.locator('#sheet [data-sh="qty"]').fill('2');await page.locator('#sheet [data-sh="entry"]').fill(String(en.entry));await page.locator('[data-action="take-save"]').click();
        await page.waitForSelector(`[data-taken="${en.key}"]`);assert(await page.locator('#sheet').isHidden());
        const r1=2*Math.abs(en.entry-en.stop)*(en.outcome.tp1AtMs?0.5:1);
        assert.equal(await page.locator('[data-risk="positions"] .v').innerText(),'1 / 10');assert.equal(await page.locator('[data-risk="open"] .v').innerText(),(100*r1/cap).toFixed(1)+'%');
        const stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('malomo_v7_ledger'))).entries[en.key].taken;assert.equal(stored.qty,2);assert.equal(stored.entry,en.entry);
        // 2) Posisi manual: input salah ditandai, lalu posisi sah → kartu MANUAL + panel 2 posisi.
        const ms='CCCUSDT',mp=RAW[ms]?Number(RAW[ms].find(k=>k[0]===T)[4]):100;
        await page.locator('[data-action="man-open"]').click();await page.waitForSelector('[data-sheet="manual"]');
        await page.locator('#sheet [data-sh="symbol"]').fill(ms);await page.locator('#sheet [data-sh="entry"]').fill(String(mp));await page.locator('#sheet [data-sh="stop"]').fill(String(mp*1.05));
        await page.locator('#sheet [data-sh="qty"]').fill('3');await page.locator('[data-action="man-save"]').click();
        assert.equal(await page.locator('#sheet .exf.bad').count(),1,'SL di sisi salah ditolak');
        await page.locator('#sheet [data-sh="stop"]').fill(String(mp*0.95));await page.locator('[data-action="man-save"]').click();
        await page.waitForSelector('#man-list [data-man]');
        assert.equal(await page.locator('[data-risk="positions"] .v').innerText(),'2 / 10');
        assert.equal(await page.locator('[data-risk="open"] .v').innerText(),((100*(r1+3*mp*0.05))/cap).toFixed(1)+'%');
        // 3) Tutup sendiri di harga +2% → masuk jurnal manual, panel kembali 1 posisi, hasil = 3·(0,02·mp) − biaya.
        await page.locator('#man-list [data-action="man-close-open"]').click();await page.waitForSelector('[data-sheet="close"]');
        await page.locator('#sheet [data-sh="exit"]').fill(String(mp*1.02));await page.locator('[data-action="man-close-save"]').click();
        await page.waitForSelector('[data-empty="manual"]');assert.equal(await page.locator('[data-risk="positions"] .v').innerText(),'1 / 10');
        const want=3*(mp*1.02-mp)-Number(SET.costBps)/1e4*3*mp;
        assert((await page.locator('[data-risk="cum"] .sub,[data-risk="cum"] .muted').first().innerText()).includes((want>=0?'+':'')+want.toFixed(2)+' USDT'));
        await nav(page,viewport,'jurnal');await page.waitForSelector('[data-man-sum]');assert.equal(await page.locator('tr[data-mrow]').count(),1);
        await page.selectOption('[data-jf="taken"]','yes');
        assert.equal(await page.locator('tr[data-jrow]').count(),FINISHED.some(x=>x.key===en.key)?1:0);await page.selectOption('[data-jf="taken"]','');
        const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="download-manual"]').click()]);
        assert(fs.readFileSync(await dl.path(),'utf8').includes('USER_CLOSE'));
        await nav(page,viewport,'decision');await page.waitForSelector('#dec-list .dec-card');
        // 4) Batal ambil → panel kosong lagi
        page.once('dialog',d=>d.accept());await page.locator(`[data-taken="${en.key}"] [data-action="untake"]`).click();
        await page.waitForSelector(`[data-action="take-open"][data-key="${en.key}"]`);assert.equal(await page.locator('[data-risk="positions"] .v').innerText(),'0 / 10');
        await common(page,viewport);
      });
      await run(`[${viewport.width}px] R39 Detail Pair: klik dari Semua Pair / Decision / Jurnal → 8 bagian, EMA = engine Node, data Binance, tutup`,async()=>{
        const L2=require('../app/labels');
        await nav(page,viewport,'pairs');await page.waitForSelector('#pairs-body tr[data-pair]');
        const sym=UNIVERSE[0].symbol;
        await page.locator(`#pairs-body tr[data-pair="${sym}"] [data-action="pair"]`).click();
        await page.waitForSelector(`[data-detail="${sym}"]`);assert.equal(await page.evaluate(()=>location.hash),'#pairs','klik pair tidak berpindah layar');
        for(const k of ['market','ema','funding','oi','ls','book','malomo','rules'])assert.equal(await page.locator(`[data-dsec="${k}"]`).count(),1,'bagian '+k);
        // EMA = hitungan Node atas candle yang sama
        await page.waitForSelector('[data-chart]',{timeout:15000});
        const em=PI.emaInfo(CANDLES[sym],NOW);
        for(const n of [21,30,50]){const t=await page.locator(`[data-dv="ema${n}"]`).innerText();assert(t.startsWith(L2.price(em.last[n])),`EMA${n} ${t} vs ${L2.price(em.last[n])}`);}
        assert.equal(await page.locator('[data-chart] path[data-ema]').count(),3);assert.equal(await page.locator('[data-chart] rect.body').count(),em.chart.candles.length);
        // data Binance (tiruan deterministik)
        await page.waitForSelector('[data-dv="gls"] .mono');
        const want=PI.ratio(FDATA('globalLongShortAccountRatio',sym));assert((await page.locator('[data-dv="gls"]').innerText()).startsWith(want.last.toFixed(2)));
        assert((await page.locator('[data-dv="tlp"]').innerText()).startsWith(PI.ratio(FDATA('topLongShortPositionRatio',sym)).last.toFixed(2)));
        assert((await page.locator('[data-dv="taker"]').innerText()).includes('beli'));
        assert((await page.locator('[data-dv="funding"]').innerText()).includes('+0.0120%'));
        assert((await page.locator('[data-dv="oi"]').innerText()).includes(L2.compactUsd(1e6+1e4*41)));
        assert((await page.locator('[data-dsec="rules"]').innerText()).includes(TICK[sym]));
        // hover grafik → tooltip candle
        const box=await page.locator('[data-chart]').boundingBox();await page.mouse.move(box.x+box.width*0.5,box.y+box.height*0.5);
        await page.waitForSelector('#dt-tip:not([hidden])');assert((await page.locator('#dt-tip').innerText()).includes('EMA21'));
        // live: harga tampil dan diperbarui tanpa menutup panel
        assert.notEqual(await page.locator('[data-dv="price"]').innerText(),'—');
        await common(page,viewport);
        await page.keyboard.press('Escape');assert(await page.locator('#detail').isHidden());
        // dari kartu Decision: status Decision + skor
        await nav(page,viewport,'decision');await page.waitForSelector('#dec-list .dec-card');
        const en=ACTIVE[0];await page.locator(`[data-dec="${en.key}"] [data-action="pair"]`).click();await page.waitForSelector(`[data-detail="${en.symbol}"]`);
        assert.equal(await page.locator('[data-dv="status"]').innerText(),'Decision');assert(await page.locator('[data-dv="dec"]').count()>=1);
        await page.locator('.detail [data-action="detail-close"]').first().click();assert(await page.locator('#detail').isHidden());
        // dari Jurnal
        await nav(page,viewport,'jurnal');await page.waitForSelector('tr[data-jrow]');
        const js=await page.locator('tr[data-jrow] [data-action="pair"]').first().getAttribute('data-sym');
        await page.locator('tr[data-jrow] [data-action="pair"]').first().click();await page.waitForSelector(`[data-detail="${js}"]`);
        await page.keyboard.press('Escape');await nav(page,viewport,'decision');await page.waitForSelector('#dec-list .dec-card');
      });
      await run(`[${viewport.width}px] Semua Pair: universe realtime, stablecoin/non-TRADING tersaring, M1 = engine, filter & urut`,async()=>{
        await nav(page,viewport,'pairs');await page.waitForSelector('#pairs-body tr[data-pair]');
        const syms=await page.locator('#pairs-body tr[data-pair]').evaluateAll(n=>n.map(x=>x.dataset.pair));
        assert.deepEqual(syms,UNIVERSE.map(x=>x.symbol));assert(!syms.includes('USDCUSDT')&&!syms.includes('OLDUSDT'));
        const m1=new Map(expect.pairRows.map(r=>[r.symbol,r.m1]));
        for(const s of syms){const v=await page.locator(`#pairs-body tr[data-pair="${s}"] [data-m1]`).innerText();const w=m1.get(s);assert.equal(v,Number.isFinite(w)?C.display2(w).toFixed(2)+' / 100':'—',s);}
        await page.selectOption('[data-pf="sort"]','m1');const sorted=await page.locator('#pairs-body tr[data-pair]').evaluateAll(n=>n.map(x=>x.dataset.pair));
        const want=[...UNIVERSE].sort((a,b)=>((Number.isFinite(m1.get(b.symbol))?m1.get(b.symbol):-1)-(Number.isFinite(m1.get(a.symbol))?m1.get(a.symbol):-1))||a.rank-b.rank).map(x=>x.symbol);assert.deepEqual(sorted,want);
        await page.selectOption('[data-pf="status"]','DECISION');assert.deepEqual((await page.locator('#pairs-body tr[data-pair]').evaluateAll(n=>n.map(x=>x.dataset.pair))).sort(),[...new Set(ACTIVE.map(x=>x.symbol))].sort());
        await page.selectOption('[data-pf="status"]','');await page.selectOption('[data-pf="sort"]','rank');
        await common(page,viewport);
      });
      await run(`[${viewport.width}px] Jurnal: baris & ringkasan = ledger, filter, unduh CSV lengkap`,async()=>{
        await nav(page,viewport,'jurnal');await page.waitForSelector('[data-jstat="n"]');
        const sm=LG.summary(FINISHED);
        assert.equal(await page.locator('[data-jstat="n"] .v').innerText(),String(sm.n));assert.equal(await page.locator('[data-jstat="tp"] .v').innerText(),String(sm.TARGET_HIT));
        assert.equal(await page.locator('[data-jstat="sl"] .v').innerText(),String(sm.STOP_HIT));assert.equal(await page.locator('[data-jstat="tp1"] .v').innerText(),String(sm.TP1_STOP+sm.TP1_HORIZON));assert.equal(await page.locator('[data-jstat="avg"] .v').innerText(),(sm.avgR>=0?'+':'')+sm.avgR.toFixed(3));
        assert.equal(await page.locator('tr[data-jrow]').count(),Math.min(300,FINISHED.length));
        await page.selectOption('[data-jf="outcome"]','STOP_HIT');assert.equal(await page.locator('tr[data-jrow]').count(),Math.min(300,FINISHED.filter(x=>x.outcome.code==='STOP_HIT').length));
        const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="download-journal"]').click()]);
        const csv=fs.readFileSync(await dl.path(),'utf8').replace(/^﻿/,'').trim().split('\r\n');
        assert.equal(csv[0],LG.COLS.join(','));assert.equal(csv.length-1,FINISHED.filter(x=>x.outcome.code==='STOP_HIT').length);assert(csv.slice(1).every(l=>l.includes('kena SL')));
        await page.selectOption('[data-jf="outcome"]','');await page.locator('[data-jf="m6min"]').fill('9999');await page.locator('[data-jf="m6min"]').press('Tab');
        assert.equal(await page.locator('[data-empty="jurnal"]').count(),1);await page.locator('[data-jf="m6min"]').fill('');await page.locator('[data-jf="m6min"]').press('Tab');
        await common(page,viewport);
      });
      if(mob)await run('[390px] Navigasi mobile: 3 tab bawah, rail tersembunyi',async()=>{
        assert(await page.locator('.tabbar').isVisible());assert(!(await page.locator('.rail').isVisible()));assert.equal(await page.locator('.tabbar a').count(),3);
      });
      await run(`[${viewport.width}px] Layar lama terhapus, tanpa error JavaScript / tombol order / unduh log audit`,async()=>{
        assert.equal(await page.locator('[data-screen="siklus"],[data-screen="event"],[data-screen="portofolio"],[data-screen="pasar"],[data-screen="audit"],#stepper,#inspector,[data-action="download-audit"]').count(),0);
        assert.deepEqual(errors,[]);assert.deepEqual(OUTSIDE,[],'candle pair di luar universe diunduh');
        const btn=await page.locator('button,a').allInnerTexts();assert(!btn.some(b=>/^(beli|jual|buy|sell|order|long now|short now)$/i.test(b.trim())));
      });
      await context.close();
    }
    await run('SKOR DIKUNCI: semua candle diubah lalu dihitung ulang → skor & harga Decision tidak berubah; ledger tersimpan setelah reload',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900});
      await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:30000});await page.waitForSelector('#dec-list .dec-card',{timeout:30000});
      const snap=()=>page.evaluate(()=>JSON.stringify(Object.values(MalomoApp.app.ledger.entries).map(e=>[e.key,e.scores,e.entry,e.stop,e.target,e.decisionMs])));
      const before=new Map(JSON.parse(await snap()).map(x=>[x[0],x]));
      const cardText=()=>page.locator('#dec-list .dec-card').evaluateAll(n=>Object.fromEntries(n.map(x=>[x.dataset.dec,x.querySelector('.dec-scores').innerText+' | '+x.querySelector('.dec-lv').innerText])));
      const cardsBefore=await cardText();
      const recomputed=await page.evaluate(async()=>{const a=MalomoApp.app;for(const s of Object.keys(a.raw))a.raw[s]=a.raw[s].map(c=>Object.assign({},c,{close:c.close*1.07,high:c.high*1.07,low:c.low*0.93,volume:c.volume*3}));
        await MalomoApp.rebuildNow();return a.state.history.filter(r=>r.status==='ENTRY_CONSIDER').map(r=>[r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc,r.scores.m6_confluense_500]);});
      // engine memang menghasilkan skor lain atas data yang diubah …
      const differs=recomputed.filter(([k,m6])=>before.has(k)&&before.get(k)[1].m6!==m6).length;
      assert(differs>0,'uji tidak bermakna: skor engine tidak berubah');
      // … tetapi entri ledger yang sudah ada tidak berubah sedikit pun
      for(const x of JSON.parse(await snap()))if(before.has(x[0]))assert.deepEqual(x,before.get(x[0]),'entri berubah: '+x[0]);
      const cardsAfter=await cardText();for(const k of Object.keys(cardsBefore))assert.equal(cardsAfter[k],cardsBefore[k],'kartu berubah: '+k);
      await page.reload();await page.waitForSelector('#dec-list .dec-card');
      const stored=await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('malomo_v7_ledger')).entries).length);assert(stored>=ACTIVE.length,'ledger tersimpan '+stored);
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('R36 pertama dibuka (penyimpanan kosong): hanya Decision close berjalan yang tercatat, jurnal kosong (tanpa replay)',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{seed:null});
      await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:30000});
      const keys=await page.evaluate(()=>Object.keys(MalomoApp.app.ledger.entries).sort());
      assert.deepEqual(keys,CURRENT.map(e=>e.key).sort());assert(keys.length>0);
      await page.evaluate(()=>location.hash='jurnal');await page.waitForSelector('[data-empty="jurnal"]');
      assert((await page.locator('[data-empty="jurnal"]').innerText()).includes('dicatat otomatis'));
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('R36 migrasi: entri "replay" dari versi sebelumnya dibuang dari jurnal saat dibuka',async()=>{
      const old=JSON.parse(SEED_JSON);for(const e of Object.values(old.entries))e.source='replay';
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{seed:JSON.stringify(old)});
      await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:30000});
      assert.deepEqual(await page.evaluate(()=>Object.keys(MalomoApp.app.ledger.entries).sort()),CURRENT.map(e=>e.key).sort());
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('FETCH_FAILED: pair penentu gagal → indikator kuning, tidak ada Decision baru di close ini',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{failSymbol:CURRENT[0].symbol});
      await page.waitForFunction(()=>/FETCH_FAILED/.test(document.getElementById('health').innerText),null,{timeout:30000});
      await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:30000});
      assert.equal(await page.evaluate(T=>Object.values(MalomoApp.app.ledger.entries).filter(e=>e.decisionMs===T).length,T),0);
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('Universe gagal (ticker/24hr gagal & stream kosong) → peringatan, hanya 6 pair inti',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{tickerFail:true});
      await page.addInitScript(()=>{});
      await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:120000});
      const u=await page.evaluate(()=>MalomoApp.app.universe);
      if(u.source==='core'){assert((await page.locator('#universe').innerText()).includes('Universe 100 pair belum bisa ditetapkan'));assert.deepEqual(Object.keys(await page.evaluate(()=>MalomoApp.app.raw)).sort(),[...C.PAIRS].sort());}
      else assert.equal(u.list.length,UNIVERSE.length,'stream !ticker@arr mengisi universe walau REST gagal');
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('exchangeInfo gagal → universe 6 pair inti + peringatan; rencana "belum dibulatkan" tanpa tombol salin',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{eiFail:true});
      await page.evaluate(()=>localStorage.setItem('malomo_v7_exec',JSON.stringify({capital:'1000',riskPct:'0.5',costBps:'18'})));
      await page.reload();
      await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:150000});
      assert((await page.locator('#universe').innerText()).includes('Universe 100 pair belum bisa ditetapkan'));
      if(await page.locator('#dec-list .exec').count()){assert.equal(await page.locator('#dec-list .exec[data-exec-status="UNROUNDED"]').count(),await page.locator('#dec-list .exec').count());
        assert.equal(await page.locator('#dec-list [data-action="copy-val"]').count(),0);}
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('Fase CLOSE_CANDIDATE: open berikutnya belum ada → tidak ada Decision untuk close itu',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{noForming:true});
      await page.waitForFunction(()=>MalomoApp.app.state,null,{timeout:30000});
      assert.equal(await page.evaluate(T=>Object.values(MalomoApp.app.ledger.entries).filter(e=>e.decisionMs===T).length,T),0);
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('Semua pair gagal saat pertama dibuka → pesan FETCH_FAILED, tanpa skor palsu',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{failSymbol:'ALL'});
      await page.waitForFunction(()=>/FETCH_FAILED/.test(document.getElementById('health').innerText),null,{timeout:30000});
      const t=await page.locator('main').innerText();assert(t.includes('belum berhasil diambil'));assert(!/\/ 500/.test(t));
      assert.deepEqual(errors,[]);await context.close();
    });
  }finally{await browser.close();server.close();}
  console.log(`\n${pass} PASS, ${fails.length} FAIL`);
  if(process.env.GITHUB_ACTIONS==='true')for(const f of fails)console.log('::error::Uji browser gagal: '+f.slice(0,300));
  process.exit(fails.length?1:0);
})();
