import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import http from 'node:http';
import {resolve,dirname} from 'node:path';
const root=resolve('mobile-sports-premium'),site=readFileSync(root+'/site/index.html','utf8'),baseline=readFileSync(root+'/baseline.html','utf8');
const images=root+'/screenshots';mkdirSync(images,{recursive:true});
const server=http.createServer((req,res)=>{const path=(req.url||'/').split('?')[0];if(path==='/'||path==='/index.html'||path==='/baseline.html'){
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(path==='/baseline.html'?baseline:site);return;
}res.writeHead(404);res.end('Not Found')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port,url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true}),results=[];
try {
 for(const width of [375,390,430,844,1440]){
  const ctx=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'}),page=await ctx.newPage();
  const errors=[],apiCalls=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('request',r=>{if(/\/api\/|api-sports\.io|api-football/.test(r.url()))apiCalls.push(r.url().replace(/token=[^&]+/gi,'token=***'))});
  await ctx.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>Boolean(window.__FE_SP_DIAGNOSTICS__?.read()),{timeout:12000});
  const d=await page.evaluate(()=>({diag:window.__FE_SP_DIAGNOSTICS__.read(),scroll:document.documentElement.scrollWidth,viewport:innerWidth,nativeAnalysisCount:document.querySelectorAll('#analysisCard').length,notificationRegDisabled:!document.documentElement.outerHTML.includes('navigator.serviceWorker.register(FE_PUSH_P02.sw')}));
  if(response.status()!==200||d.scroll>width+1||errors.length||d.nativeAnalysisCount!==1||d.diag.hasNativeReader!==true||d.diag.hasEngineReader!==true||apiCalls.length)throw Error('SP_BROWSER_FAIL '+JSON.stringify({width,errors,d,apiCount:apiCalls.length}));
  if(width<=767){
   if(!await page.locator('#feSportsPremium').isVisible())throw Error('SP_MOBILE_NOT_VISIBLE_'+width);
   if((await page.locator('#spRows [data-sp-open]').count())!==3)throw Error('SP_DEMO_ROWS_NOT_3_'+width);
   await page.locator('[data-sp-group="PRE"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#spRows [data-sp-open]').length===1,{timeout:5000});
   if((await page.locator('#spRows [data-sp-open]').count())!==1)throw Error('SP_PRE_FILTER_FAIL_'+width);
   await page.locator('[data-sp-group="LIVE"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#spRows [data-sp-open]').length===3,{timeout:5000});
   await page.locator('#spRows [data-sp-open]').first().click();
   if(!(await page.locator('#spInlineError').innerText()).includes('DEMO'))throw Error('SP_DEMO_OPEN_NOT_GUARDED_'+width);
   await page.screenshot({path:images+'/mobile_'+width+'.png',fullPage:true,animations:'disabled'});
  }else{
   if(await page.locator('#feSportsPremium').isVisible())throw Error('DESKTOP_ALTERED_'+width);
   await page.screenshot({path:images+'/desktop_'+width+'.png',fullPage:false,animations:'disabled'});
  }
  results.push({width,http:response.status(),horizontalOverflow:false,consoleErrors:errors.length,nativeAnalysisCount:1,apiRequestsFromEmptyConfig:apiCalls.length,demo:width<=767});
  await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage();
 await ctx.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
 await page.goto(url+'/?mode=connected',{waitUntil:'domcontentloaded'});
 const connected=await page.evaluate(()=>window.__FE_SP_DIAGNOSTICS__?.read());
 if(connected?.mode!=='connected'||connected.rows!==0||await page.locator('#spRows [data-sp-open]').count()!==0)throw Error('CONNECTED_MODE_USED_DEMO_DATA');
 await page.screenshot({path:images+'/mobile_390_connected_empty.png',fullPage:true,animations:'disabled'});
 await ctx.close();
 writeFileSync(root+'/qa-results.json',JSON.stringify({schema:'FE_SP_QA_V1',baselineHash:'aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28',mode:'localhost',results,connected_demo_leak:false,live_engine_actions:'NOT_VERIFIED',ios_pwa:'NOT_VERIFIED'},null,2));
 console.log('FE_SP_MOBILE_QA_PASS '+JSON.stringify({widths:results.map(x=>x.width),zero_extra_api:true,mobile_demo_isolated:true,connected_no_fake_rows:true,desktop_unaffected:true,ios_real_unverified:true}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
