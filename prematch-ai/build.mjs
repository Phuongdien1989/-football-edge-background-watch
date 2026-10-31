// Dependency-free bundler for this closed set of named-export ES modules.
// It emits an offline HTML preview, not a production package or deployment.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {trainArtifact} from './fit.mjs';
import {trainingLab} from './lab.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'prematch-ai/generated');mkdirSync(out,{recursive:true});
export function bundle(entry){
 const ids=new Map(),parts=[];
 function visit(path){if(ids.has(path))return ids.get(path);if(!path.startsWith(root+'/'))throw Error('OUTSIDE_SOURCE_TREE');const id='m'+ids.size;ids.set(path,id);let source=readFileSync(path,'utf8');const imports=[];
 source=source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_,names,p)=>{imports.push([names,visit(resolve(dirname(path),p))]);return '';});
 if(/\bimport\s*\(/.test(source)||/^\s*import\s/m.test(source))throw Error('UNSUPPORTED_IMPORT_'+relative(root,path));
 const names=[];source=source.replace(/export\s+(async\s+)?(function|const|let|class)\s+([A-Za-z_$][\w$]*)/g,(_,a='',kind,name)=>{names.push(name);return a+kind+' '+name;});if(/^\s*export\s/m.test(source))throw Error('UNSUPPORTED_EXPORT');
 const intro=imports.map(([ns,dep])=>'const {'+ns.replace(/\s+as\s+/g,':')+'}='+dep+';').join('\n');
 parts.push('const '+id+'=(()=>{\n'+intro+'\n'+source+'\nreturn {'+names.join(',')+'};})();');return id;
 }
 const id=visit(resolve(root,entry));return {code:parts.join('\n'),id};
}
const worker=bundle('prematch-ai/worker.mjs'),view=bundle('prematch-ai/view.mjs'),artifact=await trainArtifact(trainingLab());
const boot=view.code+`\nconst workerSource=${JSON.stringify(worker.code)};const labArtifact=${JSON.stringify(artifact)};let workerURLs=[];const app=${view.id}.mount(document.getElementById('app'),{labArtifact,workerFactory(){const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));workerURLs.push(url);const w=new Worker(url);w.addEventListener('message',()=>URL.revokeObjectURL(url),{once:true});return w;}});window.PMPreview=Object.freeze({load:app.load,read:app.getResult});window.addEventListener('pagehide',()=>{app.destroy();workerURLs.forEach(u=>URL.revokeObjectURL(u));},{once:true});`;
const html='<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' blob:; style-src \'unsafe-inline\'; worker-src blob:; connect-src \'none\'; img-src data:; base-uri \'none\'"><title>Football Edge · PRE-MATCH AI V1 Preview</title><style>body{margin:0;background:#f3f8fc}'+readFileSync(resolve(root,'prematch-ai/view.css'),'utf8')+'</style></head><body><div id="app"></div><script>'+boot.replace(/<\/script/gi,'<\\/script')+'</script></body></html>';
writeFileSync(resolve(out,'index.html'),html);writeFileSync(resolve(out,'lab-artifact.json'),JSON.stringify(artifact,null,2));writeFileSync(resolve(out,'worker-bundle.js'),worker.code);writeFileSync(resolve(out,'build-report.json'),JSON.stringify({schema:'FE_PREMATCH_BUILD_V1',status:'BUILT_NOT_DEPLOYED',htmlBytes:Buffer.byteLength(html),providerRequests:0,productionWrites:0,syntheticArtifact:true,modelHash:artifact.hash},null,2));
console.log(JSON.stringify({status:'BUILT_NOT_DEPLOYED',htmlBytes:Buffer.byteLength(html),providerRequests:0}));
