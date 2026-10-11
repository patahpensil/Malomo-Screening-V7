'use strict';
/* Unduh arsip kline resmi Binance USDⓈ-M 4H 2024 (Januari–November; PRD §1: 2.010 candle per pair) dari
   data.binance.vision, verifikasi checksum .CHECKSUM resmi, lalu tulis data/ohlcv-2024/<PAIR>.csv untuk
   scripts/parity-ohlcv.js. Butuh perintah `unzip`. Keluar 3 bila sumber tidak terjangkau. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const PAIRS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT','XRPUSDT'];
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'data','ohlcv-2024'),TMP=path.join(OUT,'_zip');
const BASE='https://data.binance.vision/data/futures/um/monthly/klines';
fs.mkdirSync(TMP,{recursive:true});
async function get(url){
  for(let i=0;i<3;i++){
    try{const r=await fetch(url);if(r.status===404)throw Object.assign(new Error('404 '+url),{fatal:true});if(!r.ok)throw new Error('HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer());}
    catch(e){if(e.fatal||i===2)throw e;await new Promise(r=>setTimeout(r,2000*(i+1)));}
  }
}
(async()=>{
  try{await get(BASE+'/BTCUSDT/4h/BTCUSDT-4h-2024-01.zip.CHECKSUM');}
  catch(e){console.log('::warning::data.binance.vision tidak terjangkau: '+e.message);process.exit(3);}
  for(const s of PAIRS){
    const lines=[];
    for(let m=1;m<=11;m++){
      const name=`${s}-4h-2024-${String(m).padStart(2,'0')}`,zip=path.join(TMP,name+'.zip');
      const [buf,sum]=await Promise.all([get(`${BASE}/${s}/4h/${name}.zip`),get(`${BASE}/${s}/4h/${name}.zip.CHECKSUM`)]);
      const want=sum.toString().trim().split(/\s+/)[0],have=crypto.createHash('sha256').update(buf).digest('hex');
      if(want!==have)throw new Error('checksum tidak cocok '+name);
      fs.writeFileSync(zip,buf);
      const csv=execFileSync('unzip',['-p',zip]).toString();
      for(const l of csv.split(/\r?\n/))if(/^\d/.test(l))lines.push(l);
    }
    lines.sort((a,b)=>Number(a.split(',')[0])-Number(b.split(',')[0]));
    fs.writeFileSync(path.join(OUT,s+'.csv'),lines.join('\n')+'\n');
    console.log(s+': '+lines.length+' candle 4H (checksum resmi cocok)');
  }
  fs.rmSync(TMP,{recursive:true,force:true});
})().catch(e=>{console.log('::error::'+e.message);process.exit(1);});
