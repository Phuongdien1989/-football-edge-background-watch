import {buildMatchContextFeatures} from './context-feature-layer.js';
import {buildLiveFeaturePacket} from './live-feature-adapter.js';
import {predictShadowProbability} from './probability-engine.js';
import {rankOpportunities} from './opportunity-ranking.js';
import {compactShadowEvidence,shouldRecordShadow} from './shadow-evidence.js';
import {resolveStrictGoalWindows} from './strict-outcome-resolver.js';
import {marketPeriodForEngine} from './observation-contract.js';
import {buildPairedObservation} from './old-vs-new-comparator.js';
import {createPaperMarketRecord,settlePaperMarketRecord} from './paper-market-evidence.js';
import {buildValidationEvents,syncValidationEvents,parseValidationRows} from './validation-sync.js';
import {buildValidationReport} from './validation-report.js';

const RUNTIME=window.FE_PV2_RUNTIME;
const STATE={busy:false,lastAt:0,timer:null,rows:[],errors:[],predictionEvidence:[],pairedEvidence:[],paperEvidence:[],
  syncHashes:{},syncStatus:'LOCAL',lastSyncAt:0,validationVisible:false,lastReport:null};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=1)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
const STORE_KEY='FE_PREDICTION_V2_STAGING_EVIDENCE_V2';
const LEGACY_STORE_KEY='FE_PREDICTION_V2_STAGING_EVIDENCE_V1';
const HIDE_RESEARCH_MARKER='FE_PV2_HIDE_FMD_MTI_V2';
const MODEL_VERSION='PREDICTION_V2_B2_B9_BATCH02_OBSERVATION_V1';
const CONFIG_VERSION='PV2_BATCH02_NO_MODEL_WEIGHT_CHANGE';

function enforceHiddenResearchCards(){
  let style=document.getElementById('fe-pv2-hide-research-cards');
  if(!style){style=document.createElement('style');style.id='fe-pv2-hide-research-cards';style.textContent='.fmd-card,.mt-intel{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}';document.head.appendChild(style)}
  document.querySelectorAll('.fmd-card,.mt-intel').forEach(el=>{el.hidden=true;el.style.setProperty('display','none','important');el.setAttribute('data-fe-pv2-hidden','1')});
}
function loadEvidence(){
  try{
    let raw=localStorage.getItem(STORE_KEY);if(!raw)raw=localStorage.getItem(LEGACY_STORE_KEY);
    const x=JSON.parse(raw||'{}');
    STATE.predictionEvidence=Array.isArray(x.prediction)?x.prediction:[];
    STATE.pairedEvidence=Array.isArray(x.paired)?x.paired:[];
    STATE.paperEvidence=Array.isArray(x.paper)?x.paper:[];
    STATE.syncHashes=x.syncHashes&&typeof x.syncHashes==='object'?x.syncHashes:{};
  }catch{}
}
function saveEvidence(){
  try{localStorage.setItem(STORE_KEY,JSON.stringify({
    prediction:STATE.predictionEvidence.slice(-3000),paired:STATE.pairedEvidence.slice(-3000),paper:STATE.paperEvidence.slice(-1500),
    syncHashes:STATE.syncHashes
  }))}catch{}
}
function pickPredictionItem(row){
  if(row?.ft)return {item:row.ft,engine:'FT'};
  if(row?.h1)return {item:row.h1,engine:'H1'};
  if(row?.hc){
    const h=row.hc,s=h.latest||{};
    return {engine:'FT',item:{...h,latest:s,eval:{game:null,pressure:null,chance:null,momentum:null,context:null,quality:finite(h?.eval?.dq),scoreMode:'HC_BASELINE',mature:false,baselineAge:0,accel:0}}};
  }
  return null;
}
function isTerminal(status){return ['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(String(status||'').toUpperCase())}
function effectiveEventMinute(e){const m=finite(e?.time),x=finite(e?.extra);return m==null?null:m+(x&&x>0?x:0)}
function goalMinutes(events=[]){
  return (events||[]).filter(e=>String(e?.type||'').toUpperCase()==='GOAL'&&!/CANCEL|MISSED/i.test(String(e?.detail||'')))
    .map(effectiveEventMinute).filter(v=>v!=null).sort((a,b)=>a-b);
}
function settleByEvents(row,events,current,ended=false){
  if(!row||row?.outcome?.settled)return row;
  const mins=goalMinutes(events),start=finite(row.minute)??0,out={...(row.outcome||{})},first=mins.find(m=>m>start);
  if(first!=null&&out.first_goal_min==null)out.first_goal_min=first;
  const cur=finite(current?.minute);
  for(const h of [5,10,15]){
    const k=`goal_${h}m`;if(typeof out[k]==='boolean')continue;
    if(first!=null&&first-start<=h)out[k]=true;
    else if(ended||(cur!=null&&cur>=start+h))out[k]=false;
  }
  if(ended){for(const h of [5,10,15])if(typeof out[`goal_${h}m`]!=='boolean')out[`goal_${h}m`]=false}
  out.settled=[5,10,15].every(h=>typeof out[`goal_${h}m`]==='boolean');
  return {...row,outcome:out};
}
function currentStateFor(id,masterBy){
  const row=masterBy.get(Number(id)),pick=pickPredictionItem(row);
  if(pick)return {snapshot:pick.item?.latest||{},engine:pick.engine,row};
  const f=RUNTIME?.fixtureSnapshot?.(id);if(!f)return {snapshot:null,engine:null,row:null};
  return {snapshot:{minute:f?.fixture?.status?.elapsed,status:f?.fixture?.status?.short,goals:f?.goals||{}},engine:null,row:null};
}
function reconcileEvidence(masterRows){
  const by=new Map((masterRows||[]).map(r=>[Number(r.id),r]));
  STATE.predictionEvidence=STATE.predictionEvidence.map(e=>{
    const cur=currentStateFor(e.fixture_id,by),s=cur.snapshot||{},status=String(s.status||'').toUpperCase();
    const h1=String(e.engine).toUpperCase()==='H1',ended=h1?(status==='HT'||isTerminal(status)||Number(s.minute)>45):isTerminal(status),
      events=RUNTIME?.eventRows?.(e.fixture_id)||[],snapshots=RUNTIME?.outcomeSnapshots?.(e.fixture_id)||[];
    return resolveStrictGoalWindows(e,{events,snapshots,currentSnapshot:s,ended,changedAt:Date.now()});
  });
  const predMap=new Map(STATE.predictionEvidence.map(e=>[`${e.fixture_id}:${e.captured_at}`,e]));
  STATE.pairedEvidence=STATE.pairedEvidence.map(p=>{
    const e=predMap.get(`${p.fixture_id}:${p.captured_at}`);if(!e)return p;const hit=e?.outcome?.goal_10m,we=e?.outcome?.window_evidence?.goal_10m,refs=we?.refs||[],times=refs.map(r=>Date.parse(r?.received_at||'')).filter(Number.isFinite),received=times.length?new Date(Math.min(...times)).toISOString():null;
    return {...p,hit:typeof hit==='boolean'?(hit?1:0):p.hit,outcome_provenance_status:we?.strict_provenance===true?'STRICT_VALID':'UNKNOWN_PROVENANCE',outcome_received_at:received,
      new_evaluation_status:e?.observation?.strict_replay_status==='STRICT_VALID'?'STRICT_VALID':(e?.observation?.strict_replay_status||'UNKNOWN_PROVENANCE'),strict_metrics_eligible:null};
  });
  STATE.paperEvidence=STATE.paperEvidence.map(p=>{
    const cur=currentStateFor(p.fixture_id,by),s=cur.snapshot||{},status=String(s.status||'').toUpperCase(),periodResult=RUNTIME?.periodResult?.(p.fixture_id,p.market_period)||null;
    return settlePaperMarketRecord(p,{periodResult,status,changedAt:Date.now(),allowCorrection:true});
  });
}
async function modelOne(row,now){
  const pick=pickPredictionItem(row);if(!pick)return null;
  const contextInput=await RUNTIME.contextInput(row.id);
  const context=buildMatchContextFeatures(contextInput||{});
  const packet=buildLiveFeaturePacket({fixtureId:row.id,engine:pick.engine,item:pick.item,context,now});
  const prediction=predictShadowProbability(packet),marketPeriod=marketPeriodForEngine(pick.engine),marketRows=RUNTIME.marketRows(row.id)||[],sourceRefs=RUNTIME?.sourceRefs?.(row.id,pick.engine)||[];
  return {id:Number(row.id),row,item:pick.item,engine:pick.engine,marketPeriod,evaluationCutoff:now,sourceRefs,context,packet,prediction,state:packet.state,marketRows};
}
function recordEvidence(ranked,now){
  for(const x of ranked){
    const row=compactShadowEvidence({item:x.item,packet:x.packet,prediction:x.prediction,context:x.context,now,sourceRefs:x.sourceRefs||[],marketPeriod:x.marketPeriod,
      evaluationCutoff:x.evaluationCutoff??now,modelVersion:MODEL_VERSION,configVersion:CONFIG_VERSION,persistedAt:null});
    const prev=[...STATE.predictionEvidence].reverse().find(e=>Number(e.fixture_id)===Number(row.fixture_id)&&String(e.engine)===String(row.engine)&&String(e.market_period)===String(row.market_period));
    if(!shouldRecordShadow(prev,row))continue;
    STATE.predictionEvidence.push(row);
    const old=x.row?.__rank||RUNTIME.oldRank(x.id);
    STATE.pairedEvidence.push(buildPairedObservation({id:`pv2:pair:${row.observation_id}`,fixtureId:x.id,capturedAt:now,oldRankMeta:old,newOpportunity:x,hit:null,observation:row.observation,league:x.row?.league||null,minute:x.state?.minute}));
    if(x.top&&x.best_market){
      const p=createPaperMarketRecord({fixtureId:x.id,capturedAt:now,state:x.state,bestMarket:x.best_market,marketPeriod:x.marketPeriod,targetPeriod:x.marketPeriod,evaluationCutoff:x.evaluationCutoff??now,
        observation:row.observation,strict:true,confidence:x.prediction?.confidence?.score_100,league:x.row?.league||null});
      if(p)STATE.paperEvidence.push(p);
    }
  }
  STATE.predictionEvidence=STATE.predictionEvidence.slice(-3000);
  STATE.pairedEvidence=STATE.pairedEvidence.slice(-3000);
  STATE.paperEvidence=STATE.paperEvidence.slice(-1500);
  saveEvidence();
}
async function syncEvidence(){
  if(!RUNTIME?.backgroundReady?.()){STATE.syncStatus='LOCAL ONLY';return}
  try{
    const events=buildValidationEvents({prediction:STATE.predictionEvidence,paired:STATE.pairedEvidence,paper:STATE.paperEvidence});
    const res=await syncValidationEvents({events,hashes:STATE.syncHashes,request:RUNTIME.dbSync,maxBatch:60});
    STATE.syncHashes=res.hashes||STATE.syncHashes;STATE.lastSyncAt=Date.now();
    STATE.syncStatus=res.skipped?'D1 SYNCED • PERSIST ACK UNVERIFIED':'D1 SENT +'+Number(res.synced||0)+' • PERSIST ACK UNVERIFIED';saveEvidence();
  }catch(e){STATE.syncStatus='D1 ERROR';STATE.errors.push('D1: '+(e?.message||e))}
}
function fmtMarket(x){
  const b=x?.best_market;if(!b)return 'NO SUPPORTED MARKET';
  const e=b.edge||{},edge=finite(e.edge_pct),fair=finite(e.fair_odds);
  return `${b.market==='TOTAL'?(b.selection==='OVER'?'O':'U'):(b.selection==='HOME'?'HOME':'AWAY')} ${b.line} @${b.odds} • FAIR ${fair??'—'} • EDGE ${edge==null?'—':(edge>=0?'+':'')+edge}%`;
}
function renderValidation(report){
  const panel=$('fePv2ValidationPanel');if(!panel)return;
  if(!STATE.validationVisible){panel.hidden=true;return}
  panel.hidden=false;
  if(!report){panel.innerHTML='Đang tổng hợp validation…';return}
  const g=report.calibration?.goal_10m||{},m=report.market||{},o=report.old_vs_new||{},p=report.promotion||{};
  panel.innerHTML=`<b>VALIDATION • ${esc(p.stage||'COLLECT')}</b><br>
    Settled P10: <b>${g.n||0}</b> • Brier: <b>${g.brier??'—'}</b> • ECE: <b>${g.ece??'—'}</b> • Pred/Obs: <b>${g.mean_probability??'—'}% / ${g.observed_rate??'—'}%</b><br>
    OLD coverage: <b>${o.old?.coverage_pct??'—'}%</b> • NEW TOP coverage: <b>${o.new_ranked?.coverage_pct??'—'}%</b> • NEW-only: <b>${o.agreement?.new_only??0}</b><br>
    Paper settled: <b>${m.n||0}</b> • Realized: <b>${m.total_realized_units??'—'}u</b> • Positive-edge realized: <b>${m.positive_edge_realized??'—'}</b><br>
    Next checkpoint: <b>${p.next_checkpoint??'MANUAL REVIEW'}</b> • Production auto-promote: <b>NO</b>`;
}
function render(){
  const root=$('fePv2ShadowRows'),status=$('fePv2ShadowStatus'),meta=$('fePv2ShadowMeta');if(!root)return;
  const rows=STATE.rows||[];
  if(status)status.textContent=STATE.busy?'ĐANG TÍNH':STATE.errors.length?'CÓ LỖI':'SHADOW OK';
  if(meta)meta.textContent=`${rows.length} cơ hội • evidence ${STATE.predictionEvidence.length} • paired ${STATE.pairedEvidence.length} • paper ${STATE.paperEvidence.length} • ${STATE.syncStatus}`;
  renderValidation(STATE.lastReport);
  if(!rows.length){root.innerHTML='<div class="fe-pv2-empty">Chưa có H1/FT/HC candidate trong Master Opportunity.</div>';return}
  root.innerHTML=rows.slice(0,5).map(x=>{
    const p=x.prediction?.probabilities||{},c=x.prediction?.confidence||{},edge=x.best_market?.edge?.edge_pct,positive=x.edge_status==='POSITIVE_EDGE';
    return `<div class="fe-pv2-row ${positive?'positive':x.edge_status==='NO_EDGE'?'negative':''}">
      <div class="fe-pv2-rank"><b>#${x.rank}</b><span>${x.top?'TOP'+x.top:'RANK'}</span></div>
      <div class="fe-pv2-main"><b>${esc(x.row?.home||'')} vs ${esc(x.row?.away||'')}</b>
        <span>${esc(x.row?.league||'')} • ${esc(x.state?.minute??'—')}' • ${esc(x.state?.score_home??0)}-${esc(x.state?.score_away??0)}</span>
        <small>P10 ${p.goal_10m??'—'}% • P15 ${p.goal_15m??'—'}% • CONF ${c.score_100??'—'} ${esc(c.band||'')}</small>
        <em>${esc(fmtMarket(x))}</em></div>
      <div class="fe-pv2-edge ${positive?'positive':''}"><b>${edge==null?'—':(edge>=0?'+':'')+round(edge,1)+'%'}</b><span>${esc(x.edge_status||'')}</span></div>
    </div>`
  }).join('');
}
function mergeEvidence(a,b,key){
  const m=new Map();for(const x of [...(a||[]),...(b||[])]){const k=x?.[key]||x?.id;if(k)m.set(String(k),x)}return [...m.values()];
}
async function refreshValidation(){
  STATE.validationVisible=true;STATE.lastReport=null;render();
  let data={prediction:STATE.predictionEvidence,paired:STATE.pairedEvidence,paper:STATE.paperEvidence};
  if(RUNTIME?.backgroundReady?.()){
    try{
      const r=await RUNTIME.dbValidation(10000),server=parseValidationRows(r?.rows||[]);
      data={prediction:mergeEvidence(server.prediction,data.prediction,'id'),paired:mergeEvidence(server.paired,data.paired,'observation_id'),paper:mergeEvidence(server.paper,data.paper,'id')};
    }catch(e){STATE.errors.push('VALIDATION D1: '+(e?.message||e))}
  }
  STATE.lastReport=buildValidationReport(data,{strictMode:true});render();
}
async function run(){
  if(STATE.busy||!RUNTIME)return;STATE.busy=true;STATE.errors=[];render();
  try{
    const master=RUNTIME.masterRows();reconcileEvidence(master);
    const now=Date.now(),modeled=[];
    for(const row of master.slice(0,15)){
      try{const m=await modelOne(row,now);if(m)modeled.push(m)}catch(e){STATE.errors.push(`#${row?.id}: ${e?.message||e}`)}
    }
    STATE.rows=rankOpportunities(modeled,{strictMarket:true});recordEvidence(STATE.rows,now);reconcileEvidence(master);await syncEvidence();STATE.lastAt=now;
    if(STATE.validationVisible)await refreshValidation();
  }catch(e){STATE.errors.push(e?.message||String(e))}
  finally{STATE.busy=false;saveEvidence();render()}
}
function exportEvidence(){
  const report=buildValidationReport({prediction:STATE.predictionEvidence,paired:STATE.pairedEvidence,paper:STATE.paperEvidence},{strictMode:true});
  const payload={schema:'FE_PREDICTION_V2_STAGING_EXPORT_B9',exported_at:new Date().toISOString(),staging:true,report,prediction:STATE.predictionEvidence,paired:STATE.pairedEvidence,paper:STATE.paperEvidence};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download=`football-edge-pv2-shadow-${Date.now()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

enforceHiddenResearchCards();
new MutationObserver(()=>enforceHiddenResearchCards()).observe(document.documentElement,{childList:true,subtree:true});
loadEvidence();
$('fePv2RunBtn')?.addEventListener('click',()=>run());
$('fePv2ValidationBtn')?.addEventListener('click',()=>{STATE.validationVisible=!STATE.validationVisible;if(STATE.validationVisible)refreshValidation();else render()});
$('fePv2ExportBtn')?.addEventListener('click',exportEvidence);
window.addEventListener('fe-pv2-master-render',()=>{clearTimeout(STATE.timer);STATE.timer=setTimeout(run,800)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-STATE.lastAt>45000)run()});
setInterval(()=>{if(document.visibilityState==='visible')run()},60000);
render();setTimeout(run,1500);
window.FE_PV2_STAGING_STATE=STATE;
