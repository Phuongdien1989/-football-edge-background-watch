import base,{BackgroundWatcher as RetryWatcher} from './worker_notify_v126.js';

// P0.5: explicit manual scan start/stop control for notification scanner.
// Push subscription, scoring engines, thresholds and calibration are unchanged.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});

export class BackgroundWatcher extends RetryWatcher{
  async scanControl(){
    const c=await this.ctx.storage.get('notify:scan-control');
    return {enabled:c?.enabled!==false,updated:Number(c?.updated||0)};
  }

  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/api/notify/scan-control'){
      if(request.method==='OPTIONS')return reply({ok:true});
      if(request.method==='GET')return reply({ok:true,scan_control:await this.scanControl()});
      if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
      try{
        const raw=await request.text();if(raw.length>5000)return reply({error:'REQUEST_TOO_LARGE'},413);
        const b=JSON.parse(raw||'{}');
        if(typeof b.enabled!=='boolean')return reply({error:'ENABLED_REQUIRED'},400);
        const control={enabled:b.enabled,updated:Date.now()};
        await this.ctx.storage.put('notify:scan-control',control);
        const prev=await this.ctx.storage.get('notify:status')||{};
        await this.ctx.storage.put('notify:status',{...prev,at:Date.now(),paused:!control.enabled,scanEnabled:control.enabled});
        if(control.enabled)await this.ctx.storage.setAlarm(Date.now()+1000);
        return reply({ok:true,scan_control:control});
      }catch(e){return reply({error:String(e?.message||e).slice(0,160)},500)}
    }

    if(path==='/api/notify/scan-now'){
      if(request.method==='OPTIONS')return reply({ok:true});
      if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
      const control=await this.scanControl();
      if(!control.enabled)return reply({ok:false,error:'SCAN_PAUSED'},409);
      await this.ctx.storage.setAlarm(Date.now()+250);
      return reply({ok:true,scheduled:true});
    }

    if(path==='/api/notify/status'&&request.method==='GET'){
      const r=await super.fetch(request),d=await r.json().catch(()=>({}));
      const control=await this.scanControl();
      return reply({...d,scan_control:control,scan:{...(d?.scan||{}),paused:!control.enabled,scanEnabled:control.enabled}},r.status);
    }
    return super.fetch(request);
  }

  async notifyTick(){
    const control=await this.scanControl();
    if(!control.enabled)return;
    return super.notifyTick();
  }
}

export default base;
