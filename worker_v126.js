import base, { BackgroundWatcher as BackgroundWatcherV125 } from "./worker_v125.js";

const WORKER_VERSION = "1.2.6";
const TERMINAL_QSIG = new Set(["RESOLVED","VOID","DATA_MISSING"]);

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "access-control-allow-origin":"*",
    "access-control-allow-methods":"GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers":"authorization,content-type",
    ...extra
  }});
}
function n(v,d=null){const x=Number(v);return Number.isFinite(x)?x:d}

export class BackgroundWatcher extends BackgroundWatcherV125 {
  async resolveOneQsig(t){
    if(!t||TERMINAL_QSIG.has(String(t.state||"")))return t;
    if(String(t.engine||"").toUpperCase()==="H1"){
      const snaps=await this.snapshotsFor(t.fixture_id,Math.max(0,Number(t.t0||0)-1000),60);
      const usable=snaps.filter(x=>x?.fixture?.fixture);
      const latest=usable[usable.length-1]||null;
      const status=String(latest?.fixture?.fixture?.status?.short||"");
      if(status==="HT"){
        const minute=n(latest?.fixture?.fixture?.status?.elapsed,null);
        return this.finishQsig(t,"VOID","HT_BEFORE_GOAL_5M",{
          outcome:"VOID",
          evidence:{snapshots:usable.length,latest_minute:minute,latest_status:status,deadline_minute:Number(t.minute||0)+5}
        });
      }
    }
    return super.resolveOneQsig(t);
  }
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/health"){
      const r=await base.fetch(request,env,ctx),d=await r.json().catch(()=>({}));
      return json({...d,version:WORKER_VERSION,h1_ht_guard:true},r.status);
    }
    return base.fetch(request,env,ctx);
  }
};
