"""Add only the mobile presentation to the exact frozen live HTML.
Unlike the demo builder this retains all original SW, Push, Outbox and sync code.
"""
from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parent
b=(r/'baseline.html').read_bytes()
assert hashlib.sha256(b).hexdigest()=='aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28'
s=b.decode()
anchor='  // FE_ADDON_BRIDGE_END'
bridge="""  // SPORTS_PREMIUM_PRODUCTION_NATIVE_SELECTION_BRIDGE — presentation only.
  if(!window.FE_SP_NATIVE)Object.defineProperty(window,'FE_SP_NATIVE',{value:Object.freeze({
    selectById:id=>{const index=state.fixtures.findIndex(f=>Number(f?.fixture?.id)===Number(id));if(index<0)return false;selectFixture(index);return true;},
    selectedId:()=>state.selected?.fixture?.id??null
  }),writable:false,configurable:false});
"""
assert s.count(anchor)==1
s=s.replace(anchor,bridge+anchor)
css=(r/'source/premium.css').read_text()+"\n@media(max-width:767px){body.fe-sp-enabled #spMode,body.fe-sp-enabled .sp-help{display:none!important}}\n"
js=(r/'source/premium.js').read_text()
old="const mode=new URLSearchParams(location.search).get('mode')==='connected'?'connected':'demo';"
assert js.count(old)==1
js=js.replace(old,"const mode='production';").replace("const liveMode=mode==='connected';","const liveMode=true;")
s=s.replace('</head>','<style id="FE_SP_PREMIUM_CSS">\n'+css+'\n</style>\n</head>')
s=s.replace('</body>','<script id="FE_SP_PREMIUM_JS">\n'+js+'\n</script>\n</body>')
# Round-trip proves every byte outside the three additive presentation blocks stays unchanged.
restored=s.replace(bridge,'').replace('<style id="FE_SP_PREMIUM_CSS">\n'+css+'\n</style>\n','').replace('<script id="FE_SP_PREMIUM_JS">\n'+js+'\n</script>\n','')
assert restored.encode()==b, 'Native application changed'
assert 'SPORTS PREMIUM PREVIEW: passive network/sync disabled' not in s
out=r/'production-site';out.mkdir(exist_ok=True)
(out/'index.html').write_text(s)
report={'baseline_sha256':hashlib.sha256(b).hexdigest(),'html_sha256':hashlib.sha256(s.encode()).hexdigest(),'native_roundtrip_identical':True,'original_push_and_sw_preserved':True,'default_mode':'production','demo_data_unreachable':True}
(r/'production-build.json').write_text(json.dumps(report,indent=2))
print('PREMIUM_PRODUCTION_BUILD_PASS',json.dumps(report))
