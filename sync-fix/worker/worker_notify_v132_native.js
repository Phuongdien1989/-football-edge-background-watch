import base,{BackgroundWatcher as ValidationWatcher} from './worker_notify_v131.js';

// N1.0: native Push transport adapter (Android FCM HTTP v1 + iOS APNs token auth).
// Additive only: web Push transport, H1/FT/HC scoring, thresholds, cadence, ranking,
// validation and D1 logic remain inherited from V1.31 unchanged.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
const enc=new TextEncoder();
const text=e=>String(e?.message||e||'UNKNOWN').slice(0,180);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)));
const b64uBytes=bytes=>{
  let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);
  return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
};
const b64uText=s=>b64uBytes(enc.encode(String(s)));
const pemBytes=pem=>{
  const raw=String(pem||'').replace(/-----BEGIN [^-]+-----/g,'').replace(/-----END [^-]+-----/g,'').replace(/\\n/g,'\n').replace(/\s+/g,'');
  if(!raw)throw new Error('PRIVATE_KEY_EMPTY');
  const bin=atob(raw),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out.buffer;
};
async function sha256Id(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(s))))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function nativePrefs(p={}){return {
  enabled:p.enabled!==false,h1:p.h1!==false,goal:p.goal!==false,gap:p.gap!==false,
  h1Threshold:Number.isFinite(Number(p.h1Threshold))?clamp(p.h1Threshold,1,100):72,
  goalThreshold:Number.isFinite(Number(p.goalThreshold))?clamp(p.goalThreshold,1,100):70,
  gapThreshold:Number.isFinite(Number(p.gapThreshold))?clamp(p.gapThreshold,1,100):70
}}
function validNative(platform,token){
  const p=String(platform||'').toLowerCase(),t=String(token||'').trim();
  if(p==='ios')return /^[a-fA-F0-9]{64,256}$/.test(t.replace(/[<>\s]/g,''));
  if(p==='android')return t.length>=20&&t.length<=4096&&/^[A-Za-z0-9_:\-.]+$/.test(t);
  return false;
}
function fcmConfig(env){
  try{const x=JSON.parse(String(env.FCM_SERVICE_ACCOUNT_JSON||''));return x?.project_id&&x?.client_email&&x?.private_key?x:null}catch{return null}
}
async function signJwtRS256(sa){
  const now=Math.floor(Date.now()/1000),h=b64uText(JSON.stringify({alg:'RS256',typ:'JWT'})),p=b64uText(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})),input=h+'.'+p;
  const key=await crypto.subtle.importKey('pkcs8',pemBytes(sa.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(input));return input+'.'+b64uBytes(sig);
}
async function signJwtES256(keyId,teamId,p8){
  const now=Math.floor(Date.now()/1000),h=b64uText(JSON.stringify({alg:'ES256',kid:keyId})),p=b64uText(JSON.stringify({iss:teamId,iat:now})),input=h+'.'+p;
  const key=await crypto.subtle.importKey('pkcs8',pemBytes(p8),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(input));return input+'.'+b64uBytes(sig);
}
function dataPayload(payload={}){return {
  url:String(payload.url||''),tag:String(payload.tag||''),fixture_id:String(payload.fixture_id||''),
  fe_mode:String(payload.fe_mode||''),created_at:String(payload.created_at||Date.now())
}}

export class BackgroundWatcher extends ValidationWatcher{
  async nativeCapabilities(){
    return {ok:true,schema:'FE_NATIVE_PUSH_CAPS_V1',fcm_configured:!!fcmConfig(this.env),apns_configured:!!(this.env.APNS_KEY_ID&&this.env.APNS_TEAM_ID&&this.env.APNS_PRIVATE_KEY),apns_bundle_id:this.env.APNS_BUNDLE_ID||'vn.footballedge.app',apns_environment:this.env.APNS_ENV||'sandbox',note:'Native transport only. Existing Web Push remains unchanged.'};
  }

  async fcmAccessToken(){
    const sa=fcmConfig(this.env);if(!sa)throw new Error('FCM_NOT_CONFIGURED');
    const cache=await this.ctx.storage.get('notify:native:fcm-oauth');if(cache?.token&&Number(cache.exp||0)>Date.now()+120000)return {token:cache.token,projectId:sa.project_id};
    const assertion=await signJwtRS256(sa),body=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion});
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(12000)}),j=await r.json().catch(()=>({}));
    if(!r.ok||!j.access_token)throw new Error('FCM_OAUTH_'+r.status+':'+String(j.error_description||j.error||'FAILED').slice(0,100));
    const exp=Date.now()+Math.max(300,Number(j.expires_in||3600)-120)*1000;await this.ctx.storage.put('notify:native:fcm-oauth',{token:j.access_token,exp});return {token:j.access_token,projectId:sa.project_id};
  }

  async sendFcm(device,payload){
    const a=await this.fcmAccessToken(),r=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(a.projectId)}/messages:send`,{
      method:'POST',headers:{authorization:'Bearer '+a.token,'content-type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({message:{token:device.token,
        notification:{title:String(payload.title||'Football Edge'),body:String(payload.body||'')},data:dataPayload(payload),
        android:{priority:'high',notification:{channel_id:'football_edge_signals',sound:'default',tag:String(payload.tag||'football-edge')}}}})
    });
    const raw=await r.text();if(!r.ok){if(r.status===404||/UNREGISTERED|registration-token-not-registered/i.test(raw))await this.ctx.storage.delete('notify:device:'+device.id);throw new Error('FCM_HTTP_'+r.status+':'+raw.slice(0,120))}return true;
  }

  async apnsJwt(){
    if(!this.env.APNS_KEY_ID||!this.env.APNS_TEAM_ID||!this.env.APNS_PRIVATE_KEY)throw new Error('APNS_NOT_CONFIGURED');
    const cache=await this.ctx.storage.get('notify:native:apns-jwt');if(cache?.token&&Number(cache.exp||0)>Date.now()+120000)return cache.token;
    const token=await signJwtES256(String(this.env.APNS_KEY_ID),String(this.env.APNS_TEAM_ID),String(this.env.APNS_PRIVATE_KEY)),exp=Date.now()+45*60000;await this.ctx.storage.put('notify:native:apns-jwt',{token,exp});return token;
  }

  async sendApns(device,payload){
    const jwt=await this.apnsJwt(),env=String(device.apns_env||this.env.APNS_ENV||'sandbox').toLowerCase(),host=env==='production'?'https://api.push.apple.com':'https://api.sandbox.push.apple.com',topic=String(this.env.APNS_BUNDLE_ID||'vn.footballedge.app'),token=String(device.token||'').replace(/[<>\s]/g,'');
    const body={aps:{alert:{title:String(payload.title||'Football Edge'),body:String(payload.body||'')},sound:'default','thread-id':'football-edge'},...dataPayload(payload)};
    const r=await fetch(`${host}/3/device/${encodeURIComponent(token)}`,{method:'POST',headers:{authorization:'bearer '+jwt,'apns-topic':topic,'apns-push-type':'alert','apns-priority':'10','apns-expiration':'0','content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)}),raw=await r.text();
    if(!r.ok){if(r.status===410||/BadDeviceToken|Unregistered/i.test(raw))await this.ctx.storage.delete('notify:device:'+device.id);throw new Error('APNS_HTTP_'+r.status+':'+raw.slice(0,120))}return true;
  }

  async sendNative(device,payload){
    if(device.platform==='android')return this.sendFcm(device,payload);
    if(device.platform==='ios')return this.sendApns(device,payload);
    throw new Error('NATIVE_PLATFORM_UNSUPPORTED');
  }

  async send(device,payload){
    if(device?.transport!=='native')return super.send(device,payload);
    const ok=await this.sendNative(device,payload);
    if(ok){try{await this.recordPushValidation(payload)}catch(e){console.log('Native push validation capture failed',text(e))}}
    return ok;
  }

  async fetch(request){
    const url=new URL(request.url),path=url.pathname;
    if(path==='/api/notify/native/capabilities'&&request.method==='GET')return reply(await this.nativeCapabilities());
    if(path==='/api/notify/native/subscribe'&&request.method==='POST'){
      try{
        const raw=await request.text();if(raw.length>50000)return reply({error:'REQUEST_TOO_LARGE'},413);const b=JSON.parse(raw||'{}'),platform=String(b.platform||'').toLowerCase(),token=String(b.token||'').trim();
        if(!this.env.APISPORTS_KEY)return reply({error:'APISPORTS_NOT_CONFIGURED'},503);
        if(!validNative(platform,token))return reply({error:'INVALID_NATIVE_TOKEN'},400);
        const id=await sha256Id('native:'+platform+':'+token),devices=await this.devices();if(devices.length>=10&&!devices.some(d=>d.id===id))return reply({error:'DEVICE_LIMIT_10'},409);
        const d={id,transport:'native',platform,token,prefs:nativePrefs(b.prefs),updated:Date.now(),app_version:String(b.app_version||'').slice(0,40)||null,native_version:String(b.native_version||'').slice(0,40)||null,apns_env:platform==='ios'?String(b.apns_env||this.env.APNS_ENV||'sandbox').toLowerCase():null};
        await this.ctx.storage.put('notify:device:'+id,d);await this.ctx.storage.setAlarm(Date.now()+1000);
        const caps=await this.nativeCapabilities();return reply({ok:true,id,platform,transport:'native',sender_ready:platform==='android'?caps.fcm_configured:caps.apns_configured});
      }catch(e){return reply({error:'NATIVE_SUBSCRIBE_FAILED',message:text(e)},500)}
    }
    return super.fetch(request);
  }
}

export default base;
