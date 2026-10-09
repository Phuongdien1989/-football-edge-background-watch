'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
function targetURL(raw){try{const u=new URL(raw||'/',self.location.origin);if(u.origin!==self.location.origin)return self.location.origin+'/';return u.href;}catch{return self.location.origin+'/';}}
self.addEventListener('push',event=>{
 let p={};try{p=event.data?.json()||{};}catch{p={body:event.data?.text()||''};}
 const url=targetURL(p.url),data={url,fixture_id:p.fixture_id||null,snapshot_version:p.snapshot_version||null};
 event.waitUntil(self.registration.showNotification(p.title||'Football Edge',{body:p.body||'',tag:p.tag||'football-edge',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=targetURL(event.notification.data?.url);
 event.waitUntil((async()=>{const list=await self.clients.matchAll({type:'window',includeUncontrolled:true}),client=list.find(c=>new URL(c.url).origin===self.location.origin);
  if(client){await client.focus();client.postMessage({type:'FE_NOTIFICATION_OPEN',url});await client.navigate(url);return;}
  await self.clients.openWindow(url);
 })());
});
