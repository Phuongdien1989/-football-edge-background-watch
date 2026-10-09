import base,{BackgroundWatcher as ContinuousWatcher} from './worker_notify_v130.js';

// P0.9: immutable Push Signal Validation (shadow-only).
// No scoring, threshold, calibration, scan cadence or push decision is changed here.
// Reuses the existing validation_results D1 table from schema V1.23.1.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'
}});
const text=e=>String(e?.message||e||'UNKNOWN').slice(0,180);
const TYPES={
  h1:{engine:'H1',validation_type:'PUSH_H1_5M',horizon:5},
  goal:{engine:'FT',validation_type:'PUSH_FT_10M',horizon:10},
  gap:{engine:'HC',validation_type:'PUSH_HC_15M',horizon:15}
};
const TERMINAL=new Set(['FT','AET','PEN','CANC','ABD','AWD','WO']);
const H1_DONE=new Set(['HT','2H','ET','BT','P','FT','AET','PEN']);
function num(v,d=null){const x=Number(v);return Number.isFinite(x)?x:d}
function parseSnapshot(body=''){
  const s=String(body||''),m=s.match(/\|\s*(\d{1,3})[′']\s*\|\s*(\d+)\s*-\s*(\d+)/);
  const teams=s.split('|')[0]?.trim()||null;
  return {minute:m?Number(m[1]):null,score_home:m?Number(m[2]):null,score_away:m?Number(m[3]):null,match:teams};
}
function gapSigned(sig){
  const m=String(sig?.actual||'').match(/^\s*([+-]?\d+(?:\.\d+)?)/);return m?Number(m[1]):null;
}
function goalMinute(e){
  const elapsed=num(e?.time?.elapsed),extra=num(e?.time?.extra,0);return elapsed==null?null:elapsed+Math.max(0,extra||0);
}
function isGoal(e){return String(e?.type||'').toLowerCase()==='goal'&&!/miss|cancel|disallow|shootout/i.test(String(e?.detail||''))}
function safeJson(v){try{return JSON.stringify(v)}catch{return '{}'}}
function parseJson(v){try{return JSON.parse(v||'{}')}catch{return {}}}
function signalBucket(v){const n=num(v);if(n==null)return 'UNKNOWN';if(n<70)return '<70';if(n<75)return '70-74';if(n<80)return '75-79';return '80+'}
function minuteBucket(type,v){const m=num(v);if(m==null)return 'UNKNOWN';if(type==='PUSH_H1_5M')return m<30?'20-29':m<40?'30-39':'40-45';if(type==='PUSH_FT_10M')return m<=60?'46-60':m<=75?'61-75':'76-90';return 'N/A'}

export class BackgroundWatcher extends ContinuousWatcher{
  async writeValidation(v){
    if(!this.env.FOOTBALL_DB)return false;
    await this.env.FOOTBALL_DB.prepare(`INSERT INTO validation_results
      (id,fixture_id,validation_type,created_at,result_key,payload_json)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET result_key=excluded.result_key,payload_json=excluded.payload_json`)
      .bind(v.id,v.fixture_id,v.validation_type,v.signal_at,v.result_key||'PENDING',safeJson(v)).run();
    return true;
  }

  async recordPushValidation(payload){
    if(!payload?.fixture_id||!payload?.signals||typeof payload.signals!=='object')return;
    const snap=parseSnapshot(payload.body),signalAt=num(payload.created_at,Date.now());
    for(const [kind,sig] of Object.entries(payload.signals)){
      const meta=TYPES[kind];if(!meta||!sig)continue;
      const threshold=num(sig.threshold),value=num(sig.value),id=`PV-${payload.fixture_id}-${signalAt}-${kind}-${threshold??'na'}`;
      const key='notify:validation:'+id;
      if(await this.ctx.storage.get(key))continue;
      const v={schema:'FE_PUSH_VALIDATION_V1',id,fixture_id:Number(payload.fixture_id),engine:meta.engine,validation_type:meta.validation_type,signal_kind:kind,
        signal_at:signalAt,minute:snap.minute,score_home:snap.score_home,score_away:snap.score_away,match:snap.match,
        signal_value:value,threshold,source:sig.source||null,gap_signed:kind==='gap'?gapSigned(sig):null,gap_actual:sig.actual||null,
        horizon_minutes:meta.horizon,due_at:signalAt+meta.horizon*60000,result_key:'PENDING',attempts:0,resolved_at:null};
      await this.ctx.storage.put(key,v);
      try{await this.writeValidation(v)}catch(e){v.d1_error=text(e);await this.ctx.storage.put(key,v)}
    }
  }

  async send(device,payload){
    const ok=await super.send(device,payload);
    if(ok){try{await this.recordPushValidation(payload)}catch(e){console.log('Push validation capture failed',text(e))}}
    return ok;
  }

  async validationApi(path,params={}){
    const day=new Date().toISOString().slice(0,10),max=Number(this.env.VALIDATION_DAILY_BUDGET)||5000;
    let b=await this.ctx.storage.get('notify:validation-budget');if(b?.day!==day)b={day,used:0};
    if(b.used>=max)throw new Error('VALIDATION_DAILY_BUDGET_REACHED');
    b.used++;await this.ctx.storage.put('notify:validation-budget',b);
    return this.api(path,params,false);
  }

  async finishValidation(key,v,result,extra={}){
    const out={...v,...extra,result_key:result,resolved_at:Date.now()};
    try{await this.writeValidation(out)}catch(e){out.d1_error=text(e);await this.ctx.storage.put(key,out);return false}
    await this.ctx.storage.delete(key);return true;
  }

  async deferValidation(key,v,reason){
    const attempts=Number(v.attempts||0)+1;
    if(attempts>=5)return this.finishValidation(key,{...v,attempts},'UNKNOWN',{reason});
    const next={...v,attempts,due_at:Date.now()+60000,last_error:reason};
    await this.ctx.storage.put(key,next);try{await this.writeValidation(next)}catch{}return false;
  }

  async resolveGoalValidation(key,v){
    let fixtures,events;
    try{[fixtures,events]=await Promise.all([this.validationApi('/fixtures',{id:v.fixture_id}),this.validationApi('/fixtures/events',{fixture:v.fixture_id})])}
    catch(e){return this.deferValidation(key,v,text(e))}
    const f=Array.isArray(fixtures)?fixtures[0]:null;if(!f)return this.deferValidation(key,v,'FIXTURE_UNAVAILABLE');
    const status=String(f.fixture?.status?.short||''),minute=num(f.fixture?.status?.elapsed),home=num(f.goals?.home),away=num(f.goals?.away);
    const startTotal=num(v.score_home,0)+num(v.score_away,0),currentTotal=home==null||away==null?null:home+away,endMinute=num(v.minute,0)+num(v.horizon_minutes,0);
    const goals=(Array.isArray(events)?events:[]).filter(isGoal).map(e=>({minute:goalMinute(e),team:e.team?.name||null,detail:e.detail||null})).filter(e=>e.minute!=null).sort((a,b)=>a.minute-b.minute);
    const ledgerReliable=currentTotal!=null&&goals.length===currentTotal&&goals.length>=startTotal;
    if(ledgerReliable){
      const newGoals=goals.slice(startTotal),hitGoal=newGoals.find(g=>g.minute<=endMinute);
      if(hitGoal)return this.finishValidation(key,v,'HIT',{fixture_status:status,resolved_minute:minute,final_score_home:home,final_score_away:away,goal_minute:hitGoal.minute,goal_team:hitGoal.team,league:f.league?.name||null,country:f.league?.country||null});
      const periodDone=v.engine==='H1'?H1_DONE.has(status):TERMINAL.has(status);
      if(periodDone||(minute!=null&&minute>=endMinute))return this.finishValidation(key,v,'MISS',{fixture_status:status,resolved_minute:minute,final_score_home:home,final_score_away:away,league:f.league?.name||null,country:f.league?.country||null});
      return this.deferValidation(key,v,'WINDOW_NOT_REACHED');
    }
    const periodDone=v.engine==='H1'?H1_DONE.has(status):TERMINAL.has(status);
    if((periodDone||(minute!=null&&minute>=endMinute))&&currentTotal===startTotal)
      return this.finishValidation(key,v,'MISS',{fixture_status:status,resolved_minute:minute,final_score_home:home,final_score_away:away,league:f.league?.name||null,country:f.league?.country||null,source_quality:'SCORE_ONLY'});
    return this.deferValidation(key,v,'EVENT_LEDGER_INCOMPLETE');
  }

  async resolveGapValidation(key,v){
    const item=await this.ctx.storage.get('notify:match:'+v.fixture_id),last=item?.last,age=last?.at?Date.now()-Number(last.at):Infinity,end=num(last?.gap),start=num(v.gap_signed),threshold=num(v.threshold,70);
    if(start==null||end==null||age>150000)return this.deferValidation(key,v,'HC_STATE_NOT_FRESH');
    const same=Math.sign(start)===Math.sign(end),abs=Math.abs(end);let state;
    if(Math.abs(end)<20)state='NEUTRALIZED';
    else if(!same)state='FLIPPED';
    else if(abs>=threshold)state='SAME_ABOVE_THRESHOLD';
    else state='SAME_BELOW_THRESHOLD';
    return this.finishValidation(key,v,state,{gap_end:end,gap_start:start,gap_delta:end-start,state_age_ms:age});
  }

  async resolveDueValidations(){
    const map=await this.ctx.storage.list({prefix:'notify:validation:'}),now=Date.now();
    const due=[...map.entries()].filter(([,v])=>Number(v?.due_at||0)<=now).sort((a,b)=>Number(a[1].due_at)-Number(b[1].due_at)).slice(0,4);
    await Promise.allSettled(due.map(async([key,v])=>v.engine==='HC'?this.resolveGapValidation(key,v):this.resolveGoalValidation(key,v)));
  }

  async validationSummary(){
    if(!this.env.FOOTBALL_DB)return {ok:false,error:'D1_NOT_CONFIGURED'};
    const r=await this.env.FOOTBALL_DB.prepare(`SELECT validation_type,result_key,COUNT(*) AS n FROM validation_results WHERE validation_type LIKE 'PUSH_%' GROUP BY validation_type,result_key ORDER BY validation_type,result_key`).all();
    const rows=r?.results||[],types={};
    for(const x of rows){const t=x.validation_type;types[t]=types[t]||{n:0,pending:0,hit:0,miss:0,unknown:0,states:{}};const n=Number(x.n||0);types[t].n+=n;types[t].states[x.result_key]=n;if(x.result_key==='PENDING')types[t].pending+=n;else if(x.result_key==='HIT')types[t].hit+=n;else if(x.result_key==='MISS')types[t].miss+=n;else if(x.result_key==='UNKNOWN')types[t].unknown+=n}
    for(const t of Object.keys(types)){const d=types[t],den=d.hit+d.miss;d.accuracy=den?Math.round(d.hit*1000/den)/10:null;d.resolved=den}
    const rr=await this.env.FOOTBALL_DB.prepare(`SELECT validation_type,result_key,payload_json FROM validation_results WHERE validation_type IN ('PUSH_H1_5M','PUSH_FT_10M') AND result_key IN ('HIT','MISS')`).all();
    const buckets={},minutes={};
    for(const row of rr?.results||[]){const p=parseJson(row.payload_json),sb=signalBucket(p.signal_value),mb=minuteBucket(row.validation_type,p.minute),hit=row.result_key==='HIT';
      const add=(obj,key)=>{obj[key]=obj[key]||{n:0,hit:0,miss:0};obj[key].n++;obj[key][hit?'hit':'miss']++;obj[key].accuracy=Math.round(obj[key].hit*1000/obj[key].n)/10};
      buckets[row.validation_type]=buckets[row.validation_type]||{};minutes[row.validation_type]=minutes[row.validation_type]||{};add(buckets[row.validation_type],sb);add(minutes[row.validation_type],mb);
    }
    const vb=await this.ctx.storage.get('notify:validation-budget');
    return {ok:true,schema:'FE_PUSH_VALIDATION_SUMMARY_V1',generated_at:Date.now(),types,buckets,minutes,validation_api_today:vb||null,note:'Shadow validation only; never auto-tunes scoring or thresholds.'};
  }

  async validationRecent(limit=50){
    if(!this.env.FOOTBALL_DB)return {ok:false,error:'D1_NOT_CONFIGURED'};const lim=Math.max(1,Math.min(500,Number(limit)||50));
    const r=await this.env.FOOTBALL_DB.prepare(`SELECT id,fixture_id,validation_type,created_at,result_key,payload_json FROM validation_results WHERE validation_type LIKE 'PUSH_%' ORDER BY created_at DESC LIMIT ?`).bind(lim).all();
    return {ok:true,schema:'FE_PUSH_VALIDATION_RECENT_V1',rows:(r?.results||[]).map(x=>({...x,payload:parseJson(x.payload_json),payload_json:undefined}))};
  }

  async fetch(request){
    const url=new URL(request.url),path=url.pathname;
    if(path==='/api/notify/validation/summary'&&request.method==='GET'){try{return reply(await this.validationSummary())}catch(e){return reply({ok:false,error:'VALIDATION_SUMMARY_FAILED',message:text(e)},500)}}
    if(path==='/api/notify/validation/recent'&&request.method==='GET'){try{return reply(await this.validationRecent(url.searchParams.get('limit')))}catch(e){return reply({ok:false,error:'VALIDATION_RECENT_FAILED',message:text(e)},500)}}
    return super.fetch(request);
  }

  async alarm(){
    await super.alarm();
    try{await this.resolveDueValidations()}catch(e){console.log('Push validation resolve failed',text(e))}
  }
}

export default base;
