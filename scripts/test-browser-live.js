'use strict';
/* Uji ujung-ke-ujung di Chromium dengan DATA BINANCE ASLI (tanpa mock): situs _site/ dibuka, aplikasi mengambil
   kline/OI lewat REST dan harga lewat WebSocket Binance sungguhan. Keluar 3 bila Binance menolak lokasi server uji. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let pw;try{pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch{pw=require('/opt/npm-tools/node_modules/playwright');}
const SITE=path.resolve(__dirname,'..','_site');
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let f=path.join(SITE,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/'||req.url.startsWith('/#'))f=path.join(SITE,'index.html');
  if(!f.startsWith(SITE)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',TYPES[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
(async()=>{
  try{const r=await fetch('https://fapi.binance.com/fapi/v1/time');if(r.status===451||r.status===403){console.log('::warning::Binance menolak lokasi server uji (HTTP '+r.status+')');process.exit(3);}}catch(e){console.log('::warning::Binance tidak terjangkau: '+e.message);process.exit(3);}
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await pw.chromium.launch({headless:true,args:['--no-sandbox']});
  let pass=0;const fails=[];
  const run=async(n,fn)=>{try{const r=await fn();pass++;console.log('PASS '+n+(r?' — '+r:''));}catch(e){fails.push(n);console.log('FAIL '+n+' — '+String(e.message).split('\n')[0]);}};
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const ctx=await browser.newContext({viewport,serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.goto('http://127.0.0.1:'+server.address().port+'/#siklus');
      const sel=viewport.width<768?'.tabbar':'.rail';
      await run(`[${viewport.width}px] Siklus dari data asli tersusun, data lengkap`,async()=>{
        await page.waitForSelector('[data-count="ENTRY_CONSIDER"]',{timeout:90000});
        const h=await page.locator('#health').innerText();assert(/Data lengkap/.test(h),'kesehatan data: '+h);
        const t=await page.locator('main').innerText();assert(!/NaN|undefined/.test(t));
        return (await page.locator('main h2').first().innerText());
      });
      await run(`[${viewport.width}px] Lima layar tampil tanpa error`,async()=>{
        for(const sc of ['event','portofolio','pasar','audit','siklus']){await page.locator(sel+` [data-screen="${sc}"]`).click();await page.waitForTimeout(700);
          const t=await page.locator('main').innerText();assert(t.length>50&&!/NaN|undefined|\[object Object\]/.test(t),sc);}
        await page.locator(sel+' [data-screen="pasar"]').click();await page.waitForSelector('.chart svg');assert.equal(await page.locator('.chart svg').count(),6);
        await page.locator(sel+' [data-screen="audit"]').click();await page.waitForSelector('[data-action="download-audit"]');
        const a=await page.locator('main').innerText();assert.equal((a.match(/cocok manifest/g)||[]).length,2,'hash normalisasi');
      });
      await run(`[${viewport.width}px] WebSocket ticker Binance tersambung`,async()=>{
        await page.waitForFunction(()=>MalomoApp.ticker&&MalomoApp.ticker.isLive(),null,{timeout:30000});
        return await page.evaluate(()=>Object.entries(MalomoApp.ticker.prices).map(([s,p])=>s+' '+p.price).join(', '));
      });
      await run(`[${viewport.width}px] Tanpa error JavaScript`,async()=>{assert.deepEqual(errors,[]);});
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
  console.log(`\n${pass} PASS, ${fails.length} FAIL`);for(const f of fails)console.log('::error::Uji browser data asli gagal: '+f);
  process.exit(fails.length?1:0);
})();
