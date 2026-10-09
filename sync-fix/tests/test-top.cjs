const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'frontend/index.html'),'utf8'),baseline=fs.readFileSync(path.join(root,'rollback/index.html'),'utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const cut=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
// Engine/state/notification logic must remain byte-for-byte original.
function source(s,name){const start=s.indexOf('  function '+name+'(');assert(start>=0,name);const tail=s.slice(start),next=/\n  (?:async )?function /.exec(tail);assert(next,name);return tail.slice(0,next.index);}
for(const name of ['watchEvaluate','h1WatchEvaluate','hcEvaluate','watchThresholds','h1WatchThresholds','watchApplyState','h1WatchApplyState','qsigAssessFT','qsigAssessH1','qsigAssessHC'])assert.equal(source(html,name),source(baseline,name),name);
const c=vm.createContext({Date,console});
vm.runInContext(cut(html,'  function feMasterStateRank(', '  function feMasterCalMeta(')+cut(html,'  function feMasterDescriptorKey(', '  function feMasterRankWhy('),c);
vm.runInContext(`
function feMasterDescriptor(it,engine){if(!it)return null;return {engine,stateRank:feMasterStateRank(engine==='HC'?it.eval.state:it.state,engine),dq:it.eval.quality||it.eval.dq||0,fresh:1,evidenceRank:0,evidenceAge:99999,marketRank:0,calRank:0,calN:0,adaptive:it.guard?{allowTop:false}:null};}
function feMasterInteractionMeta(x){return {verdict:x.conflict?'CONFLICT':'SINGLE'};}
`,c);
const now=Date.now();let id=0,n=0;
function row(engine='FT',score=60,state='WATCH'){
 const it={id:++id,state,eval:{score,quality:4,dq:4,dataTier:'FULL',scoreMode:'FULL',state:engine==='HC'?'HOME_BIAS':state,states:{liveGap:score}},latest:{captured_at:now,status:engine==='H1'?'1H':'2H',minute:engine==='H1'?30:60,stats_presence:{pressure:true},data_health:{level:'HEALTHY'}}};
 return {id:it.id,[engine.toLowerCase()]:it,latest:it};
}
function rank(rows){c.rows=rows;return vm.runInContext('feMasterRankRows(rows)',c);}
function check(test){test();n++;}
check(()=>{const out=rank([row('FT',58),row('FT',60)]);assert.equal(out[0].ft.eval.score,60);assert.equal(out[0].__rank.top,1);assert.equal(out[0].__rank.confirmed,false);assert.equal(out[0].ft.state,'WATCH');});
check(()=>{assert.equal(rank([row('FT',64,'CANDIDATE')])[0].__rank.top,1);});
check(()=>{const out=rank([row('FT',60),row('FT',73,'READY')]);assert.equal(out[0].ft.state,'READY');assert(out[0].__rank.confirmed);});
check(()=>{assert.equal(rank(Array.from({length:8},()=>row())) .filter(x=>x.__rank.top).length,5);});
check(()=>{assert.equal(rank([row('HC',20)])[0].__rank.top,1);assert.equal(rank([row('HC',20)])[0].__rank.confirmed,false);});
check(()=>{assert.equal(rank([row('HC',0)])[0].__rank.top,1);});
for(const field of ['STALE','ENDED','DATA_WAIT','CANCELLED','COOLDOWN'])check(()=>{assert.equal(rank([row('FT',60,field)])[0].__rank.top,null);});
for(const mutate of [it=>it.latest.captured_at=now-61000,it=>it.latest.status='FT',it=>it.latest.stats_presence.pressure=false,it=>it.eval.score=null,it=>it.eval.hardVeto=true,it=>it.eval.dataIncomplete=true,it=>it.cooldownUntil=now+30000])check(()=>{const r=row();mutate(r.ft);assert.equal(rank([r])[0].__rank.top,null);});
check(()=>{const r=row('H1');r.h1.latest.minute=8;assert.equal(rank([r])[0].__rank.top,null);});
check(()=>{const r=row('HC');r.hc.eval.dataTier='MARKET_WATCH';assert.equal(rank([r])[0].__rank.top,null);});
check(()=>{const r=row();r.conflict=true;assert.equal(rank([r])[0].__rank.top,null);});
check(()=>{const r=row('FT',80,'STRONG');r.ft.guard=true;assert.equal(rank([r])[0].__rank.top,null);});
check(()=>{const r=row();r.h1=row('H1').h1;r.ft.eval.hardVeto=true;assert.equal(rank([r])[0].__rank.primary.engine,'H1');});
check(()=>{const r=row();r.ft.latest.data_health.level='PARTIAL';r.ft.eval.scoreMode='PARTIAL_STATS';assert.equal(rank([r])[0].__rank.top,1);assert.equal(rank([r])[0].__rank.confirmed,false);});
check(()=>{const rows=[row('FT',58),row('FT',60),row('HC',90),row('H1',64,'CANDIDATE')],a=rank(rows).map(x=>x.id),b=rank([...rows].reverse()).map(x=>x.id);assert.deepEqual(a,b);});
console.log('PASS TOP WATCH '+n+' cases; real generated ranking; all inline scripts parse; frozen engine code unchanged');
