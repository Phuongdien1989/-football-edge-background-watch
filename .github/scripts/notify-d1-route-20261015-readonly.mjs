// Read-only Workers Observability audit for 2026-10-15 UTC.
// Sample per 6h window. These are LOWER BOUNDS, not complete D1 account totals.
// Do not output raw logs, event identifiers, URLs, fixture IDs or user data.
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('AUTH_MISSING');
const url='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/observability/telemetry/query';
const start=Date.parse('2026-10-15T00:00:00Z'),MS=3600000;
const totals={},windows=[];
function collectStrings(obj,into=[],depth=0){
 if(depth>8)return into;
 if(typeof obj==='string'){if(obj.includes('FE_D1_ROUTE_V1'))into.push(obj);return into;}
 if(Array.isArray(obj)){for(const v of obj)collectStrings(v,into,depth+1);return into;}
 if(obj&&typeof obj==='object')for(const [k,v] of Object.entries(obj))if(k!=='$metadata')collectStrings(v,into,depth+1);
 return into;
}
function scanEvent(event){
 const strings=collectStrings(event);const summaries=[];
 for(const s of strings){
  const pos=s.indexOf('FE_D1_ROUTE_V1 ');if(pos<0)continue;
  const tail=s.slice(pos+'FE_D1_ROUTE_V1 '.length);
  let o;try{o=JSON.parse(tail)}catch{continue}
  if(o?.schema==='FE_D1_ROUTE_V1'&&o.summary&&typeof o.summary==='object'){
   summaries.push({surface:o.surface,summary:o.summary});break;
  }
 }
 return summaries[0]||null;
}
for(let i=0;i<4;i++){
 const from=start+i*6*MS,to=from+6*MS;
 const request={queryId:'fe-notify-d1-route-20261015-'+i,timeframe:{from,to},view:'events',parameters:{datasets:[],needle:{value:'FE_D1_ROUTE_V1'}},limit:2000,dry:true};
 const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(45000)});
 const j=await r.json().catch(()=>({}));
 const v=j?.result||{},entries=Array.isArray(v.events?.events)?v.events.events:[];
 let parsed=0,stmt=0,rows=0;
 for(const ev of entries){
  const x=scanEvent(ev);if(!x)continue;parsed++;
  for(const [k,a] of Object.entries(x.summary||{})){
   const target=totals[k]||(totals[k]={rows_written:0,statements:0,missing_meta:0,records:0});
   const n=Number(a.rows_written||0),s=Number(a.statements||0);
   target.rows_written+=n;target.statements+=s;target.missing_meta+=Number(a.missing_meta||0);target.records++;
   rows+=n;stmt+=s;
  }
 }
 windows.push({from:new Date(from).toISOString(),to:new Date(to).toISOString(),http:r.status,status:v.run?.status||null,events_total_reported:v.events?.count??null,events_returned:entries.length,records_decoded:parsed,decoded_statements:stmt,decoded_rows_written:rows,truncated:entries.length>=2000,code:(j.errors||[]).map(x=>x.code).slice(0,2)});
 if(!r.ok||!j.success){process.exitCode=1;break;}
}
console.log('FE_D1_ROUTE_SOURCE_SAMPLE '+JSON.stringify({schema:'READ_ONLY_SAMPLE_V1',period:'2026-10-15_UTC',account_complete:false,not_census:true,windows,groups:totals,warning:'Recorded log sample only; Workers Logs may truncate or omit events. Do NOT reconcile directly to account D1 Analytics or estimate 24h from this sample.'}));
