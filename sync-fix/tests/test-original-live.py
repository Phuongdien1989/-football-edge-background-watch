import pathlib,os
exec(pathlib.Path(__file__).with_name('test-browser.py').read_text().split('\ntry:\n')[0].replace('timeout=30','timeout=60'))
try:
 time.sleep(1)
 session=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'MiniBrowser'}}})['sessionId']
 cmd('/window/rect',{'width':390,'height':844,'x':0,'y':0})
 cmd('/url',{'url':'https://shiny-silence-d892.ngophuonghuy.workers.dev/?verify_live=original'})
 assert js('return !!window.FEUIReadBridge && !window.FELegacyNotifySync;'),'ORIGINAL_BASELINE_NOT_LOADED'
 js('document.getElementById("footballKey").value=arguments[0];document.getElementById("footballProvider").value="direct";document.getElementById("footballBase").value="https://v3.football.api-sports.io";window.__liveErrors=[];window.addEventListener("error",e=>window.__liveErrors.push(e.message));',[os.environ['APISPORTS_KEY']])
 js('document.querySelector("#scanButtons button[data-h=live]").click();')
 for i in range(60):
  d=js('return {state:window.FEUIReadBridge.read().state,status:document.getElementById("scanStatus").textContent};')
  if not d['state']['scanning']:break
  time.sleep(1)
 assert not d['state']['scanning'],'SCAN_DID_NOT_FINISH'
 assert len(d['state']['fixtures'])>0,{'status':d['status'],'count':len(d['state']['fixtures'])}
 print(json.dumps({'real_original_live_list':'PASS','count':len(d['state']['fixtures']),'ids':[f['fixture']['id'] for f in d['state']['fixtures']],'status':d['status']}),flush=True)
 js('document.getElementById("feP1ScanBtn").click();')
 for i in range(100):
  status=js('return document.getElementById("unifiedLiveStatus").textContent;')
  if 'hoàn tất' in status or 'Lỗi QUÉT CẢ' in status:break
  time.sleep(1)
 assert 'hoàn tất' in status,status
 data=js('return window.FEUIReadBridge.read();')
 assert js('return window.__liveErrors;')==[],js('return window.__liveErrors;')
 print(json.dumps({'real_original_live_scan_button':'PASS','status':status,'engine_counts':{'H1':len(data['h1WatchState']['items']),'FT':len(data['watchState']['items']),'HC':len(data['handicapWatchState']['pool'])}}),flush=True)
finally:
 if session:
  try:call('DELETE','/session/'+session)
  except:pass
 driver.terminate();x.terminate();httpd.shutdown();log.close()
