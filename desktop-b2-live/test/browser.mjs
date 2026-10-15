import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist');
const server=createServer(async(req,res)=>{
 let path=req.url.split('?')[0],filename=resolve(root,path==='/'?'index.html':'.'+path);
 if(filename!==root&&!filename.startsWith(root+sep)){res.writeHead(403).end();return}
 try{const data=await readFile(filename);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'}[extname(filename)]||'application/octet-stream'));res.end(data)}catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(18765,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const record=[];
try{
 for(const width of [375,390,430,768,1280,1440,1920]){
  const page=await browser.newPage({viewport:{width,height:850}});
  const errs=[],requests=[];
  page.on('pageerror',e=>errs.push(String(e?.message||e)));
  page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:18765/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(600);
  const result=await page.evaluate(()=>({
   desktop:document.body.classList.contains('fe-b2-enabled'),
   width:document.documentElement.scrollWidth,viewport:innerWidth,
   nativeBridge:typeof window.FE_B2_NATIVE?.fixtures==='function',
   addonBridge:typeof window.FEAddonBridge?.masterRows==='function',
   status:window.__FE_B2_DIAGNOSTICS__?.read(),
   nativeAnalysisCount:document.querySelectorAll('#analysisCard').length,
   controlEnabled:!document.getElementById('b2ScanControl').disabled,
   patchedPrototype:Object.prototype.hasOwnProperty.call(Element.prototype,'__fe_b2_override')
  }));
  assert.equal(result.desktop,width>=1200,`Responsive wrong ${width}`);
  assert.equal(result.width<=result.viewport,true,`Horizontal overflow ${width}: ${result.width}`);
  assert.equal(result.nativeBridge,true);
  assert.equal(result.addonBridge,true);
  assert.equal(result.nativeAnalysisCount,1);
  assert.equal(result.patchedPrototype,false);
  assert.equal(result.controlEnabled,false,'ON/OFF must be disabled until native scan status verified');
  assert.equal(requests.filter(x=>x.includes('/api/')).length,0,'No extra startup API calls with blank local config');
  if(width===1440){
   await page.locator('[data-b2-filter="LIVE"]').click();
   await page.locator('#b2Search').fill('never match');
   await page.locator('#b2Collapse').click();
   await page.locator('[data-b2-page="history"]').click();
   await page.locator('[data-b2-page="matches"]').click();
   const events=await page.evaluate(()=>({filter:document.querySelector('[data-b2-filter="LIVE"]').getAttribute('aria-pressed'),search:document.getElementById('b2Search').value,sidebar:document.body.classList.contains('fe-b2-sidebar-collapsed')}));
   assert.equal(events.filter,'true');assert.equal(events.search,'never match');assert.equal(events.sidebar,true);
  }
  const relevant=errs.filter(x=>!x.includes('The play() request was interrupted'));
  assert.equal(relevant.length,0,`JS errors ${width}: ${relevant.join(' | ')}`);
  record.push({width,result,errors:errs.length,requestsToApi:requests.filter(x=>x.includes('/api/')).length});
  await page.close();
 }
 // Browser storage is accessible with localhost, unlike about:blank.
 const a=await browser.newPage({viewport:{width:1440,height:820}});
 await a.goto('http://127.0.0.1:18765/',{waitUntil:'domcontentloaded'});
 const storage=await a.evaluate(()=>{const x='B2_TEST_LOCAL_ONLY';localStorage.setItem(x,'ok');const y=localStorage.getItem(x);localStorage.removeItem(x);return y});
 assert.equal(storage,'ok');await a.close();
 console.log('FE_B2_BROWSER_TEST_PASS '+JSON.stringify(record));
}catch(e){console.error('FE_B2_BROWSER_TEST_FAIL',e);process.exitCode=1}
finally{await browser.close();server.close()}
