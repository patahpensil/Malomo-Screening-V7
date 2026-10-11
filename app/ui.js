/* Malomo V7 — tampilan tiga layar (PRD v1.0.13 R35): Decision (hard gate, skor terkunci), Semua Pair (universe 100),
   Jurnal Sinyal (hasil + unduh CSV). Fungsi di sini hanya menyusun HTML; tidak menghitung skor, tidak mengubah keputusan.
   Aturan UI: tanpa tombol order; M6 selalu indeks (bukan win rate); null tampil "—"; arah = teks + ikon; waktu UTC + WITA. */
(function(root){
  'use strict';
  const M=root.Malomo,L=M.labels,X=M.exec,LG=M.ledger;
  const e=L.esc;
  const fin=x=>typeof x==='number'&&Number.isFinite(x);
  const side=s=>`<span class="side ${e(s)}">${e(L.sideText(s))}</span>`;
  const sc=(v,max)=>fin(v)?`${e(L.score(v))}${max?' / '+max:''}`:'—';

  // ---------- status ----------
  function health(state,loading){
    if(!state)return `<span class="dot neutral"></span><span>${loading?'Memuat data…':'Belum ada data'}</span>`;
    const s=state.cycle.summary;
    if(s.fetch_failed.length)return `<span class="dot warn"></span><span>Mengambil ulang (FETCH_FAILED): ${e(s.fetch_failed.join(', '))}</span>`;
    const g=(state.health||[]).filter(h=>h.gaps>0&&h.fetch!=='OK');
    if(g.length)return `<span class="dot reject"></span><span>Candle hilang (CONFIRMED_GAP): ${e(g.map(h=>h.symbol).join(', '))}</span>`;
    return '<span class="dot ok"></span><span>Data lengkap</span>';
  }
  function universeLine(u,snap){
    if(!u)return '<span class="muted small">Universe: memuat…</span>';
    if(u.source==='core')return `<span class="warnbox inline">⚠ Universe 100 pair belum bisa ditetapkan (${e(u.error||'')}). Sementara hanya 6 pair inti; dicoba ulang tiap 5 menit.</span>`;
    return `<span class="muted small" data-universe="${u.list.length}">Universe: <b>${u.list.length} pair</b> volume 24 jam tertinggi · realtime${snap&&snap.T?` · gate keputusan close ${e(L.hm(snap.T))} UTC`:''}</span>`;
  }

  // ---------- R33 rezim BTC ----------
  const RG={ALIGNED:['Searah BTC','primary'],OPPOSED:['Berlawanan dengan BTC','warn'],BTC_TRANSITION:['BTC transisi','neutral'],UNAVAILABLE:['Rezim BTC: —','neutral']};
  function regimeChip(rg){
    if(!rg)return '';const [t,tone]=RG[rg.code]||RG.UNAVAILABLE;
    return `<span class="chip ${tone} rg" data-regime="${e(rg.code)}" title="Informasi saja, bukan gate. Struktur M1 BTC: ${e(L.STRUCT[rg.label]||'—')}">${e(t)}</span>`;
  }

  // ---------- R32 rencana siap salin ----------
  const usdt=v=>fin(v)?v.toFixed(2)+' USDT':'—';
  const ERR={EMPTY:'wajib diisi',INVALID:'tidak valid'};
  // R36: status simpan pengaturan — selalu terlihat, supaya jelas tersimpan atau belum.
  function execSaveStatus(ex){
    const sv=X.validateSettings(ex.settings);
    if(ex.storeFailed)return '<div id="exec-save-status" class="save-st bad" data-save="failed">⚠ Gagal menyimpan di browser ini (penyimpanan diblokir/penuh). Pengaturan hanya berlaku sampai halaman ditutup.</div>';
    if(ex.dirty)return '<div id="exec-save-status" class="save-st warn" data-save="dirty">● Belum disimpan — tekan <b>Simpan</b>. Rencana masih memakai pengaturan tersimpan.</div>';
    if(!sv.ok)return '<div id="exec-save-status" class="save-st warn" data-save="none">Belum ada pengaturan tersimpan. Isi modal lalu tekan <b>Simpan</b>.</div>';
    return `<div id="exec-save-status" class="save-st ok" data-save="saved">✓ Tersimpan${ex.justSaved?' baru saja':''} · modal ${e(ex.settings.capital)} USDT · risiko ${e(ex.settings.riskPct)}% · biaya ${e(ex.settings.costBps)} bps${ex.savedAt?' · '+e(L.time(ex.savedAt)):''}</div>`;
  }
  function execForm(ex){
    const d=ex.draft||ex.settings,v=X.validateSettings(d),errs=ex.saveError?v.errors||{}:{},saved=X.validateSettings(ex.settings).ok;
    const rs=ex.rulesAt?`dimuat ${L.time(ex.rulesAt)}`:ex.rulesError?'gagal dimuat — rencana tampil belum dibulatkan':'memuat…';
    const field=(k,label,ph,hint)=>`<label class="exf${errs[k]?' bad':''}"><span>${e(label)}</span><input data-exec="${k}" inputmode="decimal" autocomplete="off" value="${e(d[k]??'')}" placeholder="${e(ph)}"><small>${errs[k]?e(ERR[errs[k]]||'tidak valid')+' · ':''}${e(hint)}</small></label>`;
    const badge=ex.dirty?'<span class="chip warn" data-save-badge="dirty">● belum disimpan</span>':saved?'<span class="chip primary" data-save-badge="saved">✓ tersimpan</span>':'<span class="chip warn" data-save-badge="none">belum ada</span>';
    return `<details class="exec-form" data-exec-form${!saved||ex.dirty||ex.saveError||ex.justSaved?' open':''}><summary><b>Pengaturan rencana siap salin</b> ${badge}<span class="muted small"> ${saved?'modal '+e(ex.settings.capital)+' USDT · risiko '+e(ex.settings.riskPct)+'% · biaya '+e(ex.settings.costBps)+' bps':''}</span></summary>
      <div class="exf-grid">${field('capital','Modal alokasi (USDT)','mis. 1000','wajib, > 0')}${field('riskPct','Risiko per trade (%)','0.5','0,5 – 1')}${field('costBps','Biaya round-trip (bps)','18','0 – 50')}</div>
      <div class="exf-actions"><button class="btn primary" data-action="save-exec">Simpan</button>${ex.dirty?'<button class="btn" data-action="cancel-exec">Batalkan</button>':''}</div>
      ${ex.saveError?'<div class="save-st bad" data-save="invalid">⚠ Tidak disimpan: perbaiki isian yang ditandai merah.</div>':''}${execSaveStatus(ex)}
      <div class="muted small" style="margin-top:6px">Tersimpan hanya di browser ini · aturan pair Binance: ${e(rs)} · leverage dihitung otomatis per sinyal.</div></details>`;
  }
  const copyBtn=(val,label)=>`<button class="btn copy" data-action="copy-val" data-val="${e(val)}" aria-label="Salin ${e(label)}">Salin</button>`;
  function execPanel(input,ex){
    if(!ex)return '';
    const rules=ex.rules&&ex.rules[input.symbol]||null,pl=X.plan(input,ex.settings,rules);
    const tone=pl.status==='READY'?'primary':pl.status==='UNROUNDED'||pl.status==='NEED_SETTINGS'?'warn':'reject';
    let h=`<div class="exec" data-exec-status="${e(pl.status)}"><div class="exec-head"><b>Rencana siap salin</b><span class="chip ${tone}">${e(X.STATUS_TEXT[pl.status]||pl.status)}</span></div>`;
    if(pl.status==='NEED_SETTINGS'||pl.status==='INVALID_SETTINGS'||pl.status==='NO_PLAN')return h+`<div class="muted small">${pl.status==='NO_PLAN'?'Rencana belum tersedia.':'Isi pengaturan (modal, risiko, biaya) di bagian atas layar Decision.'}</div></div>`;
    const rd=pl.rounded,ps=pl.priceStr;
    const cell=(k,lab,str,num)=>`<div class="exv"><span>${e(lab)}</span><b class="mono" data-exv="${k}">${e(rd&&str?str:L.price(num))}</b>${rd&&str&&pl.status!=='PAIR_NOT_TRADING'?copyBtn(str,lab):''}</div>`;
    h+=`<div class="exv-grid">${cell('entry','Entry limit',ps&&ps.entry,pl.entry)}${cell('stop','SL',ps&&ps.stop,pl.stop)}${cell('target','TP',ps&&ps.target,pl.target)}${cell('qty','Qty',pl.qtyStr,pl.qty)}</div>`;
    if(pl.reasons.length)h+=`<div class="warnbox" style="margin-top:8px">⚠ ${e(pl.reasons.map(x=>X.REASON_TEXT[x]||x).join(' · '))}</div>`;
    h+=`<dl class="kv exk"><dt>Leverage maks aman (perkiraan)</dt><dd data-exv="lev"><b>${e(String(pl.leverage))}×</b></dd>
      <dt>Margin pada ${e(String(pl.leverage))}×</dt><dd>${e(usdt(pl.margin))} · notional ${e(usdt(pl.notional))}</dd>
      <dt>Rugi bila SL kena</dt><dd data-exv="loss">${e(usdt(pl.lossAtStop))} (${e(L.pct(pl.lossPctCapital))} modal, termasuk biaya)</dd>
      <dt>Untung bila TP kena</dt><dd>${e(usdt(pl.gainAtTarget))} setelah biaya · RR 1:${e(pl.rr.toFixed(2))}</dd>
      <dt>Jarak SL · likuidasi (perkiraan)</dt><dd>${e(pl.stopPct.toFixed(2))}% · ±${e(pl.liqPct.toFixed(2))}% (≈ ${e(L.price(pl.liqPrice))}, MMR asumsi ${e((pl.mmr*100).toFixed(1))}%)</dd></dl>`;
    h+=`<div class="note">${rd?'':'Angka mentah, belum kelipatan tick — jangan disalin sebagai order. '}Set leverage di Binance ≤ ${e(String(pl.leverage))}×. Pasang limit order; bila tidak terisi, lewati — jangan kejar dengan market order. Rencana ini tidak mengirim order.</div></div>`;
    return h;
  }

  // ---------- Layar 1: Decision ----------
  const invShort=inv=>!inv?'—':inv.rule==='CLOSE_BELOW_LEVEL_MINUS_R'?'Invalidasi: close < '+L.price(inv.price):inv.rule==='CLOSE_ABOVE_LEVEL_PLUS_R'?'Invalidasi: close > '+L.price(inv.price):'Invalidasi: kedalaman > 0.85 ('+L.price(inv.price)+')';
  function decisionCard(en,c){
    const {live,now,ex}=c,long=en.side==='LONG',tk=live.prices[en.symbol],px=tk?tk.price:NaN,d=live.data(en.symbol),risk=Math.abs(en.entry-en.stop);
    const R=px>0&&risk>0?(long?px-en.entry:en.entry-px)/risk:null;
    const lo=Math.min(en.stop,en.target),hi=Math.max(en.stop,en.target),frac=v=>Math.max(0,Math.min(1,(v-lo)/(hi-lo)))*100,fromStop=v=>long?frac(v):100-frac(v);
    let oi='<div class="val">memuat…</div>';
    if(d.oi>0&&px>0){const chg=d.oiBase>0?(d.oi/d.oiBase-1)*100:null;oi=`<div class="val">${e(L.compactUsd(d.oi*px))}</div><div class="sub">${chg!==null?(chg>=0?'+':'')+chg.toFixed(2)+'% sejak dipantau':''}</div>`;}
    const c5=live.cvd5(en.symbol);
    const cvd=d.wsOn||(d.cvdWin&&d.cvdWin.length)?`<div class="val ${d.cvd>=0?'pos':'neg'}">${d.cvd>=0?'+':''}${e(L.compactUsd(d.cvd))}</div><div class="sub">5 mnt: ${c5>=0?'+':''}${e(L.compactUsd(c5))} · sejak dipantau</div>`:'<div class="val">menyambung…</div><div class="sub">menunggu trade pertama</div>';
    const ob=d.imb!==undefined?`<div class="val">Bid ${Math.round((1+d.imb)*50)}% · Ask ${Math.round((1-d.imb)*50)}%</div><div class="sub">20 level · spread ${d.bid>0&&d.ask>0?((d.ask-d.bid)/d.bid*100).toFixed(3)+'%':'—'}</div>`:'<div class="val">menyambung…</div><div class="sub">menunggu snapshot orderbook</div>';
    const inv=en.invalidation,invWarn=inv&&px>0&&(inv.rule.startsWith('CLOSE_BELOW')?px<inv.price:inv.rule.startsWith('CLOSE_ABOVE')?px>inv.price:false);
    const o=en.outcome||{code:'OPEN'},release=en.entryMs+LG.HOLD,s=en.scores;
    const oTxt=o.code==='OPEN'?`Berjalan · slot 24 jam lepas dalam ${L.durationShort(release-now)}`:`${LG.OUTCOME_TEXT[o.code]||o.code} ${L.time(o.atMs)}${fin(o.r)?' ('+(o.r>=0?'+':'')+o.r.toFixed(2)+'R)':''}`;
    return `<div class="dec-card ${e(en.side)}" data-dec="${e(en.key)}">
      <div class="dec-head"><span class="run-tag"><span class="run-dot"></span>${o.code==='OPEN'?'RUNNING':'SELESAI'}</span><span class="dec-sym">${e(en.symbol.replace(/USDT$/,''))}</span>${en.rank?`<span class="muted small">#${en.rank}</span>`:''}${side(en.side)}<span class="chip neutral">${e(L.FAMILY[en.family]||en.family)}</span>${regimeChip(en.regime)}
        <div class="dec-meta">keputusan ${e(L.time(en.decisionMs))} · ${e(L.date(en.decisionMs))}</div></div>
      <div class="dec-scores" data-locked="1"><div><span>M1 + M2q</span><b data-score="m1m2q">${sc(s.m1m2q,180)}</b></div><div><span>M6 (indeks)</span><b data-score="m6">${sc(s.m6,500)}</b></div><div><span>M1 Struktur</span><b>${sc(s.m1)}</b></div><div><span>M2 Kualitas</span><b>${sc(s.m2q)}</b></div><div class="lock" title="Skor dibekukan saat masuk Decision; refresh data tidak mengubahnya">🔒 skor dikunci</div></div>
      <div class="dec-price"><span class="px">${px>0?e(L.price(px)):'—'}</span><span class="rr ${fin(R)&&R>=0?'pos':'neg'}">${fin(R)?(R>=0?'+':'')+R.toFixed(2)+'R':'—'}</span></div>
      <div class="dec-prog" title="Stop → Entry → Target"><div class="fill" style="width:${px>0?fromStop(px):0}%"></div><div class="mark" style="left:${fromStop(en.entry)}%"></div>${px>0?`<div class="now" style="left:${fromStop(px)}%"></div>`:''}</div>
      <div class="dec-lv"><div><span>SL</span>${e(L.price(en.stop))}</div><div><span>ENTRY</span>${e(L.price(en.entry))}</div><div><span>TP (2R)</span>${e(L.price(en.target))}</div><div><span>RR</span>1:${(Math.abs(en.target-en.entry)/risk).toFixed(2)}</div></div>
      <div class="dec-outcome ${o.code==='STOP_HIT'?'neg':o.code==='TARGET_HIT'?'pos':'muted'}">${e(oTxt)}</div>
      ${execPanel({symbol:en.symbol,side:en.side,entry:en.entry,stop:en.stop,target:en.target},ex)}
      <div class="dec-data"><div class="dec-cell"><div class="lbl">OPEN INTEREST</div>${oi}</div><div class="dec-cell"><div class="lbl">CVD (TAKER)</div>${cvd}</div><div class="dec-cell"><div class="lbl">ORDERBOOK</div>${ob}</div>
        <div class="dec-cell"><div class="lbl">INVALIDASI</div><div class="sub ${invWarn?'dec-warn':''}">${e(invShort(inv))}${invWarn?'<br>⚠ harga sudah melewati level invalidasi':''}</div></div></div>
      <div class="muted small" style="margin-top:8px">OI · CVD · orderbook hanya tampilan, tidak masuk skor (PRD §4.5).</div></div>`;
  }
  function decisionList(c){
    const act=LG.active(c.ledger,c.now);
    if(!act.length){const nx=c.state?c.state.cycle.nextCloseMs:null;
      return `<div class="empty" data-empty="decision"><b>Belum ada pair yang lolos Decision.</b><br>Dicek ulang otomatis setiap close 4H${nx?' · berikutnya '+e(L.time(nx)):''}.</div>`;}
    return act.map(en=>decisionCard(en,c)).join('');
  }
  function decisionScreen(c){
    const n=LG.active(c.ledger,c.now).length;
    return `<div class="section-head"><h2>Decision</h2><span class="muted small">${n} pair lolos hard gate engine · urut close terbaru lalu M6 · skor dikunci saat masuk</span></div>
      ${execForm(c.ex)}<div id="dec-list" class="dec-list">${decisionList(c)}</div>
      <div class="note" style="margin-top:12px">Decision = status <b>Layak dipertimbangkan</b> PRD (semua gate lolos, termasuk slot &amp; risiko portofolio simulasi). M6 adalah indeks 0–500, bukan peluang menang. Batas skor "layak" belum ditetapkan — menunggu riset Tahap 2.</div>`;
  }

  // ---------- Layar 2: Semua Pair ----------
  function pairData(c){
    const u=c.app.universe,rows=new Map(((c.state&&c.state.pairRows)||[]).map(r=>[r.symbol,r])),act=new Map(LG.active(c.ledger,c.now).map(x=>[x.symbol,x]));
    return (u?u.list:[]).map(x=>{const r=rows.get(x.symbol),t=c.market[x.symbol],d=act.get(x.symbol);
      return {rank:x.rank,symbol:x.symbol,vol:t&&fin(t.quoteVolume)?t.quoteVolume:x.quoteVolume,price:t?t.price:r&&r.close,chg:t?t.changePct:null,
        m1:r?r.m1:null,structure:r?r.structure:null,loaded:!!r,status:d?'DECISION':r&&r.waiting?'WAITING':'NONE',m6:d?d.scores.m6:null};});
  }
  const ST_TXT={DECISION:['Decision','primary'],WAITING:['Setup menunggu','warn'],NONE:['—','neutral']};
  function pairsRows(c,f){
    let rows=pairData(c);
    if(f.structure)rows=rows.filter(r=>r.structure===f.structure);
    if(f.status)rows=rows.filter(r=>r.status===f.status);
    if(f.q){const q=f.q.trim().toUpperCase();rows=rows.filter(r=>r.symbol.includes(q));}
    if(f.sort==='m1')rows.sort((a,b)=>(fin(b.m1)?b.m1:-1)-(fin(a.m1)?a.m1:-1)||a.rank-b.rank);
    if(!rows.length)return '<tr><td colspan="8" class="muted small">Tidak ada pair untuk filter ini.</td></tr>';
    return rows.map(r=>`<tr data-pair="${e(r.symbol)}"><td class="num">${r.rank??'—'}</td><td><b>${e(r.symbol)}</b></td><td class="num mono">${e(L.price(r.price))}</td>
      <td class="num ${fin(r.chg)?(r.chg>=0?'pos':'neg'):''}">${fin(r.chg)?(r.chg>=0?'+':'')+r.chg.toFixed(2)+'%':'—'}</td><td class="num">${e(L.compactUsd(r.vol))}</td>
      <td>${r.loaded?e(L.STRUCT[r.structure]||'—'):'<span class="muted small">memuat…</span>'}</td><td class="num" data-m1>${r.loaded?sc(r.m1,100):'—'}</td>
      <td><span class="chip ${ST_TXT[r.status][1]}">${e(ST_TXT[r.status][0])}</span>${fin(r.m6)?` <span class="mono small">M6 ${e(L.score(r.m6))}</span>`:''}</td></tr>`).join('');
  }
  function pairsScreen(c,f){
    const sel=(k,label,opts)=>`<label>${e(label)}<select data-pf="${k}">${opts.map(([v,t])=>`<option value="${e(v)}"${f[k]===v?' selected':''}>${e(t)}</option>`).join('')}</select></label>`;
    return `<div class="section-head"><h2>Semua Pair</h2><span class="muted small">100 pair USDT perpetual volume 24 jam tertinggi · diperbarui realtime</span></div>
      <div class="filters">${sel('sort','Urut',[['rank','Volume 24 jam'],['m1','M1 tertinggi']])}${sel('structure','Struktur',[['','Semua'],['BULLISH','Bullish'],['BEARISH','Bearish'],['TRANSITION','Transisi']])}
        ${sel('status','Status',[['','Semua'],['DECISION','Decision'],['WAITING','Setup menunggu'],['NONE','Tidak ada']])}<label>Cari<input data-pf="q" value="${e(f.q||'')}" placeholder="mis. SOL"></label></div>
      <div class="table-wrap"><table class="pairs"><thead><tr><th class="num">#</th><th>Pair</th><th class="num">Harga</th><th class="num">24 jam</th><th class="num">Volume 24 jam</th><th>Struktur M1</th><th class="num">M1</th><th>Status</th></tr></thead>
      <tbody id="pairs-body">${pairsRows(c,f)}</tbody></table></div>
      <div class="note" style="margin-top:10px">M1 = skor struktur pair pada candle 4H terakhir yang close (rumus PRD, sama untuk semua pair). M6 hanya ada bila pair masuk Decision. Skor per pair untuk semua 100 pair (pilihan B) sedang dirancang di Tahap 2.</div>`;
  }

  // ---------- Layar 3: Jurnal Sinyal ----------
  function journalScreen(c,f){
    const all=LG.finished(c.ledger),num=v=>{const n=Number(String(v).replace(',','.'));return String(v).trim()!==''&&Number.isFinite(n)?n:null;};
    const rows=LG.filter(all,Object.assign({},f,{m6min:num(f.m6min),m6max:num(f.m6max)})),sm=LG.summary(rows);
    const uniq=k=>[...new Set(all.map(r=>r[k]))].sort();
    const sel=(k,label,opts)=>`<label>${e(label)}<select data-jf="${k}"><option value="">Semua</option>${opts.map(([v,t])=>`<option value="${e(v)}"${f[k]===v?' selected':''}>${e(t)}</option>`).join('')}</select></label>`;
    const stat=(k,label,v)=>`<div class="stat" data-jstat="${k}"><div class="k">${e(label)}</div><div class="v">${v}</div></div>`;
    let h=`<div class="section-head"><h2>Jurnal Sinyal</h2><button class="btn" data-action="download-journal">Unduh CSV (${rows.length})</button></div>
      <div class="filters">${sel('pair','Pair',uniq('symbol').map(s=>[s,s]))}${sel('side','Arah',[['LONG','LONG'],['SHORT','SHORT']])}${sel('family','Keluarga',uniq('family').map(s=>[s,L.FAMILY[s]||s]))}
        ${sel('outcome','Hasil',[['TARGET_HIT','Kena TP'],['STOP_HIT','Kena SL'],['HORIZON_EXIT','Keluar 24 jam'],['NO_DATA','Data tidak ada']])}
        <label>M6 min<input data-jf="m6min" inputmode="decimal" value="${e(f.m6min||'')}" placeholder="mis. 320"></label><label>M6 maks<input data-jf="m6max" inputmode="decimal" value="${e(f.m6max||'')}"></label></div>
      <div class="cards">${stat('n','Sinyal selesai',sm.n)}${stat('tp','Kena TP',sm.TARGET_HIT)}${stat('sl','Kena SL',sm.STOP_HIT)}${stat('hz','Keluar 24 jam',sm.HORIZON_EXIT)}${stat('avg','Rata-rata R',fin(sm.avgR)?(sm.avgR>=0?'+':'')+sm.avgR.toFixed(3):'—')}</div>`;
    if(!rows.length)return h+`<div class="empty" data-empty="jurnal">${all.length?'Belum ada sinyal selesai untuk filter ini.':'Belum ada sinyal Decision yang selesai. Setiap pair yang masuk Decision dicatat otomatis di sini setelah hasilnya (TP / SL / 24 jam) diketahui.'}</div>`;
    h+=`<div class="table-wrap"><table class="journal"><thead><tr><th>Keputusan</th><th>Pair</th><th>Arah</th><th>Keluarga</th><th class="num">M1+M2q</th><th class="num">M6</th><th>Rezim BTC</th>
      <th class="num">Entry</th><th class="num">SL</th><th class="num">TP</th><th>Hasil</th><th class="num">Keluar</th><th class="num">R</th></tr></thead><tbody>`;
    for(const r of rows.slice(0,300)){const o=r.outcome;
      h+=`<tr data-jrow="${e(r.key)}"><td class="small">${e(L.dateTime(r.decisionMs))}</td><td><b>${e(r.symbol)}</b>${r.rank?` <span class="muted small">#${r.rank}</span>`:''}</td><td>${side(r.side)}</td><td>${e(L.FAMILY[r.family]||r.family)}</td>
        <td class="num">${sc(r.scores.m1m2q)}</td><td class="num">${sc(r.scores.m6)}</td><td>${regimeChip(r.regime)||'—'}</td>
        <td class="num mono">${e(L.price(r.entry))}</td><td class="num mono">${e(L.price(r.stop))}</td><td class="num mono">${e(L.price(r.target))}</td>
        <td><span class="chip ${o.code==='TARGET_HIT'?'primary':o.code==='STOP_HIT'?'reject':'neutral'}">${e(LG.OUTCOME_TEXT[o.code]||o.code)}</span><div class="muted small">${e(L.time(o.atMs))}</div></td>
        <td class="num mono">${e(L.price(o.exit))}</td><td class="num ${fin(o.r)?(o.r>=0?'pos':'neg'):''}">${fin(o.r)?(o.r>=0?'+':'')+o.r.toFixed(2):'—'}</td></tr>`;}
    h+='</tbody></table></div>';
    if(rows.length>300)h+=`<div class="muted small">300 terbaru ditampilkan; seluruh ${rows.length} baris ada di unduhan CSV.</div>`;
    return h+'<div class="note" style="margin-top:10px">Hasil menurut candle 4H Binance dengan harga yang dibekukan saat Decision (stop dievaluasi lebih dahulu, horizon 24 jam) — bukan fill order akunmu. Hanya sinyal yang benar-benar masuk Decision saat aplikasi berjalan yang dicatat.</div>';
  }

  root.Malomo.ui={health,universeLine,regimeChip,execForm,execSaveStatus,execPanel,decisionCard,decisionList,decisionScreen,pairsRows,pairsScreen,journalScreen};
})(globalThis);
