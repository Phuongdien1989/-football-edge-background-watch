import base,{BackgroundWatcher as ExistingWatcher} from './worker_notify_v137_quota50000.js';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,OPTIONS'}});
export class BackgroundWatcher extends ExistingWatcher{
  async uiLiveSet(fixtures){const now=Date.now();await this.ctx.storage.put('notify:ui-live',{at:now,ids:fixtures.map(f=>Number(f.fixture.id))});
    if(now-Number(await this.ctx.storage.get('notify:ui-purge-at')||0)>300000){for(const [key,row]of await this.ctx.storage.list({prefix:'notify:ui:'}))if(now-row.captured_at>3600000)await this.ctx.storage.delete(key);await this.ctx.storage.put('notify:ui-purge-at',now);}
  }
  async publishUISnapshot(f,s,engines,health,publicationError=null,runtime={}){
    const id=Number(f.fixture.id),key='notify:ui:'+id,old=await this.ctx.storage.get(key),at=Number(s?.captured_at||Date.now());
    if(old&&at<old.captured_at)throw Error('UI_PUBLICATION_OUT_OF_ORDER');
    const row={schema:'FE_NOTIFY_UI_SNAPSHOT_V1',fixture_id:id,captured_at:at,revision:Number(old?.revision||0)+1,fixture:f,snapshot:s||null,engines:engines||{},source_health:health||{},publication_error:publicationError,runtime};
    const bytes=new TextEncoder().encode(JSON.stringify(row));if(bytes.length>300000)throw Error('UI_SNAPSHOT_TOO_LARGE');
    row.version=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    await this.ctx.storage.put(key,row);return row.version;
  }
  async send(device,payload){
    if(payload?.fixture_id){if(!this.env.FRONTEND_APP_URL)throw Error('UI_FRONTEND_NOT_CONFIGURED');const row=await this.ctx.storage.get('notify:ui:'+payload.fixture_id);
      if(!row||row.captured_at!==payload.created_at||row.publication_error)throw Error('UI_SNAPSHOT_NOT_COMMITTED');
      const original=new URL(payload.url),u=new URL(original.pathname+original.search+original.hash,this.env.FRONTEND_APP_URL);u.searchParams.set('fe_snapshot',row.version);
      payload={...payload,snapshot_version:row.version,snapshot_revision:row.revision,url:u.toString()};
    }const accepted=await super.send(device,payload);
    if(accepted===true&&payload?.fixture_id){await this.ctx.storage.put('notify:ui-alert:'+device.id+':'+payload.fixture_id,{snapshot_version:payload.snapshot_version,created_at:payload.created_at,signals:payload.signals||{},delivery:'PUSH_SERVICE_ACCEPTED'}).catch(e=>console.log('UI alert audit write failed',e.message));}
    return accepted;
  }
  async fetch(request){
    const u=new URL(request.url);if(u.pathname!=='/api/notify/ui-state')return super.fetch(request);
    if(!this.env.BACKGROUND_TOKEN||request.headers.get('authorization')!=='Bearer '+this.env.BACKGROUND_TOKEN)return reply({error:'Unauthorized'},401);
    if(request.method!=='GET')return reply({error:'METHOD_NOT_ALLOWED'},405);
    return this.notifyWork(async()=>{
      const live=await this.ctx.storage.get('notify:ui-live'),requested=Number(u.searchParams.get('fixture'));
      const stored=await this.ctx.storage.list({prefix:'notify:ui:'});const active=new Set(live?.ids||[]),now=Date.now();
      const device=u.searchParams.get('device'),snapshots=await Promise.all([...stored.values()].filter(r=>now-r.captured_at<=3600000).sort((a,b)=>(b.fixture_id===requested)-(a.fixture_id===requested)||b.captured_at-a.captured_at).slice(0,120).map(async r=>{const {goal_by_device,...runtime}=r.runtime||{};return {...r,runtime,goal_estimate:device?goal_by_device?.[device]||null:null,active_live:active.has(r.fixture_id),live_checked_at:live?.at||null,last_notification:device?await this.ctx.storage.get('notify:ui-alert:'+device+':'+r.fixture_id)||null:null};}));
      return reply({schema:'FE_NOTIFY_UI_STATE_V1',server_at:now,snapshots,live_count:active.size,live_checked_at:live?.at||null,source:'NOTIFY_DURABLE_OBJECT'});
    });
  }
}
export default base;
