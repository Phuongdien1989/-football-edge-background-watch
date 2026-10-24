// GET only the PUBLIC Mobile home page. Read local returned HTML in CI; never print it.
// One-time source audit following failed empty Cloudflare script-content probe.
// No auth, D1 SQL, API-football, scanner controls, or production mutations.
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const url='https://shiny-silence-d892.ngophuonghuy.workers.dev/';
const result={schema:'FE_MOBILE_PUBLIC_SOURCE_BASELINE_V1',checked_at:new Date().toISOString(),status:'NOT_RUN',endpoint:url,production_modified:false,scanner_changed:false,d1_queries:0,d1_writes:0,provider_requests:0,markers:{},errors:[]};
mkdirSync('ft-audit-output',{recursive:true});
const save=()=>writeFileSync('ft-audit-output/mobile-public-baseline-inspection.json',JSON.stringify(result,null,2));
try{
 assert(process.env.FT_MOBILE_PUBLIC_READONLY_ONCE==='CONFIRM'&&process.env.GITHUB_RUN_ATTEMPT==='1','RUN_GATE_MISSING');
 const res=await fetch(url,{method:'GET',headers:{Accept:'text/html','Cache-Control':'no-cache'},signal:AbortSignal.timeout(28000),redirect:'error'});
 assert.equal(res.status,200,'PUBLIC_MOBILE_HTTP_'+res.status);
 const type=(res.headers.get('content-type')||'').split(';')[0];
 assert(['text/html','application/xhtml+xml'].includes(type),'UNEXPECTED_CONTENT_TYPE_'+type);
 const bytes=Buffer.from(await res.arrayBuffer());
 assert(bytes.length>20000&&bytes.length<3000000,'INVALID_HTML_BYTES');
 const html=bytes.toString('utf8');
 result.status='PASS';result.content_type=type;result.bytes=bytes.length;result.sha256=createHash('sha256').update(bytes).digest('hex');
 const markers={
  queue_entry:html.includes('function feDbQueueEntryDecision('),
  old_naked_entry_queue:html.includes("type:'ENTRY_DECISION',created_at:Date.now(),payload,sync_key:id})"),
  new_entry_fingerprint:html.includes('function feDbEntryFingerprint('),
  queue_entry_fingerprint:html.includes('fingerprint=feDbEntryFingerprint(payload)'),
  queue_sync_state:html.includes('await feDbSyncStateGet(id)'),
  atomic_ack:html.includes('async function feDbAckBatch('),
  atomic_ack_used:html.includes('await feDbAckBatch(rows)'),
  legacy_non_atomic_ack:html.includes('await feDbSyncStateMark(rows);await feDbOutboxDelete(rows)'),
  check_full_ack:html.includes('res.accepted!==rows.length'),
  revision_match:html.includes('current.queue_revision===sent.queue_revision'),
  d1_sync_post:html.includes('/api/db/sync')
 };
 result.markers=markers;
 const old=markers.old_naked_entry_queue||markers.legacy_non_atomic_ack;
 const fresh=markers.new_entry_fingerprint&&markers.atomic_ack&&markers.atomic_ack_used&&markers.check_full_ack;
 result.classification=fresh?'FIX_PRESENT':old?'LEGACY_OR_PARTIAL_FIX':'UNKNOWN';
 result.legacy_expected_sha_match=result.sha256==='aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28';
 // The GET of the deployed public HTML is the baseline; marker checks do not prove client IndexedDB state or traffic volume.
 result.warning='Raw HTML intentionally not uploaded; no on-device request traces captured. Public homepage can drift while workflow runs.';
}catch(e){result.status='FAIL';result.errors.push(String(e.message||e).slice(0,170));process.exitCode=1;}
finally{save();console.log('FE_MOBILE_PUBLIC_BASELINE '+JSON.stringify(result));}
