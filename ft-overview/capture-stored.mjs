import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {storedRowsToInputs,auditStoredInputs} from './stored-replay.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
assert(account&&token,'CLOUDFLARE_CREDENTIALS_MISSING');
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account);
const expected={'football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13','shiny-silence-d892':'03c1d55d-358a-448b-96f3-f356704831df','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};
async function cf(path,options={}){const r=await fetch(base+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();assert(r.ok&&j.success,'CLOUDFLARE_READ_FAILED_'+r.status);return j.result;}
async function versions(){const out={};for(const [name,id]of Object.entries(expected)){const v=(await cf('/workers/scripts/'+name+'/deployments')).deployments?.[0]?.versions;assert.deepEqual(v,[{version_id:id,percentage:100}]);out[name]=id;}return out;}
const before=await versions();
// One bounded SELECT only. No DO helper, CREATE, UPDATE, provider or scan route.
const result=await cf('/d1/database/0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql:"SELECT fixture_id,payload FROM fe_notify_live_state WHERE json_type(payload,'$.ui')='object' AND json_extract(payload,'$.ui.captured_at')>0 ORDER BY updated_at DESC LIMIT 50",params:[]})});
assert(result.length===1&&result[0].success,'D1_SELECT_FAILED');assert.equal(result[0].meta?.rows_written,0,'D1_WRITE_NOT_ZERO');
const packet=storedRowsToInputs(result[0].results||[]),report=auditStoredInputs(packet,Date.now());
report.d1={rows_read:result[0].meta?.rows_read,rows_written:result[0].meta?.rows_written,stored_rows_selected:result[0].results.length};report.versions_before=before;report.versions_after=await versions();assert.deepEqual(report.versions_after,before);
report.source_commit=process.env.GITHUB_SHA;report.technical_status='PASS';report.real_model_acceptance='NOT_PROVEN';
writeFileSync('ft-overview/real-input-report.json',JSON.stringify(report,null,2));
writeFileSync('ft-overview/replay-data.mjs','export default '+JSON.stringify({captured_at:report.captured_at,...packet,report})+';\n');
console.log('FT_OVERVIEW_REAL_INPUT '+JSON.stringify(report));
