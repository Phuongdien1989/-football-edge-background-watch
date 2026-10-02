import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';

const sql=`SELECT request_id,provider,api_version,endpoint,params_json,request_started_at,received_at,http_status,source,capture_schema_version,payload_hash,payload_json,daily_limit,daily_remaining,minute_limit,minute_remaining,api_results,api_errors_json
FROM raw_api_requests ORDER BY received_at ASC;`;

const out=execFileSync('npx',[
  'wrangler','d1','execute','football-edge-v2-raw','--remote',
  '--config','wrangler.deploy.toml','--json','--command',sql
],{encoding:'utf8',env:process.env,maxBuffer:64*1024*1024});

const parsed=JSON.parse(out);
const blocks=Array.isArray(parsed)?parsed:[parsed];
const rows=[];
for(const b of blocks){
  for(const r of (b?.results||[])) rows.push(r);
}
const lines=[];
for(const r of rows){
  let params={},payload={},errors={};
  try{params=JSON.parse(r.params_json||'{}')}catch{}
  try{payload=JSON.parse(r.payload_json||'{}')}catch{payload={_raw_parse_error:true}}
  try{errors=JSON.parse(r.api_errors_json||'{}')}catch{}
  lines.push(JSON.stringify({
    raw_id:r.request_id,
    provider:r.provider,
    api_version:r.api_version,
    endpoint:r.endpoint,
    params,
    request_started_at:r.request_started_at,
    received_at:r.received_at,
    http_status:r.http_status,
    source:r.source,
    capture_schema_version:r.capture_schema_version,
    payload_hash:r.payload_hash,
    payload,
    quota:{
      daily_limit:r.daily_limit,
      daily_remaining:r.daily_remaining,
      minute_limit:r.minute_limit,
      minute_remaining:r.minute_remaining
    },
    api_results:r.api_results,
    api_errors:errors,
    evidence_origin:'REAL_CAPTURE'
  }));
}
writeFileSync('football-edge-v2-real-raw.ndjson',lines.join('\n')+(lines.length?'\n':''));
writeFileSync('football-edge-v2-real-raw-summary.json',JSON.stringify({
  schema:'FE_V2_REAL_RAW_EXPORT_V1',
  exported_at:new Date().toISOString(),
  rows:rows.length,
  endpoints:[...new Set(rows.map(r=>r.endpoint))].sort(),
  first_received_at:rows[0]?.received_at||null,
  last_received_at:rows.at(-1)?.received_at||null
},null,2));
console.log('exported rows=',rows.length);
