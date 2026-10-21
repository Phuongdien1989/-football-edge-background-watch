const {webkit}=require('playwright'),assert=require('node:assert/strict'),{mkdirSync,writeFileSync}=require('node:fs');
(async()=>{const browser=await webkit.launch(),origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',results=[];mkdirSync('ht-session-release/qa',{recursive:true});
try{for(const width of [390,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
 await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===origin&&r.request().method()==='GET'&&!u.pathname.startsWith('/api/')?r.continue():r.abort();});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#fe-tabs/ht',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.FEHTPricingView?.sessions&&window.FETabsIntegrated);
 assert.equal(await page.locator('[data-ftabs-tab]').count(),5);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.evaluate(async()=>{
  const {renderHTPricing}=await import('/ht-candidate/ui.mjs'),now=Date.now();
  window.__htQA={renderHTPricing,now,root:document.createElement('section'),item:{id:990090,home:'QA HOME',away:'QA AWAY',latest:{fixture:{fixture:{id:990090,timestamp:Math.floor((now-18*60000)/1000)},teams:{home:{id:1},away:{id:2}}},fresh_at:now,minute:18,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:6,red:0}},stats_presence:{shots:true},market_at:now,market_rows:[{category:'h1_total',values:[{value:'Over',handicap:.5,odd:2.7}]}]}},context:{at:now-1000,rows:Array.from({length:8},(_,i)=>({fixture_id:800+i,kickoff:Math.floor((now-(i+1)*86400000)/1000),status:'FT',home_team_id:1,away_team_id:2,halftime_home:1,halftime_away:0}))}};
  __htQA.root.id='ht-session-qa';document.body.append(__htQA.root);renderHTPricing(__htQA.root,[__htQA.item],__htQA.context,now);
 });
 const q=page.locator('#ht-session-qa');assert((await q.innerText()).includes('5-MIN REVIEW'));assert((await q.innerText()).includes('ACTIVE'));assert((await q.innerText()).includes('5:00'));
 await page.evaluate(()=>{__htQA.item.latest.market_rows[0].values[0].odd=1.2;__htQA.renderHTPricing(__htQA.root,[__htQA.item],__htQA.context,__htQA.now+1000);});assert((await q.innerText()).includes('WAIT_PRICE'));assert((await q.innerText()).includes('@2.70'));
 await page.evaluate(()=>{__htQA.item.latest.market_rows[0].values[0].odd=2.8;__htQA.renderHTPricing(__htQA.root,[__htQA.item],__htQA.context,__htQA.now+2000);});assert((await q.innerText()).includes('ACTIVE'));
 await page.evaluate(()=>{__htQA.item.latest.goals.home=1;__htQA.renderHTPricing(__htQA.root,[__htQA.item],__htQA.context,__htQA.now+3000);});assert((await q.innerText()).includes('SCORE_CHANGED'));
 assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await q.scrollIntoViewIfNeeded();await page.screenshot({path:'ht-session-release/qa/webkit-'+width+'.png'});results.push({width,status:'PASS',session_open_wait_resume_goal_invalidation:'PASS',real_provider_requests:0});await ctx.close();
}}finally{await browser.close();}writeFileSync('ht-session-release/qa/report.json',JSON.stringify({status:'PASS',results,real_phone:'PENDING'},null,2));console.log(JSON.stringify({status:'PASS',results}));})().catch(e=>{console.error(e);process.exitCode=1;});
