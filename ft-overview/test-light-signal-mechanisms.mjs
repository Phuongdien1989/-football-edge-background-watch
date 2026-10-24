import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSignalMechanism} from './light-signal-mechanisms.mjs';
import {patchMechanismTabs} from './patch-mechanism-tabs.mjs';
const orig=readFileSync('ui-tabs-preview/integrated.mjs','utf8');
const patched=patchMechanismTabs(orig);
assert.equal(patched.anchors,1);
assert(patched.code.includes("light-signal-mechanisms.mjs"));
assert.throws(()=>patchMechanismTabs(patched.code),/MECHANISMS_ALREADY_PATCHED/);
const obs={at:Date.now(),status:'2H',minute:68,home:'A & B',away:'C < D',goals:{home:1,away:0},metrics:{shots:11,sot:5,xg:null}};
const fixture={id:123,masterRank:1,masterPrimary:'ht',signals:{ht:{engine:'ht',observation:obs,score:72,state:'WATCH',freshness:'CURRENT',source:'LEGACY',reason:'Sample source reason'},ft:{engine:'ft',observation:obs,score:56,state:'WAIT',freshness:'CURRENT'},hc:{engine:'hc',observation:obs,gap:0.3,state:'WATCH',freshness:'CURRENT'},valuation:{engine:'valuation',observation:obs,line:2.5,odds:1.9,fairOdds:1.8,ev:.05,modelOK:true,state:'TRIAL',freshness:'CURRENT'}}};
const props={rows:[fixture],chosen:fixture,fixture:123,packet:{},route:(a,id)=>'#fe-tabs/'+a+(id?'/'+id:''),displayAction:()=> 'Chờ xác nhận nguồn'};
for(const tab of ['overview','ht','ft','hc','valuation']){
 const html=renderSignalMechanism({...props,tab});
 assert(html.includes('fe-lsp-layout'));
 assert(html.includes('A &amp; B')&&html.includes('C &lt; D'));
 assert(html.includes('Chờ xác nhận nguồn'));
 assert(!html.includes('78%'));
}
assert(renderSignalMechanism({...props,tab:'ft',rows:[],chosen:null,fixture:null}).includes('Chưa có tín hiệu'));
console.log('LIGHT_SIGNAL_ALL_MECHANISMS_PASS');