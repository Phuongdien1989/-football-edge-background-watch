import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,api='https://api.cloudflare.com/client/v4/accounts/'+account,worker='football-edge-background-watch',baseline='880db53d-aa17-4aed-9350-aa78e44edd56',candidate='8151e077-d95e-4861-b8aa-25eb56b7f079',helper='fe-tail-refresh-'+process.env.GITHUB_RUN_ID,auth=randomBytes(32).toString('hex');
let created=false,switched=false,tail=null,ws=null;const report={provider_calls:0,push_calls:0,storage_deleted:false};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function cf(path,opts={}){const r=await fetch(api+path,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers},signal:AbortSignal.timeout(20000)});const j=await r.json();assert(r.ok&&j.success,JSON.stringify({http:r.status,errors:j.errors}));return j.result;}
async function active(n){return (await cf('/workers/scripts/'+n+'/deployments')).deployments[0].versions;}
async function set(v){await cf('/workers/scripts/'+worker+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:v,percentage:100}],code_update_strategy:{mode:'immediate'}})});}
async function health(){const r=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(20000)});assert(r.ok);return r.json();}
try{
 assert(account&&token);assert.deepEqual(await active(worker),[{version_id:baseline,percentage:100}]);assert.deepEqual(await active('shiny-silence-d892'),[{version_id:'c9b86303-7031-4068-a4fe-808de4a0093a',percentage:100}]);
 const before=await health();report.scanner_was_on=before.peak_status?.enabled;assert.equal(before.deploy_commit,'3cd210d2d74aff547de4587ab4a3c96b982a728c');
 const source=`export default {async fetch(r,e){if(r.headers.get('authorization')!=='Bearer '+e.AUTH)return new Response('Unauthorized',{status:401});if(r.method==='GET')return Response.json({ready:true});if(r.method!=='POST')return new Response('Method not allowed',{status:405});const w=e.DO.get(e.DO.idFromName('football-edge-global'));return w.fetch(new Request('https://internal/api/notify/scan-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:false})}));}};`;
 const f=new FormData();f.append('metadata',new Blob([JSON.stringify({main_module:'helper.mjs',compatibility_date:'2026-10-01',bindings:[{type:'durable_object_namespace',name:'DO',namespace_id:'a401c5da72a54ec1ba485db1b46d89c9'},{type:'secret_text',name:'AUTH',text:auth}]})],{type:'application/json'}));f.append('helper.mjs',new Blob([source],{type:'application/javascript+module'}),'helper.mjs');await cf('/workers/scripts/'+helper,{method:'PUT',body:f});created=true;await cf('/workers/scripts/'+helper+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});const d=await cf('/workers/subdomain'),url='https://'+helper+'.'+d.subdomain+'.workers.dev/';let ready=false;for(let i=0;i<8;i++){const r=await fetch(url,{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(10000)});if(r.ok){ready=true;break;}await sleep(1000);}assert(ready);const p=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(30000)});assert(p.ok);const pj=await p.json();assert.equal(pj.scan_control?.enabled,false);report.scanner_paused=true;
 const off=await health();assert.equal(off.peak_status?.enabled,false);assert.equal(off.next_alarm,null);
 await set(candidate);switched=true;
 tail=await cf('/workers/scripts/'+worker+'/tails',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters:[]})});
 ws=new WebSocket(tail.url,'trace-v1');await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('TAIL_CONNECT_TIMEOUT')),15000);ws.addEventListener('open',()=>{clearTimeout(t);ws.send(JSON.stringify({debug:false}));resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(t);reject(Error('TAIL_CONNECT_FAILED'));},{once:true});});report.tail_connected=true;
 // Discard log frames; never persist request headers, subscriptions or log content.
 for(let i=0;i<12;i++){const h=await health();assert.equal(h.peak_status?.enabled,false);assert.equal(h.next_alarm,null);report.observation={edge:h.deploy_commit,runtime:h.notify_status?.mechanism_notifications??null};if(report.observation.runtime?.source==='632d7094b947303b8534056ccb1f70c4b216f7a9'){report.runtime_refreshed=true;break;}await sleep(3000);}
 report.status=report.runtime_refreshed?'REFRESH_PROVEN_RESTORING_BASELINE':'RUNTIME_STILL_OLD';
}catch(e){report.error=String(e.message).slice(0,600);process.exitCode=1;}
finally{
 if(ws)ws.close();if(tail)try{await cf('/workers/scripts/'+worker+'/tails/'+tail.id,{method:'DELETE'});report.tail_removed=true;}catch{report.tail_cleanup_failed=true;process.exitCode=1;}
 if(switched)try{assert.deepEqual(await active(worker),[{version_id:candidate,percentage:100}]);await set(baseline);report.restored_baseline=baseline;}catch(e){report.restore_error=String(e.message).slice(0,300);process.exitCode=1;}
 if(created)try{await cf('/workers/scripts/'+helper,{method:'DELETE'});report.helper_removed=true;}catch{report.helper_cleanup_failed=true;process.exitCode=1;}
 try{const h=await health();report.final={edge:h.deploy_commit,scanner:h.peak_status?.enabled,alarm:h.next_alarm};}catch{report.final_health_unavailable=true;}
 writeFileSync('tail-refresh.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}

process.exit(process.exitCode||0);
