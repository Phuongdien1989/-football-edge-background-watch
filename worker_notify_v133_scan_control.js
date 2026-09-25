import base,{BackgroundWatcher as NativeWatcher} from './worker_notify_v132_native.js';

// V1.33: persistent user-controlled background scan pause/resume.
// Additive/non-regression only: scoring, thresholds, calibration, DQ, push transports,
// validation and API budgets are inherited unchanged from V1.32.
const CONTROL_KEY='notify:scan-control';
const STATUS_KEY='notify:status';
const PAUSED_HEARTBEAT_MS=60000;
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
const short=e=>String(e?.message||e||'UNKNOWN').slice(0,180);

function normalizeControl(raw){
  const paused=raw?.paused===true;
  return {
    schema:'FE_SCAN_CONTROL_V1',
    paused,
    state:paused?'PAUSED_BY_USER':'RUNNING',
    updated_at:Number(raw?.updated_at||0)||null,
    updated_by:raw?.updated_by||null
  };
}

export class BackgroundWatcher extends NativeWatcher{
  async scanControl(){
    return normalizeControl(await this.ctx.storage.get(CONTROL_KEY));
  }

  async writePausedStatus(control,now=Date.now()){
    const previous=await this.ctx.storage.get(STATUS_KEY)||{};
    const status={
      ...previous,
      at:now,
      paused:true,
      scan_state:'PAUSED_BY_USER',
      control_updated_at:control.updated_at,
      live:0,
      scanned:0,
      alertsAccepted:0,
      errors:[]
    };
    await this.ctx.storage.put(STATUS_KEY,status);
    return status;
  }

  async setScanPaused(paused){
    const now=Date.now();
    const control=normalizeControl({paused:!!paused,updated_at:now,updated_by:'USER'});
    await this.ctx.storage.put(CONTROL_KEY,control);
    if(control.paused){
      await this.writePausedStatus(control,now);
      await this.ctx.storage.setAlarm(now+PAUSED_HEARTBEAT_MS);
    }else{
      const previous=await this.ctx.storage.get(STATUS_KEY)||{};
      await this.ctx.storage.put(STATUS_KEY,{...previous,at:now,paused:false,scan_state:'RESUMING',control_updated_at:control.updated_at,errors:[]});
      await this.ctx.storage.setAlarm(now+1000);
    }
    return control;
  }

  async fetch(request){
    const url=new URL(request.url),path=url.pathname;

    if(path==='/api/notify/scan-control'&&request.method==='GET'){
      return reply({ok:true,...await this.scanControl()});
    }

    if(path==='/api/notify/scan-control'&&request.method==='POST'){
      try{
        const raw=await request.text();
        if(raw.length>5000)return reply({ok:false,error:'REQUEST_TOO_LARGE'},413);
        const body=JSON.parse(raw||'{}');
        let paused;
        if(typeof body.paused==='boolean')paused=body.paused;
        else if(String(body.action||'').toLowerCase()==='pause')paused=true;
        else if(String(body.action||'').toLowerCase()==='resume')paused=false;
        else return reply({ok:false,error:'ACTION_REQUIRED',allowed:['pause','resume']},400);
        return reply({ok:true,...await this.setScanPaused(paused)});
      }catch(e){return reply({ok:false,error:'SCAN_CONTROL_UPDATE_FAILED',message:short(e)},500)}
    }

    // Preserve the existing status contract and add explicit scan-control state.
    if(path==='/api/notify/status'&&request.method==='GET'){
      const response=await super.fetch(request);
      const data=await response.json().catch(()=>({}));
      const control=await this.scanControl();
      return reply({...data,control,paused:control.paused,scan_state:control.state},response.status);
    }

    return super.fetch(request);
  }

  async alarm(){
    const control=await this.scanControl();
    if(!control.paused)return super.alarm();

    // Intentionally do not call super.alarm(): while paused this prevents all inherited
    // watch/notify/validation scan cycles from making upstream football API requests.
    try{
      await this.writePausedStatus(control);
    }finally{
      // Keep only a low-cost Durable Object heartbeat so status remains fresh and a user
      // can resume immediately. No football-provider API call is made in this branch.
      await this.ctx.storage.setAlarm(Date.now()+PAUSED_HEARTBEAT_MS);
    }
  }
}

export default base;
