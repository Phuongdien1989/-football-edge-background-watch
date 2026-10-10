import base,{BackgroundWatcher as SyncWatcher} from './worker_notify_v138_sync.js';
import {VERSION,number,gapCheck,goalPeriod,settlePaper} from './accuracy-core.js';
const reply=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,OPTIONS'}});
const parse=s=>{try{return JSON.parse(s||'{}')}catch{return {}}};
export class BackgroundWatcher extends SyncWatcher{
  async validationApi(path,params={}){
    // Provider errors must not become a valid empty fixture/event response.
    const reserve=async()=>{const day=new Date().toISOString().slice(0,10),max=Number(this.env.VALIDATION_DAILY_BUDGET)||5000;
      let b=await this.ctx.storage.get('notify:validation-budget');if(b?.day!==day)b={day,used:0};
      if(Number(b.used)>=max)throw Error('VALIDATION_DAILY_BUDGET_REACHED');
      b.used=Number(b.used||0)+1;await this.ctx.storage.put('notify:validation-budget',b);};
    const task=(this._accuracyBudgetChain||Promise.resolve()).then(reserve);this._accuracyBudgetChain=task.catch(()=>{});await task;
    return this.api(path,params,true);
  }
  async resolveGapValidation(key,v){
    const item=await this.ctx.storage.get('notify:match:'+v.fixture_id),out=gapCheck(v,item?.last);
    return out.pending?this.deferValidation(key,v,out.reason):this.finishValidation(key,v,out.result,out);
  }
  async measurementWrite(v){
    if(!this.env.FOOTBALL_DB)return;
    await this.env.FOOTBALL_DB.prepare('INSERT INTO validation_results (id,fixture_id,validation_type,created_at,result_key,payload_json) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(v.id,v.fixture_id,v.validation_type,v.signal_at,v.result_key,JSON.stringify(v)).run();
  }
  async captureMeasurement(p,row=null,legacy=false){
    const m=String(p.body||'').match(/\|\s*(\d{1,3})[′']\s*\|\s*(\d+)\s*-\s*(\d+)/),at=number(p.created_at);
    if(at===null||!p.fixture_id)return;
    for(const [kind,sig] of Object.entries(p.signals||{})){
      if(!['h1','goal','gap'].includes(kind))continue;
      const engine=kind==='h1'?'H1':kind==='goal'?'FT':'HC',group=`${p.fixture_id}-${at}-${kind}`,id=`AC-${group}-${number(sig.value)??'na'}-${String(sig.source||'na').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40)}`;
      const sc=row?.fixture?.goals,minute=row?.fixture?.fixture?.status?.elapsed;
      const v={schema:VERSION,id,observation_group:group,fixture_id:Number(p.fixture_id),signal_at:at,received_at:legacy?null:Date.now(),engine,signal_kind:kind,validation_type:'ACCURACY_'+engine+'_PERIOD',result_key:engine==='HC'?'OBSERVATION_ONLY':'PENDING',
        target:engine==='HC'?'GAP_DIRECTION_15M':engine==='H1'?'GOAL_BEFORE_HT':'GOAL_BEFORE_FT',value_type:engine==='HC'?'SIGNED_GAP':engine==='H1'?'ENGINE_SCORE':'MODEL_PROBABILITY',signal_value:number(sig.value),source:sig.source||null,
        minute:number(minute)??(m?Number(m[1]):null),score_home:number(sc?.home)??(m?Number(m[2]):null),score_away:number(sc?.away)??(m?Number(m[3]):null),
        gap_signed:kind==='gap'?(String(sig.actual||'').match(/^\s*([+-]?\d+(?:\.\d+)?)/)?.[1]??null):null,
        snapshot_version:p.snapshot_version||row?.version||null,snapshot_revision:row?.revision||null,source_health:row?.source_health||null,phase:row?.fixture?.fixture?.status?.short||null,
        input_snapshot:row?.snapshot||null,engine_evaluations:row?.engines||null,
        engine_version:legacy?'LEGACY_UNRECORDED':'P2052_FROZEN_NOTIFY_CORE',measurement_version:VERSION,provenance:legacy?'LEGACY_PUSH_BACKFILL':'PUSH_SERVICE_ACCEPTED',bet_result:false,
        measurement_started_at:Date.now(),due_at:Date.now(),attempts:0};
      await this.measurementWrite(v);
    }
  }
  async recordPushValidation(p){
    // Existing fixed-window records remain available, without changing push acceptance.
    await super.recordPushValidation(p);
    try{await this.captureMeasurement(p,await this.ctx.storage.get('notify:ui:'+p.fixture_id))}catch(e){console.log('Accuracy capture failed',String(e.message).slice(0,160))}
  }
  async migrateMeasurements(){
    if(!this.env.FOOTBALL_DB||await this.ctx.storage.get('accuracy:backfill-done'))return;
    const cursor=await this.ctx.storage.get('accuracy:backfill-cursor')||'';
    const rows=(await this.env.FOOTBALL_DB.prepare("SELECT id,fixture_id,created_at,payload_json FROM validation_results WHERE validation_type IN ('PUSH_H1_5M','PUSH_FT_10M','PUSH_HC_15M') AND id>? ORDER BY id LIMIT 80").bind(cursor).all()).results||[];
    for(const r of rows){const v=parse(r.payload_json);await this.captureMeasurement({fixture_id:r.fixture_id,created_at:v.signal_at||r.created_at,body:`${v.match||''} | ${v.minute}' | ${v.score_home}-${v.score_away}`,signals:{[v.signal_kind]:{value:v.signal_value,source:v.source,actual:v.gap_actual}}},null,true);}
    if(rows.length)await this.ctx.storage.put('accuracy:backfill-cursor',rows.at(-1).id);
    if(rows.length<80)await this.ctx.storage.put('accuracy:backfill-done',true);
  }
  async accuracyTick(){
    if(!this.env.FOOTBALL_DB)return;
    const now=Date.now();if(now-Number(await this.ctx.storage.get('accuracy:last-tick')||0)<60000)return;
    await this.ctx.storage.put('accuracy:last-tick',now);await this.migrateMeasurements();
    const db=this.env.FOOTBALL_DB;
    if(!await this.ctx.storage.get('accuracy:strict-recheck-done')){
      const old=(await db.prepare("SELECT * FROM validation_results WHERE validation_type IN ('ACCURACY_H1_PERIOD','ACCURACY_FT_PERIOD') AND result_key='UNKNOWN' AND json_extract(payload_json,'$.reason') IN ('FIXTURE_UNAVAILABLE','FINAL_LEDGER_MISMATCH') LIMIT 500").all()).results||[];
      for(const r of old){const v=parse(r.payload_json);await this.measurementWrite({...v,id:v.id+'-RECHECK',prior_measurement_id:v.id,result_key:'PENDING',attempts:0,measurement_started_at:now,due_at:now,resolved_at:null,recheck_reason:'STRICT_PROVIDER_AND_RETRY_FIX'});}
      await this.ctx.storage.put('accuracy:strict-recheck-done',true);
    }
    const rows=(await db.prepare("SELECT * FROM validation_results WHERE validation_type IN ('ACCURACY_H1_PERIOD','ACCURACY_FT_PERIOD') AND result_key='PENDING' AND COALESCE(json_extract(payload_json,'$.due_at'),0)<=? ORDER BY COALESCE(json_extract(payload_json,'$.due_at'),0),created_at LIMIT 20").bind(now).all()).results||[];
    const lastEntries=Number(await this.ctx.storage.get('accuracy:entries-at')||0),entriesDue=now-lastEntries>=300000;
    const entries=entriesDue?(await db.prepare("SELECT * FROM entry_decisions WHERE resolution='OPEN' AND engine IN ('H1','FT') AND auto_settle_supported=1 AND id NOT IN (SELECT decision_id FROM entry_outcomes) ORDER BY captured_at LIMIT 1000").all()).results||[]:[];
    const checked=await this.ctx.storage.get('accuracy:entry-checked')||{};
    const entryIds=[...new Set(entries.map(x=>x.fixture_id))].sort((a,b)=>(checked[a]||0)-(checked[b]||0));
    // Reserve two slots on entry-due ticks; otherwise live period queues can starve settlement.
    const ids=[...entryIds.slice(0,2),...new Set(rows.map(x=>x.fixture_id)),...entryIds.slice(2)].filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
    const report={at:now,version:VERSION,repair_revision:2,fixtures:ids,period_resolved:0,paper_resolved:0,errors:[]};
    for(const id of ids){
      try{
        const f=(await this.validationApi('/fixtures',{id}))[0];checked[id]=now;
        const pending=rows.filter(r=>r.fixture_id===id);let ev=null;
        if(pending.some(r=>r.validation_type==='ACCURACY_H1_PERIOD'?['HT','2H','ET','BT','P','FT','AET','PEN'].includes(f?.fixture?.status?.short):['FT','AET','PEN'].includes(f?.fixture?.status?.short)))ev=await this.validationApi('/fixtures/events',{fixture:id});
        for(const r of pending){const v=parse(r.payload_json),o=goalPeriod(v,f,ev),attempts=Number(v.attempts||0)+1;
          const started=Number(v.measurement_started_at||now),expired=now-started>48*3600000&&attempts>=5,result=o.pending?(expired?'UNKNOWN':'PENDING'):o.result;
          const next={...v,...o,measurement_started_at:started,result_key:result,attempts,due_at:now+300000,resolved_at:result==='PENDING'?null:now,evidence_received_at:Date.now()};
          await db.prepare("UPDATE validation_results SET result_key=?,payload_json=? WHERE id=? AND result_key='PENDING'").bind(result,JSON.stringify(next),r.id).run();if(result!=='PENDING')report.period_resolved++;
        }
        for(const r of entries.filter(x=>x.fixture_id===id)){
          const o=settlePaper(r,f);if(o.pending||o.unsupported)continue;
          const p={...parse(r.payload_json),resolution:o.result==='VOID'?'VOID':'RESOLVED',outcome:o.result,unit_pl:o.unit_pl,final_score:{home:o.final_score_home??null,away:o.final_score_away??null},resolved_at:now,server_measurement:o};
          // Transaction + conditional updates; source selection/line/price never change.
          await db.batch([
            db.prepare("INSERT INTO entry_outcomes (decision_id,fixture_id,engine,outcome,unit_pl,final_score_home,final_score_away,resolved_at,payload_json,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(decision_id) DO NOTHING").bind(r.id,r.fixture_id,r.engine,o.result,o.unit_pl,o.final_score_home??null,o.final_score_away??null,now,JSON.stringify(p),now),
            db.prepare("UPDATE entry_decisions SET resolution=?,outcome=?,unit_pl=?,resolved_at=?,updated_at=? WHERE id=? AND resolution='OPEN'").bind(p.resolution,o.result,o.unit_pl,now,now,r.id)
          ]);report.paper_resolved++;
        }
      }catch(e){
        checked[id]=now;const error=String(e.message).slice(0,140);report.errors.push({fixture_id:id,error});
        for(const r of rows.filter(x=>x.fixture_id===id)){const v=parse(r.payload_json);await db.prepare("UPDATE validation_results SET payload_json=? WHERE id=? AND result_key='PENDING'").bind(JSON.stringify({...v,measurement_started_at:v.measurement_started_at||now,due_at:now+300000,attempts:Number(v.attempts||0)+1,last_provider_error:error}),r.id).run();}
      }
    }
    if(entriesDue){await this.ctx.storage.put('accuracy:entries-at',now);await this.ctx.storage.put('accuracy:entry-checked',Object.fromEntries(Object.entries(checked).slice(-1000)));}
    await this.ctx.storage.put('accuracy:status',report);
  }
  async accuracySummary(){
    const db=this.env.FOOTBALL_DB;if(!db)return {ok:false,error:'D1_NOT_CONFIGURED'};
    const periods=(await db.prepare("SELECT validation_type,result_key,COUNT(*) n,COUNT(DISTINCT fixture_id) fixtures,COUNT(DISTINCT json_extract(payload_json,'$.observation_group')) observation_groups FROM validation_results WHERE validation_type LIKE 'ACCURACY_%' AND id NOT IN (SELECT json_extract(payload_json,'$.prior_measurement_id') FROM validation_results WHERE json_extract(payload_json,'$.prior_measurement_id') IS NOT NULL) GROUP BY validation_type,result_key").all()).results||[];
    const paper=(await db.prepare("SELECT d.engine,d.policy_status,o.outcome,COUNT(*) n,COUNT(DISTINCT d.fixture_id) fixtures,SUM(o.unit_pl) paper_unit_pl FROM entry_outcomes o JOIN entry_decisions d ON d.id=o.decision_id GROUP BY d.engine,d.policy_status,o.outcome").all()).results||[];
    return {ok:true,schema:VERSION,repair_revision:2,periods,paper,status:await this.ctx.storage.get('accuracy:status')||null,backfill_complete:!!await this.ctx.storage.get('accuracy:backfill-done'),notes:['H1 scores and HC GAP are not probabilities.','Threshold/device duplicates deduplicated; differing forecasts retained in one observation group.','Period observations can repeat across a fixture; not independent bets.','Paper line/price execution is unverified; no actual betting ROI.','Legacy HC labels preserved; pre-fix NEUTRALIZED may be contaminated.','Pre-retry UNKNOWN reviews retained; canonical totals prefer the appended recheck.'],engine_changed:false};
  }
  async validationSummary(){
    const d=await super.validationSummary();
    return {...d,measurement_version:VERSION,goal_window_is_not_period_prediction:true,legacy_hc_integrity:'PRE_FIX_NEUTRALIZED_UNVERIFIED',period_measurement_route:'/api/notify/accuracy'};
  }
  async fetch(request){
    const u=new URL(request.url);
    if(u.pathname==='/api/notify/accuracy'){
      if(!this.env.BACKGROUND_TOKEN||request.headers.get('authorization')!=='Bearer '+this.env.BACKGROUND_TOKEN)return reply({error:'Unauthorized'},401);
      if(request.method!=='GET')return reply({error:'METHOD_NOT_ALLOWED'},405);
      return reply(await this.accuracySummary());
    }
    return super.fetch(request);
  }
  async alarm(){
    await super.alarm();
    if((await this.scanControl())?.enabled===false)return;
    try{await this.accuracyTick()}catch(e){console.log('Accuracy follow-up failed',String(e.message).slice(0,160))}
  }
}
export default base;
