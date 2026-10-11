/* Malomo V7 — tampilan enam layar (Referensi UI/UX §3) + kartu Decision (pola B ICT Screening).
   Fungsi di sini hanya menyusun HTML dari state engine; tidak menghitung skor, tidak mengubah keputusan.
   Aturan UI §1: tanpa tombol order; M6 selalu "indeks, bukan win rate"; null tampil "—" (bar diarsir);
   arah = teks + ikon; tanpa ambang M6; waktu UTC + WITA; versi selalu terlihat. */
(function(root){
  'use strict';
  const M=root.Malomo,L=M.labels,C=M.core;
  const e=L.esc;
  const fin=x=>typeof x==='number'&&Number.isFinite(x);
  const recId=r=>r.symbol+'|'+r.side+'|'+r.signal_family+'|'+r.decision_available_utc;
  const ms=iso=>Date.parse(iso);

  // ---------- potongan kecil ----------
  const chip=(code,map,extra='')=>code?`<span class="chip ${L.tone(code)} ${extra}" title="${e(code)}">${e(map[code]||code)}</span>`:'<span class="chip neutral">—</span>';
  const reasonChips=rs=>(rs&&rs.length)?`<span class="chips">${rs.map(r=>`<span class="chip ${L.tone(String(r).split(':')[0])}" title="${e(r)}">${e(L.reasonLabel(r))}</span>`).join('')}</span>`:'';
  const side=s=>`<span class="side ${e(s)}">${e(L.sideText(s))}</span>`;
  const fam=f=>`<span title="${e(f)}">${e(L.FAMILY[f]||f)}</span>`;
  function bar(v,max){if(!fin(v))return '<div class="bar null" title="null — bukan 0"></div>';return `<div class="bar"><i style="width:${Math.max(0,Math.min(100,100*v/max))}%"></i></div>`;}
  const scoreTxt=(v,max)=>`${L.score(v)} / ${max}`;

  // ---------- bar siklus ----------
  const STEPS=[['ingest','Ingest'],['valid','Validasi'],['ind','Indikator'],['m1','M1'],['gen','Generator M2'],['canon','Kanonisasi'],['m2','Skor M2'],
    ['m3','M3'],['m5','M5'],['close','Kandidat close'],['open','Open berikutnya'],['m4','Cek risiko M4'],['rank','Ranking M6'],['decide','Keputusan'],['log','Log audit']];
  function stepper(state){
    if(!state)return STEPS.map(([,n])=>`<li class="wait">${e(n)}</li>`).join('');
    const s=state.cycle.summary,gaps=state.health.some(h=>h.gaps>0);
    const st={ingest:s.fetch_failed.length?['fail','FETCH_FAILED']:['ok'],valid:gaps?['warn','CONFIRMED_GAP']:['ok'],
      m3:s.m3_status==='SCORED'?['ok']:['fail','INCOMPLETE'],open:s.phase==='CLOSE_CANDIDATE'?['wait','menunggu open']:['ok']};
    return STEPS.map(([k,n])=>{const [c,why]=st[k]||['ok'];return `<li class="${c}" title="${e(why||'')}">${e(n)}${why?' · '+e(why):''}</li>`;}).join('');
  }
  function health(state,loading){
    if(!state)return `<span class="dot neutral"></span><span>${loading?'Memuat data…':'Belum ada data'}</span>`;
    const s=state.cycle.summary;
    if(s.fetch_failed.length)return `<span class="dot warn"></span><span>Mengambil ulang (FETCH_FAILED): ${e(s.fetch_failed.join(', '))}</span>`;
    const g=state.health.filter(h=>h.gaps>0);
    if(g.length)return `<span class="dot reject"></span><span>Candle hilang (CONFIRMED_GAP): ${e(g.map(h=>h.symbol).join(', '))}</span>`;
    const retry=state.health.filter(h=>h.fetch==='RETRYING_CACHED');
    if(retry.length)return `<span class="dot warn"></span><span>Data lengkap · mengambil ulang ${e(retry.map(h=>h.symbol).join(', '))}</span>`;
    return '<span class="dot ok"></span><span>Data lengkap</span>';
  }

  // ---------- S1 Siklus 4H ----------
  function counts(recs){const c={};for(const r of recs)c[r.status]=(c[r.status]||0)+1;return c;}
  function siklus(state,view){
    if(!state)return '<div class="empty">Memuat candle 4H enam pair dari Binance…</div>';
    const cy=state.cycle,recs=cy.records,c=counts(recs),closeTxt=L.time(cy.T);
    const cards=[['ENTRY_CONSIDER','Layak dipertimbangkan',c.ENTRY_CONSIDER],['REJECTED_RISK','Ditolak risiko',c.REJECTED_RISK],['REJECTED_DIRECTION','Ditolak arah',c.REJECTED_DIRECTION],
      ['COLLIDE','Bentrok',(c.CONFLICTING_DIRECTIONS||0)+(c.MULTI_METHOD_COLLISION||0)],['NO_ENTRY','Tidak ada entry',c.NO_ENTRY]];
    if(c.REJECTED_INTEGRITY)cards.push(['REJECTED_INTEGRITY','Ditolak integritas',c.REJECTED_INTEGRITY]);
    if(c.CLOSE_CANDIDATE)cards.push(['CLOSE_CANDIDATE','Menunggu open',c.CLOSE_CANDIDATE]);
    let html=`<div class="section"><div class="section-head"><h2>Siklus close ${e(closeTxt)}</h2><span class="muted small">${e(L.date(cy.T))} · M3 ${e(L.score(cy.summary.m3))} / 100 (sama untuk semua kandidat)</span></div>`;
    if(cy.summary.data_status!=='OK')html+=`<div class="warnbox">⚠ Data: ${e(cy.summary.fetch_failed.join(', '))} FETCH_FAILED — skor siklus ini berstatus DATA_INCOMPLETE sementara; dicoba ulang 30/60/120 detik.</div>`;
    html+=`<div class="cards">${cards.map(([k,n,v])=>`<div class="stat" data-count="${k}"><div class="k">${e(n)}</div><div class="v">${v||0}</div></div>`).join('')}</div></div>`;
    if(!c.ENTRY_CONSIDER){
      const top=topReason(recs);
      html+=`<div class="section empty" data-empty="no-entry"><b>Tidak ada kandidat layak di close ${e(L.hm(cy.T))} UTC</b><br>${recs.length?'Alasan terbanyak: '+e(top):'Tidak ada event terkonfirmasi pada close ini.'}</div>`;
    }
    if(recs.length)html+=candidateTable(recs,view);
    return html;
  }
  function topReason(recs){
    const n={};for(const r of recs)for(const x of (r.reasons.length?r.reasons:[r.status]))n[x]=(n[x]||0)+1;
    const k=Object.keys(n).sort((a,b)=>n[b]-n[a])[0];return k?L.reasonLabel(k)+' ('+n[k]+')':'—';
  }
  function filterRecs(recs,f){return recs.filter(r=>(!f.pair||r.symbol===f.pair)&&(!f.side||r.side===f.side)&&(!f.family||r.signal_family===f.family)&&(!f.status||r.status===f.status));}
  function candidateTable(recs,view){
    const f=view.filters,opts=(name,vals,lab)=>`<label>${name}<select data-filter="${name.toLowerCase()}"><option value="">Semua</option>${vals.map(v=>`<option value="${e(v)}"${f[key(name)]===v?' selected':''}>${e(lab?lab[v]||v:v)}</option>`).join('')}</select></label>`;
    const key=n=>({Pair:'pair',Arah:'side',Keluarga:'family',Status:'status'}[n]);
    const uniq=k=>[...new Set(recs.map(r=>r[k]))].sort();
    const rows=filterRecs(recs,f);
    let html=`<div class="section"><div class="section-head"><h3>Kandidat close ini</h3><span class="muted small">Urutan = tie-break PRD §8.1.5 (M6↓, M2 kualitas↓, M1↓, simbol, LONG dulu, keluarga)</span></div>
      <div class="filters">${opts('Pair',uniq('symbol'))}${opts('Arah',['LONG','SHORT'])}${opts('Keluarga',uniq('signal_family'),L.FAMILY)}${opts('Status',uniq('status'),L.STATUS)}</div>`;
    html+=`<div class="table-wrap cand-table"><table><thead><tr><th class="num">#</th><th>Pair</th><th>Arah</th><th>Keluarga</th><th>M6 (indeks)</th><th class="num" title="Pembeda utama antar kandidat, hanya tampilan">M1 + M2q</th><th>Status</th><th>Alasan</th><th>Waktu</th></tr></thead><tbody>`;
    for(const r of rows){
      const sel=view.selected===recId(r)?' sel':'',m6=r.scores.m6_confluense_500;
      html+=`<tr class="row${sel}" data-rec="${e(recId(r))}"><td class="num">${r.rank_provisional??'—'}</td><td>${e(r.symbol)}</td><td>${side(r.side)}</td><td>${fam(r.signal_family)}</td>
        <td><div class="m6cell">${bar(m6,500)}<span class="mono">${fin(m6)?e(L.score(m6))+' / 500':'— / 500'}</span></div></td>
        <td class="num">${fin(r.scores.m1_plus_m2q_0_180_display_only)?e(L.score(r.scores.m1_plus_m2q_0_180_display_only))+' / 180':'—'}</td>
        <td>${chip(r.status,L.STATUS)}</td><td>${reasonChips(r.reasons)}</td><td class="small">${e(L.time(ms(r.confirmation_utc)))}</td></tr>`;
    }
    html+='</tbody></table></div><div class="cand-cards">';
    for(const r of rows){const m6=r.scores.m6_confluense_500;
      html+=`<div class="cand-card" data-rec="${e(recId(r))}"><div class="top"><b>${e(r.symbol)}</b>${side(r.side)}</div>
        <div class="m6cell">${bar(m6,500)}<span class="mono">${fin(m6)?e(L.score(m6))+' / 500':'— / 500'}</span></div>
        <div class="chips">${chip(r.status,L.STATUS)}<span class="chip neutral">${e(L.FAMILY[r.signal_family]||r.signal_family)}</span></div>${reasonChips(r.reasons)}</div>`;}
    html+='</div>';
    if(!rows.length)html+='<div class="empty">Tidak ada kandidat untuk filter ini.</div>';
    return html+'</div>';
  }

  // ---------- S2 Inspektor ----------
  function invalidationText(inv){
    if(!inv)return '—';
    if(inv.rule==='CLOSE_BELOW_LEVEL_MINUS_R')return `Close di bawah ${L.price(inv.price)} (L − r, L = ${L.price(inv.level)})`;
    if(inv.rule==='CLOSE_ABOVE_LEVEL_PLUS_R')return `Close di atas ${L.price(inv.price)} (L + r, L = ${L.price(inv.level)})`;
    if(/LOW_BELOW/.test(inv.rule))return `Kedalaman > 0.85 (low < ${L.price(inv.price)}) atau low di bawah asal impuls ${L.price(inv.level)}`;
    if(/HIGH_ABOVE/.test(inv.rule))return `Kedalaman > 0.85 (high > ${L.price(inv.price)}) atau high di atas asal impuls ${L.price(inv.level)}`;
    return e(inv.rule);
  }
  function inspector(rec,state,view){
    if(!rec)return '';
    const tab=view.tab||'skor';
    const head=`<div class="insp-head"><div><div class="insp-title">${e(rec.symbol)} ${side(rec.side)} · ${fam(rec.signal_family)}</div>
      <div class="muted small">${e(L.EVENT[rec.event_status]||rec.event_status)} ${e(L.time(ms(rec.confirmation_utc)))} · ${e(L.date(ms(rec.confirmation_utc)))}</div></div>
      <button class="close-x" data-action="close-insp" aria-label="Tutup inspektor">✕</button></div>
      <div class="tabs" role="tablist">${[['skor','Skor'],['rencana','Rencana'],['audit','Audit'],['json','JSON']].map(([k,n])=>`<button role="tab" data-tab="${k}" class="${tab===k?'on':''}" aria-selected="${tab===k}">${n}</button>`).join('')}</div>`;
    const body=tab==='rencana'?planTab(rec):tab==='audit'?auditTab(rec,state):tab==='json'?jsonTab(rec):scoreTab(rec);
    const v=`<div class="versions">score_version ${e(rec.score_version)}<br>normalization_version ${e(rec.normalization_version??'null')}${rec.calibration_policy?' · '+e(rec.calibration_policy):''}<br>risk_mandate_version ${e(rec.risk_mandate_version)}<br>m5_snapshot ${e(rec.m5_snapshot)} · ${e(rec.m5_scope||'')}</div>`;
    return head+body+v;
  }
  function row(name,v,max,comp,extra=''){
    return `<details class="score-row"><summary><span>${name}</span>${bar(v,max)}<span class="v">${fin(v)?e(L.score(v))+' / '+max:'— / '+max}</span></summary>${comp||'<div class="comp">Komponen tidak tersedia (nilai null, bukan 0).</div>'}${extra}</details>`;
  }
  const compList=pairs=>`<div class="comp">${pairs.map(([k,v])=>`<span>${e(k)}</span><b>${typeof v==='string'?e(v):e(L.score(v))}</b>`).join('')}</div>`;
  function scoreTab(r){
    const s=r.scores,m6=s.m6_confluense_500;
    let h=`<div class="m6big"><div class="muted small">M6 CONFLUENSE (indeks)</div><div class="v">${fin(m6)?e(L.score(m6)):'—'} / 500</div>
      <div class="small muted">${fin(m6)?e(L.score(s.m6_display_pct_not_winrate))+'% indeks · bukan win rate':'Tidak numerik: '+e(L.STATUS[r.status]||r.status)+' — bukan 0'}</div></div>`;
    const m1c=s.m1_components;
    h+=row('M1 Struktur',s.m1_100,100,m1c?compList([['Struktur 45',m1c.structure45],['Efisiensi tren 25 (TE14 '+m1c.te14.toFixed(3)+')',m1c.te25],['ADX 10 (ADX14 '+m1c.adx14.toFixed(2)+')',m1c.adx10],['NATR tipikal 20 (persentil '+m1c.natr_pct.toFixed(3)+')',m1c.vol20]]):null,
      `<div class="chips" style="margin:6px 0 0 12px"><span class="chip neutral" title="market_structure_direction">Struktur: ${e(L.STRUCT[r.market_structure_direction]||'—')}</span>${r.signal_family==='REVERSAL_RETEST'?`<span class="chip neutral" title="m1_origin_direction">Struktur asal (sebelum break): ${e(L.STRUCT[r.m1_origin_direction]||'—')}</span>`:''}</div>`);
    const q=s.m2_components,ig=s.m2_integrity_components;
    h+=row('M2 Kualitas',s.m2_signal_quality_80,80,q?compList([['Generation 30',q.generation30],['Momentum 25 (15E + 10L)',q.momentum25],['Participation 25 (10V + 15B)',q.participation25]]):null);
    h+=row('M2 Integritas',s.m2_integrity_20,20,ig?compList([['Kausal 10',ig.causal10],['Dedup 6',ig.dedup6],['Konflik 4 (log audit)',ig.conflict4]]):null,
      `<div class="small muted" style="padding:4px 0 0 12px">Total M2 indeks: ${fin(s.m2_100)?e(L.score(s.m2_100))+' / 100':'— / 100'}</div>`);
    const m3c=s.m3_components;
    h+=row('M3 Dependensi',s.m3_100,100,m3c?compList([['Korelasi 60 (rata |ρ| '+m3c.meanAbsCorr.toFixed(3)+')',m3c.correlation60],['Ekor bersama 40 (J '+m3c.J.toFixed(4)+')',m3c.tail40]]):null,
      '<div class="small muted" style="padding:4px 0 0 12px">Sama untuk semua kandidat pada waktu ini; konteks bersama, bukan arah.</div>');
    const m4=fin(s.m4_100)?s.m4_100:s.m4_100_audit_partial;
    h+=row(fin(s.m4_100)?'M4 Risiko':'M4 (audit parsial)',m4,100,fin(s.m4_100)?compList([['Rencana 40',40],['Agregat 35',35],['Gross 25',25]]):fin(s.m4_100_audit_partial)?`<div class="comp">Skor audit parsial untuk penjelasan; M6 tidak numerik. Alasan: ${e(r.reasons.map(L.reasonLabel).join(', '))}</div>`:null);
    h+=row('M5 Validasi',s.m5_100,100,compList([['Causal 30',30],['Chronological split 25',25],['Cost resilience 25',0],['Temporal robustness 20',0]]),
      `<div class="chips" style="margin:6px 0 0 12px"><span class="chip code" title="Snapshot audit tetap, sama untuk semua kandidat">${e(r.m5_scope||'BREAKOUT_2024_NO_DIRECTION_GATE')}</span></div>`);
    h+=`<div class="note" style="margin-top:12px">Skor ini indeks desain riset. M1 dan M2 bisa berbagi informasi harga; M2 integritas dan M5 sama-sama audit proses. Bukan lima bukti independen (PRD §8.3).</div>`;
    return h;
  }
  function planTab(r){
    if(!fin(r.entry_reference_open))return `<div class="empty">Menunggu open candle berikutnya.<br><span class="small">Rencana dihitung pada fase ENTRY_REVIEW saat open(t+1) diketahui.</span></div>
      <dl class="kv" style="margin-top:12px"><dt>Invalidasi</dt><dd>${invalidationText(r.invalidation)}</dd><dt>ATR frozen (sebelum break)</dt><dd>${e(L.price(r.atr_frozen))}</dd></dl>`;
    const release=ms(r.entry_reference_time_utc)+r.max_holding_hours*3600000;
    return `<dl class="kv"><dt>Entry referensi (open)</dt><dd>${e(L.price(r.entry_reference_open))}</dd><dt>Stop</dt><dd>${e(L.price(r.stop_price))}</dd>
      <dt>Target (${e(String(r.rr_target))}R)</dt><dd>${e(L.price(r.target_price))}</dd><dt>Qty (simulasi)</dt><dd>${fin(r.qty)?e(r.qty.toPrecision(6)):'—'}</dd>
      <dt>Risiko</dt><dd>${e(L.pct(r.risk_pct))} dari ekuitas acuan</dd><dt>Gross</dt><dd>${e(L.pct(r.gross_pct))} dari ekuitas acuan</dd>
      <dt>Invalidasi</dt><dd>${invalidationText(r.invalidation)}</dd><dt>Batas waktu</dt><dd>slot lepas ${e(L.dateTime(release))} (24 jam tetap)</dd>
      <dt>ATR entry (candle konfirmasi)</dt><dd>${e(L.price(r.atr_entry))}</dd><dt>ATR frozen (sebelum break)</dt><dd>${e(L.price(r.atr_frozen))}</dd></dl>
      <div class="warnbox" style="margin-top:12px">Harga belum dikuantisasi ke tick size Binance. Bukan harga order.</div>`;
  }
  function auditTab(r,state){
    const key=r.symbol+'|4h|'+r.decision_available_utc,log=state?state.log.find(x=>x.type==='CONFLICT_CHECK'&&x.key===key):null;
    const T=ms(r.confirmation_utc),tl=[];
    if(r.break_utc)tl.push(['Break',L.dateTime(ms(r.break_utc))]);
    tl.push(['Konfirmasi',L.dateTime(T)]);
    if(fin(r.entry_reference_open))tl.push(['Open entry',L.dateTime(ms(r.entry_reference_time_utc))],['Slot lepas',L.dateTime(T+r.max_holding_hours*3600000)]);
    return `<div class="chips" style="margin-bottom:10px"><span class="muted small">event_status</span>${chip(r.event_status,L.EVENT)}<span class="muted small">score_status</span>${chip(r.score_status,L.SCORE)}<span class="muted small">status</span>${chip(r.status,L.STATUS)}</div>
      <h3 style="font-size:13px;margin:8px 0">Alasan</h3>${r.reasons.length?reasonChips(r.reasons):'<span class="muted small">Tidak ada (status '+e(r.status)+')</span>'}
      <h3 style="font-size:13px;margin:12px 0 6px">Timeline</h3><ul class="timeline">${tl.map(([k,v])=>`<li><b>${e(k)}</b> · ${e(v)}</li>`).join('')}</ul>
      <h3 style="font-size:13px;margin:12px 0 6px">Provenance</h3><dl class="kv"><dt>source_labels</dt><dd>${e((r.source_labels||[]).join(', '))}</dd><dt>duplicate_count</dt><dd>${e(String(r.duplicate_count??0))}</dd>
      <dt>Cek konflik (conflict4)</dt><dd>${log?e(log.result)+' · sisi diperiksa '+e(log.sidesChecked.join('/'))+' · keluarga '+e(log.familiesEvaluated.length):'Log tidak ada'}</dd>
      <dt>data_quality_flags</dt><dd>${e((r.data_quality_flags||[]).join(', ')||'—')}</dd></dl>`;
  }
  function jsonTab(r){
    const txt=JSON.stringify(M.cycle.publicRecord(r),null,2);
    return `<div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn" data-action="copy-json">Salin</button><button class="btn" data-action="download-json">Unduh</button></div><pre class="json" id="jsonText">${e(txt)}</pre>`;
  }

  // ---------- S3 Papan Event ----------
  function progressText(p){
    if(!p)return '';
    if(p.window==='retest')return `Retest: candle ${p.candle} dari ${p.of}`;
    if(p.window==='zone')return `Zona: candle ${p.candle} dari ${p.of} (i+3 s.d. i+26)`;
    return `Trigger: candle ${p.candle} dari ${p.of}`;
  }
  function evCard(x,clickable){
    const id=x.record?recId(x.record):'';
    const p=x.progress,pct=p?Math.max(0,Math.min(100,100*p.candle/p.of)):0;
    return `<div class="ev${clickable&&id?' click':''}"${id?` data-rec="${e(id)}"`:''}><div class="top"><b>${e(x.symbol)}</b>${side(x.side)}</div>
      <div class="muted small">${fam(x.signal_family)} · L ${e(L.price(x.level))}</div>
      <div class="chips" style="margin-top:4px">${chip(x.event_status,L.EVENT)}${x.record?chip(x.record.status,L.STATUS):''}</div>
      ${p?`<div class="small" style="margin-top:4px">${e(progressText(p))}</div><div class="prog"><i style="width:${pct}%"></i></div>`:''}
      ${x.endMs?`<div class="muted small" style="margin-top:4px">${e(L.dateTime(x.endMs))}</div>`:''}</div>`;
  }
  function board(state){
    if(!state)return '<div class="empty">Memuat…</div>';
    const b=state.board,col=(t,list,note,click)=>`<div class="col" data-col="${e(t)}"><h3><span>${e(t)}</span><span class="muted">${list.length}</span></h3>${list.map(x=>evCard(x,click)).join('')||`<div class="muted small">${e(note)}</div>`}</div>`;
    return `<div class="section-head"><h2>Papan Event</h2><span class="muted small">Kolom selesai: ${M.cycle.BOARD_LOOKBACK} candle terakhir (5 hari). Kartu menunggu tidak membawa skor (NOT_APPLICABLE).</span></div>
      <div class="board">${col('Menunggu',b.waiting,'Tidak ada setup yang menunggu.')}${col('Terkonfirmasi',b.confirmed,'Belum ada konfirmasi.',true)}${col('Bentrok',b.conflict,'Tidak ada bentrok.',true)}
      ${col('Selesai tanpa sinyal',b.ended,'Tidak ada.')}${col('Label riset',b.research,'Engine v1 hanya menjalankan tiga generator yang diskor; Mean Reversion/Pattern tidak dibangkitkan.')}</div>`;
  }

  // ---------- S4 Portofolio Simulasi (kartu Decision) ----------
  function decisionCard(p,live,now){
    const long=p.side==='LONG',tick=live.prices[p.symbol],px=tick?tick.price:NaN,d=live.data(p.symbol),risk=Math.abs(p.entry-p.stop);
    const R=px>0&&risk>0?(long?px-p.entry:p.entry-px)/risk:null;
    const lo=Math.min(p.stop,p.target),hi=Math.max(p.stop,p.target),frac=v=>Math.max(0,Math.min(1,(v-lo)/(hi-lo)))*100;
    const fromStop=v=>long?frac(v):100-frac(v);
    let oi='<div class="val">memuat…</div>';
    if(d.oi>0&&px>0){const chg=d.oiBase>0?(d.oi/d.oiBase-1)*100:null;oi=`<div class="val">${e(L.compactUsd(d.oi*px))}</div><div class="sub">${chg!==null?(chg>=0?'+':'')+chg.toFixed(2)+'% sejak dipantau':''}</div>`;}
    const c5=live.cvd5(p.symbol);
    const cvd=d.wsOn||(d.cvdWin&&d.cvdWin.length)?`<div class="val ${d.cvd>=0?'pos':'neg'}">${d.cvd>=0?'+':''}${e(L.compactUsd(d.cvd))}</div><div class="sub">5 mnt: ${c5>=0?'+':''}${e(L.compactUsd(c5))} · sejak dipantau</div>`
      :'<div class="val">menyambung…</div><div class="sub">menunggu trade pertama</div>';
    const ob=d.imb!==undefined?`<div class="val">Bid ${Math.round((1+d.imb)*50)}% · Ask ${Math.round((1-d.imb)*50)}%</div><div class="sub">20 level · spread ${d.bid>0&&d.ask>0?((d.ask-d.bid)/d.bid*100).toFixed(3)+'%':'—'}</div>`
      :'<div class="val">menyambung…</div><div class="sub">menunggu snapshot orderbook</div>';
    const inv=p.invalidation,invWarn=inv&&px>0&&(inv.rule.startsWith('CLOSE_BELOW')?px<inv.price:inv.rule.startsWith('CLOSE_ABOVE')?px>inv.price:false);
    const o=p.outcome,oTxt=o.code==='OPEN'?`Outcome riset: berjalan (${o.candlesSeen} dari ${o.of} candle 4H)`:`Outcome riset: ${L.OUTCOME[o.code]} ${L.time(o.atMs)}${fin(o.r)?' ('+(o.r>=0?'+':'')+o.r.toFixed(2)+'R)':''} — slot tetap terisi sampai 24 jam`;
    return `<div class="dec-card ${e(p.side)}" data-rec="${e(recId(p.record))}" data-pos="${e(p.id)}">
      <div class="dec-head"><span class="run-tag"><span class="run-dot"></span>RUNNING</span><span class="dec-sym">${e(p.symbol.replace(/USDT$/,''))}</span>${side(p.side)}<span class="chip neutral">${e(L.FAMILY[p.family]||p.family)}</span>
        <div class="dec-meta">masuk ${e(L.time(p.entryMs))} · berjalan ${e(L.durationShort(now-p.entryMs))} · M6 ${e(L.score(p.m6))} / 500 (indeks)</div></div>
      <div class="dec-price"><span class="px">${px>0?e(L.price(px)):'—'}</span><span class="rr ${fin(R)&&R>=0?'pos':'neg'}">${fin(R)?(R>=0?'+':'')+R.toFixed(2)+'R':'—'}</span></div>
      <div class="dec-prog" title="Stop → Entry → Target"><div class="fill" style="width:${px>0?fromStop(px):0}%"></div><div class="mark" style="left:${fromStop(p.entry)}%"></div>${px>0?`<div class="now" style="left:${fromStop(px)}%"></div>`:''}</div>
      <div class="dec-lv"><div><span>SL</span>${e(L.price(p.stop))}</div><div><span>ENTRY</span>${e(L.price(p.entry))}</div><div><span>TP (2R)</span>${e(L.price(p.target))}</div><div><span>RR</span>1:${(Math.abs(p.target-p.entry)/risk).toFixed(2)}</div></div>
      <div class="dec-outcome ${o.code==='STOP_HIT'?'neg':o.code==='TARGET_HIT'?'pos':'muted'}">${e(oTxt)}</div>
      <div class="dec-data"><div class="dec-cell"><div class="lbl">OPEN INTEREST</div>${oi}</div><div class="dec-cell"><div class="lbl">CVD (TAKER)</div>${cvd}</div><div class="dec-cell"><div class="lbl">ORDERBOOK</div>${ob}</div>
        <div class="dec-cell"><div class="lbl">SLOT 24 JAM · INVALIDASI</div><div class="val">lepas dalam ${e(L.durationShort(p.slotReleaseMs-now))}</div><div class="sub ${invWarn?'dec-warn':''}">${inv?e(invShort(inv)):'—'}${invWarn?'<br>⚠ harga sudah melewati level invalidasi':''}</div></div></div>
      <div class="muted small" style="margin-top:8px">OI · CVD · orderbook hanya tampilan, tidak masuk skor (PRD §4.5).</div></div>`;
  }
  const invShort=inv=>inv.rule==='CLOSE_BELOW_LEVEL_MINUS_R'?'Invalidasi: close < '+L.price(inv.price):inv.rule==='CLOSE_ABOVE_LEVEL_PLUS_R'?'Invalidasi: close > '+L.price(inv.price):'Invalidasi: kedalaman > 0.85 ('+L.price(inv.price)+')';
  function slots(state,live,now){
    const act=state.book.active,out=[];
    for(let i=0;i<state.book.maxPositions;i++)out.push(act[i]?decisionCard(act[i],live,now):'<div class="slot-empty">Slot kosong — kapasitas maksimum, bukan target</div>');
    return out.join('');
  }
  function portofolio(state,live,now){
    if(!state)return '<div class="empty">Memuat…</div>';
    const b=state.book,meter=(name,v,max,tip)=>`<div class="card meter" title="${e(tip||'')}"><div class="section-head" style="margin:0"><span>${e(name)}</span><span class="mono">${e(L.pct(v))} / ${e(L.pct(max))}</span></div><div class="track"><i style="width:${Math.min(100,100*v/max)}%"></i></div></div>`;
    const rc=Object.entries(b.rejectionCounts);
    return `<div class="section-head"><h2>Portofolio Simulasi</h2><span class="muted small">${b.active.length} dari ${b.maxPositions} slot terisi</span></div>
      <div class="slots" id="slots">${slots(state,live,now)}</div>
      <div class="meters">${meter('Risiko terbuka',b.openRiskPct,b.riskOpenMaxPct)}${meter('Gross notional',b.grossPct,b.grossMaxPct,'Batas gross umumnya tercapai sebelum batas 3 slot')}</div>
      <div class="note">Ekuitas acuan ${b.equity} unit, tanpa kompaun. Slot terisi 24 jam penuh; stop/target hanya mencatat hasil (PRD §6). Portofolio direplay dari candle pertama yang diunduh (${e(L.date(b.replayFromMs))}); tidak dicampur dengan akun Binance asli.</div>
      <div class="section" style="margin-top:16px"><div class="section-head"><h3>Log penolakan risiko</h3><span class="chips">${rc.map(([k,v])=>`<span class="chip reject" title="${e(k)}">${e(L.reasonLabel(k))}: ${v}</span>`).join('')||'<span class="muted small">Belum ada</span>'}</span></div>
      ${b.rejections.length?`<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Pair</th><th>Arah</th><th>Alasan</th></tr></thead><tbody>${b.rejections.slice(0,20).map(r=>`<tr class="row" data-rec="${e(recId(r))}"><td class="small">${e(L.dateTime(ms(r.decision_available_utc)))}</td><td>${e(r.symbol)}</td><td>${side(r.side)}</td><td>${reasonChips(r.reasons)}</td></tr>`).join('')}</tbody></table></div>${b.rejections.length>20?'<div class="muted small">20 terbaru ditampilkan; seluruhnya ada di log audit.</div>':''}`:''}</div>
      <div class="section"><div class="section-head"><h3>Posisi selesai (outcome riset)</h3><span class="muted small">Terpisah dari status slot</span></div>
      ${b.closed.length?`<div class="table-wrap"><table><thead><tr><th>Entry</th><th>Pair</th><th>Arah</th><th>Keluarga</th><th>Outcome</th><th class="num">R</th></tr></thead><tbody>${b.closed.slice(0,20).map(p=>`<tr class="row" data-rec="${e(recId(p.record))}"><td class="small">${e(L.dateTime(p.entryMs))}</td><td>${e(p.symbol)}</td><td>${side(p.side)}</td><td>${fam(p.family)}</td><td>${e(L.OUTCOME[p.outcome.code]||p.outcome.code)}</td><td class="num">${fin(p.outcome.r)?(p.outcome.r>=0?'+':'')+p.outcome.r.toFixed(2):'—'}</td></tr>`).join('')}</tbody></table></div>${b.closed.length>20?'<div class="muted small">20 terbaru ditampilkan; seluruhnya ada di log audit.</div>':''}`:'<div class="muted small">Belum ada.</div>'}</div>`;
  }

  // ---------- S5 Konteks Pasar ----------
  function miniChart(row){
    const ch=row.chart;if(!ch||!ch.candles.length)return '<div class="muted small">Data belum ada</div>';
    const W=300,H=150,n=ch.candles.length,cw=W/n;
    let lo=Infinity,hi=-Infinity;for(const x of ch.candles){lo=Math.min(lo,x.low);hi=Math.max(hi,x.high);}
    const lv=ch.levels.filter(l=>l.price>lo-(hi-lo)*0.5&&l.price<hi+(hi-lo)*0.5);for(const l of lv){lo=Math.min(lo,l.price);hi=Math.max(hi,l.price);}
    const pad=(hi-lo)*0.06||1,y=v=>H-((v-(lo-pad))/((hi+pad)-(lo-pad)))*H;
    let s='';
    ch.candles.forEach((x,i)=>{const cx=i*cw+cw/2,up=x.close>=x.open,col=up?'var(--long)':'var(--short)';
      s+=`<line x1="${cx}" x2="${cx}" y1="${y(x.high)}" y2="${y(x.low)}" stroke="${col}" stroke-width="1"/><rect x="${i*cw+cw*0.15}" width="${cw*0.7}" y="${Math.min(y(x.open),y(x.close))}" height="${Math.max(1,Math.abs(y(x.open)-y(x.close)))}" fill="${col}"/>`;});
    for(const p of ch.pivots){const cx=p.i*cw+cw/2,yy=p.type==='H'?y(p.price)-5:y(p.price)+5;s+=`<circle cx="${cx}" cy="${yy}" r="2.2" fill="var(--text-muted)"><title>Pivot ${p.type==='H'?'high':'low'} ${L.price(p.price)}</title></circle>`;}
    for(const l of lv)s+=`<line x1="0" x2="${W}" y1="${y(l.price)}" y2="${y(l.price)}" stroke="${l.side==='LONG'?'var(--long)':'var(--short)'}" stroke-dasharray="4 3" stroke-width="1"><title>${L.FAMILY[l.family]} ${l.side} · L ${L.price(l.price)}</title></line>`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Candle 4H ${e(row.symbol)}">${s}</svg>`;
  }
  function pasar(state){
    if(!state)return '<div class="empty">Memuat…</div>';
    const cx=state.context;
    let h=`<div class="section"><div class="section-head"><h2>Konteks Pasar</h2><span class="muted small">Candle 4H yang sudah close · pivot terkonfirmasi (titik) · level event menunggu (garis putus)</span></div><div class="charts">`;
    for(const r of cx.rows)h+=`<div class="chart"><div class="section-head" style="margin:0 0 4px"><b>${e(r.symbol)}</b><span class="mono small">${e(L.price(r.close))}</span></div>${miniChart(r)}</div>`;
    h+=`</div></div><div class="section"><h3 style="margin-bottom:8px">M1 per pair (candle terakhir)</h3><div class="table-wrap"><table><thead><tr><th>Pair</th><th>Struktur</th><th class="num">TE14</th><th class="num">ADX14</th><th class="num">Persentil NATR</th><th class="num">M1</th></tr></thead><tbody>`;
    for(const r of cx.rows){const m=r.m1,cp=m&&m.components;
      h+=`<tr><td>${e(r.symbol)}</td><td>${m?chip(m.direction||'INCOMPLETE',L.STRUCT):'—'}</td><td class="num">${cp?cp.te14.toFixed(3):'—'}</td><td class="num">${cp?cp.adx14.toFixed(2):'—'}</td><td class="num">${cp?cp.natr_pct.toFixed(3):'—'}</td><td class="num">${m&&fin(m.score)?e(L.score(m.score))+' / 100':'—'}</td></tr>`;}
    h+=`</tbody></table></div></div><div class="section"><div class="section-head"><h3>M3 — dependensi basket</h3><span class="mono">${e(L.score(cx.m3.score))} / 100</span></div>`;
    if(cx.matrix){
      const P=cx.pairs,n=P.length,short=s=>s.replace(/USDT$/,'');
      h+=`<div class="heat" style="grid-template-columns:repeat(${n+1},1fr)"><div class="h"></div>${P.map(p=>`<div class="h">${e(short(p))}</div>`).join('')}`;
      cx.matrix.forEach((rw,i)=>{h+=`<div class="h">${e(short(P[i]))}</div>`+rw.map((v,j)=>`<div class="c" data-tap style="background:rgba(139,124,246,${(Math.abs(v)*0.85).toFixed(3)})" title="${e(short(P[i]))}–${e(short(P[j]))}: ${v.toFixed(3)}"><span>${i===j?'1':v.toFixed(2)}</span></div>`).join('');});
      h+='</div>';
      const c=cx.m3.components;
      h+=`<dl class="kv" style="margin-top:10px"><dt>Rata-rata |korelasi| (60 return)</dt><dd>${c.meanAbsCorr.toFixed(4)} → korelasi ${e(L.score(c.correlation60))} / 60</dd><dt>J ekor bersama (180 return)</dt><dd>${c.J.toFixed(4)} → ekor ${e(L.score(c.tail40))} / 40</dd></dl>`;
    }else h+=`<div class="empty">M3 tidak dapat dihitung: ${e((cx.m3.reasons||[]).map(L.reasonLabel).join(', '))}</div>`;
    h+='<div class="note" style="margin-top:10px">M3 adalah konteks bersama, bukan arah. Jendela berakhir di candle sebelum close terakhir.</div></div>';
    return h;
  }

  // ---------- S6 Audit & Data ----------
  function audit(state,meta){
    if(!state)return '<div class="empty">Memuat…</div>';
    let h=`<div class="section"><div class="section-head"><h2>Audit &amp; Data</h2></div><h3 style="margin-bottom:8px">Kesehatan data per pair</h3><div class="table-wrap"><table><thead><tr><th>Pair</th><th>Candle terakhir (close)</th><th class="num">Candle</th><th class="num">Gap</th><th>Pengambilan</th><th>Jendela belum pulih</th></tr></thead><tbody>`;
    for(const x of state.health){const rec=[];if(x.recovery.m3)rec.push('M3 pulih dalam '+x.recovery.m3+' candle');if(x.recovery.m1)rec.push('M1 dalam '+x.recovery.m1);if(x.recovery.rvol)rec.push('RVOL dalam '+x.recovery.rvol);
      h+=`<tr><td>${e(x.symbol)}</td><td class="small">${e(L.dateTime(x.lastCloseMs))}</td><td class="num">${x.candles}</td><td class="num">${x.gaps}</td><td>${x.fetch==='OK'?'<span class="chip primary">OK</span>':chip('FETCH_FAILED',L.REASON)}</td><td class="small">${e(rec.join(' · ')||'—')}</td></tr>`;}
    h+='</tbody></table></div></div>';
    const cal=state.calibration,files=meta&&meta.files||{};
    h+=`<div class="section"><h3 style="margin-bottom:8px">Kalibrasi aktif</h3><dl class="kv"><dt>Kebijakan</dt><dd>${e(cal.policy)} (array beku, tanpa fitting ulang)</dd>
      ${Object.entries(cal.families).map(([f,x])=>`<dt>${e(L.FAMILY[f])}</dt><dd>${x?e(x.version)+' · n='+x.n:'—'}</dd>`).join('')}
      ${Object.entries(files).map(([f,x])=>`<dt>${e(f)}</dt><dd>${e(x.sha256||'—')} ${x.match===true?'<span class="chip primary">cocok manifest</span>':x.match===false?'<span class="chip reject">TIDAK cocok manifest</span>':''}</dd>`).join('')}</dl></div>`;
    h+=`<div class="section"><h3 style="margin-bottom:8px">Snapshot M5</h3><dl class="kv"><dt>Versi</dt><dd>M5_AUDIT_2024_CLOSED_BAR_9BPS_V1 = 55 / 100</dd><dt>Cakupan</dt><dd>BREAKOUT_2024_NO_DIRECTION_GATE</dd></dl>
      <div class="note" style="margin-top:8px">Konstanta administratif untuk ketiga keluarga. Tidak boleh diklaim sebagai hasil uji Pullback, Reversal, atau populasi yang lolos gate arah (PRD §7).</div></div>`;
    const b=meta&&meta.build;
    h+=`<div class="section"><h3 style="margin-bottom:8px">Status verifikasi build</h3>${b?`<dl class="kv"><dt>Commit</dt><dd>${e(b.commit||'—')}</dd><dt>Dibangun</dt><dd>${e(b.builtAt||'—')}</dd>
      ${(b.suites||[]).map(s=>`<dt>${e(s.name)}</dt><dd>${s.pass} PASS · ${s.fail} FAIL</dd>`).join('')}</dl>
      <div class="chips" style="margin-top:8px"><span class="chip neutral" title="T04/T05/T09/T14/T15 di verifier PRD">STATIC_CONTRACT_CHECK · Belum diuji engine</span></div>`:'<div class="muted small">Info build tidak tersedia.</div>'}</div>`;
    h+=`<div class="section"><h3 style="margin-bottom:8px">Unduhan</h3><button class="btn" data-action="download-audit">Unduh log audit (JSON lines)</button>
      <div class="muted small" style="margin-top:6px">Isi: catatan cek konflik, ringkasan siklus, dan record keputusan sejak ${e(L.date(state.book.replayFromMs))}.</div></div>`;
    return h;
  }

  root.Malomo.ui={recId,stepper,health,siklus,inspector,board,portofolio,slots,pasar,audit,decisionCard,invalidationText,filterRecs};
})(globalThis);
