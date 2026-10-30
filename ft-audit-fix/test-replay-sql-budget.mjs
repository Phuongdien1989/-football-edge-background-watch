import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {FT_REPLAY_SQL_HARD_CAP,beginFTReplaySqlInvocation,ftReplaySqlRemaining,ftReplayQueryDB} from './replay-sql-budget.mjs';
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function owner(config={}){let calls=0;const db={prepare(){return {bind(){return {async first(){calls++;return {ok:true};},async all(){calls++;return {results:[]};},async run(){calls++;return {meta:{changes:1}};}};}};}};return {o:{env:{FT_REPLAY_DB:db,...config}},calls:()=>calls};}
test('disabled-independent default stays below 50 D1 query limit',()=>{const h=owner();assert.equal(beginFTReplaySqlInvocation(h.o).limit,24);assert.equal(FT_REPLAY_SQL_HARD_CAP,24);});
test('explicit smaller budget is honored',()=>{const h=owner({FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION:'2'});assert.equal(beginFTReplaySqlInvocation(h.o).limit,2);});
test('requested oversized budget is clamped',()=>{const h=owner({FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION:'999'});assert.equal(beginFTReplaySqlInvocation(h.o).limit,24);});
await (async()=>{const h=owner({FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION:'3'}),o=h.o;beginFTReplaySqlInvocation(o);const stmt=ftReplayQueryDB(o).prepare('SELECT').bind();await stmt.first();await stmt.all();await stmt.run();assert.equal(ftReplaySqlRemaining(o),0);assert.equal(h.calls(),3);await assert.rejects(stmt.first(),/FT_REPLAY_INVOCATION_SQL_LIMIT/);assert.equal(h.calls(),3);checks++;console.log('PASS shared SQL cap across methods');})();
await (async()=>{const h=owner({FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION:'1'}),o=h.o;beginFTReplaySqlInvocation(o);await ftReplayQueryDB(o).prepare('x').bind().first();await assert.rejects(ftReplayQueryDB(o).prepare('y').bind().first());beginFTReplaySqlInvocation(o);await ftReplayQueryDB(o).prepare('z').bind().first();assert.equal(h.calls(),2);checks++;console.log('PASS reset only on new invocation');})();
await (async()=>{const h=owner({FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION:'1'}),o=h.o;beginFTReplaySqlInvocation(o);const [a,b]=await Promise.allSettled([ftReplayQueryDB(o).prepare('x').bind().first(),ftReplayQueryDB(o).prepare('x').bind().first()]);assert.equal(a.status==='fulfilled'||b.status==='fulfilled',true);assert.equal([a,b].filter(x=>x.status==='fulfilled').length,1);assert.equal(h.calls(),1);checks++;console.log('PASS concurrent calls cannot overspend');})();
mkdirSync('ft-audit-output',{recursive:true});
writeFileSync('ft-audit-output/replay-sql-budget-tests.json',JSON.stringify({status:'PASS',checks,sidecar_query_hard_cap:FT_REPLAY_SQL_HARD_CAP,scope:'REPLAY_SQL_ONLY',total_invocation_certified:false,storage:'mock'},null,2));
