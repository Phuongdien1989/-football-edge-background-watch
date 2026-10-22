import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {buildFTObservation} from './observation.mjs';
import {buildFTDecision} from './decision-trace.mjs';
import {resolveFTOutcome} from './outcome.mjs';
import {prepareFTPair} from './ft-pair-collector.mjs';
import {PAIR_PAGE_SQL,verifyFTPairRow,auditFTPairOutcomeRows} from './pair-outcome-replay.mjs';
const n=Date.now(),fx={fixture:{id:42,status:{short:'2H',elapsed:70}},goals:{home:1,away:0}};
const o=buildFTObservation({id:'42:70',fixture_id:42,decision_at:n-3000,fixture:fx,sources:{fixture:{status:'OK',received_at:n-4000,source_at:null,data:fx}}});
const d=buildFTDecision({observation:o,decision_at:n-2000,state:'NOT_EVALUATED',reason:'STATS_UNAVAILABLE',source_hash:'b'.repeat(64)});
const p=await prepareFTPair(o,d,20000),row={...p,has_outcome:0};
const finished={fixture:{id:42,status:{short:'FT'}},score:{fulltime:{home:2,away:0}},goals:{home:2,away:0}};
const r=resolveFTOutcome(o,finished,n-1000,n);
let tests=0;async function test(title,fn){await fn();tests++;console.log('PASS '+title)}
await test('pair page uses isolated pair table and previous outcome ledger',async()=>{assert.match(PAIR_PAGE_SQL,/ft_replay_pairs_v1/);assert.match(PAIR_PAGE_SQL,/ft_replay_records_v1/);assert.match(PAIR_PAGE_SQL,/kind='OUTCOME'/)});
await test('exact independent hashes and receipt times validate',async()=>{const x=await verifyFTPairRow(row);assert.equal(x.status,'VALID_PAIR');assert.deepEqual(x.observation,o);assert.deepEqual(x.decision,d)});
await test('forged hash rejects before provider',async()=>{assert.equal((await verifyFTPairRow({...row,content_hash:'c'.repeat(64)})).status,'INVALID_PAIR')});
await test('wrong fixture and ID rejects',async()=>{assert.equal((await verifyFTPairRow({...row,fixture_id:43})).status,'INVALID_PAIR')});
await test('broken json rejects before provider',async()=>{assert.equal((await verifyFTPairRow({...row,decision_json:'broken'})).status,'INVALID_PAIR')});
await test('forecast input with FT final score rejected',async()=>{const m=structuredClone(o);m.fixture.score={fulltime:{home:2,away:0}};const q=await prepareFTPair(m,d,20000);assert.equal((await verifyFTPairRow({...q})).status,'INVALID_PAIR')});
await test('hash-valid pair with sealed FT source is quarantined before any outcome',async()=>{
 const m=structuredClone(o);m.sources.fixture.data={...fx,score:{fulltime:{home:2,away:0}}};
 const q=await prepareFTPair(m,d,20000),z=await verifyFTPairRow(q);
 assert.equal(z.status,'INVALID_PAIR');assert.match(z.reason,/SOURCE_FIXTURE_FUTURE_LABEL_LEAKAGE/);
});
await test('hash-valid pair with completed fixture in source array is quarantined',async()=>{
 const m=structuredClone(o);m.sources.fixture.data=[{...fx,fixture:{...fx.fixture,status:{short:'FT'}}}];
 const q=await prepareFTPair(m,d,20000);assert.equal((await verifyFTPairRow(q)).status,'INVALID_PAIR');
});
await test('outcome joins valid pair without producing ROI',async()=>{const x=await auditFTPairOutcomeRows([row],[r]);assert.equal(x.valid_pairs,1);assert.equal(x.linked_count,1);assert.equal(x.roi,null);assert.equal(x.releaseGate,'BLOCKED')});
await test('forged canceled result cannot be LINKED or counted as lost selection',async()=>{
 const x=await auditFTPairOutcomeRows([row],[{...r,status:'CANC'}]);
 assert.equal(x.linked_count,0);assert.equal(x.replay_counts.INVALID_LINK,1);
 assert.equal(x.accuracy,null);assert.equal(x.roi,null);
});
await test('replay reports verified raw odds while refusing fake model fair pricing',async()=>{
 const v=[{value:'Over',handicap:2.5,odd:1.9,main:true},{value:'Under',handicap:2.5,odd:1.95,main:true}];
 const o2=structuredClone(o);o2.id='42:70:raw-quoted';
 o2.sources.odds={status:'OK',received_at:n-2900,source_at:null,
  data:[{fixture:{id:42},odds:[{id:5,name:'Over/Under',values:v}]}]};
 const d2=buildFTDecision({observation:o2,decision_at:n-2000,state:'EVALUATED',
  evaluation:{score:76,scoreMode:'FULL'},source_hash:'e'.repeat(64),
  market_rows:[{source:'live',fixture_id:42,category:'over_under',bet_id:5,
   bet:'Over/Under',feed_bet_name:'Over/Under',bet_reference:{mapped_by:'BET_ID_REFERENCE',canonical_name:'Over/Under'},
   integrity:{valid:true},feed_status:{},values:v}],
  devices:[{device_slot:0,goal_estimate:{prob:73,n:0,source:'MODEL',basis:'MODEL'}}]});
 const q=await prepareFTPair(o2,d2,20000);
 const out2={...r,observation_id:o2.id};
 const result=await auditFTPairOutcomeRows([q],[out2]);
 assert.equal(result.valid_pairs,1);assert.equal(result.linked_count,1);
 assert.equal(result.market_evidence.verified_full_match_ou_quote_pairs,1);
 assert.equal(result.market_evidence.blocked_or_missing_quote_pairs,0);
 assert.equal(result.market_evidence.proven_model_final_total_distributions,0);
 assert.equal(result.market_evidence.priced_pairs,0);
 assert.equal(result.market_evidence.executable_quotes,0);
 assert.equal(result.roi,null);
});
await test('replay does not certify normalized quote when odds raw differs',async()=>{
 const v=[{value:'Over',handicap:2.5,odd:1.9,main:true},{value:'Under',handicap:2.5,odd:1.95,main:true}];
 const sourceO=structuredClone(o);sourceO.id='42:70:raw-different';
 sourceO.sources.odds={status:'OK',received_at:n-2900,source_at:null,
  data:[{fixture:{id:42},odds:[{id:5,name:'Over/Under',values:[{...v[0],odd:1.7},v[1]]}]}]};
 const d2=buildFTDecision({observation:sourceO,decision_at:n-2000,state:'EVALUATED',
  evaluation:{score:76,scoreMode:'FULL'},source_hash:'f'.repeat(64),
  market_rows:[{source:'live',fixture_id:42,category:'over_under',bet_id:5,
   bet:'Over/Under',feed_bet_name:'Over/Under',bet_reference:{mapped_by:'BET_ID_REFERENCE',canonical_name:'Over/Under'},
   integrity:{valid:true},feed_status:{},values:v}]});
 const q=await prepareFTPair(sourceO,d2,20000);
 const result=await auditFTPairOutcomeRows([q],[]);
 assert.equal(result.valid_pairs,1);
 assert.equal(result.market_evidence.verified_full_match_ou_quote_pairs,0);
 assert.equal(result.market_evidence.blocked_or_missing_quote_pairs,1);
 assert.equal(result.market_evidence.priced_pairs,0);
});
await test('missing outcome distinguished from model loss',async()=>{const x=await auditFTPairOutcomeRows([row],[]);assert.equal(x.linked_count,0);assert.equal(x.replay_counts.MISSING_OUTCOME,1)});
await test('outcome before decision excluded',async()=>{const bad={...r,observed_at:d.decision_at-1};const x=await auditFTPairOutcomeRows([row],[bad]);assert.equal(x.linked_count,0);assert.equal(x.replay_counts.INVALID_LINK,1)});
await test('invalid pair excluded from denominator',async()=>{const x=await auditFTPairOutcomeRows([{...row,content_hash:'x'}],[r]);assert.equal(x.valid_pairs,0);assert.equal(x.invalid_pairs,1)});
await test('conflicting outcomes at same time not chosen',async()=>{const x=await auditFTPairOutcomeRows([row],[r,{...r,score:{home:3,away:0}}]);assert.equal(x.replay_counts.CONFLICTING_OUTCOME,1);assert.equal(x.linked_count,0)});
await test('no claim that pair links imply model calibration',async()=>{const x=await auditFTPairOutcomeRows([row],[r]);assert.equal(x.calibration,null);assert.equal(x.accuracy,null)});
mkdirSync('ft-audit-output',{recursive:true});writeFileSync('ft-audit-output/ft-3e-pair-outcome-tests.json',JSON.stringify({status:'PASS',tests,provider:'mock',D1:'mock',production_writes:0},null,2));
