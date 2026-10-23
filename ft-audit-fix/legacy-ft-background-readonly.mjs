// Separate once-only production BACKGROUND FT odds presence audit.
// Pure indexed SELECTs, zero payload export, D1 writes, API calls or deploys.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {BG_INDEX_SQL,BG_ODDS_SHAPE_SQL,BG_REASONS,
 safeBgProbeSQL,summaryBackgroundShape} from './legacy-ft-background-shape.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const db='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
const dest='ft-audit-output/ft-background-odds-shape.json';
const report={scope:'FT_BACKGROUND_RAW_ODDS_SHAPE_ONLY',at:new Date().toISOString(),
 status:'NOT_RUN',d1_select_queries:0,d1_rows_read:0,d1_rows_written:0,
 provider_calls:0,deployments:0,scanner_actions:0,fixture_ids_exported:false,
 raw_payload_export:false,errors:[],samples:[],training_ready:false,releaseGate:'BLOCKED'};
async function query(sql,params,maxRows){
 safeBgProbeSQL(sql,params);assert(report.d1_select_queries<4,'EXCESSIVE_READONLY_QUERY_COUNT');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/d1/database/'+db+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(20000)});
 report.d1_select_queries++;
 const json=await response.json();
 assert(response.ok&&json.success,'D1_BG_SOURCE_READ_FAILED_'+response.status);
 const result=json.result?.[0];
 assert(result?.success!==false&&Array.isArray(result?.results),'BAD_D1_BG_RESULT');
 assert(result.results.length<=maxRows,'D1_BG_SAMPLE_UNBOUNDED');
 assert(result.meta?.rows_written===0,'NONZERO_DB_WRITE_BILLING');
 assert(Number.isFinite(result.meta?.rows_read)&&result.meta.rows_read>=0&&
  result.meta.rows_read<=12000,'D1_BG_READ_LIMIT_EXCEEDED');
 report.d1_rows_read+=result.meta.rows_read;
 return result.results;
}
try{
 assert(account&&token,'CLOUDFLARE_READONLY_CREDENTIALS_REQUIRED');
 assert(process.env.GITHUB_RUN_ATTEMPT==='1'&&process.env.FT_BG_ODDS_READ_ONCE==='CONFIRM','NO_ONE_SHOT_APPROVAL');
 const d=JSON.parse(readFileSync('ft-audit-output/ft-d1-readonly-usage.json','utf8'));
 assert(d.status==='PASS'&&d.utc_day===new Date().toISOString().slice(0,10)&&
  Date.now()-Date.parse(d.at)<300000,'NO_RECENT_UTC_ACCOUNT_ANALYTICS');
 assert(d.today?.rowsRead<4500000&&d.today?.rowsWritten<95000,'D1_FREE_CAPACITY_NOT_CONFIRMED');
 const index=await query(BG_INDEX_SQL,[],1);
 if(index.length!==1||index[0]?.name!=='idx_live_snapshots_reason_time'){
  report.status='REQUIRED_INDEX_MISSING_NO_SCAN';
 }else{
  for(const reason of BG_REASONS){
   const rows=await query(BG_ODDS_SHAPE_SQL,[reason],24);
   report.samples.push(summaryBackgroundShape(reason,rows));
  }
  report.status=report.samples.some(x=>x.raw_odds_present>0)?
    'BACKGROUND_ODDS_PRESENCE_FOUND_NOT_YET_VALIDATED':'NO_RAW_ODDS_IN_BOUNDED_BACKGROUND_SAMPLES';
 }
 report.note='Only 3 bounded indexed source-category samples. Raw provider payload, fixture identity, betting prices and bookmaker details are not exported. This does not prove odds provenance or model calibration.';
}catch(e){report.status='FAIL_CLOSED';report.errors.push(String(e.message).slice(0,180));process.exitCode=1;}
finally{
 mkdirSync('ft-audit-output',{recursive:true});writeFileSync(dest,JSON.stringify(report,null,2));
 console.log('FE_FT_BG_ODDS_READONLY '+JSON.stringify(report));
}
