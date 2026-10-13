import base,{BackgroundWatcher as NativeWatcher} from './worker_notify_v132_native.js';

// P1.1 FULL BACKGROUND PAUSE
// Fixes scan-control semantics: PAUSE must stop ALL background API polling,
// including Smart Follow and Evidence inherited from the base watcher.
// Foreground/manual app requests remain available. No engine/threshold/D1 change.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});

export class BackgroundWatcher extends NativeWatcher{
  async alarm(){
    const control=typeof this.scanControl==='function'?await this.scanControl():{enabled:true,updated:0};
    if(control?.enabled===false){
      const prev=await this.ctx.storage.get('notify:status')||{};
      // Persist pause transition only once; repeated alarms must not consume DO writes.
      if(prev.paused!==true||prev.scanEnabled!==false||prev.pauseUpdated!==Number(control?.updated||0)){
        await this.ctx.storage.put('notify:status',{
          ...prev,
          at:Date.now(),
          paused:true,
          scanEnabled:false,
          pauseScope:'ALL_BACKGROUND_API',
          pauseUpdated:Number(control?.updated||0)
        });
      }
      // Deliberately do NOT call super.alarm() and do NOT reschedule.
      // Resume is already handled by worker_notify_v127 scan-control POST,
      // which sets a new alarm at Date.now()+1000.
      return;
    }
    return super.alarm();
  }

  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/api/notify/status'&&request.method==='GET'){
      const r=await super.fetch(request),d=await r.json().catch(()=>({}));
      const control=typeof this.scanControl==='function'?await this.scanControl():{enabled:true,updated:0};
      return reply({
        ...d,
        pause_scope:'ALL_BACKGROUND_API',
        full_background_paused:control?.enabled===false,
        scan_control:control,
        scan:{...(d?.scan||{}),paused:control?.enabled===false,scanEnabled:control?.enabled!==false,pauseScope:'ALL_BACKGROUND_API'}
      },r.status);
    }
    return super.fetch(request);
  }
}

export default base;
