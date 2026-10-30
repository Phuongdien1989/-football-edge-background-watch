import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/',name='football-edge-background-watch',current='2e6dce00-1344-494e-853e-56bc0c549589',old='e7d2090c-d0e1-4f58-9f5a-4360acd2ced3';
const report={action:'DIAGNOSE_ROLLBACK',scanner_toggled:false};
async function api(path,opts={}){const r=await fetch(base+path,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();return {http:r.status,...j};}
async function active(){const j=await api(name+'/deployments');assert(j.success);return j.result.deployments[0].versions;}
async function deploy(id){return api(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':'Verify exact rollback compatibility while scanner OFF'}})});}
async function paused(){const r=await fetch('https://'+name+'.ngophuonghuy.workers.dev/health');const h=await r.json();assert.equal(h.peak_status?.enabled,false);assert.equal(h.next_alarm,null);return h;}
try{assert(account&&token);await paused();assert.deepEqual(await active(),[{version_id:current,percentage:100}]);
 const s=await api(name+'/settings');assert(s.success);report.binding_names=s.result.bindings.map(b=>({name:b.name,type:b.type}));
 for(const id of [old,current]){const v=await api(name+'/versions/'+id);assert(v.success);report[id]={id:v.result.id,migration_tag:v.result.migration_tag??null,binding_types:v.result.resources?.bindings?.map(b=>({name:b.name,type:b.type}))};}
 const same=await deploy(current);report.same_version_request={http:same.http,success:same.success,errors:same.errors};
 const prior=await deploy(old);report.original_rollback_request={http:prior.http,success:prior.success,errors:prior.errors};
 if(prior.success){assert.deepEqual(await active(),[{version_id:old,percentage:100}]);const back=await deploy(current);report.restore_current_request={http:back.http,success:back.success,errors:back.errors};assert(back.success);}
 assert.deepEqual(await active(),[{version_id:current,percentage:100}]);await paused();report.final_backend=current;report.status='DIAGNOSTIC_COMPLETE';
}catch(e){report.error=String(e.message).slice(0,300);process.exitCode=1;}
writeFileSync('rollback-diagnostic.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
