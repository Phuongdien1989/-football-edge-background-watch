"""Recover only the pinned native baseline from a previously applied additive UI."""
from pathlib import Path
import hashlib,re,sys
r=Path(__file__).resolve().parent
raw=Path(sys.argv[1]).read_bytes()
expected='aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28'
if hashlib.sha256(raw).hexdigest()!=expected:
 s=raw.decode()
 for pattern in [r'<style id="FE_SP_PREMIUM_CSS">\n.*?\n</style>\n',r'<script id="FE_SP_PREMIUM_JS">\n.*?\n</script>\n']:
  s,n=re.subn(pattern,'',s,flags=re.S)
  assert n==1,'Expected exactly one additive UI block'
 bridge="""  // SPORTS_PREMIUM_PRODUCTION_NATIVE_SELECTION_BRIDGE — presentation only.
  if(!window.FE_SP_NATIVE)Object.defineProperty(window,'FE_SP_NATIVE',{value:Object.freeze({
    selectById:id=>{const index=state.fixtures.findIndex(f=>Number(f?.fixture?.id)===Number(id));if(index<0)return false;selectFixture(index);return true;},
    selectedId:()=>state.selected?.fixture?.id??null
  }),writable:false,configurable:false});
"""
 assert s.count(bridge)==1
 raw=s.replace(bridge,'').encode()
assert hashlib.sha256(raw).hexdigest()==expected,'Native baseline drift; refusing build'
(r/'baseline.html').write_bytes(raw)
print('PINNED_NATIVE_BASELINE_RECOVERED',expected)
