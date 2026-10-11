'use strict';
/* Uji ujung-ke-ujung di Chromium dengan DATA BINANCE ASLI. Dua mode:
   - default: tanpa mock — aplikasi mengambil kline/OI lewat REST dan harga lewat WebSocket Binance sungguhan
     (keluar 3 bila Binance menolak lokasi server uji, mis. HTTP 451 di server AS);
   - ARCHIVE_DIR=data/recent: kline 4H ASLI dari arsip resmi data.binance.vision diputar ulang sebagai respons
     REST pada waktu candle terakhir arsip (untuk server yang diblokir API Binance). */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
let pw;try{pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch{pw=require('/opt/npm-tools/node_modules/playwright');}
const SITE=path.resolve(__dirname,'..','_site');
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let f=path.join(SITE,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/'||req.url.startsWith('/#'))f=path.join(SITE,'index.html');
  if(!f.startsWith(SITE)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',TYPES[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
const ARCH=process.env.ARCHIVE_DIR?path.resolve(process.env.ARCHIVE_DIR):null;
let ROWS=null,NOW=null;
if(ARCH){ROWS={};for(const s of ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT','XRPUSDT'])ROWS[s]=fs.readFileSync(path.join(ARCH,s+'.csv'),'utf8').trim().split('\n').map(l=>l.split(',').map((v,i)=>i===0||i===6||i===8?Number(v):v));
  NOW=ROWS.BTCUSDT[ROWS.BTCUSDT.length-1][0]+10*60000;}
async function prepare(ctx){
  if(!ARCH)return;
  await ctx.addInitScript(([now,prices])=>{const realNow=Date.now.bind(Date),off=now-realNow();Date.now=()=>realNow()+off;
    window.WebSocket=class{constructor(u){this.url=u;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen&&this.onopen();this.pump();},30);}
      pump(){if(this.readyState!==1)return;for(const [s,p] of Object.entries(prices)){const l=s.toLowerCase(),send=(st,d)=>this.onmessage&&this.onmessage({data:JSON.stringify({stream:st,data:d})});
        if(this.url.includes(l+'@ticker'))send(l+'@ticker',{s,c:p,P:'0'});if(this.url.includes(l+'@aggTrade'))send(l+'@aggTrade',{s,p,q:'1',m:false,T:Date.now()});
        if(this.url.includes(l+'@depth20'))send(l+'@depth20@500ms',{s,b:[[p,'1']],a:[[p,'1']]});}this._t=setTimeout(()=>this.pump(),500);}
      close(){if(this.readyState===3)return;this.readyState=3;clearTimeout(this._t);this.onclose&&this.onclose();}send(){}};
  },[NOW,Object.fromEntries(Object.entries(ROWS).map(([s,r])=>[s,r[r.length-1][4]]))]);
  await ctx.route('https://fapi.binance.com/**',route=>{const u=new URL(route.request().url());
    if(u.pathname==='/fapi/v1/time')return route.fulfill({json:{serverTime:NOW}});
    if(u.pathname==='/fapi/v1/openInterest')return route.fulfill({json:{openInterest:'1000'}});
    if(u.pathname==='/fapi/v1/klines')return route.fulfill({json:ROWS[u.searchParams.get('symbol')].filter(k=>k[0]<=NOW).slice(-Number(u.searchParams.get('limit')))});
    return route.fulfill({status:404,body:''});});
}
(async()=>{
  if(!ARCH)try{const r=await fetch('https://fapi.binance.com/fapi/v1/time');if(r.status===451||r.status===403){console.log('::warning::Binance menolak lokasi server uji (HTTP '+r.status+')');process.exit(3);}}catch(e){console.log('::warning::Binance tidak terjangkau: '+e.message);process.exit(3);}
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await pw.chromium.launch({headless:true,args:['--no-sandbox']});
  let pass=0;const fails=[];
  const run=async(n,fn)=>{try{const r=await fn();pass++;console.log('PASS '+n+(r?' — '+r:''));}catch(e){fails.push(n);console.log('FAIL '+n+' — '+String(e.message).split('\n')[0]);}};
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const ctx=await browser.newContext({viewport,serviceWorkers:'block'});await prepare(ctx);const page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(m.text());});await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
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
      await run(`[${viewport.width}px] Engine di browser = engine Node atas data yang sama`,async()=>{
        if(!ARCH)return 'lewati (mode jaringan)';
        const got=await page.evaluate(()=>MalomoApp.app.state.history.map(r=>r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc+'|'+r.status+'|'+r.scores.m6_confluense_500));
        const Cy=require('../app/cycle'),M2=require('../engine/m2');const fr=M2.frozenFrom(JSON.parse(fs.readFileSync(path.join(__dirname,'../evidence/frozen_cdf_normalization.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(__dirname,'../evidence/frozen_v2_normalizations.json'),'utf8')));
        const st=Cy.buildState({rawBySymbol:Object.fromEntries(Object.entries(ROWS).map(([s,r])=>[s,r.filter(k=>k[0]<=NOW).slice(-1500).map(Cy.toCandle)])),now:NOW,frozen:fr});
        assert.deepEqual(got,st.history.map(r=>r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc+'|'+r.status+'|'+r.scores.m6_confluense_500));
        return got.length+' record identik';
      });
      await run(`[${viewport.width}px] WebSocket ticker Binance tersambung`,async()=>{
        await page.waitForFunction(()=>MalomoApp.ticker&&MalomoApp.ticker.isLive(),null,{timeout:30000});
        return await page.evaluate(()=>Object.entries(MalomoApp.ticker.prices).map(([s,p])=>s+' '+p.price).join(', '));
      });
      await run(`[${viewport.width}px] Tanpa error JavaScript`,async()=>{assert.deepEqual(errors,[],errors.join(' / '));});
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
  console.log(`\n${pass} PASS, ${fails.length} FAIL`);for(const f of fails)console.log('::error::Uji browser data asli gagal: '+f);
  process.exit(fails.length?1:0);
})();
