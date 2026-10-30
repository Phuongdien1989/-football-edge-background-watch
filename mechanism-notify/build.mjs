import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='mechanism-release',previous='previous-backend',hash=b=>createHash('sha256').update(b).digest('hex');
const m=JSON.parse(readFileSync(previous+'/manifest.json')),d=JSON.parse(readFileSync(previous+'/deployment.json'));
assert.equal(d.version,'e7d2090c-d0e1-4f58-9f5a-4360acd2ced3');assert.equal(d.source_commit,'3cd210d2d74aff547de4587ab4a3c96b982a728c');
for(const f of m.candidate){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(previous+'/candidate/'+f.path)),f.sha256);}
mkdirSync(dir,{recursive:true});cpSync(previous+'/candidate',dir+'/backup',{recursive:true});cpSync(previous+'/candidate',dir+'/candidate',{recursive:true});
const patch=(p,before,after)=>{const file=dir+'/candidate/'+p,s=readFileSync(file,'utf8');assert.equal(s.split(before).length,2,'PATCH_NOT_UNIQUE_'+p+'_'+before.slice(0,45));writeFileSync(file,s.replace(before,after));};
const p='worker_notify_v130.js';
patch(p,"import {crossing} from './worker_notify.js';",`import {crossing} from './worker_notify.js';
import {mechanismPrefs,evaluateMechanisms,capabilities} from './mechanism-notify/core.mjs';
import {createFTContextCache} from './mechanism-notify/context.mjs';
import {deliverMechanisms} from './mechanism-notify/deliver.mjs';`);
patch(p,'    enabled:p.enabled!==false,','    ...mechanismPrefs(p),enabled:p.enabled!==false,');
patch(p,'  async notifyStatusView(){','  mechanismCapabilities(){return capabilities();}\n\n  async notifyStatusView(){');
patch(p,'return reply({...d,scan:{...(d.scan||{}),...(latest||{})}},r.status);','return reply({...d,mechanism_notifications:this.mechanismCapabilities(),scan:{...(d.scan||{}),...(latest||{})}},r.status);');
patch(p,"const goalEstimates={};",`const goalEstimates={};
            this._ftMechanismHistory ||= createFTContextCache();
            const ftBundle=devices.some(d=>d.prefs.ftOverview||d.prefs.ftV2)?await this._ftMechanismHistory.read(this.env.FOOTBALL_DB,f,stamp):null;
            const deliverySnapshot={...s,fixture:f,market_rows:compact,market_at:stamp};
            const mechanismPacket=evaluateMechanisms({fixture:f,snapshot:deliverySnapshot,item,htContext,ftBundle,now:Date.now()});
            status.mechanism_policy=mechanismPacket.schema;
            status.mechanism_results ||= [];if(status.mechanism_results.length<12)status.mechanism_results.push({fixture_id:id,results:Object.fromEntries(Object.entries(mechanismPacket.results).map(([k,v])=>[k,{state:v.state,action:v.action,reason:v.reason}]))});`);
const old="const kinds=Object.keys(signals);if(kinds.length){status.signalCrossings+=kinds.length;const packet=payloadFor(f,{minute:s.minute,score,stamp},id,signals);if(await this.send(d,packet)){for(const kind of kinds)item.alerts[d.id+':'+kind]={armed:false,lastSent:stamp};status.alertsAccepted++}}";
patch(p,old,`const delivery=await deliverMechanisms(this,{device:d,fixture:f,snapshot:deliverySnapshot,item,packet:mechanismPacket,legacySignals:signals,now:Date.now()});
              if(delivery.sent){status.signalCrossings+=delivery.kinds.length;status.alertsAccepted++;}
              if(delivery.error)status.errors.push({fixture:id,error:'MECHANISM_PUSH:'+delivery.error});`);
patch(p,'snapshot:{...s,market_rows:compact},engines:','notification_context:mechanismPacket.context,notification_results:mechanismPacket.results,\n              snapshot:{...s,market_rows:compact},engines:');
patch(p,'if(stateChanged){item.history=[];','if(stateChanged){item.parityResetAt=stamp;item.history=[];');
// Keep new choices through subscribe, settings, native subscribe and status.
for(const [file,needle] of [['worker_notify.js','export function preferences(p={}){return {'],['worker_notify_v132_native.js','function nativePrefs(p={}){return {']]){
 const s=readFileSync(dir+'/candidate/'+file,'utf8');writeFileSync(dir+'/candidate/'+file,"import {mechanismPrefs} from './mechanism-notify/core.mjs';\n"+s);patch(file,needle,needle+'...mechanismPrefs(p),');
}
for(const file of ['worker_notify_v130.js','worker_notify_v136_hot_priority.js','worker_notify_v138_peak_window.js','worker_notify.js']){
 const f=dir+'/candidate/'+file,s=readFileSync(f,'utf8');writeFileSync(f,s.replaceAll('(d.prefs.h1||d.prefs.goal||d.prefs.gap)','(d.prefs.h1||d.prefs.goal||d.prefs.gap||d.prefs.ftOverview||d.prefs.ftV2)').replaceAll('(d?.prefs?.h1||d?.prefs?.goal||d?.prefs?.gap)','(d?.prefs?.h1||d?.prefs?.goal||d?.prefs?.gap||d?.prefs?.ftOverview||d?.prefs?.ftV2)').replaceAll('(d.prefs.goal||d.prefs.gap)','(d.prefs.h1||d.prefs.goal||d.prefs.gap||d.prefs.ftOverview||d.prefs.ftV2)'));
}
patch('notify-ui-state.mjs','snapshot:u.snapshot,engines:u.engines,','notification_context:u.notification_context??null,notification_results:u.notification_results??null,\n   snapshot:u.snapshot,engines:u.engines,');
patch('notify-ui-state.mjs','FT:{history:item.history||[],cooldownUntil:','FT:{history:item.history||[],resetAt:item.parityResetAt||0,cooldownUntil:');
patch('worker_notify_v138_peak_window.js',"return {diagnostics_version:'PACING_COOLDOWN_QUOTA_V7_PAUSE_MINUTE',budget,","return {mechanism_notifications:this.mechanismCapabilities(),diagnostics_version:'PACING_COOLDOWN_QUOTA_V7_PAUSE_MINUTE',budget,");
for(const path of ['core.mjs','context.mjs','deliver.mjs']){mkdirSync(dir+'/candidate/mechanism-notify',{recursive:true});cpSync('mechanism-notify/'+path,dir+'/candidate/mechanism-notify/'+path);}
for(const file of ['adapter.mjs','experimental-decision.mjs','live-probability.mjs'])cpSync('ft-overview/'+file,dir+'/candidate/ft-overview/'+file);
// Copy the SAME pure assessor deployed on Mobile, without changing formulas.
cpSync('ht-early-candidate/assess-item.mjs',dir+'/candidate/ht-early-candidate/assess-item.mjs');
assert.equal(hash(readFileSync(dir+'/backup/ft-overview/core.mjs')),hash(readFileSync('ft-overview/core.mjs')),'SHARED_PRICING_CORE_DRIFT');
for(const file of ['model.mjs','valuation.mjs','valuation-adapter.mjs'])assert.equal(hash(readFileSync(dir+'/backup/ht-early-candidate/'+file)),hash(readFileSync('ht-early-candidate/'+file)),'HT_MODEL_DRIFT_'+file);
for(const file of ['worker_notify_v135_full_pause.js','worker_notify_v137_quota50000.js','provider_errors.mjs','wrangler.toml','notify-core.js','notify-core-h1.js'])assert.equal(hash(readFileSync(dir+'/backup/'+file)),hash(readFileSync(dir+'/candidate/'+file)),'OUT_OF_SCOPE_BACKEND_DRIFT_'+file);
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]);
const list=folder=>walk(dir+'/'+folder).map(p=>({path:p.slice((dir+'/'+folder+'/').length),sha256:hash(readFileSync(p))})).sort((a,b)=>a.path.localeCompare(b.path));
const backup=list('backup'),candidate=list('candidate'),changed=backup.filter(f=>candidate.find(c=>c.path===f.path)?.sha256!==f.sha256).map(f=>f.path),added=candidate.filter(f=>!backup.some(b=>b.path===f.path)).map(f=>f.path);
writeFileSync(dir+'/manifest.json',JSON.stringify({source_commit:process.env.GITHUB_SHA||'LOCAL',original_version:d.version,original_deploy_commit:d.source_commit,backup,candidate,changed,added},null,2));
console.log(JSON.stringify({status:'PASS',changed,added,provider_policy_unchanged:true,models_unchanged:true}));
