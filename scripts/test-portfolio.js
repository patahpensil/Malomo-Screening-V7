'use strict';
/* Tes PRD v1.0.16 R38 — posisi nyata pengguna: "Saya ambil" pada entri jurnal Decision, posisi manual (validasi, hasil
   otomatis dari candle 4H tanpa horizon, tutup sendiri), untung/rugi USDT, panel risiko dari posisi nyata, CSV manual.
   "Saya ambil" tidak boleh mengubah skor, harga sinyal, atau hasil sinyal. */
const assert=require('node:assert/strict');
const PF=require('../app/portfolio'),LG=require('../app/ledger');
const H4=4*3600*1000,T0=Date.UTC(2026,9,10,8);
let count=0;const failures=[];const queue=[];const test=(n,f)=>queue.push([n,f]);
const c=(i,o,h,l,cl)=>({t:T0+i*H4,open:o,high:h,low:l,close:cl});
const rec=(o={})=>Object.assign({symbol:'SOLUSDT',side:'LONG',signal_family:'BREAKOUT_RETEST',status:'ENTRY_CONSIDER',decision_available_utc:new Date(T0).toISOString().replace('.000Z','Z'),
  entry_reference_time_utc:new Date(T0).toISOString().replace('.000Z','Z'),entry_reference_open:100,stop_price:97,target_price:106,target2_price:109,rr_target:2,rr_target2:3,tp1_fraction:0.5,atr_entry:2,
  scores:{m1_100:60,m2_signal_quality_80:50,m2_100:70,m3_100:50,m4_100:100,m5_100:55,m6_confluense_500:335,m1_plus_m2q_0_180_display_only:110}},o);
const ledgerWith=(...recs)=>{const L=LG.empty();LG.freeze(L,recs,{currentT:T0,now:T0});return L;};

test('Saya ambil: entry & qty wajib > 0; entry melewati SL ditolak; data sinyal (skor, harga, hasil) tidak berubah; batal ambil',()=>{
  const L=ledgerWith(rec()),k=Object.keys(L.entries)[0],before=JSON.stringify(L.entries[k]);
  assert.deepEqual(PF.take(L,k,{entry:'',qty:'1'}).errors,{entry:'INVALID'});
  assert.deepEqual(PF.take(L,k,{entry:'100',qty:'0'}).errors,{qty:'INVALID'});
  assert.equal(PF.take(L,k,{entry:'96',qty:'1'}).errors.entry,'BEYOND_STOP');
  assert.equal(PF.take(L,'x',{entry:'1',qty:'1'}).errors.key,'NOT_FOUND');
  assert.equal(JSON.stringify(L.entries[k]),before,'percobaan gagal tidak mengubah entri');
  assert(PF.take(L,k,{entry:'100,5',qty:'2',now:T0+60000}).ok);
  const e=L.entries[k];assert.deepEqual(e.taken,{atMs:T0+60000,entry:100.5,qty:2});
  const strip=x=>{const y=JSON.parse(JSON.stringify(x));delete y.taken;return JSON.stringify(y);};
  assert.equal(strip(e),before,'hanya field taken yang bertambah');
  // tersimpan & dimuat ulang apa adanya
  const L2=LG.load(JSON.parse(JSON.stringify(L)));assert.deepEqual(L2.entries[k].taken,e.taken);
  assert(PF.untake(L,k));assert(!('taken' in L.entries[k]));assert.equal(PF.untake(L,k),false);
});
test('Untung/rugi posisi diambil = harga entry aktual × qty; SL/TP dari sinyal; biaya bps atas notional',()=>{
  const L=ledgerWith(rec(),rec({symbol:'ADAUSDT'}),rec({symbol:'XRPUSDT'})),ks=Object.keys(L.entries);
  for(const k of ks)PF.take(L,k,{entry:'101',qty:'2'});
  LG.resolve(L,{SOLUSDT:[c(0,100,101,96,97)],ADAUSDT:[c(0,100,106.5,99,106),c(1,106,107,96,97)],XRPUSDT:[c(0,100,110,99,109)]},T0+2*H4);
  const P=sym=>PF.fromTaken(Object.values(L.entries).find(e=>e.symbol===sym));
  assert(Math.abs(PF.pnl(P('SOLUSDT'))-2*(97-101))<1e-12);                                  // SL: −8
  assert(Math.abs(PF.pnl(P('ADAUSDT'))-(1*(106-101)+1*(97-101)))<1e-12);                    // TP1 lalu SL: +1
  assert(Math.abs(PF.pnl(P('XRPUSDT'))-(1*(106-101)+1*(109-101)))<1e-12);                   // TP1+TP2: +13
  assert(Math.abs(PF.pnl(P('XRPUSDT'),18)-(13-0.0018*2*101))<1e-12);
  const o=Object.assign({},P('SOLUSDT'),{done:{code:'NO_DATA'}});assert.equal(PF.pnl(o),null,'NO_DATA tidak ditebak');
});
test('Posisi manual: validasi (pair, arah, sisi SL/TP, TP2 butuh TP1, qty dari risiko% × modal)',()=>{
  const v=raw=>PF.validateManual(raw,{capital:1000});
  assert.equal(v({symbol:'sol',side:'LONG',entry:'100',stop:'97',qty:'1'}).errors.symbol,'INVALID');
  assert.equal(v({symbol:'SOLUSDT',side:'LONG',entry:'100',stop:'103',qty:'1'}).errors.stop,'WRONG_SIDE');
  assert.equal(v({symbol:'SOLUSDT',side:'SHORT',entry:'100',stop:'103',target:'105',qty:'1'}).errors.target,'WRONG_SIDE');
  assert.equal(v({symbol:'SOLUSDT',side:'LONG',entry:'100',stop:'97',target2:'109',qty:'1'}).errors.target2,'NEED_TP1');
  assert.equal(v({symbol:'SOLUSDT',side:'LONG',entry:'100',stop:'97',target:'106',target2:'104',qty:'1'}).errors.target2,'WRONG_SIDE');
  assert.equal(PF.validateManual({symbol:'SOLUSDT',side:'LONG',entry:'100',stop:'97',riskPct:'1'},{capital:null}).errors.qty,'NEED_CAPITAL');
  const ok=v({symbol:'SOLUSDT',side:'LONG',entry:'100',stop:'97',target:'106',target2:'109',riskPct:'1'});
  assert(ok.ok);assert(Math.abs(ok.value.qty-10/3)<1e-12);assert.equal(ok.value.tp1Frac,0.5);
  const one=v({symbol:'SOLUSDT',side:'SHORT',entry:'100',stop:'103',target:'94',qty:'2'});assert(one.ok);assert.equal(one.value.tp1Frac,1);assert.equal(one.value.target2,null);
});
test('Posisi manual: hasil otomatis dari candle setelah dibuka (candle pembukaan diabaikan), TP1/TP2, SL tetap, tanpa horizon',()=>{
  const m=PF.emptyManual(),opened=T0+H4/2;
  const id=PF.addManual(m,{symbol:'SOLUSDT',side:'LONG',entry:'100',stop:'97',target:'106',target2:'109',qty:'2'},{now:opened}).id;
  // candle 0 (tempat posisi dibuka) menyentuh SL → diabaikan; candle 1 TP1; candle 2 masih jalan; candle 3 SL → TP1 lalu SL
  const cs=[c(0,100,101,96,100),c(1,100,106.5,99,106),c(2,106,107,99,105)];
  PF.resolveManual(m,{SOLUSDT:cs},T0+3*H4);const p=m.positions[id];
  assert.equal(p.closed,null);assert.equal(p.tp1AtMs,T0+2*H4);
  // lewat 24 jam pun tetap terbuka (tanpa horizon)
  const many=[...cs,...[3,4,5,6,7,8,9].map(i=>c(i,105,107,99,105))];PF.resolveManual(m,{SOLUSDT:many},T0+10*H4);assert.equal(p.closed,null);
  PF.resolveManual(m,{SOLUSDT:[...many,c(10,105,105,96.5,97)]},T0+11*H4);
  assert.equal(p.closed.code,'TP1_STOP');assert.equal(p.closed.exit,97);assert(Math.abs(PF.pnl(PF.fromManual(p))-(1*6+1*(-3)))<1e-12);
  // SHORT tanpa TP: hanya SL
  const id2=PF.addManual(m,{symbol:'ADAUSDT',side:'SHORT',entry:'100',stop:'103',qty:'1'},{now:T0}).id;
  PF.resolveManual(m,{ADAUSDT:[c(0,100,101,80,85),c(1,85,103.2,84,103)]},T0+2*H4);assert.equal(m.positions[id2].closed.code,'STOP_HIT');
  // TP1 dan TP2 pada candle yang sama
  const id3=PF.addManual(m,{symbol:'XRPUSDT',side:'LONG',entry:'100',stop:'97',target:'106',target2:'109',qty:'1'},{now:T0}).id;
  PF.resolveManual(m,{XRPUSDT:[c(0,100,110,99,109)]},T0+H4);assert.equal(m.positions[id3].closed.code,'TARGET_HIT');assert(Math.abs(PF.pnl(PF.fromManual(m.positions[id3]))-7.5)<1e-12);
});
test('Posisi manual: tutup sendiri (sisa qty di harga keluar), hapus, muat ulang aman, CSV',()=>{
  const m=PF.emptyManual();
  const id=PF.addManual(m,{symbol:'SOLUSDT',side:'LONG',entry:'100',stop:'97',target:'106',target2:'109',qty:'2'},{now:T0}).id;
  assert.equal(PF.closeManual(m,id,{exit:'x'}).errors.exit,'INVALID');
  m.positions[id].tp1AtMs=T0+H4;   // TP1 sudah kena
  assert(PF.closeManual(m,id,{exit:'104',now:T0+5*H4}).ok);assert.equal(PF.closeManual(m,id,{exit:'104'}).ok,false);
  assert(Math.abs(PF.pnl(PF.fromManual(m.positions[id]))-(1*6+1*4))<1e-12);
  const id2=PF.addManual(m,{symbol:'ADAUSDT',side:'LONG',entry:'1',stop:'0.9',qty:'10'},{now:T0+1}).id;
  assert(PF.removeManual(m,id2));assert(!m.positions[id2]);
  const bad=JSON.parse(JSON.stringify(m));bad.positions.Z={id:'Z',symbol:'X',side:'UP',entry:-1,stop:1,qty:1};
  const L=PF.loadManual(bad);assert.deepEqual(Object.keys(L.positions),[id]);assert.deepEqual(PF.loadManual({version:9}).positions,{});
  const csv=PF.csvManual(PF.closedManual(m),{costBps:0}).replace(/^﻿/,'').trim().split('\r\n');
  assert.equal(csv[0],PF.MCOLS.join(','));assert.equal(csv.length,2);assert(csv[1].includes('USER_CLOSE')&&csv[1].endsWith(',10.0000'));
});
test('Panel risiko dari posisi nyata: posisi terbuka, risiko tersisa (setengah setelah TP1), drawdown & kumulatif dalam USDT dan % modal',()=>{
  const L=ledgerWith(rec(),rec({symbol:'ADAUSDT'}),rec({symbol:'XRPUSDT'})),ks=Object.keys(L.entries);
  // SOL & ADA diambil, XRP tidak
  PF.take(L,ks.find(k=>k.startsWith('SOL')),{entry:'100',qty:'2'});PF.take(L,ks.find(k=>k.startsWith('ADA')),{entry:'100',qty:'1'});
  const m=PF.emptyManual();PF.addManual(m,{symbol:'BNBUSDT',side:'SHORT',entry:'50',stop:'52',qty:'3'},{now:T0});
  let k=PF.real(L,m,{now:T0+H4,capital:1000});
  assert.equal(k.positions,3);assert.equal(k.taken,2);assert.equal(k.manual,1);assert.equal(k.longs,2);assert.equal(k.shorts,1);
  assert(Math.abs(k.riskUsdt-(2*3+1*3+3*2))<1e-12);assert(Math.abs(k.openRiskPct-1.5)<1e-12);assert.equal(k.closed,0);
  // ADA kena TP1 (sisa setengah), SOL kena SL → risiko terbuka = ADA ½·1·3 + BNB 6; kumulatif = −6
  LG.resolve(L,{SOLUSDT:[c(0,100,101,96,97)],ADAUSDT:[c(0,100,106.5,99,106)]},T0+H4);
  k=PF.real(L,m,{now:T0+H4,capital:1000});
  assert.equal(k.positions,2);assert(Math.abs(k.riskUsdt-(1.5+6))<1e-12);assert(Math.abs(k.cumUsdt+6)<1e-12);assert(Math.abs(k.cumPct+0.6)<1e-12);assert(Math.abs(k.ddPct-0.6)<1e-12);
  // tanpa modal: persen null, jumlah tetap
  const n=PF.real(L,m,{now:T0+H4,capital:null});assert.equal(n.openRiskPct,null);assert.equal(n.positions,2);assert.equal(n.hasCapital,false);
});
test('Jurnal: filter Diambil ya/tidak dan kolom CSV catatan pengguna',()=>{
  const L=ledgerWith(rec(),rec({symbol:'ADAUSDT'})),ks=Object.keys(L.entries);
  PF.take(L,ks.find(k=>k.startsWith('SOL')),{entry:'100',qty:'2'});
  LG.resolve(L,{SOLUSDT:[c(0,100,101,96,97)],ADAUSDT:[c(0,100,101,96,97)]},T0+H4);
  const f=LG.finished(L);assert.deepEqual(LG.filter(f,{taken:'yes'}).map(e=>e.symbol),['SOLUSDT']);assert.deepEqual(LG.filter(f,{taken:'no'}).map(e=>e.symbol),['ADAUSDT']);
  const csv=LG.csv(f,{pnl:e=>PF.pnl(PF.fromTaken(e),0)}).replace(/^﻿/,'').trim().split('\r\n'),h=csv[0].split(',');
  for(const col of ['diambil','entry_aktual','qty_aktual','pnl_usdt_perkiraan'])assert(h.includes(col),col);
  const sol=csv.find(l=>l.includes('SOLUSDT')).split(','),ada=csv.find(l=>l.includes('ADAUSDT')).split(',');
  assert.equal(sol[h.indexOf('diambil')],'ya');assert.equal(sol[h.indexOf('pnl_usdt_perkiraan')],'-6.0000');assert.equal(ada[h.indexOf('diambil')],'tidak');assert.equal(ada[h.indexOf('pnl_usdt_perkiraan')],'');
});

(async()=>{
  for(const [name,fn] of queue){try{await fn();count++;console.log('PASS '+name);}catch(e){failures.push(name);console.log('FAIL '+name+' — '+String(e&&e.message||e).split('\n')[0]);}}
  console.log(`\n${count} PASS, ${failures.length} FAIL`);
  if(failures.length)process.exit(1);
})();
