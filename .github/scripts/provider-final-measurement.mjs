import {randomBytes} from 'node:crypto';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {measureCohort,summarize,SCHEMA_SQL,INSERT_SQL,ledgerValues} from '../../central-entry-measurement.mjs';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
if(!a||!t)throw Error('Cloudflare credentials unavailable');
const prod='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4',stage='7d503048-9118-4b29-b662-4e1ba6e32167',worker='football-edge-background-watch';
const root='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(a),helper='fe-result-check-'+process.env.GITHUB_RUN_ID,auth=randomBytes(32).toString('hex');
const report={at:new Date().toISOString(),mode:'BOUNDED_PROVIDER_CHECK_STAGING_ONLY',productionD1Writes:0,providerBatchesAttempted:0,providerBatchCap:8,cleanup:false,errors:[]};
async function cf(path,opts={}){const r=await fetch(root+path,{...opts,headers:{Authorization:'Bearer '+t,...opts.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||!j.success)throw Error('CF HTTP '+r.status+' '+path);return j.result}
async function query(db,sql,params=[]){if(db===prod&&!/^SELECT\b/.test(sql))throw Error('Production D1 writes prohibited');if(![prod,stage].includes(db))throw Error('Wrong DB');const rr=await cf('/d1/database/'+db+'/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql,params})});const r=rr[0];if(!r?.success)throw Error('D1 query failed');if(db===prod)assert.equal(Number(r.meta?.rows_written||0),0);return r}
async function deployments(){const result={};for(const n of [worker,'shiny-silence-d892','football-edge-desktop-b2-test'])result[n]=(await cf('/workers/scripts/'+n+'/deployments')).deployments?.[0]?.versions;return result}
const source=`export default {async fetch(request,env){
 if(request.headers.get('authorization')!=='Bearer '+env.CHECK_AUTH)return new Response('Unauthorized',{status:401});
 if(new URL(request.url).searchParams.has('ready'))return Response.json({ready:true});
 const body=await request.json();const ids=body.ids;
 if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(x=>!Number.isSafeInteger(x)||x<=0))return new Response('Invalid fixture IDs',{status:400});
 const stub=env.PRODUCTION_DO.get(env.PRODUCTION_DO.idFromName('football-edge-global'));
 try{
  const rows=await stub.api('/fixtures',{ids:ids.join('-')},true);
  return Response.json({ok:true,at:Date.now(),rows:rows.filter(f=>ids.includes(f.fixture?.id)).map(f=>({fixture:f.fixture,goals:f.goals,score:f.score}))});
 }catch(e){return Response.json({ok:false,error:String(e.message||e).slice(0,180)},{status:502})}
}};`;
let created=false,before=null,entries=[],sources=[];
if(process.env.FE_RESUME_SOURCES_PATH){sources=JSON.parse(readFileSync(process.env.FE_RESUME_SOURCES_PATH));if(!Array.isArray(sources))throw Error('Invalid resume sources')}
try{
 before=await deployments();report.versionsBefore=before;
 const settings=await cf('/workers/scripts/'+worker+'/settings');
 const namespace=settings.bindings?.find(x=>x.name==='BACKGROUND_WATCHER')?.namespace_id;
 if(namespace!=='a401c5da72a54ec1ba485db1b46d89c9')throw Error('Unexpected production namespace');
 const db=settings.bindings?.find(x=>x.name==='FOOTBALL_DB');if((db?.id||db?.database_id)!==prod)throw Error('Wrong production DB binding');
 entries=(await query(prod,"SELECT id,fixture_id,engine,captured_at,minute,score_home,score_away,policy_status,market_type,selection,line,price,odds_format FROM (SELECT e.*,ROW_NUMBER() OVER(PARTITION BY fixture_id,engine ORDER BY captured_at,id) rn FROM entry_decisions e WHERE engine IN ('FT','H1')) WHERE rn=1 ORDER BY captured_at,id")).results;
 const already=await measureCohort(entries,sources);
 const complete=new Set(already.filter(m=>m.measurement_status==='PAPER_RESOLVED').map(m=>m.sample_key));
 const ids=[...new Set(entries.filter(e=>!complete.has(e.engine+':'+e.fixture_id)).map(e=>e.fixture_id))];if(ids.length>160)throw Error('Reviewed provider cap exceeded; do not truncate');
 report.entrySamples=entries.length;report.uniqueFixtures=ids.length;
 const metadata={main_module:'check.mjs',compatibility_date:'2026-10-01',bindings:[{type:'durable_object_namespace',name:'PRODUCTION_DO',namespace_id:namespace},{type:'secret_text',name:'CHECK_AUTH',text:auth}]};
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));form.append('check.mjs',new Blob([source],{type:'application/javascript+module'}),'check.mjs');
 await cf('/workers/scripts/'+helper,{method:'PUT',body:form});created=true;
 await cf('/workers/scripts/'+helper+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});
 const domain=await cf('/workers/subdomain'),url='https://'+helper+'.'+domain.subdomain+'.workers.dev/';
 let ready=false;for(let i=0;i<8;i++){const r=await fetch(url+'?ready=1',{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(15000)});if(r.ok){ready=true;break}await new Promise(r=>setTimeout(r,2000))}if(!ready)throw Error('Result checker not ready');
 for(let i=0;i<ids.length;i+=20){
  if(report.providerBatchesAttempted>=8)throw Error('Provider batch cap');report.providerBatchesAttempted++;
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({ids:ids.slice(i,i+20)}),signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok||!result.ok)throw Error('Provider check failed: '+(result.error||response.status));
  for(const f of result.rows||[]){const fid=f.fixture?.id,status=f.fixture?.status?.short;report.statuses??={};report.statuses[status]=(report.statuses[status]||0)+1;
   sources.push({id:'PROVIDER-FINAL-'+fid+'-'+result.at,fixture_id:fid,raw_fixture_id:fid,source:'PROVIDER_FINAL_REFRESH',status,raw_status:status,captured_at:result.at,fulltime_home:f.score?.fulltime?.home??null,fulltime_away:f.score?.fulltime?.away??null,halftime_home:f.score?.halftime?.home??null,halftime_away:f.score?.halftime?.away??null,raw_goals_home:f.goals?.home??null,raw_goals_away:f.goals?.away??null});
  }
  // Preserve each completed batch before any next provider request.
  writeFileSync('provider-final-sources.json',JSON.stringify(sources,null,2));
  writeFileSync('provider-final-entries.json',JSON.stringify(entries,null,2));
 }
 const measured=await measureCohort(entries,sources);report.summary=summarize(measured);report.returnedFixtures=new Set(sources.map(x=>x.fixture_id)).size;
 await query(stage,SCHEMA_SQL);
 async function save(){let written=0;for(let i=0;i<measured.length;i+=10){const chunk=measured.slice(i,i+10),statement=INSERT_SQL.replace('VALUES(?,?,?,?,?,?,?,?,?)','VALUES'+chunk.map(()=>'(?,?,?,?,?,?,?,?,?)').join(','));const r=await query(stage,statement,chunk.flatMap(ledgerValues));written+=Number(r.meta?.rows_written||0)}return written}
 report.stageRowsWritten=await save();report.repeatRowsWritten=await save();assert.equal(report.repeatRowsWritten,0);
 report.versionsAfter=await deployments();assert.deepEqual(report.versionsAfter,before);
 writeFileSync('provider-final-measurements.json',JSON.stringify(measured,null,2));writeFileSync('provider-final-sources.json',JSON.stringify(sources,null,2));
}catch(e){report.errors.push(e.message);process.exitCode=1}
finally{
 writeFileSync('provider-final-sources.json',JSON.stringify(sources,null,2));
 if(entries.length){const partial=await measureCohort(entries,sources);report.partialSummary=summarize(partial);writeFileSync('provider-final-measurements.json',JSON.stringify(partial,null,2));writeFileSync('provider-final-entries.json',JSON.stringify(entries,null,2));report.pendingSampleKeys=partial.filter(m=>m.measurement_status!=='PAPER_RESOLVED').map(m=>m.sample_key)}
 if(before){try{report.versionsAfter=await deployments();assert.deepEqual(report.versionsAfter,before)}catch(e){report.errors.push('Version verification '+e.message);process.exitCode=1}}
 if(created){try{await cf('/workers/scripts/'+helper,{method:'DELETE'});report.cleanup=true}catch(e){report.errors.push('Helper cleanup failed '+e.message);process.exitCode=1}}
 writeFileSync('provider-final-measurement-report.json',JSON.stringify(report,null,2));console.log('PROVIDER_FINAL_MEASUREMENT_REPORT '+JSON.stringify(report));
}
