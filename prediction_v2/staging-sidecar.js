import {buildMatchContextFeatures} from './context-feature-layer.js';
import {buildLiveFeaturePacket} from './live-feature-adapter.js';
import {predictShadowProbability} from './probability-engine.js';
import {rankOpportunities} from './opportunity-ranking.js';
import {compactShadowEvidence,shouldRecordShadow,settleShadowEvidence} from './shadow-evidence.js';
import {buildPairedObservation} from './old-vs-new-comparator.js';
import {createPaperMarketRecord} from './paper-market-evidence.js';

const RUNTIME=window.FE_PV2_RUNTIME;
const STATE={busy:false,lastAt:0,timer:null,rows:[],errors:[],predictionEvidence:[],pairedEvidence:[],paperEvidence:[]};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const round=(v,d=1)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
const STORE_KEY='FE_PREDICTION_V2_STAGING_EVIDENCE_V1';
function loadEvidence(){
  try{const x=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');STATE.predictionEvidence=Array.isArray(x.prediction)?x.prediction:[];STATE.pairedEvidence=Array.isArray(x.paired)?x.paired:[];STATE.paperEvidence=Array.isArray(x.paper)?x.paper:[]}catch{}
}
function saveEvidence(){
  try{localStorage.setItem(STORE_KEY,JSON.stringify({prediction:STATE.predictionEvidence.slice(-3000),paired:STATE.pairedEvidence.slice(-3000),paper:STATE.paperEvidence.slice(-1500)}))}catch{}
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
function settlePredictionRows(masterRows){
  const by=new Map((masterRows||[]).map(r=>[Number(r.id),r]));
  STATE.predictionEvidence=STATE.predictionEvidence.map(e=>{
    if(e?.outcome?.settled)return e;const row=by.get(Number(e.fixture_id)),pick=pickPredictionItem(row);if(!pick)return e;
    const s=pick.item?.latest||{},status=String(s.status||'').toUpperCase(),ended=pick.engine==='H1'?(!['1H','HT','LIVE'].includes(status)||Number(s.minute)>45):['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(status);
    return settleShadowEvidence(e,s,{ended});
  });
}
async function modelOne(row,now){
  const pick=pickPredictionItem(row);if(!pick)return null;
  const contextInput=await RUNTIME.contextInput(row.id);
  const context=buildMatchContextFeatures(contextInput||{});
  const packet=buildLiveFeaturePacket({fixtureId:row.id,engine:pick.engine,item:pick.item,context,now});
  const prediction=predictShadowProbability(packet);
  const marketRows=RUNTIME.marketRows(row.id)||[];
  return {id:Number(row.id),row,item:pick.item,engine:pick.engine,context,packet,prediction,state:packet.state,marketRows};
}
function recordEvidence(ranked,now){
  for(const x of ranked){
    const row=compactShadowEvidence({item:x.item,packet:x.packet,prediction:x.prediction,context:x.context,now});
    const prev=[...STATE.predictionEvidence].reverse().find(e=>Number(e.fixture_id)===Number(row.fixture_id)&&String(e.engine)===String(row.engine));
    if(shouldRecordShadow(prev,row))STATE.predictionEvidence.push(row);
    const old=x.row?.__rank||RUNTIME.oldRank(x.id);
    STATE.pairedEvidence.push(buildPairedObservation({fixtureId:x.id,capturedAt:now,oldRankMeta:old,newOpportunity:x,hit:null,league:x.row?.league||null,minute:x.state?.minute}));
    if(x.best_market){
      const p=createPaperMarketRecord({fixtureId:x.id,capturedAt:now,state:x.state,bestMarket:x.best_market,confidence:x.prediction?.confidence?.score_100,league:x.row?.league||null});
      if(p)STATE.paperEvidence.push(p);
    }
  }
  STATE.predictionEvidence=STATE.predictionEvidence.slice(-3000);
  STATE.pairedEvidence=STATE.pairedEvidence.slice(-3000);
  STATE.paperEvidence=STATE.paperEvidence.slice(-1500);
  saveEvidence();
}
function fmtMarket(x){
  const b=x?.best_market;if(!b)return 'NO SUPPORTED MARKET';
  const e=b.edge||{},edge=finite(e.edge_pct),fair=finite(e.fair_odds);
  return `${b.market==='TOTAL'?(b.selection==='OVER'?'O':'U'):(b.selection==='HOME'?'HOME':'AWAY')} ${b.line} @${b.odds} • FAIR ${fair??'—'} • EDGE ${edge==null?'—':(edge>=0?'+':'')+edge}%`;
}
function render(){
  const root=$('fePv2ShadowRows'),status=$('fePv2ShadowStatus'),meta=$('fePv2ShadowMeta');if(!root)return;
  const rows=STATE.rows||[];
  if(status)status.textContent=STATE.busy?'ĐANG TÍNH':STATE.errors.length?'CÓ LỖI':'SHADOW OK';
  if(meta)meta.textContent=`${rows.length} cơ hội • evidence ${STATE.predictionEvidence.length} • paired ${STATE.pairedEvidence.length} • paper ${STATE.paperEvidence.length}`;
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
async function run(){
  if(STATE.busy||!RUNTIME)return;STATE.busy=true;STATE.errors=[];render();
  try{
    const master=RUNTIME.masterRows();settlePredictionRows(master);
    const now=Date.now(),modeled=[];
    for(const row of master.slice(0,15)){
      try{const m=await modelOne(row,now);if(m)modeled.push(m)}catch(e){STATE.errors.push(`#${row?.id}: ${e?.message||e}`)}
    }
    STATE.rows=rankOpportunities(modeled);recordEvidence(STATE.rows,now);STATE.lastAt=now;
  }catch(e){STATE.errors.push(e?.message||String(e))}
  finally{STATE.busy=false;render()}
}
function exportEvidence(){
  const payload={schema:'FE_PREDICTION_V2_STAGING_EXPORT_V1',exported_at:new Date().toISOString(),staging:true,prediction:STATE.predictionEvidence,paired:STATE.pairedEvidence,paper:STATE.paperEvidence};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download=`football-edge-pv2-shadow-${Date.now()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
loadEvidence();
$('fePv2RunBtn')?.addEventListener('click',()=>run());
$('fePv2ExportBtn')?.addEventListener('click',exportEvidence);
window.addEventListener('fe-pv2-master-render',()=>{clearTimeout(STATE.timer);STATE.timer=setTimeout(run,800)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-STATE.lastAt>45000)run()});
setInterval(()=>{if(document.visibilityState==='visible')run()},60000);
render();setTimeout(run,1500);
window.FE_PV2_STAGING_STATE=STATE;
