import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runFTOutcomePass,OUTCOME_BUDGET_KEY} from './outcome-pass.mjs';
import {auditFTReplay} from './replay-coverage.mjs';
import {buildFTObservation} from './observation.mjs';
import {buildFTDecision} from './decision-trace.mjs';
import {resolveFTOutcome} from './outcome.mjs';
const now=Date.now(),f=(id=42,status='FT')=>({fixture:{id,status:{short:status}},goals:{home:2,away:0},score:{fulltime:{home:2,away:0}}});
const obs=(id='a',fixture_id=42)=>buildFTObservation({id,fixture_id,decision_at:now-100,fixture:f(fixture_id,'2H')});
function harness({reply=[f()],enabled=true,scanner=true,fail=false,budget=true}={}){
 const memory=new Map(),rows=new Map();let api=0,sql=0,doPuts=0,tail=Promise.resolve();
 if(budget)memory.set(OUTCOME_BUDGET_KEY,{start:now-1000,end:now+100000,max_calls:10,used:0});
 const storage={get:async k=>memory.get(k),put:async(k,v)=>{doPuts++;memory.set(k,structuredClone(v));},transaction(fn){const p=tail.then(()=>fn(storage));tail=p.catch(()=>{});return p;}};
 const db={prepare(q){return {bind(...a){return {async first(){sql++;return q.startsWith('UPDATE ft_replay_budget_v1')?{used_records:1}:rows.get(a[0])||null;},async run(){sql++;rows.set(a[0],{content_hash:a[5]});return {meta:{changes:1}};}};}};}};
 function owner(){return {env:{FT_OUTCOME_TRIAL_ENABLED:enabled?'true':'false',FT_REPLAY_TRIAL_ENABLED:'true',FT_REPLAY_TRIAL_EPOCH:'test',FT_REPLAY_TRIAL_MAX_RECORD_BYTES:'20000',FT_REPLAY_DB:db,FT_OUTCOME_TRIAL_MAX_OBSERVATIONS:'10',FT_OUTCOME_TRIAL_MAX_FIXTURES:'3',FT_OUTCOME_TRIAL_MAX_WRITES:'10',FT_OUTCOME_TRIAL_RETRY_MS:'1000',FT_OUTCOME_TRIAL_MAX_ATTEMPTS:'3'},ctx:{storage},scanControl:async()=>({enabled:scanner}),api:async(path,args,strict)=>{api++;assert.equal(path,'/fixtures');assert.equal(args.id,42);assert.equal(strict,true);if(fail)throw Error('provider');return reply;}};}
 return {owner,memory,rows,metrics:()=>({api,sql,doPuts})};
}
const run=(o,rows)=>runFTOutcomePass(o,rows,{clock:()=>now});
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
await test('pair mode refuses unsupported outcome path before provider',async()=>{const h=harness(),o=h.owner();o.env.FT_REPLAY_PAIR_TRIAL_ENABLED='true';assert.equal((await run(o,[obs()])).status,'PAIR_OUTCOME_NOT_WIRED');assert.equal(h.metrics().api,0);});
await test('disabled does no I/O',async()=>{const h=harness({enabled:false});assert.equal((await run(h.owner(),[obs()])).status,'DISABLED');assert.deepEqual(h.metrics(),{api:0,sql:0,doPuts:0});});
await test('scanner off prevents result fetch',async()=>{const h=harness({scanner:false});assert.equal((await run(h.owner(),[obs()])).status,'SCANNER_OFF');assert.equal(h.metrics().api,0);});
await test('insufficient SQL room prevents provider fetch',async()=>{const h=harness(),o=h.owner();o.env.FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION='3';const r=await run(o,[obs()]);assert.equal(r.status,'SQL_LIMIT_DEFERRED');assert.deepEqual(h.metrics(),{api:0,sql:0,doPuts:0});});
await test('one fixture fetch fans out to two observations',async()=>{const h=harness(),r=await run(h.owner(),[obs('a'),obs('b')]);assert.equal(r.api_calls,1);assert.equal(h.rows.size,2);assert.equal(h.metrics().sql,8);assert.equal(h.metrics().doPuts,3);});
await test('duplicate observation in batch not double written',async()=>{const h=harness();await run(h.owner(),[obs(),obs()]);assert.equal(h.rows.size,1);assert.equal(h.metrics().sql,4);});
await test('new instance respects reserved retry delay',async()=>{const h=harness();await run(h.owner(),[obs()]);const r=await run(h.owner(),[obs()]);assert.equal(r.results[0].status,'NOT_DUE');assert.equal(h.metrics().api,1);});
await test('concurrent passes cannot reserve same fixture twice',async()=>{const h=harness();await Promise.all([run(h.owner(),[obs()]),run(h.owner(),[obs()])]);assert.equal(h.metrics().api,1);});
await test('fetch error consumes reservation and waits',async()=>{const h=harness({fail:true});assert.equal((await run(h.owner(),[obs()])).results[0].status,'FETCH_ERROR');assert.equal((await run(h.owner(),[obs()])).results[0].status,'NOT_DUE');assert.equal(h.memory.get(OUTCOME_BUDGET_KEY).used,1);});
await test('missing API budget never fetches',async()=>{const h=harness({budget:false});assert.equal((await run(h.owner(),[obs()])).results[0].status,'API_BUDGET_DENIED');assert.equal(h.metrics().api,0);});
await test('empty or wrong fixture cannot resolve',async()=>{for(const reply of [[],[f(43)]]){const h=harness({reply});assert.equal((await run(h.owner(),[obs()])).results[0].status,'RESULT_UNCONFIRMED');assert.equal(h.metrics().sql,0);}});
await test('ongoing fixture stays pending without D1 write',async()=>{const h=harness({reply:[f(42,'2H')]});assert.equal((await run(h.owner(),[obs()])).results[0].state,'PENDING');assert.equal(h.metrics().sql,0);});
await test('write fanout cap is explicit',async()=>{const h=harness(),o=h.owner();o.env.FT_OUTCOME_TRIAL_MAX_WRITES='1';const r=await run(o,[obs('a'),obs('b')]);assert.equal(h.rows.size,1);assert.equal(r.results[1].status,'DEFERRED_WRITE');});
const observation=obs(),decision=buildFTDecision({observation,decision_at:now-90,state:'NOT_EVALUATED',reason:'STATS_UNAVAILABLE',source_hash:'a'.repeat(64)}),outcome=resolveFTOutcome(observation,f(),now,now);
await test('linked no-recommendation row is retained, no fake accuracy',()=>{const r=auditFTReplay([observation,decision,outcome]);assert.equal(r.counts.LINKED,1);assert.equal(r.results[0].decision_state,'NOT_EVALUATED');assert.equal(r.accuracy,null);});
await test('missing decisions and outcomes are separate',()=>{assert.equal(auditFTReplay([observation,outcome]).counts.MISSING_DECISION,1);assert.equal(auditFTReplay([observation,decision]).counts.MISSING_OUTCOME,1);});
await test('orphan and invalid chronology excluded',()=>{assert.equal(auditFTReplay([outcome]).counts.ORPHAN_RECORD,1);assert.equal(auditFTReplay([observation,decision,{...outcome,observed_at:now-95}]).counts.INVALID_LINK,1);});
await test('same-time conflicting scores not silently chosen',()=>{assert.equal(auditFTReplay([observation,decision,outcome,{...outcome,score:{home:3,away:0}}]).counts.CONFLICTING_OUTCOME,1);});
await test('later correction used without deleting revision count',()=>{const r=auditFTReplay([observation,decision,outcome,{...outcome,observed_at:now+1,resolved_at:now+1,score:{home:1,away:0}}]);assert.equal(r.results[0].score.home,1);assert.equal(r.results[0].outcome_revisions,2);});
mkdirSync('ft-audit-output',{recursive:true});writeFileSync('ft-audit-output/outcome-pass-tests.json',JSON.stringify({status:'PASS',checks,provider:'mock',D1:'mock',DO_transaction:'serialized mock, not remote atomicity proof'},null,2));
