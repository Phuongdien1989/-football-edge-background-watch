import assert from 'node:assert/strict';
export function patchRecorder(source){
 let s=source;
 const once=(a,b)=>{assert.equal(s.split(a).length,2,'RECORDER_PATCH_ANCHOR '+a.slice(0,70));s=s.replace(a,b);};
 s="import {recordFTScan} from './worker-recorder.mjs';\n"+s;
 once("const ftCatalog=await api('/fixtures',{live:'all'},true);","const ftCatalog=await api('/fixtures',{live:'all'},true);const ftCatalogReceivedAt=Date.now();");
 once("const rows=await api(path,params,name==='stats'||name==='half');","const rows=await api(path,params,name==='stats'||name==='half');ftSourceReceipts[name]=Date.now();");
 once("ftSourceReceipts[name]=Date.now();health[name]=rows.length", "health[name]=rows.length");
 once("catch(e){health[name]='ERROR';","catch(e){ftSourceReceipts[name]=Date.now();health[name]='ERROR';");
 once("if(sourceWarnings.length){status.warnings.push(",
 "try{const capturedAt=Date.now();this.ftReplayLast=await recordFTScan(this,{id:String(id)+':'+capturedAt+':'+crypto.randomUUID(),fixture:f,fixtureReceivedAt:ftCatalogReceivedAt,capturedAt,health,receipts:ftSourceReceipts,payloads:{stats,events,odds,half}});}catch{this.ftReplayLast={status:'HOOK_FAILED'};}\n          if(sourceWarnings.length){status.warnings.push(");
 return s;
}
