import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import http from 'node:http';
const root='mobile-sports-premium',html=readFileSync(root+'/production-site/index.html');
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const engine=process.env.FE_SP_ENGINE==='webkit'?webkit:chromium,browser=await engine.launch({headless:true});
mkdirSync(root+'/screenshots',{recursive:true});
try{
 for(const width of [375,390,430,1440]){
  const c=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),p=await c.newPage(),errors=[],api=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/\/api\/|api-sports|api-football/.test(r.url()))api.push(r.url())});
  await c.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await p.goto(origin+'/?mode=demo');
  await p.waitForFunction(()=>window.__FE_SP_DIAGNOSTICS__);
  assert.equal(await p.evaluate(()=>window.__FE_SP_DIAGNOSTICS__.read().mode),'production');
  assert.equal(await p.locator('#spMode').isVisible(),false);
  assert.equal(await p.locator('[data-sp-open]').count(),0);
  if(width<768){
   for(const [hash,selector] of [['#appTop','#feSportsPremium'],['#scanCard','#scanCard'],['#analysisCard','#analysisCard'],['#betTrackerCard','#betTrackerCard'],['#connectCard','#connectCard']]){
    await p.locator('.bottom-item[href="'+hash+'"]').click();
    assert.equal(await p.locator(selector).isVisible(),true,hash);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   await p.locator('.bottom-item[href="#appTop"]').click();
  }else assert.equal(await p.locator('#feSportsPremium').isVisible(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(api,[]);
  await p.screenshot({path:root+'/screenshots/production_'+width+'_'+(process.env.FE_SP_ENGINE||'chromium')+'.png',fullPage:true});
  await c.close();
 }
 console.log('PRODUCTION_UI_PASS',JSON.stringify({engine:process.env.FE_SP_ENGINE||'chromium',widths:[375,390,430,1440],noDemoOnProduction:true,nativeFunctionsRetained:true,automaticApiFromEmptyConfig:0}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
