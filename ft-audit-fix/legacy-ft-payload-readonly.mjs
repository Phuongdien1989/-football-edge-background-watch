// Explicit ONE-TIME read-only D1 JSON shape probe, never fetches raw values.
// Second, separate, explicitly scoped read-only shape checkpoint on 2026-10-23.
// Query is a closed, index-backed 24-row SELECT. No schema, API or scanner edits.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {FT_RAW_ODDS_PRESENCE_SQL,assertFTPayloadReadOnlySQL,summarizeFTPayloadShape} from './legacy-ft-payload-shape.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const db='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
const path='ft-audit-output/ft-legacy-payload-shape.json';
const report={scope:'PROD_FT_RAW_ODDS_PRESENCE_ONLY',at:new Date().toISOString(),
 status:'NOT_RUN',d1_select_queries:0,d1_rows_written:0,api_football_calls:0,
 scanner_actions:0,deploys:0,raw_payload_export:false,fixture_ids_exported:false,
 errors:[],sample:null,releaseGate:'BLOCKED'};
try{
 assert(account&&token,'NO_D1_READONLY_CREDENTIALS');
 assert(process.env.GITHUB_RUN_ATTEMPT==='1'&&
  process.env.FT_RAW_ODDS_SHAPE_ONCE==='CONFIRM','ONE_SHOT_REQUIRED');
 const usage=JSON.parse(readFileSync('ft-audit-output/ft-d1-readonly-usage.json','utf8'));
 const day=new Date().toISOString().slice(0,10);
 assert(usage.status==='PASS'&&usage.utc_day===day&&
  Date.now()-Date.parse(usage.at)<300000,'CURRENT_UTC_D1_USAGE_UNVERIFIED');
 assert(usage.today?.rowsRead<4500000&&usage.today?.rowsWritten<95000,
  'READ_ONLY_CAPACITY_NOT_CONFIRMED');
 assertFTPayloadReadOnlySQL(FT_RAW_ODDS_PRESENCE_SQL);
 const resp=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+
  '/d1/database/'+db+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({sql:FT_RAW_ODDS_PRESENCE_SQL,params:[]}),signal:AbortSignal.timeout(20000)});
 report.d1_select_queries++;
 const json=await resp.json();
 assert(resp.ok&&json.success,'D1_PAYLOAD_SHAPE_HTTP_'+resp.status);
 const x=json.result?.[0];assert(x&&x.success!==false&&Array.isArray(x.results),'D1_SHAPE_RESULT_INVALID');
 assert(x.results.length<=24,'D1_SHAPE_UNBOUNDED_RESULT');
 assert(x.meta?.rows_written===0,'D1_SHAPE_UNEXPECTED_WRITE');
 assert(Number.isFinite(x.meta?.rows_read)&&x.meta.rows_read>=0&&
  x.meta.rows_read<=12000,'D1_SHAPE_EXCESSIVE_ROWS_READ');
 report.billed_rows_read=x.meta.rows_read;
 report.sample=summarizeFTPayloadShape(x.results);
 report.status=report.sample.result;
 report.note='Shape only, no bookmaker market prices read and no provenance/training certification.';
}catch(e){report.status='FAIL_CLOSED';report.errors.push(String(e.message).slice(0,160));process.exitCode=1;}
finally{
 mkdirSync('ft-audit-output',{recursive:true});
 writeFileSync(path,JSON.stringify(report,null,2));
 console.log('FE_FT_RAW_ODDS_SHAPE_READONLY '+JSON.stringify(report));
}
