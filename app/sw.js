/* Malomo V7 — service worker PWA: cache app shell saja. Data Binance (lintas origin) tidak pernah di-cache di sini,
   supaya keputusan selalu dari candle terbaru. CACHE_NAME diganti tiap build (scripts/build-site.js). */
const CACHE_NAME='malomo-v7-__BUILD__';
const SHELL=['./','index.html','styles.css','labels.js','cycle.js','transport.js','live.js','exec.js','universe.js','ledger.js','worker.js','ui.js','main.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png',
  'engine/core.js','engine/m1.js','engine/generators.js','engine/m2.js','engine/m3m4.js','engine/pipeline.js',
  'data/frozen_cdf_normalization.json','data/frozen_v2_normalizations.json','data/MANIFEST_SHA256.json','build-info.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
  // Jaringan dulu (versi terbaru), cache sebagai cadangan offline.
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
