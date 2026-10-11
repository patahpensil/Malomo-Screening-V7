'use strict';
/* Tahap A — unduh data universe kandidat dari arsip resmi data.binance.vision (USDⓈ-M):
   kline 4H (bulanan 2024-01..bulan lalu + harian bulan ini sampai kemarin, checksum resmi) dan funding rate bulanan.
   Output: data/bt/kline/<SYM>.csv.gz, data/bt/funding/<SYM>.csv.gz, data/bt/coverage.json. Dijalankan di CI. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const CANDIDATES=['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','DOT','LTC','BCH','TRX','TON','SUI','APT','ARB','OP','NEAR','FIL','ATOM','ETC','UNI','AAVE','INJ','TIA','SEI','WLD',
  '1000PEPE','1000SHIB','1000BONK','1000FLOKI','WIF','ORDI','FET','RENDER','RNDR','ENA','ONDO','JUP','STX','IMX','HBAR','ICP','RUNE','LDO','CRV','TAO','TRUMP','POPCAT','NOT','PEOPLE',
  'POL','MATIC','XLM','HYPE','VIRTUAL','PENGU','KAITO','BERA','S','MOVE','FARTCOIN','PNUT','NEIRO','EIGEN','ZRO','JTO','PYTH','GALA','SAND','1000SATS','ALGO','MKR','XMR'].map(s=>s+'USDT');
const BASE='https://data.binance.vision/data/futures/um';
const OUT=path.resolve(__dirname,'../../data/bt'),TMP=path.join(OUT,'_tmp');
for(const d of ['kline','funding','_tmp'])fs.mkdirSync(path.join(OUT,d),{recursive:true});
const now=new Date(),y0=2024;
const months=[];for(let y=y0;;y++){for(let m=1;m<=12;m++){const d=new Date(Date.UTC(y,m-1,1));if(d>=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)))break;months.push(`${y}-${String(m).padStart(2,'0')}`);}if(y>=now.getUTCFullYear())break;}
const days=[];for(let d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));d<new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));d=new Date(d.getTime()+86400000))days.push(d.toISOString().slice(0,10));
async function get(url){for(let i=0;i<4;i++){try{const r=await fetch(url);if(r.status===404)return null;if(!r.ok)throw new Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}catch(e){if(i===3)throw new Error(url+' '+e.message);await new Promise(r=>setTimeout(r,1500*(i+1)));}}}
let seq=0;
async function zipLines(url,check){
  const [buf,sum]=await Promise.all([get(url),check?get(url+'.CHECKSUM'):null]);if(!buf)return null;
  if(sum&&sum.toString().trim().split(/\s+/)[0]!==crypto.createHash('sha256').update(buf).digest('hex'))throw new Error('checksum '+url);
  const z=path.join(TMP,(seq++)+'.zip');fs.writeFileSync(z,buf);const txt=execFileSync('unzip',['-p',z],{maxBuffer:1<<28}).toString();fs.unlinkSync(z);
  return txt.split(/\r?\n/).filter(l=>/^\d/.test(l));
}
async function pool(items,n,fn){let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const k=i++;await fn(items[k]);}}));}
(async()=>{
  const coverage={};
  await pool(CANDIDATES,6,async s=>{
    const rows=new Map(),fund=[];
    for(const m of months){const l=await zipLines(`${BASE}/monthly/klines/${s}/4h/${s}-4h-${m}.zip`,true);if(l)for(const x of l)rows.set(x.split(',')[0],x);
      const f=await zipLines(`${BASE}/monthly/fundingRate/${s}/${s}-fundingRate-${m}.zip`,false);if(f)for(const x of f)fund.push(x);}
    for(const d of days){const l=await zipLines(`${BASE}/daily/klines/${s}/4h/${s}-4h-${d}.zip`,true);if(l)for(const x of l)rows.set(x.split(',')[0],x);}
    if(!rows.size){coverage[s]=null;console.log(s+': tidak ada data');return;}
    const k=[...rows.values()].sort((a,b)=>Number(a.split(',')[0])-Number(b.split(',')[0]));
    const qv=k.reduce((t,l)=>t+Number(l.split(',')[7]),0);
    fs.writeFileSync(path.join(OUT,'kline',s+'.csv.gz'),zlib.gzipSync(k.join('\n')+'\n'));
    fs.writeFileSync(path.join(OUT,'funding',s+'.csv.gz'),zlib.gzipSync(fund.sort().join('\n')+'\n'));
    coverage[s]={candles:k.length,first:new Date(Number(k[0].split(',')[0])).toISOString(),last:new Date(Number(k[k.length-1].split(',')[0])).toISOString(),quoteVolume:qv,funding:fund.length};
    console.log(s,coverage[s].candles,coverage[s].first.slice(0,10),'→',coverage[s].last.slice(0,10),'QV',(qv/1e9).toFixed(1)+'B','funding',fund.length);
  });
  fs.writeFileSync(path.join(OUT,'coverage.json'),JSON.stringify({generated:new Date().toISOString(),months,days,coverage},null,1));
  fs.rmSync(TMP,{recursive:true,force:true});
})().catch(e=>{console.log('::error::'+e.message);process.exit(1);});
