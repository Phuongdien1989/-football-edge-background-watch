// Safe one-shot D1 query-insights GraphQL inspection. No D1 SQL or mutation.
// Never print raw SQL/bound values/account IDs; only table/operation + aggregate metrics.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const databaseId='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4'; // Known production ID; read-only GraphQL filter.
const report={at:new Date().toISOString(),scope:'PROD_D1_SQL_GROUPS_READ_ONLY',date:'2026-10-22',
 status:'NOT_RUN',sql_executed:0,d1_writes:0,deploys:0,api_football_calls:0,
 groups:[],errors:[],graphql_calls:0};
mkdirSync('ft-audit-output',{recursive:true});
const save=()=>writeFileSync('ft-audit-output/ft-d1-top-write-groups.json',JSON.stringify(report,null,2));
const query=`query FTTopD1Queries($accountTag:string!,$day:Date,$databaseId:string){
 viewer{accounts(filter:{accountTag:$accountTag}){
  d1QueriesAdaptiveGroups(
    limit:40
    filter:{date_geq:$day,date_leq:$day,databaseId:$databaseId}
    orderBy:[sum_rowsWritten_DESC]
  ){
   count
   sum{rowsWritten rowsRead}
   dimensions{query}
  }
 }}
}`;
function classify(sql){
 const normalized=String(sql||'').replace(/["`]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
 const op=(normalized.match(/^(INSERT|UPDATE|DELETE|REPLACE|CREATE|WITH|SELECT|DROP|ALTER)/)||[])[0]||'OTHER';
 const tables=[];
 const m=normalized.match(/\b(?:INSERT\s+(?:OR\s+IGNORE\s+)?INTO|UPDATE|DELETE\s+FROM|FROM|JOIN)\s+([A-Z_][A-Z0-9_]*)/g)||[];
 for(const x of m.slice(0,3)){const parts=x.trim().split(/\s+/);const name=parts.at(-1);if(name&&!tables.includes(name))tables.push(name);}
 return {op,table:tables[0]||'UNKNOWN',related_tables:tables.slice(1)};
}
async function request(){
 report.graphql_calls++;
 const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({query,variables:{accountTag:account,day:report.date,databaseId}}),
  signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if(!response.ok||(Array.isArray(data.errors)&&data.errors.length)){
  const error=Error('ANALYTICS_QUERY_DENIED_'+response.status);error.detail=(data.errors||[]).map(x=>String(x.message||'unknown').slice(0,160));throw error;
 }
 const groups=data.data?.viewer?.accounts?.[0]?.d1QueriesAdaptiveGroups;
 if(!Array.isArray(groups))throw Error('ANALYTICS_GROUPS_MISSING');
 return groups;
}
try{
 assert(account&&token,'ANALYTICS_CREDENTIALS_MISSING');
 assert(process.env.GITHUB_RUN_ATTEMPT==='1'&&process.env.FT_D1_SQL_INSIGHTS_ONCE==='READ_ONLY','NOT_ONE_SHOT');
 const groups=await request();
 let sum=0;
 for(const x of groups){
  const rowsWritten=Number(x.sum?.rowsWritten),rowsRead=Number(x.sum?.rowsRead),calls=Number(x.count);
  if(![rowsWritten,rowsRead,calls].every(v=>Number.isFinite(v)&&v>=0))throw Error('INVALID_GROUP_METRICS');
  const operation=classify(x.dimensions?.query);
  report.groups.push({...operation,rowsWritten,rowsRead,calls});sum+=rowsWritten;
 }
 report.groups.sort((a,b)=>b.rowsWritten-a.rowsWritten);
 report.grouped_rows_written=sum;
 report.status='PASS';
 report.warning='Top query groups only, sampled/adaptive and limited to 40; cannot automatically attribute to a single Worker or claim full account totals.';
}catch(e){report.status='FAIL';report.errors.push({message:e.message,details:e.detail||null});process.exitCode=1;}
finally{save();console.log(JSON.stringify(report));}
