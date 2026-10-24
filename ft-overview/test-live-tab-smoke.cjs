const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
  await page.goto('https://shiny-silence-d892.ngophuonghuy.workers.dev/#fe-tabs/ftv2',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('[data-ftabs-tab="ftv2"]',{timeout:20000});
  await page.waitForSelector('#ftAIV2ReadOnly',{state:'visible',timeout:20000});
  assert.equal(await page.locator('#ftAIV2Card').count(),0,'DETACHED_CARD_STILL_PRESENT');
  assert.equal(await page.locator('.fe-lsp-header').count(),1,'LIGHT_SIGNAL_PRO_NOT_RENDERED');
  assert.equal(await page.locator('.fe-lsp-panel').count(),2,'LIGHT_SIGNAL_PRO_PANELS_MISSING');
  assert.equal(await page.locator('link[href="/ft-ai-v2/light-signal-pro.css"]').count(),1,'LIGHT_SIGNAL_STYLESHEET_MISSING');
  assert.equal(await page.locator('[data-ftabs-tab="ftv2"][aria-selected="true"]').count(),1,'FTV2_NOT_ACTIVE');
  await page.locator('[data-ftabs-tab="ht"]').click();
  await page.waitForSelector('[data-ftabs-tab="ht"][aria-selected="true"]',{timeout:8000});
  await page.locator('[data-ftabs-tab="ftv2"]').click();
  await page.waitForSelector('#ftAIV2ReadOnly',{state:'visible',timeout:8000});
  const status=await page.locator('#ftAIV2ReadOnly').innerText();
  assert(status.length>10,'FTV2_EMPTY_UI');
  assert(!errors.some(e=>/ft-ai-v2|render|tab/i.test(e)),'FATAL_UI_CONSOLE_'+errors.join(' | ').slice(0,180));
  console.log(JSON.stringify({status:'PASS',tab:'FTV2',ht_navigation:'PASS',return_navigation:'PASS',detached_card:false,ui_length:status.length,light_signal_pro:true,js_pageerrors:errors.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error('FT_V2_BROWSER_SMOKE_FAIL',e.message);process.exitCode=1});
