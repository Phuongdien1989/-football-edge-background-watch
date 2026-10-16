import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
const phase=process.argv[2],a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
if(!a||!t)throw Error('Cloudflare credentials unavailable');
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(a)+'/workers/scripts/';
const original={mobile:'8fc5b2ca-1ddb-4c0b-b161-c71141462ae5',desktop:'a332ee39-abb2-422d-a021-db78ef19cc10',backend:'2be01a61-cc5d-43c7-9c6d-13e581296453'};
const names={mobile:'shiny-silence-d892',desktop:'football-edge-desktop-b2-test',backend:'football-edge-background-watch',preview:'football-edge-mobile-sports-premium-preview'};
const publicRoot='https://shiny-silence-d892.ngophuonghuy.workers.dev';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function cf(path,opts={}){const r=await fetch(api+path,{...opts,headers:{Authorization:'Bearer '+t,'Content-Type':'application/json',...(opts.headers||{})},signal:AbortSignal.timeout(20000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare '+path+' HTTP '+r.status);return j.result}
async function active(name){const r=await cf(name+'/deployments'),v=r.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Traffic not one version at 100%: '+name);return v[0].version_id}
async function unchangedOthers(){for(const k of ['desktop','backend'])if(await active(names[k])!==original[k])throw Error('Unrelated version drift: '+k)}
async function bytes(url){const r=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Static resource HTTP '+r.status+' '+new URL(url).pathname);return Buffer.from(await r.arrayBuffer())}
if(phase==='preflight'){
 await unchangedOthers();if(await active(names.mobile)!==original.mobile)throw Error('Mobile drift');
 await cf(names.mobile+'/versions/'+original.mobile);
 const settings=await cf(names.mobile+'/settings');
 if((settings.bindings||[]).some(x=>!['assets','plain_text','secret_text'].includes(x.type)))throw Error('Mobile has unsupported bindings; refusing assets replacement');
 const base=await bytes(publicRoot+'/');if(hash(base)!=='d3ccb4205e993b3fd4a835be2853398945c2069d0b335f304c181d6077075efd')throw Error('Mobile source drift');
 writeFileSync('mobile-sports-premium/baseline.html',base);
 const staticHashes={};mkdirSync('mobile-sports-premium/production-site',{recursive:true});mkdirSync('mobile-sports-premium/release-backup',{recursive:true});
 writeFileSync('mobile-sports-premium/release-backup/index.html',base);
 for(const name of ['push-sw.js','manifest.webmanifest']){
  const b=await bytes(publicRoot+'/'+name);staticHashes[name]=hash(b);writeFileSync('mobile-sports-premium/production-site/'+name,b);writeFileSync('mobile-sports-premium/release-backup/'+name,b);
 }
 // Keep currently served optional icons and main SW when the response is truly that asset.
 for(const name of ['sw.js','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png']){
  const r=await fetch(publicRoot+'/'+name,{signal:AbortSignal.timeout(15000)}),type=r.headers.get('content-type')||'';
  if(r.ok&&(name.endsWith('.png')?type.startsWith('image/'):/(javascript|ecmascript)/.test(type))){const b=Buffer.from(await r.arrayBuffer());mkdirSync('mobile-sports-premium/production-site/'+name.split('/').slice(0,-1).join('/'),{recursive:true});writeFileSync('mobile-sports-premium/production-site/'+name,b);staticHashes[name]=hash(b)}
 }
 writeFileSync('mobile-sports-premium/release-state.json',JSON.stringify({original,staticHashes,originalHtml:hash(base)},null,2));
 console.log('MOBILE_PREFLIGHT_PASS',JSON.stringify({original,staticResourceNames:Object.keys(staticHashes),rollbackVerified:true}));
}else if(phase==='verify'){
 await unchangedOthers();const state=JSON.parse(readFileSync('mobile-sports-premium/release-state.json'));
 const want=hash(readFileSync('mobile-sports-premium/production-site/index.html'));
 let ok=false;for(let i=0;i<8;i++){try{if(hash(await bytes(publicRoot+'/'))===want){ok=true;break}}catch{}await new Promise(r=>setTimeout(r,1500))}
 if(!ok)throw Error('New production HTML hash not verified');
 for(const [name,h] of Object.entries(state.staticHashes))if(hash(await bytes(publicRoot+'/'+name))!==h)throw Error('Original resource changed '+name);
 const version=await active(names.mobile);if(version===original.mobile)throw Error('Mobile new version not active');
 const result={mobileVersion:version,htmlSha256:want,sourceCommit:process.env.GITHUB_SHA,rollbackVersion:original.mobile,desktopVersion:original.desktop,backendVersion:original.backend,pushSWUnchanged:true,scannerToggled:false};
 writeFileSync('mobile-sports-premium/release-result.json',JSON.stringify(result,null,2));console.log('MOBILE_APPLIED_VERIFIED',JSON.stringify(result));
}else if(phase==='rollback'){
 if(!existsSync('mobile-sports-premium/release-state.json')||!existsSync('mobile-sports-premium/deployment-attempted')){console.log('No production deployment attempted');process.exit(0)}
 const current=await active(names.mobile);if(current!==original.mobile)await cf(names.mobile+'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:original.mobile,percentage:100}],annotations:{'workers/message':'Restore pre-TOP-five Mobile after release verification failed'}})});
 if(await active(names.mobile)!==original.mobile||hash(await bytes(publicRoot+'/'))!=='d3ccb4205e993b3fd4a835be2853398945c2069d0b335f304c181d6077075efd')throw Error('ROLLBACK_NOT_VERIFIED');
 console.log('MOBILE_ROLLBACK_VERIFIED',original.mobile);
}else throw Error('Unknown phase');
