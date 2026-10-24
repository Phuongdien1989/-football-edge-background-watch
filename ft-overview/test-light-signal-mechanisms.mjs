import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSignalMechanism} from './light-signal-mechanisms.mjs';
import {patchMechanismTabs} from './patch-mechanism-tabs.mjs';
const orig=readFileSync('ui-tabs-preview/integrated.mjs','utf8');
const installed="import {renderSignalMechanism} from '../ft-ai-v2/light-signal-mechanisms.mjs';\n"+orig.replace(' html+=\'<div class="ftabs-note">Cùng dữ liệu nguồn và kết luận của từng cơ chế. Chuyển tab không gọi quét, không thay Smart Follow.</div>\';',' html+=\'<div class="ftabs-note">Cùng dữ liệu nguồn và kết luận của từng cơ chế. Chuyển tab không gọi quét, không thay Smart Follow.</div>\';\n html=renderSignalMechanism({tab:current,rows,chosen,fixture,packet,route,displayAction});');
const patched=patchMechanismTabs((installed+"document.body.dataset.feTabsTools='false';render();requestAnimationFrame(").replace('if(body.innerHTML!==shell)', '/* FE_TAB_PERF_V2 */if(body.innerHTML!==shell)'));
assert.equal(patched.anchors,1);
assert(patched.code.includes('FE_TAB_PERF_V2'));
assert(patched.code.includes("tab==='ht'?'true':'false'"));
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