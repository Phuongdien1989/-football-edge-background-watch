import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {fetchH1CollectionSnapshot,refreshH1Watch} from './mobile-collection.mjs';
const root='ht-session-release',pkg='accept-package/package',hash=b=>createHash('sha256').update(b).digest('hex');
const originalManifest=JSON.parse(readFileSync(pkg+'/manifest.json'));assert.equal(originalManifest.source_commit,'a9e9cc68cc07af27bdca0305b6f227da12f64cb9');
for(const f of originalManifest.files){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(pkg+'/'+f.path)),f.sha256,'PREVIOUS_PACKAGE_HASH_'+f.path);}
mkdirSync(root,{recursive:true});cpSync(pkg+'/site',root+'/backup',{recursive:true});cpSync(pkg+'/site',root+'/site',{recursive:true});
let html=readFileSync(root+'/site/index.html','utf8');const before=html;
assert.equal(hash(html),'3dcc0b43d6d1c2470cf16b5b45454d525b57121525b62248e6e861fe11559193','CURRENT_HT_BASELINE_DRIFT');
function extract(name){const start=html.indexOf('async function '+name+'(');assert(start>=0);for(let end=html.indexOf('}',start);end>=0;end=html.indexOf('}',end+1)){const s=html.slice(start,end+1);try{new vm.Script('('+s+')');return s;}catch{}}throw Error('UNPARSEABLE_'+name);}
const changes=[];for(const fn of [fetchH1CollectionSnapshot,refreshH1Watch]){const old=extract(fn.name),next=fn.toString();assert.equal(html.split(old).length,2);html=html.replace(old,next);changes.push({old,next});}
let restored=html;for(const c of [...changes].reverse())restored=restored.replace(c.next,c.old);assert.equal(restored,before,'OUT_OF_SCOPE_HTML_CHANGE');
writeFileSync(root+'/site/index.html',html);
for(const f of ['ui.mjs','style.css','assess-item.mjs','recommendation-session.mjs'])cpSync('ht-early-candidate/'+f,root+'/site/ht-candidate/'+f);
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
const list=folder=>walk(root+'/'+folder).map(p=>({path:p.slice((root+'/'+folder+'/').length),sha256:hash(readFileSync(p))})).sort((a,b)=>a.path.localeCompare(b.path));
const backup=list('backup'),site=list('site'),changed=backup.filter(f=>site.find(s=>s.path===f.path)?.sha256!==f.sha256).map(f=>f.path);
assert.deepEqual(changed,['ht-candidate/assess-item.mjs','ht-candidate/style.css','ht-candidate/ui.mjs','index.html']);
const report={source_commit:process.env.GITHUB_SHA,previous_mobile:'0a87e8c1-c1fa-4a89-ac54-ddd47ab6b2ed',backend_unchanged:'fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73',backup,site,changed,added:['ht-candidate/recommendation-session.mjs'],exact_scope_reconstruction:true};
writeFileSync(root+'/manifest.json',JSON.stringify(report,null,2));writeFileSync(root+'/wrangler.json',JSON.stringify({name:'shiny-silence-d892',compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}},null,2));console.log(JSON.stringify({status:'PASS',changed,backup_files:backup.length}));
