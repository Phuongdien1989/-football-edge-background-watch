import base,{BackgroundWatcher as QuotaWatcher} from './worker_notify_v137_quota50000.js';

// Account-local daily scan window. Engines, thresholds and in-window cadence
// remain inherited. Manual PAUSE remains stronger than the daily schedule.
const MINUTE=60000,DAY=86400000,OFFSET=7*60*MINUTE;
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*'}});
function clock(value){
  const m=/^(\d{2}):(\d{2})$/.exec(String(value));
  if(!m||Number(m[1])>23||Number(m[2])>59)throw Error('PEAK_WINDOW_INVALID_CLOCK');
  return Number(m[1])*60+Number(m[2]);
}
export function peakWindow(env,now=Date.now()){
  const enabled=String(env.PEAK_SCAN_ENABLED||'false')==='true';
  if(!enabled)return {enabled:false,allowed:true,timezone:'Asia/Ho_Chi_Minh'};
  const start=clock(env.PEAK_SCAN_START||'20:00'),end=clock(env.PEAK_SCAN_END||'00:00');
  if(start===end)throw Error('PEAK_WINDOW_EMPTY_OR_FULL_DAY_NOT_ALLOWED');
  const localDay=Math.floor((now+OFFSET)/DAY)*DAY-OFFSET;
  const minute=(now-localDay)/MINUTE;
  const allowed=start<end?minute>=start&&minute<end:minute>=start||minute<end;
  const nextStart=localDay+start*MINUTE+(minute>=start?DAY:0);
  let closesAt=null;
  if(allowed)closesAt=localDay+end*MINUTE+(start>end&&minute>=start?DAY:0);
  return {enabled:true,allowed,timezone:'Asia/Ho_Chi_Minh',start:env.PEAK_SCAN_START||'20:00',end:env.PEAK_SCAN_END||'00:00',activeMinutes:(end-start+1440)%1440,nextStart,closesAt};
}

export class BackgroundWatcher extends QuotaWatcher{
  async scanControl(){
    const manual=await super.scanControl(),window=peakWindow(this.env);
    return {...manual,manualEnabled:manual.enabled!==false,enabled:manual.enabled!==false&&window.allowed,scheduledPaused:manual.enabled!==false&&!window.allowed,peak_window:window};
  }
  async armPeakWake(window){
    // A single wake-up at the opening boundary, never a 20-second idle loop.
    const previous=await this.ctx.storage.getAlarm();
    if(previous!==window.nextStart)await this.ctx.storage.setAlarm(window.nextStart);
  }
  async alarm(){
    const control=await this.scanControl();
    if(!control.manualEnabled)return super.alarm();
    if(!control.peak_window.allowed){
      await super.alarm(); // Existing full-pause path skips all inherited polling.
      await this.armPeakWake(control.peak_window);
      return;
    }
    try{return await super.alarm();}
    finally{
      const after=await this.scanControl();
      if(after.manualEnabled&&!after.peak_window.allowed)await this.armPeakWake(after.peak_window);
    }
  }
  async api(path,params={},strict=false){
    const window=peakWindow(this.env);
    // Also stops a scan which crosses the closing boundary mid-flight.
    // Requests already sent cannot be cancelled; no new API call is reserved.
    if(!window.allowed){const e=Error('SCAN_OUTSIDE_PEAK_WINDOW');e.nextStart=window.nextStart;throw e;}
    return super.api(path,params,strict);
  }
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/api/notify/peak-wake'&&request.method==='POST'){
      const control=await this.scanControl();
      if(!control.manualEnabled)return reply({ok:true,paused:true,peak_window:control.peak_window});
      if(control.peak_window.allowed){
        const previous=await this.ctx.storage.getAlarm();
        if(previous==null||previous<=Date.now())await this.ctx.storage.setAlarm(Date.now()+1000);
      }else await this.armPeakWake(control.peak_window);
      return reply({ok:true,scan_control:control});
    }
    if(path==='/api/notify/peak-window'&&request.method==='GET')return reply({ok:true,scan_control:await this.scanControl(),next_alarm:await this.ctx.storage.getAlarm()});
    return super.fetch(request);
  }
}

export default {...base,async fetch(request,env,ctx){
  const response=await base.fetch(request,env,ctx);
  if(new URL(request.url).pathname==='/health'&&response.ok){
    const health=await response.json();
    const id=env.BACKGROUND_WATCHER.idFromName('football-edge-global');
    const status=await env.BACKGROUND_WATCHER.get(id).fetch(new Request('https://internal/api/notify/peak-window'));
    if(!status.ok)return reply({...health,peak_window:peakWindow(env),peak_status_error:'HTTP_'+status.status},503);
    const peak=await status.json();
    return reply({...health,peak_window:peakWindow(env),peak_status:peak.scan_control,next_alarm:peak.next_alarm});
  }
  return response;
},async scheduled(controller,env){
  // Daily start also recovers a worker with no existing alarm after deployment.
  const id=env.BACKGROUND_WATCHER.idFromName('football-edge-global');
  const response=await env.BACKGROUND_WATCHER.get(id).fetch(new Request('https://internal/api/notify/peak-wake',{method:'POST'}));
  if(!response.ok)throw Error('PEAK_WAKE_HTTP_'+response.status);
}};
