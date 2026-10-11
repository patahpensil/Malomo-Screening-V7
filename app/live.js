/* Malomo V7 — data live per posisi simulasi aktif untuk kartu Decision (pola live ICT Screening, README tabel A):
   aggTrade → CVD taker, depth20 → orderbook, poll Open Interest ±15 detik.
   HANYA TAMPILAN (PRD §4.5: CVD/quote volume/order book tidak menerima poin). Tidak pernah masuk engine atau skor. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else (root.Malomo=root.Malomo||{}).live=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CVD_WINDOW=5*60*1000;
  // Binance memisahkan endpoint WebSocket futures: aggTrade di /market, depth di /public.
  const SOCKS={market:{path:'market',stream:s=>s+'@aggTrade',flag:'wsOn'},public:{path:'public',stream:s=>s+'@depth20@500ms',flag:'depthOn'}};

  function createLive({WebSocketImpl=typeof WebSocket!=='undefined'?WebSocket:null,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,base='wss://fstream.binance.com',openInterest=null}={}){
    const data={};let socks={},signature='',timers={},delay=2000;
    const ld=s=>data[s]||(data[s]={cvd:0,cvdWin:[],cvdSince:now(),wsOn:false,depthOn:false});
    function closeAll(){
      for(const k in timers)clearTimer(timers[k]);timers={};
      for(const k in socks){const w=socks[k];w.onclose=null;w.onerror=null;try{w.close();}catch{/* sudah tertutup */}}
      socks={};
    }
    function handle(stream,msg){
      const sym=msg.s;if(!sym)return;const d=ld(sym);
      if(stream.endsWith('@aggTrade')){
        const q=parseFloat(msg.p)*parseFloat(msg.q);if(!(q>0))return;
        const delta=msg.m?-q:q;            // m = pembeli adalah maker → agresor JUAL
        d.cvd+=delta;d.cvdWin.push({t:msg.T||now(),d:delta});
      }else if(stream.includes('@depth')){
        const bids=msg.b||[],asks=msg.a||[];
        const sum=a=>a.reduce((s,x)=>s+parseFloat(x[0])*parseFloat(x[1]),0);
        const bu=sum(bids),au=sum(asks);
        if(bu+au>0&&bids.length&&asks.length)Object.assign(d,{bidUsd:bu,askUsd:au,imb:(bu-au)/(bu+au),bid:parseFloat(bids[0][0]),ask:parseFloat(asks[0][0])});
      }
    }
    function open(kind,syms){
      const cfg=SOCKS[kind];if(!WebSocketImpl)return;
      try{
        const w=new WebSocketImpl(base+'/'+cfg.path+'/stream?streams='+syms.map(s=>cfg.stream(s.toLowerCase())).join('/'));
        w._last=0;w._t0=now();socks[kind]=w;
        w.onopen=()=>{delay=2000;};
        w.onmessage=e=>{
          try{const m=JSON.parse(e.data);if(!m||!m.stream||!m.data)return;
            if(!w._last)syms.forEach(s=>{ld(s)[cfg.flag]=true;});
            w._last=now();handle(m.stream,m.data);}
          catch{/* pesan rusak tidak mengubah tampilan */}
        };
        w.onerror=()=>{try{w.close();}catch{/* sudah tertutup */}};
        w.onclose=()=>{
          if(socks[kind]!==w)return;
          delete socks[kind];syms.forEach(s=>{ld(s)[cfg.flag]=false;});
          clearTimer(timers[kind]);
          timers[kind]=setTimer(()=>{if(!socks[kind]&&signature)open(kind,signature.split(','));},delay);
          delay=Math.min(delay*1.6,30000);
        };
      }catch{/* WebSocket tidak tersedia: sel menampilkan "menyambung…" */}
    }
    // Simbol posisi aktif berubah → tutup semua stream lalu buka ulang untuk himpunan baru.
    function sync(symbols){
      const syms=[...new Set(symbols)].sort(),sig=syms.join(',');
      if(sig===signature&&(Object.keys(socks).length||!syms.length))return;
      closeAll();signature=sig;
      Object.keys(data).forEach(s=>{if(!syms.includes(s)){data[s].wsOn=false;data[s].depthOn=false;}});
      if(syms.length)for(const kind in SOCKS)open(kind,syms);
    }
    // Tiap detik: buang CVD di luar jendela 5 menit; tutup koneksi yang tersambung tapi diam > 20 detik.
    function tick(){
      const t=now();
      for(const s in data){const d=data[s];while(d.cvdWin.length&&d.cvdWin[0].t<t-CVD_WINDOW)d.cvdWin.shift();}
      for(const kind in socks){
        const w=socks[kind];if(w.readyState!==1)continue;
        if((!w._last&&t-w._t0>20000)||(w._last&&t-w._last>20000)){try{w.close();}catch{/* sudah tertutup */}}
      }
    }
    async function pollOI(){
      if(!openInterest)return;
      for(const sym of signature?signature.split(','):[]){
        try{const oi=await openInterest(sym);if(!(oi>0))continue;const d=ld(sym);if(!(d.oiBase>0))d.oiBase=oi;d.oi=oi;d.oiAt=now();}
        catch{/* dicoba lagi pada siklus berikutnya */}
      }
    }
    const cvd5=sym=>(ld(sym).cvdWin||[]).reduce((s,x)=>s+x.d,0);
    return {sync,tick,pollOI,cvd5,data:sym=>data[sym]||{},stop:()=>{closeAll();signature='';},_socks:()=>socks,_handle:handle};
  }
  return {createLive,CVD_WINDOW};
});
