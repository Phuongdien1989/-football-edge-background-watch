// Read-only MOBILE Worker script source check.
// Execute exactly once; no source bytes are printed or transmitted as an artifact. Not a traffic-level replay diagnosis.
// Never print Worker source (which may contain embedded secrets). Only boolean marker report.
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/shiny-silence-d892';
const report={status:'NOT_RUN',at:new Date().toISOString(),source:'Cloudflare GET worker content/v2',d1_writes:0,d1_queries:0,worker_deploys:0,scanner_changes:0,errors:[]};
mkdirSync('ft-audit-output',{recursive:true});
const save=()=>writeFileSync('ft-audit-output/ft-mobile-producer-readonly.json',JSON.stringify(report,null,2));
async function get(path){
 const res=await fetch(base+path,{method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(22000)});
 if(!res.ok){const e=Error('CF_GET_'+res.status);e.status=res.status;throw e;}
 return res;
}
try{
 if(!account||!token||process.env.FT_MOBILE_CODE_READONLY_ONCE!=='CONFIRM'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw Error('GATE_NOT_CONFIGURED');
 const deploy=await (await get('/deployments')).json();
 const before=deploy.result?.deployments?.[0]?.versions;
 if(!Array.isArray(before)||before.length!==1||before[0].percentage!==100)throw Error('ACTIVE_MOBILE_UNVERIFIED');
 report.active_version=before[0].version_id;
 const res=await get('/content/v2');
 const len=Number(res.headers.get('content-length')||0);
 if(len>5_000_000)throw Error('MOBILE_SOURCE_TOO_LARGE');
 const source=await res.text();
 if(Buffer.byteLength(source)>5_000_000)throw Error('MOBILE_SOURCE_TOO_LARGE');
 report.source_sha256=createHash('sha256').update(source).digest('hex');
 report.source_bytes=Buffer.byteLength(source);
 report.content_type=(res.headers.get('content-type')||'').split(';')[0];
 const markers={
   entry_queue_function:source.includes('feDbQueueEntryDecision'),
   full_payload_fingerprint:source.includes('feDbEntryFingerprint('),
   atomic_ack_function:source.includes('async function feDbAckBatch('),
   atomic_ack_called:source.includes('await feDbAckBatch(rows)'),
   old_ack_sequence:source.includes('await feDbSyncStateMark(rows);await feDbOutboxDelete(rows)'),
   explicit_accepted_count:source.includes('res.accepted!==rows.length'),
   direct_entry_outbox:source.includes("type:'ENTRY_DECISION'")
 };
 report.markers=markers;
 report.interpretation=markers.full_payload_fingerprint&&markers.atomic_ack_called&&markers.explicit_accepted_count
  ?'EXPECTED_MOBILE_FIX_MARKERS_PRESENT_IN_WORKER_SOURCE'
  :markers.entry_queue_function&&markers.old_ack_sequence&&!markers.atomic_ack_called
  ?'LEGACY_ENTRY_ACK_MARKERS_PRESENT_IN_WORKER_SOURCE'
  :'NOT_PROVABLE_FROM_SCRIPT_CONTENT';
 report.warning='Marker search across Worker source only; static asset frontend may reside outside Worker. Does not prove device traffic, event retry rate, or byte-for-byte frontend content loaded on phone.';
 report.status='PASS';
}catch(e){report.status='FAIL';report.errors.push({message:e.message,status:e.status||null});process.exitCode=1;}
finally{save();console.log('FE_MOBILE_PRODUCER_READONLY '+JSON.stringify(report));}
