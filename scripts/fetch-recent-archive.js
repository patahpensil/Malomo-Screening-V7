'use strict';
/* Unduh kline 4H ASLI terbaru (±260 hari sampai kemarin) untuk 20 pair dari arsip resmi data.binance.vision
   (bulanan + harian, checksum resmi). Dipakai untuk menguji aplikasi ujung-ke-ujung dengan data pasar asli
   di server yang diblokir API Binance (HTTP 451). Output: data/recent/<PAIR>.csv. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
// 6 pair inti + 14 pair likuid lain (R34: menguji universe multi-pair dengan data asli; ranking dari volume harian asli).
const PAIRS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','LTCUSDT','DOTUSDT','TRXUSDT','BCHUSDT',
  'NEARUSDT','APTUSDT','ARBUSDT','OPUSDT','SUIUSDT','1000PEPEUSDT','WIFUSDT'];
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'data','recent'),TMP=path.join(OUT,'_zip');
const BASE='https://data.binance.vision/data/futures/um';
fs.mkdirSync(TMP,{recursive:true});
async function get(url){for(let i=0;i<3;i++){try{const r=await fetch(url);if(r.status===404)return null;if(!r.ok)throw new Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}catch(e){if(i===2)throw e;await new Promise(r=>setTimeout(r,2000*(i+1)));}}}
async function file(kind,s,name){
  const url=`${BASE}/${kind}/klines/${s}/4h/${name}.zip`,[buf,sum]=await Promise.all([get(url),get(url+'.CHECKSUM')]);
  if(!buf)return [];
  if(sum&&sum.toString().trim().split(/\s+/)[0]!==crypto.createHash('sha256').update(buf).digest('hex'))throw new Error('checksum '+name);
  const z=path.join(TMP,name+'.zip');fs.writeFileSync(z,buf);
  return execFileSync('unzip',['-p',z]).toString().split(/\r?\n/).filter(l=>/^\d/.test(l));
}
(async()=>{
  const now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())-260*86400000);
  for(const s of PAIRS){
    const rows=new Map();
    for(let d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),1));d<new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1))){
      const ym=d.toISOString().slice(0,7);for(const l of await file('monthly',s,`${s}-4h-${ym}`))rows.set(l.split(',')[0],l);
    }
    for(let d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));d<now;d=new Date(d.getTime()+86400000)){
      const ymd=d.toISOString().slice(0,10);for(const l of await file('daily',s,`${s}-4h-${ymd}`))rows.set(l.split(',')[0],l);
    }
    const lines=[...rows.values()].sort((a,b)=>Number(a.split(',')[0])-Number(b.split(',')[0]));
    fs.writeFileSync(path.join(OUT,s+'.csv'),lines.join('\n')+'\n');
    console.log(s+': '+lines.length+' candle, terakhir '+new Date(Number(lines[lines.length-1].split(',')[0])).toISOString());
  }
  fs.rmSync(TMP,{recursive:true,force:true});
})().catch(e=>{console.log('::error::'+e.message);process.exit(1);});
