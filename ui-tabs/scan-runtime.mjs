// Coordinates existing user-triggered operations only. No own polling/scanner.
export function createOverviewScanRuntime(d){
 let pending=null,error='';
 const publish=()=>d.changed?.();
 const read=()=>{const local=d.local(),remote=d.remote(),known=!!remote&&Number.isFinite(remote.observedAt)&&Date.now()-remote.observedAt>=0&&Date.now()-remote.observedAt<=45000;
  const localOn=Object.values(local.engines||{}).some(x=>x.active&&x.auto),remoteOn=known&&remote.enabled===true,remoteRequested=known&&(remote.manualEnabled??remote.enabled)===true;
  return {pending,error,local,remote,known,localOn,remoteOn,remoteRequested,on:localOn||remoteRequested,busy:!!pending||!!local.busy};};
 async function refresh(){if(pending)return {ok:false,busy:true};const l=d.local();if(!l.backgroundConfigured){publish();return {ok:true};}pending='status';error='';publish();try{await d.refreshRemote();return {ok:true};}catch(e){error='Không đọc được trạng thái quét nền. Hãy thử lại.';return {ok:false,error};}finally{pending=null;publish();}}
 async function execute(action){const initial=read();if(initial.busy)return {ok:false,busy:true};pending=action;error='';publish();let auto=null,remoteStarted=false;
  try{
   if(action==='stop'){
    d.stopLocal();
    if(initial.local.backgroundConfigured)await d.setRemote(false);
    return {ok:true};
   }
   if(!initial.local.hasKey)throw Error('API_KEY_REQUIRED');
   if(initial.local.backgroundConfigured&&!initial.known)await d.refreshRemote();
   const current=read();if(current.local.backgroundConfigured&&!current.known)throw Error('STATUS_UNKNOWN');
   if(action==='start'){
    auto=d.getAuto();
    if(current.local.backgroundConfigured){remoteStarted=!current.remoteRequested;const c=await d.setRemote(true);if(c.enabled!==true)throw Error(c.quotaPaused?'FREE_SCAN_DAILY_BUDGET_EXHAUSTED':'BACKGROUND_NOT_ACTIVE');}
    d.setAuto({ht:true,ft:true,hc:true});
    await d.scan(false);
   }else if(action==='once'){
    // A one-off from OFF must never activate or extend remote continuous scanning.
    if(!current.localOn){auto=d.getAuto();d.setAuto({ht:false,ft:false,hc:false});}
    try{await d.scan(true);}finally{if(!current.localOn){d.stopLocal();d.setAuto(auto);auto=null;}}
   }else throw Error('UNKNOWN_ACTION');
   return {ok:true};
  }catch(e){
   if(action==='start'){d.stopLocal();if(auto)d.setAuto(auto);if(remoteStarted)try{await d.setRemote(false);}catch{error='Khởi động lỗi; chưa xác nhận dừng được quét nền. Bấm Tạm dừng để thử lại.';}}
   if(!error)error=action==='stop'?'Đã dừng trên máy; chưa xác nhận dừng quét nền. Hãy thử lại.':e?.message==='API_KEY_REQUIRED'?'Chưa có Football API Key trên máy. Mở Kết nối để cấu hình.':String(e?.message).includes('FREE_SCAN')?'Đã hết lượt quét nền Free trong ngày.':e?.message==='BACKGROUND_NOT_ACTIVE'?'Quét nền chưa hoạt động; kiểm tra khung giờ hoặc ngân sách.':'Không hoàn tất được lượt quét. Xem trạng thái nguồn và thử lại.';
   return {ok:false,error};
  }finally{pending=null;publish();}
 }
 return Object.freeze({read,refresh,start:()=>execute('start'),stop:()=>execute('stop'),once:()=>execute('once')});
}
export function scanControlView(s){
 if(!s)return {state:'loading',title:'Đang nạp điều khiển',button:'ĐANG NẠP…',disabled:true,onceDisabled:true};
 if(s.pending)return {state:'busy',title:s.pending==='once'?'Đang quét một lượt':s.pending==='stop'?'Đang tạm dừng':s.pending==='status'?'Đang đọc trạng thái':'Đang khởi động LIVE',button:'ĐANG XỬ LÝ…',disabled:true,onceDisabled:true};
 if(s.remote?.quotaPaused&&!s.localOn)return {state:'quota',title:'Hết lượt nền Free hôm nay',button:s.remoteRequested?'TẠM DỪNG':'BẮT ĐẦU LIVE',disabled:!s.remoteRequested,onceDisabled:s.busy||!s.local.hasKey};
 const recentSourceError=(s.local.sourceErrors?.length||0)>0||Number.isFinite(Number(s.remote?.scan?.at))&&Date.now()-Number(s.remote.scan.at)<=90000&&(s.remote.scan.errors||[]).length>0;
 if(s.on)return {state:recentSourceError?'warning':s.localOn||s.remoteOn?'running':'waiting',title:recentSourceError?'Đang bật · có lỗi nguồn':s.localOn&&s.remoteOn?'LIVE ACTIVE':s.remoteOn?'Quét nền đang bật':s.localOn?'Đang quét trên máy':'Chờ khung giờ quét',button:'TẠM DỪNG',disabled:s.busy,onceDisabled:s.busy};
 if(s.local.backgroundConfigured&&!s.known)return {state:'unknown',title:'Chưa xác nhận trạng thái nền',button:'KIỂM TRA KẾT NỐI',disabled:s.busy,onceDisabled:true,retry:true};
 if(s.remote?.quotaPaused)return {state:'quota',title:'Hết lượt nền Free hôm nay',button:'BẮT ĐẦU LIVE',disabled:true,onceDisabled:s.busy};
 return {state:'paused',title:s.local.backgroundConfigured?'Đã dừng':'Đã dừng trên máy',button:'BẮT ĐẦU LIVE',disabled:s.busy||!s.local.hasKey,onceDisabled:s.busy||!s.local.hasKey};
}
