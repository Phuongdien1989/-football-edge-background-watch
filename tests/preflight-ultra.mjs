import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {settlePaper} from '../sync-fix/worker/accuracy-core.js';
const out='ultra-preflight';await fs.mkdir(out,{recursive:true});
const base='https://football-edge-background-watch.ngophuonghuy.workers.dev';
async function get(p){const r=await fetch(base+p,{headers:{Authorization:'Bearer '+process.env.BACKGROUND_TOKEN},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('BACKEND_HTTP_'+r.status);return r.json()}
async function provider(path){const r=await fetch('https://v3.football.api-sports.io'+path,{headers:{'x-apisports-key':process.env.APISPORTS_KEY},signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok||Object.keys(d.errors||{}).length)throw Error('PROVIDER_PREFLIGHT_'+JSON.stringify(d.errors||{http:r.status}));return d.response}
const status=await get('/api/notify/status'),entries=(await get('/api/db/export/entries?limit=10000')).rows;
const account=await provider('/status');
const historical=entries.filter(x=>['H1','FT'].includes(x.engine)&&x.auto_settle_supported&&x.captured_at<Date.now()-12*3600000&&x.odds_format==='DEC'&&['OVER','UNDER'].includes(x.selection)&&x.line!==null&&x.price>1&&x.resolution==='OPEN');
const ids=[...new Set(historical.map(e=>e.fixture_id))];if(ids.length>20)throw Error('PREFLIGHT_FIXTURE_READ_CAP_EXCEEDED_'+ids.length);
const checks=[];for(const id of ids){const f=(await provider('/fixtures?id='+id))[0];for(const e of historical.filter(e=>e.fixture_id===id))checks.push({id:e.id,fixture_id:id,...settlePaper(e,f)})}
const r=await fetch('https://shiny-silence-d892.ngophuonghuy.workers.dev/?ultra_preflight='+Date.now(),{signal:AbortSignal.timeout(30000)}),hash=createHash('sha256').update(await r.text()).digest('hex');
const report={at:new Date().toISOString(),production_writes:false,account:{plan:account?.subscription?.plan,active:account?.subscription?.active,current:account?.requests?.current,limit:account?.requests?.limit_day},quota:status.global_api_quota,scan:status.scan,eligible_open:historical.length,fixture_reads:ids.length,checks,frontend_sha256:hash};
await fs.writeFile(out+'/REPORT.json',JSON.stringify(report,null,2));console.log('ULTRA_PREFLIGHT '+JSON.stringify({...report,scan:{apiToday:status.scan?.apiToday,apiLimit:status.scan?.apiLimit,errors:status.scan?.errors}}));
if(hash!=='157af7294df17b997f505a6fa0a4658699c8236808a643e29ca2d71bd1b8b392')throw Error('FRONTEND_BASELINE_CHANGED');
if(!account?.subscription?.active||Number(account?.requests?.limit_day)<75000)throw Error('PROVIDER_ULTRA75K_NOT_CONFIRMED');
if(Number(account.requests.current)>=72000)throw Error('PROVIDER_USAGE_ALREADY_ABOVE_WORKER_CAP');
if(checks.some(c=>c.pending||c.unsupported))throw Error('HISTORICAL_EVIDENCE_NOT_SETTLEABLE_'+JSON.stringify(checks.filter(c=>c.pending||c.unsupported)));
console.log('PASS Ultra provider headroom and historical Batch D evidence preflight');
