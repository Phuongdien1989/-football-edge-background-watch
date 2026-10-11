import {writeFileSync} from 'node:fs';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('CLOUDFLARE_CREDENTIALS_MISSING');
const worker='football-edge-v2-raw-capture';
const path='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/'+worker+'/schedules';
const report={worker,mode:'DISABLE_CAPTURE_CRON_ONLY_NO_WORKER_DEPLOY_NO_DATA_CHANGE',commit:process.env.CANDIDATE_SHA};
const save=()=>writeFileSync('capture-cron-control.json',JSON.stringify(report,null,2));
async function request(method='GET',body){
 const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const b=await r.json();if(!r.ok||b.success===false)throw Error('CF_HTTP_'+r.status+'_CODES_'+(b.errors||[]).map(x=>x.code).join(','));
 return Array.isArray(b.result)?b.result:b.result?.schedules;
}
try{
 report.before=await request();save();
 if(!Array.isArray(report.before)||report.before.some(x=>x.cron!=='* * * * *'))throw Error('UNEXPECTED_CAPTURE_SCHEDULE_REQUIRES_REVIEW');
 report.rollbackScheduleBody=report.before.map(x=>({cron:x.cron}));save();
 if(report.before.length)await request('PUT',[]);
 report.after=await request();
 if(!Array.isArray(report.after)||report.after.length)throw Error('CAPTURE_CRON_NOT_DISABLED');
 report.result='PASS';save();console.log(JSON.stringify(report,null,2));
}catch(e){report.result='FAIL';report.error=e.message;save();console.log(JSON.stringify(report,null,2));process.exitCode=1;}
