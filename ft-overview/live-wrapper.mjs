export function liveWrapper(files,originalModule){
 if(!/^[a-zA-Z0-9_./-]+\.(m?js)$/.test(originalModule))throw Error('UNSAFE_ORIGINAL_MODULE');
 return `import original from ${JSON.stringify('./'+originalModule)};
const files=${JSON.stringify(files)};
export default {async fetch(request,env,ctx){
const p=new URL(request.url).pathname;
if((p==='/'||p==='/index.html')&&files['original_index.html'])return new Response(files['original_index.html'],{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
if(p==='/ft-overview-live/'){const url=new URL(request.url);url.pathname='/ft-overview-live';return Response.redirect(url,307);}
if(p==='/ft-overview-live')return new Response(files['index.html'],{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-FE-Mode':'OVERVIEW_SHADOW'}});
const key=p.replace(/^\\//,'');if(p.startsWith('/ft-overview/')&&Object.hasOwn(files,key))return new Response(files[key],{headers:{'Content-Type':p.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
return original.fetch(request,env,ctx);
}};`;
}
