// Opt-in preview bridge only. Not imported by any production entrypoint.
export function mountPREPreview({enabled=false,win=window,labArtifact=null}={}){
 if(!enabled)return {enabled:false,destroy(){}};
 const doc=win.document,target=doc.getElementById('feTabsWorkspace');if(!target)return {enabled:false,reason:'HOST_WORKSPACE_MISSING',destroy(){}};
 const toolbar=doc.createElement('div');toolbar.dataset.prematchPreviewToolbar='true';toolbar.style.cssText='padding:10px 0';const open=doc.createElement('button');open.type='button';open.textContent='PRE-MATCH AI · PREVIEW';open.style.cssText='background:#e9f4ff;color:#176bd4;border:1px solid #cbdff3;padding:10px 15px;border-radius:12px;cursor:pointer;font:600 12px system-ui';toolbar.append(open);target.prepend(toolbar);
 let overlay=null,app=null,closed=false,opening=false;
 function close(){closed=true;app?.destroy();app=null;overlay?.remove();overlay=null;open.focus();}
 async function show(){if(overlay||opening)return;opening=true;closed=false;try{const {mount}=await import('./view.mjs');if(closed)return;overlay=doc.createElement('section');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','PRE-MATCH preview độc lập');overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#f3f8fc;overflow:auto';const back=doc.createElement('button');back.textContent='← Về giao diện LIVE hiện hành';back.style.cssText='margin:12px 24px;padding:9px 12px;border:1px solid #d5e6f4;border-radius:10px;background:white;color:#285b88';back.addEventListener('click',close);const root=doc.createElement('div');overlay.append(back,root);doc.body.append(overlay);
  app=mount(root,{labArtifact,hostRead:()=>win.FEOverviewInputBridge?.read?.()||[],workerFactory:()=>new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'})});
 }finally{opening=false;}}
 open.addEventListener('click',show);
 return {enabled:true,close,destroy(){close();toolbar.remove();open.removeEventListener('click',show);}};
}
