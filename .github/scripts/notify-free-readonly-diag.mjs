// READ ONLY: measures effective deployment / persisted scan budget / API provider
// observations and D1 account rows. Never makes an API-Football request, changes scan,
// stores D1 data, creates a Worker, or exposes authentication values.
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('CLOUDFLARE_AUDIT_SECRETS_MISSING');
const worker='football-edge-background-watch';
const prefix='/accounts/'+encodeURIComponent(account);
async function api(path){
 const r=await fetch('https://api.cloudflare.com/client/v4'+path,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(18000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j.success===false)throw Error('CF_HTTP_'+r.status+'_CODE_'+(j.errors||[]).map(x=>x.code).join(','));
 return j.result;
}
const result={schema:'FE_NOTIFY_FREE_DIAG_READONLY_20261016',utc_checked:new Date().toISOString(),production_deploy:'NOT_ATTEMPTED',scan_control_changed:false,provider_calls:'NONE',checks:{}};
try{
 const deployments=await api(prefix+'/workers/scripts/'+worker+'/deployments');
 const active=deployments?.deployments?.[0]?.versions||[];
 result.active_worker_versions=active.map(v=>({version_id:v.version_id,percentage:v.percentage}));
 result.checks.version_100_percent=active.length===1&&active[0].percentage===100;
 const settings=await api(prefix+'/workers/scripts/'+worker+'/settings');
 const bindings=settings?.bindings||[];
 const publicVars={};
 for(const b of bindings)if(b.type==='plain_text'&&/^(API_TOTAL_DAILY_BUDGET|API_PROVIDER_MINUTE_LIMIT|NOTIFY_DAILY_BUDGET|API_RESERVATION_BLOCK_SIZE|MANUAL_SCAN_TICKS_PER_DAY|MANUAL_SCAN_MODE_ENABLED|PEAK_SCAN_ENABLED|LIVE_STATE_D1_ENABLED|FE_PROVIDER_PROBE_ENABLED)$/.test(b.name))publicVars[b.name]=b.text;
 result.effective_public_config=publicVars;
 result.checks.has_secret_provider_key_binding=bindings.some(b=>/APISPORTS|API_FOOTBALL/i.test(b.name)&&b.type==='secret_text');
 result.cron=(await api(prefix+'/workers/scripts/'+worker+'/schedules'));
 const health=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(20000)});
 if(!health.ok)throw Error('PRODUCTION_HEALTH_HTTP_'+health.status);
 const h=await health.json();
 result.health={http:health.status,deploy_commit:h.deploy_commit,peak_status:h.peak_status,next_alarm:h.next_alarm,notify_status:{
   budget:h.notify_status?.budget,
   global_api_quota:h.notify_status?.global_api_quota,
   enabled_devices:h.notify_status?.enabled_devices,
   last_cycle_at:h.notify_status?.last_cycle_at,
   live:h.notify_status?.live,
   scanned:h.notify_status?.scanned,
   error_count:h.notify_status?.error_count,
   cycle_errors:h.notify_status?.cycle_errors,
   provider:h.notify_status?.provider
 }};
 const nowUTC=new Date();
 result.checked_utc_day=nowUTC.toISOString().slice(0,10);
 result.checks.api_daily_hard_cap_mismatch_with_free=Number(publicVars.API_TOTAL_DAILY_BUDGET)>100;
 result.checks.api_minute_rate_mismatch_with_free=Number(publicVars.API_PROVIDER_MINUTE_LIMIT)>10;
 result.checks.scan_ticks_vs_api_quota_different_units=true;
 result.checks.no_scan_mutation=true;
} catch(e){result.error=String(e?.message||e).slice(0,260);process.exitCode=1;}
async function gql(query,variables){
 const r=await fetch('https://api.cloudflare.com/client/v4/graphql',{
  method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(18000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j.errors?.length)throw Error('GRAPHQL_'+r.status+'_ERRORS_'+(j.errors||[]).map(x=>x.message).join('|').slice(0,300));
 return j.data;
}
try{
 const q=await gql('{__type(name:"AccountD1AnalyticsAdaptiveGroups"){fields{name type{kind name ofType{name}}}}}');
 result.d1_introspection=!!q?.__type;
 const f=await gql('{__schema{queryType{name}}}');
 const dates=['2026-10-14','2026-10-15','2026-10-16'];
 // Supported daily D1 schema known from prior read-only forensic; no database queries.
 const daily=await gql('query($tag:string!,$start:Date,$end:Date){viewer{accounts(filter:{accountTag:$tag}){d1AnalyticsAdaptiveGroups(limit:10000,filter:{date_geq:$start,date_leq:$end}){sum{rowsRead rowsWritten writeQueries} dimensions{date databaseId}}}}}',{tag:account,start:dates[0],end:dates[2]});
 const rows=(daily?.viewer?.accounts||[]).flatMap(x=>x.d1AnalyticsAdaptiveGroups||[]);
 result.d1_analytics=rows.map(x=>({date:x.dimensions?.date,database_id_matches_production:x.dimensions?.databaseId==='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4',sum:x.sum}));
 result.checks.d1_analytics='PASS';
}catch(e){result.checks.d1_analytics='UNAVAILABLE_'+String(e.message||e).slice(0,280);}
console.log('FE_NOTIFY_FREE_READONLY_EVIDENCE '+JSON.stringify(result));
