const assert=require('node:assert/strict'),{chromium}=require('playwright'),{readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',baseline=false,candidate=!process.argv.includes('--production'),before=false,folder='site',mode=candidate?'candidate':'production',out='ht-probability-package/qa/'+mode;
(async()=>{
 mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome'}),results=[];
 try{for(const width of before?[390]:[320,375,390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],badAssets=[];let blocked=0;
  await ctx.route('**/*',route=>{const r=route.request(),u=new URL(r.url());
   if(u.origin!==origin||u.pathname.startsWith('/api/')||r.method()!=='GET'){blocked++;return route.abort();}
   if(before||candidate){const p=u.pathname==='/'?'index.html':u.pathname.slice(1);try{const b=readFileSync('ht-probability-package/'+folder+'/'+p);return route.fulfill({status:200,body:b,contentType:p.endsWith('.css')?'text/css':/\.(?:m?js)$/.test(p)?'application/javascript':p.endsWith('.html')?'text/html':p.endsWith('.png')?'image/png':'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}}
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
   const hcItem=id=>({id,home:'HC Home '+id,away:'HC Away '+id,league:'HC Integration League',eval:{state:'STRONG_HOME',gap:26,states:{liveGap:26}},latest:{captured_at:now,fresh_at:now,status:'2H',minute:55,goals:{home:0,away:1},metrics:{home:{shots:10,sot:4,xg:1.2,red:0},away:{shots:4,sot:1,xg:.3,red:0},dataTier:'FULL'},market:{quotes:[{book:'QA',sourceId:'live:book:qa',marketId:33,line:-.25,homeOdd:2.1,awayOdd:1.8,sourceQuote:true,period:'FT',quoteAt:now,timestampBasis:'HUB_RECEIPT',observedScore:{home:0,away:1}}]}}});
   window.__hcQA={items:[hcItem(920002),hcItem(920001)],controls:[],bundles:[920001,920002].map(id=>({meta:{fixture_id:id,teams:{home:{id:1},away:{id:2}},fixture:{timestamp:(now-55*60000)/1000}},normalized:{home_recent:recent,away_recent:recent}}))};
   const original=Object.defineProperty;
   Object.defineProperty=function(target,key,descriptor){
    if(target===window&&key==='FEUIReadBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone({h1WatchState:{items:window.__htRecoveryQA.items},watchState:{items:window.__ftQA.items},handicapWatchState:{pool:window.__hcQA.items}})})};
    if(target===window&&key==='FEOverviewInputBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone([...window.__ftBundles,...window.__hcQA.bundles]),readControls:()=>structuredClone(window.__hcQA.controls)})};
    if(target===window&&key==='FEHTCandidateBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone(window.__htRecoveryQA)})};
    return original(target,key,descriptor);
   };
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/\/(?:ht-candidate|ui-tabs|ft-ai-v2)\//.test(r.url()))badAssets.push(r.url()+' '+r.status());});
  await page.goto(origin+'/#fe-tabs/ht',{waitUntil:'networkidle',timeout:45000});
  await page.waitForFunction(()=>window.FEHCResearchPreview);
  await page.waitForFunction(()=>window.FEHTPricingView&&window.FETabsIntegrated?.mode().current==='ht');
  await page.waitForFunction(()=>window.FEHTPricingView.read().length===2);
  assert.equal(await page.locator('[data-ftabs-tab]').count(),6);assert.equal(badAssets.length,0);
  const content=page.locator('#feTabsWorkspace .ftabs-content');
  assert(await content.isVisible(),'HT_CONTENT_HIDDEN');assert.equal(await page.locator('[data-ftabs-fixture]').count(),2);
  await page.waitForSelector('[data-ftabs-fixture="990091"] [data-ht-price]');
  await page.locator('[data-ftabs-fixture="990091"]').click();
  const card=page.locator('.ftabs-detail [data-ht-pricing] .htp-card');await card.waitFor({state:'visible'});
  assert.equal(await card.getAttribute('data-htp-id'),'990091');assert.equal(await card.getAttribute('data-state'),'ACTIVE');
  assert.equal(await card.locator('.htp-league').innerText(),'Regression League · QA');assert((await card.innerText()).includes('@ 2.70'));assert((await card.locator('[data-ht-recorded]').innerText()).includes('@ 2.70'));
  assert.equal(await card.locator('[data-ht-probability=AVAILABLE]').count(),1);const pBefore=await card.locator('[data-ht-probability] .htp-prob-row b').allTextContents();assert.equal(pBefore.length,3);assert(Math.abs(parseFloat(pBefore[0])+parseFloat(pBefore[1])-100)<.11);
  assert.equal(await card.locator('.htp-session').count(),1);const deadline=await page.evaluate(()=>FEHTPricingView.sessions().sessions.find(x=>x.fixtureId===990091).expiresAt);
  await card.scrollIntoViewIfNeeded();const closedHeight=await card.evaluate(e=>e.getBoundingClientRect().height);await page.screenshot({path:out+'/ht-compact-'+width+'.png',clip:await card.boundingBox()});
  await card.locator('details summary').click();await card.locator('.htp-chart').waitFor({state:'visible'});assert.equal(await card.locator('.htp-chart>div').count(),5);assert.equal(await card.locator('[data-ht-settlement=BINARY]').count(),1);assert.equal(await card.locator('[data-ht-settlement] .htp-prob-row').count(),6);
  const metrics=await card.evaluate(e=>({values:[...e.querySelectorAll('.htp-values b')].map(x=>x.textContent),title:getComputedStyle(e.querySelector('h3')).fontSize,odds:getComputedStyle(e.querySelector('.htp-odds')).fontSize,overflow:e.scrollWidth>e.clientWidth+1}));metrics.closedHeight=closedHeight;assert.equal(metrics.title,baseline?'16px':'15px');assert.equal(metrics.odds,baseline?'24px':'22px');assert.equal(metrics.overflow,false);
  await page.screenshot({path:out+'/ht-auto-route-'+width+'.png',clip:await card.boundingBox()});
  await page.evaluate(()=>{__htRecoveryQA.items[0].latest.market_rows[0].values[0].odd=2.8;__htRecoveryQA.items[0].latest.market_at=Date.now();window.dispatchEvent(new Event('fe-ht-context-updated'));});
  await page.waitForFunction(()=>document.querySelector('.htp-session-prices')?.textContent.includes('@2.80'));assert.deepEqual(await card.locator('[data-ht-probability] .htp-prob-row b').allTextContents(),pBefore,'PRICE_CHANGED_GOAL_PROBABILITY');
  assert((await card.locator('.htp-session-prices').innerText()).includes('@2.70'));assert.equal(await page.evaluate(()=>FEHTPricingView.sessions().sessions.find(x=>x.fixtureId===990091).expiresAt),deadline);
  await page.evaluate(()=>{__htRecoveryQA.items[0].latest.market_rows[0].values[0].odd=1.2;window.dispatchEvent(new Event('fe-ht-context-updated'));});
  await page.waitForFunction(()=>document.querySelector('.htp-card')?.dataset.state==='WAIT_PRICE');assert((await card.locator('[data-ht-recorded]').innerText()).includes('@ 2.70'));assert((await card.locator('[data-ht-recorded]').innerText()).includes('đang chờ'));
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
    const ft=page.locator('#ftAIV2ReadOnly');assert.equal(await ft.locator('[data-ft-v2-select]').count(),4);assert.equal(await ft.locator('[data-ft-v2-select="910001"]').count(),1);assert.equal(await ft.locator('[data-ft-v2-select="910002"]').count(),1);
    assert((await ft.innerText()).includes('Tài FT 2.5 @ 2.70'));assert((await ft.innerText()).includes('FT QA League'));
    assert((await ft.innerText()).includes('Điều kiện giá'));assert.equal(await ft.locator('[role=meter]').count(),2);
    assert((await ft.innerText()).includes('LIVE chưa hiệu chỉnh xác suất'));assert((await ft.innerText()).includes('Mốc đầu: Tài 2.5 @ 2.70'));
    assert((await ft.innerText()).includes('Đã cập nhật tỷ số & phút'));
    assert((await ft.innerText()).includes('Mốc đầu ↔ hiện tại'));
    const fairLocator=ft.locator('.fe-lsp-metric').filter({hasText:'Fair Odds'}).locator('b');
    const fairBefore=await fairLocator.innerText();
    const firstSession=await ft.locator('.fe-lsp-ft-session div').innerText();
    await page.evaluate(()=>{const s=__ftQA.items[0].latest;s.minute=60;s.captured_at=Date.now();s.market_rows[0].update=new Date(s.captured_at).toISOString();window.dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForFunction(previous=>{const cell=[...document.querySelectorAll('#ftAIV2ReadOnly .fe-lsp-metric')].find(e=>e.textContent.includes('Fair Odds'));return cell?.querySelector('b')?.textContent!==previous;},fairBefore);
    assert.equal(await ft.locator('.fe-lsp-ft-session div').innerText(),firstSession,'ORIGINAL_QUOTE_CHANGED_ON_MINUTE_UPDATE');
    const afterUpdate=await fairLocator.innerText();assert.notEqual(afterUpdate,fairBefore,'FAIR_DID_NOT_UPDATE');
    // Only the countdown changes in the absence of a new source observation.
    const clockBefore=await ft.locator('[data-ft-session-clock]').innerText();
    await page.waitForFunction(previous=>document.querySelector('#ftAIV2ReadOnly [data-ft-session-clock]')?.textContent!==previous,clockBefore);
    assert.equal(await fairLocator.innerText(),afterUpdate,'CLOCK_FABRICATED_MODEL_UPDATE');
    await ft.locator('.fe-lsp-ft-change summary').click();

    await ft.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/ft-valuation-'+width+'.png',fullPage:true});
    assert.equal(await ft.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'FT_OVERFLOW');
    await page.evaluate(()=>{const s=__ftQA.items[0].latest;s.captured_at=Date.now();s.market_rows[0].update=new Date(s.captured_at).toISOString();s.market_rows[0].values[0].odd=1.05;window.dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForSelector('#ftAIV2ReadOnly [data-ft-session="PAUSED"]');assert.equal(await ft.locator('.fe-lsp-ft-change').evaluate(e=>e.open),false,'DETAILS_REOPENED_ON_UPDATE');
    assert((await ft.innerText()).includes('Mốc đầu: Tài 2.5 @ 2.70'));
    await page.evaluate(()=>{const s=__ftQA.items[0].latest;s.captured_at=Date.now();s.market_rows[0].update=new Date(s.captured_at).toISOString();s.market_rows[0].values[0].odd=2.8;window.dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForSelector('#ftAIV2ReadOnly [data-ft-session="ACTIVE"]');
    await page.evaluate(()=>{const s=__ftQA.items[0].latest;s.captured_at=Date.now();s.goals.home=2;s.market_rows[0].update=new Date(s.captured_at).toISOString();s.market_rows[0].values.forEach(v=>v.handicap=3.5);window.dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForSelector('#ftAIV2ReadOnly [data-ft-session="INVALIDATED"]');assert((await ft.innerText()).includes('ĐÁNH GIÁ LẠI SAU BIẾN ĐỘNG'));

   }else if(tab==='hc'){
    try{await page.waitForSelector('[data-hc-research-panel]:not([hidden]) .hc-research-card',{timeout:10000});}catch(e){console.log('HC_DIAGNOSTIC '+JSON.stringify(await page.evaluate(()=>({url:location.href,api:typeof FEHCResearchPreview,mode:window.FETabsIntegrated?.mode(),packet:window.FETabsIntegrated?.read()?.lists,panel:document.querySelector('[data-hc-research-panel]')?.outerHTML,rows:window.FEHCResearchPreview?.read(),stats:window.FEHCResearchPreview?.stats()}))));console.log('HC_ERRORS '+JSON.stringify({errors,badAssets}));await page.screenshot({path:out+'/hc-failure.png',fullPage:true});throw e;}
    const panel=page.locator('[data-hc-research-panel]'),contract=panel.locator('.hc-contract');assert.equal(await panel.locator('.hc-research-card').count(),1);
    assert.equal(await panel.locator('[data-fixture="920002"]').count(),1,'DISPLAY_ORDER_CHANGED');
    assert.equal(await page.locator('.fe-lsp-mechanism .fe-lsp-panel').count(),2,'LEGACY_HC_REPLACED');
    const exact=await page.evaluate(()=>FEHCResearchPreview.contracts());assert.equal(exact[0].sourceId,'live:book:qa');assert.equal(exact[0].settlementVerified,false);assert.equal(exact[0].timestampBasis,'HUB_RECEIPT');assert((await panel.innerText()).includes('LIVE · Dữ liệu và thị trường'));const readiness=await page.evaluate(()=>FEHCResearchPreview.readiness());assert.equal(readiness[0].tradeReady,false);assert(readiness[0].blockers.includes('LIVE_PROBABILITY_UNCALIBRATED'));assert(readiness[0].blockers.includes('SOURCE_SETTLEMENT_OR_QUOTE_NOT_VERIFIED'));
    await page.locator('.fe-lsp-item[href="#fe-tabs/hc/920001"]').click();await panel.locator('[data-fixture="920001"]').waitFor();
    await panel.locator('.hc-scenarios>summary').click();assert.equal(await panel.locator('.hc-scenarios[open]').count(),1);
    const firstFair=await contract.locator('.hc-numbers strong').nth(1).innerText();
    const hcDeadline=await page.evaluate(()=>FEHCResearchPreview.sessions().find(s=>s.fixtureId===920001).expiresAt);
    assert((await panel.locator('[data-hc-original]').innerText()).includes('@ 2.10'));
    await page.evaluate(()=>{__hcQA.items[1].latest.market.quotes[0].homeOdd=2.7;dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForFunction(()=>document.querySelector('[data-hc-research-panel] .hc-contract .hc-numbers strong')?.textContent==='2.70');
    assert.equal(await contract.locator('.hc-numbers strong').nth(1).innerText(),firstFair,'ODDS_CHANGED_MODEL_PROBABILITY');assert((await panel.locator('[data-hc-original]').innerText()).includes('@ 2.10'));assert((await panel.locator('[data-hc-current]').innerText()).includes('@ 2.70'));assert.equal(await page.evaluate(()=>FEHCResearchPreview.sessions().find(s=>s.fixtureId===920001).expiresAt),hcDeadline);assert.equal(await panel.locator('.hc-scenarios[open]').count(),1,'DETAIL_STATE_LOST');
    await panel.locator('.hc-source-audit>summary').click();assert((await panel.innerText()).includes('Market ID: 33'));assert((await panel.innerText()).includes('Chủ nhà chấp'));
    await page.screenshot({path:out+'/hc-linked-'+width+'.png',fullPage:true});
    const overflow=await panel.evaluate(e=>({bad:e.scrollWidth>e.clientWidth+1,items:[...e.querySelectorAll('*')].filter(x=>x.scrollWidth>x.clientWidth+2).slice(0,8).map(x=>({tag:x.tagName,cls:x.className,w:x.clientWidth,sw:x.scrollWidth}))}));if(overflow.bad)console.log('HC_OVERFLOW_DETAIL '+JSON.stringify(overflow));assert.equal(overflow.bad,false,'HC_OVERFLOW');
    const reads=await page.evaluate(()=>FEHCResearchPreview.stats().reads);await page.evaluate(()=>{for(let i=0;i<100;i++)dispatchEvent(new Event('fe-notify-sync-updated'));});
    await page.waitForTimeout(250);assert((await page.evaluate(()=>FEHCResearchPreview.stats().reads))-reads<=3,'HC_EVENT_STORM_REPEATED_READS');
    await page.evaluate(()=>{__hcQA.controls=[{id:920001,cooldownUntil:Date.now()+100000}];dispatchEvent(new Event('fe-notify-sync-updated'));});
    await panel.locator('[data-status="DATA_WAIT"]').waitFor();assert.equal(await contract.locator('.hc-numbers').count(),0,'COOLDOWN_PRICE_LEAK');
    await page.evaluate(()=>{__hcQA.controls=[];__hcQA.items[1].latest.captured_at=Date.now()-61000;dispatchEvent(new Event('fe-notify-sync-updated'));});
    await panel.locator('[data-status="DATA_WAIT"]').waitFor();assert.equal(await contract.locator('.hc-numbers').count(),0,'STALE_PRICE_LEAK');
    await page.evaluate(()=>{const it=__hcQA.items[1];it.latest.captured_at=Date.now();it.latest.market.quotes[0].quoteAt=Date.now();__hcQA.bundles=__hcQA.bundles.filter(b=>b.meta.fixture_id!==920001);dispatchEvent(new Event('fe-notify-sync-updated'));});
    await panel.locator('[data-status="MODEL_WAIT"]').waitFor();assert((await panel.innerText()).includes('MISSING_DEEP_CONTEXT'));
    await page.evaluate(()=>{__hcQA.items=__hcQA.items.filter(i=>i.id!==920001);dispatchEvent(new Event('fe-notify-sync-updated'));});
    await panel.locator('[data-fixture="920001"][data-hc-recorded="true"]').waitFor();
    assert((await panel.locator('[data-hc-original]').innerText()).includes('@ 2.10'));assert.equal(await panel.locator('[data-hc-session="PAUSED"]').count(),1);
    await page.evaluate(expiry=>{window.__realHCClock=Date.now;Date.now=()=>expiry+1;FEHCResearchPreview.refresh();},hcDeadline);
    await page.waitForFunction(()=>!document.querySelector('[data-hc-research-panel] [data-fixture="920001"]'));
    await page.evaluate(()=>{Date.now=__realHCClock;__hcQA.items[0].latest.captured_at=Date.now();__hcQA.items[0].latest.market.quotes[0].quoteAt=Date.now();});
    await page.locator('[data-ftabs-tab="hc"]').click();await panel.locator('[data-fixture="920002"]').waitFor();
   }else assert.equal(await page.locator('.fe-lsp-mechanism .fe-lsp-panel').count(),2,'OTHER_TAB_CHANGED_'+tab);
  }
  assert.equal(await page.locator('[data-hc-research-panel]:not([hidden])').count(),0,'HC_PANEL_LEAKED_TO_HT');
  await page.locator('[data-ftabs-fixture="990092"]').click();await page.waitForSelector('.htp-card[data-htp-id="990092"]',{state:'visible'});
  // A selected fixture leaving TOP must retain only a clearly historical quote.
  const anchor=await page.evaluate(()=>FEHTPricingView.recorded().find(r=>r.id===990092).startedAt);
  await page.evaluate(()=>{__htRecoveryQA.items=__htRecoveryQA.items.filter(x=>x.id!==990092);window.dispatchEvent(new Event('fe-notify-sync-updated'));window.dispatchEvent(new Event('fe-ht-context-updated'));});
  await page.waitForSelector('[data-ht-recorded-detail] .htp-card[data-state="RECORDED"]');
  assert((await page.locator('[data-ht-recorded-detail]').innerText()).includes('Không còn trong nguồn hiện tại'));
  assert((await page.locator('[data-ht-recorded-detail]').innerText()).includes('@ 2.70'));
  await page.evaluate(start=>{Date.now=()=>start+360000;window.dispatchEvent(new Event('fe-ht-context-updated'));},anchor);
  await page.waitForFunction(()=>document.querySelector('[data-ht-recorded-detail]')?.textContent.includes('@ 2.70'));
  assert.equal(await page.locator('[data-ht-recorded-link="990092"]').count(),1,'RETAINED_QUOTE_LOST_BEFORE_10_MINUTES');
  await page.screenshot({path:out+'/ht-retained-'+width+'.png',fullPage:true});
  await page.evaluate(start=>{Date.now=()=>start+660000;window.dispatchEvent(new Event('fe-ht-context-updated'));},anchor);
  await page.waitForFunction(()=>!FEHTPricingView.recorded().some(r=>r.id===990092));
  assert.equal(await page.locator('[data-ht-recorded-detail]').count(),0,'HISTORICAL_QUOTE_NOT_EXPIRED');
  assert.equal(await page.locator('[data-ht-recorded-link="990092"]').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
  results.push({width,status:'PASS',HC_real_shell_readonly_bridge:true,HC_source_rule_wait_and_cooldown:true,HC_selected_fixture_and_quote_updates:true,HC_five_minute_original_current_and_historical_expiry:true,HT_probability_percent_and_exact_settlement:true,HT_real_module_auto_mount:true,selected_fixture_preserved:true,pricing_session_and_goal_chart:'PASS',quote_update_original_deadline_and_goal_invalidation:'PASS',other_five_tabs_and_ftv2_stable_root:'PASS',metrics,blocked_requests:blocked});await ctx.close();
 }
 const off=await browser.newContext({serviceWorkers:'block'});await off.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin||u.pathname.startsWith('/api/')||route.request().method()!=='GET')return route.abort();if(!candidate)return route.continue();const p=u.pathname==='/'?'index.html':u.pathname.slice(1);try{return route.fulfill({status:200,body:readFileSync('ht-probability-package/site/'+p),contentType:p.endsWith('.css')?'text/css':/\.(?:m?js)$/.test(p)?'application/javascript':'text/html'});}catch{return route.fulfill({status:404,body:''});}});const offPage=await off.newPage();await offPage.goto(origin+'/?hcResearch=0#fe-tabs/hc',{waitUntil:'networkidle'});assert.equal(await offPage.locator('[data-hc-research-panel]').count(),0,'PREVIEW_NOT_OPT_IN');assert.equal(await offPage.evaluate(()=>typeof FEHCResearchPreview),'undefined');await off.close();
 }finally{await browser.close();}
 writeFileSync(out+'/report.json',JSON.stringify({status:'PASS',mode,synthetic_readonly_bridge_inputs:true,physical_phone_and_real_live:'NOT_VERIFIED',results},null,2));console.log('HC_CONTRACT_BROWSER '+JSON.stringify({status:'PASS',mode,results}));
})().catch(e=>{console.error(e);process.exitCode=1;});

