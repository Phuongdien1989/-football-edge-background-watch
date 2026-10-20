// Rasterize the supplied SVG using WebKit already installed for UI acceptance.
const {webkit}=require('playwright'),assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {createHash}=require('node:crypto');
(async()=>{
 const svg=readFileSync('ui-tabs-preview/icon.svg','utf8'),out='ui-tabs-preview/generated/icons';
 mkdirSync(out+'/icons',{recursive:true});writeFileSync(out+'/favicon.svg',svg);
 const browser=await webkit.launch({headless:true}),sizes=[180,192,512],files=[];
 try{for(const size of sizes){const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});await page.route('**/*',r=>r.abort());await page.setContent('<body style="margin:0;background:white"><img width="'+size+'" height="'+size+'" src="data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')+'">');await page.locator('img').evaluate(x=>x.decode());const p=out+'/icons/icon-'+size+'.png';await page.locator('img').screenshot({path:p});const png=readFileSync(p);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);files.push({path:'icons/icon-'+size+'.png',width:size,height:size,sha256:createHash('sha256').update(png).digest('hex')});await page.close();}}finally{await browser.close();}
 const report={status:'PASS',source:'user-supplied favicon.svg',source_sha256:createHash('sha256').update(svg).digest('hex'),files};writeFileSync('ui-tabs-preview/generated/icon-build.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
