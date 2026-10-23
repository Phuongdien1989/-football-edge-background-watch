// Standalone localhost-only Playwright QA + screenshots. No production browser
// writes, no API Football, D1, scanner, shared HT/HC tabs or Cloudflare access.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFileSync,existsSync,mkdirSync,writeFileSync}=require('node:fs');
const {resolve,extname}=require('node:path');
(async()=>{
 const root=process.cwd(),out=root+'/ft-audit-output/ft-v2-mobile-preview';
 mkdirSync(out,{recursive:true});
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  let path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(url.pathname==='/'||!path.startsWith(root+'/')||!existsSync(path)){
   res.writeHead(404);res.end('Not found');return;
  }
  const type=extname(path)==='.mjs'?'text/javascript':extname(path)==='.css'?'text/css':extname(path)==='.html'?'text/html':'text/plain';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(readFileSync(path));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 const results=[];
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  for(const width of [320,375,390,1280]){
   const context=await browser.newContext({viewport:{width,height:850},deviceScaleFactor:1,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[],blocked=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();
    blocked.push(r.request().url());return r.abort();});
   await page.goto(base+'/ft-v2-mobile/preview.html',{waitUntil:'load'});
   await page.waitForSelector('.ftv2-match-card');
   assert.equal(await page.locator('.ftv2-match-card').count(),5);
   assert.equal(await page.locator('.ftv2-app').getAttribute('data-ft-mode'),'DEMO');
   assert((await page.locator('.ftv2-demo-banner').innerText()).includes('SỐ LIỆU GIẢ LẬP'));
   const bg=await page.locator('.ftv2-app').evaluate(x=>getComputedStyle(x).backgroundColor);
   assert.equal(bg,'rgb(239, 246, 252)');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'DOCUMENT_HORIZONTAL_OVERFLOW');
   await page.screenshot({path:out+'/list-'+width+'.png',fullPage:true});
   const b=page.locator('.ftv2-match-card').first().locator('button[data-ft-open]');
   await b.click();
   assert.equal(await page.locator('.ftv2-app').getAttribute('data-ft-screen'),'detail');
   assert((await page.locator('.ftv2-valuation-hero').innerText()).includes('VÍ DỤ GIẢ LẬP'));
   await page.screenshot({path:out+'/detail-'+width+'.png',fullPage:true});
   await page.getByRole('button',{name:'Biểu đồ'}).click();
   assert.equal(await page.locator('.ftv2-bars').count(),1);
   assert.equal(await page.locator('.ftv2-trend').count(),1);
   await page.screenshot({path:out+'/charts-'+width+'.png',fullPage:true});
   await page.getByRole('button',{name:'Định giá'}).click();
   assert.equal(await page.locator('.ftv2-table tbody tr').count(),7);
   await page.screenshot({path:out+'/pricing-'+width+'.png',fullPage:true});
   await page.getByRole('button',{name:'Lịch sử'}).click();
   assert((await page.locator('.ftv2-panel').innerText()).includes('Chưa quyết toán'));
   await page.locator('[data-ft-back]').click();
   assert.equal(await page.locator('.ftv2-match-card').count(),5);
   await page.locator('[data-ft-filter="OVER"]').click();
   const n=await page.locator('.ftv2-match-card').count();assert(n>0&&n<=5);
   assert.deepEqual(errors,[]);
   assert.deepEqual(blocked,[]);
   results.push({width,theme:'LIGHT_BLUE_WHITE',cards:5,chart:'PASS',pricing:'PASS',history:'PASS',over_filter_cards:n,external_requests:0,js_errors:0});
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('request',req=>{assert.equal(new URL(req.url()).origin,base,'EXTERNAL_DEPENDENCY_NOT_ALLOWED');});
  await page.goto(base+'/ft-v2-mobile/preview.html?mode=live',{waitUntil:'load'});
  assert.equal(await page.locator('.ftv2-app').getAttribute('data-ft-mode'),'LIVE');
  assert.equal(await page.locator('.ftv2-match-card').count(),0);
  assert((await page.locator('.ftv2-empty').innerText()).includes('Chưa có trận'));
  assert(!((await page.locator('.ftv2-app').innerText()).includes('EV DEMO')));
  await page.screenshot({path:out+'/live-no-real-data-390.png',fullPage:true});
  results.push({width:390,mode:'LIVE_EMPTY',synthetic_items:0,EV_shown:false,status:'PASS'});
  await context.close();

  // Local-only representative shape of EXISTING FEUIReadBridge.watchState:
  // read the FT data without entering FT V2 paired-odds or fictitious EV.
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await ctx.addInitScript(()=>{
    const at=Date.now()-13000;
    const fixture={fixture:{id:76543,status:{short:'2H',elapsed:67}},
      league:{name:'Local FT Bridge QA',country:'QA'},
      teams:{home:{name:'Home Source'},away:{name:'Away Source'}}};
    window.FEUIReadBridge={read:()=>({
      watchState:{items:[{
        id:76543,home:'Home Source',away:'Away Source',league:'Local FT Bridge QA',
        h1History:[{score:'HT_UNCHANGED'}],hcHistory:[{score:'HC_UNCHANGED'}],
        history:[
          {captured_at:at-40000,minute:65,stats_presence:{sot:true},metrics:{total:{sot:7}}},
          {captured_at:at,minute:67,stats_presence:{sot:true},metrics:{total:{sot:9}}}
        ],
        ui:{fixture,
          snapshot:{captured_at:at,minute:67,status:'2H',goals:{home:1,away:1},
            stats_presence:{sot:true},metrics:{total:{sot:9}},
            market_rows:[{category:'over_under',values:[{value:'Over',handicap:2.5,odd:9.99}]}]},
          engines:{FT:{score:81,scoreMode:'FULL'},H1:{score:45}}}
      }]},
      h1WatchState:{items:[{id:8888,home:'HT fixture'}]},
      handicapWatchState:{pool:[{id:9999,home:'HC fixture'}]}
    })};
  });
  const p=await ctx.newPage(),caught=[],outside=[];
  p.on('pageerror',err=>caught.push(err.message));
  await p.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    outside.push(route.request().url);return route.abort();
  });
  await p.goto(base+'/ft-v2-mobile/preview.html?mode=live',{waitUntil:'load'});
  assert.equal(await p.locator('.ftv2-match-card').count(),1);
  const all=await p.locator('.ftv2-app').innerText();
  assert(all.includes('Local FT Bridge QA')&&all.includes('Home Source')&&all.includes('Away Source'));
  assert(all.includes('CHỜ MODEL')&&!all.includes('EV DEMO')&&!all.includes('9.99'));
  await p.screenshot({path:out+'/bridge-live-list-390.png',fullPage:true});
  await p.locator('[data-ft-open="76543"]').click();
  assert((await p.locator('.ftv2-valuation-hero').innerText()).includes('81/100'));
  await p.screenshot({path:out+'/bridge-live-detail-390.png',fullPage:true});
  await p.getByRole('button',{name:'Biểu đồ'}).click();
  assert.equal(await p.locator('.ftv2-trend').count(),1);
  assert.equal(await p.locator('.ftv2-bars').count(),0);
  await p.screenshot({path:out+'/bridge-live-chart-390.png',fullPage:true});
  await p.getByRole('button',{name:'Định giá'}).click();
  assert((await p.locator('.ftv2-table').innerText()).includes('—'));
  await p.screenshot({path:out+'/bridge-live-pricing-390.png',fullPage:true});
  assert.deepEqual(caught,[]);assert.deepEqual(outside,[]);
  results.push({width:390,mode:'EXISTING_FT_BRIDGE',cards:1,verified_market_prices:0,
    pmf:false,EV_shown:false,synthetic_items:0,external_requests:0,js_errors:0,status:'PASS'});
  await ctx.close();
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
 writeFileSync(out+'/report.json',JSON.stringify({status:'PASS',results,production_deploy:false,scans:0,real_calibrated_pricing:false},null,2));
 console.log('FE_FT_V2_BROWSER_PREVIEW_PASS '+JSON.stringify({screenshots:21,resolutions:[320,375,390,1280],live_empty:true,existing_ft_bridge:true,production_deploy:false,api_calls:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
