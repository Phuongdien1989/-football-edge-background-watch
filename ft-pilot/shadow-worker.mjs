// LOCAL Cloudflare runtime only. No production Worker entrypoint change.
// This fixture intentionally has no provider API, schedule, alarm or Push code.
// It exercises the ACTUAL isolated FT Pilot recorder using Miniflare D1+DO.
import {scheduleFTPilot} from './integration.mjs';
export class FTPilotShadowDO {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
  const u=new URL(request.url);
  if(u.pathname==='/inspect'){
   const key='ft:pilot:v1:'+this.env.FT_PILOT_EPOCH+':';
   const pause=await this.ctx.storage.get(key+'paused');
   const budget=await this.ctx.storage.get(key+'sql-budget');
   return Response.json({pause:pause?.reason||null,
    sql_reserved:budget?.used??0,write_tokens_reserved:budget?.reserved_writes??0});
  }
  if(u.pathname!=='/event'||request.method!=='POST')return new Response('Not found',{status:404});
  const json=await request.json();
  const scheduled=scheduleFTPilot(this,json);
  return Response.json({scheduled});
 }
}
export default {
 async fetch(request,env){
  const target=env.SHADOW_DO.get(env.SHADOW_DO.idFromName('ft-pilot-one-epoch'));
  return target.fetch(request);
 }
};
