import base,{BackgroundWatcher as ExistingWatcher} from './worker_notify_v135_full_pause.js';
import {buildSnapshot} from './v2/v2_ingest_core.js';
import {persistSnapshotD1} from './v2/v2_persist_d1.js';
import {
  SHADOW_VERSION,SHADOW_POLICY,planCaptures,compactLastState
} from './v2/v2_shadow_capture_core.js';

const V2_SCHEMA_EXPECTED='2.0.0-foundation';
const DQ_VERSION_EXPECTED='DQ_V2_0_1_SHADOW';

const reply=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'*',
    'access-control-allow-headers':'authorization,content-type',
    'access-control-allow-methods':'GET,POST,OPTIONS'
  }
});

const text=e=>String(e?.message||e||'UNKNOWN').slice(0,220);
const yes=v=>['1','true','yes','on'].includes(String(v||'').toLowerCase());
const num=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
const safeJson=v=>{try{return JSON.stringify(v)}catch{return '{}'}};

function authorized(request,env){
  return !!env.BACKGROUND_TOKEN &&
    (request.headers.get('authorization')||'')===`Bearer ${env.BACKGROUND_TOKEN}`;
}

function coverageFlags(row,season){
  const seasons=Array.isArray(row?.seasons)?row.seasons:[];
  const s=seasons.find(x=>Number(x?.year)===Number(season))||seasons.find(x=>x?.current)||seasons.at(-1);
  const c=s?.coverage||{};
  const f=c?.fixtures||{};
  return {
    statistics_fixtures:f.statistics_fixtures===false?false:(f.statistics_fixtures===true?true:null),
    events:f.events===false?false:(f.events===true?true:null),
    lineups:f.lineups===false?false:(f.lineups===true?true:null),
    source:'API_FOOTBALL_LEAGUE_COVERAGE'
  };
}

function relevantEvents(events){
  return (Array.isArray(events)?events:[]).filter(e=>
    /goal|card|subst/i.test(`${e?.type||''} ${e?.detail||''}`)
  );
}

export class BackgroundWatcher extends ExistingWatcher{
  v2ShadowEnabled(){
    return yes(this.env.V2_SHADOW_ENABLED);
  }

  v2MaxFixtures(){
    return Math.max(1,Math.min(30,num(this.env.V2_SHADOW_MAX_FIXTURES,SHADOW_POLICY.max_per_tick)));
  }

  v2DailyBudget(){
    return Math.max(100,num(this.env.V2_SHADOW_DAILY_BUDGET,20000));
  }

  async v2SchemaReady(){
    if(!this.env.FOOTBALL_DB)return {ok:false,error:'D1_NOT_CONFIGURED'};
    try{
      const meta=await this.env.FOOTBALL_DB.prepare(
        "SELECT schema_version,spec_version FROM v2_schema_meta WHERE id=1 LIMIT 1"
      ).first();
      const dq=await this.env.FOOTBALL_DB.prepare(
        "SELECT dq_version,status FROM v2_quality_policies WHERE dq_version=? LIMIT 1"
      ).bind(DQ_VERSION_EXPECTED).first();
      return {
        ok:meta?.schema_version===V2_SCHEMA_EXPECTED&&!!dq,
        schema_version:meta?.schema_version||null,
        spec_version:meta?.spec_version||null,
        dq_version:dq?.dq_version||null,
        dq_status:dq?.status||null
      };
    }catch(e){
      return {ok:false,error:text(e)};
    }
  }

  async v2Budget(){
    const day=new Date().toISOString().slice(0,10);
    let b=await this.ctx.storage.get('v2:shadow:budget');
    if(!b||b.day!==day)b={day,used:0,limit:this.v2DailyBudget()};
    b.limit=this.v2DailyBudget();
    return b;
  }

  async v2Api(path,params={},strict=false){
    const b=await this.v2Budget();
    if(b.used>=b.limit)throw new Error('V2_SHADOW_DAILY_BUDGET_REACHED');
    b.used++;
    await this.ctx.storage.put('v2:shadow:budget',b);
    return this.api(path,params,strict);
  }

  async v2Coverage(leagueId,season){
    const key=`v2:coverage:${leagueId}:${season}`;
    const cached=await this.ctx.storage.get(key);
    if(cached&&Number(cached.expires_at||0)>Date.now())return cached.flags;

    try{
      const rows=await this.v2Api('/leagues',{id:leagueId,season},false);
      const flags=coverageFlags(Array.isArray(rows)?rows[0]:null,season);
      await this.ctx.storage.put(key,{
        flags,
        fetched_at:Date.now(),
        expires_at:Date.now()+6*60*60*1000
      });
      return flags;
    }catch(e){
      return {
        statistics_fixtures:null,
        events:null,
        lineups:null,
        source:'COVERAGE_UNKNOWN',
        error:text(e)
      };
    }
  }

  async v2LastMap(fixtures){
    const out={};
    await Promise.all((fixtures||[]).map(async f=>{
      const id=Number(f?.fixture?.id);
      if(!Number.isFinite(id))return;
      const x=await this.ctx.storage.get('v2:last:'+id);
      if(x)out[id]=x;
    }));
    return out;
  }

  async v2CreateRun(){
    const runId=`V2RUN-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
    await this.env.FOOTBALL_DB.prepare(`INSERT INTO v2_ingest_runs
      (run_id,source,endpoint,mode,started_at_ms,worker_version)
      VALUES (?1,'API_FOOTBALL','/fixtures?live=all','SHADOW_LIVE',?2,?3)`)
      .bind(runId,Date.now(),SHADOW_VERSION).run();
    return runId;
  }

  async v2FinishRun(runId,status){
    try{
      await this.env.FOOTBALL_DB.prepare(`UPDATE v2_ingest_runs SET
        finished_at_ms=?2,
        api_calls=?3,
        rows_seen=?4,
        rows_written=?5,
        rows_skipped=?6,
        error_count=?7,
        error_json=?8
        WHERE run_id=?1`)
        .bind(
          runId,Date.now(),
          Number(status.api_calls||0),
          Number(status.live_found||0),
          Number(status.captured||0),
          Number(status.skipped||0),
          Number(status.errors?.length||0),
          safeJson(status.errors||[])
        ).run();
    }catch(e){
      status.errors.push({stage:'FINISH_RUN',message:text(e)});
    }
  }

  async v2CaptureOne(plan,runId,status){
    const f=plan.fixture,id=plan.fixture_id;
    const started=Date.now();
    try{
      const cov=await this.v2Coverage(f.league?.id,f.league?.season);

      let stats=null,events=null;
      const calls=[];
      if(cov.statistics_fixtures!==false){
        calls.push(
          this.v2Api('/fixtures/statistics',{fixture:id},false)
            .then(v=>({kind:'stats',value:v,at:Date.now()}))
            .catch(e=>({kind:'stats',error:text(e),value:null,at:Date.now()}))
        );
      }
      if(cov.events!==false){
        calls.push(
          this.v2Api('/fixtures/events',{fixture:id},false)
            .then(v=>({kind:'events',value:v,at:Date.now()}))
            .catch(e=>({kind:'events',error:text(e),value:null,at:Date.now()}))
        );
      }

      const results=await Promise.all(calls);
      const statsResult=results.find(x=>x.kind==='stats');
      const eventResult=results.find(x=>x.kind==='events');
      stats=statsResult?.value??null;
      events=eventResult?.value??null;

      const packet=buildSnapshot({
        fixtureResponse:f,
        statisticsResponse:stats,
        eventsResponse:relevantEvents(events),
        lineupsResponse:[],
        sourceMeta:{
          fixture_fetched_at_ms:status.fixture_fetch_at,
          statistics_received:Array.isArray(stats),
          statistics_fetched_at_ms:statsResult?.at||null,
          events_received:Array.isArray(events),
          events_fetched_at_ms:eventResult?.at||null,
          lineups_expected:false,
          lineups_received:false
        },
        coverageFlags:cov,
        previous:plan.previous||null,
        observedAtMs:Date.now(),
        captureIntervalSec:plan.capture_interval_sec,
        captureReason:plan.capture_reason
      });

      await persistSnapshotD1(this.env.FOOTBALL_DB,packet,runId);

      const interest=plan.previous?.ui_interest||null;
      await this.ctx.storage.put('v2:last:'+id,compactLastState(packet,interest));

      status.captured++;
      status.gates[packet.dq.gate_status]=(status.gates[packet.dq.gate_status]||0)+1;
      status.samples.push({
        fixture_id:id,
        minute:packet.fixture.elapsed,
        status:packet.fixture.status_short,
        reason:packet.capture_reason,
        dq:packet.dq.dq_score,
        gate:packet.dq.gate_status,
        coverage:packet.dq.coverage,
        integrity:packet.dq.integrity,
        freshness:packet.dq.freshness,
        elapsed_ms:Date.now()-started
      });
      if(status.samples.length>20)status.samples.shift();
      return true;
    }catch(e){
      status.errors.push({fixture_id:id,stage:'CAPTURE',message:text(e)});
      if(status.errors.length>20)status.errors.shift();
      return false;
    }
  }

  async v2ShadowTick({manual=false}={}){
    if(!this.v2ShadowEnabled()){
      return {ok:false,skipped:true,reason:'V2_SHADOW_DISABLED'};
    }

    const schema=await this.v2SchemaReady();
    if(!schema.ok){
      const s={
        ok:false,skipped:true,reason:'V2_SCHEMA_NOT_READY',
        schema,at:Date.now(),version:SHADOW_VERSION
      };
      await this.ctx.storage.put('v2:shadow:status',s);
      return s;
    }

    const lock=await this.ctx.storage.get('v2:shadow:lock');
    if(lock&&Number(lock.until||0)>Date.now()){
      return {ok:false,skipped:true,reason:'V2_SHADOW_LOCKED'};
    }
    await this.ctx.storage.put('v2:shadow:lock',{until:Date.now()+90000});

    const budgetBefore=await this.v2Budget();
    const status={
      ok:true,
      version:SHADOW_VERSION,
      mode:'SHADOW_CAPTURE_ONLY',
      manual,
      started_at:Date.now(),
      fixture_fetch_at:null,
      live_found:0,
      due_candidates:0,
      captured:0,
      skipped:0,
      gates:{PASS:0,LIMITED:0,INSUFFICIENT:0,BLOCK:0},
      samples:[],
      errors:[],
      api_budget_before:{...budgetBefore},
      api_calls:0
    };

    let runId=null;
    try{
      runId=await this.v2CreateRun();

      const live=await this.v2Api('/fixtures',{live:'all'},true);
      status.fixture_fetch_at=Date.now();
      const rows=Array.isArray(live)?live:[];
      status.live_found=rows.length;

      const last=await this.v2LastMap(rows);
      const plans=planCaptures(rows,last,Date.now(),this.v2MaxFixtures());
      status.due_candidates=plans.length;

      for(let i=0;i<plans.length;i+=3){
        const group=plans.slice(i,i+3);
        await Promise.all(group.map(p=>this.v2CaptureOne(p,runId,status)));
      }

      status.skipped=Math.max(0,status.live_found-status.captured);
      const budgetAfter=await this.v2Budget();
      status.api_calls=Math.max(0,budgetAfter.used-budgetBefore.used);
      status.api_budget_after={...budgetAfter};
      status.finished_at=Date.now();
      status.duration_ms=status.finished_at-status.started_at;
      await this.v2FinishRun(runId,status);
      await this.ctx.storage.put('v2:shadow:status',status);
      return status;
    }catch(e){
      status.ok=false;
      status.errors.push({stage:'TICK',message:text(e)});
      const budgetAfter=await this.v2Budget();
      status.api_calls=Math.max(0,budgetAfter.used-budgetBefore.used);
      status.api_budget_after={...budgetAfter};
      status.finished_at=Date.now();
      status.duration_ms=status.finished_at-status.started_at;
      if(runId)await this.v2FinishRun(runId,status);
      await this.ctx.storage.put('v2:shadow:status',status);
      return status;
    }finally{
      await this.ctx.storage.delete('v2:shadow:lock');
    }
  }

  async v2Status(){
    const [last,budget,schema]=await Promise.all([
      this.ctx.storage.get('v2:shadow:status'),
      this.v2Budget(),
      this.v2SchemaReady()
    ]);
    return {
      ok:true,
      version:SHADOW_VERSION,
      enabled:this.v2ShadowEnabled(),
      mode:'SHADOW_CAPTURE_ONLY',
      schema,
      budget,
      policy:{
        base_interval_sec:SHADOW_POLICY.base_interval_ms/1000,
        active_interval_sec:SHADOW_POLICY.active_interval_ms/1000,
        event_min_gap_sec:SHADOW_POLICY.event_min_gap_ms/1000,
        max_per_tick:this.v2MaxFixtures()
      },
      production_engines_changed:false,
      notifications_created:false,
      state_engine_enabled:false,
      last:last||null
    };
  }

  async fetch(request){
    const url=new URL(request.url);

    if(url.pathname==='/api/v2/shadow/status'&&request.method==='GET'){
      if(!authorized(request,this.env))return reply({error:'Unauthorized'},401);
      return reply(await this.v2Status());
    }

    if(url.pathname==='/api/v2/shadow/run-once'&&request.method==='POST'){
      if(!authorized(request,this.env))return reply({error:'Unauthorized'},401);
      if(!this.v2ShadowEnabled())return reply({
        ok:false,error:'V2_SHADOW_DISABLED',
        note:'Set V2_SHADOW_ENABLED=1 before manual capture.'
      },409);
      const control=typeof this.scanControl==='function'
        ?await this.scanControl()
        :{enabled:true};
      if(control?.enabled===false)return reply({
        ok:false,error:'BACKGROUND_PAUSED'
      },409);
      return reply(await this.v2ShadowTick({manual:true}));
    }

    return super.fetch(request);
  }

  async alarm(){
    const control=typeof this.scanControl==='function'
      ?await this.scanControl()
      :{enabled:true};

    await super.alarm();

    if(control?.enabled===false)return;
    if(!this.v2ShadowEnabled())return;

    try{
      await this.v2ShadowTick({manual:false});
    }catch(e){
      console.log('V2 shadow capture failed',text(e));
    }
  }
}

export default base;
