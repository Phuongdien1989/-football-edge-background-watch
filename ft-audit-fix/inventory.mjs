import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;assert(account&&token,'CLOUDFLARE_READ_CREDENTIALS_REQUIRED');
const origin='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account);
const report={at:new Date().toISOString(),mode:'READ_ONLY',scanner_toggled:false,provider_calls:0,d1_write_queries:0,deployed:false,queries:[],versions:{},samples:{},errors:[]};
mkdirSync('ft-audit-output',{recursive:true});
async function api(path,body){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const j=await r.json();assert(r.ok&&j.success,'CF_HTTP_'+r.status);return j.result;}
const sqls={
tables:"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('fixture_history','live_snapshots','entry_decisions','engine_signals','market_snapshots','fe_notify_live_state')",
history:"SELECT fixture_id,kickoff,status,halftime_home,halftime_away,fulltime_home,fulltime_away,first_seen_at,last_seen_at FROM fixture_history ORDER BY kickoff DESC LIMIT 500",
snapshots:"SELECT fixture_id,captured_at,minute,status,line,price,payload_json FROM live_snapshots WHERE engine='FT' ORDER BY captured_at DESC LIMIT 500",
decisions:"SELECT fixture_id,captured_at,minute,line,price,resolution,outcome,payload_json FROM entry_decisions WHERE engine='FT' ORDER BY captured_at DESC LIMIT 500",
signals:"SELECT fixture_id,captured_at,payload_json FROM engine_signals WHERE engine='FT' LIMIT 100",
markets:"SELECT fixture_id,captured_at,line,price,payload_json FROM market_snapshots LIMIT 100",
live:"SELECT fixture_id,payload FROM fe_notify_live_state LIMIT 100"};
async function query(key){const sql=sqls[key];assert(sql.startsWith('SELECT '));const r=(await api('/d1/database/0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4/query',{sql,params:[]}))[0];report.queries.push({key,sql,rows_read:r.meta?.rows_read,rows_written:r.meta?.rows_written});assert(!r.meta?.rows_written,'UNEXPECTED_WRITE');return r.results||[];}
function summarize(rows){const keys=new Set(),received=new Set();let payloads=0,withLinePrice=0;const times=[];for(const r of rows){if(r.captured_at)times.push(r.captured_at);if(r.line!=null&&r.price!=null)withLinePrice++;try{const p=JSON.parse(r.payload_json||r.payload||'null');if(p){payloads++;Object.keys(p).forEach(k=>keys.add(k));const scan=(v,depth=0)=>{if(!v||typeof v!=='object'||depth>5)return;for(const [k,x]of Object.entries(v)){if(/received|source.*at|fresh_at/.test(k))received.add(k);if(typeof x==='object')scan(x,depth+1);}};scan(p);}}catch{}}return {sample_rows:rows.length,distinct_fixtures:new Set(rows.map(r=>r.fixture_id)).size,with_line_price:withLinePrice,payload_rows:payloads,payload_keys:[...keys].sort(),source_time_keys:[...received].sort(),min_captured_at:times.length?Math.min(...times):null,max_captured_at:times.length?Math.max(...times):null};}
try{
for(const name of ['football-edge-background-watch','shiny-silence-d892','football-edge-desktop-b2-test'])report.versions[name]=(await api('/workers/scripts/'+name+'/deployments')).deployments?.[0]?.versions;
report.rollback_exists=(await api('/workers/scripts/football-edge-background-watch/versions/7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a')).id==='7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a';
const h=await (await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health')).json();report.health={deploy_commit:h.deploy_commit,enabled:h.peak_status?.enabled,next_alarm:h.next_alarm};
const tables=await query('tables');report.tables=tables.map(r=>r.name);const map={history:'fixture_history',snapshots:'live_snapshots',decisions:'entry_decisions',signals:'engine_signals',markets:'market_snapshots',live:'fe_notify_live_state'};
for(const [key,table]of Object.entries(map)){if(!report.tables.includes(table)){report.samples[key]={table_missing:true};continue;}try{const rows=await query(key);report.samples[key]=summarize(rows);if(key==='history')report.samples[key].completed_with_ft_score=rows.filter(r=>r.status==='FT'&&r.fulltime_home!=null&&r.fulltime_away!=null).length;if(key==='live')report.samples[key].rolling_history_rows=rows.reduce((n,r)=>{try{return n+(JSON.parse(r.payload)?.history?.length||0)}catch{return n}},0);}catch(e){report.errors.push(key+':'+e.message);}}
}catch(e){report.errors.push(e.message);}
report.status=report.errors.length?'INCOMPLETE':'PASS';writeFileSync('ft-audit-output/inventory.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.errors.length)process.exitCode=1;
