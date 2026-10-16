// Read-only live-scanner, Push diagnostics and D1 analytics following approved deployment.
// NO scan requests, API-Football calls, writes, subscription changes, or token output.
const cfToken=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!cfToken||!account)throw Error('AUDIT_AUTH_MISSING');
const worker='football-edge-background-watch',mobile='shiny-silence-d892',desktop='football-edge-desktop-b2-test';
const expected='2be01a61-cc5d-43c7-9c6d-13e581296453';
const root='https://api.cloudflare.com/client/v4',acct='/accounts/'+encodeURIComponent(account);
const cf=async (path,method='GET',body=null)=>{
 const r=await fetch(root+path,{method,headers:{Authorization:'Bearer '+cfToken,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(24000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||!j.success)throw Error('CF_'+r.status+'_'+(j.errors||[]).map(x=>x.code).join(','));
 return j.result;
};
const result={schema:'FE_LIVE_PUSH_D1_READ_ONLY_20261016',at_utc:new Date().toISOString(),no_mutations:true};
try{
 const [versions,h]=await Promise.all([
  Promise.all([worker,mobile,desktop].map(async name=>{
   const d=await cf(acct+'/workers/scripts/'+name+'/deployments');
   const v=d?.deployments?.[0]?.versions||[];
   return {name,active:v.map(x=>({version_id:x.version_id,percentage:x.percentage}))};
  })),
  fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)})
 ]);
 result.active_versions=versions;
 result.expected_deployment_matches=versions[0]?.active?.length===1&&versions[0].active[0].version_id===expected&&versions[0].active[0].percentage===100;
 if(!h.ok)throw Error('HEALTH_HTTP_'+h.status);
 const obj=await h.json(),x=obj.notify_status||{},status=obj.peak_status||{};
 result.health={
  http:h.status,deploy_commit:obj.deploy_commit,peak_enabled:status.enabled,manual_enabled:status.manualEnabled,
  next_alarm:obj.next_alarm,scan_budget:status.scan_budget,heartbeat_at:status.heartbeat_at||status.lastHeartbeatAt||null,
  notify:{
   last_cycle_at:x.last_cycle_at,live:x.live,scanned:x.scanned,error_count:x.error_count,cycle_errors:x.cycle_errors,
   enabled_devices:x.enabled_devices,budget:x.budget,global_api_quota:x.global_api_quota,
   provider_last_failure:x.provider?.last_failure,
   provider_latest:x.provider?.latest,
   cooldown_until:x.provider?.pacing?.cooldown_until
  }
 };
} catch(e){result.health_error=String(e?.message||e).slice(0,240);}
try{
 const day='2026-10-16';
 const q='query($tag:string!,$start:Date,$end:Date){viewer{accounts(filter:{accountTag:$tag}){d1AnalyticsAdaptiveGroups(limit:10000,filter:{date_geq:$start,date_leq:$end}){sum{rowsRead rowsWritten writeQueries} dimensions{date databaseId}}}}}';
 const r=await fetch(root+'/graphql',{method:'POST',headers:{Authorization:'Bearer '+cfToken,'Content-Type':'application/json'},body:JSON.stringify({query:q,variables:{tag:account,start:day,end:day}}),signal:AbortSignal.timeout(25000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j.errors?.length)throw Error('GRAPHQL_'+r.status+'_'+(j.errors||[]).map(x=>x.message).join('|').slice(0,180));
 const rows=(j?.data?.viewer?.accounts||[]).flatMap(a=>a.d1AnalyticsAdaptiveGroups||[]);
 result.d1_daily_utc=rows.filter(x=>x?.dimensions?.databaseId==='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4').map(x=>({date:x.dimensions.date,rows_written:x.sum?.rowsWritten,rows_read:x.sum?.rowsRead,write_queries:x.sum?.writeQueries}));
 result.d1_daily_all_account_sum=rows.reduce((o,x)=>o+Number(x?.sum?.rowsWritten||0),0);
 result.d1_analytics_note='Account analytics may lag, not a live second-by-second counter. UTC 00 to current as available.';
}catch(e){result.d1_error=String(e?.message||e).slice(0,240);}
try{
 const now=Date.now();
 const request={queryId:'fe-live-push-d1-audit-20261016',timeframe:{from:now-60*60*1000,to:now},view:'events',parameters:{datasets:[],needle:{value:'FE_D1_ROUTE_V1'}},limit:2000,dry:true};
 const v=await cf(acct+'/workers/observability/telemetry/query','POST',request);
 const events=v?.events?.events||[];
 const breakdown={};let parsed=0,observedRows=0;
 for(const e of events){
   // Only the known instrumentation log JSON, never export other event content.
   const queue=[e];let found=null;
   while(queue.length){
     const item=queue.pop();
     if(typeof item==='string'){
       const i=item.indexOf('FE_D1_ROUTE_V1 ');
       if(i>=0){try{const x=JSON.parse(item.slice(i+15));if(x.schema==='FE_D1_ROUTE_V1'&&x.summary)found=x;}catch{}}
     } else if(Array.isArray(item)){for(const x of item)queue.push(x)}
     else if(item&&typeof item==='object'){for(const [k,x] of Object.entries(item))if(k!=='$metadata')queue.push(x)}
   }
   if(!found)continue;parsed++;
   for(const [route,stats] of Object.entries(found.summary)){
      const r=breakdown[route]||(breakdown[route]={rows:0,statements:0,records:0});
      r.rows+=Number(stats?.rows_written||0);
      r.statements+=Number(stats?.statements||0);
      r.records++;observedRows+=Number(stats?.rows_written||0);
   }
 }
 result.meter_sample={from_utc:new Date(request.timeframe.from).toISOString(),to_utc:new Date(request.timeframe.to).toISOString(),events_returned:events.length,reported_count:v?.events?.count??null,decoded_meter_events:parsed,decoded_rows_written:observedRows,truncated:events.length>=2000,route_breakdown:breakdown};
 result.meter_sample_note='Incomplete sampled Worker logs; never interpret as complete D1 account total or full Push delivery.';
}catch(e){result.meter_error=String(e?.message||e).slice(0,250);}
console.log('FE_LIVE_PUSH_D1_STATUS '+JSON.stringify(result));
