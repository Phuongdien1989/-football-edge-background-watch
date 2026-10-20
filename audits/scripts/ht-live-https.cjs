const {webkit}=require('playwright'),assert=require('node:assert/strict');
const {mkdirSync,writeFileSync}=require('node:fs');
(async()=>{const out='ht-rollout/qa';mkdirSync(out,{recursive:true});const browser=await webkit.launch(),origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',cases=[];
try{for(const width of [390,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await ctx.newPage();let blocked=0;const errors=[];
 await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin&&['GET','HEAD'].includes(route.request().method())&&!u.pathname.startsWith('/api/'))return route.continue();blocked++;return route.abort();});
 page.on('pageerror',e=>errors.push(e.message));
 const r=await page.goto(origin+'/#fe-tabs/ht',{waitUntil:'networkidle'});assert.equal(r.status(),200);
 await page.waitForFunction(()=>window.FETabsIntegrated&&window.FEHTCandidateBridge&&window.FEHTPricingView);
 assert.equal(await page.locator('[data-ftabs-tab]').count(),5);
 for(const tab of ['ft','hc','valuation','ht']){await page.locator('[data-ftabs-tab='+tab+']').click();await page.waitForFunction(t=>FETabsIntegrated.mode().current===t,tab);}
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'/https-webkit-'+width+'.png'});
 await page.goto(origin+'/original/',{waitUntil:'networkidle'});assert.equal(await page.locator('#h1WatchCard').count(),1);assert.equal(await page.locator('[data-ftabs-tab]').count(),0);
 cases.push({width,status:'PASS',browser:'webkit',old_original_route:'PASS',provider_requests_sent:0,external_attempts_blocked:blocked});
 await ctx.close();
}}finally{await browser.close();}
const report={status:'PASS',cases,physical_iPhone:'PENDING',push_receipt:'PENDING'};writeFileSync(out+'/https-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
