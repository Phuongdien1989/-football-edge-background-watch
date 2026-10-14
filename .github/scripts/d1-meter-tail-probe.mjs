// Transport preflight: opens ephemeral authenticated Cloudflare Workers tail,
// sends read-only /health, never prints tail event bodies or credentials.
const key=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!key||!account)throw Error('AUTH_MISSING');
const name='football-edge-background-watch';
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+name+'/tails';
const call=async(url,method)=>{
 const r=await fetch(url,{method,headers:{authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.success===false)throw Error('TAIL_'+method+'_HTTP_'+r.status+'_CODES_'+(data.errors||[]).map(x=>x.code).join(','));
 return data.result;
};
let created,ws;
try{
 created=await call(root,'POST');
 if(!created?.url||!created?.id)throw Error('TAIL_SESSION_SHAPE_INVALID');
 const result=await new Promise(resolve=>{
  let opened=false,received=false,finished=false;
  ws=new WebSocket(created.url);
  const finish=()=>{if(!finished){finished=true;resolve({opened,received});}};
  const stop=setTimeout(finish,9500);
  ws.addEventListener('open',async()=>{
   opened=true;
   try{await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(5000)});}catch{}
  });
  ws.addEventListener('message',()=>{received=true;clearTimeout(stop);finish()});
  ws.addEventListener('error',()=>{clearTimeout(stop);finish()});
  ws.addEventListener('close',()=>{clearTimeout(stop);finish()});
 });
 console.log('FE_AUTH_TAIL_TRANSPORT '+JSON.stringify({api:'PASS',websocket:result.opened?'PASS':'FAIL',received_request_event:result.received,production_deploy:'NOT_ATTEMPTED'}));
 if(!result.opened||!result.received)process.exitCode=2;
}finally{
 try{ws?.close()}catch{}
 if(created?.id)try{await call(root+'/'+encodeURIComponent(created.id),'DELETE')}catch{}
}
