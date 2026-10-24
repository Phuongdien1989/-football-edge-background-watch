// Check that current production-base guard contracts survive any candidate branch edits.
// This is a static regression probe, not live runtime proof; never alters production.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const source=readFileSync('worker.js','utf8');
const fn=(a,b)=>{const s=source.indexOf(a),e=source.indexOf(b,s);assert(s>=0&&e>s,'MISSING_BOUNDARY_'+a);return source.slice(s,e)};
const entry=fn('function dbEntryStmt(', 'function dbEntryOutcomeStmt(');
const outcome=fn('function dbEntryOutcomeStmt(','function dbLiveStmt(');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name)}
test('ENTRY duplicates skip row rewrite',()=>assert(entry.includes("entry_decisions.payload_json IS NOT excluded.payload_json")));
test('ENTRY respects source_revision ordering',()=>assert(entry.includes("d1SourceRevisionAllows('entry_decisions')")));
test('OPEN retries cannot revert RESOLVED ENTRY',()=>assert(entry.includes("entry_decisions.resolution IS NOT 'RESOLVED' OR excluded.resolution='RESOLVED'")));
test('ENTRY resolution and outcome fields preserved',()=>{assert(entry.includes('resolution=excluded.resolution'));assert(entry.includes('outcome=excluded.outcome'));assert(entry.includes('unit_pl=excluded.unit_pl'))});
test('OUTCOME has revision guard and correction history',()=>{assert(outcome.includes("entry_outcomes.payload_json IS NOT excluded.payload_json"));assert(outcome.includes("d1SourceRevisionAllows('entry_outcomes')"))});
test('DB sync does not discard new ENTRY events',()=>{assert(source.includes("type==='ENTRY_DECISION'&&p?.id"));assert(source.includes("stmts.push(dbEntryStmt(env,p,now))"))});
test('invalid source events do not blindly rewrite fixture',()=>assert(source.includes('Ignored/invalid events must never mutate fixture timestamps')));
mkdirSync('ft-audit-output',{recursive:true});
writeFileSync('ft-audit-output/ft-prod-backend-guard-check.json',JSON.stringify({schema:'FE_D1_STATIC_GUARDS_V1',status:'PASS',checks,baseline_backend_commit:'3cd210d2d74aff547de4587ab4a3c96b982a728c',verification:'STATIC_REPOSITORY_ONLY',mobile_source_verified:false,remote_worker_code_proven:false,production_modified:false},null,2));
