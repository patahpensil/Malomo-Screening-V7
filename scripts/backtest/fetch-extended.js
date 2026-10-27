'use strict';
/* Data tambahan untuk uji lanjutan (arsip resmi data.binance.vision, USDⓈ-M), 30 pair Tahap A:
   - kline 1h  : 2020-01 .. kemarin
   - kline 15m : 2024-01 .. kemarin
   - funding   : 2020-01 .. bulan lalu
   - metrics   : open interest + rasio long/short (harian 5 menit -> disimpan per jam), 2021-12 .. kemarin
   - likuidasi : liquidationSnapshot harian (jika arsip tersedia) -> dijumlah per jam per sisi
   Output: data/bt2/<jenis>/<SYM>.csv.gz + data/bt2/coverage.json. Dijalankan di CI (GitHub Actions). */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const SYMS=['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','1000PEPEUSDT','BNBUSDT','SUIUSDT','ADAUSDT','WIFUSDT','ENAUSDT','LINKUSDT','AVAXUSDT','WLDUSDT','TRUMPUSDT','HYPEUSDT','LTCUSDT','1000SHIBUSDT','NEARUSDT','ORDIUSDT','BCHUSDT','FILUSDT','1000BONKUSDT','FARTCOINUSDT','UNIUSDT','AAVEUSDT','ARBUSDT','NEIROUSDT','DOTUSDT','TIAUSDT'];
const BASE='https://data.binance.vision/data/futures/um';
const OUT=path.resolve(__dirname,'../../data/bt2'),TMP=path.join(OUT,'_tmp');
for(const d of ['kline1h','kline15m','funding','metrics','liq','_tmp'])fs.mkdirSync(path.join(OUT,d),{recursive:true});
const now=new Date(),thisMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
const monthsFrom=(y0,m0)=>{const a=[];for(let d=new Date(Date.UTC(y0,m0-1,1));d<thisMonth;d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)))a.push(d.toISOString().slice(0,7));return a;};
const daysFrom=(start)=>{const a=[];const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));for(let d=new Date(start+'T00:00:00Z');d<end;d=new Date(d.getTime()+86400000))a.push(d.toISOString().slice(0,10));return a;};
const curDays=daysFrom(thisMonth.toISOString().slice(0,10));
async function get(url){for(let i=0;i<5;i++){try{const r=await fetch(url);if(r.status===404)return null;if(!r.ok)throw new Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}catch(e){if(i===4)throw new Error(url+' '+e.message);await new Promise(r=>setTimeout(r,2000*(i+1)));}}}
let seq=0;
async function zipLines(url,check){
  const [buf,sum]=await Promise.all([get(url),check?get(url+'.CHECKSUM'):null]);if(!buf)return null;
  if(sum&&sum.toString().trim().split(/\s+/)[0]!==crypto.createHash('sha256').update(buf).digest('hex'))throw new Error('checksum '+url);
  const z=path.join(TMP,(seq++)+'.zip');fs.writeFileSync(z,buf);const txt=execFileSync('unzip',['-p',z],{maxBuffer:1<<29}).toString();fs.unlinkSync(z);
  return txt.split(/\r?\n/).filter(l=>/^\d/.test(l));
}
async function pool(items,n,fn){let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const k=i++;await fn(items[k]);}}));}
const gz=(f,lines)=>fs.writeFileSync(f,zlib.gzipSync(lines.join('\n')+'\n'));
async function klines(s,tf,months){const rows=new Map();
  await pool(months,4,async m=>{const l=await zipLines(`${BASE}/monthly/klines/${s}/${tf}/${s}-${tf}-${m}.zip`,true);if(l)for(const x of l)rows.set(x.split(',')[0],x);});
  await pool(curDays,4,async d=>{const l=await zipLines(`${BASE}/daily/klines/${s}/${tf}/${s}-${tf}-${d}.zip`,true);if(l)for(const x of l)rows.set(x.split(',')[0],x);});
  return [...rows.values()].sort((a,b)=>Number(a.split(',')[0])-Number(b.split(',')[0]));}
(async()=>{
  const cov={generated:new Date().toISOString(),symbols:{}};
  for(const s of SYMS){
    const c={};
    const k1=await klines(s,'1h',monthsFrom(2020,1)); if(k1.length)gz(path.join(OUT,'kline1h',s+'.csv.gz'),k1); c.kline1h=k1.length;
    const k15=await klines(s,'15m',monthsFrom(2024,1)); if(k15.length)gz(path.join(OUT,'kline15m',s+'.csv.gz'),k15); c.kline15m=k15.length;
    const fund=[]; await pool(monthsFrom(2020,1),4,async m=>{const f=await zipLines(`${BASE}/monthly/fundingRate/${s}/${s}-fundingRate-${m}.zip`,false);if(f)fund.push(...f);});
    fund.sort((a,b)=>Number(a.split(',')[0])-Number(b.split(',')[0])); if(fund.length)gz(path.join(OUT,'funding',s+'.csv.gz'),fund); c.funding=fund.length;
    // metrics: baris "YYYY-MM-DD HH:MM:SS,SYM,oi,oi_value,count_top_ls,sum_top_ls,count_ls,sum_taker_ls"; simpan baris tepat di jam bulat
    const met=[]; await pool(daysFrom('2021-12-01'),8,async d=>{const l=await zipLines(`${BASE}/daily/metrics/${s}/${s}-metrics-${d}.zip`,false);if(l)for(const x of l)if(/^\d{4}-\d\d-\d\d \d\d:00:00/.test(x))met.push(x);});
    met.sort(); if(met.length)gz(path.join(OUT,'metrics',s+'.csv.gz'),met); c.metrics=met.length;
    // likuidasi: time,side,order_type,tif,orig_qty,price,avg_price,status,last_fill_qty,acc_fill_qty -> jumlah notional per jam per sisi
    const allD=daysFrom('2020-01-01'); const probe=allD.filter((_,i)=>i%15===0); const hit=[];
    await pool(probe,8,async d=>{const r=await fetch(`${BASE}/daily/liquidationSnapshot/${s}/${s}-liquidationSnapshot-${d}.zip`,{method:'HEAD'}).catch(()=>null);if(r&&r.ok)hit.push(d);});
    hit.sort(); const liqRange=hit.length?allD.filter(d=>d>=allD[Math.max(0,allD.indexOf(hit[0])-15)]&&d<=allD[Math.min(allD.length-1,allD.indexOf(hit.at(-1))+15)]):[];
    const liq=new Map(); let liqDays=0; await pool(liqRange,8,async d=>{const l=await zipLines(`${BASE}/daily/liquidationSnapshot/${s}/${s}-liquidationSnapshot-${d}.zip`,false);if(!l)return;liqDays++;
      for(const x of l){const p=x.split(',');const h=Math.floor(Number(p[0])/3600000)*3600000;const v=Number(p[9]||p[4])*Number(p[6]||p[5]);const e=liq.get(h)||[0,0];if(p[1]==='SELL')e[0]+=v;else e[1]+=v;liq.set(h,e);}});
    const ll=[...liq.entries()].sort((a,b)=>a[0]-b[0]).map(([h,[sellLongsLiq,buyShortsLiq]])=>`${h},${sellLongsLiq.toFixed(2)},${buyShortsLiq.toFixed(2)}`);
    if(ll.length)gz(path.join(OUT,'liq',s+'.csv.gz'),ll); c.liqHours=ll.length; c.liqDays=liqDays;
    cov.symbols[s]=c; console.log(s,JSON.stringify(c));
    fs.writeFileSync(path.join(OUT,'coverage.json'),JSON.stringify(cov,null,1));
  }
  fs.rmSync(TMP,{recursive:true,force:true});
})().catch(e=>{console.log('::error::'+e.message);process.exit(1);});
