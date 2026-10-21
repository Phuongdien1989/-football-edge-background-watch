import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;assert(token&&account);
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
async function get(path){const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)}),j=await r.json();assert(r.ok&&j.success,'CF_READ_'+r.status);return j.result;}
const expected={'shiny-silence-d892':'0449307e-c464-4959-82b6-c4825789e568','football-edge-background-watch':'fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'},active={};
for(const [name,id]of Object.entries(expected)){const versions=(await get(name+'/deployments')).deployments?.[0]?.versions;assert.equal(versions?.length,1);assert.equal(versions[0].percentage,100);assert.equal(versions[0].version_id,id,'PRODUCTION_DRIFT_'+name);active[name]=id;}
const rollback='bbddcaa4-1536-4f4e-852a-83f8ffd88b83';assert.equal((await get('shiny-silence-d892/versions/'+rollback)).id,rollback);
const m=JSON.parse(readFileSync('previous-mobile/manifest.json'));assert.equal(m.source_commit,'d521619f3319ff715e61e745a2f25fbc3b286ddc');
for(const f of m.site){assert(!f.path.includes('..'));const r=await fetch('https://shiny-silence-d892.ngophuonghuy.workers.dev/'+f.path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});assert(r.ok,'PUBLIC_'+f.path);const sha=createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex');assert.equal(sha,f.sha256,'PUBLIC_ASSET_DRIFT_'+f.path);}
mkdirSync('ht-audit',{recursive:true});const report={status:'PASS',active,rollback,rollback_exists:true,verified_assets:m.site.length,all_cloudflare_calls:'GET',provider_requests:0,d1_queries:0,scanner_toggled:false,production_deployed:false,physical_phone_push:'NOT_VERIFIED'};writeFileSync('ht-audit/production-readonly.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
