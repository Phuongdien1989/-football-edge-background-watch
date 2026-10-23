// ONE-SHOT LIVE read-only D1 source discovery. No table creation or source payload export.
// Only allowlisted, index-backed FT SELECTs after a fresh UTC D1 usage check.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {LEGACY_META_SQL,assertSafeFTReadSQL,buildLegacyFTReadPlan,
 summarizeLegacyFTSamples,selectMarketFixtureCandidate,LEGACY_MARKET_SPEC} from './legacy-ft-source-plan.mjs';
const dbId='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const path='ft-audit-output/ft-legacy-source-readonly.json';
const report={scope:'FT_LEGACY_SOURCE_READONLY_PRODUCTION',at:new Date().toISOString(),
 status:'NOT_RUN',queries:[],tables:[],samples:[],errors:[],reads_run:0,
 db_writes:0,provider_calls:0,scanner_actions:0,deployments:0,
 raw_payload_export:false,fixture_ids_exported:false,
 verified_pair_observations:0,verified_odds_bets:0,validated_model_rows:0,
 training_ready:false,source_authenticity_certified:false};
const utcDay=new Date().toISOString().slice(0,10);
const save=()=>{mkdirSync('ft-audit-output',{recursive:true});writeFileSync(path,JSON.stringify(report,null,2));};
async function runSQL(key,sql,params=[],limit){
 assertSafeFTReadSQL(sql);
 assert(report.reads_run<6,'READ_ONLY_SQL_CALL_CAP_REACHED');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+
  '/d1/database/'+dbId+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(18000)});
 report.reads_run++;
 const json=await r.json();
 assert(r.ok&&json.success,'D1_READ_ONLY_QUERY_FAILED_'+key+'_HTTP_'+r.status);
 const result=json.result?.[0];
 assert(result&&result.success!==false&&Array.isArray(result.results),'MISSING_D1_READ_RESULT_'+key);
 const read=result.meta?.rows_read,written=result.meta?.rows_written;
 assert(typeof written==='number'&&written===0,'NONZERO_D1_WRITES_REPORTED');
 assert(typeof read==='number'&&Number.isFinite(read)&&read>=0&&read<=12000,'EXCESSIVE_D1_READ');
 assert(result.results.length<=limit,'UNEXPECTED_D1_SAMPLE_VOLUME');
 report.queries.push({key,rows_returned:result.results.length,billed_rows_read:read,billed_rows_written:written});
 return result.results;
}
try{
 assert(account&&token,'READ_ONLY_CREDENTIALS_REQUIRED');
 assert(process.env.GITHUB_RUN_ATTEMPT==='1'&&process.env.FT_LEGACY_SOURCE_READ_ONCE==='CONFIRM',
 'ONE_SHOT_READ_ONLY_PERMISSION_REQUIRED');
 const usage=JSON.parse(readFileSync('ft-audit-output/ft-d1-readonly-usage.json','utf8'));
 assert(usage.status==='PASS'&&usage.utc_day===utcDay&&
 Date.now()-Date.parse(usage.at)<300000,'FRESH_CURRENT_UTC_ANALYTICS_REQUIRED');
 assert(usage.today?.rowsWritten<95000&&usage.today?.rowsRead<4500000,
 'FREE_D1_BUDGET_NOT_CONFIRMED');
 report.utc_day=utcDay;
 report.analytics_rows_written=usage.today.rowsWritten;
 report.analytics_rows_read=usage.today.rowsRead;
 report.analytics_note='Cloudflare sampled/adaptive counters, not exact invoice';
 const schema=await runSQL('schema',LEGACY_META_SQL,[],80);
 const plan=buildLegacyFTReadPlan(schema);
 report.tables=plan.existing_tables;
 report.missing_replay_tables=plan.missing_replay_tables;
 report.skipped=plan.reasons;
 report.indexed_probe_candidates=plan.discovery_candidate_tables;
 const rawSample={};
 for(const step of plan.queries){
  try{
   const rows=await runSQL(step.key,step.sql,step.params,step.maxResultRows);
   rawSample[step.key]=rows;
   report.samples.push(summarizeLegacyFTSamples(step.key,rows));
  }catch(e){
   report.errors.push({table:step.key,error:String(e.message).slice(0,150)});
   // A failed source must NOT be turned into an empty/confirmed table.
   break;
  }
 }
 const id=plan.market_probe_available?selectMarketFixtureCandidate(rawSample):null;
 if(id!=null&&!report.errors.length){
  const rows=await runSQL('market_snapshots',LEGACY_MARKET_SPEC.sql,[id],12);
  report.samples.push(summarizeLegacyFTSamples('market_snapshots',rows));
 }
 report.legacy_ft_sample_rows=report.samples.reduce((n,x)=>n+x.sample_rows,0);
 report.status=report.errors.length?'PARTIAL_UNKNOWN':
  plan.queries.length&&report.legacy_ft_sample_rows?'LEGACY_FT_SAMPLES_FOUND_UNVERIFIED':
  'NO_INDEXED_LEGACY_FT_SAMPLES';
 report.ft_model_release='BLOCKED';
 report.note='Read-only table metadata + 24 indexed FT rows per source, 12 market rows from one sampled fixture at most. No raw payload, fixture IDs, odds provenance, bookmaker identity, holdout validation, or final model EV exported. Table existence and rows do not prove valid replay cohort.';
}catch(e){
 report.status='FAIL_CLOSED';report.errors.push({error:String(e.message).slice(0,180)});
 process.exitCode=1;
}finally{
 save();
 console.log('FE_FT_LEGACY_READONLY '+JSON.stringify(report));
}
