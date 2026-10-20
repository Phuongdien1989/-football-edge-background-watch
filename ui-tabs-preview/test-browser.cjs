const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {readFileSync,mkdirSync,writeFileSync}=require('node:fs');
const http=require('node:http');
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
(async()=>{
 let server;const target=process.env.PREVIEW_URL;
 if(!target){server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,allowed=['index.html','style.css','app.mjs','data.html','data-view.mjs','read-model.mjs','archive-data.mjs'],normal=p==='/'?'index.html':p.slice(1),ft=p.startsWith('/ft-overview/')?p.slice(13):null,file=allowed.includes(normal)?'ui-tabs-preview/'+normal:ft&&['ui.mjs','core.mjs','adapter.mjs','charts.mjs','demo.mjs','style.css'].includes(ft)?'ft-overview/'+ft:null;if(!file){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':(file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript')+'; charset=utf-8','Content-Security-Policy':csp});res.end(readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
 const base=(target||'http://127.0.0.1:'+server.address().port).replace(/\/$/,''),origin=new URL(base).origin;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];mkdirSync('ui-tabs-preview/qa',{recursive:true});
 try{for(const width of [375,390,414,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],external=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(r.url());if(new URL(r.url()).origin!==origin)external.push(r.url());});
 const response=await page.goto(base,{waitUntil:'networkidle'});assert.equal(response.status(),200);assert(response.headers()['content-security-policy'].includes("connect-src 'none'"));
 await page.waitForSelector('.rank-row');assert.equal(await page.locator('[role=tab]').count(),5);assert.equal(await page.locator('.rank-row').count(),5);
 assert.equal(new Set(await page.locator('.rank-row').evaluateAll(xs=>xs.map(x=>x.hash))).size,5);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'ui-tabs-preview/qa/overview-'+width+'.png',fullPage:true});
 await page.locator('[data-tab=valuation]').click();await page.waitForURL('**/#valuation');await page.waitForFunction(()=>document.querySelector('#content').getAttribute('aria-labelledby')==='tab-valuation');assert.equal(await page.locator('.rank-row').count(),1);
 await page.locator('.rank-row').click();await page.waitForSelector('.chart');assert((await page.locator('main').innerText()).includes('DATA × MARKET'));
 const a=page.locator('details').first();await a.locator('summary').click();assert(await a.evaluate(x=>x.open));
 if(width===390)await page.screenshot({path:'ui-tabs-preview/qa/detail-390.png',fullPage:true});
 await page.locator('[data-tab=ht]').click();await page.waitForFunction(()=>document.querySelector('#content').getAttribute('aria-labelledby')==='tab-ht');assert.equal(await page.locator('.rank-row').count(),2);
 await page.goBack();await page.waitForSelector('.chart');assert(await page.locator('details').first().evaluate(x=>x.open));
 await page.locator('.back').click();await page.waitForURL('**/#valuation');await page.waitForSelector('.rank-row');assert.equal(await page.locator('.rank-row').count(),1);
 const n=requests.length;
 for(let i=0;i<3;i++)for(const key of ['overview','ht','ft','hc','valuation']){await page.locator('[data-tab='+key+']').click();await page.waitForURL('**/#'+key);await page.waitForFunction(k=>document.querySelector('#content').getAttribute('aria-labelledby')==='tab-'+k,key);}
 assert.equal(requests.length,n,'tab switch must not request resources');
 await page.locator('[data-nav=matches]').click();await page.locator('.search').fill('Coast');assert.equal(await page.locator('.rank-row').count(),1);
 await page.locator('[data-nav=follow]').click();await page.waitForSelector('.symbol');assert((await page.locator('main').innerText()).includes('Chưa kết nối'));
 await page.locator('[data-nav=settings]').click();await page.locator('[data-empty]').click();await page.locator('[data-tab=overview]').click();await page.waitForSelector('.empty');assert.equal(await page.locator('.rank-row').count(),0);assert(await page.locator('.empty').isVisible());
 if(width===390)await page.screenshot({path:'ui-tabs-preview/qa/empty-390.png',fullPage:true});
 await page.locator('[data-nav=settings]').click();await page.locator('[data-empty]').click();await page.locator('[data-tab=overview]').click();await page.waitForSelector('.rank-row');assert.equal(await page.locator('.rank-row').count(),5);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 results.push({width,status:'PASS',tabs:5,unique_fixtures:5,no_overflow:true,back_and_accordion_preserved:true,tab_switch_requests:0,external_requests:0,empty_state:true,search:true});await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await ctx.newPage(),dataErrors=[],dataExternal=[];
 page.on('pageerror',e=>dataErrors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==origin)dataExternal.push(r.url());});
 await page.goto(base+'/data.html#matches',{waitUntil:'networkidle'});await page.waitForSelector('.rank-row');assert.equal(await page.locator('.rank-row').count(),19);assert((await page.locator('#data-label').innerText()).includes('ARCHIVE'));
 await page.locator('.rank-row[href="#matches/1561414"]').click();await page.waitForSelector('.fixture-head');assert((await page.locator('main').innerText()).includes('Không phát khuyến nghị'));await page.locator('details').first().locator('summary').click();assert((await page.locator('details').first().innerText()).includes('shots: 31'));
 await page.screenshot({path:'ui-tabs-preview/qa/archive-detail-390.png',fullPage:true});
 await page.locator('[data-tab=overview]').click();await page.waitForSelector('.empty');assert.equal(await page.locator('.rank-row').count(),0);assert.equal(await page.evaluate(()=>FETabsReadOnly.read().top.length),0);
 await page.goto(base+'/data.html?mode=bridge#overview',{waitUntil:'networkidle'});await page.waitForSelector('.empty');assert.equal(await page.evaluate(()=>FETabsReadOnly.read().fixtures.length),0);
 await page.evaluate(()=>{const at=Date.now();const a={id:900101,home:'QA First',away:'QA Away',state:'READY',eval:{score:61},latest:{captured_at:at,status:'2H',minute:60,goals:{home:0,away:0},stats_presence:{shots:true},metrics:{total:{shots:0}}}},b=structuredClone(a);b.id=900102;b.home='QA Second';b.eval.score=92;window.FEUIReadBridge={read:()=>({watchState:{items:[a,b]},h1WatchState:{items:[]},handicapWatchState:{pool:[]}})};window.FEAddonBridge={masterRows:()=>[{id:a.id,ft:a,__rank:{top:1,primary:{engine:'FT'}}},{id:b.id,ft:b,__rank:{top:2,primary:{engine:'FT'}}}],request:()=>{throw Error('MUTATION_CALLED')},toggleManual:()=>{throw Error('MUTATION_CALLED')}};FETabsReadOnly.refresh();});
 await page.waitForSelector('.rank-row');assert.deepEqual(await page.evaluate(()=>FETabsReadOnly.read().top.map(x=>x.id)),[900101,900102]);assert.equal(await page.evaluate(()=>FETabsReadOnly.read().fixtures[0].signals.ft.score),61);
 await page.evaluate(()=>{const old=FEUIReadBridge.read,h=structuredClone(old().watchState.items[0]);h.latest.captured_at-=30000;h.latest.minute=30;h.latest.goals.home=1;window.FEUIReadBridge={read:()=>({...old(),h1WatchState:{items:[h]}})};location.hash='#ht/900101';});await page.waitForSelector('.fixture-head');assert((await page.locator('.fixture-head').innerText()).includes('30'));assert((await page.locator('.fixture-head').innerText()).includes('1–0'));
 const viewCheck=await page.evaluate(async()=>{const {mount}=await import('/ft-overview/ui.mjs'),root=document.createElement('div');root.style.display='none';document.body.append(root);const t=Date.now(),snap={id:900103,at:t,revision:t,minute:60,status:'2H',home:'QA Overview',away:'QA Opponent',goals:{home:0,away:0},metrics:{shots:0},history:[],statsError:false,model:{independent:true,kind:'RESEARCH',version:'QA_V1',at:t,pmf:[.1,.4,.4,.1]},market:{line:.5,over:1.5,under:3,period:'FT',basis:'FULL_MATCH',at:t,score:{home:0,away:0}}};const view=mount(root,{inputSource:()=>[snap],controlSource:()=>[],trialRecommendations:true});window.FTOverviewPreview=view;const before=JSON.stringify(view.read()),count=view.refreshCount;const out=view.readDisplay();out[0].snapshot.home='ALTERED COPY';FETabsReadOnly.refresh();const result={sameStore:before===JSON.stringify(view.read()),sameRefresh:count===view.refreshCount,detached:view.readDisplay()[0].snapshot.home==='QA Overview',separateTop:FETabsReadOnly.read().top.map(x=>x.id),valuation:FETabsReadOnly.read().lists.valuation};view.destroy();delete window.FTOverviewPreview;return result;});
 assert(viewCheck.sameStore&&viewCheck.sameRefresh&&viewCheck.detached);assert.deepEqual(viewCheck.separateTop,[900101,900102]);assert.deepEqual(viewCheck.valuation,[900103]);
 assert.deepEqual(dataErrors,[]);assert.deepEqual(dataExternal,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await ctx.close();
 results.push({source_adapter:'PASS',real_archive_fixtures:19,archive_top:0,no_legacy_mutations:true,separate_ranks:true,assessed_view_no_extra_render:true,external_requests:0});
 }finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
 writeFileSync('ui-tabs-preview/qa/'+(target?'https':'local')+'-result.json',JSON.stringify({status:'PASS',target:target?'ISOLATED_HTTPS':'CI_LOCAL',production_connected:false,results},null,2));console.log(JSON.stringify({status:'PASS',viewports:results.length,external_requests:0,tab_switch_requests:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
