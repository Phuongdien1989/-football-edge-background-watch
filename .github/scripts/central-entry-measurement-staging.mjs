import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {measureCohort,summarize,SCHEMA_SQL,INSERT_SQL,ledgerValues,measureEntry,identifyMeasurement} from '../../central-entry-measurement.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare credentials unavailable');
const PROD='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4',STAGE='7d503048-9118-4b29-b662-4e1ba6e32167';
assert.notEqual(PROD,STAGE);
const root='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account);
let productionRowsRead=0,stageRowsWritten=0;
async function cf(path,opts={}){const r=await fetch(root+path,{...opts,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000)});const j=await r.json();if(!r.ok||!j.success)throw Error('CF request failed HTTP '+r.status+' '+path);return j.result}
async function sql(db,statement,params=[]){
 if(db===PROD&&!/^SELECT\b/.test(statement))throw Error('Production writes prohibited');
 if(![PROD,STAGE].includes(db))throw Error('Database not allowed');
 const rr=await cf('/d1/database/'+db+'/query',{method:'POST',body:JSON.stringify({sql:statement,params})});const r=rr[0];if(!r?.success)throw Error('D1 query failed');
 const written=Number(r.meta?.rows_written||0);if(db===PROD){assert.equal(written,0);productionRowsRead+=Number(r.meta?.rows_read||0)}else stageRowsWritten+=written;
 return {rows:r.results||[],written};
}
async function deployments(){const r={};for(const n of ['football-edge-background-watch','shiny-silence-d892','football-edge-desktop-b2-test']){const j=await cf('/workers/scripts/'+n+'/deployments');r[n]=j.deployments?.[0]?.versions}return r}
const before=await deployments();
const firstSql="SELECT id,fixture_id,engine,captured_at,minute,score_home,score_away,policy_status,market_type,selection,line,price,odds_format,resolution,outcome,unit_pl FROM (SELECT e.*,ROW_NUMBER() OVER(PARTITION BY fixture_id,engine ORDER BY captured_at,id) rn FROM entry_decisions e WHERE engine IN ('FT','H1')) WHERE rn=1 ORDER BY captured_at,id";
const entries=(await sql(PROD,firstSql)).rows;if(entries.length>1000)throw Error('Cohort exceeds reviewed job bound; do not truncate');
const sourceSql="SELECT l.id,l.fixture_id,l.source,l.status,l.captured_at,json_extract(l.payload_json,'$.fixture.fixture.id') raw_fixture_id,json_extract(l.payload_json,'$.fixture.fixture.status.short') raw_status,json_extract(l.payload_json,'$.fixture.score.halftime.home') halftime_home,json_extract(l.payload_json,'$.fixture.score.halftime.away') halftime_away,json_extract(l.payload_json,'$.fixture.score.fulltime.home') fulltime_home,json_extract(l.payload_json,'$.fixture.score.fulltime.away') fulltime_away,json_extract(l.payload_json,'$.fixture.goals.home') raw_goals_home,json_extract(l.payload_json,'$.fixture.goals.away') raw_goals_away FROM live_snapshots l WHERE l.source IN ('BACKGROUND','EVIDENCE_FOLLOWUP') AND l.status IN ('HT','2H','FT') AND EXISTS (SELECT 1 FROM entry_decisions e WHERE e.fixture_id=l.fixture_id AND e.engine IN ('FT','H1')) ORDER BY l.fixture_id,l.captured_at";
const sources=(await sql(PROD,sourceSql)).rows;if(sources.length>10000)throw Error('Sources exceed reviewed bound; do not truncate');
const measured=await measureCohort(entries,sources),summary=summarize(measured);
await sql(STAGE,SCHEMA_SQL);
async function insert(records){let wrote=0;for(let i=0;i<records.length;i+=10){const chunk=records.slice(i,i+10);const statement=INSERT_SQL.replace('VALUES(?,?,?,?,?,?,?,?,?)','VALUES'+chunk.map(()=>'(?,?,?,?,?,?,?,?,?)').join(','));wrote+=(await sql(STAGE,statement,chunk.flatMap(ledgerValues))).written}return wrote}
const firstWrites=await insert(measured),secondWrites=await insert(await measureCohort(entries,sources,{observedAt:Date.now()+1000}));
assert.equal(secondWrites,0,'Repeated measurement must not consume D1 writes');
for(const m of measured.slice(0,2)){const r=(await sql(STAGE,'SELECT payload_json FROM fe_entry_measurements WHERE measurement_id=?',[m.measurement_id])).rows[0];assert.equal(JSON.parse(r.payload_json).anchor_entry_id,m.anchor_entry_id)}
// A pending result, its later valid source, and a conflicting correction are appended,
// preserving all three versions. Neither old outcomes nor source observations change.
const e={id:'stage-test-first',fixture_id:9,engine:'FT',captured_at:1000,score_home:0,score_away:0,market_type:'OU_FT',selection:'OVER',line:.5,price:2,odds_format:'DEC'};
const s={id:'stage-source',fixture_id:9,raw_fixture_id:9,source:'BACKGROUND',status:'FT',raw_status:'FT',captured_at:2000,fulltime_home:1,fulltime_away:0,raw_goals_home:1,raw_goals_away:0};
const states=[[],[s],[s,{...s,id:'stage-correction',captured_at:3000,fulltime_home:0,raw_goals_home:0}]];
const samples=[];for(const ss of states)samples.push(await identifyMeasurement({...measureEntry(e,ss),sample_key:'STAGING_LIFECYCLE:FT9'}));
await insert(samples);assert.equal(await insert(samples),0);
const check=(await sql(STAGE,"SELECT measurement_status,payload_json FROM fe_entry_measurements WHERE sample_key='STAGING_LIFECYCLE:FT9'")).rows;
assert.equal(check.length,3);assert.equal(check.filter(r=>r.measurement_status==='PAPER_RESOLVED').length,1);assert.equal(check.filter(r=>JSON.parse(r.payload_json).reason==='CONFLICTING_RAW_PERIOD_SCORES').length,1);
assert.deepEqual(await deployments(),before,'Deployments must remain unchanged');
const report={at:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA,mode:'PRODUCTION_READ_ONLY_STAGING_LEDGER',productionWrites:0,productionRowsRead,providerCalls:0,stageDatabase:STAGE,stageRowsWritten,firstReplayRowsWritten:firstWrites,secondReplayRowsWritten:secondWrites,appendOnlyLifecycle:'PASS',productionDeploymentsUnchanged:true,summary,limits:['Whole-period paper settlement only; bookmaker execution and settlement basis not verified.','Raw scores were already stored by app; no independent provider refresh.','Unknown samples remain in denominator and are reported separately.','No production ledger table or backend route was installed.']};
writeFileSync('central-entry-measurement-staging.json',JSON.stringify(report,null,2));writeFileSync('central-entry-measurements.json',JSON.stringify(measured,null,2));console.log('CENTRAL_MEASUREMENT_STAGING_PASS '+JSON.stringify(report));
