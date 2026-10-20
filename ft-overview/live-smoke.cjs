const {chromium}=require('playwright');const assert=require('node:assert/strict');const {mkdirSync}=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:390,height:900}});let blocked=0;
await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='https://shiny-silence-d892.ngophuonghuy.workers.dev')return route.continue();blocked++;return route.abort();});
try{
 const page=await context.newPage();const r=await page.goto('https://shiny-silence-d892.ngophuonghuy.workers.dev/#ftOverviewCard');assert.equal(r.status(),200);await page.waitForFunction(()=>!!window.FTOverviewPreview);assert.equal(await page.evaluate(()=>document.documentElement.dataset.foTrial),'true');
 await page.locator('#ftOverviewCard summary').first().click();await page.waitForSelector('#ftOverviewCard .fo-empty');for(const id of ['h1WatchCard','liveWatchCard','handicapWatchCard'])assert.equal(await page.locator('#'+id).count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 mkdirSync('ft-overview/qa',{recursive:true});await page.locator('#ftOverviewCard').scrollIntoViewIfNeeded();await page.screenshot({path:'ft-overview/qa/live-opt-in-390.png',fullPage:false});
 // Synthetic fixtures test the released UI policy; never injected into app
 // engines, backend, D1 or real histories. All external requests remain blocked.
 await page.evaluate(async()=>{
  const {mount}=await import('/ft-overview/ui.mjs');FTOverviewPreview.destroy();const now=Date.now();window.__qaItem={id:990081,home:'QA HOME',away:'QA AWAY',latest:{captured_at:now,minute:60,status:'2H',goals:{home:0,away:0},metrics:{total:{shots:12,sot:4,inbox:7,xg:1}},stats_presence:{shots:true,sot:true,inbox:true,xg:true},market_rows:[{category:'over_under',bookmaker:'QA BOOK',values:[{value:'Over 0.5',odd:1.5},{value:'Under 0.5',odd:3}]}]},history:[],eval:{dataIncomplete:false}};
  const history=[{date:'2026-10-10T10:00:00Z',status:'FT',home_id:1,away_id:2,goals:{home:3,away:2}}];window.__qaControls=[];
  const bridge={read:()=>({watchState:{items:[window.__qaItem]}})},bundleBridge={read:()=>[{observed_at:now,meta:{fixture_id:990081,teams:{home:{id:1},away:{id:2}},fixture:{timestamp:Math.floor((now-3600000)/1000)}},normalized:{home_recent:history,away_recent:history}}],readControls:()=>window.__qaControls};
  window.FTOverviewPreview=mount(document.querySelector('[data-ft-overview]'),{bridge,bundleBridge,trialRecommendations:document.documentElement.dataset.foTrial==='true'});
 });
 assert.ok((await page.locator('.fo-recommend h3').innerText()).includes('CÂN NHẮC TÀI'));assert.ok((await page.locator('.fo-recommend').innerText()).includes('KHUYẾN NGHỊ THỬ NGHIỆM'));
 await page.evaluate(()=>{__qaItem.latest.captured_at++;__qaItem.latest.market_rows[0].values[0].odd=1.1;FTOverviewPreview.refresh();});assert.ok((await page.locator('.fo-recommend').innerText()).includes('chờ giá'));
 await page.evaluate(()=>{__qaItem.latest.captured_at++;__qaItem.latest.market_rows[0].values[0].odd=1.5;__qaItem.latest.metrics={total:{}};__qaItem.latest.stats_presence={};FTOverviewPreview.refresh();});assert.ok((await page.locator('.fo-recommend').innerText()).includes('thống kê LIVE'));
 await page.evaluate(()=>{__qaItem.latest.captured_at++;__qaItem.latest.metrics={total:{shots:0}};__qaItem.latest.stats_presence={shots:true};FTOverviewPreview.refresh();});assert.ok((await page.locator('.fo-recommend h3').innerText()).includes('CÂN NHẮC TÀI'));
 await page.evaluate(()=>{__qaControls=[{id:990081,cooldownUntil:Date.now()+30000}];FTOverviewPreview.refresh();});assert.equal(await page.locator('.fo-top button').count(),0);assert.equal(await page.locator('.fo-recommend h3').innerText(),'CHỜ DỮ LIỆU XÁC NHẬN');
 await page.goto('https://shiny-silence-d892.ngophuonghuy.workers.dev/original/');assert.equal(await page.locator('#ftOverviewCard').count(),0);assert.equal(await page.locator('#h1WatchCard').count(),1);
 console.log(JSON.stringify({status:'PASS',main_app:true,trial_recommendation_render:'PASS',negative_ev_wait:'PASS',missing_live_stats_wait:'PASS',genuine_zero_accepted:'PASS',cooldown_blocks:'PASS',original_view_preserved:true,real_provider_calls_sent:0,external_requests_blocked:blocked}));
}finally{await context.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
