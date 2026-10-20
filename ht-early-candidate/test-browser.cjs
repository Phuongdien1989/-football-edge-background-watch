const {chromium,webkit,devices}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {readFileSync,existsSync,mkdirSync,writeFileSync}=require('node:fs');
(async()=>{
 const baseDir=path.resolve('ht-early-candidate/generated/package'),qa=baseDir+'/qa';mkdirSync(qa,{recursive:true});
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),p=url.pathname,kind=p.startsWith('/demo/')?'preview':'site';
  const relative=kind==='preview'?p.slice(5):p;
  const file=path.resolve(baseDir,kind,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(baseDir+'/'+kind+'/')||!existsSync(file)){res.writeHead(404).end();return;}
  const ext=path.extname(file),types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Content-Security-Policy':"default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; worker-src 'none'"});res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const cases=[],errors=[];
 try {
  for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]) {
   const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--no-sandbox']}:{})});
   try {
    for(const width of [390,1280]) {
     const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await ctx.newPage();let sent=0;
     await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();sent++;return route.abort();});
     page.on('pageerror',e=>errors.push(name+':'+e.message));
     await page.goto(origin+'/#fe-tabs/ht',{waitUntil:'networkidle'});
     await page.waitForFunction(()=>window.FETabsIntegrated&&window.FEHTCandidateBridge&&window.FEHTPricingView);
     assert.equal(await page.locator('[data-ftabs-tab]').count(),5);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     for(const tab of ['ft','hc','valuation','ht']){await page.locator('[data-ftabs-tab='+tab+']').click();await page.waitForFunction(t=>FETabsIntegrated.mode().current===t,tab);}
     await page.screenshot({path:qa+'/'+name+'-app-'+width+'.png'});
     // Render fictional data through the exact UI module in an isolated DOM harness.
     await page.goto(origin+'/ht-candidate/demo.html',{waitUntil:'networkidle'});
     await page.waitForFunction(()=>document.querySelectorAll('.htp-card').length===5);
     assert.equal(await page.locator('.htp-card').count(),5);assert.equal(await page.locator('.htp-chart').count(),4);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     assert(await page.locator('body').innerText().then(s=>s.includes('DỮ LIỆU GIẢ LẬP')&&s.includes('MODEL WAIT')&&s.includes('WAIT PRICE')));
     await page.locator('.htp-card details summary').first().click();assert(await page.locator('.htp-card details').first().getAttribute('open')!==null);
     await page.screenshot({path:qa+'/'+name+'-demo-'+width+'.png',fullPage:width===1280});
     cases.push({browser:name,width,status:'PASS',real_provider_requests:0,external_attempts_blocked:sent,main_five_tabs_preserved:true,ht_demo_cards:5});
     await ctx.close();
    }
   } finally {await browser.close();}
  }
  assert.deepEqual(errors,[]);
 }finally{await new Promise(r=>server.close(r));}
 const report={status:'PASS',cases,production_deployed:false,real_phone_pwa:'NOT_TESTED',live_push:'NOT_TESTED'};
 writeFileSync(qa+'/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
