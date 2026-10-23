// Review-only patch builder, fails on any mismatch in the current inherited
// scanner. Builds candidate copies; NEVER edits tracked runtime sources.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='ft-audit-output/ft-pilot-candidate';
mkdirSync(root,{recursive:true});
const hash=t=>createHash('sha256').update(t).digest('hex');
function change(s,a,b,label){
 assert.equal(s.split(a).length,2,'FT_PILOT_PATCH_ANCHOR_DRIFT_'+label);
 return s.replace(a,b);
}
export function patchExistingNotify(src){
 let s=src;
 assert(!s.includes("from './ft-pilot/integration.mjs'"),'PILOT_ALREADY_PATCHED_NOTIFY');
 s="import {scheduleFTPilot} from './ft-pilot/integration.mjs';\n"+s;
 s=change(s,
 "      status.live=live.length;",
 "      const ftPilotFixtureAt=Date.now(); // receipt of EXISTING live fixture response\n      status.live=live.length;",
 'LIVE_FIXTURE_RECEIPT');
 s=change(s,"          const health={},sourceWarnings=[];",
  "          const health={},sourceWarnings=[];const ftPilotReceipts={};",
  'SOURCE_RECEIPTS_INIT');
 s=change(s,"const rows=await api(path,params,false);",
  "const rows=await api(path,params,false);ftPilotReceipts[name]=Date.now();",
  'SOURCE_RECEIPT_SUCCESS');
 s=change(s,"catch(e){health[name]='ERROR';sourceWarnings.push(",
  "catch(e){ftPilotReceipts[name]=Date.now();health[name]='ERROR';sourceWarnings.push(",
  'SOURCE_RECEIPT_FAILURE');
 s=change(s,"            let goalPeak=null;",
  "            let goalPeak=null;let ftPilotCandidate=false;",
  'PUSH_ACCEPTED_READONLY_CLASS');
 s=change(s,"if(await this.send(d,packet)){for(const kind of kinds)",
  "if(await this.send(d,packet)){if(signals.goal)ftPilotCandidate=true;for(const kind of kinds)",
  'AFTER_PUSH_ACCEPTANCE_FLAG');
 // A 2H fixture with missing core stats must still be included in the
 // non-recommended population; do not silently sample successful evaluations only.
 const degraded="if(!stats.length){item.last={goalMode:null,goalScore:null,h1Score:null,gap:null,at:Date.now(),sourceHealth:health,reason:'STATS_UNAVAILABLE'};status.scanned++;status.degraded++}";
 const degradedWithHook=`if(!stats.length){
            item.last={goalMode:null,goalScore:null,h1Score:null,gap:null,at:Date.now(),sourceHealth:health,reason:'STATS_UNAVAILABLE'};status.scanned++;status.degraded++;
            if(this.env.FT_PILOT_ENABLED==='true'&&f.fixture?.status?.short==='2H'){
              try{scheduleFTPilot(this,{kind:'PAIR',scan:{
                fixture:f,fixtureReceivedAt:ftPilotFixtureAt,capturedAt:Date.now(),
                health,receipts:ftPilotReceipts,payloads:{stats,events,odds,half},
                crossingRequested:false,
                decision:{state:'NOT_EVALUATED',reason:'STATS_UNAVAILABLE',
                  market_rows:null,devices:[]}
              }});}catch{}
            }
          }`;
 s=change(s,degraded,degradedWithHook,'DEGRADED_NO_STATS_COVERAGE');
 const anchor="            status.signalEligible+=Number(!!h1Eval)+Number(s.status==='2H')+Number(hcReady);";
 const hook=`            // FT PILOT sidecar is nonblocking and OFF by default. Existing
            // HT/HC/PUSH already evaluated and sent above; never await capture.
            if(this.env.FT_PILOT_ENABLED==='true'&&s.status==='2H'){
              try{scheduleFTPilot(this,{kind:'PAIR',scan:{
                fixture:f,fixtureReceivedAt:ftPilotFixtureAt,capturedAt:stamp,
                health,receipts:ftPilotReceipts,payloads:{stats,events,odds,half},
                crossingRequested:ftPilotCandidate,
                decision:{state:'EVALUATED',decision_at:stamp,evaluation:ft.eval,
                  market_rows:compact,devices:[]}
              }});}catch{}
            }
${anchor}`;
 s=change(s,anchor,hook,'AFTER_PUSH_PILOT_SCHEDULE');
 return s;
}
export function patchExistingEvidenceWorker(src){
 let s=src;
 assert(!s.includes("from './ft-pilot/integration.mjs'"),'PILOT_ALREADY_PATCHED_WORKER');
 s="import {scheduleFTPilot} from './ft-pilot/integration.mjs';\n"+s;
 const anchor="          if(!f)throw new Error('EVIDENCE_FIXTURE_UNAVAILABLE');";
 const replacement=`${anchor}
          // Reuse the fixture response the existing evidence pass already
          // received. No dedicated FT Outcome API query or polling.
          if(this.env.FT_PILOT_ENABLED==='true'){
            try{scheduleFTPilot(this,{kind:'OUTCOME',fixture:f,receivedAt:Date.now()});}catch{}
          }`;
 s=change(s,anchor,replacement,'EXISTING_OUTCOME_RESPONSE');
 return s;
}
const inputs=[
 ['worker_notify_v133_quota6500.js',patchExistingNotify],
 ['worker.js',patchExistingEvidenceWorker]
];
const manifest={schema:'FE_FT_PILOT_CANDIDATE_PATCH_V1',mode:'REVIEW_ONLY_NO_DEPLOY',
 integration_status:'INHERITED_SCAN_AND_EXISTING_EVIDENCE_CALLBACK_ONLY',
 raw_snapshot_before_ht_hc_push:false,source_hashes:{},candidate_hashes:{},
 runtime_flags:{FT_PILOT_ENABLED:'false'},production_modified:false};
for(const [path,fn] of inputs){
 const raw=readFileSync(path,'utf8'),patched=fn(raw);
 assert.notEqual(patched,raw);assert(!raw.includes('ft-pilot/integration.mjs'));
 writeFileSync(root+'/'+path,patched);
 manifest.source_hashes[path]=hash(raw);
 manifest.candidate_hashes[path]=hash(patched);
}
writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2));
console.log('FE_FT_PILOT_PATCH_REVIEW_READY '+JSON.stringify(manifest));
