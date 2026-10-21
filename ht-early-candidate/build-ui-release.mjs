import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='ht-ui-release',pkg='previous-mobile',hash=b=>createHash('sha256').update(b).digest('hex');
const previous=JSON.parse(readFileSync(pkg+'/manifest.json'));
assert.equal(previous.source_commit,'74d25157b3a39bcc1157b07608498100d619a5b1');
for(const f of previous.site){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(pkg+'/site/'+f.path)),f.sha256,'PREVIOUS_ASSET_'+f.path);}
mkdirSync(root,{recursive:true});cpSync(pkg+'/site',root+'/backup',{recursive:true});cpSync(pkg+'/site',root+'/site',{recursive:true});
for(const f of ['ui.mjs','style.css'])cpSync('ht-early-candidate/'+f,root+'/site/ht-candidate/'+f);
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
const list=folder=>walk(root+'/'+folder).map(p=>({path:p.slice((root+'/'+folder+'/').length),sha256:hash(readFileSync(p))})).sort((a,b)=>a.path.localeCompare(b.path));
const backup=list('backup'),site=list('site');assert.equal(backup.length,site.length);
const changed=backup.filter(f=>site.find(s=>s.path===f.path)?.sha256!==f.sha256).map(f=>f.path);
assert.deepEqual(changed,['ht-candidate/style.css','ht-candidate/ui.mjs']);
const report={source_commit:process.env.GITHUB_SHA,previous_mobile:'bbddcaa4-1536-4f4e-852a-83f8ffd88b83',backend_unchanged:'fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73',backup,site,changed,added:[],scope:'HT league/country presentation only; no model, session, collector or index changes'};
writeFileSync(root+'/manifest.json',JSON.stringify(report,null,2));writeFileSync(root+'/wrangler.json',JSON.stringify({name:'shiny-silence-d892',compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}},null,2));
console.log(JSON.stringify({status:'PASS',changed,backup_files:backup.length}));
