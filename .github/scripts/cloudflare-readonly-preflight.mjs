import {readFileSync, writeFileSync} from 'node:fs';
const cfg=readFileSync('wrangler.toml','utf8');
const worker=cfg.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
const database=cfg.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const rollback=process.env.FE_ROLLBACK_VERSION_ID;
const report={commit:process.env.CANDIDATE_SHA,mode:'READ_ONLY_NO_DEPLOY',worker,checks:{},blockers:[]};
const block=s=>report.blockers.push(s);
for(const [key,value] of Object.entries({CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:account,FE_ROLLBACK_VERSION_ID:rollback})){
 report.checks[key]=Boolean(value);if(!value)block('MISSING_'+key);
}
if(!worker||!database)block('WRANGLER_WORKER_OR_D1_ID_MISSING');
if(rollback&&!rollback.startsWith('60781a4e'))block('ROLLBACK_DOES_NOT_MATCH_60781a4e');
async function api(path,options={}){
 const r=await fetch('https://api.cloudflare.com/client/v4'+path,{...options,headers:{authorization:'Bearer '+token,'content-type':'application/json'},signal:AbortSignal.timeout(20000)});
 const body=await r.json();if(!r.ok||body.success===false)throw Error('HTTP_'+r.status+'_CODES_'+(body.errors||[]).map(x=>x.code).join(','));
 return body.result;
}
if(token&&account&&worker&&database){
 const prefix='/accounts/'+encodeURIComponent(account);
 try{
  const deployments=await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/deployments');
  report.checks.deployments_read='PASS';report.currentDeployments=deployments;
 }catch(e){block('WORKERS_DEPLOYMENTS_READ:'+e.message)}
 try{
  const settings=await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/settings');
  report.workerBindingNames=(settings.bindings||[]).map(x=>({name:x.name,type:x.type,namespace_id:x.namespace_id,id:x.id}));
  report.checks.worker_settings_read='PASS';
  const namespaces=await api(prefix+'/workers/durable_objects/namespaces');
  const namespace=report.workerBindingNames.find(x=>x.name==='BACKGROUND_WATCHER')?.namespace_id;
  report.boundNamespace=(Array.isArray(namespaces)?namespaces:namespaces.namespaces||[]).find(x=>x.id===namespace)||null;
 }catch(e){block('WORKER_SETTINGS_READ:'+e.message)}
 if(rollback&&rollback.startsWith('60781a4e')){
  try{
   let full=rollback;
   if(rollback.length!==36){
    const versions=await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/versions');
    const matches=(versions.items||versions.versions||versions||[]).filter(x=>String(x.id).startsWith(rollback));
    if(matches.length!==1)throw Error('ROLLBACK_PREFIX_NOT_UNIQUE_OR_NOT_IN_VERSION_LIST_USE_FULL_UUID');
    full=matches[0].id;
   }
   const version=await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/versions/'+encodeURIComponent(full));
   report.rollbackVersion={id:version.id||full};report.checks.rollback_version_read='PASS';
  }catch(e){block('ROLLBACK_VERIFY:'+e.message)}
 }
 try{
  const db=await api(prefix+'/d1/database/'+encodeURIComponent(database));
  report.checks.d1_database_read='PASS';report.database={uuid:db.uuid,name:db.name,file_size:db.file_size};
  const schema=await api(prefix+'/d1/database/'+encodeURIComponent(database)+'/query',{method:'POST',body:JSON.stringify({sql:"SELECT name,sql FROM sqlite_master WHERE type='table' AND name='fe_notify_live_state'"})});
  if(!Array.isArray(schema)||schema.some(x=>x.success===false))throw Error('D1_SCHEMA_QUERY_FAILED');
  report.liveTableSchema=schema.flatMap(x=>x.results||[]);report.checks.d1_schema_read='PASS';
  report.checks.live_table=report.liveTableSchema.length?'EXISTS_REVIEW_COLUMNS':'ABSENT_CANDIDATE_CREATES_ON_FIRST_USE';
 }catch(e){block('D1_READ:'+e.message)}
}
report.checks.account_wide_usage='NOT_VERIFIED_REQUIRES_CLOUDFLARE_ANALYTICS';
if(token&&account){
 async function gql(query,variables={}){
  const r=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(20000)});
  const b=await r.json();if(!r.ok||b.errors?.length)throw Error('HTTP_'+r.status+':'+JSON.stringify(b.errors||[]));return b.data;
 }
 try{
  const unwrap=t=>{if(!t)throw Error('GRAPHQL_TYPE_WRAPPER_DEPTH_EXCEEDED');return t.name||unwrap(t.ofType)};
  const fields=async name=>(await gql('query($name:String!){__type(name:$name){fields{name description type{kind name ofType{kind name ofType{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}}}}}',{name})).__type?.fields||[];
  const root=(await gql('{__schema{queryType{name}}}')).__schema.queryType.name;
  const rootFields=await fields(root),viewerField=rootFields.find(x=>x.name==='viewer');
  if(!viewerField)throw Error('GRAPHQL_VIEWER_SCHEMA_MISSING');
  const viewerFields=await fields(unwrap(viewerField.type)),accountsField=viewerFields.find(x=>x.name==='accounts');
  if(!accountsField)throw Error('GRAPHQL_ACCOUNTS_SCHEMA_MISSING');
  const af=await fields(unwrap(accountsField.type));
  report.analytics={};
  const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const datasets=af.map(x=>x.name).filter(x=>/^durableObjects|^d1AnalyticsAdaptiveGroups$/.test(x));
  report.analyticsDatasetNames=datasets;
  for(const dataset of datasets){
   const f=af.find(x=>x.name===dataset);if(!f)throw Error('ANALYTICS_DATASET_NOT_AVAILABLE:'+dataset);
   const df=await fields(unwrap(f.type)),sf=df.find(x=>x.name==='sum');
   if(!sf){
    const mf=df.find(x=>x.name==='max');
    report.analytics[dataset]={datasetFields:df.map(x=>x.name)};
    if(mf){
     const maxFields=await fields(unwrap(mf.type));report.analytics[dataset].availableMaxFields=maxFields.map(x=>({name:x.name,description:x.description}));
     const names=maxFields.map(x=>x.name).filter(x=>/row|write|read/i.test(x));
     if(names.length){
      const data=await gql(`query($accountTag:string!,$start:Date,$end:Date){viewer{accounts(filter:{accountTag:$accountTag}){${dataset}(limit:10000,filter:{date_geq:$start,date_leq:$end}){max{${names.join(' ')}} dimensions{date}}}}}`,{accountTag:account,start:yesterday,end:today});
      report.analytics[dataset].daily=(data.viewer?.accounts||[]).flatMap(x=>x[dataset]||[]);
     }
    }
    continue;
   }
   const sums=await fields(unwrap(sf.type));
   const names=sums.map(x=>x.name).filter(x=>/row|write|read/i.test(x));
   report.analytics[dataset]={availableSumFields:sums.map(x=>x.name)};
   const dimensionField=df.find(x=>x.name==='dimensions');
   const dimensionNames=dimensionField?(await fields(unwrap(dimensionField.type))).map(x=>x.name):[];
   report.analytics[dataset].availableDimensions=dimensionNames;
   if(!names.length)continue;
   const query=`query($accountTag:string!,$start:Date,$end:Date){viewer{accounts(filter:{accountTag:$accountTag}){${dataset}(limit:10000,filter:{date_geq:$start,date_leq:$end}){sum{${names.join(' ')}} dimensions{date}}}}}`;
   const data=await gql(query,{accountTag:account,start:yesterday,end:today});
   report.analytics[dataset].daily=(data.viewer?.accounts||[]).flatMap(x=>x[dataset]||[]);
   const group=dimensionNames.find(x=>x==='scriptName')||dimensionNames.find(x=>x==='namespaceId')||(dataset==='d1AnalyticsAdaptiveGroups'?dimensionNames.find(x=>x==='databaseId'):null);
   if(group){
    const grouped=await gql(`query($accountTag:string!,$start:Date,$end:Date){viewer{accounts(filter:{accountTag:$accountTag}){${dataset}(limit:10000,filter:{date_geq:$start,date_leq:$end}){sum{${names.join(' ')}} dimensions{date ${group}}}}}}`,{accountTag:account,start:yesterday,end:today});
    report.analytics[dataset].byResource=(grouped.viewer?.accounts||[]).flatMap(x=>x[dataset]||[]);
   }
  }
  report.checks.analytics_read='PASS';report.checks.account_wide_usage='METRICS_RETRIEVED_REQUIRES_UNIT_AND_HEADROOM_REVIEW';
 }catch(e){block('CLOUDFLARE_ANALYTICS_READ:'+e.message)}
}

if(token&&account){
 const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
 try{
  const result=await api('/accounts/'+encodeURIComponent(account)+'/billable/usage?from='+yesterday+'&to='+today);
  if(!Array.isArray(result))throw Error('BILLABLE_USAGE_UNEXPECTED_SHAPE');
  report.billableUsage=result.map(x=>({metric:x.x_BillableMetricId,description:x.ChargeDescription,unit:x.ConsumedUnit,quantity:x.ConsumedQuantity,start:x.ChargePeriodStart,end:x.ChargePeriodEnd}));
  report.checks.billable_usage_read='PASS';
 }catch(e){report.checks.billable_usage_read=e.message;}
}
report.checks.production_deploy='NOT_ATTEMPTED';
writeFileSync('cloudflare-readonly-preflight.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.blockers.length)process.exitCode=1;
