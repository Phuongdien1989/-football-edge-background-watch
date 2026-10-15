// Football Edge Desktop B2 TEST-ONLY static frontend. Does not proxy or write to D1.
// Never attach to any phone production route or Worker name.
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/__b2/health')return new Response(JSON.stringify({ok:true,service:'football-edge-desktop-b2-test',baseline_sha256:'aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28',scope:'FRONTEND_ONLY',production_replaced:false}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  return env.ASSETS.fetch(request);
 }
};
