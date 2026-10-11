/* Malomo V7 — utilitas inti engine (PRD v1.0.8 §1–§2): fungsi murni, kausal, tanpa DOM/jaringan/order.
   Candle: {t: open ms UTC, ct: close ms, open, high, low, close, volume (base), quoteVolume, trades, takerBuyBase}. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else (root.Malomo=root.Malomo||{}).core=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const H4=4*3600*1000;
  const PAIRS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT','XRPUSDT']);
  const ALPHA=1/14;
  const clip=(x,a=0,b=1)=>Math.min(Math.max(x,a),b);
  const fin=x=>typeof x==='number'&&Number.isFinite(x);

  // §1 validasi per candle. Nilai tak valid → candle tidak boleh dipakai skor yang membutuhkannya (DATA_INCOMPLETE).
  function candleValid(c){
    if(!c||![c.open,c.high,c.low,c.close].every(v=>fin(v)&&v>0))return false;
    if(!(c.high>=Math.max(c.open,c.close,c.low)&&c.low<=Math.min(c.open,c.close,c.high)))return false;
    if(!(fin(c.volume)&&c.volume>=0))return false;
    if(c.takerBuyBase!==undefined&&c.takerBuyBase!==null&&!(fin(c.takerBuyBase)&&c.takerBuyBase>=0&&c.takerBuyBase<=c.volume))return false;
    if(!fin(c.t))return false;
    return true;
  }
  // Hanya candle yang sudah close pada `now` (ct < now). Mengembalikan deret, flag kualitas, dan gap terkonfirmasi.
  function prepare(raw,now){
    const flags=[],out=[];
    for(const c of raw||[]){if(fin(now)&&!(c.t+H4<=now))continue;out.push(c);}
    out.sort((a,b)=>a.t-b.t);
    const valid=out.map(candleValid);
    for(let i=0;i<out.length;i++){
      if(!valid[i])flags.push({i,t:out[i].t,reason:'DATA_INCOMPLETE'});
      if(i>0){
        if(out[i].t===out[i-1].t)flags.push({i,t:out[i].t,reason:'DUPLICATE_OPEN_TIME'});
        else if(out[i].t-out[i-1].t!==H4)flags.push({i,t:out[i].t,reason:'CONFIRMED_GAP',missing:(out[i].t-out[i-1].t)/H4-1});
      }
    }
    // Indeks pertama setelah gap/duplikat terakhir: jendela yang melintasi gap tidak sah (tanpa interpolasi).
    let segStart=0;for(const f of flags)if(f.reason!=='DATA_INCOMPLETE')segStart=Math.max(segStart,f.i);
    return {candles:out,valid,flags,segStart};
  }

  // pandas Series.ewm(alpha, adjust=False, ignore_na=False).mean() — PRD v1.0.3 §2 (metode normatif = metode yang diuji).
  function ewm(xs,alpha=ALPHA){
    const out=new Array(xs.length).fill(NaN);let w=NaN,oldWt=1;const f=1-alpha;
    for(let i=0;i<xs.length;i++){
      const cur=xs[i],obs=fin(cur);
      if(fin(w)){
        oldWt*=f;                       // ignore_na=False: bobot lama tetap meluruh saat NaN
        if(obs){if(w!==cur)w=(oldWt*w+alpha*cur)/(oldWt+alpha);oldWt=1;}
      }else if(obs)w=cur;
      out[i]=w;
    }
    return out;
  }
  // TR, ATR14, +DI/−DI, DX, ADX14. TR[0] tak terdefinisi (previous close belum ada).
  function indicators(c){
    const n=c.length,tr=new Array(n).fill(NaN),pdm=new Array(n).fill(NaN),mdm=new Array(n).fill(NaN);
    for(let i=1;i<n;i++){
      const a=c[i],p=c[i-1];
      tr[i]=Math.max(a.high-a.low,Math.abs(a.high-p.close),Math.abs(a.low-p.close));
      const up=a.high-p.high,down=p.low-a.low;
      pdm[i]=up>down&&up>0?up:0;mdm[i]=down>up&&down>0?down:0;
    }
    const atr=ewm(tr),sp=ewm(pdm),sm=ewm(mdm);
    const pdi=sp.map((v,i)=>100*v/atr[i]),mdi=sm.map((v,i)=>100*v/atr[i]);
    const dx=pdi.map((p,i)=>{const s=p+mdi[i];return fin(s)&&s!==0?100*Math.abs(p-mdi[i])/s:NaN;});
    const adx=ewm(dx);
    const natr=atr.map((a,i)=>fin(a)&&c[i].close>0?a/c[i].close:NaN);
    return {tr,atr,pdi,mdi,dx,adx,natr};
  }

  // §2 pivot 5-bar ketat; pivot i terlihat setelah candle i+2 close (confirm = i+2).
  function pivots(c){
    const highs=[],lows=[];
    for(let i=2;i+2<c.length;i++){
      const h=c[i].high,l=c[i].low;
      if(h>c[i-2].high&&h>c[i-1].high&&h>c[i+1].high&&h>c[i+2].high)highs.push({i,price:h,confirm:i+2,type:'H'});
      if(l<c[i-2].low&&l<c[i-1].low&&l<c[i+1].low&&l<c[i+2].low)lows.push({i,price:l,confirm:i+2,type:'L'});
    }
    return {highs,lows};
  }
  // Pivot yang sudah terkonfirmasi sampai indeks k (confirm <= k), urut indeks naik.
  const confirmedUpTo=(list,k)=>{let j=0;while(j<list.length&&list[j].confirm<=k)j++;return list.slice(0,j);};

  // §2 ECDF tie kanan: count(v <= x)/len(V). V diurutkan naik.
  function ecdf(sorted,x){
    if(!sorted||!sorted.length||!fin(x))return NaN;
    let lo=0,hi=sorted.length;while(lo<hi){const m=(lo+hi)>>1;if(sorted[m]<=x)lo=m+1;else hi=m;}
    return lo/sorted.length;
  }
  const sortedCopy=a=>a.filter(fin).slice().sort((x,y)=>x-y);
  // Kuantil interpolasi linear standar (numpy default): posisi (n−1)·q.
  function quantile(arr,q){
    const s=sortedCopy(arr);if(!s.length)return NaN;
    const pos=(s.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
    return s[lo]+(s[hi]-s[lo])*(pos-lo);
  }
  function pearson(x,y){
    const n=x.length;if(n<2||y.length!==n)return NaN;
    let mx=0,my=0;for(let i=0;i<n;i++){mx+=x[i];my+=y[i];}mx/=n;my/=n;
    let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){const a=x[i]-mx,b=y[i]-my;sxy+=a*b;sxx+=a*a;syy+=b*b;}
    if(!(sxx>0&&syy>0))return NaN;
    return sxy/Math.sqrt(sxx*syy);
  }
  // round half up 2 desimal — hanya untuk tampilan, sesudah skor total dihitung.
  const display2=x=>fin(x)?Math.floor(x*100+0.5+1e-9)/100:null;
  const iso=ms=>new Date(ms).toISOString().replace('.000Z','Z');
  const sideNum=s=>s==='LONG'?1:-1;

  return {H4,PAIRS,ALPHA,clip,fin,candleValid,prepare,ewm,indicators,pivots,confirmedUpTo,ecdf,sortedCopy,quantile,pearson,display2,iso,sideNum};
});
