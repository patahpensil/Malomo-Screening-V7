'use strict';
/* Data kline sintetis deterministik (format Binance) untuk tes aplikasi. BUKAN data pasar; dipakai hanya agar tes
   dapat mengulang skenario yang sama (seed tetap). Enam pair berkorelasi dengan rezim tren bergantian. */
const H4=4*3600*1000;
const BASE={BTCUSDT:60000,ETHUSDT:2500,SOLUSDT:150,BNBUSDT:550,DOGEUSDT:0.12,XRPUSDT:0.55};
function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function gauss(r){let u=0,v=0;while(u===0)u=r();while(v===0)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
// n candle per pair mulai t0 (open time). Kline: [t,o,h,l,c,vol,ct,quoteVol,trades,takerBase,takerQuote,"0"].
function generate({n=1600,t0=Date.UTC(2026,0,1),seed=7,pairs=Object.keys(BASE)}={}){
  const r=rng(seed),out={};pairs.forEach(s=>{out[s]=[];});
  const px={};pairs.forEach(s=>{px[s]=BASE[s];});
  let drift=0;
  for(let i=0;i<n;i++){
    if(i%90===0)drift=(r()-0.5)*0.006;            // rezim tren bergantian
    const common=gauss(r)*0.008;
    for(const s of pairs){
      const ret=drift+common*0.7+gauss(r)*0.009,o=px[s],c=o*Math.exp(ret);
      const h=Math.max(o,c)*(1+Math.abs(gauss(r))*0.004),l=Math.min(o,c)*(1-Math.abs(gauss(r))*0.004);
      const vol=1000*(1+r()*2)*(1+Math.abs(ret)*40),taker=vol*(0.35+r()*0.3),t=t0+i*H4;
      out[s].push([t,o,h,l,c,vol,t+H4-1,vol*c,Math.round(500+r()*500),taker,taker*c,'0']);
      px[s]=c;
    }
  }
  return out;
}
module.exports={generate,H4,BASE};
