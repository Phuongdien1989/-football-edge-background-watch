import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
const root='mobile-sports-premium';
const adapter=readFileSync(root+'/source/premium.js','utf8');
const css=readFileSync(root+'/source/premium.css','utf8');
const engine=process.env.FE_SP_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const page=await context.newPage(),requests=[],errors=[];
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('about:blank');
 await page.setContent('<div id="appTop"></div><div id="matches"></div><a class="bottom-item" href="#analysisCard">DEEP</a>');
 await page.addStyleTag({content:css});
 await page.evaluate(()=>{
   history.replaceState(null,'','?mode=connected');
 }).catch(()=>{});
 // about:blank cannot set a URL query. Select connected mode only in this isolated adapter fixture.
 await page.evaluate(()=>{
  const make=(id,top,engine)=>({id,home:'Nhà '+id,away:'Khách rất dài '+id,league:'Contract',latest:{latest:{fresh_at:Date.now(),minute:67,status:'2H',goals:{home:0,away:0}}},__rank:{top,primary:{dq:4,engine}},__addon:{entry:{status:'WATCH'}}});
  window.testRows=[make(104,4,'HC'),make(102,2,'FT'),make(106,null,'FT'),make(101,1,'H1'),make(105,5,'FT'),make(103,3,'HC')];
  window.FEAddonBridge={masterRows:()=>structuredClone(window.testRows)};
  window.FEUIReadBridge={read:()=>({state:{fixtures:[]}})};
  window.FE_SP_NATIVE={selectById:id=>{window.selectedFixture=id;return true}};
 });
 await page.addScriptTag({content:adapter.replace("const liveMode=mode==='connected';","const liveMode=true;")});
 const ids=()=>page.locator('#spRankRows [data-sp-open]').evaluateAll(es=>es.map(e=>Number(e.dataset.spOpen)));
 assert.deepEqual(await ids(),[101,102,103,104,105]);
 assert.equal(await page.locator('#spRankRows [data-sp-open="106"]').count(),0);
 assert.match(await page.locator('#spRankRows').innerText(),/H1 \/ HT/);
 assert.match(await page.locator('#spRankRows').innerText(),/FT/);
 assert.match(await page.locator('#spRankRows').innerText(),/HC/);
 // Engine swaps rank 1 and 5. Presentation must follow native rank, never calculate its own.
 await page.evaluate(()=>{for(const x of testRows){if(x.id===101)x.__rank.top=5;if(x.id===105)x.__rank.top=1}document.querySelector('#matches').textContent='tick 1'});
 await page.waitForFunction(()=>document.querySelector('#spRankRows [data-sp-rank="1"]').dataset.spOpen==='105');
 assert.deepEqual(await ids(),[105,102,103,104,101]);
 assert.equal(await page.locator('#spRankRows [data-sp-open="105"] .sp-rank-up').innerText(),'↑ 4');
 assert.equal(await page.locator('#spRankRows [data-sp-open="101"] .sp-rank-down').innerText(),'↓ 4');
 assert.match(await page.locator('#spTopContent').innerText(),/Nhà 105/);
 // Remove rank 3: preserve empty slot and native numbers, don't promote or invent a candidate.
 await page.evaluate(()=>{testRows=testRows.filter(x=>x.id!==103);document.querySelector('#matches').textContent='tick 2'});
 await page.waitForFunction(()=>document.querySelector('#spRankCount').textContent==='4/5 trận');
 assert.deepEqual(await ids(),[105,102,104,101]);
 assert.match(await page.locator('.sp-rank-empty').innerText(),/TOP 3/);
 assert.equal(await page.locator('#spRankRows [data-sp-open="105"] .sp-rank-up').innerText(),'↑ 4');
 await page.locator('#spRankRows [data-sp-open="104"]').click();
 assert.equal(await page.evaluate(()=>window.selectedFixture),104);
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  mkdirSync(root+'/screenshots',{recursive:true});
  await page.screenshot({path:root+'/screenshots/top-five-'+(engine===webkit?'webkit':'chromium')+'-'+width+'.png',fullPage:true});
 }
 assert.equal(requests.length,0);assert.deepEqual(errors,[]);
 console.log('TOP_FIVE_PASS',JSON.stringify({engine:engine===webkit?'webkit':'chromium',nativeRankOrder:true,rankSwap:true,emptySlot:true,noInventedCandidates:true,zeroScore:true,nativeSelection:true,extraRequests:requests.length}));
 await context.close();
}finally{await browser.close()}
