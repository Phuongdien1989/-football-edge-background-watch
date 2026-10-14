// Read-only API and log-storage authorization audit. Emits only HTTP statuses,
// Cloudflare numeric error codes, booleans and a script-name equality check.
// NEVER emit token, API result rows, log content, URL, or private bindings.
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('CLOUDFLARE_AUTH_INPUT_MISSING');
const apiRoot='https://api.cloudflare.com/client/v4';
const prefix='/accounts/'+encodeURIComponent(account),worker='football-edge-background-watch';
async function req(path, method='GET',payload){
 const response=await fetch(apiRoot+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>null);
 return {http:response.status,success:data?.success===true,error_codes:(data?.errors||[]).map(e=>e.code).filter(v=>Number.isInteger(v)).slice(0,4),result:data?.result};
}
const view=q=>({http:q.http,success:q.success,error_codes:q.error_codes});
const report={audit:'FE_PR7_CLOUDFLARE_AUTH_STORAGE_V2',production_deploy:'NOT_ATTEMPTED',target_worker:worker,checks:{}};
report.checks.token_verification=view(await req('/user/tokens/verify'));
const settings=await req(prefix+'/workers/scripts/'+worker+'/script-settings');
report.checks.deployed_script_settings={...view(settings),has_observability:Object.prototype.hasOwnProperty.call(settings.result||{},'observability'),observability_enabled:settings.result?.observability?.enabled??null,logs_enabled:settings.result?.observability?.logs?.enabled??null,head_sampling_rate:settings.result?.observability?.head_sampling_rate??settings.result?.observability?.logs?.head_sampling_rate??null};
const scripts=await req(prefix+'/workers/scripts/'+worker+'/settings');
report.checks.worker_settings_legacy={...view(scripts),has_observability:Object.prototype.hasOwnProperty.call(scripts.result||{},'observability'),observability_enabled:scripts.result?.observability?.enabled??null,head_sampling_rate:scripts.result?.observability?.head_sampling_rate??null};
const schedules=await req(prefix+'/workers/scripts/'+worker+'/schedules');
report.checks.cron={...view(schedules),cron_count:Array.isArray(schedules.result)?schedules.result.length:Array.isArray(schedules.result?.schedules)?schedules.result.schedules.length:null};
const keys=await req(prefix+'/workers/observability/telemetry/keys','POST',{datasets:['cloudflare-workers'],limit:1});
report.checks.observability_list_keys={...view(keys),returned_keys:Array.isArray(keys.result)?keys.result.length:null};
const queries=await req(prefix+'/workers/observability/queries?perPage=5');
report.checks.observability_list_saved_queries={...view(queries),returned_queries:Array.isArray(queries.result)?queries.result.length:null};
const t=Date.now();
const q=await req(prefix+'/workers/observability/telemetry/query','POST',{queryId:'fe-pr7-auth-audit',timeframe:{from:t-90000,to:t-30000},datasets:['cloudflare-workers'],view:'calculations',calculations:[{operator:'count',alias:'n'}],limit:1,dry:true});
report.checks.observability_query={...view(q),has_query_result:!!q.result};
const tails=await req(prefix+'/workers/scripts/'+worker+'/tails');
report.checks.legacy_tails={...view(tails),list_count:Array.isArray(tails.result)?tails.result.length:null};
console.log('FE_PR7_CLOUDFLARE_AUTH_STORAGE '+JSON.stringify(report));
if(!report.checks.token_verification.success)process.exitCode=2;
