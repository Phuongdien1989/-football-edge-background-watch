// Read-only release gate: no D1 mutations, no deployment, no log content.
// Checks exact live deployment/version, rollback availability, scan OFF/ON,
// and whether restricted Workers Observability query API is authorized.
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
const target='football-edge-background-watch',rollback='60781a4e-70cb-4c02-a036-2528c3048ed5',sha='6b7accb869cf64598b7ca39d5326d6b4080313e1';
if(!token||!account)throw Error('CLOUDFLARE_AUTH_INPUT_MISSING');
const report={schema:'FE_D1_INSTRUMENT_READONLY_PREFLIGHT',production_deploy:'NOT_ATTEMPTED',measurements:[],warnings:[]};
const api=async(path,options={})=>{const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{...options,headers:{authorization:'Bearer '+token,'content-type':'application/json'},signal:AbortSignal.timeout(20000)});const j=await r.json().catch(()=>({}));return {http:r.status,success:j.success!==false,data:j.result,errors:(j.errors||[]).map(x=>({code:x.code})).slice(0,4)}};
const deployment=await api('/workers/scripts/'+target+'/deployments');
if(deployment.http!==200||!deployment.success)throw Error('LIVE_DEPLOYMENT_READ_FAILED');
const top=deployment.data?.deployments?.[0]?.versions||[];
if(top.length!==1||top[0].percentage!==100||top[0].version_id!=='5f33a4b1-a299-4195-8a68-4646396a9214')throw Error('ACTIVE_PRODUCTION_VERSION_DRIFT_OR_SPLIT');
report.production_version=top[0].version_id;
const rb=await api('/workers/scripts/'+target+'/versions/'+rollback);
if(rb.http!==200||!rb.success)throw Error('ROLLBACK_VERSION_NOT_AVAILABLE');
report.rollback_version=rollback;
const healthR=await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(20000)});
const health=await healthR.json();if(!healthR.ok||health.deploy_commit!==sha)throw Error('PRODUCTION_HEALTH_COMMIT_DRIFT');
report.production_commit=health.deploy_commit;
report.manual_enabled=health.peak_status?.manualEnabled;
report.scan_enabled=health.peak_status?.enabled;
report.next_alarm=health.next_alarm;
report.scan_used=health.peak_status?.scan_budget?.used;
report.scan_limit=health.peak_status?.scan_budget?.limit;
report.peak_window=health.peak_window?.enabled;
if(!health.peak_status||typeof health.peak_status.enabled!=='boolean'||!Object.prototype.hasOwnProperty.call(health,'next_alarm'))throw Error('SCAN_STATE_UNAVAILABLE');
// Check and record the current choice without enabling, pausing, resetting or scheduling anything.
report.scan_state_preserved_by_instrument=true;
const t=Date.now(),query=await api('/workers/observability/telemetry/query',{method:'POST',body:JSON.stringify({queryId:'fe-pr7-capability-check',timeframe:{from:t-120000,to:t-60000},dry:true,datasets:['cloudflare-workers'],view:'calculations',calculations:[{operator:'count',alias:'requests'}],limit:1})});
report.observability_query={http:query.http,success:query.success,error_codes:query.errors.map(x=>x.code),has_result:Boolean(query.data)};
const tails=await api('/workers/scripts/'+target+'/tails');
report.authenticated_live_tail={http:tails.http,success:tails.success,error_codes:tails.errors.map(x=>x.code)};
report.ready_to_collect=(query.http===200&&query.success&&Boolean(query.data));
report.collection_transport=report.ready_to_collect?'OBSERVABILITY_QUERY_VERIFIED':'NONE_VERIFIED';
report.authenticated_live_tail.probe_only=true; // HTTP 200 is not proof of WebSocket events.
if(!report.ready_to_collect)report.warnings.push('WORKERS_OBSERVABILITY_QUERY_UNAVAILABLE; NO PRODUCTION DEPLOY');
console.log('FE_D1_METER_PREFLIGHT '+JSON.stringify(report));
if(!report.ready_to_collect)process.exitCode=2;
