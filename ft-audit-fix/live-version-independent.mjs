// Limited independent read-only probes.
// Last bounded execution for this checkpoint. No D1 SQL or mutable Cloudflare endpoints.
// Fail-closed on unknown; each endpoint reported independently. This is the last read attempt for this checkpoint.
import {mkdirSync,writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const out={at:new Date().toISOString(),scope:'CF_DEPLOYMENT_READONLY_INDEPENDENT',backend:null,mobile:null,health:null,rollback:null,errors:[],d1_queries:0,d1_writes:0,deployments:0,provider_calls:0,status:'NOT_RUN'};
mkdirSync('ft-audit-output',{recursive:true});
const save=()=>writeFileSync('ft-audit-output/ft-live-version-independent.json',JSON.stringify(out,null,2));
async function get(tag,url,opts={}){
 try{
  const response=await fetch(url,{method:'GET',headers:opts.auth?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(24000)});
  const json=await response.json().catch(()=>({}));
  if(!response.ok||opts.auth&&json.success!==true)return {status:'UNKNOWN',http:response.status,code:(json.errors||[]).map(e=>e.code)};
  if(tag==='health')return {status:'OK',http:response.status,deploy_commit:json.deploy_commit??null,
   enabled:json.peak_status?.enabled??null,manual_enabled:json.peak_status?.manualEnabled??null,next_alarm:json.next_alarm??null};
  if(tag==='rollback')return {status:'OK',exists:json.result?.id==='02d56762-ba08-4a8d-8654-bc9d522fc29a'};
  const versions=json.result?.deployments?.[0]?.versions;
  return {status:'OK',versions:Array.isArray(versions)?versions.map(x=>({id:x.version_id,percentage:x.percentage})):null};
 }catch(e){return {status:'UNKNOWN',reason:e.name==='TimeoutError'?'TIMEOUT':String(e.message||e).slice(0,120)};}
}
try{
 if(!account||!token)throw Error('AUTH_MISSING');
 if(process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.FT_LIVE_VERSION_AUDIT_LAST!=='ONCE')throw Error('ONE_SHOT_DISABLED');
 const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
 const jobs=[
  get('backend',base+'football-edge-background-watch/deployments',{auth:true}),
  get('mobile',base+'shiny-silence-d892/deployments',{auth:true}),
  get('health','https://football-edge-background-watch.ngophuonghuy.workers.dev/health'),
  get('rollback',base+'football-edge-background-watch/versions/02d56762-ba08-4a8d-8654-bc9d522fc29a',{auth:true})
 ];
 [out.backend,out.mobile,out.health,out.rollback]=await Promise.all(jobs);
 out.status=[out.backend,out.mobile,out.health,out.rollback].every(x=>x.status==='OK')?'PASS':'PARTIAL_UNKNOWN';
}catch(e){out.status='FAIL';out.errors.push(e.message);}
finally{save();console.log('FE_READONLY_LIVE_LAST '+JSON.stringify(out));}
