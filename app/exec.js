/* Malomo V7 — Rencana eksekusi siap salin (PRD v1.0.11 R32). Fungsi murni, tanpa DOM/jaringan.
   Lapisan tampilan di atas record PRD §6: harga entry/stop/target dibulatkan ke tickSize Binance, qty dari modal dan
   risiko pengguna (dibulatkan ke stepSize), leverage maksimum aman dari jarak stop. Record audit, replay portofolio,
   dan ekuitas acuan PRD TIDAK diubah. Tanpa order, tanpa API key: aturan pair dari /fapi/v1/exchangeInfo (publik).
   Aritmetika harga memakai bilangan bulat kelipatan tick (tanpa galat desimal float). */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else (root.Malomo=root.Malomo||{}).exec=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const fin=x=>typeof x==='number'&&Number.isFinite(x);
  // Asumsi maintenance margin rate konservatif (nilai pasti hanya lewat endpoint berkunci, tidak dipakai) — R32.3.
  // R34: alt di luar 30 besar volume (atau peringkat tidak diketahui) memakai MMR 2,5% dan batas 20× — koin kecil punya
  // bracket margin lebih ketat di Binance. Hanya membuat leverage aman lebih kecil; tidak menyentuh skor.
  const MMR=Object.freeze({BTCUSDT:0.004,ETHUSDT:0.005,DEFAULT:0.01,SMALL:0.025});
  // Batas leverage pribadi pengguna (R32.3): BTC 150×, ETH 125×, alt 50× (alt di luar 30 besar 20×).
  const MAX_LEV=Object.freeze({BTCUSDT:150,ETHUSDT:125,DEFAULT:50,SMALL:20});
  const TOP_TIER=30;
  const LIMITS=Object.freeze({riskMin:0.5,riskMax:1,costMin:0,costMax:50,capitalMax:1e9});
  const DEFAULTS=Object.freeze({capital:null,riskPct:0.5,costBps:18});
  const RULES_TTL_MS=24*3600*1000;

  // ---------- desimal ----------
  // "0.00010000" → 4 desimal; "10" → 0. Hanya string desimal positif yang sah.
  function decimalsOf(str){
    const s=String(str).trim();if(!/^\d+(\.\d+)?$/.test(s))return null;
    const frac=(s.split('.')[1]||'').replace(/0+$/,'');return frac.length;
  }
  function makeGrid(str){
    const dec=decimalsOf(str);if(dec===null||dec>12)return null;
    const scale=10**dec,unit=Math.round(Number(str)*scale);
    if(!(unit>0)||!Number.isSafeInteger(unit))return null;
    return {str:String(str),dec,scale,unit};
  }
  /* Bulatkan x ke kelipatan grid. mode 'down' | 'up'. Nilai yang sudah tepat di grid tidak digeser satu tick oleh galat
     float: toleransi = beberapa ulp dari v (|v|·1e-15, minimal 1e-9) — cukup untuk galat x·scale/unit, tetapi jauh di
     bawah satu tick sehingga nilai yang benar-benar di luar grid tetap dibulatkan ke arah yang diminta.
     Hasil: n kelipatan, units = n·unit (bilangan bulat), str dengan dec desimal. */
  function snap(x,grid,mode){
    const v=x*grid.scale/grid.unit,r=Math.round(v),tol=Math.max(1e-9,Math.abs(v)*1e-15);
    const n=Math.abs(v-r)<=tol?r:mode==='down'?Math.floor(v):Math.ceil(v);
    const units=n*grid.unit;
    return {n,units,num:units/grid.scale,str:(units/grid.scale).toFixed(grid.dec)};
  }

  // ---------- aturan pair dari exchangeInfo ----------
  /* Format resmi: filter terpisah PRICE_FILTER{tickSize}, LOT_SIZE{stepSize,minQty,maxQty}, MIN_NOTIONAL{notional}.
     Parser juga menerima varian gabungan (dokumentasi) dengan mencari field di filter mana pun. Field yang tidak sah →
     pair tidak punya aturan (tampilan memakai label "belum dibulatkan"), tidak pernah diisi tebakan. */
  function parseRules(json,symbols){
    const out={};
    const list=json&&Array.isArray(json.symbols)?json.symbols:[];
    for(const sym of symbols){
      const s=list.find(x=>x&&x.symbol===sym);if(!s||!Array.isArray(s.filters))continue;
      const byType=t=>s.filters.find(f=>f&&f.filterType===t);
      const pick=(pref,field)=>{const f=byType(pref);if(f&&f[field]!==undefined)return f[field];const g=s.filters.find(x=>x&&x[field]!==undefined);return g?g[field]:undefined;};
      const tick=pick('PRICE_FILTER','tickSize'),step=pick('LOT_SIZE','stepSize'),minQty=pick('LOT_SIZE','minQty'),maxQty=pick('LOT_SIZE','maxQty');
      const mn=byType('MIN_NOTIONAL'),notional=mn?(mn.notional??mn.minNotional):pick('MIN_NOTIONAL','notional');
      const tg=makeGrid(tick),sg=makeGrid(step),minQ=Number(minQty),maxQ=Number(maxQty),minN=Number(notional);
      if(!tg||!sg||!(minQ>0)||!(minN>=0))continue;
      out[sym]={symbol:sym,status:String(s.status||''),tickSize:tg.str,stepSize:sg.str,minQty:minQ,maxQty:maxQ>0?maxQ:Infinity,minNotional:minN};
    }
    return out;
  }

  // ---------- pengaturan pengguna ----------
  const num=v=>{if(typeof v==='number')return v;if(typeof v!=='string')return NaN;const s=v.trim().replace(',','.');return s===''?NaN:Number(s);};
  /* Validasi input R32.2. capital wajib > 0; risiko 0,5–1%; biaya 0–50 bps. Mengembalikan nilai bersih + daftar error. */
  function validateSettings(raw){
    const r=raw||{},errors={};
    const capital=num(r.capital),riskPct=r.riskPct===undefined||r.riskPct===null||r.riskPct===''?DEFAULTS.riskPct:num(r.riskPct),
      costBps=r.costBps===undefined||r.costBps===null||r.costBps===''?DEFAULTS.costBps:num(r.costBps);
    const capEmpty=r.capital===undefined||r.capital===null||String(r.capital).trim()==='';
    if(capEmpty)errors.capital='EMPTY';else if(!(fin(capital)&&capital>0&&capital<=LIMITS.capitalMax))errors.capital='INVALID';
    if(!(fin(riskPct)&&riskPct>=LIMITS.riskMin-1e-12&&riskPct<=LIMITS.riskMax+1e-12))errors.riskPct='INVALID';
    if(!(fin(costBps)&&costBps>=LIMITS.costMin&&costBps<=LIMITS.costMax))errors.costBps='INVALID';
    return {ok:!Object.keys(errors).length,capital:errors.capital?null:capital,riskPct:errors.riskPct?null:riskPct,costBps:errors.costBps?null:costBps,errors};
  }

  const big=rank=>Number.isInteger(rank)&&rank>=1&&rank<=TOP_TIER;
  const mmrOf=(sym,rank)=>MMR[sym]??(big(rank)?MMR.DEFAULT:MMR.SMALL);
  const maxLevOf=(sym,rank)=>MAX_LEV[sym]??(big(rank)?MAX_LEV.DEFAULT:MAX_LEV.SMALL);
  /* Leverage maksimum aman: floor(1 / (2·jarak_stop + MMR)), minimal 1×, maksimal batas pribadi.
     Menjamin perkiraan jarak likuidasi (1/L − MMR) ≥ 2 × jarak stop. */
  function safeLeverage(stopFrac,sym,rank){
    if(!(fin(stopFrac)&&stopFrac>0))return null;
    const mmr=mmrOf(sym,rank);
    return Math.max(1,Math.min(maxLevOf(sym,rank),Math.floor(1/(2*stopFrac+mmr)+1e-9)));
  }

  /* Rencana siap salin untuk satu record/posisi PRD.
     input: {symbol, side, entry, stop, target} (float64 PRD §6), settings (sudah divalidasi atau mentah), rules pair|null.
     status: NO_PLAN · NEED_SETTINGS · INVALID_SETTINGS · PAIR_NOT_TRADING · NOT_EXECUTABLE · READY · UNROUNDED. */
  function plan(p,settingsRaw,rules){
    const base={symbol:p&&p.symbol,side:p&&p.side,rounded:false,reasons:[]};
    if(!p||!['LONG','SHORT'].includes(p.side)||![p.entry,p.stop,p.target].every(v=>fin(v)&&v>0))return Object.assign(base,{status:'NO_PLAN'});
    const st=validateSettings(settingsRaw);
    if(!st.ok)return Object.assign(base,{status:st.errors.capital==='EMPTY'&&Object.keys(st.errors).length===1?'NEED_SETTINGS':'INVALID_SETTINGS',errors:st.errors});
    const rank=rules&&Number.isInteger(rules.rank)?rules.rank:null,s=p.side==='LONG'?1:-1,mmr=mmrOf(p.symbol,rank);
    let entry,stop,target,priceStr,distUnits=null,scale=1;
    const tg=rules?makeGrid(rules.tickSize):null,sg=rules?makeGrid(rules.stepSize):null;
    if(tg&&sg){
      // Arah pembulatan aman (R32.3 butir 2): entry tidak lebih mahal; stop menjauh dari entry; target mendekat ke entry.
      const e=snap(p.entry,tg,s===1?'down':'up'),sl=snap(p.stop,tg,s===1?'down':'up'),tp=snap(p.target,tg,s===1?'down':'up');
      entry=e.num;stop=sl.num;target=tp.num;scale=tg.scale;distUnits=Math.abs(e.units-sl.units);
      priceStr={entry:e.str,stop:sl.str,target:tp.str};
      base.rounded=true;
    }else{
      entry=p.entry;stop=p.stop;target=p.target;priceStr=null;
    }
    const dist=distUnits!==null?distUnits/scale:Math.abs(entry-stop);
    const geomOk=s===1?(stop>0&&stop<entry&&target>entry):(stop>entry&&target<entry&&target>0);
    if(!geomOk||!(dist>0))return Object.assign(base,{status:'NOT_EXECUTABLE',reasons:['PLAN_GEOMETRY'],entry,stop,target,priceStr});
    const cost=st.costBps/1e4;
    const lossPerUnit=dist+cost*Math.max(entry,stop);                 // rugi di SL + biaya round-trip (konservatif)
    const gainPerUnit=Math.abs(target-entry)-cost*Math.max(entry,target);
    const budget=st.capital*st.riskPct/100;
    const qtyRaw=budget/lossPerUnit;
    let qty,qtyStr=null;
    if(sg){const q=snap(qtyRaw,sg,'down');qty=q.num;qtyStr=q.str;}else qty=qtyRaw;
    const stopFrac=dist/entry,lev=safeLeverage(stopFrac,p.symbol,rank);
    const liqFrac=1/lev-mmr;
    const notional=qty*entry,margin=notional/lev;
    const out=Object.assign(base,{entry,stop,target,priceStr,qty,qtyStr,qtyRaw,budget,
      lossAtStop:qty*lossPerUnit,lossPctCapital:100*qty*lossPerUnit/st.capital,gainAtTarget:qty*gainPerUnit,
      rr:Math.abs(target-entry)/dist,stopPct:100*stopFrac,leverage:lev,mmr,liqPct:100*liqFrac,
      liqPrice:entry*(1-s*liqFrac),notional,margin,settings:{capital:st.capital,riskPct:st.riskPct,costBps:st.costBps}});
    if(rules&&rules.status&&rules.status!=='TRADING'){out.status='PAIR_NOT_TRADING';out.reasons.push('PAIR_NOT_TRADING');return out;}
    if(!out.rounded){out.status='UNROUNDED';return out;}
    if(!(qty>0)||qty<rules.minQty-1e-12)out.reasons.push('BELOW_MIN_QTY');
    if(qty>rules.maxQty)out.reasons.push('ABOVE_MAX_QTY');
    if(notional<rules.minNotional)out.reasons.push('BELOW_MIN_NOTIONAL');
    if(margin>st.capital)out.reasons.push('MARGIN_EXCEEDS_CAPITAL');
    out.status=out.reasons.length?'NOT_EXECUTABLE':'READY';
    return out;
  }

  const STATUS_TEXT={READY:'Siap salin',UNROUNDED:'Belum dibulatkan — aturan pair tidak tersedia',NEED_SETTINGS:'Isi modal untuk melihat rencana siap salin',
    INVALID_SETTINGS:'Pengaturan tidak valid',NOT_EXECUTABLE:'Tidak bisa dieksekusi dengan modal ini',PAIR_NOT_TRADING:'Pair tidak sedang diperdagangkan',NO_PLAN:'Rencana belum tersedia'};
  const REASON_TEXT={BELOW_MIN_QTY:'qty di bawah minimum pair',ABOVE_MAX_QTY:'qty di atas maksimum pair',BELOW_MIN_NOTIONAL:'notional di bawah minimum pair',
    MARGIN_EXCEEDS_CAPITAL:'margin melebihi modal',PLAN_GEOMETRY:'urutan harga SL/entry/TP tidak sah setelah pembulatan',PAIR_NOT_TRADING:'status pair bukan TRADING'};
  return {MMR,MAX_LEV,TOP_TIER,LIMITS,DEFAULTS,RULES_TTL_MS,decimalsOf,makeGrid,snap,parseRules,validateSettings,safeLeverage,plan,mmrOf,STATUS_TEXT,REASON_TEXT};
});
