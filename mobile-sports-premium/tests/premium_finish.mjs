import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import http from 'node:http';
const root='mobile-sports-premium';
const html=readFileSync(root+'/site/index.html','utf8');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});const results=[];
mkdirSync(root+'/screenshots',{recursive:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const page=await ctx.newPage();const requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(origin))requests.push(r.url().split('?')[0])});
 await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await page.goto(origin+'/?mode=demo');
 await page.waitForFunction(()=>window.__FE_SP_DIAGNOSTICS__?.read()?.rows===4);
 assert.match(await page.locator('.sp-metric').first().innerText(),/4\.3\s*\/\s*5/);
 assert.match(await page.locator('#spStats').innerText(),/Sút trúng đích/);
 assert.match(await page.locator('#spStats').innerText(),/58%/);
 assert.equal(await page.locator('#spScan').isEnabled(),false);
 assert.ok((await page.locator('.sp-cta').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)))>=16);
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:root+'/screenshots/premium_v3_'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:844,height:390});
 assert.equal(await page.locator('#feSportsPremium').isVisible(),false);
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.querySelectorAll('#spRows button').length===3);
 assert.equal(await page.locator('#feSportsPremium').isVisible(),true);
 // Native Home uses preventDefault (no history entry); test explicit hash navigation separately.
 await page.locator('.bottom-item[href="#connectCard"]').click();
 assert.equal(await page.locator('#connectCard').isVisible(),true);
 await page.locator('.bottom-item[href="#appTop"]').click();
 await page.evaluate(()=>{location.hash='#appTop'});
 await page.waitForFunction(()=>document.body.classList.contains('sp-view-home'));
 await page.evaluate(()=>{location.hash='#connectCard'});
 await page.waitForFunction(()=>document.body.classList.contains('sp-view-settings'));
 assert.equal(await page.locator('#connectCard').isVisible(),true);
 assert.equal(requests.length,0,JSON.stringify(requests));assert.equal(errors.length,0,JSON.stringify(errors));
 results.push({demoReadability:true,dqScale5:true,statsDemo:true,rotate:true,hashNavigation:true,actualExternalRequests:requests.length,errors:errors.length});
 await ctx.close();
 // Adapter contract uses captured structured reader shapes, not DOM-derived data.
 const adapter=readFileSync(root+'/source/premium.js','utf8').replaceAll('window.FEAddonBridge','window.SP_TEST_ENGINE').replaceAll('window.FEUIReadBridge','window.SP_TEST_READER');
 const fixture={fixture:{id:1234,status:{short:'2H',elapsed:0}},teams:{home:{name:'Đội nhà tên rất dài'},away:{name:'Đội khách'}},league:{name:'Test'},goals:{home:0,away:0}};
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await context.newPage();
 await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 await p.goto(origin+'/?mode=connected');
 // Remove only presentation layer in isolated browser fixture before running its adapter.
 await p.evaluate(()=>{document.querySelector('#feSportsPremium')?.remove();delete window.__FE_SPORTS_PREMIUM__;});
 await p.evaluate(({fixture})=>{
   window.SP_TEST_READER={read:()=>({state:{fixtures:[fixture]}})};
   window.SP_TEST_ENGINE={masterRows:()=>[{id:1234,latest:{latest:{fresh_at:Date.now()-180000,minute:0,status:'2H',goals:{home:0,away:0},metrics:{home:{shots:0,sot:0},away:{shots:0,sot:0}},stats_presence:{shots:true,sot:false,side_count:2}}},__rank:{top:1,primary:{dq:4,engine:'FT'}},__addon:{entry:{status:'WATCH'}}}],unified:()=>({})};
 },{fixture});
 await p.addScriptTag({content:adapter});
 assert.match(await p.locator('#spTopContent').innerText(),/DỮ LIỆU CŨ/);
 assert.match(await p.locator('#spTopGate').innerText(),/ĐANG THEO DÕI/);
 assert.match(await p.locator('#spTopContent').innerText(),/0\s*–\s*0/);
 const lines=await p.locator('#spStats .sp-stat').allTextContents();
 assert.match(lines[0],/0/);assert.match(lines[1],/—/);
 assert.equal(await p.locator('#spTopContent .sp-minute').getAttribute('class'),'sp-minute sp-data-warning');
 results.push({staleTop:true,zeroPreserved:true,missingStatsNotZero:true,translatedState:true});
 await context.close();
 writeFileSync(root+'/premium-finish-results.json',JSON.stringify(results,null,2));
 console.log('PREMIUM_FINISH_PASS',JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r))}
