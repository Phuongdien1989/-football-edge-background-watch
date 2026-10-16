import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import http from 'node:http';
import {chromium} from 'playwright';

const root='mobile-sports-premium';
const baseline=readFileSync(root+'/baseline.html','utf8');
const premium=readFileSync(root+'/site/index.html','utf8');
const server=http.createServer((req,res)=>{
  const path=new URL(req.url||'/', 'http://localhost').pathname;
  if(path==='/'||path==='/index.html'||path==='/baseline.html'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    res.end(path==='/baseline.html'?baseline:premium);return;
  }
  res.writeHead(404);res.end('Not Found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
const fixtures=[
  {fixture:{id:991001,timestamp:1792155600,status:{short:'1H',elapsed:0}},teams:{home:{name:'Nhà 0 phút'},away:{name:'Khách 0 bàn'}},league:{name:'Mock Test League',country:'Test'},goals:{home:0,away:0}},
  {fixture:{id:991002,timestamp:1792159200,status:{short:'NS',elapsed:null}},teams:{home:{name:'Very Long Home Football Club Name Must Wrap Properly'},away:{name:'Away'}},league:{name:'Mock Test League',country:'Test'},goals:{home:null,away:null}}
];
const browser=await chromium.launch({headless:true});
async function visit(path){
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage();
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e?.message||e)));
 await ctx.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='127.0.0.1')return route.continue();
  if(/api-sports\.io|rapidapi\.com/.test(u.hostname)&&u.pathname.endsWith('/fixtures'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({response:fixtures,errors:{},results:2})});
  external.push(u.hostname+u.pathname);return route.abort();
 });
 const response=await page.goto(url+path,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response.status(),200);
 await page.evaluate(()=>{
  document.getElementById('footballKey').value='LOCAL-MOCK-NOT-A-SECRET';
  document.getElementById('footballBase').value='https://v3.football.api-sports.io';
  document.querySelector('#scanButtons button[data-h="live"]').click();
 });
 await page.waitForFunction(()=>window.FEUIReadBridge?.read()?.state?.fixtures?.length===2,{timeout:15000});
 const native=await page.evaluate(()=>{
  const r=window.FEUIReadBridge.read(),rows=window.FEAddonBridge.masterRows();
  return {fixtures:r.state.fixtures.map(f=>({id:f.fixture.id,minute:f.fixture.status.elapsed,home:f.goals.home,away:f.goals.away,status:f.fixture.status.short})),ranking:rows.map(x=>({id:x.id,top:x.__rank?.top??null,edge:x.__rank?.primary?.edge??null}))};
 });
 assert.equal(errors.length,0,errors.join(' | '));
 assert.equal(external.some(x=>/\/api\/|db\/sync|notify|push/i.test(x)),false,'Unexpected production backend request');
 return {ctx,page,native,errors,external};
}
try{
 const base=await visit('/baseline.html');
 const preview=await visit('/?mode=connected');
 assert.deepEqual(preview.native.fixtures,base.native.fixtures,'Fixture data changed by presentation');
 assert.deepEqual(preview.native.ranking,base.native.ranking,'TOP/EDGE ranking changed by presentation');
 assert.equal(preview.native.fixtures[0].minute,0);
 assert.equal(preview.native.fixtures[0].home,0);assert.equal(preview.native.fixtures[0].away,0);
 assert.equal(preview.native.fixtures[1].minute,null);
 await preview.page.waitForFunction(()=>document.querySelectorAll('#spRows [data-sp-open]').length===1,{timeout:12000});
 const liveText=await preview.page.locator('#spRows').innerText();
 assert.match(liveText,/0[\s–-]+0/,'Fixture must preserve score 0-0');
 assert.match(liveText,/LIVE\s*\?/,'Missing source freshness should not appear fresh green LIVE');
 await preview.page.locator('[data-sp-open="991001"]').click();
 const selected=await preview.page.evaluate(()=>window.FE_SP_NATIVE.selectedId());
 assert.equal(Number(selected),991001,'Select by fixture_id must call native selected fixture');
 assert.equal(preview.external.filter(x=>x.includes('/api/db/')||x.includes('/api/notify/')).length,0);
 console.log('FE_SP_NATIVE_MOCK_INTEGRATION_PASS '+JSON.stringify({fixtureId:selected,fixtureCount:2,minuteZero:true,scoreZero:true,missingMinute:true,missingFreshnessMuted:true,nativeSelect:true,rankParity:true,productionCalls:0,liveActionsRealProduction:'NOT_TESTED'}));
 await base.ctx.close();await preview.ctx.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
