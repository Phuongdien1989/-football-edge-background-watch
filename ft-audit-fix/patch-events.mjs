import assert from 'node:assert/strict';
export function patchWorker(source){
 let s=source;
 const once=(a,b)=>{assert.equal(s.split(a).length,2,'FT_PATCH_ANCHOR '+a.slice(0,60));s=s.replace(a,b);};
 s="import {observeFT,observeFTStats,observeFTRedEvents,observeFTCatalog} from './ft-events.mjs';\n"+s;
 once("const live=(await api('/fixtures',{live:'all'},true)).filter", "const ftCatalog=await api('/fixtures',{live:'all'},true);\n      const live=ftCatalog.filter");
 once("const all=await this.listNotifyMatches(),byId=new Map(all.map(x=>[x.id,x]));",
 "const all=await this.listNotifyMatches(),byId=new Map(all.map(x=>[x.id,x]));\n      // Invalidate known FT state before detail statistics, including non-batch fixtures.\n      const ftPresent=new Set(ftCatalog.map(f=>f.fixture?.id));for(const existing of all){if(observeFTCatalog(existing,ftPresent.has(existing.id),Date.now()))await this.putNotifyMatch(existing.id,existing);}\n      for(const fixture of ftCatalog){const existing=byId.get(fixture.fixture?.id);if(existing&&observeFT(existing,fixture,null,Date.now()).changed)await this.putNotifyMatch(existing.id,existing);}");
 once("const htContext=HTCollection.eligible(f)", "observeFT(item,f,null,Date.now());\n          const htContext=HTCollection.eligible(f)");
 once("const health={},sourceWarnings=[];", "const health={},sourceWarnings=[],ftSourceReceipts={};");
 once("health[name]=rows.length?'OK':'EMPTY';", "ftSourceReceipts[name]=Date.now();health[name]=rows.length?'OK':'EMPTY';");
 once("if(!stats.length){item.last=", "observeFTRedEvents(item,events,health.events,ftSourceReceipts.events);\n          if(!stats.length){item.last=");
 once("const sm=engine.statMap(stats),presence=engine.watchStatsPresence(sm,f),metric=engine.watchAggregate(sm,f),hcMetrics=engine.handicapAggregate(sm,f);",
 "const sm=engine.statMap(stats),presence=engine.watchStatsPresence(sm,f),metric=engine.watchAggregate(sm,f),hcMetrics=engine.handicapAggregate(sm,f);\n            const hasRed=stats.length>=2&&stats.every(side=>(side.statistics||[]).some(v=>v.type==='Red Cards'&&Number.isInteger(v.value)&&v.value>=0));\n            observeFT(item,f,hasRed?metric.total.red:null,Date.now());\n            observeFTStats(item,metric,ftSourceReceipts.stats);");
 once("const ft={...item,initialDQ:coverage.score,initialIntegrity:coverage.integrity_score,latest:s};", "const ft={...item,resetAt:item.ftResetAt||0,initialDQ:coverage.score,initialIntegrity:coverage.integrity_score,latest:s};");
 once("candidate=presence.core&&(!item.cooldown||stamp>=item.cooldown)?goal?.prob:null", "candidate=presence.core&&stamp>=Math.max(item.cooldown||0,item.ftCooldownUntil||0)?goal?.prob:null");
 return s;
}
export function patchUI(source){
 const a="FT:{history:item.history||[],cooldownUntil:item.cooldown||0}";
 assert.equal(source.split(a).length,2);
 return source.replace(a,"FT:{history:item.history||[],resetAt:item.ftResetAt||0,cooldownUntil:Math.max(item.cooldown||0,item.ftCooldownUntil||0)}");
}
