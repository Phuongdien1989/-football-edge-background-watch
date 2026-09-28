const j=(v)=>v==null?null:JSON.stringify(v);

function eventKey(fixtureId,e){
  const stable=[
    fixtureId,e.minute??'',e.extra_minute??'',e.team_id??'',
    e.player_id??'',e.assist_id??'',e.event_type??'',e.detail??''
  ].join('|');
  let h=2166136261;
  for(let i=0;i<stable.length;i++){h^=stable.charCodeAt(i);h=Math.imul(h,16777619);}
  return `EV-${fixtureId}-${(h>>>0).toString(16).padStart(8,'0')}`;
}

function teamStatParams(packet,side){
  const s=packet.stats?.[side];
  if(!s)return null;
  const teamId=side==='home'?packet.fixture.home_team_id:packet.fixture.away_team_id;
  const fields=[
    s.shots_on_goal,s.shots_off_goal,s.total_shots,s.blocked_shots,
    s.shots_inside_box,s.shots_outside_box,s.fouls,s.corner_kicks,s.offsides,
    s.possession_pct,s.yellow_cards,s.red_cards,s.goalkeeper_saves,
    s.total_passes,s.passes_accurate,s.passes_pct,s.expected_goals
  ];
  const present=fields.filter(v=>v!==null&&v!==undefined).length;
  return [
    packet.snapshot_id,packet.fixture_id,teamId,side.toUpperCase(),
    ...fields,present,22,j(s.extras||{})
  ];
}

export function buildPersistenceOps(packet,ingestRunId=null){
  const f=packet.fixture,dq=packet.dq;
  if(!packet?.snapshot_id||!packet?.fixture_id)throw new Error('INVALID_SNAPSHOT');
  if(!f?.league_id||!f?.season_year||!f?.home_team_id||!f?.away_team_id)throw new Error('MASTER_KEYS_MISSING');

  const ops=[];

  ops.push({
    name:'league_upsert',
    sql:`INSERT INTO v2_leagues
      (league_id,name,country,active,source,updated_at_utc)
      VALUES (?1,?2,?3,1,'API_FOOTBALL',CURRENT_TIMESTAMP)
      ON CONFLICT(league_id) DO UPDATE SET
        name=excluded.name,
        country=COALESCE(excluded.country,v2_leagues.country),
        updated_at_utc=CURRENT_TIMESTAMP`,
    params:[f.league_id,f.league_name||`League ${f.league_id}`,f.country]
  });

  ops.push({
    name:'season_upsert',
    sql:`INSERT INTO v2_seasons
      (league_id,season_year,current,updated_at_utc)
      VALUES (?1,?2,1,CURRENT_TIMESTAMP)
      ON CONFLICT(league_id,season_year) DO UPDATE SET updated_at_utc=CURRENT_TIMESTAMP`,
    params:[f.league_id,f.season_year]
  });

  for(const [teamId,name] of [[f.home_team_id,f.home_name],[f.away_team_id,f.away_name]]){
    ops.push({
      name:'team_upsert',
      sql:`INSERT INTO v2_teams
        (team_id,name,source,updated_at_utc)
        VALUES (?1,?2,'API_FOOTBALL',CURRENT_TIMESTAMP)
        ON CONFLICT(team_id) DO UPDATE SET
          name=excluded.name,updated_at_utc=CURRENT_TIMESTAMP`,
      params:[teamId,name||`Team ${teamId}`]
    });
  }

  ops.push({
    name:'fixture_upsert',
    sql:`INSERT INTO v2_fixtures
      (fixture_id,league_id,season_year,home_team_id,away_team_id,
       kickoff_ts,kickoff_utc,round_name,timezone,venue_name,venue_city,referee,
       status_short,status_long,elapsed,extra_minute,
       score_home,score_away,ht_home,ht_away,ft_home,ft_away,
       last_source_update_ms,last_ingested_at_ms,source_hash,fixture_payload_json,
       created_at_utc,updated_at_utc)
      VALUES
      (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,
       ?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,
       ?23,?24,?25,?26,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT(fixture_id) DO UPDATE SET
       status_short=excluded.status_short,status_long=excluded.status_long,
       elapsed=excluded.elapsed,extra_minute=excluded.extra_minute,
       score_home=excluded.score_home,score_away=excluded.score_away,
       ht_home=COALESCE(excluded.ht_home,v2_fixtures.ht_home),
       ht_away=COALESCE(excluded.ht_away,v2_fixtures.ht_away),
       ft_home=COALESCE(excluded.ft_home,v2_fixtures.ft_home),
       ft_away=COALESCE(excluded.ft_away,v2_fixtures.ft_away),
       last_source_update_ms=excluded.last_source_update_ms,
       last_ingested_at_ms=excluded.last_ingested_at_ms,
       source_hash=excluded.source_hash,updated_at_utc=CURRENT_TIMESTAMP
      WHERE excluded.last_ingested_at_ms >= COALESCE(v2_fixtures.last_ingested_at_ms,0)`,
    params:[
      f.fixture_id,f.league_id,f.season_year,f.home_team_id,f.away_team_id,
      f.kickoff_ts,f.kickoff_utc,f.round_name,f.timezone,f.venue_name,f.venue_city,f.referee,
      f.status_short,f.status_long,f.elapsed,f.extra_minute,
      f.score_home,f.score_away,f.ht_home,f.ht_away,f.ft_home,f.ft_away,
      packet.observed_at_ms,packet.observed_at_ms,packet.source_hash,j(f)
    ]
  });

  ops.push({
    name:'snapshot_insert',
    sql:`INSERT OR IGNORE INTO v2_live_snapshots
      (snapshot_id,fixture_id,capture_bucket,capture_interval_sec,capture_reason,
       observed_at_ms,observed_at_utc,source_updated_at_ms,
       minute,extra_minute,period,status_short,
       score_home,score_away,ht_home,ht_away,
       events_count,stats_available,lineup_available,
       source_hash,event_hash,stats_hash,raw_payload_ref,ingest_run_id)
      VALUES
      (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,
       ?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,NULL,?23)`,
    params:[
      packet.snapshot_id,packet.fixture_id,packet.capture_bucket,packet.capture_interval_sec,
      packet.capture_reason,packet.observed_at_ms,packet.observed_at_utc,
      packet.observed_at_ms,f.elapsed,f.extra_minute,f.status_short,f.status_short,
      f.score_home,f.score_away,f.ht_home,f.ht_away,
      packet.events?.length||0,packet.stats?.home&&packet.stats?.away?1:0,
      packet.lineups?.length?1:0,packet.source_hash,packet.event_hash,packet.stats_hash,
      ingestRunId
    ]
  });

  const statSql=`INSERT OR IGNORE INTO v2_live_team_stats
    (snapshot_id,fixture_id,team_id,side,
     shots_on_goal,shots_off_goal,total_shots,blocked_shots,shots_inside_box,shots_outside_box,
     fouls,corner_kicks,offsides,possession_pct,yellow_cards,red_cards,goalkeeper_saves,
     total_passes,passes_accurate,passes_pct,expected_goals,
     stat_fields_present,stat_fields_expected,extras_json)
    VALUES
    (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,
     ?18,?19,?20,?21,?22,?23,?24)`;

  for(const side of ['home','away']){
    const params=teamStatParams(packet,side);
    if(params)ops.push({name:`stats_${side}_insert`,sql:statSql,params});
  }

  ops.push({
    name:'dq_insert',
    sql:`INSERT OR IGNORE INTO v2_data_quality_snapshots
      (snapshot_id,fixture_id,observed_at_ms,
       coverage,integrity,freshness,dq_score,
       source_age_sec,stats_age_sec,events_age_sec,
       gate_status,missing_fields_json,integrity_flags_json,freshness_flags_json,
       anomaly_json,dq_version,capability_json)
      VALUES
      (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)`,
    params:[
      packet.snapshot_id,packet.fixture_id,packet.observed_at_ms,
      dq.coverage,dq.integrity,dq.freshness,dq.dq_score,
      dq.source_age_sec,dq.stats_age_sec,dq.events_age_sec,dq.gate_status,
      j(dq.missing_fields),j(dq.integrity_flags),j(dq.freshness_flags),
      j({capture_reason:packet.capture_reason}),dq.dq_version,j(dq.capability)
    ]
  });

  for(const e of packet.events||[]){
    const key=eventKey(packet.fixture_id,e);
    ops.push({
      name:'event_upsert',
      sql:`INSERT INTO v2_fixture_events
        (event_key,fixture_id,event_order,minute,extra_minute,team_id,player_id,assist_id,
         event_type,detail,comments,first_observed_at_ms,last_observed_at_ms,source_hash,payload_json)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
        ON CONFLICT(event_key) DO UPDATE SET
          last_observed_at_ms=MAX(v2_fixture_events.last_observed_at_ms,excluded.last_observed_at_ms),
          comments=COALESCE(excluded.comments,v2_fixture_events.comments),
          payload_json=excluded.payload_json`,
      params:[
        key,packet.fixture_id,e.event_order,e.minute,e.extra_minute,e.team_id,e.player_id,e.assist_id,
        e.event_type,e.detail,e.comments,packet.observed_at_ms,packet.observed_at_ms,
        packet.event_hash,j(e)
      ]
    });
  }

  for(const l of packet.lineups||[]){
    const lineupId=`LU-${packet.fixture_id}-${l.team_id}-${packet.capture_bucket}`;
    ops.push({
      name:'lineup_insert',
      sql:`INSERT OR IGNORE INTO v2_lineup_snapshots
        (lineup_id,fixture_id,team_id,captured_at_ms,formation,coach_id,
         starting_xi_json,substitutes_json,source_hash)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
      params:[
        lineupId,packet.fixture_id,l.team_id,packet.observed_at_ms,l.formation,l.coach_id,
        j(l.starting_xi),j(l.substitutes),packet.source_hash
      ]
    });
  }

  ops.push({
    name:'current_cache_upsert',
    sql:`INSERT INTO v2_current_fixture_state
      (fixture_id,latest_snapshot_id,latest_state_id,latest_dq_score,latest_gate_status,
       attention_score,timeline_bucket,updated_at_ms)
      VALUES (?1,?2,NULL,?3,?4,NULL,'NONE',?5)
      ON CONFLICT(fixture_id) DO UPDATE SET
        latest_snapshot_id=excluded.latest_snapshot_id,
        latest_dq_score=excluded.latest_dq_score,
        latest_gate_status=excluded.latest_gate_status,
        updated_at_ms=excluded.updated_at_ms
      WHERE excluded.updated_at_ms >= v2_current_fixture_state.updated_at_ms`,
    params:[packet.fixture_id,packet.snapshot_id,dq.dq_score,dq.gate_status,packet.observed_at_ms]
  });

  return ops;
}

export async function persistSnapshotD1(db,packet,ingestRunId=null){
  const ops=buildPersistenceOps(packet,ingestRunId);
  const statements=ops.map(op=>db.prepare(op.sql).bind(...op.params));
  const results=await db.batch(statements);
  return {ok:true,snapshot_id:packet.snapshot_id,fixture_id:packet.fixture_id,op_count:ops.length,results};
}
