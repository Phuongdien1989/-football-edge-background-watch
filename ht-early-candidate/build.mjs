import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createHTTemporal} from './temporal.mjs';
const original=process.argv[2]||'ft-overview/frozen-original-mobile.html';
const backendPath=process.argv[3]||'notify-core-h1.js';
execFileSync(process.execPath,['ui-tabs-preview/build-integrated.mjs',original],{stdio:'pipe'});
const mobile=readFileSync('ui-tabs-preview/generated/candidate/index.html','utf8');
const backend=readFileSync(backendPath,'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(hash(mobile),'88a4a49e62fe6c6ce37445d00457d728de1c1ee55a4bc8e8b1359994ea9f3bdc','MOBILE_BASELINE_DRIFT');
assert.equal(blob(backend),'c3e364aaee870468bc6b2d0f63ccdc833ba06cdd','BACKEND_HT_BASELINE_DRIFT');
// Both sources use top-level named functions with uniform indentation.
export function extract(source,name,indent='') {
  const token=indent+'function '+name+'(';
  const start=source.indexOf(token);assert(start>=0,'MISSING_'+name);
  const next=['\n'+indent+'function ','\n'+indent+'async function ','\nexport function '].map(t=>source.indexOf(t,start+token.length)).filter(n=>n>=0);
  return source.slice(start,next.length?Math.min(...next):source.length);
}
function patch(source,isMobile) {
  let out=source;const changes=[];
  const replace=(before,after)=>{assert.equal(out.split(before).length,2,'PATCH_NOT_UNIQUE');out=out.replace(before,after);changes.push({before,after});};
  const names={FindBaseline:'findBaseline',Window:'windowFor',HistoryAge:'historyAge',DisplayWindow:'displayWindow',Momentum:'momentum',QualityScore:'qualityScore'};
  for(const [suffix,method] of Object.entries(names)) {
    const name=isMobile?'h1Watch'+suffix:method,indent=isMobile?'  ':'';
    const old=extract(source,name,indent);
    const args=old.match(/function \w+\(([^)]*)\)/)[1];
    // Keep any comments/trailing whitespace outside the function untouched.
    const end=old.lastIndexOf('}')+1;
    replace(old.slice(0,end),`${indent}function ${name}(${args}){return HTTemporal.${method}(${args});}`);
  }
  const marker=isMobile?'  function h1WatchFindBaseline(':'function findBaseline(';
  const injection=isMobile?'  const HTTemporal=('+createHTTemporal.toString()+')();\n':"const HTTemporal=createHTTemporal();\n";
  replace(marker,injection+marker);
  if(!isMobile)replace("import {createEngine as createBaseEngine} from './notify-core.js';","import {createEngine as createBaseEngine} from '../../../notify-core.js';\nimport {createHTTemporal} from '../../temporal.mjs';");
  const oldEval=extract(out,'h1WatchEvaluate',isMobile?'  ':'');
  const newEval=oldEval.replace('return {score,rawScore,','return {h1_temporal:true,accelValid:mom.accelValid,accelKind:mom.accelKind,score,rawScore,');
  assert.notEqual(oldEval,newEval);replace(oldEval,newEval);
  if(isMobile)replace('  function qsigTrend(e){','  function qsigTrend(e){\n    if(e?.h1_temporal)return HTTemporal.trend(e);');
  // Reverse every exact scoped patch to prove that the rest of each file is unchanged.
  let restored=out;
  for(const {before,after} of [...changes].reverse()){assert.equal(restored.split(after).length,2);restored=restored.replace(after,before);}
  assert.equal(restored,source,'OUT_OF_SCOPE_CHANGE');
  return {out,patches:changes.map(({before,after})=>({before_sha256:hash(before),after_sha256:hash(after)}))};
}
const m=patch(mobile,true),b=patch(backend,false);
mkdirSync('ht-early-candidate/generated/backend',{recursive:true});
writeFileSync('ht-early-candidate/generated/index.html',m.out);
writeFileSync('ht-early-candidate/generated/backend/notify-core-h1.js',b.out);
const report={status:'PASS',candidate_only:true,production_deployed:false,baseline_commit:'c929b091e448fd99d751360705fc29a488e7fbf3',mobile_baseline_sha256:hash(mobile),backend_baseline_blob:blob(backend),mobile_candidate_sha256:hash(m.out),backend_candidate_sha256:hash(b.out),shared_factory_sha256:hash(createHTTemporal.toString()),exact_scope_reconstruction:true,mobile_patches:m.patches,backend_patches:b.patches};
writeFileSync('ht-early-candidate/generated/build-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,candidate_only:true,exact_scope_reconstruction:true}));
