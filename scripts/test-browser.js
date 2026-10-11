'use strict';
/* Uji bug di browser (Chromium headless) sebelum live: situs _site/ dilayani lokal, Binance REST & WebSocket di-mock
   dengan data sintetis deterministik. Diuji di desktop 1440 px dan mobile 390 px, ditambah skenario FETCH_FAILED dan
   fase CLOSE_CANDIDATE. Mencakup daftar periksa penerimaan UI/UX §8. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let pw;try{pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch{pw=require('/opt/npm-tools/node_modules/playwright');}
const {chromium}=pw;
const ROOT=path.resolve(__dirname,'..'),SITE=path.join(ROOT,'_site');
const C=require('../engine/core'),M2=require('../engine/m2'),Cy=require('../app/cycle'),X=require('../app/exec'),S=require('./synthetic');
const H4=C.H4;
if(!fs.existsSync(path.join(SITE,'index.html'))){console.error('Jalankan node scripts/build-site.js dulu');process.exit(1);}
const FROZEN=M2.frozenFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'evidence/frozen_v2_normalizations.json'),'utf8')));
const RAW=S.generate({n:1600});
// Pilih close dengan ENTRY_CONSIDER + REJECTED_RISK, sekaligus ada posisi aktif saat itu.
const lastOpen=RAW.BTCUSDT[RAW.BTCUSDT.length-1][0];
const full=Cy.buildState({rawBySymbol:Object.fromEntries(Object.entries(RAW).map(([s,r])=>[s,r.map(Cy.toCandle)])),now:lastOpen+10000,frozen:FROZEN});
const byT=new Map();for(const r of full.history){const k=Date.parse(r.decision_available_utc);if(!byT.has(k))byT.set(k,[]);byT.get(k).push(r.status);}
const T=[...byT.entries()].filter(([,v])=>v.includes('ENTRY_CONSIDER')&&v.includes('REJECTED_RISK')).map(([k])=>k).pop();
const NOW=T+10000;
const expect=Cy.buildState({rawBySymbol:Object.fromEntries(Object.entries(RAW).map(([s,r])=>[s,r.filter(k=>k[0]<=NOW).slice(-1500).map(Cy.toCandle)])),now:NOW,frozen:FROZEN});

// exchangeInfo tiruan (format resmi: filter terpisah) untuk rencana siap salin R32.
const TICK={BTCUSDT:'0.10',ETHUSDT:'0.01',SOLUSDT:'0.0100',BNBUSDT:'0.010',DOGEUSDT:'0.000010',XRPUSDT:'0.0001'};
const EI={symbols:C.PAIRS.map(s=>({symbol:s,status:'TRADING',filters:[{filterType:'PRICE_FILTER',tickSize:TICK[s],minPrice:'0.000001',maxPrice:'1000000'},
  {filterType:'LOT_SIZE',stepSize:'0.001',minQty:'0.001',maxQty:'1000000'},{filterType:'MIN_NOTIONAL',notional:'5'}]}))};
const RULES=X.parseRules(EI,C.PAIRS);
const isMultiple=(str,step)=>{const dec=Math.max((str.split('.')[1]||'').length,(step.split('.')[1]||'').length),toInt=v=>{const [a,b='']=v.split('.');return BigInt(a+b.padEnd(dec,'0'));};return toInt(str)%toInt(step)===0n;};
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  let f=path.join(SITE,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/'||req.url.startsWith('/#'))f=path.join(SITE,'index.html');
  if(!f.startsWith(SITE)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',TYPES[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
});

async function setup(browser,viewport,{failSymbol=null,noForming=false,eiFail=false}={}){
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
        this._t=setTimeout(()=>this.pump(),500);}
      close(){if(this.readyState===3)return;this.readyState=3;clearTimeout(this._t);this.onclose&&this.onclose();}send(){}};
  },Object.fromEntries(Object.entries(RAW).map(([s,r])=>[s,r.find(k=>k[0]===T)[4]])));
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.route('https://fapi.binance.com/**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/fapi/v1/time')return route.fulfill({json:{serverTime:NOW}});
    if(u.pathname==='/fapi/v1/exchangeInfo')return eiFail?route.fulfill({status:503,body:'unavailable'}):route.fulfill({json:EI});
    if(u.pathname==='/fapi/v1/openInterest')return route.fulfill({json:{symbol:u.searchParams.get('symbol'),openInterest:'12345.6'}});
    if(u.pathname==='/fapi/v1/klines'){
      const s=u.searchParams.get('symbol'),lim=Number(u.searchParams.get('limit'));
      if(s===failSymbol||failSymbol==='ALL')return route.fulfill({status:503,body:'unavailable'});
      const rows=RAW[s].filter(k=>k[0]<=NOW&&!(noForming&&k[0]===T)).slice(-lim);
      return route.fulfill({json:rows});
    }
    return route.fulfill({status:404,body:'not mocked'});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/#siklus');
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
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(fs.existsSync('/opt/pw-browsers/chromium')?undefined:undefined),args:['--no-sandbox']});
  let pass=0;const fails=[];
  const run=async(name,fn)=>{try{await fn();pass++;console.log('PASS '+name);}catch(e){fails.push(name);console.log('FAIL '+name+' — '+String(e.message).split('\n')[0]);}};
  const recsT=expect.cycle.records;
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const mob=viewport.width<768;
      const {context,page,errors}=await setup(browser,viewport);
      await run(`[${viewport.width}px] Siklus 4H: ringkasan & kandidat sama dengan engine`,async()=>{
        await page.waitForSelector('[data-count="ENTRY_CONSIDER"]',{timeout:20000});
        const n=k=>page.locator(`[data-count="${k}"] .v`).innerText();
        const cnt=s=>recsT.filter(r=>r.status===s).length;
        assert.equal(Number(await n('ENTRY_CONSIDER')),cnt('ENTRY_CONSIDER'));assert.equal(Number(await n('REJECTED_RISK')),cnt('REJECTED_RISK'));
        assert.equal(Number(await n('REJECTED_DIRECTION')),cnt('REJECTED_DIRECTION'));
        const sel=mob?'.cand-cards .cand-card':'.cand-table tbody tr';
        assert.equal(await page.locator(sel).count(),recsT.length);
        const first=recsT[0];assert.equal(first.status,'ENTRY_CONSIDER');
        const txt=await page.locator(sel).first().innerText();assert(txt.includes(first.symbol)&&txt.includes(first.side));
        assert(txt.includes(C.display2(first.scores.m6_confluense_500).toFixed(2)+' / 500'),'M6 tidak sesuai engine');
        if(!mob){const head=await page.locator('.cand-table thead').innerText();for(const h of ['#','Pair','Arah','Keluarga','M6 (indeks)','M1 + M2q','Status','Rezim BTC','Alasan','Waktu'])assert(head.includes(h),h);}
        const rej=page.locator(sel).filter({hasText:'Ditolak: risiko'}).first();assert((await rej.innerText()).includes('— / 500'));
        assert(await rej.locator('.bar.null').count()===1,'bar null harus diarsir');
        const clock=await page.locator('#cyclebar').innerText();assert(/UTC · \d\d:\d\d WITA/.test(clock));assert(clock.includes('Data lengkap'));
        await common(page,viewport);
      });
      await run(`[${viewport.width}px] Inspektor: Skor/Rencana/Audit/JSON + versi selalu terlihat`,async()=>{
        await page.locator(mob?'.cand-card':'.cand-table tbody tr').first().click();
        const insp=page.locator('#inspector');await insp.waitFor({state:'visible'});
        let t=await insp.innerText();
        for(const s of ['M6 CONFLUENSE (indeks)','bukan win rate','M1 Struktur','M2 Kualitas','M2 Integritas','M3 Dependensi','M4 Risiko','M5 Validasi','Bukan lima bukti independen','risk_mandate_version RESEARCH_1_3_1X_V1','m5_snapshot M5_AUDIT_2024_CLOSED_BAR_9BPS_V1','normalization_version'])assert(t.includes(s),'Skor tanpa: '+s);
        await insp.locator('[data-tab="rencana"]').click();t=await insp.innerText();
        for(const s of ['Entry referensi (open)','Stop','Target (2R)','Invalidasi','slot lepas','ATR entry (candle konfirmasi)','ATR frozen (sebelum break)','bukan harga order','Rencana siap salin','Isi modal'])assert(t.includes(s),'Rencana tanpa: '+s);
        await insp.locator('[data-tab="audit"]').click();t=await insp.innerText();
        for(const s of ['event_status','score_status','status','Timeline','Konfirmasi','Cek konflik (conflict4)','UNIQUE'])assert(t.includes(s),'Audit tanpa: '+s);
        await insp.locator('[data-tab="json"]').click();
        const j=JSON.parse(await insp.locator('#jsonText').innerText());
        assert.equal(j.schema,'PRD_M1_M6_CONFLUENSE_V1');assert.equal(j.status,'ENTRY_CONSIDER');assert.equal(j.research_only,true);assert(!Object.keys(j).some(k=>k.startsWith('_')));
        const [dl]=await Promise.all([page.waitForEvent('download'),insp.locator('[data-action="download-json"]').click()]);assert(dl.suggestedFilename().endsWith('.json'));
        // Kandidat ditolak: M6 null, alasan berlabel.
        await insp.locator('[data-action="close-insp"]').click();await insp.waitFor({state:'hidden'});
        await page.locator(mob?'.cand-card':'.cand-table tbody tr').filter({hasText:'Ditolak: risiko'}).first().click();
        t=await insp.innerText();assert(t.includes('— / 500')&&t.includes('bukan 0'),'M6 ditolak harus null');assert(t.includes('M4 (audit parsial)'));
        await common(page,viewport);
        await page.keyboard.press('Escape');await insp.waitFor({state:'hidden'});
      });
      await run(`[${viewport.width}px] Filter status menyaring kandidat`,async()=>{
        await page.selectOption('[data-filter="status"]','REJECTED_RISK');
        const sel=mob?'.cand-cards .cand-card':'.cand-table tbody tr';
        assert.equal(await page.locator(sel).count(),recsT.filter(r=>r.status==='REJECTED_RISK').length);
        await page.selectOption('[data-filter="status"]','');assert.equal(await page.locator(sel).count(),recsT.length);
        // R33: label rezim BTC per kandidat = engine; filter "Searah BTC saja" hanya menyaring tampilan.
        const rg=recsT.map(r=>Cy.btcRegime(expect.analyses,r));
        assert.equal(await page.locator(sel+' [data-regime]').count(),rg.filter(Boolean).length);
        for(let i=0;i<recsT.length;i++){const want=rg[i]?rg[i].code:null,got=await page.locator(sel).nth(i).locator('[data-regime]').count()?await page.locator(sel).nth(i).locator('[data-regime]').getAttribute('data-regime'):null;assert.equal(got,want,recsT[i].symbol);}
        const before=await page.locator('[data-count="ENTRY_CONSIDER"] .v').innerText();
        await page.selectOption('[data-filter="btc"]','ALIGNED');
        assert.equal(await page.locator(sel).count(),rg.filter(x=>x&&x.code==='ALIGNED').length);
        assert.equal(await page.locator('[data-count="ENTRY_CONSIDER"] .v').innerText(),before,'filter tampilan tidak boleh mengubah keputusan');
        await page.selectOption('[data-filter="btc"]','');assert.equal(await page.locator(sel).count(),recsT.length);
      });
      await run(`[${viewport.width}px] Papan Event: 5 kolom, kartu menunggu tanpa skor`,async()=>{
        await nav(page,viewport,'event');await page.waitForSelector('.board');
        assert.equal(await page.locator('.board .col').count(),5);
        const w=page.locator('[data-col="Menunggu"] .ev');assert.equal(await w.count(),expect.board.waiting.length);
        for(let i=0;i<await w.count();i++)assert(!(await w.nth(i).innerText()).includes('/ 500'));
        if(expect.board.confirmed.length){await page.locator('[data-col="Terkonfirmasi"] .ev.click').first().click();await page.locator('#inspector').waitFor({state:'visible'});await page.keyboard.press('Escape');}
        await common(page,viewport);
      });
      await run(`[${viewport.width}px] Portofolio: 3 slot, kartu Decision live, meter, log penolakan`,async()=>{
        await nav(page,viewport,'portofolio');await page.waitForSelector('#slots');
        const act=expect.book.active.length;assert(act>0,'skenario harus punya posisi aktif');
        assert.equal(await page.locator('#slots .dec-card').count(),act);assert.equal(await page.locator('#slots .slot-empty').count(),3-act);
        if(act<3)assert((await page.locator('.slot-empty').first().innerText()).includes('kapasitas maksimum, bukan target'));
        await page.waitForFunction(()=>document.querySelector('#slots .dec-card .dec-cell .val')&&!/menyambung|memuat/.test(document.querySelector('#slots .dec-card .dec-data').innerText),null,{timeout:20000});
        const card=await page.locator('#slots .dec-card').first().innerText();
        for(const s of ['RUNNING','SL','ENTRY','TP (2R)','RR','OPEN INTEREST','CVD (TAKER)','ORDERBOOK','SLOT 24 JAM','lepas dalam','Outcome riset','tidak masuk skor'])assert(card.includes(s),'kartu Decision tanpa '+s);
        assert(/[+−-]?\d+\.\d\dR/.test(card),'R-multiple live tidak tampil');
        const pg=await page.locator('main').innerText();for(const s of ['Risiko terbuka','Gross notional','Ekuitas acuan 100 unit, tanpa kompaun','Log penolakan risiko','Posisi selesai (outcome riset)'])assert(pg.includes(s),s);
        await common(page,viewport);
      });
      await run(`[${viewport.width}px] Rencana siap salin R32: kosong → minta modal; isi → angka = engine exec, kelipatan tick, tersimpan`,async()=>{
        assert.equal(await page.locator('#slots .exec[data-exec-status="NEED_SETTINGS"]').count(),expect.book.active.length);
        await page.locator('.exec-form [data-exec="riskPct"]').fill('2');await page.locator('.exec-form [data-exec="riskPct"]').press('Tab');
        assert((await page.locator('.exec-form').innerText()).includes('tidak valid'),'risiko 2% harus ditolak');
        await page.locator('.exec-form [data-exec="riskPct"]').fill('0.75');await page.locator('.exec-form [data-exec="riskPct"]').press('Tab');
        await page.locator('.exec-form [data-exec="capital"]').fill('2500');await page.locator('.exec-form [data-exec="capital"]').press('Tab');
        await page.waitForSelector('#slots .exec[data-exec-status="READY"]',{timeout:10000});
        const set={capital:'2500',riskPct:'0.75',costBps:'18'};
        for(let i=0;i<expect.book.active.length;i++){
          const p=expect.book.active[i],pl=X.plan({symbol:p.symbol,side:p.side,entry:p.entry,stop:p.stop,target:p.target},set,RULES[p.symbol]);
          const card=page.locator('#slots .dec-card').nth(i);
          assert.equal(await card.locator('.exec').getAttribute('data-exec-status'),pl.status,p.symbol);
          if(pl.status!=='READY')continue;
          for(const k of ['entry','stop','target']){const v=await card.locator(`[data-exv="${k}"]`).innerText();assert.equal(v,pl.priceStr[k],p.symbol+' '+k);assert(isMultiple(v,TICK[p.symbol]),v);}
          assert.equal(await card.locator('[data-exv="qty"]').innerText(),pl.qtyStr);
          assert.equal(await card.locator('[data-exv="lev"]').innerText(),pl.leverage+'×');
          assert(pl.lossAtStop<=2500*0.0075+1e-9);
          const vals=await card.locator('.exec [data-action="copy-val"]').evaluateAll(b=>b.map(x=>x.dataset.val));
          assert.deepEqual(vals,[pl.priceStr.entry,pl.priceStr.stop,pl.priceStr.target,pl.qtyStr]);
          const t=await card.locator('.exec').innerText();for(const s of ['Leverage maks aman','Rugi bila SL kena','termasuk biaya','likuidasi','Pasang limit order','tidak mengirim order'])assert(t.includes(s),s);
        }
        // pengaturan tersimpan di browser ini
        await page.reload();await page.waitForSelector('#slots .exec[data-exec-status="READY"]',{timeout:20000});
        assert.equal(await page.locator('.exec-form [data-exec="capital"]').inputValue(),'2500');
        // tab Rencana di inspektor untuk ENTRY_CONSIDER memakai pengaturan yang sama
        await nav(page,viewport,'siklus');await page.locator(mob?'.cand-card':'.cand-table tbody tr').first().click();
        await page.locator('#inspector [data-tab="rencana"]').click();
        const r0=recsT[0],pl0=X.plan({symbol:r0.symbol,side:r0.side,entry:r0.entry_reference_open,stop:r0.stop_price,target:r0.target_price},set,RULES[r0.symbol]);
        assert.equal(await page.locator('#inspector .exec').getAttribute('data-exec-status'),pl0.status);
        if(pl0.status==='READY')assert.equal(await page.locator('#inspector [data-exv="entry"]').innerText(),pl0.priceStr.entry);
        await common(page,viewport);
        await page.keyboard.press('Escape');
      });
      await run(`[${viewport.width}px] Konteks Pasar: 6 chart, tabel M1, heatmap 6×6`,async()=>{
        await nav(page,viewport,'pasar');await page.waitForSelector('.charts');
        assert.equal(await page.locator('.chart svg').count(),6);assert.equal(await page.locator('.heat .c').count(),36);
        const tb=await page.locator('main table').innerText();for(const s of C.PAIRS)assert(tb.includes(s));
        assert(!/RSI|MACD|EMA/.test(await page.locator('main').innerText()),'indikator di luar PRD tampil');
        await common(page,viewport);
      });
      await run(`[${viewport.width}px] Audit & Data: kesehatan, hash cocok manifest, build, unduh log`,async()=>{
        await nav(page,viewport,'audit');await page.waitForSelector('[data-action="download-audit"]');
        const t=await page.locator('main').innerText();
        assert.equal((t.match(/cocok manifest/g)||[]).length,2,'hash normalisasi harus cocok manifest');
        for(const s of ['FROZEN_COMPLETE_TRAIN_ECDF','n=258','n=189','n=44','M5_AUDIT_2024_CLOSED_BAR_9BPS_V1','BREAKOUT_2024_NO_DIRECTION_GATE','Belum diuji engine'])assert(t.includes(s),s);
        const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="download-audit"]').click()]);
        const body=fs.readFileSync(await dl.path(),'utf8').trim().split('\n');assert(body.length>10);body.forEach(l=>JSON.parse(l));
        await common(page,viewport);
      });
      if(mob)await run('[390px] Navigasi mobile: tab bawah tampil, rail tersembunyi',async()=>{
        assert(await page.locator('.tabbar').isVisible());assert(!(await page.locator('.rail').isVisible()));
      });
      await run(`[${viewport.width}px] Tanpa error JavaScript / tombol order`,async()=>{
        assert.deepEqual(errors,[]);
        const btn=await page.locator('button,a').allInnerTexts();assert(!btn.some(b=>/^(beli|jual|buy|sell|order|long now|short now)$/i.test(b.trim())));
      });
      await context.close();
    }
    await run('FETCH_FAILED: pair gagal → indikator kuning, siklus DATA_INCOMPLETE, tanpa ENTRY_CONSIDER',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{failSymbol:'DOGEUSDT'});
      await page.waitForFunction(()=>/FETCH_FAILED/.test(document.getElementById('health').innerText),null,{timeout:20000});
      await page.waitForSelector('.warnbox');
      assert.equal(Number(await page.locator('[data-count="ENTRY_CONSIDER"] .v').innerText()),0);
      assert((await page.locator('#stepper').innerText()).includes('FETCH_FAILED'));
      await page.locator('[data-screen="audit"]').first().click();assert((await page.locator('main').innerText()).includes('Gagal ambil data'));
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('exchangeInfo gagal → rencana tampil "belum dibulatkan", tanpa tombol salin',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{eiFail:true});
      await page.evaluate(()=>localStorage.setItem('malomo_v7_exec',JSON.stringify({capital:'1000',riskPct:'0.5',costBps:'18'})));
      await page.reload();await page.locator('[data-screen="portofolio"]').first().click();
      await page.waitForSelector('#slots .exec[data-exec-status="UNROUNDED"]',{timeout:20000});
      assert.equal(await page.locator('#slots .exec [data-action="copy-val"]').count(),0);
      const t=await page.locator('main').innerText();assert(t.includes('Belum dibulatkan')&&t.includes('jangan disalin sebagai order'));
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('Semua pair gagal saat pertama dibuka → pesan FETCH_FAILED, tanpa skor palsu',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{failSymbol:'ALL'});
      await page.waitForFunction(()=>/FETCH_FAILED/.test(document.getElementById('health').innerText),null,{timeout:20000});
      const t=await page.locator('main').innerText();assert(t.includes('belum berhasil diambil'));assert(!/\/ 500/.test(t));
      assert.deepEqual(errors,[]);await context.close();
    });
    await run('Fase CLOSE_CANDIDATE: open berikutnya belum ada → Rencana "Menunggu open"',async()=>{
      const {context,page,errors}=await setup(browser,{width:1280,height:900},{noForming:true});
      await page.waitForSelector('[data-count="CLOSE_CANDIDATE"]',{timeout:20000});
      assert((await page.locator('#stepper').innerText()).includes('menunggu open'));
      await page.locator('.cand-table tbody tr').filter({hasText:'Kandidat, menunggu open'}).first().click();
      await page.locator('#inspector [data-tab="rencana"]').click();
      assert((await page.locator('#inspector').innerText()).includes('Menunggu open candle berikutnya'));
      assert.deepEqual(errors,[]);await context.close();
    });
  }finally{await browser.close();server.close();}
  console.log(`\n${pass} PASS, ${fails.length} FAIL`);
  process.exit(fails.length?1:0);
})();
