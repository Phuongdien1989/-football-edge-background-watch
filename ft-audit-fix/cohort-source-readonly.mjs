// Bounded discovery of current FT replay tables; no payload export or writes.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const db='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const report={at:new Date().toISOString(),commit:process.env.GITHUB_SHA,scope:'PRODUCTION_REPLAY_SCHEMA_ONLY',status:'NOT_RUN',d1_queries:0,d1_writes:0,provider_calls:0,deployments:0,scanner_actions:0,tables:[],errors:[],training_ready:false};
try{
 assert(account&&token,'CREDENTIALS_MISSING');
 assert(process.env.GITHUB_RUN_ATTEMPT==='1','ONE_ATTEMPT_ONLY');
 const usage=JSON.parse(readFileSync('ft-audit-output/ft-d1-readonly-usage.json','utf8'));
 assert(usage.status==='PASS'&&usage.utc_day===new Date().toISOString().slice(0,10)&&Date.now()-Date.parse(usage.at)<300000,'FRESH_USAGE_REQUIRED');
 assert(usage.today?.rowsRead<5000000&&usage.today?.rowsWritten<100000,'FREE_CAPACITY_UNCONFIRMED');
 const sql="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ft_replay_pairs_v1','ft_replay_records_v1','ft_replay_budget_v1') LIMIT 3";
 report.d1_queries++;
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(20000)});
 const json=await response.json();
 assert(response.ok&&json.success,'SCHEMA_READ_FAILED_HTTP_'+response.status);
 const result=json.result?.[0];assert(result?.success!==false&&Array.isArray(result?.results),'INVALID_SCHEMA_RESULT');
 report.tables=result.results.map(x=>x.name);
 report.metrics={rows_read:result.meta?.rows_read??null,rows_written:result.meta?.rows_written??null};
 assert(report.metrics.rows_written===0,'UNEXPECTED_WRITE_METRIC');
 report.status=report.tables.includes('ft_replay_pairs_v1')&&report.tables.includes('ft_replay_records_v1')?'TABLES_PRESENT_CONTENT_NOT_VALIDATED':'REQUIRED_REPLAY_TABLES_ABSENT';
 report.note='Only exact current-contract table presence checked. No historical datasets searched; table presence does not prove real rows, valid joins, provenance or calibration.';
}catch(e){report.status='FAIL';report.errors.push(e.message);process.exitCode=1;}
finally{mkdirSync('ft-audit-output',{recursive:true});writeFileSync('ft-audit-output/ft-cohort-source-readonly.json',JSON.stringify(report,null,2));console.log('FT_COHORT_SOURCE '+JSON.stringify(report));}
