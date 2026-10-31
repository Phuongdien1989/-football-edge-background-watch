// Lazy official PRE tab. Reads existing bridges; no collection, Push or D1 writes.
import {fromCachedBundles,confirmFixtureQuotes} from './data.mjs';
let app=null,opening=false,root=null,seed=null,workerUrl=null;
async function show(){if(document.body.dataset.feTabsTab!=='prematch'||opening)return;const node=document.getElementById('fePrematchOfficial');if(!node||root===node)return;opening=true;
 try{app?.destroy();const [{mount},response]=await Promise.all([import('../prematch-ai/view.mjs'),fetch(new URL('./seed.json',import.meta.url),{cache:'no-cache'})]);if(!response.ok)throw Error('PRE_SEED_UNAVAILABLE');seed=await response.json();if(document.body.dataset.feTabsTab!=='prematch')return;
 root=node;app=mount(node,{production:true,workerFactory:()=>new Worker(new URL('../prematch-ai/worker.mjs',import.meta.url),{type:'module'})});
 const controls=document.createElement('div');controls.className='pm-tools';controls.innerHTML='<button type="button" class="pm-btn primary" data-pm-refresh>Đọc dữ liệu đang có</button><button type="button" class="pm-btn" data-pm-confirm>Đã đối chiếu kỳ kèo & giá</button><span class="pm-inline-note">Giá chỉ đọc từ PRE/DEEP đã mở. Không tải thêm API. Xác nhận đúng kỳ HT/FT, không tính hiệp phụ. Hiệu lực tối đa 5 phút, đóng trước kickoff.</span>';node.querySelector('.pm-tools').before(controls);
 let input=fromCachedBundles(window.FEPreMatchReadBridge?.read?.()||window.FEOverviewInputBridge?.read?.()||[],seed);
 controls.querySelector('[data-pm-refresh]').onclick=()=>{input=fromCachedBundles(window.FEPreMatchReadBridge?.read?.()||window.FEOverviewInputBridge?.read?.()||[],seed);app.load(input);};
 controls.querySelector('[data-pm-confirm]').onclick=()=>{try{const r=app.getResult(),id=Number(node.querySelector('[data-pm-fixture]')?.dataset.pmFixture)||r?.rows?.[0]?.fixture.id;input=confirmFixtureQuotes(input,id);app.load(input);}catch(e){node.querySelector('.pm-state').textContent=String(e.message);}};
 await app.load(input);
 }catch(e){if(node)node.textContent='PRE-MATCH đang chờ dữ liệu: '+String(e.message);}finally{opening=false;}}
function route(){if(!location.hash.startsWith('#fe-tabs/prematch')){app?.destroy();app=null;root=null;}else show();}
window.addEventListener('fe-prematch-tab-open',show);window.addEventListener('hashchange',()=>queueMicrotask(route));window.addEventListener('pagehide',()=>{app?.destroy();});
if(document.body.dataset.feTabsTab==='prematch')show();
