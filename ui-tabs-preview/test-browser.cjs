const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {readFileSync,mkdirSync,writeFileSync}=require('node:fs');
const http=require('node:http');
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
(async()=>{
 let server;const target=process.env.PREVIEW_URL;
 if(!target){server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,files={'/':['index.html','text/html'],'/style.css':['style.css','text/css'],'/app.mjs':['app.mjs','text/javascript']},f=files[p];if(!f){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':f[1]+'; charset=utf-8','Content-Security-Policy':csp});res.end(readFileSync('ui-tabs-preview/'+f[0]));});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
 const base=target||'http://127.0.0.1:'+server.address().port,origin=new URL(base).origin;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];mkdirSync('ui-tabs-preview/qa',{recursive:true});
 try{for(const width of [375,390,414,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],external=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(r.url());if(new URL(r.url()).origin!==origin)external.push(r.url());});
 const response=await page.goto(base,{waitUntil:'networkidle'});assert.equal(response.status(),200);assert(response.headers()['content-security-policy'].includes("connect-src 'none'"));
 await page.waitForSelector('.rank-row');assert.equal(await page.locator('[role=tab]').count(),5);assert.equal(await page.locator('.rank-row').count(),5);
 assert.equal(new Set(await page.locator('.rank-row').evaluateAll(xs=>xs.map(x=>x.hash))).size,5);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'ui-tabs-preview/qa/overview-'+width+'.png',fullPage:true});
 await page.locator('[data-tab=valuation]').click();await page.waitForURL('**/#valuation');assert.equal(await page.locator('.rank-row').count(),1);
 await page.locator('.rank-row').click();await page.waitForSelector('.chart');assert((await page.locator('main').innerText()).includes('DATA × MARKET'));
 const a=page.locator('details').first();await a.locator('summary').click();assert(await a.evaluate(x=>x.open));
 if(width===390)await page.screenshot({path:'ui-tabs-preview/qa/detail-390.png',fullPage:true});
 await page.locator('[data-tab=ht]').click();assert.equal(await page.locator('.rank-row').count(),2);
 await page.goBack();await page.waitForSelector('.chart');assert(await page.locator('details').first().evaluate(x=>x.open));
 await page.locator('.back').click();await page.waitForURL('**/#valuation');assert.equal(await page.locator('.rank-row').count(),1);
 const n=requests.length;
 for(let i=0;i<3;i++)for(const key of ['overview','ht','ft','hc','valuation']){await page.locator('[data-tab='+key+']').click();await page.waitForURL('**/#'+key);}
 assert.equal(requests.length,n,'tab switch must not request resources');
 await page.locator('[data-nav=matches]').click();await page.locator('.search').fill('Coast');assert.equal(await page.locator('.rank-row').count(),1);
 await page.locator('[data-nav=follow]').click();assert((await page.locator('main').innerText()).includes('Chưa kết nối'));
 await page.locator('[data-nav=settings]').click();await page.locator('[data-empty]').click();await page.locator('[data-tab=overview]').click();assert.equal(await page.locator('.rank-row').count(),0);assert(await page.locator('.empty').isVisible());
 if(width===390)await page.screenshot({path:'ui-tabs-preview/qa/empty-390.png',fullPage:true});
 await page.locator('[data-nav=settings]').click();await page.locator('[data-empty]').click();await page.locator('[data-tab=overview]').click();assert.equal(await page.locator('.rank-row').count(),5);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 results.push({width,status:'PASS',tabs:5,unique_fixtures:5,no_overflow:true,back_and_accordion_preserved:true,tab_switch_requests:0,external_requests:0,empty_state:true,search:true});await ctx.close();
 }}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
 writeFileSync('ui-tabs-preview/qa/'+(target?'https':'local')+'-result.json',JSON.stringify({status:'PASS',target:target?'ISOLATED_HTTPS':'CI_LOCAL',production_connected:false,results},null,2));console.log(JSON.stringify({status:'PASS',viewports:results.length,external_requests:0,tab_switch_requests:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
