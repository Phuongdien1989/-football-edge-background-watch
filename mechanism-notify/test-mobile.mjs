import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('mechanism-mobile/site/index.html','utf8');
const ids=['fePushHTEnabled','fePushFTOverviewEnabled','fePushFTV2Enabled','fePushGoalEnabled','fePushGapEnabled','fePushGoalThreshold','fePushGapThreshold'];
const nodes=Object.fromEntries(ids.map(id=>[id,{checked:true,value:'60'}]));const calls=[],data=new Map();
const context={console,$:id=>nodes[id],fePushGoalEnabled:nodes.fePushGoalEnabled,fePushGapEnabled:nodes.fePushGapEnabled,fePushGoalThreshold:nodes.fePushGoalThreshold,fePushGapThreshold:nodes.fePushGapThreshold,FE_PUSH_P02:{prefsKey:'TEST_PREFS',deviceKey:'TEST_DEVICE',deviceId:'a'.repeat(64)},localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},bgRequest:async(p,o)=>{calls.push({path:p,body:o.body});return {ok:true};},fePushSet:()=>{}};
vm.createContext(context);
for(const name of ['fePushClamp','fePushPrefs','fePushPrefsLoad','fePushPrefsSaveLocal','fePushSave']){
 const pattern=new RegExp('  (?:async )?function '+name+'\\('),start=html.search(pattern);assert(start>=0,name);
 const end=html.indexOf('\n  }',start);new vm.Script(html.slice(start,end+4)).runInContext(context);
}
let p=context.fePushPrefs();assert.equal(p.h1,true);assert.equal(p.ftOverview,true);assert.equal(p.ftV2,true);assert.equal(p.goalThreshold,60);
nodes.fePushHTEnabled.checked=false;nodes.fePushFTOverviewEnabled.checked=false;nodes.fePushGoalEnabled.checked=false;
await context.fePushSave();assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/notify/settings');assert.equal(calls[0].body.prefs.h1,false);assert.equal(calls[0].body.prefs.ftV2,true);assert.equal(calls[0].body.prefs.goal,false);assert.equal(calls[0].body.prefs.gapThreshold,60);
nodes.fePushHTEnabled.checked=true;context.fePushPrefsLoad();assert.equal(nodes.fePushHTEnabled.checked,false);
for(const id of ids)assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,id);
assert(html.includes('chưa phải khuyến nghị giá'));assert(!html.includes('Worker chỉ báo khi tín hiệu cắt lên ngưỡng;'));
console.log(JSON.stringify({status:'PASS',cases:7,newAPIRequests:0,independentMechanismPreferences:true}));
