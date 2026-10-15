/* B2 ISOLATED PREVIEW — never connect to production APIs or register Push.
   This file is deliberately loaded before ANY original inline script. */
(function(){
  'use strict';
  const deny = ()=>Promise.reject(new Error('FE_DESKTOP_B2_PREVIEW_OFFLINE: Network disabled'));
  const DeniedXHR=function(){this.readyState=0;this.status=0;this.responseText='';};
  DeniedXHR.prototype.open=function(){throw new Error('FE_DESKTOP_B2_PREVIEW_OFFLINE: XHR disabled')};
  DeniedXHR.prototype.send=function(){throw new Error('FE_DESKTOP_B2_PREVIEW_OFFLINE: XHR disabled')};
  window.fetch=deny;
  window.XMLHttpRequest=DeniedXHR;
  window.WebSocket=function(){throw new Error('FE_DESKTOP_B2_PREVIEW_OFFLINE: WebSocket disabled')};
  window.EventSource=function(){throw new Error('FE_DESKTOP_B2_PREVIEW_OFFLINE: EventSource disabled')};
  if(navigator.sendBeacon)try{navigator.sendBeacon=()=>false}catch(_){}
  if(navigator.serviceWorker){
    try{navigator.serviceWorker.register=()=>Promise.reject(new Error('FE_DESKTOP_B2_PREVIEW_OFFLINE: Service Worker registration disabled'))}catch(_){}
  }
  if(window.Notification){try{Notification.requestPermission=()=>Promise.resolve('denied')}catch(_){}}
  window.__FE_DESKTOP_B2_ISOLATED_PREVIEW__=true;
})();
