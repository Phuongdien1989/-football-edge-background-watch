const assert=require('node:assert/strict'),{chromium}=require('playwright'),{readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',candidate=!process.argv.includes('--production'),mode=candidate?'candidate':'production',out='overview-top-package/qa/'+mode;
(async()=>{mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome'}),results=[];
try{for(const width of [320,375,390,1280]){const ctx=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'}),errors=[];let blocked=0;
await ctx.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==origin||u.pathname.startsWith('/api/')||r.method()!=='GET'){blocked++;return route.abort();}if(!candidate)return route.continue();const p=u.pathname==='/'?'index.html':u.pathname.slice(1);try{return route.fulfill({status:200,body:readFileSync('overview-top-package/site/'+p),contentType:p.endsWith('.css')?'text/css':/\.(?:m?js)$/.test(p)?'application/javascript':p.endsWith('.png')?'image/png':'text/html'});}catch{return route.fulfill({status:404,body:''});}});
  await ctx.addInitScript(()=>{
   const now=Date.now(),item=id=>({id,home:id===990091?'Arsenal':'Buriram United',away:id===990091?'Chelsea':'Beijing Guoan',league:'Regression League',state:'STRONG',eval:{score:79,scoreMode:'FULL',accel:.4,momentum:12,core:{pass:true},recent3:{status:'complete',window_min:3,delta:{sot:1}},recent5:{status:'complete',window_min:5,delta:{sot:2,xg:.38}},recent10:{status:'complete',window_min:10,delta:{sot:3}}},history:[],latest:{fixture:{fixture:{id,timestamp:Math.floor((now-18*60000)/1000)},teams:{home:{id:1},away:{id:2}},league:{name:'Regression League',country:'QA'}},captured_at:now,fresh_at:now,minute:18,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:6,sot:3,red:0}},stats_presence:{shots:true,sot:true,xg:true},market_at:now,market_rows:[{category:'h1_total',values:[{value:'Over',handicap:.5,odd:2.7}]}]}});
   window.__htRecoveryQA={items:[item(990091),item(990092)],context:{at:now-1000,rows:Array.from({length:8},(_,i)=>({fixture_id:800+i,kickoff:Math.floor((now-(i+1)*86400000)/1000),status:'FT',home_team_id:1,away_team_id:2,halftime_home:1,halftime_away:0}))}};
   const ftItem=id=>({id,home:'FT Home '+id,away:'FT Away '+id,league:'FT QA League',state:'STRONG',eval:{score:79,scoreMode:'FULL',accel:.4,momentum:12,core:{pass:true},recent3:{status:'complete',window_min:3,delta:{sot:1}},recent5:{status:'complete',window_min:5,delta:{sot:2,xg:.38}},recent10:{status:'complete',window_min:10,delta:{sot:3}}},history:[{captured_at:now-180000,goals:{home:1,away:0},metrics:{total:{shots:6,sot:2}},stats_presence:{shots:true,sot:true}}],latest:{fixture:{fixture:{id,timestamp:Math.floor((now-55*60000)/1000)},teams:{home:{id:1},away:{id:2}}},captured_at:now,minute:55,status:'2H',goals:{home:1,away:0},metrics:{total:{shots:10,sot:5}},stats_presence:{shots:true,sot:true},market_rows:[{category:'over_under',update:new Date(now).toISOString(),bookmaker:{name:'QA'},values:[{value:'Over',handicap:2.5,odd:2.7},{value:'Under',handicap:2.5,odd:1.55}]}]}});
   const recent=Array.from({length:8},(_,i)=>({date:new Date(now-(i+1)*86400000).toISOString(),status:'FT',home_id:1,away_id:2,goals:{home:3,away:2}}));
   window.__ftQA={items:[ftItem(910001),ftItem(910002)]};
   window.__ftBundles=__ftQA.items.map(it=>({observed_at:now,meta:{fixture_id:it.id,teams:{home:{id:1},away:{id:2}},fixture:{timestamp:Math.floor((now-55*60000)/1000),status:{short:'2H'}}},normalized:{home_recent:recent,away_recent:recent}}));
   const hcItem=id=>({id,home:'HC Home '+id,away:'HC Away '+id,league:'HC Integration League',eval:{state:'STRONG_HOME',gap:26,states:{liveGap:26}},latest:{captured_at:now,fresh_at:now,status:'2H',minute:55,goals:{home:0,away:1},metrics:{home:{shots:10,sot:4,xg:1.2,red:0},away:{shots:4,sot:1,xg:.3,red:0},dataTier:'FULL'},market:{quotes:[{book:'QA',sourceId:'live:book:qa',marketId:33,line:-.25,homeOdd:2.1,awayOdd:1.8,sourceQuote:true,period:'FT',quoteAt:now,timestampBasis:'HUB_RECEIPT',observedScore:{home:0,away:1}}]}}});
   window.__hcQA={items:[hcItem(920002),hcItem(920001)],controls:[],bundles:[920001,920002].map(id=>({meta:{fixture_id:id,teams:{home:{id:1},away:{id:2}},fixture:{timestamp:(now-55*60000)/1000}},normalized:{home_recent:recent,away_recent:recent}}))};
   window.__valuationQA=[910001,910002].map(id=>({id,rank:id===910001?1:2,snapshot:{id,home:'Valencia',away:'Villarreal',league:'La Liga · QA',at:now,status:'2H',minute:55,goals:{home:1,away:0},metrics:{sot:5,shots:10,xg:1.1},market:{line:2.5,over:2.7,under:1.55,at:now,score:{home:1,away:0},period:'FT',basis:'FULL_MATCH'}},quote:{fairOdds:2.25,ev:.198},modelOK:true,marketFresh:true,blocked:false,entry:'OPEN',reason:'QA assessed source',recommendation:{action:'TRIAL_OVER'}}));
   const original=Object.defineProperty;
   original(window,'FTOverviewPreview',{configurable:true,get:()=>({...window.__realOverviewQA,readDisplay:()=>structuredClone(__valuationQA)}),set:v=>{window.__realOverviewQA=v;}});
   Object.defineProperty=function(target,key,descriptor){
    if(target===window&&key==='FEAddonBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,masterRows:()=>window.__ovMasters||__ftQA.items.map((it,i)=>({id:it.id,ft:structuredClone(it),__rank:{top:i+1,primary:{engine:'FT'}}}))})};
    if(target===window&&key==='FEUIReadBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone({h1WatchState:{items:window.__htRecoveryQA.items},watchState:{items:window.__ftQA.items},handicapWatchState:{pool:window.__hcQA.items}})})};
    if(target===window&&key==='FEOverviewInputBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone([...window.__ftBundles,...window.__hcQA.bundles]),readControls:()=>structuredClone(window.__hcQA.controls)})};
    if(target===window&&key==='FEHTCandidateBridge')descriptor={...descriptor,value:Object.freeze({...descriptor.value,read:()=>structuredClone(window.__htRecoveryQA)})};
    return original(target,key,descriptor);
   };


 { const now=Date.now(),clone=x=>structuredClone(x),a=__htRecoveryQA.items[0],v=clone(__htRecoveryQA.items[1]),l=clone(v),d=__ftQA.items[0],m=__hcQA.items[1];
 a.home='Arsenal';a.away='Chelsea';a.league='Premier League';a.latest.minute=28;a.latest.fixture.league={name:a.league,country:'England'};a.latest.market_rows[0].values[0].odd=1.9;
 v.id=990092;v.home='Valencia';v.away='Villarreal';v.league='La Liga';v.latest.minute=32;v.latest.fixture.fixture.id=v.id;v.latest.fixture.league={name:v.league,country:'Spain'};v.eval.dataIncomplete=true;v.eval.scoreMode='DATA_INCOMPLETE';v.latest.data_health={level:'NO_STATS'};
 l.id=990093;l.home='Lyon';l.away='Lille';l.league='Ligue 1';l.latest.minute=19;l.latest.fixture.fixture.id=l.id;l.latest.fixture.league={name:l.league,country:'France'};l.latest.market_rows=[];l.state='CANDIDATE';
 __htRecoveryQA.items=[a,v,l];for(const r of __htRecoveryQA.context.rows){r.halftime_home=2;r.halftime_away=1;}
 d.home='Dortmund';d.away='Leipzig';d.league='Bundesliga';d.latest.minute=63;__ftQA.items=[d];
 m.home='Milan';m.away='Roma';m.league='Serie A';m.latest.goals={home:1,away:1};m.latest.minute=71;m.eval.recommendation='WATCH HOME';__hcQA.items=[m];
 __valuationQA=[{...__valuationQA[0],id:d.id,snapshot:{...__valuationQA[0].snapshot,home:d.home,away:d.away,league:d.league,minute:63},quote:{fairOdds:1.90,ev:.079},binary:{over:.48,under:.52},recommendation:{action:'TRIAL_OVER'}}];__valuationQA[0].snapshot.market.over=2.05;
 const history=it=>{const s=it.latest;it.history=[0,1,2,3,4].map((n,i)=>({captured_at:now-(5-i)*30000,goals:clone(s.goals),metrics:{total:{sot:n,shots:n+2}},stats_presence:{sot:true,shots:true}}));};for(const it of [a,v,l,d])history(it);
 __ovSources=[a,d,v,m,l];__ovMasters=__ovSources.map((it,i)=>({id:it.id,[it===m?'hc':it===d?'ft':'h1']:it,__rank:{top:i+1,primary:{engine:it===m?'HC':it===d?'FT':'H1'}}}));
 }
});
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto(origin+'/#fe-tabs/overview',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.FEHTPricingView&&document.querySelectorAll('[data-overview-id]').length===5);await page.evaluate(()=>FETabsIntegrated.refresh());
const book=await page.evaluate(()=>JSON.stringify(FEHTPricingView.sessions()));
const dash=page.locator('[data-overview-dashboard]');await dash.waitFor();
await page.waitForFunction(()=>document.querySelectorAll('[data-overview-id]').length===5);
assert.deepEqual(await dash.locator('[data-overview-id]').evaluateAll(es=>es.map(e=>Number(e.dataset.overviewId))),[990091,910001,990092,920001,990093]);
assert.equal(await dash.locator('[data-ready=true]').count(),2,'ASSESSED_RECOMMENDATION_COUNT');
assert((await dash.locator('[data-overview-id="990091"] .ov-recommendation').innerText()).includes('Tài HT 0.5 @ 1.90'));
assert((await dash.locator('[data-overview-id="910001"] .ov-recommendation').innerText()).includes('Tài FT 2.5 @ 2.05'));
assert.equal(await dash.locator('[data-overview-id][open]').count(),0);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'OVERVIEW_PAGE_OVERFLOW');
await dash.screenshot({path:out+'/overview-top5-'+width+'.png'});await page.screenshot({path:out+'/overview-top5-fullscreen-'+width+'.png',fullPage:true});
const first=dash.locator('[data-overview-id="990091"]');await first.locator('summary').click();assert(await first.evaluate(e=>e.open));
await page.evaluate(()=>{__ovSources[0].eval.reason='Updated native evidence';__ovSources[0].latest.metrics.total.sot++;dispatchEvent(new Event('fe-notify-sync-updated'));FETabsIntegrated.refresh();});
assert(await first.evaluate(e=>e.open),'OPEN_DETAIL_LOST');assert.equal(await page.evaluate(()=>JSON.stringify(FEHTPricingView.sessions())),book,'OVERVIEW_MODIFIED_HT_BOOK');
await first.locator('a[href="#fe-tabs/ht/990091"]').click();await page.waitForSelector('.htp-card[data-htp-id="990091"]');assert.equal(await page.evaluate(()=>FETabsIntegrated.mode().current),'ht');
await page.locator('[data-ftabs-tab=overview]').click();await dash.waitFor();
await page.evaluate(()=>{__ovMasters=__ovMasters.filter(x=>x.id!==990091);dispatchEvent(new Event('fe-notify-sync-updated'));FETabsIntegrated.refresh();});await page.waitForFunction(()=>document.querySelectorAll('[data-overview-id]').length===4);assert.equal(await dash.locator('[data-overview-id="990091"]').count(),0,'REMOVED_TOP_RESURRECTED');
await page.evaluate(()=>{const old=Date.now()-61000;for(const it of __ovSources){it.latest.captured_at=old;}for(const r of __valuationQA){r.snapshot.at=old;r.snapshot.market.at=old;}dispatchEvent(new Event('fe-notify-sync-updated'));FETabsIntegrated.refresh();});await page.waitForFunction(()=>document.querySelectorAll('[data-ready=true]').length===0);
await page.evaluate(()=>{__ovMasters=[];dispatchEvent(new Event('fe-notify-sync-updated'));FETabsIntegrated.refresh();});await dash.locator('.ov-empty').waitFor();assert.equal(await dash.locator('[data-overview-id]').count(),0);
assert.deepEqual(errors,[]);results.push({width,status:'PASS',five_distinct_source_ranked_matches:true,matching_HT_FT_valuations:true,no_fabricated_or_stale_entries:true,inline_detail_and_HT_route:true,HT_book_readonly:true,source_removal_and_empty_state:true,blocked_requests:blocked});await ctx.close();
}}
finally{await browser.close();}writeFileSync(out+'/overview-top5-report.json',JSON.stringify({status:'PASS',synthetic_readonly_bridge_inputs:true,results},null,2));console.log('OVERVIEW_TOP5_BROWSER '+JSON.stringify(results));})().catch(e=>{console.error(e);process.exitCode=1;});
