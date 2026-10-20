const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFileSync,existsSync,mkdirSync}=require('node:fs');
const {resolve,extname}=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const base=resolve('.'),server=createServer((req,res)=>{
  const path=resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!path.startsWith(base+'/')){res.writeHead(403);res.end();return;}
  let p=path;if(new URL(req.url,'http://localhost').pathname.endsWith('/'))p+='/index.html';
  try{const body=readFileSync(p);res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css'})[extname(p)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext(),page=await context.newPage();let blocked=0;
 await context.route('**/*',route=>{if(route.request().url().startsWith(origin+'/'))return route.continue();blocked++;return route.abort();});
 mkdirSync('ft-overview/qa',{recursive:true});
 try{
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/ft-overview/');await page.waitForSelector('.fo-card svg');
   assert.equal(await page.locator('.fo-top button').count(),5);
   assert.ok((await page.locator('.fo-card').innerText()).includes('DEMO'));
   await page.locator('[data-select="990003"]').click();assert.ok((await page.locator('.fo-match').innerText()).includes('ĐỘI E'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`ft-overview/qa/demo-${width}.png`,fullPage:true});
  }
  // Actual legacy page + additive module. Block all external traffic before load.
  await page.setViewportSize({width:390,height:900});await page.goto(origin+'/ft-overview/build/');await page.waitForSelector('#ftOverviewCard .fo-empty',{state:'attached'});
  assert.equal(await page.locator('#ftOverviewCard').getAttribute('open'),null);
  await page.locator('#ftOverviewCard summary').first().click();await page.waitForSelector('#ftOverviewCard .fo-empty');
  await page.waitForFunction(()=>document.querySelector('.fo-native-toggle')?.textContent==='CLOSE');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('#liveWatchCard').count(),1);assert.equal(await page.locator('#h1WatchCard').count(),1);assert.equal(await page.locator('#handicapWatchCard').count(),1);
  const bridge=await page.evaluate(()=>({original:typeof FEUIReadBridge?.read,overview:typeof FEOverviewInputBridge?.read,preview:!!FTOverviewPreview}));
  assert.deepEqual(bridge,{original:'function',overview:'function',preview:true});
  await page.locator('#ftOverviewCard').scrollIntoViewIfNeeded();await page.screenshot({path:'ft-overview/qa/integrated-390.png',fullPage:false});
  await page.locator('#ftOverviewCard summary').first().click();await page.screenshot({path:'ft-overview/qa/integrated-collapsed-390.png',fullPage:false});
  // Isolated adapter UI using a real-shaped bridge; expired stats cannot recommend.
  const live=await context.newPage();await live.addInitScript(()=>{
    const now=Date.now(),item={id:51,home:'<img src=x onerror=alert(1)>',away:'B',latest:{captured_at:now,minute:35,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:7,sot:2}},stats_presence:{shots:true,sot:true}},eval:{score:80,scoreMode:'FULL'},history:[]};
    window.__fixture=item;window.__controls=[];window.FEOverviewInputBridge={read:()=>[],readControls:()=>window.__controls};window.FEUIReadBridge={read:()=>({h1WatchState:{items:[window.__fixture]},watchState:{items:[]},handicapWatchState:{pool:[structuredClone(window.__fixture)]}})};
  });
  await live.goto(origin+'/ft-overview/?source=bridge');await live.waitForSelector('.fo-card');
  assert.equal(await live.locator('.fo-match img').count(),0);
  assert.ok((await live.locator('.fo-recommend').innerText()).includes('WAIT PRICE'));
  assert.equal(await live.locator('.fo-top button').count(),1);
  await live.evaluate(()=>{window.__controls=[{id:51,cooldownUntil:Date.now()+30000}];FTOverviewPreview.refresh();});
  assert.equal(await live.locator('.fo-top button').count(),0);
  assert.ok((await live.locator('.fo-recommend').innerText()).includes('cooldown'));
  assert.equal(await live.locator('.fo-recommend h3').innerText(),'CHỜ DỮ LIỆU XÁC NHẬN');
  await live.evaluate(()=>{window.__controls=[];FTOverviewPreview.refresh();});
  await live.locator('.fo-details summary').click();await live.evaluate(()=>FTOverviewPreview.refresh());assert.equal(await live.locator('.fo-details').getAttribute('open'),'');
  await live.evaluate(()=>{const actualNow=Date.now;Date.now=()=>actualNow()+120000;FTOverviewPreview.refresh();});
  assert.ok((await live.locator('[data-ft-overview]').innerText()).includes('STALE'));
  console.log(JSON.stringify({status:'PASS',viewports:[390,1280],integrated_bridges:bridge,external_requests_sent:0,external_requests_blocked:blocked,live_fake_bridge:'PASS',top_selection:'PASS',xss:'PASS'}));
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
