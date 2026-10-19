import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN,root='https://api.cloudflare.com/client/v4/accounts/'+a,worker='football-edge-background-watch',helper='fe-push-check-'+process.env.GITHUB_RUN_ID,auth=randomBytes(32).toString('hex');
const expected='04cc044d-412f-4844-9b83-c7c786eedd13',source='da5242bb41b2401271f52dda17b0e2208e7e3819';
const report={run:process.env.GITHUB_RUN_ID,production_source:source,production_version:expected,provider_requests:0,push_call_cap:1,scanner_enabled_by_test:false,push_sent:false,production_D1_writes_requested:0,cleanup:false,errors:[]};let created=false;
async function cf(p,o={}){const r=await fetch(root+p,{...o,headers:{Authorization:'Bearer '+t,...o.headers},signal:AbortSignal.timeout(25000)}),j=await r.json();if(!r.ok||!j.success)throw Error('CF_'+r.status);return j.result}
async function versions(){const out={};for(const n of [worker,'shiny-silence-d892','football-edge-desktop-b2-test'])out[n]=(await cf('/workers/scripts/'+n+'/deployments')).deployments?.[0]?.versions;return out}
const helperSource=`export default {async fetch(request,env){
 if(request.headers.get('authorization')!=='Bearer '+env.CHECK_AUTH)return new Response('Unauthorized',{status:401});
 if(new URL(request.url).searchParams.has('ready'))return Response.json({ready:true});
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const stub=env.PRODUCTION_DO.get(env.PRODUCTION_DO.idFromName('football-edge-global'));
 const control=await stub.scanControl();if(control.enabled!==false)return Response.json({error:'SCANNER_IS_ON'},{status:409});
 const devices=(await stub.devices()).filter(x=>x?.prefs?.enabled&&x.transport!=='native'&&x.subscription?.endpoint);
 const apples=devices.filter(x=>{try{const h=new URL(x.subscription.endpoint).hostname;return h==='web.push.apple.com'||h.endsWith('.push.apple.com')}catch{return false}});
 const out={enabled_web_subscriptions:devices.length,apple_subscriptions:apples.length,sent:false};
 if(apples.length!==1){out.error='PENDING_UNIQUE_APPLE_SUBSCRIPTION';return Response.json(out)}
 const stamp=Date.now();out.started_at=stamp;
 try{const accepted=await stub.send(apples[0],{title:'Football Edge • Kiểm tra sau sửa',body:'Thông báo thử từ backend mới. Quét nền vẫn đang TẮT.',url:'https://shiny-silence-d892.ngophuonghuy.workers.dev/#connectCard',tag:'fe-completion-test-'+env.CHECK_RUN,created_at:stamp});out.sent=true;out.accepted=accepted===true;out.completed_at=Date.now();if(!accepted)out.error='PUSH_NOT_ACCEPTED'}catch(e){out.error=String(e.message||e).slice(0,160)}
 return Response.json(out);
}};`
try{
 assert(a&&t);report.versions_before=await versions();assert.deepEqual(report.versions_before[worker],[{version_id:expected,percentage:100}]);
 const hr=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(15000)}),h=await hr.json();assert.equal(h.deploy_commit,source);assert.equal(h.peak_status?.enabled,false);assert.equal(h.next_alarm,null);
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'check.mjs',compatibility_date:'2026-10-01',bindings:[{type:'durable_object_namespace',name:'PRODUCTION_DO',namespace_id:'a401c5da72a54ec1ba485db1b46d89c9'},{type:'secret_text',name:'CHECK_AUTH',text:auth},{type:'plain_text',name:'CHECK_RUN',text:String(process.env.GITHUB_RUN_ID)}]})],{type:'application/json'}));form.append('check.mjs',new Blob([helperSource],{type:'application/javascript+module'}),'check.mjs');await cf('/workers/scripts/'+helper,{method:'PUT',body:form});created=true;
 await cf('/workers/scripts/'+helper+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});const domain=await cf('/workers/subdomain'),url='https://'+helper+'.'+domain.subdomain+'.workers.dev/';
 let ready=false;for(let i=0;i<10;i++){const r=await fetch(url+'?ready=1',{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(10000)});if(r.ok){ready=true;break}await new Promise(r=>setTimeout(r,2000))}assert(ready);
 const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(60000)});assert(r.ok);report.push_check=await r.json();report.push_sent=report.push_check.sent===true;
 const final=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(15000)});const fh=await final.json();report.health_after={commit:fh.deploy_commit,scanner:fh.peak_status?.enabled,alarm:fh.next_alarm,diagnostics:fh.notify_status?.diagnostics_version};assert.equal(fh.deploy_commit,source);assert.equal(fh.peak_status?.enabled,false);assert.equal(fh.next_alarm,null);
 if(report.push_check.error){report.errors.push(report.push_check.error);process.exitCode=1}
}catch(e){report.errors.push(String(e.message||e).slice(0,250));process.exitCode=1}
finally{
 if(created){try{await cf('/workers/scripts/'+helper,{method:'DELETE'});report.cleanup=true}catch{report.errors.push('HELPER_CLEANUP_FAILED');process.exitCode=1}}
 if(report.versions_before){try{report.versions_after=await versions();assert.deepEqual(report.versions_after,report.versions_before);report.versions_unchanged=true}catch{report.errors.push('VERSION_DRIFT');process.exitCode=1}}
 writeFileSync('backend-completion-push-result.json',JSON.stringify(report,null,2));console.log('BACKEND_COMPLETION_PUSH '+JSON.stringify(report));
}
