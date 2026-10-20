// Acceptance of the clean candidate only. The test server, not the candidate,
// blocks network access. No credentials, fixtures or production data are supplied.
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http');
const {readFileSync,existsSync,mkdirSync,writeFileSync}=require('node:fs');
const path=require('node:path');
(async()=>{
 const dir=path.resolve('ui-tabs-preview/generated/candidate'),errors=[],cases=[];
 const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(dir,'.'+(p==='/'?'/index.html':p));
  if(!file.startsWith(dir+'/')||!existsSync(file)){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript','Content-Security-Policy':"default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; worker-src 'none'"});res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const config of [{...devices['iPhone 13'],defaultBrowserType:undefined},{viewport:{width:1280,height:900}}]){
   const ctx=await browser.newContext({...config,serviceWorkers:'block'}),page=await ctx.newPage();let blocked=0;
   await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():(blocked++,r.abort()));page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/#fe-tabs/overview',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.FETabsIntegrated&&!!window.FTOverviewPreview);await page.waitForTimeout(1000);
   assert(await page.evaluate(()=>!window.__FETabsSandbox&&!window.__FETabsQA));
   assert.equal(await page.locator('#feTabsSandboxLabel').count(),0);assert.equal(await page.locator('[data-ftabs-tab]').count(),5);
   // Clean source has no sandbox locking of ordinary connection inputs.
   assert(await page.evaluate(()=>[...document.querySelectorAll('#connectCard input')].some(x=>!x.disabled)));
   for(const tab of ['ht','ft','hc','valuation','overview']){await page.locator('[data-ftabs-tab='+tab+']').click();await page.waitForFunction(t=>FETabsIntegrated.mode().current===t,tab);}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('.bottom-nav a[href="#scanCard"]').click();await page.waitForFunction(()=>document.body.classList.contains('fe-route-matches'));await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.FETabsIntegrated);assert(await page.evaluate(()=>!FETabsIntegrated.mode().enabled&&document.body.classList.contains('fe-route-matches')));
   await page.locator('.bottom-nav a[href="#appTop"]').click();await page.waitForFunction(()=>FETabsIntegrated.mode().enabled);
   cases.push({width:await page.evaluate(()=>innerWidth),status:'PASS',clean_without_sandbox:true,original_inputs_enabled:true,tab_navigation:true,reload_matches_route:true,external_requests_sent:0,blocked_by_test_harness:blocked});await ctx.close();
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
 mkdirSync('ui-tabs-preview/qa',{recursive:true});const report={status:'PASS',cases,browser:'Chromium; iPhone viewport/touch emulation is not real Safari',production_deployed:false,live_push:'NOT_TESTED'};writeFileSync('ui-tabs-preview/qa/clean-candidate.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
