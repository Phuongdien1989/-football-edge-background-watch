// Read-only proof that Cloudflare Workers Logs actually contain stored events.
// Do NOT log raw event bodies, customer fields, identifiers, IPs, URLs or secrets.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('CLOUDFLARE_AUTH_MISSING');
const worker='football-edge-background-watch';
const health='https://'+worker+'.ngophuonghuy.workers.dev/health';
const t0=Date.now();
const h=await fetch(health,{signal:AbortSignal.timeout(15000)});
if(!h.ok)throw Error('PRODUCTION_HEALTH_FAILED_'+h.status);
const body=await h.json();
if(body.deploy_commit!=='6b7accb869cf64598b7ca39d5326d6b4080313e1')throw Error('PRODUCTION_COMMIT_DRIFT');
await new Promise(ok=>setTimeout(ok,1800));
const since=t0-15*60000;
const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/observability/telemetry/query',{
 method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({queryId:'fe-pr7-real-logs-receipt',timeframe:{from:since,to:Date.now()},view:'events',parameters:{datasets:[]},limit:25,dry:true}),
 signal:AbortSignal.timeout(25000)
});
const json=await res.json().catch(()=>({}));
const result=json.result||{};
const entries=Array.isArray(result.events)?result.events:[];
const report={
 schema:'FE_PR7_LOG_RECEIPT_V1',production_deploy:'NOT_ATTEMPTED',
 http:res.status,success:json.success===true,
 result_keys:Object.keys(result).sort().filter(x=>/^(run|events|statistics|calculations|pagination|traces|invocations)$/i.test(x)),
 event_count:entries.length,
 query_status:result?.run?.status||null,
 health_http:h.status,
 captured_utc_start:new Date(since).toISOString(),captured_utc_end:new Date().toISOString()
};
console.log('FE_PR7_REAL_LOG_RECEIPT '+JSON.stringify(report));
if(!res.ok||json.success!==true||entries.length<1)process.exitCode=2;
