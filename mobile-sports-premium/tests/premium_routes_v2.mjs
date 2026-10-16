import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import http from 'node:http';
const root='mobile-sports-premium', html=readFileSync(root+'/site/index.html');
const server=http.createServer((req,res)=>{
  const p=(req.url||'/').split('?')[0];
  if(p==='/'||p==='/index.html'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
  }
  res.writeHead(404);res.end('Not Found');
});
await new Promise(res=>server.listen(0,'127.0.0.1',res));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const out=[];mkdirSync(root+'/screenshots', {recursive:true});
try{
 for(const width of [375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  const page=await context.newPage();const errors=[],calls=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{if(/api-football|api-sports|\/api\//i.test(req.url()))calls.push(req.url().split('?')[0])});
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.goto(origin+'/?mode=demo',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__FE_SP_DIAGNOSTICS__?.read()?.hasNativeSelect===true,{timeout:20000});
  for(const [target,view,selector] of [
   ['#appTop','home','#feSportsPremium'],
   ['#scanCard','matches','#scanCard'],
   ['#analysisCard','analysis','#analysisCard'],
   ['#betTrackerCard','tracking','#betTrackerCard'],
   ['#connectCard','settings','#connectCard'],
   ['#appTop','home','#feSportsPremium']
  ]){
   await page.locator(`.bottom-nav a.bottom-item[href="${target}"]`).click();
   try{await page.waitForFunction(({v,selector})=>document.body.classList.contains('sp-view-'+v)&&getComputedStyle(document.querySelector(selector)).display!=='none'&&document.querySelector(selector).getBoundingClientRect().height>5,{v:view,selector},{timeout:4000})}
   catch(e){const d=await page.evaluate(({selector})=>({classes:document.body.className,display:getComputedStyle(document.querySelector(selector)).display,rect:document.querySelector(selector).getBoundingClientRect().toJSON()}),{selector});throw Error('PREMIUM_NAV_VISIBILITY_'+width+'_'+view+'_'+JSON.stringify(d))}
   const measure=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,width:innerWidth}));
   if(measure.doc>measure.width+1)throw Error('PREMIUM_NAV_OVERFLOW_'+width+'_'+view+'_'+JSON.stringify(measure));
   if(width===390)await page.screenshot({path:root+'/screenshots/premium_v2_'+view+'_390.png',fullPage:false,animations:'disabled'});
  }
  const mobile=await page.evaluate(()=>({premiumVisible:getComputedStyle(document.querySelector('#feSportsPremium')).display!=='none',premiumBrand:getComputedStyle(document.querySelector('.topbar .brand'),'::after').content,sourceVersion:document.querySelector('#feSportsPremium')?.dataset.uiVersion,ids:[...document.querySelectorAll('[id]')].map(x=>x.id)}));
  if(mobile.ids.length!==new Set(mobile.ids).size)throw Error('DUPLICATE_DOM_IDS');
  if(!mobile.premiumVisible||!mobile.premiumBrand.includes('SPORTS PREMIUM')||mobile.sourceVersion!=='SPORTS-PREMIUM-REVIEW-2')throw Error('PREMIUM_V2_NOT_ACTIVATED_'+JSON.stringify(mobile));
  if(errors.length||calls.length)throw Error('PREMIUM_EXTRA_SIDE_EFFECTS_'+JSON.stringify({errors,calls}));
  out.push({width,views:'home/matches/analysis/tracking/settings/home',nativeControlsReused:true,duplicateIDs:false,unexpectedApiRequests:0,scriptErrors:0});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
 await page.goto(origin+'/?mode=demo',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#feSportsPremium'));
 const desktop=await page.evaluate(()=>({bodyEnabled:document.body.classList.contains('fe-sp-enabled'),prem:getComputedStyle(document.querySelector('#feSportsPremium')).display}));
 if(desktop.bodyEnabled||desktop.prem!=='none')throw Error('DESKTOP_REGRESSION_'+JSON.stringify(desktop));
 await context.close();
 writeFileSync(root+'/premium-routes-v2-results.json',JSON.stringify({schema:'PREMIUM_NAV_V2',out,desktop_preserved:true,production_modified:false,network_test:'isolated-mock-no-real-provider'},null,2));
 console.log('FE_SP_PREMIUM_V2_ROUTE_QA_PASS '+JSON.stringify({sizes:out.map(x=>x.width),allFiveNativeDestinations:true,desktopPreserved:true,apiRequests:0}));
}finally{await browser.close();await new Promise(res=>server.close(res))}
