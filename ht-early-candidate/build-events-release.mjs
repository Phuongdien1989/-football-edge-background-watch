import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createHTEvents} from './events.mjs';
import {refreshH1Watch} from './mobile-collection.mjs';
const root='ht-event-release',pkg='previous-mobile',hash=b=>createHash('sha256').update(b).digest('hex');
const previous=JSON.parse(readFileSync(pkg+'/manifest.json'));assert.equal(previous.source_commit,'d521619f3319ff715e61e745a2f25fbc3b286ddc');
for(const f of previous.site){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(pkg+'/site/'+f.path)),f.sha256);}
mkdirSync(root,{recursive:true});cpSync(pkg+'/site',root+'/backup',{recursive:true});cpSync(pkg+'/site',root+'/site',{recursive:true});
let html=readFileSync(root+'/site/index.html','utf8'),original=html;const edits=[];
function replace(a,b){assert.equal(html.split(a).length,2);html=html.replace(a,b);edits.push({a,b});}
function extract(name){const start=html.indexOf('function '+name+'('),asyncStart=html.lastIndexOf('async ',start);const from=asyncStart===start-6?asyncStart:start;assert(from>=0);for(let end=html.indexOf('}',start);end>=0;end=html.indexOf('}',end+1)){const code=html.slice(from,end+1);try{new vm.Script('('+code+')');return code;}catch{}}throw Error('UNPARSEABLE_'+name);}
replace('  const HTTemporal=','  const HTEvents=('+createHTEvents.toString()+')();\n  const HTTemporal=');
replace(extract('refreshH1Watch'),refreshH1Watch.toString());replace(extract('h1WatchResetEvent'),'function h1WatchResetEvent(prev,s){return HTEvents.classify(prev,s);}');
let restored=html;for(const e of [...edits].reverse())restored=restored.replace(e.b,e.a);assert.equal(restored,original,'OUT_OF_SCOPE_HTML_CHANGE');writeFileSync(root+'/site/index.html',html);
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
const list=folder=>walk(root+'/'+folder).map(p=>({path:p.slice((root+'/'+folder+'/').length),sha256:hash(readFileSync(p))})).sort((a,b)=>a.path.localeCompare(b.path));
const backup=list('backup'),site=list('site'),changed=backup.filter(f=>site.find(s=>s.path===f.path)?.sha256!==f.sha256).map(f=>f.path);assert.deepEqual(changed,['index.html']);
const report={source_commit:process.env.GITHUB_SHA,previous_mobile:'0449307e-c464-4959-82b6-c4825789e568',backend_unchanged:'fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73',backup,site,changed,exact_scope_reconstruction:true};writeFileSync(root+'/manifest.json',JSON.stringify(report,null,2));writeFileSync(root+'/wrangler.json',JSON.stringify({name:'shiny-silence-d892',compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}},null,2));console.log(JSON.stringify({status:'PASS',changed,backup_files:backup.length}));
