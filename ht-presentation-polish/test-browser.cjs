const assert=require('node:assert/strict'),{chromium}=require('playwright'),{readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',baseline=process.argv.includes('--baseline'),candidate=process.argv.includes('--candidate')||baseline,before=false,folder=baseline?'backup':'site',mode=baseline?'baseline':candidate?'candidate':'production',out='ht-polish-release/qa/'+mode;
(async()=>{
 mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome'}),results=[];
 try{for(const width of before?[390]:[320,375,390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],badAssets=[];let blocked=0;
  await ctx.route('**/*',route=>{const r=route.request(),u=new URL(r.url());
   if(u.origin!==origin||u.pathname.startsWith('/api/')||r.method()!=='GET'){blocked++;return route.abort();}
   if(before||candidate){const p=u.pathname==='/'?'index.html':u.pathname.slice(1);try{const b=readFileSync('ht-polish-release/'+folder+'/'+p);return route.fulfill({status:200,body:b,contentType:p.endsWith('.css')?'text/css':/\.(?:m?js)$/.test(p)?'application/javascript':p.endsWith('.html')?'text/html':p.endsWith('.png')?'image/png':'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}}
   return route.continue();
  });
  // Replace only read-only bridge inputs at their definition boundary. The
  // production HTML/modules, navigation and HT automatic mounting run unchanged.
  await ctx.addInitScript(()=>{
   const now=Date.now(),item=id=>({id,home:'HT Home '+id,away:'HT Away '+id,league:'Regression League',state:'STRONG',eval:{score:79,scoreMode:'FULL'},history:[],latest:{fixture:{fixture:{id,timestamp:Math.floor((now-18*60000)/1000)},teams:{home:{id:1},away:{id:2}},league:{name:'Regression League',country:'QA'}},captured_at:now,fresh_at:now,minute:18,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:6,sot:3,red:0}},stats_presence:{shots:true,sot:true},market_at:now,market_rows:[{category:'h1_total',values:[{value:'Over',handicap:.5,odd:2.7}]}]}});
   window.__htRecoveryQA={items:[item(990091),item(990092)],context:{at:now-1000,rows:Array.from({length:8},(_,i)=>({fixture_id:800+i,kickoff:Math.floor((now-(i+1)*86400000)/1000),status:'FT',home_team_id:1,away_team_id:2,halftime_home:1,halftime_away:0}))}};
   const original=Object.defineProperty;
   Object.defineProperty=function(target,key,descriptor){
    if(target===window&&key==='FEUIReadBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone({h1WatchState:{items:window.__htRecoveryQA.items},watchState:{items:[]},handicapWatchState:{pool:[]}})})};
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
  await card.scrollIntoViewIfNeeded();const closedHeight=await card.evaluate(e=>e.getBoundingClientRect().height);await card.screenshot({path:out+'/ht-compact-'+width+'.png'});
  await card.locator('details summary').click();await card.locator('.htp-chart').waitFor({state:'visible'});assert.equal(await card.locator('.htp-chart>div').count(),5);
  const metrics=await card.evaluate(e=>({values:[...e.querySelectorAll('.htp-values b')].map(x=>x.textContent),title:getComputedStyle(e.querySelector('h3')).fontSize,odds:getComputedStyle(e.querySelector('.htp-odds')).fontSize,overflow:e.scrollWidth>e.clientWidth+1}));metrics.closedHeight=closedHeight;assert.equal(metrics.title,baseline?'16px':'15px');assert.equal(metrics.odds,baseline?'24px':'22px');assert.equal(metrics.overflow,false);
  await card.screenshot({path:out+'/ht-auto-route-'+width+'.png'});
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
   }else assert.equal(await page.locator('.fe-lsp-mechanism .fe-lsp-panel').count(),2,'OTHER_TAB_CHANGED_'+tab);
  }
  await page.locator('[data-ftabs-fixture="990092"]').click();await page.waitForSelector('.htp-card[data-htp-id="990092"]',{state:'visible'});
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
  results.push({width,status:'PASS',HT_real_module_auto_mount:true,selected_fixture_preserved:true,pricing_session_and_goal_chart:'PASS',quote_update_original_deadline_and_goal_invalidation:'PASS',other_five_tabs_and_ftv2_stable_root:'PASS',metrics,blocked_requests:blocked});await ctx.close();
 }
 }finally{await browser.close();}
 if(!baseline){const old=JSON.parse(readFileSync('ht-polish-release/qa/baseline/report.json'));for(const row of results){const reference=old.results.find(r=>r.width===row.width);assert(row.metrics.closedHeight<=reference.metrics.closedHeight+8,'HT_CARD_GREW_'+row.width);assert.deepEqual(row.metrics.values,reference.metrics.values,'NUMERIC_DISPLAY_CHANGED_'+row.width);}}
 writeFileSync(out+'/report.json',JSON.stringify({status:'PASS',mode,synthetic_readonly_bridge_inputs:true,physical_phone_and_real_live:'NOT_VERIFIED',results},null,2));console.log('HT_POLISH_BROWSER '+JSON.stringify({status:'PASS',mode,results}));
})().catch(e=>{console.error(e);process.exitCode=1;});
