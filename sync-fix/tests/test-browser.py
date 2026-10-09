import json,pathlib,subprocess,os,time,urllib.request,http.server,threading
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Handler(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  body=(ROOT/'frontend/index.html').read_text().replace('<head>','<head><script>window.__errors=[];window.addEventListener("error",e=>window.__errors.push(e.message));</script>').replace('  // FE_UI_READ_BRIDGE_START:', 'window.__topTest={rank:feMasterRankRows,select:feSmartSelectRows};\n  // FE_UI_READ_BRIDGE_START:').encode()
  self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Security-Policy',"default-src 'self' 'unsafe-inline' 'unsafe-eval' data:; connect-src 'self'");self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
httpd=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=httpd.serve_forever,daemon=True).start()
display=':'+str(200+os.getpid()%500);log=open(ROOT/'tests/BROWSER.log','w')
x=subprocess.Popen(['Xvfb',display,'-screen','0','1600x1400x24','-ac'],stdout=log,stderr=log)
env={**os.environ,'DISPLAY':display,'NO_AT_BRIDGE':'1','WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS':'1','WEBKIT_DISABLE_DMABUF_RENDERER':'1'}
driver=subprocess.Popen(['WebKitWebDriver','--port=9515'],env=env,stdout=log,stderr=log);session=None
def call(method,route,body=None):
 req=urllib.request.Request('http://127.0.0.1:9515'+route,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(req,timeout=30) as r:data=json.loads(r.read())
 if isinstance(data.get('value'),dict) and data['value'].get('error') and 'message' in data['value']:raise RuntimeError(data['value'])
 return data.get('value')
def cmd(route,body=None,method='POST'):return call(method,'/session/'+session+route,body)
def js(script,args=[]):return cmd('/execute/sync',{'script':script,'args':args})
def refresh():return cmd('/execute/async',{'script':'var done=arguments[arguments.length-1];window.FELegacyNotifySync.refresh().then(done);','args':[]})
def row(phase='2H',rev=1,offset=0):
 r=json.loads((ROOT/'tests/mock-row.json').read_text());at=int(time.time()*1000)+offset
 r.update(captured_at=at,revision=rev,version='test-'+str(rev),active_live=True)
 r['fixture']['fixture']['status']={'short':phase,'elapsed':24 if phase=='1H' else 66}
 r['snapshot'].update(captured_at=at,fresh_at=at,status=phase,minute=r['fixture']['fixture']['status']['elapsed'])
 return r
def apply(r):return js('return window.FELegacyNotifySync.apply({schema:"FE_NOTIFY_UI_STATE_V1",server_at:Date.now(),snapshots:[arguments[0]]});',[r])
try:
 time.sleep(1);session=call('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'MiniBrowser'}}})['sessionId']
 for width in [390,375,1280]:
  cmd('/window/rect',{'width':width,'height':900,'x':0,'y':0});cmd('/url',{'url':f'http://127.0.0.1:{httpd.server_port}/?fe_fixture=11&fe_mode=FT'})
  assert js('return !!window.FELegacyNotifySync;'),js('return window.__errors;')
  assert js('return !!document.getElementById("feProMatchCard") && !document.getElementById("proMatchList");')
  r=row();assert apply(r)
  data=js('return window.FEUIReadBridge.read();');ft=data['watch'][0] if 'watch' in data else None
  # Read the exact old UI bridge rather than a mock/replacement UI.
  assert 'test-1' in json.dumps(data),data.keys()
  assert data['watchState']['items'][0]['eval']['score']==r['engines']['FT']['score']
  assert data['handicapWatchState']['pool'][0]['latest']['status']=='2H'
  result=js('''const seed=window.FEUIReadBridge.read().watchState.items[0];
    const make=(id,score)=>{const it=JSON.parse(JSON.stringify(seed));delete it.serverRow;delete it.serverGoal;it.id=id;it.state='WATCH';it.cooldownUntil=0;it.eval={...it.eval,score,quality:4,scoreMode:'FULL',hardVeto:false,dataIncomplete:false};it.latest={...it.latest,captured_at:Date.now(),fresh_at:Date.now(),status:'2H',minute:66,stats_presence:{pressure:true,core:true},data_health:{level:'HEALTHY'}};return {id,ft:it,latest:it};};
    const rows=window.__topTest.rank([make(901,58),make(902,60)]),selected=window.__topTest.select(rows);
    return {first:rows[0].id,top:rows[0].__rank.top,confirmed:rows[0].__rank.confirmed,state:rows[0].ft.state,selected:selected.length};''')
  assert result=={'first':902,'top':1,'confirmed':False,'state':'WATCH','selected':2},result
  apply(row(rev=1,offset=-1000));assert 'test-1' in json.dumps(js('return window.FEUIReadBridge.read();'))
  r=row(rev=2,offset=-70000);r['captured_at']=int(time.time()*1000)+10
  # Guard stale snapshot independently of store ordering.
  stale=row(offset=-70000)
  guarded=js('return window.FELegacyNotifySync.guard({serverRow:arguments[0],latest:{captured_at:arguments[0].captured_at},eval:{score:99},state:"SIGNAL"});',[stale])
  assert guarded['eval']['score'] is None and guarded['serverGoal']['prob'] is None,guarded
  newer=js('return window.FELegacyNotifySync.guard({serverRow:arguments[0],latest:{captured_at:arguments[0].captured_at+1},eval:{score:51}});',[stale]);assert newer['eval']['score']==51 and 'serverRow' not in newer
  js('document.getElementById("backgroundWorkerUrl").value=location.origin;document.getElementById("backgroundWorkerToken").value="test";window.mock=arguments[0];window.fetch=async()=>{window.calls=(window.calls||0)+1;if(window.fail)throw Error("TEST_OFFLINE");return new Response(JSON.stringify(window.mock),{status:200});};',[{'schema':'FE_NOTIFY_UI_STATE_V1','server_at':int(time.time()*1000)+100,'snapshots':[row(rev=3,offset=100)]}])
  assert refresh()['ok'];assert js('return window.FELegacyNotifySync.read().state;')=='OK'
  js('window.fail=true;');assert refresh()['error']=='TEST_OFFLINE'
  guarded=js('const d=window.FEUIReadBridge.read();return d;');assert 'CHUA DONG BO' in json.dumps(guarded)
  js('window.fail=false;window.mock={schema:"FE_NOTIFY_UI_STATE_V1",server_at:Date.now()+1000,snapshots:[arguments[0]]};',[row(phase='1H',rev=4,offset=1000)]);assert refresh()['ok']
  data=js('return window.FEUIReadBridge.read();');assert data['h1WatchState']['items'][0]['latest']['status']=='1H'
  js('window.mock={schema:"FE_NOTIFY_UI_STATE_V1",server_at:Date.now()+2000,snapshots:[arguments[0]]};',[row(phase='FT',rev=5,offset=2000)]);assert refresh()['ok']
  data=js('return window.FEUIReadBridge.read();');assert data['watchState']['items'][0]['state']=='ENDED' and data['watchState']['items'][0]['eval']['score'] is None
  js('window.mock={schema:"FE_NOTIFY_UI_STATE_V1",server_at:Date.now()+3000,snapshots:[]};');assert refresh()['error']=='SERVER_SNAPSHOT_PENDING'
  assert js('return window.__errors;')==[],js('return window.__errors;')
  print('PASS full original WebKit app width='+str(width)+': canonical runtime, ordering, stale/newer local guards, authenticated refresh, offline suppression, no JS errors',flush=True)
finally:
 if session:
  try:call('DELETE','/session/'+session)
  except:pass
 driver.terminate();x.terminate();httpd.shutdown();log.close()
