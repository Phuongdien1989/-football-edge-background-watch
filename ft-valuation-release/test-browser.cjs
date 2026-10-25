const assert=require('node:assert/strict'),{chromium}=require('playwright'),{readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',baseline=false,candidate=process.argv.includes('--candidate')||baseline,before=false,folder=baseline?'backup':'site',mode=baseline?'baseline':candidate?'candidate':'production',out='ft-valuation-package/qa/'+mode;
(async()=>{
 mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome'}),results=[];
 try{for(const width of before?[390]:[320,375,390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],badAssets=[];let blocked=0;
  await ctx.route('**/*',route=>{const r=route.request(),u=new URL(r.url());
   if(u.origin!==origin||u.pathname.startsWith('/api/')||r.method()!=='GET'){blocked++;return route.abort();}
   if(before||candidate){const p=u.pathname==='/'?'index.html':u.pathname.slice(1);try{const b=readFileSync('ft-valuation-package/'+folder+'/'+p);return route.fulfill({status:200,body:b,contentType:p.endsWith('.css')?'text/css':/\.(?:m?js)$/.test(p)?'application/javascript':p.endsWith('.html')?'text/html':p.endsWith('.png')?'image/png':'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}}
   return route.continue();
  });
  // Replace only read-only bridge inputs at their definition boundary. The
  // production HTML/modules, navigation and HT automatic mounting run unchanged.
  await ctx.addInitScript(()=>{
   const now=Date.now(),item=id=>({id,home:'HT Home '+id,away:'HT Away '+id,league:'Regression League',state:'STRONG',eval:{score:79,scoreMode:'FULL'},history:[],latest:{fixture:{fixture:{id,timestamp:Math.floor((now-18*60000)/1000)},teams:{home:{id:1},away:{id:2}},league:{name:'Regression League',country:'QA'}},captured_at:now,fresh_at:now,minute:18,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:6,sot:3,red:0}},stats_presence:{shots:true,sot:true},market_at:now,market_rows:[{category:'h1_total',values:[{value:'Over',handicap:.5,odd:2.7}]}]}});
   window.__htRecoveryQA={items:[item(990091),item(990092)],context:{at:now-1000,rows:Array.from({length:8},(_,i)=>({fixture_id:800+i,kickoff:Math.floor((now-(i+1)*86400000)/1000),status:'FT',home_team_id:1,away_team_id:2,halftime_home:1,halftime_away:0}))}};
   const ftItem=id=>({id,home:'FT Home '+id,away:'FT Away '+id,league:'FT QA League',state:'STRONG',eval:{score:79,scoreMode:'FULL'},history:[{captured_at:now-180000,goals:{home:1,away:0},metrics:{total:{shots:6,sot:2}},stats_presence:{shots:true,sot:true}}],latest:{fixture:{fixture:{id,timestamp:Math.floor((now-55*60000)/1000)},teams:{home:{id:1},away:{id:2}}},captured_at:now,minute:55,status:'2H',goals:{home:1,away:0},metrics:{total:{shots:10,sot:5}},stats_presence:{shots:true,sot:true},market_rows:[{category:'over_under',update:new Date(now).toISOString(),bookmaker:{name:'QA'},values:[{value:'Over',handicap:2.5,odd:2.7},{value:'Under',handicap:2.5,odd:1.55}]}]}});
   const recent=Array.from({length:8},(_,i)=>({date:new Date(now-(i+1)*86400000).toISOString(),status:'FT',home_id:1,away_id:2,goals:{home:3,away:2}}));
   window.__ftQA={items:[ftItem(910001),ftItem(910002)]};
   window.__ftBundles=__ftQA.items.map(it=>({observed_at:now,meta:{fixture_id:it.id,teams:{home:{id:1},away:{id:2}},fixture:{timestamp:Math.floor((now-55*60000)/1000),status:{short:'2H'}}},normalized:{home_recent:recent,away_recent:recent}}));
   const original=Object.defineProperty;
   Object.defineProperty=function(target,key,descriptor){
    if(target===window&&key==='FEUIReadBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone({h1WatchState:{items:window.__htRecoveryQA.items},watchState:{items:window.__ftQA.items},handicapWatchState:{pool:[]}})})};
    if(target===window&&key==='FEOverviewInputBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone(window.__ftBundles)})};
    if(target===window&&key==='FEHTCandidateBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone(window.__htRecoveryQA)})};
    return original(target,key,descriptor);
   };
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/\/(?:ht-candidate|ui-tabs|ft-ai-v2)\//.test(r.url()))badAssets.push(r.url()+' '+r.status());});
  await page.goto(origin+'/#fe-tabs/ht',{waitUntil:'networkidle',timeout:45000});
  await page.waitForFunction(()=>window.FEHTPricingView&&window.FETabsIntegrated?.mode().current==='ht');
  await page.waitForFunction(()=>window.FEHTPricingView.read().length===2);
  assert.equal(await page.locator('[data-ftabs-tab]').count(),6);assert.equal(badAssets.length,0);
  const content=page.locator('#feTabsWorkspace .ftabs-content');
  assert(await content.isVisible(),'HT_CONTENT_HIDDEN');assert.equal(await page.locator('[data-ftabs-fixture]').count(),2);
  await page.waitForSelector('[data-ftabs-fixture="990091"] [data-ht-price]');
  await page.locator('[data-ftabs-fixture="990091"]').click();
  const card=page.locator('.ftabs-detail [data-ht-pricing] .htp-card');await card.waitFor({state:'visible'});
  assert.equal(await card.getAttribute('data-htp-id'),'990091');assert.equal(await card.getAttribute('data-state'),'ACTIVE');
  assert.equal(await card.locator('.htp-league').innerText(),'Regression League · QA');assert((await card.innerText()).includes('@ 2.70'));
  assert.equal(await card.locator('.htp-session').count(),1);const deadline=await page.evaluate(()=>FEHTPricingView.sessions().sessions.find(x=>x.fixtureId===990091).expiresAt);
  await card.scrollIntoViewIfNeeded();const closedHeight=await card.evaluate(e=>e.getBoundingClientRect().height);await page.screenshot({path:out+'/ht-compact-'+width+'.png',clip:await card.boundingBox()});
  await card.locator('details summary').click();await card.locator('.htp-chart').waitFor({state:'visible'});assert.equal(await card.locator('.htp-chart>div').count(),5);
  const metrics=await card.evaluate(e=>({values:[...e.querySelectorAll('.htp-values b')].map(x=>x.textContent),title:getComputedStyle(e.querySelector('h3')).fontSize,odds:getComputedStyle(e.querySelector('.htp-odds')).fontSize,overflow:e.scrollWidth>e.clientWidth+1}));metrics.closedHeight=closedHeight;assert.equal(metrics.title,baseline?'16px':'15px');assert.equal(metrics.odds,baseline?'24px':'22px');assert.equal(metrics.overflow,false);
  await page.screenshot({path:out+'/ht-auto-route-'+width+'.png',clip:await card.boundingBox()});
  await page.evaluate(()=>{__htRecoveryQA.items[0].latest.market_rows[0].values[0].odd=2.8;__htRecoveryQA.items[0].latest.market_at=Date.now();window.dispatchEvent(new Event('fe-ht-context-updated'));});
  await page.waitForFunction(()=>document.querySelector('.htp-session-prices')?.textContent.includes('@2.80'));
  assert((await card.locator('.htp-session-prices').innerText()).includes('@2.70'));assert.equal(await page.evaluate(()=>FEHTPricingView.sessions().sessions.find(x=>x.fixtureId===990091).expiresAt),deadline);
  await page.evaluate(()=>{__htRecoveryQA.items[0].latest.market_rows[0].values[0].odd=1.2;window.dispatchEvent(new Event('fe-ht-context-updated'));});
  await page.waitForFunction(()=>document.querySelector('.htp-card')?.dataset.state==='WAIT_PRICE');
  assert.equal(await page.evaluate(()=>FEHTPricingView.sessions().sessions.find(x=>x.fixtureId===990091).expiresAt),deadline);
  await page.evaluate(()=>{__htRecoveryQA.items[0].latest.market_rows[0].values[0].odd=2.8;window.dispatchEvent(new Event('fe-ht-context-updated'));});
  await page.waitForFunction(()=>document.querySelector('.htp-card')?.dataset.state==='ACTIVE');
  await page.evaluate(()=>{__htRecoveryQA.items[0].latest.goals.home=1;window.dispatchEvent(new Event('fe-ht-context-updated'));});
  await page.waitForFunction(()=>document.querySelector('.htp-card')?.dataset.state==='INVALIDATED');
  await page.locator('[data-ftabs-tab="ht"]').click();await page.locator('[data-ftabs-fixture="990092"]').click();await page.waitForSelector('.htp-card[data-htp-id="990092"]',{state:'visible'});
  for(const tab of ['ftv2','ft','hc','valuation','overview','ht']){
   await page.locator('[data-ftabs-tab="'+tab+'"]').click();await page.waitForSelector('[data-ftabs-tab="'+tab+'"][aria-selected="true"]');
   if(tab==='ht')assert(await content.isVisible());else if(tab==='ftv2'){
    await page.waitForSelector('#ftAIV2ReadOnly[data-ft-v2-mounted="true"]');
    assert(await page.evaluate(()=>{const r=document.getElementById('ftAIV2ReadOnly');for(let i=0;i<20;i++){window.dispatchEvent(new Event('fe-notify-sync-updated'));window.dispatchEvent(new Event('fe-ft-v2-tab-open'));}return document.getElementById('ftAIV2ReadOnly')===r;}),'FTV2_ROOT_REMOUNTED');
    await page.waitForSelector('#ftAIV2ReadOnly [data-ft-session="ACTIVE"]');
    const ft=page.locator('#ftAIV2ReadOnly');assert.equal(await ft.locator('[data-ft-v2-select]').count(),2);
    assert((await ft.innerText()).includes('Tài FT 2.5 @ 2.70'));assert((await ft.innerText()).includes('FT QA League'));
    assert((await ft.innerText()).includes('Điều kiện giá'));assert.equal(await ft.locator('[role=meter]').count(),2);
    assert((await ft.innerText()).includes('LIVE chưa hiệu chỉnh xác suất'));assert((await ft.innerText()).includes('Mốc đầu: Tài 2.5 @ 2.70'));
    const sessionBefore=await ft.locator('.fe-lsp-ft-session').innerText();
    await ft.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/ft-valuation-'+width+'.png',fullPage:true});
    assert.equal(await ft.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'FT_OVERFLOW');
    await page.evaluate(()=>{const s=__ftQA.items[0].latest;s.captured_at=Date.now();s.market_rows[0].update=new Date(s.captured_at).toISOString();s.market_rows[0].values[0].odd=1.05;window.dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForSelector('#ftAIV2ReadOnly [data-ft-session="PAUSED"]');
    assert((await ft.innerText()).includes('Mốc đầu: Tài 2.5 @ 2.70'));
    await page.evaluate(()=>{const s=__ftQA.items[0].latest;s.captured_at=Date.now();s.market_rows[0].update=new Date(s.captured_at).toISOString();s.market_rows[0].values[0].odd=2.8;window.dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForSelector('#ftAIV2ReadOnly [data-ft-session="ACTIVE"]');
    await page.evaluate(()=>{const s=__ftQA.items[0].latest;s.captured_at=Date.now();s.goals.home=2;s.market_rows[0].update=new Date(s.captured_at).toISOString();s.market_rows[0].values.forEach(v=>v.handicap=3.5);window.dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForSelector('#ftAIV2ReadOnly [data-ft-session="INVALIDATED"]');assert((await ft.innerText()).includes('ĐÁNH GIÁ LẠI SAU BIẾN ĐỘNG'));

   }else assert.equal(await page.locator('.fe-lsp-mechanism .fe-lsp-panel').count(),2,'OTHER_TAB_CHANGED_'+tab);
  }
  await page.locator('[data-ftabs-fixture="990092"]').click();await page.waitForSelector('.htp-card[data-htp-id="990092"]',{state:'visible'});
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
  results.push({width,status:'PASS',HT_real_module_auto_mount:true,selected_fixture_preserved:true,pricing_session_and_goal_chart:'PASS',quote_update_original_deadline_and_goal_invalidation:'PASS',other_five_tabs_and_ftv2_stable_root:'PASS',metrics,blocked_requests:blocked});await ctx.close();
 }
 }finally{await browser.close();}
 writeFileSync(out+'/report.json',JSON.stringify({status:'PASS',mode,synthetic_readonly_bridge_inputs:true,physical_phone_and_real_live:'NOT_VERIFIED',results},null,2));console.log('FT_VALUATION_BROWSER '+JSON.stringify({status:'PASS',mode,results}));
})().catch(e=>{console.error(e);process.exitCode=1;});
