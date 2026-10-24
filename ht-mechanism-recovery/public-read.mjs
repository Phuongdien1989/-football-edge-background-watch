import assert from 'node:assert/strict';

// Cloudflare static HTML handling redirects /page.html to /page. Follow only
// bounded same-origin static paths; every caller still verifies the exact bytes.
export async function readPublicStatic(url,fetcher=fetch){
 const origin=new URL(url).origin;let current=url;
 for(let hops=0;hops<=3;hops++){
  const response=await fetcher(current,{headers:{'Cache-Control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(25000)});
  if(![301,302,303,307,308].includes(response.status))return response;
  assert(hops<3,'STATIC_REDIRECT_LIMIT');const target=new URL(response.headers.get('location')||'',current);
  assert.equal(target.origin,origin,'STATIC_REDIRECT_EXTERNAL');assert(!target.pathname.startsWith('/api/'),'STATIC_REDIRECT_API');
  await response.body?.cancel();current=target.href;
 }
 throw Error('STATIC_REDIRECT_LIMIT');
}
