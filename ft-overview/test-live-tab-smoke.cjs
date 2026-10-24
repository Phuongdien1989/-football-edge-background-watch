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
  // The same FT V2 root must survive repeat source-refresh and tab events without remount.
  const sameRoot=await page.evaluate(()=>{
    const root=document.getElementById('ftAIV2ReadOnly');
    for(let i=0;i<20;i++){window.dispatchEvent(new Event('fe-notify-sync-updated'));window.dispatchEvent(new Event('fe-ft-v2-tab-open'));}
    return document.getElementById('ftAIV2ReadOnly')===root&&root.dataset.ftV2Mounted==='true';
  });
  assert(sameRoot,'FTV2_REINITIALIZED_ON_REFRESH');

  assert.equal(await page.locator('.fe-lsp-header').count(),1,'LIGHT_SIGNAL_PRO_NOT_RENDERED');
  assert.equal(await page.locator('.fe-lsp-panel').count(),2,'LIGHT_SIGNAL_PRO_PANELS_MISSING');
  assert.equal(await page.locator('link[href="/ft-ai-v2/light-signal-pro.css"]').count(),1,'LIGHT_SIGNAL_STYLESHEET_MISSING');
  assert.equal(await page.locator('[data-ftabs-tab="ftv2"][aria-selected="true"]').count(),1,'FTV2_NOT_ACTIVE');
  await page.locator('[data-ftabs-tab="ht"]').click();
  await page.waitForSelector('[data-ftabs-tab="ht"][aria-selected="true"]',{timeout:8000});
  await page.locator('[data-ftabs-tab="ht"]').click();
  await page.waitForSelector('.fe-lsp-original [data-ftabs-tools]',{state:'visible',timeout:8000});
  await page.locator('.fe-lsp-original [data-ftabs-tools]').click();
  assert.equal(await page.locator('body[data-fe-tabs-tools="true"]').count(),1,'ORIGINAL_HT_TOOL_NOT_OPEN');
  await page.waitForSelector('#h1WatchCard',{state:'visible',timeout:8000});
  await page.locator('[data-ftabs-tab="ftv2"]').click();
  await page.waitForSelector('#ftAIV2ReadOnly',{state:'visible',timeout:8000});
  for(const tab of ['overview','ht','ft','hc','valuation']){
    await page.locator('[data-ftabs-tab="'+tab+'"]').click();
    await page.waitForSelector('[data-ftabs-tab="'+tab+'"][aria-selected="true"]',{timeout:8000});
    await page.waitForSelector('.fe-lsp-mechanism',{state:'visible',timeout:8000});
    assert.equal(await page.locator('.fe-lsp-mechanism .fe-lsp-panel').count(),2,'SHARED_PANELS_MISSING_'+tab);
  }
  await page.locator('[data-ftabs-tab="ftv2"]').click();
  await page.waitForSelector('#ftAIV2ReadOnly',{state:'visible',timeout:8000});
  const status=await page.locator('#ftAIV2ReadOnly').innerText();
  assert(status.length>10,'FTV2_EMPTY_UI');
  assert(!errors.some(e=>/ft-ai-v2|render|tab/i.test(e)),'FATAL_UI_CONSOLE_'+errors.join(' | ').slice(0,180));
  console.log(JSON.stringify({status:'PASS',tab:'FTV2',ht_navigation:'PASS',return_navigation:'PASS',detached_card:false,ui_length:status.length,light_signal_pro:true,shared_mechanisms:5,js_pageerrors:errors.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error('FT_V2_BROWSER_SMOKE_FAIL',e.message);process.exitCode=1});
