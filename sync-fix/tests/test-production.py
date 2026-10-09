import pathlib,os
# Reuse the verified WebKit driver harness; no mock provider is installed here.
exec(pathlib.Path(__file__).with_name('test-browser.py').read_text().split('\ntry:\n')[0])
try:
 time.sleep(1);session=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'MiniBrowser'}}})['sessionId']
 cmd('/window/rect',{'width':390,'height':844,'x':0,'y':0})
 cmd('/url',{'url':'https://shiny-silence-d892.ngophuonghuy.workers.dev/'})
 assert js('return !!window.FELegacyNotifySync && !!window.FEUIReadBridge;'),'PRODUCTION_SYNC_SCRIPT_MISSING'
 js('document.getElementById("backgroundWorkerUrl").value=arguments[0];document.getElementById("backgroundWorkerToken").value=arguments[1];',['https://football-edge-background-watch.ngophuonghuy.workers.dev',os.environ['BACKGROUND_TOKEN']])
 result=refresh();assert result.get('ok'),result
 status=js('return window.FELegacyNotifySync.read();');assert status['state']=='OK',status
 data=js('return window.FEUIReadBridge.read();')
 counts={};rows={}
 for name,key in [('watchState','items'),('h1WatchState','items'),('handicapWatchState','pool')]:
  items=data[name][key];counts[name]=len(items)
  for item in items:
   row=item.get('serverRow');assert row and row['fixture_id']==item['id'],'CANONICAL_ROW_MISSING'
   assert item['latest']['captured_at']==row['captured_at'],'CANONICAL_CAPTURE_MISMATCH'
   assert item['latest']['fixture']['goals']==row['fixture']['goals'],'CANONICAL_SCORE_MISMATCH'
   if row['source_health'].get('stats')!='OK':assert item['eval'].get('score') is None,'MISSING_STATS_DISPLAYED_AS_SIGNAL'
   rows[row['fixture_id']]={'version':row['version'],'stats':row['source_health'].get('stats'),'phase':row['fixture']['fixture']['status']['short']}
 print(json.dumps({'production_webkit':'PASS','sync_status':status['state'],'backend_snapshot_count':result['snapshots'],'engine_counts':counts,'real_rows':rows,'device_notification_click':'NOT_YET_VERIFIED'}),flush=True)
finally:
 if session:
  try:call('DELETE','/session/'+session)
  except:pass
 driver.terminate();x.terminate();httpd.shutdown();log.close()
