(()=>{
  'use strict';
  const C=window.Capacitor;
  const isNative=!!(C&&typeof C.isNativePlatform==='function'&&C.isNativePlatform());
  if(!isNative)return;

  const $=id=>document.getElementById(id);
  const platform=String(C.getPlatform?.()||'native').toLowerCase();
  const Push=C.Plugins?.PushNotifications;
  const STORE={device:'fe_native_device_id_v1',platform:'fe_native_platform_v1'};
  let registeredToken=null,listenersBound=false,busy=false;

  document.documentElement.dataset.feNative='capacitor';
  document.body.classList.add('fe-native-shell');

  const workerConfig=()=>{
    const base=String($('backgroundWorkerUrl')?.value||'').trim().replace(/\/$/,'');
    const token=String($('backgroundWorkerToken')?.value||'').trim();
    return {base,token};
  };
  const workerRequest=async(path,{method='GET',body=null,timeout=15000}={})=>{
    const {base,token}=workerConfig();if(!base)throw new Error('Chưa cấu hình Background Worker URL trong Settings.');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
    try{
      const headers={'content-type':'application/json','accept':'application/json'};if(token)headers.authorization='Bearer '+token;
      const r=await fetch(base+path,{method,headers,body:body==null?undefined:JSON.stringify(body),signal:ctl.signal});
      const txt=await r.text();let data={};try{data=txt?JSON.parse(txt):{}}catch{data={raw:txt}}
      if(!r.ok)throw new Error(data?.message||data?.error||`Worker HTTP ${r.status}`);return data;
    }catch(e){if(e?.name==='AbortError')throw new Error('Background Worker quá thời gian chờ.');throw e}
    finally{clearTimeout(timer)}
  };
  const clamp=(v,d)=>{const n=Number(v);return Number.isFinite(n)?Math.max(1,Math.min(100,Math.round(n))):d};
  const prefs=()=>({
    enabled:true,h1:true,goal:!!$('fePushGoalEnabled')?.checked,gap:!!$('fePushGapEnabled')?.checked,
    h1Threshold:72,goalThreshold:clamp($('fePushGoalThreshold')?.value,70),gapThreshold:clamp($('fePushGapThreshold')?.value,70)
  });
  const release=()=>document.querySelector('meta[name="football-edge-release"]')?.content||'unknown';
  const apnsEnvironment=()=>{
    const raw=String(document.querySelector('meta[name="football-edge-apns-env"]')?.content||'sandbox').trim().toLowerCase();
    return raw==='production'?'production':'sandbox';
  };
  const setState=(msg,kind='warn')=>{
    const s=$('fePushStatus');if(s){s.textContent=msg;s.className='status'+(kind==='ok'?' ok':kind==='err'?' err':kind==='busy'?' busy':'')}
    const b=$('fePushBadge');if(b){b.className=kind;b.textContent=kind==='ok'?'NATIVE ON':kind==='err'?'NATIVE ERROR':kind==='busy'?'CONNECTING':'NATIVE N1'}
    const m=$('feNativePushMeta');if(m)m.textContent=msg;
  };
  const savedId=()=>{try{return localStorage.getItem(STORE.device)||''}catch{return ''}};
  const saveId=id=>{try{if(id)localStorage.setItem(STORE.device,String(id));localStorage.setItem(STORE.platform,platform)}catch{}};
  const clearDeviceLocal=()=>{try{localStorage.removeItem(STORE.device);localStorage.removeItem(STORE.platform)}catch{}registeredToken=null};

  const applyDeepLink=raw=>{
    try{
      const u=new URL(String(raw||''),'https://native.footballedge.local/');
      const target=(location.pathname||'/')+(u.search||'')+(u.hash||'#analysisCard');
      location.href=target;
    }catch{location.hash='#analysisCard'}
  };
  const notificationData=n=>n?.notification?.data||n?.data||{};

  async function bindListeners(){
    if(listenersBound||!Push)return;listenersBound=true;
    await Push.addListener('pushNotificationReceived',n=>{
      const d=notificationData(n);setState(`Native Push đã nhận${d.fixture_id?' • fixture '+d.fixture_id:''}.`,'ok');
    });
    await Push.addListener('pushNotificationActionPerformed',a=>{
      const d=notificationData(a?.notification||a);if(d?.url)applyDeepLink(d.url);else if(d?.fixture_id)location.href=(location.pathname||'/')+`?fe_fixture=${encodeURIComponent(d.fixture_id)}&fe_mode=${encodeURIComponent(d.fe_mode||'FT')}#analysisCard`;
    });
  }

  async function ensureChannel(){
    if(platform!=='android'||!Push?.createChannel)return;
    try{await Push.createChannel({id:'football_edge_signals',name:'Football Edge Signals',description:'Tín hiệu H1 / FT / LIVE GAP',importance:5,visibility:1,vibration:true})}catch{}
  }

  async function requestNativeToken(){
    if(!Push)throw new Error('Capacitor PushNotifications plugin chưa sẵn sàng.');
    await bindListeners();await ensureChannel();
    let perm=await Push.checkPermissions();if(perm.receive==='prompt'||perm.receive==='prompt-with-rationale')perm=await Push.requestPermissions();
    if(perm.receive!=='granted')throw new Error('Quyền thông báo chưa được cấp.');
    return new Promise(async(resolve,reject)=>{
      let done=false,regHandle,errHandle,timer;
      const finish=async(fn,v)=>{if(done)return;done=true;clearTimeout(timer);try{await regHandle?.remove?.();await errHandle?.remove?.()}catch{}fn(v)};
      try{
        regHandle=await Push.addListener('registration',t=>finish(resolve,String(t?.value||'').trim()));
        errHandle=await Push.addListener('registrationError',e=>finish(reject,new Error(String(e?.error||e?.message||'Native registration failed'))));
        timer=setTimeout(()=>finish(reject,new Error('Native Push registration quá thời gian chờ.')),20000);
        await Push.register();
      }catch(e){finish(reject,e)}
    });
  }

  async function capabilities(){
    try{return await workerRequest('/api/notify/native/capabilities')}catch{return null}
  }

  async function enable(){
    if(busy)return;busy=true;const btn=$('feNativePushEnableBtn');if(btn)btn.disabled=true;setState('Đang đăng ký Native Push…','busy');
    try{
      const token=await requestNativeToken();if(!token)throw new Error('Thiết bị chưa trả registration token.');registeredToken=token;
      const env=platform==='ios'?apnsEnvironment():null;
      const r=await workerRequest('/api/notify/native/subscribe',{method:'POST',body:{platform,token,prefs:prefs(),app_version:release(),native_version:'N1.2',apns_env:env}});
      if(!r?.ok||!r.id)throw new Error(r?.error||'Worker chưa xác nhận Native Push.');saveId(r.id);
      setState(r.sender_ready?`Native Push đã đăng ký • ${platform.toUpperCase()} sender READY${platform==='ios'?' • APNs '+env.toUpperCase():''}.`:`Thiết bị đã đăng ký • ${platform.toUpperCase()} sender chưa cấu hình credentials.` ,r.sender_ready?'ok':'warn');
    }catch(e){setState('Native Push: '+String(e?.message||e),'err')}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  async function savePrefs(){
    const id=savedId();if(!id){setState('Chưa có Native device ID. Bấm ENABLE NATIVE PUSH trước.','warn');return}
    try{const r=await workerRequest('/api/notify/settings',{method:'POST',body:{id,prefs:prefs()}});if(!r?.ok)throw new Error(r?.error||'SAVE_FAILED');setState(`Đã lưu Native thresholds • FT ≥ ${prefs().goalThreshold} • GAP ≥ ${prefs().gapThreshold} • H1 = 72.`,'ok')}
    catch(e){setState('Lưu Native thresholds lỗi: '+String(e?.message||e),'err')}
  }

  async function test(){
    const id=savedId();if(!id){setState('Chưa có Native device ID. Bấm ENABLE NATIVE PUSH trước.','warn');return}
    try{setState('Đang gửi Native Push test…','busy');const r=await workerRequest('/api/notify/test',{method:'POST',body:{id}});if(!r?.ok)throw new Error(r?.error||'PUSH_TEST_FAILED');setState('Worker đã chấp nhận Native Push test. Kiểm tra notification trên thiết bị.','ok')}
    catch(e){setState('Native Push test lỗi: '+String(e?.message||e),'err')}
  }

  async function disconnect(){
    if(busy)return;const id=savedId();
    if(!id){clearDeviceLocal();setState('Thiết bị này hiện không có Native Push registration.','warn');return}
    if(!confirm('Ngắt kết nối thiết bị này và xóa dữ liệu đăng ký thông báo trên Football Edge?'))return;
    busy=true;const btn=$('feNativePushDisconnectBtn');if(btn)btn.disabled=true;setState('Đang xóa dữ liệu đăng ký thông báo…','busy');
    try{
      try{
        const r=await workerRequest('/api/notify/unsubscribe',{method:'POST',body:{id}});
        if(!r?.ok)throw new Error(r?.error||'DELETE_FAILED');
      }catch(e){
        if(!/DEVICE_NOT_FOUND/i.test(String(e?.message||e)))throw e;
      }
      try{await Push?.unregister?.()}catch{}
      clearDeviceLocal();
      setState('Đã ngắt kết nối và xóa dữ liệu đăng ký thông báo của thiết bị này.','ok');
    }catch(e){setState('Không xóa được dữ liệu đăng ký: '+String(e?.message||e),'err')}
    finally{busy=false;if(btn)btn.disabled=false}
  }

  function installUI(){
    const actions=document.querySelector('#fePushPanel .fe-push-actions');if(actions&&!$('feNativePushActions')){
      const box=document.createElement('div');box.id='feNativePushActions';box.className='fe-native-push-actions';box.innerHTML='<button class="blue" id="feNativePushEnableBtn" type="button">ENABLE NATIVE PUSH</button><button id="feNativePushSaveBtn" type="button">SAVE NATIVE THRESHOLDS</button><button id="feNativePushTestBtn" type="button">NATIVE PUSH TEST</button><button id="feNativePushDisconnectBtn" type="button">DISCONNECT & DELETE NOTIFICATION DATA</button>';
      actions.insertAdjacentElement('afterend',box);
      const meta=document.createElement('div');meta.id='feNativePushMeta';meta.className='fe-native-push-meta';meta.textContent=`N1.2 • Native transport: Android FCM / iOS APNs${platform==='ios'?' ('+apnsEnvironment()+')':''}. H1 notification threshold giữ 72; FT/GAP dùng giá trị bên trên.`;box.insertAdjacentElement('afterend',meta);
    }
    $('feNativePushEnableBtn')?.addEventListener('click',enable);
    $('feNativePushSaveBtn')?.addEventListener('click',savePrefs);
    $('feNativePushTestBtn')?.addEventListener('click',test);
    $('feNativePushDisconnectBtn')?.addEventListener('click',disconnect);
  }

  async function patch(){
    installUI();await bindListeners();
    const id=savedId(),caps=await capabilities();
    if(id){const ready=platform==='android'?caps?.fcm_configured:caps?.apns_configured;setState(ready?`Native device đã liên kết • ${platform.toUpperCase()} sender READY.`:`Native device đã liên kết • còn thiếu ${platform==='android'?'FCM':'APNs'} credentials phía Worker.`,ready?'ok':'warn')}
    else setState(`N1.2 Native Push • ${platform.toUpperCase()} • chưa đăng ký thiết bị${platform==='ios'?' • APNs '+apnsEnvironment().toUpperCase():''}.`,'warn');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
  window.FE_NATIVE_SHELL=Object.freeze({version:'N1.2',platform,native:true,webBaseline:'P2.0.1_81707492',apnsEnvironment:apnsEnvironment(),enableNativePush:enable,testNativePush:test,disconnectNotificationData:disconnect});
})();
