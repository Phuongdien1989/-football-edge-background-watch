import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p));
for(const [dir,field] of [['mechanism-release','candidate'],['mechanism-mobile','candidate']]){
 const old=read('passed-candidate/'+dir+'/manifest.json'),current=read(dir+'/manifest.json');
 assert.equal(old.source_commit,'14a657582fd8e733465401d877b1fa2f557634bd');assert.deepEqual(current[field],old[field],'TESTED_RUNTIME_BYTES_CHANGED_'+dir);
}
const qa=read('passed-candidate/mechanism-mobile/qa/candidate/report.json');assert.equal(qa.status,'PASS');assert.equal(qa.results.length,4);assert(qa.results.every(r=>r.status==='PASS'));
const controls=read('passed-candidate/mechanism-mobile/qa/candidate/scan-controls-report.json');assert.equal(controls.status,'PASS');assert.equal(controls.results.length,4);
const prefs=read('passed-candidate/mechanism-mobile/qa/candidate/preferences-report.json');assert.equal(prefs.length,3);assert(prefs.every(r=>r.status==='PASS'));
const result={status:'PASS',reused_run:41025635463,reused_commit:'14a657582fd8e733465401d877b1fa2f557634bd',backend_and_all_54_mobile_assets_byte_identical:true,change_scope:'release orchestration only; immutable version upload then explicit deployment',candidate_tests_not_repeated:true};
writeFileSync('mechanism-release/reused-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
