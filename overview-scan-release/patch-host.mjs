// Scoped classic-script bridge into the existing scanner closure.
import assert from 'node:assert/strict';
export const HOST_MARK='  // FE_OVERVIEW_SCAN_BRIDGE_V1';
export const bridgeSource=`
${HOST_MARK}
  import('/ui-tabs/scan-runtime.mjs').then(({createOverviewScanRuntime})=>{
    const autoIds={ht:'h1WatchAuto',ft:'watchAuto',hc:'handicapWatchAuto'};
    const getAuto=()=>Object.fromEntries(Object.entries(autoIds).map(([k,id])=>[k,!!$(id)?.checked]));
    const changed=()=>window.dispatchEvent(new Event('fe-overview-scan-updated'));
    const local=()=>({hasKey:!!els.fkey.value.trim(),backgroundConfigured:!!bgEnabled(),busy:!!(FE_SCAN_HEALTH.busy||FE_UNIFIED_SCAN_STATE.running||h1WatchState.refreshing||watchState.refreshing||handicapWatchState.refreshing),lastAt:Number(FE_UNIFIED_SCAN_STATE.lastAt||0),counts:{ht:h1WatchState.items.length,ft:watchState.items.length,hc:handicapWatchState.pool.length},sourceErrors:[['HT','h1WatchStatus'],['FT','watchStatus'],['HC','handicapWatchStatus']].filter(([,id])=>$(id)?.classList.contains('err')).map(([name])=>name),engines:{ht:{active:!!h1WatchState.active,auto:!!$('h1WatchAuto')?.checked},ft:{active:!!watchState.active,auto:!!$('watchAuto')?.checked},hc:{active:!!handicapWatchState.active,auto:!!$('handicapWatchAuto')?.checked}}});
    const api=createOverviewScanRuntime({local,remote:()=>FE_SCAN_HEALTH.control?{...FE_SCAN_HEALTH.control,observedAt:FE_SCAN_HEALTH.observedAt||0,scan:FE_SCAN_HEALTH.last}:null,getAuto,setAuto:values=>{for(const [key,id]of Object.entries(autoIds))if($(id))$(id).checked=!!values[key];},stopLocal:stopUnifiedLiveScan,
      scan:async force=>{await startUnifiedLiveScan(force);if($('unifiedLiveStatus')?.classList.contains('err'))throw Error('UNIFIED_SCAN_FAILED');window.dispatchEvent(new Event('fe-notify-sync-updated'));},
      refreshRemote:async()=>{await feScanRefresh({silent:false});if(FE_SCAN_HEALTH.lastRefreshError||!FE_SCAN_HEALTH.control)throw Error('SCAN_STATUS_UNAVAILABLE');},
      setRemote:async enabled=>{
        if(FE_SCAN_HEALTH.busy)throw Error('SCAN_CONTROL_BUSY');
        FE_SCAN_HEALTH.busy=true;FE_SCAN_HEALTH.controlEpoch=(FE_SCAN_HEALTH.controlEpoch||0)+1;FE_SCAN_HEALTH.control=null;FE_SCAN_HEALTH.observedAt=0;changed();
        try{const r=await bgRequest('/api/notify/scan-control',{method:'POST',body:{enabled},timeout:15000});if(r?.ok!==true)throw Error(r?.error||'SCAN_CONTROL_REJECTED');const c=r.scan_control||r.control;if(typeof c?.enabled!=='boolean')throw Error('SCAN_CONTROL_ACK_INVALID');FE_SCAN_HEALTH.controlEpoch++;FE_SCAN_HEALTH.observedAt=Date.now();feScanRender(FE_SCAN_HEALTH.last,c);return c;}
        catch(e){FE_SCAN_HEALTH.controlEpoch++;FE_SCAN_HEALTH.control=null;FE_SCAN_HEALTH.observedAt=0;throw e;}
        finally{FE_SCAN_HEALTH.busy=false;changed();}
      },changed});
    Object.defineProperty(window,'FEOverviewScanBridge',{value:api,writable:false,configurable:false});
    window.dispatchEvent(new Event('fe-overview-scan-bridge-ready'));
  }).catch(()=>console.warn('OVERVIEW_SCAN_BRIDGE_UNAVAILABLE'));
  // FE_OVERVIEW_SCAN_BRIDGE_END
`;
export function patchScanHost(input){
 assert(!input.includes(HOST_MARK),'SCAN_BRIDGE_ALREADY_PRESENT');let s=input;
 const replace=(from,to)=>{assert.equal(s.split(from).length,2,'PATCH_ANCHOR_'+from.slice(0,65));s=s.replace(from,to);};
 replace('  function feScanRender(scan,control){\n    FE_SCAN_HEALTH.last=scan||null;', '  function feScanRender(scan,control){\n    FE_SCAN_HEALTH.observedAt=Date.now();\n    FE_SCAN_HEALTH.last=scan||null;');
 const a=s.indexOf('  async function feScanRefresh('),b=s.indexOf('  async function feScanSetControl(',a);assert(a>0&&b>a);let section=s.slice(a,b);
 section=section.replace("      const r=await bgRequest('/api/notify/status',{timeout:12000});", "      const controlEpoch=FE_SCAN_HEALTH.controlEpoch||0;\n      const r=await bgRequest('/api/notify/status',{timeout:12000});\n      if(controlEpoch!==(FE_SCAN_HEALTH.controlEpoch||0))return;");
 section=section.replace("      feScanRender(r.scan||null", "      FE_SCAN_HEALTH.lastRefreshError='';\n      feScanRender(r.scan||null");
 section=section.replace("    }catch(e){\n      if(!silent)", "    }catch(e){\n      FE_SCAN_HEALTH.lastRefreshError='SCAN_STATUS_UNAVAILABLE';\n      if(!silent)");
 section=section.replace("    }\n  }\n", "    }finally{window.dispatchEvent(new Event('fe-overview-scan-updated'));}\n  }\n");s=s.slice(0,a)+section+s.slice(b);
 const x=s.indexOf('  async function feScanSetControl('),y=s.indexOf('  function feScanStart(){',x);assert(x>0&&y>x);let control=s.slice(x,y);
 control=control.replace("      const r=await bgRequest('/api/notify/scan-control'", "      FE_SCAN_HEALTH.controlEpoch=(FE_SCAN_HEALTH.controlEpoch||0)+1;\n      const r=await bgRequest('/api/notify/scan-control'");
 control=control.replace("      feScanControlRender(r.scan_control||r);", "      FE_SCAN_HEALTH.controlEpoch++;FE_SCAN_HEALTH.observedAt=Date.now();\n      feScanControlRender(r.scan_control||r);");
 control=control.replace("    }catch(e){\n      feScanBadgeSet", "    }catch(e){\n      FE_SCAN_HEALTH.controlEpoch=(FE_SCAN_HEALTH.controlEpoch||0)+1;FE_SCAN_HEALTH.control=null;FE_SCAN_HEALTH.observedAt=0;\n      feScanBadgeSet");s=s.slice(0,x)+control+s.slice(y);
 const anchor='  // FE PUSH P0.9 — SIGNAL VALIDATION DASHBOARD (READ-ONLY)';assert(s.includes(anchor));s=s.replace(anchor,bridgeSource+'\n'+anchor);
 return s;
}
