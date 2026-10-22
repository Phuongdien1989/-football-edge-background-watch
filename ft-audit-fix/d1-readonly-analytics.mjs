// Strictly read-only account-level D1 analytics. GraphQL query + GET only.
// Recheck at 21:12 ICT prior to deciding whether Free tier allows scan (read-only).
// Execute once only; no D1 write attempts permitted after the observed 7500 quota failure.
// No D1 /query calls, SQL, Worker deployments, scanner control, plan changes or mutations.
import assert from 'node:assert/strict';
import {d1UtcWindow,d1DailyTotals} from './d1-utc-day.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const data={scope:'READ_ONLY_D1_USAGE_DIAGNOSTIC',at:new Date().toISOString(),status:'NOT_RUN',
 account_writes:0,d1_sql_queries:0,provider_calls:0,worker_deploys:0,queries_attempted:0,
 dates:[],databases:[],errors:[],note:'Analytics may lag and uses adaptive sampling. This is not a query-level billing invoice.'};
mkdirSync('ft-audit-output',{recursive:true});
const save=()=>writeFileSync('ft-audit-output/ft-d1-readonly-usage.json',JSON.stringify(data,null,2));
const apiBase='https://api.cloudflare.com/client/v4';
// Compute the actual UTC billing day when this read-only check runs; never pin an October date.
const {utcDay:utcToday,utcYesterday}=d1UtcWindow(new Date().toISOString());
data.dates=[utcYesterday,utcToday];
async function getDBs(){
 const response=await fetch(apiBase+'/accounts/'+encodeURIComponent(account)+'/d1/database?per_page=100&page=1',
  {headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(16000)});
 const json=await response.json();if(!response.ok||!json.success)throw Error('DB_LIST_PERMISSION_OR_NETWORK_'+response.status);
 assert(Array.isArray(json.result)&&json.result.length<=10,'DB_LIST_EXCEEDS_SAFE_LIMIT');
 return json.result.map(x=>({id:x.uuid,name:x.name}));
}
const query=`query D1ReadOnlyUsage($accountTag: string!, $start: Date, $end: Date) {
 viewer {
  accounts(filter: {accountTag: $accountTag}) {
   d1AnalyticsAdaptiveGroups(
    limit: 30
    filter: {date_geq: $start, date_leq: $end}
    orderBy: [date_DESC]
   ) { dimensions {date databaseId} sum {rowsRead rowsWritten readQueries writeQueries} }
  }
 }
}`;
async function readAnalytics(){
 const response=await fetch(apiBase+'/graphql',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({query,variables:{accountTag:account,start:data.dates[0],end:data.dates[1]}}),
  signal:AbortSignal.timeout(20000)});
 const json=await response.json();data.queries_attempted++;
 if(!response.ok||Array.isArray(json.errors)&&json.errors.length){
  const errors=(json.errors||[]).map(x=>String(x.message||'ANALYTICS_PERMISSION_ERROR').slice(0,180));
  const err=Error('ANALYTICS_GRAPHQL_DENIED_'+response.status);err.details=errors;throw err;
 }
 const a=json.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups;
 if(!Array.isArray(a))throw Error('ANALYTICS_DATA_MISSING');
 return a;
}
try{
 assert(account&&token,'CLOUDFLARE_CREDENTIALS_MISSING');
 assert(process.env.GITHUB_RUN_ATTEMPT==='1'&&process.env.D1_READ_ONLY_AUDIT_ONCE==='CONFIRM','NOT_ONE_SHOT');
 const list=await getDBs();
 const tags=new Map(list.map((x,i)=>[x.id,x.id==='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4'?'KNOWN_PROD_DB':x.id==='e82758f2-e533-44a6-b42d-4821d120e082'?'ISOLATED_FT_DB':'OTHER_DB_'+(i+1)]));
 const rows=await readAnalytics();
 const out=rows.map(x=>{
  const id=x.dimensions?.databaseId,metrics=x.sum||{};
  if(typeof id!=='string'||!x.dimensions?.date)throw Error('INVALID_ANALYTICS_DIMENSION');
  const fields=['rowsRead','rowsWritten','readQueries','writeQueries'];
  const m={};for(const k of fields){let v=Number(metrics[k]);if(!Number.isFinite(v)||v<0)throw Error('INVALID_ANALYTICS_METRIC');m[k]=v;}
  return {day:x.dimensions.date,database:tags.get(id)||'UNLISTED_DB',...m};
 });
 const total={rowsRead:0,rowsWritten:0,readQueries:0,writeQueries:0};
 const today=out.filter(x=>x.day===utcToday);
 const validTotal=d1DailyTotals(out,utcToday);
 data.databases=out;data.today=validTotal;data.utc_day=utcToday;
 data.status='PASS';
 data.note='GraphQL adaptive/delayed analytics; account totals here may differ from billing enforcement counters. ZERO D1 SQL queries/writes by this script.';
}catch(error){
 data.status='FAIL';data.errors.push({message:error.message,detail:error.details??null});process.exitCode=1;
}finally{save();console.log(JSON.stringify(data));}
