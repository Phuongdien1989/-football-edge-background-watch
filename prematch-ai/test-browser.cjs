const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const out=path.join(__dirname,'generated'),browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{}),args:['--no-sandbox']});const reports=[];
 try{for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:width<800?1100:1000},deviceScaleFactor:1}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.goto('file://'+path.join(out,'index.html'));await page.waitForSelector('.pm-empty');assert.equal(await page.locator('.pm-card').count(),0);
  await page.getByRole('button',{name:'Xem LAB mô phỏng'}).click();await page.waitForSelector('.pm-card',{timeout:20000});await page.waitForFunction(()=>window.PMPreview.read()?.rows?.length===5);
  assert.equal(await page.locator('.pm-lab').count(),1);assert.equal(await page.locator('.pm-select').count(),5);assert.deepEqual(await page.locator('.pm-select .pm-rank').allTextContents(),['1','2','3','4','5']);assert(await page.locator('.pm-lab').innerText().then(t=>t.includes('Không phải trận thật')));
  const result=await page.evaluate(()=>window.PMPreview.read());assert.equal(result.providerRequests,0);assert(result.rows.every(r=>r.forecast.synthetic));
  assert.equal(await page.locator('.pm-price-grid').count(),1);await page.locator('.pm-select').nth(3).click();assert.equal(await page.locator('.pm-card').getAttribute('data-pm-fixture'),String(result.top[3].fixtureId));
  const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,heading:getComputedStyle(document.querySelector('.pm-team')).fontSize,bodyWidth:document.body.scrollWidth}));assert(!metrics.overflow,JSON.stringify(metrics));
  await page.locator('.pm-select').first().click();await page.screenshot({path:path.join(out,'preview-'+width+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Lưu cục bộ',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pm-state').textContent.includes('Đã lưu')||document.querySelector('.pm-state').textContent.includes('UNAVAILABLE'));
  const before=await page.evaluate(()=>window.PMPreview.read().rows.map(r=>r.forecast.id));await page.getByRole('button',{name:'Đánh giá lại',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pm-state').textContent.includes('Đánh giá lúc'));const after=await page.evaluate(()=>window.PMPreview.read().rows.map(r=>r.forecast.id));assert.deepEqual(before,after);
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.length,0,requests.join('\n'));
  reports.push({width,status:'PASS',emptyByDefault:true,explicitLAB:true,distinctFixtures:5,overflow:false,providerRequests:0,externalRequests:0,pageErrors:0,metrics});await context.close();
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({status:'PASS',reports},null,2));console.log(JSON.stringify({status:'PASS',reports}));
})().catch(e=>{console.error(e);process.exit(1);});
