import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,copyFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {trainArtifact} from '../prematch-ai/fit.mjs';
import {SCHEMA} from '../prematch-ai/contracts.mjs';
import {readPublicStatic} from '../ht-mechanism-recovery/public-read.mjs';
const action=process.argv[2],account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,sha=process.env.GITHUB_SHA;
assert(account&&token&&sha);const api='https://api.cloudflare.com/client/v4/accounts/'+account,mobile='shiny-silence-d892',backend='football-edge-background-watch',desktop='football-edge-desktop-b2-test',origin='https://'+mobile+'.ngophuonghuy.workers.dev';
const beforeMobile='611a74b2-2a1d-43fc-80ae-1c2b920e6df9',beforeBackend='fcf19574-3498-4ef3-9d08-d9fb575df365',beforeDesktop='a332ee39-abb2-422d-a021-db78ef19cc10',root='prematch-release/generated';mkdirSync(root,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),file=root+'/release.json';let report=existsSync(file)?JSON.parse(readFileSync(file)):{source:sha,provider_calls:0,production_db_writes:0,backend_modified:false,scanner_modified:false,push_calls:0};const save=()=>writeFileSync(file,JSON.stringify(report,null,2));
async function cf(path,opt={}){const r=await fetch(api+path,{...opt,headers:{Authorization:'Bearer '+token,...opt.headers},signal:AbortSignal.timeout(30000)}),j=await r.json();assert(r.ok&&j.success,JSON.stringify({path,status:r.status,errors:j.errors}));return j.result;}
async function active(n){const v=(await cf('/workers/scripts/'+n+'/deployments')).deployments[0].versions;assert.equal(v.length,1);assert.equal(v[0].percentage,100);return v[0].version_id;}
async function guards(m=beforeMobile){assert.equal(await active(mobile),m,'MOBILE_DRIFT');assert.equal(await active(backend),beforeBackend,'BACKEND_DRIFT');assert.equal(await active(desktop),beforeDesktop,'DESKTOP_DRIFT');}
function run(args){try{return execFileSync('npx',['--no-install','wrangler',...args],{encoding:'utf8',stdio:'pipe',timeout:180000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});}catch(e){throw Error('WRANGLER_FAILED_'+String(e.stderr||e.stdout).slice(-600));}}
async function setVersion(v){await cf('/workers/scripts/'+mobile+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:v,percentage:100}]})});}
async function hashes(dir){const out=[];function walk(p,rel=''){for(const f of readdirSync(p,{withFileTypes:true})){if(f.isDirectory())walk(p+'/'+f.name,rel+f.name+'/');else out.push({path:rel+f.name,sha256:hash(readFileSync(p+'/'+f.name))});}}walk(dir);return out;}
async function publicVerify(rows){for(const f of rows){const path=f.path==='index.html'?'/':f.path.endsWith('/index.html')?'/'+f.path.slice(0,-10):'/'+f.path;let ok=false;for(let i=0;i<3;i++){const r=await readPublicStatic(origin+path);if(r.ok&&hash(Buffer.from(await r.arrayBuffer()))===f.sha256){ok=true;break;}}assert(ok,'PUBLIC_HASH_'+f.path);}}
async function health(){const r=await fetch('https://'+backend+'.ngophuonghuy.workers.dev/health');assert(r.ok);const h=await r.json();return {source:h.deploy_commit,scanner:h.peak_status?.enabled,control_updated:h.peak_status?.updated};}
try{
 if(action==='prepare'){
  await guards();report.before=await health();const settings=await cf('/workers/scripts/'+backend+'/settings');assert.equal(settings.bindings.find(b=>b.name==='FOOTBALL_DB')?.id||settings.bindings.find(b=>b.name==='FOOTBALL_DB')?.database_id,'0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4');
  assert.equal((await cf('/workers/scripts/'+mobile+'/versions/'+beforeMobile)).id,beforeMobile);
  const source='verified/mechanism-mobile/site';assert(existsSync(source+'/index.html'));report.backup=await hashes(source);assert.equal(report.backup.length,54);await publicVerify(report.backup);
  cpSync(source,root+'/backup',{recursive:true});cpSync(source,root+'/site',{recursive:true});
  // Only the current snapshot is asserted. No historical receipt is backdated.
  const query=async(sql,params=[])=>{assert(/^SELECT /i.test(sql));const a=await cf('/d1/database/0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql,params})});const r=a[0];assert(r.success!==false);assert.equal(r.meta?.rows_written,0,'UNEXPECTED_D1_WRITE');report.d1_rows_read=(report.d1_rows_read||0)+(r.meta?.rows_read||0);assert(report.d1_rows_read<=200000,'READ_CAP');return r.results;};
  const history=await query("SELECT * FROM (SELECT fixture_id,league_id,kickoff,status,home_team_id,away_team_id,score_home,score_away,fulltime_home,fulltime_away,halftime_home,halftime_away FROM fixture_history WHERE kickoff<? ORDER BY kickoff DESC LIMIT 1500) WHERE status='FT'",[Math.floor(Date.now()/1000)]);
  const upcoming=await query("SELECT f.fixture_id,f.league_id,f.league,f.kickoff,f.status,f.home_team_id,f.away_team_id,h.name home_name,a.name away_name FROM fixture_history f LEFT JOIN teams h ON h.team_id=f.home_team_id LEFT JOIN teams a ON a.team_id=f.away_team_id WHERE f.kickoff>? AND f.kickoff<? AND f.status='NS' ORDER BY f.kickoff LIMIT 40",[Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)+86400*7]);
  const at=Date.now(),rows=history.map(r=>({id:r.fixture_id,leagueId:r.league_id,homeId:r.home_team_id,awayId:r.away_team_id,kickoff:r.kickoff*1000,availableAt:at,status:r.status,regulation:{home:r.fulltime_home??r.score_home,away:r.fulltime_away??r.score_away},halftime:Number.isInteger(r.halftime_home)&&Number.isInteger(r.halftime_away)?{home:r.halftime_home,away:r.halftime_away}:null}));
  const leagues=[...new Set([...upcoming.map(r=>r.league_id),...rows.map(r=>r.leagueId)])].filter(Number.isSafeInteger).slice(0,20),artifacts=[];report.training=[];
  for(const leagueId of leagues)try{const a=await trainArtifact({history:rows,leagueId,cutoff:at,synthetic:false});if(a.phases.FT.primary.converged){artifacts.push(a);report.training.push({leagueId,fixtures:a.training.fixtures,htFixtures:a.phases.HT?.fixtures??0,hash:a.hash,calibrated:false});}}catch{}
  const fixtures=upcoming.filter(r=>r.home_name&&r.away_name&&r.kickoff*1000>at).map(r=>({id:r.fixture_id,kind:'REAL',status:'NS',observedAt:at,kickoff:r.kickoff*1000,home:{id:r.home_team_id,name:r.home_name},away:{id:r.away_team_id,name:r.away_name},league:{id:r.league_id,name:r.league}}));
  const site=root+'/site';mkdirSync(site+'/prematch-ai',{recursive:true});mkdirSync(site+'/prematch-release',{recursive:true});
  for(const f of ['contracts.mjs','model.mjs','pricing.mjs','narrative.mjs','runtime.mjs','evidence.mjs','lab.mjs','worker.mjs','view.mjs','view.css']){let s=readFileSync('prematch-ai/'+f,'utf8');if(f==='lab.mjs')s="export function labInput(){throw Error('LAB_DISABLED_IN_PRODUCTION');}";writeFileSync(site+'/prematch-ai/'+f,s);}
  for(const f of ['production.mjs','data.mjs'])copyFileSync('prematch-release/'+f,site+'/prematch-release/'+f);
  writeFileSync(site+'/prematch-release/seed.json',JSON.stringify({schema:SCHEMA,snapshotAt:at,source:'EXISTING_D1_READ_ONLY_SNAPSHOT',fixtures,artifacts,quotes:[],evidence:[]}));report.realFixtures=fixtures.length;report.realArtifacts=artifacts.length;
  let ui=readFileSync(site+'/ui-tabs/integrated.mjs','utf8');const marker="['ftv2','FT AI V2']";assert(ui.includes(marker));ui=ui.replace(marker,marker+",['prematch','PRE-MATCH AI']");
  const hook=" try{if(current==='ftv2')";assert(ui.includes(hook));ui=ui.replace(hook,` try{if(current==='prematch'){const nav=root.querySelector('.ftabs-nav');const navHTML=tabs.map(([k,t])=>\`<button type="button" role="tab" data-ftabs-tab="\${k}" aria-controls="feTabsContent" aria-selected="\${k===current}">\${t}</button>\`).join('');if(navHTML!==lastNav){nav.innerHTML=navHTML;lastNav=navHTML;}const body=root.querySelector('.ftabs-content');body.id='feTabsContent';body.setAttribute('role','tabpanel');if(!body.querySelector('#fePrematchOfficial')){body.innerHTML='<section id="fePrematchOfficial" aria-label="PRE-MATCH AI thử nghiệm">Đang đọc dữ liệu PRE-MATCH…</section>';last='PREMATCH';}document.body.dataset.feTabsTab=current;root.dataset.current=current;window.dispatchEvent(new Event('fe-prematch-tab-open'));return;}if(current==='ftv2')`);
  ui=ui.replace("tabs.slice(1).map(([k,t])=>", "tabs.slice(1).filter(([k])=>k!=='prematch').map(([k,t])=>");writeFileSync(site+'/ui-tabs/integrated.mjs',ui);
  let html=readFileSync(site+'/index.html','utf8');html=html.replace('</body>','<link rel="stylesheet" href="/prematch-ai/view.css"><script type="module" src="/prematch-release/production.mjs"></script></body>');writeFileSync(site+'/index.html',html);
  report.candidate=await hashes(site);report.changed=report.backup.filter(x=>report.candidate.find(y=>y.path===x.path)?.sha256!==x.sha256).map(x=>x.path);assert.deepEqual(report.changed.sort(),['index.html','ui-tabs/integrated.mjs']);
  writeFileSync(root+'/wrangler.json',JSON.stringify({name:mobile,compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}}));writeFileSync(root+'/rollback.json',JSON.stringify({name:mobile,compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./backup'}}));report.status='PREPARED';save();
 }else if(action==='deploy'){
  await guards();assert.equal(report.status,'PREPARED');run(['deploy','--dry-run','--config',root+'/wrangler.json']);
  const output=run(['versions','upload','--keep-vars','--config',root+'/wrangler.json','--tag','fe-prematch-'+sha.slice(0,12)]),id=output.match(/(?:Worker )?Version ID:\s*([0-9a-f-]{36})/i)?.[1];assert(id,'VERSION_ID_REQUIRED');report.version=id;save();await setVersion(id);report.status='DEPLOYED';save();
 }else if(action==='verify'){
  await guards(report.version);await publicVerify(report.candidate);report.after=await health();assert.equal(report.after.source,report.before.source);report.status='VERIFIED';report.rollback=beforeMobile;save();
 }else if(action==='rollback'){
  if(report.version&&await active(mobile)===report.version){await setVersion(beforeMobile);await publicVerify(report.backup);report.status='ROLLED_BACK';save();}
 }else throw Error('UNKNOWN_ACTION');
}catch(e){report.error=String(e.message).slice(0,500);save();process.exitCode=1;}
console.log(JSON.stringify(report));
