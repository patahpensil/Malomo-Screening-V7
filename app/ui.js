/* Malomo V7 — tampilan tiga layar (PRD v1.0.13 R35): Decision (hard gate, skor terkunci), Semua Pair (universe 100),
   Jurnal Sinyal (hasil + unduh CSV). Fungsi di sini hanya menyusun HTML; tidak menghitung skor, tidak mengubah keputusan.
   Aturan UI: tanpa tombol order; M6 selalu indeks (bukan win rate); null tampil "—"; arah = teks + ikon; waktu UTC + WITA. */
(function(root){
  'use strict';
  const M=root.Malomo,L=M.labels,X=M.exec,LG=M.ledger,PF=M.portfolio,PI=M.pairinfo;
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
    const pc=Math.round(100*pl.tp1Frac);
    h+=pl.split?`<div class="exv-grid">${cell('entry','Entry limit',ps&&ps.entry,pl.entry)}${cell('stop','SL',ps&&ps.stop,pl.stop)}${cell('target','TP1 (2R)',ps&&ps.target,pl.target)}${cell('target2','TP2 (3R)',ps&&ps.target2,pl.target2)}${cell('qty','Qty total',pl.qtyStr,pl.qty)}${cell('qty1','Qty TP1 ('+pc+'%)',pl.qty1Str,pl.qty1)}${cell('qty2','Qty TP2 ('+(100-pc)+'%)',pl.qty2Str,pl.qty2)}</div>`
      :`<div class="exv-grid">${cell('entry','Entry limit',ps&&ps.entry,pl.entry)}${cell('stop','SL',ps&&ps.stop,pl.stop)}${cell('target','TP',ps&&ps.target,pl.target)}${cell('qty','Qty',pl.qtyStr,pl.qty)}</div>`;
    if(pl.reasons.length)h+=`<div class="warnbox" style="margin-top:8px">⚠ ${e(pl.reasons.map(x=>X.REASON_TEXT[x]||x).join(' · '))}</div>`;
    h+=`<dl class="kv exk"><dt>Leverage maks aman (perkiraan)</dt><dd data-exv="lev"><b>${e(String(pl.leverage))}×</b></dd>
      <dt>Margin pada ${e(String(pl.leverage))}×</dt><dd>${e(usdt(pl.margin))} · notional ${e(usdt(pl.notional))}</dd>
      <dt>Rugi bila SL kena</dt><dd data-exv="loss">${e(usdt(pl.lossAtStop))} (${e(L.pct(pl.lossPctCapital))} modal, termasuk biaya)</dd>
      ${pl.split?`<dt>Untung bila TP1 kena (${pc}% ditutup)</dt><dd>${e(usdt(pl.gainAtTarget))} setelah biaya · RR 1:${e(pl.rr.toFixed(2))}</dd>
      <dt>Total bila TP2 juga kena</dt><dd data-exv="gain2">${e(usdt(pl.gainAtTarget2))} setelah biaya · RR 1:${e(pl.rr2.toFixed(2))} · SL tetap di tempat setelah TP1</dd>`
      :`<dt>Untung bila TP kena</dt><dd>${e(usdt(pl.gainAtTarget))} setelah biaya · RR 1:${e(pl.rr.toFixed(2))}</dd>`}
      <dt>Jarak SL · likuidasi (perkiraan)</dt><dd>${e(pl.stopPct.toFixed(2))}% · ±${e(pl.liqPct.toFixed(2))}% (≈ ${e(L.price(pl.liqPrice))}, MMR asumsi ${e((pl.mmr*100).toFixed(1))}%)</dd></dl>`;
    h+=`<div class="note">${rd?'':'Angka mentah, belum kelipatan tick — jangan disalin sebagai order. '}Set leverage di Binance ≤ ${e(String(pl.leverage))}×. Pasang limit order; bila tidak terisi, lewati — jangan kejar dengan market order.${pl.split?' Pasang dua TP (qty TP1 dan qty TP2) dengan SL yang sama untuk seluruh qty.':''} Rencana ini tidak mengirim order.</div></div>`;
    return h;
  }

  // ---------- R37 panel risiko portofolio (peringatan saja, tidak memblokir, tidak mengubah skor) ----------
  const LIMIT=Object.freeze({maxPositions:10,openRiskPct:10,ddEvalPct:20,ddMaxPct:50});
  /* Angka panel dari jurnal Decision, dengan anggapan setiap sinyal Decision diambil dengan risiko tersimpan (default 1%).
     risiko terbuka = Σ bagian posisi yang masih menanggung SL (1 sebelum TP1; 1−tp1Frac setelah TP1) × risiko%.
     drawdown = jarak dari puncak kurva hasil kumulatif (Σ R × risiko%, urut waktu keluar), tanpa kompaun. */
  function riskNumbers(ledger,now,riskPct){
    const act=LG.active(ledger,now),open=act.filter(x=>!x.outcome||x.outcome.code==='OPEN');
    const openRisk=open.reduce((s,x)=>s+(x.outcome&&x.outcome.tp1AtMs?1-(fin(x.tp1Frac)?x.tp1Frac:0.5):1),0)*riskPct;
    const done=LG.finished(ledger).filter(x=>fin(x.outcome.r)&&fin(x.outcome.atMs)).sort((a,b)=>a.outcome.atMs-b.outcome.atMs);
    let cum=0,peak=0;for(const x of done){cum+=x.outcome.r*riskPct;peak=Math.max(peak,cum);}
    const longs=open.filter(x=>x.side==='LONG').length;
    return {positions:act.length,open:open.length,longs,shorts:open.length-longs,openRiskPct:openRisk,cumPct:cum,ddPct:peak-cum,trades:done.length,riskPct};
  }
  const savedSettings=c=>{const sv=X.validateSettings(c.ex?c.ex.settings:{});return {ok:sv.ok,capital:sv.ok?sv.capital:null,riskPct:sv.ok?sv.riskPct:X.DEFAULTS.riskPct,costBps:sv.ok?sv.costBps:X.DEFAULTS.costBps};};
  /* R38: panel memakai posisi NYATA (sinyal yang ditandai "Saya ambil" + posisi manual). Baris pembanding = semua sinyal
     Malomo dengan anggapan semuanya diambil (R37). */
  function riskPanel(c){
    const st=savedSettings(c),k=PF.real(c.ledger,c.manual,{now:c.now,capital:st.capital,costBps:st.costBps}),all=riskNumbers(c.ledger,c.now,st.riskPct);
    const pc=v=>fin(v)?v.toFixed(1)+'%':'—';
    const ddTone=!fin(k.ddPct)?'':k.ddPct>=LIMIT.ddMaxPct?'reject':k.ddPct>=LIMIT.ddEvalPct?'warn':'primary';
    const orTone=!fin(k.openRiskPct)?'':k.openRiskPct>LIMIT.openRiskPct+1e-9?'reject':k.openRiskPct>=0.7*LIMIT.openRiskPct?'warn':'primary';
    const posTone=k.positions>LIMIT.maxPositions?'reject':k.positions===LIMIT.maxPositions?'warn':'';
    const ddMsg=fin(k.ddPct)&&k.ddPct>=LIMIT.ddMaxPct?'⚠ Batas rugi 50% tercapai.':fin(k.ddPct)&&k.ddPct>=LIMIT.ddEvalPct?'⚠ Titik evaluasi −20%: berhenti sejenak, cek jurnal.':'';
    const box=(key,label,val,sub,tone)=>`<div class="stat rk ${tone||''}" data-risk="${key}"><div class="k">${e(label)}</div><div class="v">${val}</div><div class="muted small">${sub}</div></div>`;
    return `<div class="risk-panel" data-risk-panel><div class="muted small" style="margin-bottom:6px"><b>Posisi saya</b> — sinyal yang ditandai <b>Saya ambil</b> + posisi manual</div><div class="cards">
      ${box('positions','Posisi terbuka',`${k.positions} / ${LIMIT.maxPositions}`,`${k.taken} dari Decision · ${k.manual} manual · ${k.longs} LONG · ${k.shorts} SHORT`,posTone)}
      ${box('open','Risiko terbuka',pc(k.openRiskPct),`${e(usdt(k.riskUsdt))} bila semua SL kena · batas ${LIMIT.openRiskPct}%`,orTone)}
      ${box('dd','Drawdown dari puncak',pc(k.ddPct),`evaluasi ${LIMIT.ddEvalPct}% · batas ${LIMIT.ddMaxPct}% · ${k.closed} posisi selesai`,ddTone)}
      ${box('cum','Hasil kumulatif',fin(k.cumPct)?(k.cumPct>=0?'+':'')+k.cumPct.toFixed(1)+'%':'—',`${e((k.cumUsdt>=0?'+':'')+usdt(k.cumUsdt))} · perkiraan setelah biaya`,fin(k.cumPct)?(k.cumPct>=0?'primary':'warn'):'')}</div>
      ${k.positions>LIMIT.maxPositions?'<div class="warnbox" style="margin-top:8px" data-risk-warn>⚠ Posisi terbuka melebihi 10.</div>':''}${ddMsg?`<div class="warnbox" style="margin-top:8px" data-risk-warn>${e(ddMsg)}</div>`:''}
      ${k.hasCapital?'':'<div class="warnbox" style="margin-top:8px" data-risk-nocap>Isi & simpan modal di pengaturan supaya persen risiko bisa dihitung.</div>'}
      <div class="muted small" style="margin-top:6px" data-risk-all>Pembanding — semua sinyal Malomo (anggap semua diambil @${e(st.riskPct)}%): ${all.positions} posisi · risiko terbuka ${all.openRiskPct.toFixed(1)}% · drawdown ${all.ddPct.toFixed(1)}% · kumulatif ${(all.cumPct>=0?'+':'')}${all.cumPct.toFixed(1)}%.</div>
      <div class="muted small" style="margin-top:4px">Peringatan saja — tidak memblokir sinyal dan tidak mengubah skor. Catatan dari isianmu, bukan saldo akun Binance.</div></div>`;
  }

  // ---------- R38 posisi manual ----------
  function manualCard(p,c){
    const tk=c.live.prices[p.symbol],px=tk?tk.price:NaN,s=p.side==='LONG'?1:-1,risk=Math.abs(p.entry-p.stop);
    const R=px>0&&risk>0?s*(px-p.entry)/risk:null,upnl=px>0?p.qty*s*(px-p.entry):null;
    return `<div class="dec-card man ${e(p.side)}" data-man="${e(p.id)}">
      <div class="dec-head"><span class="chip warn">MANUAL</span><a class="dec-sym pair-link" href="#" data-action="pair" data-sym="${e(p.symbol)}">${e(p.symbol.replace(/USDT$/,''))}</a>${side(p.side)}
        <div class="dec-meta">dibuka ${e(L.time(p.openedMs))} · ${e(L.date(p.openedMs))}${p.tp1AtMs?' · TP1 kena '+e(L.time(p.tp1AtMs)):''}</div></div>
      <div class="dec-price"><span class="px">${px>0?e(L.price(px)):'—'}</span><span class="rr ${fin(R)&&R>=0?'pos':'neg'}">${fin(R)?(R>=0?'+':'')+R.toFixed(2)+'R':'—'}${fin(upnl)?' · '+(upnl>=0?'+':'')+e(usdt(upnl)):''}</span></div>
      <div class="dec-lv"><div><span>SL</span>${e(L.price(p.stop))}</div><div><span>ENTRY</span>${e(L.price(p.entry))}</div><div><span>TP1</span>${fin(p.target)?e(L.price(p.target)):'—'}</div><div><span>TP2</span>${fin(p.target2)?e(L.price(p.target2)):'—'}</div></div>
      <div class="muted small">Qty ${e(String(+p.qty.toPrecision(8)))} · risiko ${e(usdt(PF.openRisk(PF.fromManual(p))))} · tanpa skor Malomo · ditutup otomatis bila SL/TP kena (candle 4H close)</div>
      <div class="exf-actions"><button class="btn" data-action="man-close-open" data-id="${e(p.id)}">Tutup</button><button class="btn" data-action="man-delete" data-id="${e(p.id)}">Hapus (salah input)</button></div></div>`;
  }
  function manualList(c){
    const open=PF.openManual(c.manual);
    if(!open.length)return '<div class="muted small" data-empty="manual">Belum ada posisi manual terbuka.</div>';
    return open.map(p=>manualCard(p,c)).join('');
  }

  // ---------- R38 lembar isian (Saya ambil / posisi manual / tutup manual) ----------
  const ERRS={INVALID:'tidak valid',BEYOND_STOP:'entry sudah melewati SL',WRONG_SIDE:'di sisi yang salah',NEED_TP1:'isi TP1 dulu',NEED_CAPITAL:'isi qty, atau simpan modal dulu',NOT_FOUND:'tidak ditemukan',NOT_OPEN:'posisi sudah tertutup'};
  function sheet(c,sh){
    if(!sh)return '';
    const err=k=>sh.errors&&sh.errors[k]?`<small class="bad">${e(ERRS[sh.errors[k]]||sh.errors[k])}</small>`:'';
    const inp=(k,label,val,extra='')=>`<label class="exf${sh.errors&&sh.errors[k]?' bad':''}"><span>${e(label)}</span><input data-sh="${k}" inputmode="decimal" autocomplete="off" value="${e(val??'')}" ${extra}>${err(k)}</label>`;
    let title='',body='',save='';
    if(sh.type==='take'){const en=c.ledger.entries[sh.key];if(!en)return '';
      title=`Saya ambil — ${e(en.symbol)} ${e(en.side)}`;
      body=`<div class="muted small">Isi harga entry dan qty yang <b>benar-benar terisi</b> di Binance. SL/TP mengikuti sinyal: SL ${e(L.price(en.stop))} · TP1 ${e(L.price(en.target))}${fin(en.target2)?' · TP2 '+e(L.price(en.target2)):''}.</div>
        <div class="exf-grid">${inp('entry','Harga entry',sh.prefill.entry)}${inp('qty','Qty',sh.prefill.qty)}</div>`;
      save='take-save';}
    else if(sh.type==='manual'){const v=sh.prefill||{};
      title='Posisi manual baru';
      const opts=(c.app.eligible||[]).slice().sort();
      body=`<div class="muted small">Posisi di luar sinyal Malomo. Tidak punya skor; hanya dicatat untuk panel risiko & jurnal.</div>
        <div class="exf-grid"><label class="exf${sh.errors&&sh.errors.symbol?' bad':''}"><span>Pair</span><input data-sh="symbol" list="sym-list" autocomplete="off" value="${e(v.symbol||'')}" placeholder="mis. SOLUSDT"><datalist id="sym-list">${opts.map(x=>`<option value="${e(x)}">`).join('')}</datalist>${err('symbol')}</label>
        <label class="exf"><span>Arah</span><select data-sh="side"><option value="LONG"${v.side!=='SHORT'?' selected':''}>LONG</option><option value="SHORT"${v.side==='SHORT'?' selected':''}>SHORT</option></select>${err('side')}</label>
        ${inp('entry','Entry',v.entry)}${inp('stop','SL',v.stop)}${inp('target','TP1 (opsional)',v.target)}${inp('target2','TP2 (opsional, 50/50)',v.target2)}
        ${inp('qty','Qty (kosong = dari risiko %)',v.qty)}${inp('riskPct','Risiko % (bila qty kosong)',v.riskPct??String(savedSettings(c).riskPct))}</div>`;
      save='man-save';}
    else if(sh.type==='close'){const p=c.manual.positions[sh.id];if(!p)return '';
      title=`Tutup posisi manual — ${e(p.symbol)} ${e(p.side)}`;
      body=`<div class="muted small">Sisa qty ditutup pada harga yang diisi (default = harga terakhir).</div><div class="exf-grid">${inp('exit','Harga keluar',sh.prefill.exit)}</div>`;
      save='man-close-save';}
    return `<div class="sheet-back" data-action="sheet-cancel"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${title}" data-sheet="${e(sh.type)}"><h3>${title}</h3>${body}
      ${sh.errors&&sh.errors.key?`<div class="warnbox">${e(ERRS[sh.errors.key]||sh.errors.key)}</div>`:''}
      <div class="exf-actions"><button class="btn primary" data-action="${save}">Simpan</button><button class="btn" data-action="sheet-cancel">Batal</button></div></div>`;
  }

  // ---------- R39 Detail Pair (informasi saja: bukan gate, tidak masuk skor) ----------
  const EMA_COLOR={21:'#3E9FD6',30:'#C27E1F',50:'#A766DE'};   // tervalidasi: band L, CVD, kontras vs #13140F
  const sgn=(v,d=2,suf='%')=>fin(v)?(v>=0?'+':'')+v.toFixed(d)+suf:'—';
  function candleChart(ch,width){
    const cs=ch.candles;if(!cs.length)return '<div class="muted small">Candle belum tersedia.</div>';
    // lebar = lebar layar nyata (tanpa peregangan) supaya teks sumbu tetap 10 px dan tidak terpotong
    const W=Math.round(fin(width)?width:640),H=240,P={l:4,r:66,t:10,b:12},n=cs.length,cw=(W-P.l-P.r)/n;
    let lo=Infinity,hi=-Infinity;for(const x of cs){lo=Math.min(lo,x.low);hi=Math.max(hi,x.high);}
    for(const k of PI.EMAS)for(const v of ch.ema[k])if(fin(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);}
    const pad=(hi-lo)*0.04||hi*0.01;lo-=pad;hi+=pad;
    const y=v=>P.t+(hi-v)/(hi-lo)*(H-P.t-P.b),x=i=>P.l+cw*(i+0.5);
    let g='';
    for(let i=0;i<3;i++){const v=lo+(hi-lo)*(i+0.5)/3;g+=`<line x1="${P.l}" x2="${W-P.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/><text x="${W-P.r+4}" y="${(y(v)+3).toFixed(1)}" class="axis">${e(L.price(v))}</text>`;}
    const body=Math.max(1,cw*0.6);
    for(let i=0;i<n;i++){const c=cs[i],up=c.close>=c.open,cl=up?'up':'dn';
      g+=`<line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${y(c.high).toFixed(1)}" y2="${y(c.low).toFixed(1)}" class="wick ${cl}"/>`;
      const t=y(Math.max(c.open,c.close)),b=y(Math.min(c.open,c.close));
      g+=`<rect x="${(x(i)-body/2).toFixed(1)}" y="${t.toFixed(1)}" width="${body.toFixed(1)}" height="${Math.max(1,b-t).toFixed(1)}" class="body ${cl}" rx="1"/>`;}
    let lbl='';
    for(const k of PI.EMAS){const vs=ch.ema[k];let d='',pen=false;
      vs.forEach((v,i)=>{if(!fin(v)){pen=false;return;}d+=(pen?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)+' ';pen=true;});
      if(d)g+=`<path d="${d}" fill="none" stroke="${EMA_COLOR[k]}" stroke-width="2" stroke-linejoin="round" data-ema="${k}"/>`;}
    // direct label tanpa tumpang tindih: hanya bila jarak vertikal antar-label ≥ 11 px
    const ends=PI.EMAS.map(k=>({k,v:ch.ema[k][ch.ema[k].length-1]})).filter(o=>fin(o.v)).sort((a,b)=>y(a.v)-y(b.v));
    let lastY=-99;for(const o of ends){const yy=Math.max(y(o.v)+3,lastY+11);lbl+=`<text x="${W-P.r+4}" y="${yy.toFixed(1)}" class="axis lbl" fill="${EMA_COLOR[o.k]}">${o.k}</text>`;lastY=yy;}
    return `<div class="chart-wrap"><div class="legend">${PI.EMAS.map(k=>`<span><i style="background:${EMA_COLOR[k]}"></i>EMA ${k}</span>`).join('')}<span class="muted">· 4H, ${n} candle close terakhir</span></div>
      <svg class="pchart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-chart data-n="${n}" data-pl="${P.l}" data-pr="${P.r}" data-w="${W}" role="img" aria-label="Grafik candle 4H dengan EMA 21, 30, 50">${g}${lbl}
        <line class="xhair" x1="0" x2="0" y1="${P.t}" y2="${H-P.b}" visibility="hidden"/></svg><div class="chart-tip" id="dt-tip" hidden></div></div>`;
  }
  function chartTip(ch,i){
    const c=ch.candles[i];if(!c)return '';
    return `<b>${e(L.dateTime(c.t+PI.H4))}</b><br>O ${e(L.price(c.open))} · H ${e(L.price(c.high))} · L ${e(L.price(c.low))} · C ${e(L.price(c.close))}<br>`+
      PI.EMAS.map(k=>`<span style="color:${EMA_COLOR[k]}">■</span> EMA${k} ${e(L.price(ch.ema[k][i]))}`).join(' · ');
  }
  function spark(points,color='var(--text-muted)'){
    const p=points.slice(-42);if(p.length<2)return '';
    const W=120,H=28,lo=Math.min(...p.map(x=>x.v)),hi=Math.max(...p.map(x=>x.v)),r=hi-lo||1;
    const d=p.map((x,i)=>(i?'L':'M')+(i*(W-2)/(p.length-1)+1).toFixed(1)+' '+(H-2-(x.v-lo)/r*(H-4)).toFixed(1)).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
  }
  const dsec=(key,title,body)=>`<section class="dsec" data-dsec="${key}"><h4>${e(title)}</h4>${body}</section>`;
  const kv=rows=>`<dl class="kv dkv">${rows.map(([k,v,attr])=>`<dt>${e(k)}</dt><dd${attr?` ${attr}`:''}>${v}</dd>`).join('')}</dl>`;
  const pending=(d,k)=>d.err[k]?`<div class="muted small" data-derr="${k}">Tidak tersedia dari Binance (${e(d.err[k])}).</div>`:'<div class="muted small">memuat…</div>';
  // Bagian live (harga 24 jam, orderbook, CVD) — diperbarui tiap detik tanpa menggambar ulang grafik.
  function detailLive(c,d){
    const sym=d.sym,t=c.market[sym]||{},ld=c.live.data(sym),rank=(c.app.universe&&c.app.universe.list.find(x=>x.symbol===sym)||{}).rank;
    const c5=c.live.cvd5(sym);
    const mkt=kv([['Harga terakhir',`<b class="mono">${e(L.price(t.price))}</b>`,'data-dv="price"'],['Perubahan 24 jam',`<span class="${fin(t.changePct)?(t.changePct>=0?'pos':'neg'):''}">${e(sgn(t.changePct))}</span>`],
      ['High / Low 24 jam',`${e(L.price(t.high))} / ${e(L.price(t.low))}`,'data-dv="hl"'],['Volume 24 jam',e(L.compactUsd(t.quoteVolume))],['Peringkat volume',rank?'#'+rank+' dari 100':'di luar 100 besar']]);
    const ob=ld.imb!==undefined?kv([['Bid / Ask (20 level)',`Bid ${Math.round((1+ld.imb)*50)}% · Ask ${Math.round((1-ld.imb)*50)}%`],['Nilai bid / ask',`${e(L.compactUsd(ld.bidUsd))} / ${e(L.compactUsd(ld.askUsd))}`],['Spread',ld.bid>0&&ld.ask>0?((ld.ask-ld.bid)/ld.bid*100).toFixed(3)+'%':'—']]):'<div class="muted small">menyambung orderbook…</div>';
    const cvd=ld.wsOn||(ld.cvdWin&&ld.cvdWin.length)?kv([['CVD taker sejak dibuka',`<span class="${ld.cvd>=0?'pos':'neg'}">${ld.cvd>=0?'+':''}${e(L.compactUsd(ld.cvd))}</span>`],['CVD 5 menit',`${c5>=0?'+':''}${e(L.compactUsd(c5))}`]]):'<div class="muted small">menunggu trade pertama…</div>';
    return {market:dsec('market','1 · Harga & pasar 24 jam',mkt),book:dsec('book','6 · Orderbook & CVD (live)',ob+cvd)};
  }
  function pairDetail(c,d){
    if(!d)return '';
    const sym=d.sym,D=d.data,em=D.ema;
    let h=`<div class="detail-back" data-action="detail-close"></div><aside class="detail" role="dialog" aria-modal="true" aria-label="Detail ${e(sym)}" data-detail="${e(sym)}">
      <div class="detail-head"><h3>${e(sym)}</h3><span class="chip neutral">informasi · bukan gate</span><button class="btn" data-action="detail-close" aria-label="Tutup detail">Tutup ✕</button></div>
      <div id="dt-market">${detailLive(c,d).market}</div>`;
    // 2 · grafik & EMA
    let emaBody;
    if(em){emaBody=candleChart(em.chart,d.w)+kv(PI.EMAS.map(k=>[`EMA ${k}`,fin(em.last[k])?`<span class="mono">${e(L.price(em.last[k]))}</span> · close ${e(PI.LABEL[em.pos[k]]||'—')} EMA`:'— (riwayat kurang)',`data-dv="ema${k}"`]))
        +`<div class="muted small" data-dv="emaorder">${e(PI.LABEL[em.order]||'—')} · close terakhir ${e(L.price(em.close))} (${e(L.time(em.closeMs))})</div>`;}
    else emaBody=pending(d,'ema');
    h+=dsec('ema','2 · Grafik 4H + EMA 21 / 30 / 50',emaBody);
    // 3 · funding
    const f=D.funding;
    h+=dsec('funding','3 · Funding, mark & index',f?kv([['Funding rate terakhir',`<span class="${fin(f.ratePct)?(f.ratePct>=0?'pos':'neg'):''}">${e(sgn(f.ratePct,4))}</span>`,'data-dv="funding"'],['Funding berikutnya',e(L.time(f.nextMs))],['Mark price',e(L.price(f.mark))],['Index price',e(L.price(f.index))],['Basis mark − index',e(sgn(f.basisPct,3))]]):pending(d,'funding'));
    // 4 · OI
    const oi=D.oi;
    h+=dsec('oi','4 · Open Interest (per 4 jam)',oi&&fin(oi.last)?kv([['OI sekarang',`${e(L.compactUsd(oi.last))} ${spark(oi.points)}`,'data-dv="oi"'],['Perubahan 4 jam',e(sgn(oi.chg4hPct))],['Perubahan 24 jam',e(sgn(oi.chg24hPct))]]):pending(d,'oi'));
    // 5 · long/short
    const rr=(k,label,x)=>x&&fin(x.last)?[label,`<span class="mono">${x.last.toFixed(2)}</span>${fin(x.longPct)?` · L ${x.longPct.toFixed(1)}% / S ${x.shortPct.toFixed(1)}%`:''}${fin(x.buyPct)?` · beli ${x.buyPct.toFixed(1)}%`:''} · 24j ${e(sgn(x.chg24hPct))} ${spark(x.points)}`,`data-dv="${k}"`]:[label,d.err[k]?'tidak tersedia':'memuat…',`data-dv="${k}"`];
    h+=dsec('ls','5 · Long / Short (per 4 jam, 7 hari)',kv([rr('gls','Semua akun (long/short)',D.gls),rr('tla','Top trader — akun',D.tla),rr('tlp','Top trader — posisi',D.tlp),rr('taker','Taker beli / jual',D.taker)])
      +'<div class="muted small">Rasio &gt; 1 = lebih banyak long (atau beli). Data Binance hanya tersedia 30 hari terakhir.</div>');
    h+=`<div id="dt-book">${detailLive(c,d).book}</div>`;
    // 7 · Malomo
    const pr=c.state&&(c.state.pairRows||[]).find(r=>r.symbol===sym),act=LG.active(c.ledger,c.now).filter(x=>x.symbol===sym);
    const status=act.length?'Decision':pr&&pr.waiting?'Setup menunggu':'Tidak ada sinyal';
    let mal=kv([['Status',`<span class="chip ${act.length?'primary':pr&&pr.waiting?'warn':'neutral'}" data-dv="status">${e(status)}</span>`],['Struktur M1',pr?e(L.STRUCT[pr.structure]||'—'):'pair belum dianalisis'],['Skor M1',pr?sc(pr.m1,100):'—','data-dv="m1"']]);
    for(const en of act)mal+=`<div class="muted small" data-dv="dec">${side(en.side)} ${e(L.FAMILY[en.family]||en.family)} · M6 ${sc(en.scores.m6,500)} · M1+M2q ${sc(en.scores.m1m2q,180)} · keputusan ${e(L.time(en.decisionMs))}</div>`;
    h+=dsec('malomo','7 · Data Malomo',mal);
    // 8 · aturan pair
    const rl=c.ex.rules[sym],rank=(c.app.universe&&c.app.universe.list.find(x=>x.symbol===sym)||{}).rank;
    const cap=X.MAX_LEV[sym]??(Number.isInteger(rank)&&rank<=X.TOP_TIER?X.MAX_LEV.DEFAULT:X.MAX_LEV.SMALL);
    const levs=act.map(en=>X.safeLeverage(Math.abs(en.entry-en.stop)/en.entry,sym,rank)).filter(fin);
    h+=dsec('rules','8 · Aturan pair',rl?kv([['Tick size',`<span class="mono">${e(rl.tickSize)}</span>`],['Step size',`<span class="mono">${e(rl.stepSize)}</span>`],['Min notional',e(rl.minNotional+' USDT')],['Status',e(rl.status)],
      ['Leverage maks aman',levs.length?`<b>${levs.join('× / ')}×</b> (dari jarak SL sinyal)`:`batas pribadi ${cap}× · dihitung per sinyal dari jarak SL`,'data-dv="lev"'],['MMR asumsi',(X.mmrOf(sym,rank)*100).toFixed(1)+'%']]):'<div class="muted small">Aturan pair belum dimuat.</div>');
    h+=`<div class="muted small" style="margin-top:8px">Semua data di panel ini hanya informasi: bukan gate, tidak masuk skor M1–M6, dan tidak mengubah keputusan. Data publik Binance, tanpa API key.</div></aside>`;
    return h;
  }

  // ---------- Layar 1: Decision ----------
  const invShort=inv=>!inv?'—':inv.rule==='CLOSE_BELOW_LEVEL_MINUS_R'?'Invalidasi: close < '+L.price(inv.price):inv.rule==='CLOSE_ABOVE_LEVEL_PLUS_R'?'Invalidasi: close > '+L.price(inv.price):'Invalidasi: kedalaman > 0.85 ('+L.price(inv.price)+')';
  function decisionCard(en,c){
    const {live,now,ex}=c,long=en.side==='LONG',tk=live.prices[en.symbol],px=tk?tk.price:NaN,d=live.data(en.symbol),risk=Math.abs(en.entry-en.stop);
    const R=px>0&&risk>0?(long?px-en.entry:en.entry-px)/risk:null;
    const far=fin(en.target2)?en.target2:en.target,lo=Math.min(en.stop,far),hi=Math.max(en.stop,far),frac=v=>Math.max(0,Math.min(1,(v-lo)/(hi-lo)))*100,fromStop=v=>long?frac(v):100-frac(v);
    let oi='<div class="val">memuat…</div>';
    if(d.oi>0&&px>0){const chg=d.oiBase>0?(d.oi/d.oiBase-1)*100:null;oi=`<div class="val">${e(L.compactUsd(d.oi*px))}</div><div class="sub">${chg!==null?(chg>=0?'+':'')+chg.toFixed(2)+'% sejak dipantau':''}</div>`;}
    const c5=live.cvd5(en.symbol);
    const cvd=d.wsOn||(d.cvdWin&&d.cvdWin.length)?`<div class="val ${d.cvd>=0?'pos':'neg'}">${d.cvd>=0?'+':''}${e(L.compactUsd(d.cvd))}</div><div class="sub">5 mnt: ${c5>=0?'+':''}${e(L.compactUsd(c5))} · sejak dipantau</div>`:'<div class="val">menyambung…</div><div class="sub">menunggu trade pertama</div>';
    const ob=d.imb!==undefined?`<div class="val">Bid ${Math.round((1+d.imb)*50)}% · Ask ${Math.round((1-d.imb)*50)}%</div><div class="sub">20 level · spread ${d.bid>0&&d.ask>0?((d.ask-d.bid)/d.bid*100).toFixed(3)+'%':'—'}</div>`:'<div class="val">menyambung…</div><div class="sub">menunggu snapshot orderbook</div>';
    const inv=en.invalidation,invWarn=inv&&px>0&&(inv.rule.startsWith('CLOSE_BELOW')?px<inv.price:inv.rule.startsWith('CLOSE_ABOVE')?px>inv.price:false);
    const o=en.outcome||{code:'OPEN'},release=en.entryMs+LG.HOLD,s=en.scores;
    const oTxt=o.code==='OPEN'?`${o.tp1AtMs?'TP1 kena '+L.time(o.tp1AtMs)+' · sisa berjalan · ':'Berjalan · '}slot 24 jam lepas dalam ${L.durationShort(release-now)}`:`${LG.outcomeText(en)} ${L.time(o.atMs)}${fin(o.r)?' ('+(o.r>=0?'+':'')+o.r.toFixed(2)+'R)':''}`;
    return `<div class="dec-card ${e(en.side)}" data-dec="${e(en.key)}">
      <div class="dec-head"><span class="run-tag"><span class="run-dot"></span>${o.code==='OPEN'?'RUNNING':'SELESAI'}</span><a class="dec-sym pair-link" href="#" data-action="pair" data-sym="${e(en.symbol)}">${e(en.symbol.replace(/USDT$/,''))}</a>${en.rank?`<span class="muted small">#${en.rank}</span>`:''}${side(en.side)}<span class="chip neutral">${e(L.FAMILY[en.family]||en.family)}</span>${regimeChip(en.regime)}
        <div class="dec-meta">keputusan ${e(L.time(en.decisionMs))} · ${e(L.date(en.decisionMs))}</div></div>
      <div class="dec-scores" data-locked="1"><div><span>M1 + M2q</span><b data-score="m1m2q">${sc(s.m1m2q,180)}</b></div><div><span>M6 (indeks)</span><b data-score="m6">${sc(s.m6,500)}</b></div><div><span>M1 Struktur</span><b>${sc(s.m1)}</b></div><div><span>M2 Kualitas</span><b>${sc(s.m2q)}</b></div><div class="lock" title="Skor dibekukan saat masuk Decision; refresh data tidak mengubahnya">🔒 skor dikunci</div></div>
      <div class="dec-price"><span class="px">${px>0?e(L.price(px)):'—'}</span><span class="rr ${fin(R)&&R>=0?'pos':'neg'}">${fin(R)?(R>=0?'+':'')+R.toFixed(2)+'R':'—'}</span></div>
      <div class="dec-prog" title="Stop → Entry → ${fin(en.target2)?'TP1 → TP2':'Target'}"><div class="fill" style="width:${px>0?fromStop(px):0}%"></div><div class="mark" style="left:${fromStop(en.entry)}%"></div>${fin(en.target2)?`<div class="mark tp1" style="left:${fromStop(en.target)}%"></div>`:''}${px>0?`<div class="now" style="left:${fromStop(px)}%"></div>`:''}</div>
      <div class="dec-lv"><div><span>SL</span>${e(L.price(en.stop))}</div><div><span>ENTRY</span>${e(L.price(en.entry))}</div>${fin(en.target2)?`<div><span>TP1 (2R)</span>${e(L.price(en.target))}</div><div><span>TP2 (3R)</span>${e(L.price(en.target2))}</div>`:`<div><span>TP (2R)</span>${e(L.price(en.target))}</div><div><span>RR</span>1:${(Math.abs(en.target-en.entry)/risk).toFixed(2)}</div>`}</div>
      <div class="dec-outcome ${o.code==='STOP_HIT'?'neg':o.code==='TARGET_HIT'||o.code==='TP1_STOP'||o.code==='TP1_HORIZON'||o.tp1AtMs?'pos':'muted'}">${e(oTxt)}</div>
      ${takeBar(en,c)}
      ${execPanel({symbol:en.symbol,side:en.side,entry:en.entry,stop:en.stop,target:en.target,target2:en.target2,tp1Frac:en.tp1Frac},ex)}
      <div class="dec-data"><div class="dec-cell"><div class="lbl">OPEN INTEREST</div>${oi}</div><div class="dec-cell"><div class="lbl">CVD (TAKER)</div>${cvd}</div><div class="dec-cell"><div class="lbl">ORDERBOOK</div>${ob}</div>
        <div class="dec-cell"><div class="lbl">INVALIDASI</div><div class="sub ${invWarn?'dec-warn':''}">${e(invShort(inv))}${invWarn?'<br>⚠ harga sudah melewati level invalidasi':''}</div></div></div>
      <div class="muted small" style="margin-top:8px">OI · CVD · orderbook hanya tampilan, tidak masuk skor (PRD §4.5).</div></div>`;
  }
  // R38: tombol "Saya ambil" / status diambil (catatan pengguna; skor & sinyal tidak berubah).
  function takeBar(en,c){
    if(en.taken){const st=savedSettings(c),pos=PF.fromTaken(en),v=pos.done?PF.pnl(pos,st.costBps):null;
      return `<div class="taken-bar" data-taken="${e(en.key)}"><span class="chip primary">✓ Diambil</span><span class="mono small">entry ${e(L.price(en.taken.entry))} · qty ${e(String(+en.taken.qty.toPrecision(8)))}${fin(v)?' · hasil '+(v>=0?'+':'')+e(usdt(v)):''}</span><button class="btn" data-action="untake" data-key="${e(en.key)}">Batal ambil</button></div>`;}
    return `<div class="taken-bar"><button class="btn primary" data-action="take-open" data-key="${e(en.key)}">Saya ambil</button><span class="muted small">tandai bila kamu benar-benar masuk posisi ini</span></div>`;
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
      ${riskPanel(c)}${execForm(c.ex)}<div id="dec-list" class="dec-list">${decisionList(c)}</div>
      <div class="section-head" style="margin-top:16px"><h3>Posisi manual</h3><button class="btn" data-action="man-open">+ Posisi manual</button></div><div id="man-list" class="dec-list">${manualList(c)}</div>
      <div class="note" style="margin-top:12px">Decision = status <b>Layak dipertimbangkan</b> PRD (semua gate lolos, termasuk slot &amp; risiko portofolio: maks 10 posisi, risiko 1%/trade, risiko terbuka ≤10%; bila lebih dari 10 sinyal lolos bersamaan, urutan menurut M6). M6 adalah indeks 0–500, bukan peluang menang. Batas skor "layak" belum ditetapkan — menunggu riset Tahap 2.</div>`;
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
    return rows.map(r=>`<tr data-pair="${e(r.symbol)}"><td class="num">${r.rank??'—'}</td><td><a class="pair-link" href="#" data-action="pair" data-sym="${e(r.symbol)}"><b>${e(r.symbol)}</b></a></td><td class="num mono">${e(L.price(r.price))}</td>
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
    const cost=savedSettings(c).costBps,tk=rows.filter(r=>r.taken),tkP=tk.map(r=>PF.pnl(PF.fromTaken(r),cost)).filter(fin),tkSum=tkP.reduce((a,b)=>a+b,0);
    const uniq=k=>[...new Set(all.map(r=>r[k]))].sort();
    const sel=(k,label,opts)=>`<label>${e(label)}<select data-jf="${k}"><option value="">Semua</option>${opts.map(([v,t])=>`<option value="${e(v)}"${f[k]===v?' selected':''}>${e(t)}</option>`).join('')}</select></label>`;
    const stat=(k,label,v)=>`<div class="stat" data-jstat="${k}"><div class="k">${e(label)}</div><div class="v">${v}</div></div>`;
    let h=`<div class="section-head"><h2>Jurnal Sinyal</h2><button class="btn" data-action="download-journal">Unduh CSV (${rows.length})</button></div>
      <div class="filters">${sel('pair','Pair',uniq('symbol').map(s=>[s,s]))}${sel('side','Arah',[['LONG','LONG'],['SHORT','SHORT']])}${sel('family','Keluarga',uniq('family').map(s=>[s,L.FAMILY[s]||s]))}
        ${sel('taken','Diambil',[['yes','Ya'],['no','Tidak']])}
        ${sel('outcome','Hasil',[['TARGET_HIT','Kena TP / TP2'],['TP1_STOP','TP1 lalu SL'],['TP1_HORIZON','TP1 lalu keluar 24 jam'],['STOP_HIT','Kena SL'],['HORIZON_EXIT','Keluar 24 jam'],['NO_DATA','Data tidak ada']])}
        <label>M6 min<input data-jf="m6min" inputmode="decimal" value="${e(f.m6min||'')}" placeholder="mis. 320"></label><label>M6 maks<input data-jf="m6max" inputmode="decimal" value="${e(f.m6max||'')}"></label></div>
      <div class="cards">${stat('n','Sinyal selesai',sm.n)}${stat('tp','Kena TP / TP2',sm.TARGET_HIT)}${stat('tp1','TP1 lalu SL / 24 jam',sm.TP1_STOP+sm.TP1_HORIZON)}${stat('sl','Kena SL',sm.STOP_HIT)}${stat('hz','Keluar 24 jam',sm.HORIZON_EXIT)}${stat('avg','Rata-rata R',fin(sm.avgR)?(sm.avgR>=0?'+':'')+sm.avgR.toFixed(3):'—')}${stat('taken','Diambil · hasil',`${tk.length} · ${tkP.length?(tkSum>=0?'+':'')+e(usdt(tkSum)):'—'}`)}</div>`;
    const man=manualJournal(c);
    if(!rows.length)return h+man+`<div class="empty" data-empty="jurnal">${all.length?'Belum ada sinyal selesai untuk filter ini.':'Belum ada sinyal Decision yang selesai. Setiap pair yang masuk Decision dicatat otomatis di sini setelah hasilnya (TP / SL / 24 jam) diketahui.'}</div>`;
    h+=`<div class="table-wrap"><table class="journal"><thead><tr><th>Keputusan</th><th>Pair</th><th>Arah</th><th>Keluarga</th><th class="num">M1+M2q</th><th class="num">M6</th><th>Rezim BTC</th>
      <th class="num">Entry</th><th class="num">SL</th><th class="num">TP1</th><th class="num">TP2</th><th>Hasil</th><th class="num">Keluar</th><th class="num">R</th><th>Diambil</th></tr></thead><tbody>`;
    for(const r of rows.slice(0,300)){const o=r.outcome;
      h+=`<tr data-jrow="${e(r.key)}"><td class="small">${e(L.dateTime(r.decisionMs))}</td><td><a class="pair-link" href="#" data-action="pair" data-sym="${e(r.symbol)}"><b>${e(r.symbol)}</b></a>${r.rank?` <span class="muted small">#${r.rank}</span>`:''}</td><td>${side(r.side)}</td><td>${e(L.FAMILY[r.family]||r.family)}</td>
        <td class="num">${sc(r.scores.m1m2q)}</td><td class="num">${sc(r.scores.m6)}</td><td>${regimeChip(r.regime)||'—'}</td>
        <td class="num mono">${e(L.price(r.entry))}</td><td class="num mono">${e(L.price(r.stop))}</td><td class="num mono">${e(L.price(r.target))}</td><td class="num mono">${fin(r.target2)?e(L.price(r.target2)):'—'}</td>
        <td><span class="chip ${o.code==='TARGET_HIT'?'primary':o.code==='STOP_HIT'?'reject':'neutral'}">${e(LG.outcomeText(r))}</span><div class="muted small">${o.tp1AtMs?'TP1 '+e(L.time(o.tp1AtMs))+' · ':''}${e(L.time(o.atMs))}</div></td>
        <td class="num mono">${e(L.price(o.exit))}</td><td class="num ${fin(o.r)?(o.r>=0?'pos':'neg'):''}">${fin(o.r)?(o.r>=0?'+':'')+o.r.toFixed(2):'—'}</td>
        <td class="small" data-jtaken="${r.taken?'yes':'no'}">${r.taken?(()=>{const v=PF.pnl(PF.fromTaken(r),cost);return '✓ '+(fin(v)?(v>=0?'+':'')+e(usdt(v)):'');})():'—'}</td></tr>`;}
    h+='</tbody></table></div>';
    if(rows.length>300)h+=`<div class="muted small">300 terbaru ditampilkan; seluruh ${rows.length} baris ada di unduhan CSV.</div>`;
    h+=man;
    return h+'<div class="note" style="margin-top:10px">Hasil menurut candle 4H Binance dengan harga yang dibekukan saat Decision (stop dievaluasi lebih dahulu, TP1 2R tutup 50% lalu TP2 3R, SL tetap, horizon 24 jam; R = gabungan kedua bagian) — bukan fill order akunmu. Hanya sinyal yang benar-benar masuk Decision saat aplikasi berjalan yang dicatat.</div>';
  }

  // R38: posisi manual yang sudah selesai — terpisah dari statistik sinyal Malomo.
  function manualJournal(c){
    const done=PF.closedManual(c.manual);if(!done.length)return '';
    const cost=savedSettings(c).costBps,TXT={STOP_HIT:'kena SL',TARGET_HIT:'kena TP',TP1_STOP:'TP1 lalu SL',USER_CLOSE:'ditutup sendiri'};
    let sum=0;const rows=done.slice(0,300).map(p=>{const v=PF.pnl(PF.fromManual(p),cost);if(fin(v))sum+=v;
      return `<tr data-mrow="${e(p.id)}"><td class="small">${e(L.dateTime(p.openedMs))}</td><td><a class="pair-link" href="#" data-action="pair" data-sym="${e(p.symbol)}"><b>${e(p.symbol)}</b></a></td><td>${side(p.side)}</td>
        <td class="num mono">${e(L.price(p.entry))}</td><td class="num mono">${e(L.price(p.stop))}</td><td class="num mono">${fin(p.target)?e(L.price(p.target)):'—'}</td><td class="num mono">${fin(p.target2)?e(L.price(p.target2)):'—'}</td>
        <td>${e(TXT[p.closed.code]||p.closed.code)}<div class="muted small">${e(L.time(p.closed.atMs))}</div></td><td class="num mono">${e(L.price(p.closed.exit))}</td><td class="num ${fin(v)?(v>=0?'pos':'neg'):''}">${fin(v)?(v>=0?'+':'')+e(usdt(v)):'—'}</td></tr>`;}).join('');
    return `<div class="section-head" style="margin-top:16px"><h3>Posisi manual selesai</h3><button class="btn" data-action="download-manual">Unduh CSV manual (${done.length})</button></div>
      <div class="muted small" data-man-sum>Total ${done.length} posisi · hasil ${(sum>=0?'+':'')+e(usdt(sum))} (perkiraan setelah biaya). Tidak dicampur ke statistik sinyal Malomo.</div>
      <div class="table-wrap"><table class="journal"><thead><tr><th>Dibuka</th><th>Pair</th><th>Arah</th><th class="num">Entry</th><th class="num">SL</th><th class="num">TP1</th><th class="num">TP2</th><th>Hasil</th><th class="num">Keluar</th><th class="num">USDT</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  root.Malomo.ui={health,universeLine,regimeChip,riskPanel,riskNumbers,manualList,sheet,pairDetail,detailLive,chartTip,execForm,execSaveStatus,execPanel,decisionCard,decisionList,decisionScreen,pairsRows,pairsScreen,journalScreen};
})(globalThis);
