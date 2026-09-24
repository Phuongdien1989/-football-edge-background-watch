(()=>{
  'use strict';
  const isNative=!!(window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform());
  if(!isNative) return;
  document.documentElement.dataset.feNative='capacitor';
  document.body.classList.add('fe-native-shell');
  const patch=()=>{
    const status=document.getElementById('fePushStatus');
    if(status) status.textContent='Push native sẽ dùng APNs/FCM ở bước N1. Web Push tiếp tục dùng cho bản PWA stable.';
    const badge=document.getElementById('fePushBadge');
    if(badge){ badge.className='warn'; badge.textContent='NATIVE N1'; }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patch,{once:true}); else patch();
  window.FE_NATIVE_SHELL=Object.freeze({version:'N0.2',platform:window.Capacitor.getPlatform?.()||'native',native:true,webBaseline:'STABLE_BASELINE_RC1'});
})();
