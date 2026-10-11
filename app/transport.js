/* Malomo V7 — transport data publik Binance USDⓈ-M (pola live yang diadopsi dari ICT Screening, README tabel A).
   - Antrean REST: jeda 200 ms antarpermintaan, timeout 20 detik, cooldown 429/418 memakai Retry-After.
   - Sinkron jam server (/fapi/v1/time): status "candle sudah close" mengikuti jam Binance, bukan jam perangkat.
   - Cache kline 4H sampai candle berjalan close (candle close tidak pernah berubah).
   - Retry FETCH_FAILED PRD §1: 3 percobaan ulang dengan jeda 30/60/120 detik (nilai operasional, bukan parameter riset).
   - WebSocket ticker 6 pair dengan watchdog 20 detik dan reconnect bertahap.
   - exchangeInfo publik (PRD v1.0.11 R32): aturan tick/step/min notional untuk rencana siap salin.
   - ticker/24hr + kline 1d publik (PRD v1.0.12 R34): ranking universe 100 pair pada close harian 00:00 UTC.
   Hanya endpoint publik baca-saja. Tidak ada API key dan tidak ada endpoint order. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else (root.Malomo=root.Malomo||{}).transport=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const REST='https://fapi.binance.com',WS='wss://fstream.binance.com';
  const H4=4*3600*1000;
  const RETRY_DELAYS=Object.freeze([30000,60000,120000]);
  // Hanya path baca-saja ini yang boleh diminta; apa pun di luar daftar ditolak sebelum menyentuh jaringan.
  const ALLOWED=[/^\/fapi\/v1\/time$/,/^\/fapi\/v1\/klines\?/,/^\/fapi\/v1\/openInterest\?/,/^\/fapi\/v1\/exchangeInfo$/,/^\/fapi\/v1\/ticker\/24hr$/];

  function createTransport({fetchImpl=(...a)=>fetch(...a),now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),gapMs=200,timeoutMs=20000,base=REST}={}){
    let tail=Promise.resolve(),cooldownUntil=0,clockOffset=0;
    const cache=new Map(),pending=new Map();
    const serverNow=()=>now()+clockOffset;
    async function request(path){
      if(!ALLOWED.some(re=>re.test(path)))throw new Error('Path tidak diizinkan: '+path);
      const start=tail.then(()=>sleep(gapMs));tail=start.catch(()=>{});await start;
      for(let attempt=0;attempt<3;attempt++){
        if(cooldownUntil>now())await sleep(cooldownUntil-now());
        const ctl=typeof AbortController!=='undefined'?new AbortController():null;
        const timer=ctl?setTimeout(()=>ctl.abort(),timeoutMs):null;
        let res;
        try{res=await fetchImpl(base+path,{signal:ctl?ctl.signal:undefined,cache:'no-store'});}
        finally{if(timer)clearTimeout(timer);}
        if(res.status===429||res.status===418){
          const ra=Number(res.headers&&res.headers.get?res.headers.get('Retry-After'):0)||0;
          cooldownUntil=now()+Math.max(3000,ra*1000)*(attempt+1);continue;
        }
        if(!res.ok)throw new Error('Binance HTTP '+res.status);
        return res.json();
      }
      throw new Error('Binance rate limit; coba ulang setelah jeda');
    }
    async function syncClock(){
      const sent=now(),res=await request('/fapi/v1/time'),received=now();
      if(res&&Number.isFinite(res.serverTime))clockOffset=res.serverTime-(sent+received)/2;
      return clockOffset;
    }
    /* Kline 4H mentah (termasuk candle yang sedang berjalan: open-nya = entry referensi fase ENTRY_REVIEW).
       Cache berlaku sampai candle berjalan close; bila candle berjalan belum muncul di respons, tidak di-cache. */
    async function klines(symbol,limit=1500){
      const key=symbol+'|'+limit,hit=cache.get(key);
      if(hit&&serverNow()<hit.until)return hit.rows;
      if(pending.has(key))return pending.get(key);
      const job=request('/fapi/v1/klines?symbol='+encodeURIComponent(symbol)+'&interval=4h&limit='+limit).then(rows=>{
        if(!Array.isArray(rows))throw new Error('Respons kline tidak valid');
        const t=serverNow(),forming=rows.find(k=>Number(k[0])<=t&&Number(k[0])+H4>t);
        cache.set(key,{rows,until:forming?Number(k6(forming))+1000:0});
        return rows;
      }).finally(()=>pending.delete(key));
      pending.set(key,job);return job;
    }
    const k6=k=>Number(k[6])||Number(k[0])+H4-1;
    const openInterest=symbol=>request('/fapi/v1/openInterest?symbol='+encodeURIComponent(symbol)).then(x=>Number(x&&x.openInterest));
    // Aturan pair (tickSize/stepSize/minQty/min notional/status) untuk rencana siap salin R32 — publik, tanpa API key.
    const exchangeInfo=()=>request('/fapi/v1/exchangeInfo');
    // Universe R34: volume 24 jam semua pair (kumpulan kandidat) dan candle harian untuk ranking pada close 00:00 UTC.
    const ticker24hr=()=>request('/fapi/v1/ticker/24hr');
    const dailyKlines=(symbol,limit=3)=>request('/fapi/v1/klines?symbol='+encodeURIComponent(symbol)+'&interval=1d&limit='+limit);
    return {request,syncClock,serverNow,klines,openInterest,exchangeInfo,ticker24hr,dailyKlines,clearCache:()=>cache.clear(),_state:()=>({cooldownUntil,clockOffset,cacheSize:cache.size})};
  }

  /* FETCH_FAILED (PRD §1): satu percobaan awal + 3 percobaan ulang (jeda 30/60/120 detik). onAttemptFailed dipanggil
     setiap gagal supaya UI menandai "Mengambil ulang (FETCH_FAILED)". Hasil akhir {ok,value|error,attempts}. */
  async function withRetry(job,{delays=RETRY_DELAYS,sleep=ms=>new Promise(r=>setTimeout(r,ms)),onAttemptFailed=()=>{},cancelled=()=>false}={}){
    let lastErr=null;
    for(let i=0;i<=delays.length;i++){
      if(i>0){await sleep(delays[i-1]);if(cancelled())return {ok:false,error:lastErr,attempts:i,cancelled:true};}
      try{return {ok:true,value:await job(),attempts:i+1};}
      catch(e){lastErr=e;onAttemptFailed({attempt:i+1,error:e,nextDelayMs:i<delays.length?delays[i]:null});}
    }
    return {ok:false,error:lastErr,attempts:delays.length+1};
  }

  /* WebSocket ticker 6 pair: harga live untuk kartu Decision (tampilan saja, tidak masuk skor).
     Watchdog: koneksi tanpa pesan > 20 detik ditutup; reconnect bertahap 2 s → ×1.6 → maks 30 s. */
  function createTicker({symbols,onTick,WebSocketImpl=typeof WebSocket!=='undefined'?WebSocket:null,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,base=WS}){
    const prices={};let sock=null,last=0,opened=0,delay=2000,timer=null,stopped=false;
    function connect(){
      if(stopped||!WebSocketImpl)return;
      const url=base+'/market/stream?streams='+symbols.map(s=>s.toLowerCase()+'@ticker').join('/');
      let w;try{w=new WebSocketImpl(url);}catch{schedule();return;}
      sock=w;last=0;opened=now();
      w.onopen=()=>{delay=2000;};
      w.onmessage=e=>{
        try{const m=JSON.parse(e.data),d=m&&m.data;if(!d||!d.s)return;const px=Number(d.c);if(!(px>0))return;
          last=now();prices[d.s]={price:px,at:last,changePct:Number(d.P)};onTick&&onTick(d.s,prices[d.s]);}
        catch{/* pesan rusak tidak mengubah tampilan */}
      };
      w.onerror=()=>{try{w.close();}catch{/* sudah tertutup */}};
      w.onclose=()=>{if(sock!==w)return;sock=null;schedule();};
    }
    function schedule(){if(stopped)return;clearTimer(timer);timer=setTimer(connect,delay);delay=Math.min(delay*1.6,30000);}
    function watchdog(){
      if(!sock||sock.readyState!==1)return;
      const idle=last?now()-last:now()-opened;
      if(idle>20000){try{sock.close();}catch{/* sudah tertutup */}}
    }
    connect();
    return {prices,watchdog,isLive:()=>!!sock&&sock.readyState===1&&last>0&&now()-last<20000,
      stop(){stopped=true;clearTimer(timer);if(sock){const w=sock;sock=null;try{w.close();}catch{/* sudah tertutup */}}},_delay:()=>delay};
  }
  return {REST,WS,RETRY_DELAYS,createTransport,withRetry,createTicker};
});
