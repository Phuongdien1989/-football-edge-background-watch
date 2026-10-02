import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';

function query(sql){
  const out=execFileSync('npx',[
    'wrangler','d1','execute','football-edge-v2-raw','--remote',
    '--config','wrangler.deploy.toml','--json','--command',sql
  ],{encoding:'utf8',env:process.env,maxBuffer:128*1024*1024});
  const parsed=JSON.parse(out);
  const blocks=Array.isArray(parsed)?parsed:[parsed];
  const rows=[];
  for(const b of blocks) for(const r of (b?.results||[])) rows.push(r);
  return rows;
}
function parse(s,fallback={}){try{return JSON.parse(s||'{}')}catch{return fallback}}
function ndjson(path, rows){writeFileSync(path,rows.map(x=>JSON.stringify(x)).join('\n')+(rows.length?'\n':''));}

const raw=query(`SELECT request_id,provider,api_version,endpoint,params_json,request_started_at,received_at,http_status,source,capture_schema_version,payload_hash,payload_json,daily_limit,daily_remaining,minute_limit,minute_remaining,api_results,api_errors_json
FROM raw_api_requests ORDER BY received_at ASC;`);
const rawOut=raw.map(r=>({
  raw_id:r.request_id,provider:r.provider,api_version:r.api_version,endpoint:r.endpoint,params:parse(r.params_json),
  request_started_at:r.request_started_at,received_at:r.received_at,http_status:r.http_status,source:r.source,
  capture_schema_version:r.capture_schema_version,payload_hash:r.payload_hash,payload:parse(r.payload_json,{_raw_parse_error:true}),
  quota:{daily_limit:r.daily_limit,daily_remaining:r.daily_remaining,minute_limit:r.minute_limit,minute_remaining:r.minute_remaining},
  api_results:r.api_results,api_errors:parse(r.api_errors_json),evidence_origin:'REAL_CAPTURE'
}));
ndjson('football-edge-v2-real-raw.ndjson',rawOut);

const fx=query(`SELECT capture_id,request_id,fixture_id,match_clock,status_short,received_at,fixture_payload_hash,fixture_json,event_count,stats_team_count,stats_value_count,has_events,has_stats,has_lineups,has_players
FROM raw_fixture_captures ORDER BY received_at ASC, fixture_id ASC;`);
const fxOut=fx.map(r=>({...r,fixture_json:parse(r.fixture_json,{_raw_parse_error:true}),evidence_origin:'REAL_CAPTURE'}));
ndjson('football-edge-v2-real-fixture-captures.ndjson',fxOut);

const ev=query(`SELECT evidence_id,request_id,fixture_id,evidence_kind,received_at,item_count,non_null_value_count,payload_hash,payload_json
FROM raw_fixture_evidence ORDER BY received_at ASC, fixture_id ASC;`);
const evOut=ev.map(r=>({...r,payload_json:parse(r.payload_json,{_raw_parse_error:true}),evidence_origin:'REAL_CAPTURE'}));
ndjson('football-edge-v2-real-endpoint-evidence.ndjson',evOut);

const byKind={};
for(const r of evOut){
  const k=r.evidence_kind||'UNKNOWN';
  byKind[k]??={payloads:0,nonempty_payloads:0,non_null_values:0,fixtures:new Set()};
  byKind[k].payloads++;
  byKind[k].fixtures.add(String(r.fixture_id));
  if(Number(r.item_count||0)>0)byKind[k].nonempty_payloads++;
  byKind[k].non_null_values+=Number(r.non_null_value_count||0);
}
const kinds={};
for(const [k,v] of Object.entries(byKind)) kinds[k]={...v,fixtures:v.fixtures.size};

const summary={
  schema:'FE_V2_REAL_RAW_EXPORT_V2',
  exported_at:new Date().toISOString(),
  raw_requests:rawOut.length,
  fixture_captures:fxOut.length,
  distinct_fixtures:new Set(fxOut.map(r=>String(r.fixture_id))).size,
  endpoint_evidence:evOut.length,
  evidence_by_kind:kinds,
  endpoints:[...new Set(rawOut.map(r=>r.endpoint))].sort(),
  first_received_at:rawOut[0]?.received_at||null,
  last_received_at:rawOut.at(-1)?.received_at||null,
  timestamp_integrity:{
    received_before_started:rawOut.filter(r=>r.received_at<r.request_started_at).length
  }
};
writeFileSync('football-edge-v2-real-raw-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
