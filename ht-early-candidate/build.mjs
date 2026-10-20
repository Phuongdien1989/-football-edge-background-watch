import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createHTTemporal} from './temporal.mjs';
import {createHTCollection} from './collection.mjs';
import * as mobileCollection from './mobile-collection.mjs';
const original=process.argv[2]||'ft-overview/frozen-original-mobile.html';
const backendPath=process.argv[3]||'notify-core-h1.js';
const workerPath=process.argv[4]||'worker_notify_v130.js';
execFileSync(process.execPath,['ui-tabs-preview/build-integrated.mjs',original],{stdio:'pipe'});
const mobile=readFileSync('ui-tabs-preview/generated/candidate/index.html','utf8');
const backend=readFileSync(backendPath,'utf8');
const worker=readFileSync(workerPath,'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(hash(mobile),'88a4a49e62fe6c6ce37445d00457d728de1c1ee55a4bc8e8b1359994ea9f3bdc','MOBILE_BASELINE_DRIFT');
assert.equal(blob(backend),'c3e364aaee870468bc6b2d0f63ccdc833ba06cdd','BACKEND_HT_BASELINE_DRIFT');
assert.equal(blob(worker),'013e7b05d394a9d4544cfe2d9d8cbec5817e6e93','BACKEND_COLLECTOR_BASELINE_DRIFT');
// Both sources use top-level named functions with uniform indentation.
export function extract(source,name,indent='') {
  const token=source.includes(indent+'async function '+name+'(')?indent+'async function '+name+'(':indent+'function '+name+'(';
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
  const injection=isMobile?'  const HTTemporal=('+createHTTemporal.toString()+')();\n  const HTCollection=('+createHTCollection.toString()+')();\n  const H1_COLLECTION={pool:new Map(),generation:0};\n'+mobileCollection.fetchH1CollectionSnapshot.toString()+'\n':"const HTTemporal=createHTTemporal();\nconst HTCollection=createHTCollection();\n";
  replace(marker,injection+marker);
  if(!isMobile)replace("import {createEngine as createBaseEngine} from './notify-core.js';","import {createEngine as createBaseEngine} from '../../../notify-core.js';\nimport {createHTTemporal} from '../../temporal.mjs';\nimport {createHTCollection} from '../../collection.mjs';");
  const oldEval=extract(out,'h1WatchEvaluate',isMobile?'  ':'');
  const newEval=oldEval.replace('h1WatchEvaluate(item,s){','h1WatchEvaluate(item,s){\n    if(HTCollection.isEarly(s))return HTCollection.earlyEvaluation(item,s,HTTemporal);').replace('return {score,rawScore,','return {h1_temporal:true,accelValid:mom.accelValid,accelKind:mom.accelKind,score,rawScore,');
  assert.notEqual(oldEval,newEval);replace(oldEval,newEval);
  if(isMobile)replace('  function qsigTrend(e){','  function qsigTrend(e){\n    if(e?.h1_temporal)return HTTemporal.trend(e);');
  if(isMobile) {
    const oldEligible=extract(out,'h1WatchEligible','  ');
    replace(oldEligible.slice(0,oldEligible.lastIndexOf('}')+1),'  function h1WatchEligible(f){return feLiveSourceValid(f)&&HTCollection.eligible(f);}');
    for(const name of ['startH1Watch','refreshH1Watch','scheduleH1Watch','stopH1Watch']) {
      const old=extract(out,name,'  ');replace(old.slice(0,old.lastIndexOf('}')+1),'  '+mobileCollection[name].toString());
    }
    replace('  function h1WatchApplyState(item,s,ev){','  function h1WatchApplyState(item,s,ev){\n    if(HTCollection.isEarly(s)){item.state="BASELINE";item.reason="EARLY OBSERVATION • đang tích lũy HT • chưa định giá kèo";return;}');
    replace('Engine nhận trận 1H khoảng phút 20–45.','Bật HT để tích lũy từ đầu hiệp; chưa có dữ liệu thì tiếp tục theo dõi LIVE.');
  }
  // Reverse every exact scoped patch to prove that the rest of each file is unchanged.
  let restored=out;
  for(const {before,after} of [...changes].reverse()){assert.equal(restored.split(after).length,2);restored=restored.replace(after,before);}
  assert.equal(restored,source,'OUT_OF_SCOPE_CHANGE');
  return {out,patches:changes.map(({before,after})=>({before_sha256:hash(before),after_sha256:hash(after)}))};
}
function patchWorker(source) {
  let out=source;const changes=[];
  const replace=(before,after)=>{assert.equal(out.split(before).length,2,'WORKER_PATCH_NOT_UNIQUE');out=out.replace(before,after);changes.push({before,after});};
  replace("import base,{BackgroundWatcher as DeepLinkWatcher} from './worker_notify_v128.js';","import base,{BackgroundWatcher as DeepLinkWatcher} from '../../../worker_notify_v128.js';\nimport {createHTCollection} from '../../collection.mjs';\nconst HTCollection=createHTCollection();");
  replace("import {crossing} from './worker_notify.js';","import {crossing} from '../../../worker_notify.js';");
  replace('  async notifyTick(){','  async notifyTick(){\n    if(typeof this.scanControl!=="function"||(await this.scanControl())?.enabled!==true)return;');
  replace("const h1Route=['1H','LIVE'].includes(s.status)&&Number(s.minute)>=20&&Number(s.minute)<=45;","const h1Route=HTCollection.eligible(f);");
  replace('item.h1History=item.h1History.filter(x=>stamp-x.captured_at<=1800000).concat(slim).slice(-40);','item.h1History=item.h1History.filter(x=>stamp-x.captured_at<=1800000).concat({...slim,status:s.status,fresh_at:stamp}).slice(-40);');
  replace('if(!item.h1CooldownUntil||stamp>=item.h1CooldownUntil)status.mechanisms.h1++;','if(h1Eval.scoreMode==="EARLY_EVIDENCE")status.mechanisms.h1Early=(status.mechanisms.h1Early||0)+1;else if(!item.h1CooldownUntil||stamp>=item.h1CooldownUntil)status.mechanisms.h1++;');
  replace('status.signalEligible+=Number(!!h1Eval)+Number(s.status===\'2H\')+Number(hcReady);','status.signalEligible+=Number(!!h1Eval&&h1Eval.scoreMode!=="EARLY_EVIDENCE")+Number(s.status===\'2H\')+Number(hcReady);');
  let restored=out;for(const {before,after} of [...changes].reverse())restored=restored.replace(after,before);
  assert.equal(restored,source,'OUT_OF_SCOPE_WORKER_CHANGE');
  return {out,patches:changes.map(({before,after})=>({before_sha256:hash(before),after_sha256:hash(after)}))};
}
const m=patch(mobile,true),b=patch(backend,false),w=patchWorker(worker);
mkdirSync('ht-early-candidate/generated/backend',{recursive:true});
writeFileSync('ht-early-candidate/generated/index.html',m.out);
writeFileSync('ht-early-candidate/generated/backend/notify-core-h1.js',b.out);
writeFileSync('ht-early-candidate/generated/backend/worker_notify_v130.js',w.out);
const report={status:'PASS',candidate_only:true,production_deployed:false,baseline_commit:'c929b091e448fd99d751360705fc29a488e7fbf3',mobile_baseline_sha256:hash(mobile),backend_baseline_blob:blob(backend),worker_baseline_blob:blob(worker),mobile_candidate_sha256:hash(m.out),backend_candidate_sha256:hash(b.out),worker_candidate_sha256:hash(w.out),shared_factory_sha256:hash(createHTTemporal.toString()),collection_factory_sha256:hash(createHTCollection.toString()),exact_scope_reconstruction:true,mobile_patches:m.patches,backend_patches:b.patches,worker_patches:w.patches};
writeFileSync('ht-early-candidate/generated/build-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,candidate_only:true,exact_scope_reconstruction:true}));
