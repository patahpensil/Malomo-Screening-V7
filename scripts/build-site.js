'use strict';
/* Menyusun situs statis _site/ untuk GitHub Pages: app/ di akar, engine/ apa adanya, array kalibrasi beku + manifest
   di data/, build-info.json (commit + hasil tes). Tidak ada bundler dan tidak ada dependensi. */
const fs=require('node:fs'),path=require('node:path'),{execSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,process.argv[2]||'_site');
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(path.join(OUT,'engine'),{recursive:true});fs.mkdirSync(path.join(OUT,'data'));
const cp=(from,to)=>fs.copyFileSync(path.join(ROOT,from),path.join(OUT,to));
for(const f of fs.readdirSync(path.join(ROOT,'app')))cp('app/'+f,f);
for(const f of ['core.js','m1.js','generators.js','m2.js','m3m4.js','pipeline.js'])cp('engine/'+f,'engine/'+f);
for(const f of ['frozen_cdf_normalization.json','frozen_v2_normalizations.json'])cp('evidence/'+f,'data/'+f);
cp('MANIFEST_SHA256.json','data/MANIFEST_SHA256.json');
let commit=process.env.GITHUB_SHA||'';try{if(!commit)commit=execSync('git rev-parse HEAD',{cwd:ROOT}).toString().trim();}catch{commit='lokal';}
let tests=null;try{tests=JSON.parse(fs.readFileSync(path.join(ROOT,'test-results.json'),'utf8'));}catch{/* belum dijalankan */}
const builtAt=new Date().toISOString();
fs.writeFileSync(path.join(OUT,'build-info.json'),JSON.stringify({commit:commit.slice(0,12),builtAt,testsRanAt:tests?tests.ranAt:null,suites:tests?tests.suites:[]},null,2));
const sw=path.join(OUT,'sw.js');fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').replace('__BUILD__',commit.slice(0,12)+'-'+builtAt.replace(/\D/g,'').slice(0,14)));
fs.writeFileSync(path.join(OUT,'.nojekyll'),'');
console.log('Situs disusun di '+path.relative(ROOT,OUT)+' (commit '+commit.slice(0,12)+')');
