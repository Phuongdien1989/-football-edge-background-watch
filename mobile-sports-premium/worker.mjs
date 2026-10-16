/** Preview frontend only: no API proxy, no backend bindings, no scan or D1 writes. */
export default {
 async fetch(request,env){
   const url=new URL(request.url);
   if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405,headers:{'Cache-Control':'no-store'}});
   if(url.pathname==='/__sports/health')return Response.json({ok:true,service:'football-edge-mobile-sports-premium-preview',scope:'FRONTEND_ONLY',preview:true,production_replaced:false,backend_deployed:false,auto_scan:false,push_registration:false,base_sha256:'aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28'}, {headers:{'Cache-Control':'no-store'}});
   if(url.pathname!=='/'&&url.pathname!=='/index.html')return new Response('Not Found',{status:404,headers:{'Cache-Control':'no-store'}});
   const base=await env.ASSETS.fetch(new Request(new URL('/',url),request));
   if(!base.ok)return new Response('Preview site unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
   const h=new Headers(base.headers);
   h.set('Cache-Control','no-store, max-age=0');
   h.set('X-Content-Type-Options','nosniff');
   h.set('Content-Type','text/html; charset=utf-8');
   h.set('X-Frame-Options','DENY');
   h.set('Referrer-Policy','no-referrer');
   // Default DEMO cannot contact any API, load external images or register workers.
   if(url.searchParams.get('mode')!=='connected')h.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'self'");
   else h.set('Content-Security-Policy',"default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data:; connect-src 'self' https:; worker-src 'none'; object-src 'none'; base-uri 'self'");
   return new Response(base.body,{status:base.status,headers:h});
 }
};
