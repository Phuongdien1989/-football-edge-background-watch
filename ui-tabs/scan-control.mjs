import {scanControlView} from './scan-runtime.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function attachOverviewScanControl({win=window,doc=document}={}){
 const root=doc.getElementById('feTabsWorkspace'),nav=root?.querySelector('.ftabs-nav');if(!nav||root.querySelector('[data-overview-scan-controls]'))return;
 const panel=doc.createElement('section');panel.dataset.overviewScanControls='';panel.setAttribute('aria-label','Điều khiển quét LIVE');nav.after(panel);let queued=false,last='',wasVisible=false;
 const icon=(pause=false)=>'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">'+(pause?'<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>':'<path d="M7 4l14 8-14 8z"/>')+'</svg>';
 function render(){const visible=doc.body.dataset.feTabsTab==='overview'&&doc.body.classList.contains('fe-tabs-mode');panel.hidden=!visible;if(!visible){wasVisible=false;return;}
  const api=win.FEOverviewScanBridge,s=api?.read(),v=scanControlView(s),r=s?.remote,l=s?.local,budget=r?.scan_budget,at=Math.max(Number(r?.scan?.at||0),Number(l?.lastAt||0));
  const html='<header><span class="ov-scan-state" data-state="'+v.state+'"><i></i>'+esc(v.title)+'</span><small>HT · FT · HC</small></header><div class="ov-scan-buttons"><button type="button" data-overview-scan="main" data-running="'+!!s?.on+'"'+(v.disabled?' disabled':'')+'>'+icon(!!s?.on)+esc(v.button)+'</button><button type="button" data-overview-scan="once"'+(v.onceDisabled?' disabled':'')+'><span aria-hidden="true">↻</span>Quét ngay</button></div><div class="ov-scan-caption"><span>'+esc(l?.counts?'HT '+l.counts.ht+' · FT '+l.counts.ft+' · HC '+l.counts.hc+(at?' · '+new Date(at).toLocaleTimeString('vi-VN'):''):at?'Cập nhật '+new Date(at).toLocaleTimeString('vi-VN'):'Chung nguồn dữ liệu · không quét trùng')+'</span>'+(budget?'<small>Nền Free '+esc(budget.used)+'/'+esc(budget.limit)+'</small>':'')+'</div>'+(l?.sourceErrors?.length?'<p class="ov-scan-error">Nguồn '+esc(l.sourceErrors.join(' / '))+' đang có lỗi. Mở công cụ gốc để xem chi tiết.</p>':'')+(s?.error?'<p role="status" class="ov-scan-error">'+esc(s.error)+'</p>':'')+(!l?.hasKey&&api?'<a href="#connectCard">Mở Kết nối để cấu hình API</a>':'');
  if(last!==html){panel.innerHTML=html;last=html;}panel.setAttribute('aria-busy',s?.busy?'true':'false');
  if(!wasVisible&&api){wasVisible=true;if(l.backgroundConfigured&&!s.known)api.refresh();}
 }
 function sync(){if(queued)return;queued=true;win.requestAnimationFrame(()=>{queued=false;render();});}
 panel.addEventListener('click',async e=>{const b=e.target.closest('button[data-overview-scan]');if(!b||b.disabled)return;const api=win.FEOverviewScanBridge;if(!api)return;const s=api.read(),v=scanControlView(s);const work=b.dataset.overviewScan==='once'?api.once():v.retry?api.refresh():s.on?api.stop():api.start();render();await work;win.FETabsIntegrated?.refresh?.();render();});
 const observer=new win.MutationObserver(sync);observer.observe(doc.body,{attributes:true,attributeFilter:['class','data-fe-tabs-tab']});
 for(const id of ['feScanBadge','feScanControlBtn','unifiedLiveStatus','h1WatchCountdown','watchCountdown','handicapWatchCountdown']){const el=doc.getElementById(id);if(el)observer.observe(el,{attributes:true,childList:true,subtree:true,characterData:true});}
 for(const event of ['fe-overview-scan-bridge-ready','fe-overview-scan-updated','hashchange','fe-notify-sync-updated'])win.addEventListener(event,sync);
 render();return Object.freeze({refresh:sync,destroy(){observer.disconnect();panel.remove();}});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')attachOverviewScanControl();
