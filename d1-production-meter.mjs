// FE_D1_ROUTE_V1. Only observes results of EXISTING SQL operations.
// Cloudflare Workers Logs is account-scoped, not a public endpoint; no D1 log writes.
const ID='FE_D1_ROUTE_V1';
const KNOWN=new Set(['fe_notify_live_state','validation_results','qsig_results','fixtures','entry_decisions','entry_outcomes','live_snapshots','teams','fixture_history','team_fixture_history']);
const tableOf=sql=>{
 const match=/^\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)\s*["']?([a-z0-9_]+)/i.exec(sql||'');
 const t=match?.[1]?.toLowerCase();
 return KNOWN.has(t)?t:(t?'OTHER_WRITE':'UNKNOWN_SQL');
};
const category=(t,surface,source)=>{
 if(t==='fe_notify_live_state')return 'NOTIFICATION_LIVE';
 if(t==='validation_results')return surface==='DURABLE_OBJECT'?'NOTIFICATION_VALIDATION':'SYNC_VALIDATION';
 if(t==='qsig_results')return 'SYNC_QSIG';
 if(t==='entry_decisions'||t==='entry_outcomes')return 'SYNC_ENTRY';
 if(t==='teams'||t==='fixture_history'||t==='team_fixture_history')return 'SYNC_FIXTURE_CATALOG';
 if(t==='live_snapshots')return surface==='DURABLE_OBJECT'?(source==='EVIDENCE_FOLLOWUP'?'EVIDENCE':'SMART_FOLLOW'):'SYNC_LIVE';
 if(t==='fixtures')return surface==='DURABLE_OBJECT'?'SMART_FOLLOW_OR_EVIDENCE_FIXTURE':'SYNC_FIXTURE_METADATA_UNCLASSIFIED';
 return t==='OTHER_WRITE'?'UNKNOWN_TABLE':'UNKNOWN_SQL';
};
function record(result,route,group){
 const r=group[route]??(group[route]={rows_written:0,statements:0,missing_meta:0,noop_changes:0,classification:'NEW_UPDATE_RETRY_UNKNOWN'});
 r.statements++;
 const v=result?.meta?.rows_written;
 if(Number.isInteger(v)&&v>=0)r.rows_written+=v;
 else r.missing_meta++;
 if(result?.meta?.changes===0)r.noop_changes++; // a no-op is NOT evidence of a retry
}
function log(surface,summary){
 if(!Object.keys(summary).length)return;
 try{console.log(ID+' '+JSON.stringify({schema:ID,utc:new Date().toISOString(),surface,summary}));}
 catch{} // logging may never affect the D1 result
}
export function instrumentD1Binding(db,surface){
 if(!db||!['EDGE_WORKER','DURABLE_OBJECT'].includes(surface))return db;
 const map=new WeakMap();
 return new Proxy(db,{get(target,prop){
  if(prop==='prepare')return sql=>{
   let native=target.prepare(sql);
   let route=category(tableOf(sql),surface);
   const statement={
    bind(...params){
     if(tableOf(sql)==='live_snapshots'&&surface==='DURABLE_OBJECT')
       route=category('live_snapshots',surface,params[2]==='EVIDENCE_FOLLOWUP'?'EVIDENCE_FOLLOWUP':'OTHER');
     native=native.bind(...params);return statement;
    },
    async run(){const result=await native.run(),summary={};record(result,route,summary);log(surface,summary);return result;},
    all(){return native.all();},
    first(column){return native.first(column);},
    raw(){return native.raw();}
   };
   map.set(statement,()=>({native,route}));
   return statement;
  };
  if(prop==='batch')return async statements=>{
   const parts=statements.map(st=>map.get(st)?.()||{native:st,route:'UNKNOWN_EXTERNAL_STMT'});
   const result=await target.batch(parts.map(p=>p.native)),summary={};
   for(let i=0;i<parts.length;i++)record(result?.[i],parts[i].route,summary);
   log(surface,summary);
   return result;
  };
  const value=Reflect.get(target,prop,target);
  return typeof value==='function'?value.bind(target):value;
 }});
}
export function instrumentD1Env(env,surface){
 if(!env?.FOOTBALL_DB)return env;
 const metered=instrumentD1Binding(env.FOOTBALL_DB,surface);
 return new Proxy(env,{get(target,prop){return prop==='FOOTBALL_DB'?metered:Reflect.get(target,prop,target)}});
}
