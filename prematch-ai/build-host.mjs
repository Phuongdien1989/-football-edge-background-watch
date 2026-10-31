// Copies a verified asset package to a LOCAL isolated preview only.
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync,cpSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),source=resolve(root,process.argv[2]||'mechanism-mobile/site'),target=resolve(root,'prematch-ai/generated/host');
if(!existsSync(resolve(source,'index.html')))throw Error('VERIFIED_MOBILE_PACKAGE_REQUIRED');
cpSync(source,target,{recursive:true});mkdirSync(resolve(target,'prematch-ai'),{recursive:true});
for(const f of ['contracts.mjs','model.mjs','pricing.mjs','narrative.mjs','runtime.mjs','evidence.mjs','lab.mjs','worker.mjs','view.mjs','view.css','host.mjs'])copyFileSync(resolve(root,'prematch-ai',f),resolve(target,'prematch-ai',f));
const artifact=JSON.parse(readFileSync(resolve(root,'prematch-ai/generated/lab-artifact.json')));
const bootstrap=`<link rel="stylesheet" href="./prematch-ai/view.css"><script type="module">import{mountPREPreview}from'./prematch-ai/host.mjs';window.PREHostPreview=mountPREPreview({enabled:true,labArtifact:${JSON.stringify(artifact)}});</script>`;
let html=readFileSync(resolve(target,'index.html'),'utf8');
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\' data: blob:; script-src \'self\' \'unsafe-inline\' blob:; style-src \'self\' \'unsafe-inline\'; connect-src \'self\'; img-src \'self\' data:; worker-src \'self\' blob:">');
html=html.replace('</body>',bootstrap+'</body>');writeFileSync(resolve(target,'index.html'),html);
writeFileSync(resolve(root,'prematch-ai/generated/host-proof.json'),JSON.stringify({status:'LOCAL_PREVIEW_ONLY',sourcePackage:source,originalSourceNotModified:true,productionEntrypointImported:false,csp:'SAME_ORIGIN_ONLY_NO_PRODUCTION_CONNECTION'},null,2));
console.log('LOCAL_HOST_PREVIEW_BUILT');
