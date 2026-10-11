'use strict';
/* Menjalankan semua suite tes non-browser, mencatat jumlah PASS/FAIL ke test-results.json (dibaca build-site untuk layar
   Audit), dan keluar dengan kode ≠ 0 bila ada satu saja yang gagal. Deploy GitHub Pages hanya berjalan bila ini lulus. */
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const SUITES=[
  {name:'Engine M1–M6 (PRD v1.0.8)',cmd:'node',args:['scripts/test-engine.js']},
  {name:'Paritas skor M2 vs bukti 2024',cmd:'node',args:['scripts/test-parity-m2.js']},
  {name:'Aplikasi (siklus, transport, live, label)',cmd:'node',args:['scripts/test-app.js']},
  {name:'Rencana siap salin R32 + rezim BTC R33',cmd:'node',args:['scripts/test-exec.js']},
  {name:'Universe 100 pair R34 + invarian skor',cmd:'node',args:['scripts/test-universe.js']},
  {name:'Verifier PRD (Python)',cmd:'python3',args:['verify_final_prd.py'],json:true},
];
const out=[];let failed=false;
for(const s of SUITES){
  const r=spawnSync(s.cmd,s.args,{cwd:ROOT,encoding:'utf8'});
  const text=(r.stdout||'')+(r.stderr||'');process.stdout.write(text);
  let pass=0,fail=0;
  if(s.json){const p=text.match(/"passed":\s*(\d+)/),f=text.match(/"failed":\s*(\d+)/);pass=p?+p[1]:0;fail=f?+f[1]:1;}
  else{const m=text.match(/(\d+) PASS, (\d+) FAIL\s*$/);pass=m?+m[1]:0;fail=m?+m[2]:1;}
  if(r.status!==0||fail>0||pass===0){failed=true;console.log('✗ '+s.name+' GAGAL');}
  out.push({name:s.name,pass,fail});
}
fs.writeFileSync(path.join(ROOT,'test-results.json'),JSON.stringify({ranAt:new Date().toISOString(),suites:out},null,2));
console.log('\nRingkasan: '+out.map(s=>s.name+' '+s.pass+'/'+(s.pass+s.fail)).join(' · '));
process.exit(failed?1:0);
