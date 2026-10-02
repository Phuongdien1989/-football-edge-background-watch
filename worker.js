const BASE = 'https://v3.football.api-sports.io';
const WORKER_VERSION = 'RAW_COLLECTOR_V0.4.1';
const CAPTURE_SCHEMA_VERSION = 'RAW_CAPTURE_V0.4';
const API_VERSION = 'v3';
const PROVIDER = 'API_FOOTBALL';
const SOURCE = 'CLOUDFLARE_V2_RAW_CAPTURE';
const iso = () => new Date().toISOString();
const num = (v, d = null) => { if (v === null || v === undefined || v === '') return d; const n = Number(v); return Number.isFinite(n) ? n : d; };
const flag = (v, d = false) => v == null ? d : /^(1|true|yes|on)$/i.test(String(v));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isRateLimitError = e => /rateLimit|API_HTTP_429|Too many requests/i.test(String(e?.message||e||''));
const stable = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
  .map(b => b.toString(16).padStart(2, '0')).join('');
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

function quotaHeaders(headers) {
  return {
    daily_limit: num(headers.get('x-ratelimit-requests-limit')),
    daily_remaining: num(headers.get('x-ratelimit-requests-remaining')),
    minute_limit: num(headers.get('x-ratelimit-limit')),
    minute_remaining: num(headers.get('x-ratelimit-remaining')),
  };
}
function fixtureCoverage(item) {
  const events = Array.isArray(item?.events) ? item.events : [];
  const stats = Array.isArray(item?.statistics) ? item.statistics : [];
  let statsValues = 0;
  for (const team of stats) for (const s of (team?.statistics || [])) if (s?.value !== null && s?.value !== undefined) statsValues++;
  return {
    event_count: events.length,
    stats_team_count: stats.length,
    stats_value_count: statsValues,
    has_events: events.length > 0 ? 1 : 0,
    has_stats: stats.length >= 2 && statsValues > 0 ? 1 : 0,
    has_lineups: Array.isArray(item?.lineups) && item.lineups.length > 0 ? 1 : 0,
    has_players: Array.isArray(item?.players) && item.players.length > 0 ? 1 : 0,
  };
}
async function setState(env, key, value) {
  await env.DB.prepare(`INSERT INTO collector_state(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .bind(key, String(value), iso()).run();
}
async function getState(env, key) {
  const r = await env.DB.prepare('SELECT value,updated_at FROM collector_state WHERE key=?').bind(key).first();
  return r || null;
}
async function recordCycleStart(env, cycleId, triggerType) {
  await env.DB.prepare(`INSERT INTO capture_cycles(cycle_id,trigger_type,started_at,status,worker_version) VALUES(?,?,?,?,?)`)
    .bind(cycleId, triggerType, iso(), 'RUNNING', WORKER_VERSION).run();
}
async function recordCycleEnd(env, cycleId, patch) {
  await env.DB.prepare(`UPDATE capture_cycles SET completed_at=?,status=?,live_count=?,detail_requests=?,total_requests=?,detail_fixture_count=?,fixtures_with_stats=?,fixtures_with_events=?,daily_limit=?,daily_remaining=?,minute_limit=?,minute_remaining=?,stop_reason=?,error_message=? WHERE cycle_id=?`)
    .bind(iso(), patch.status || 'OK', patch.live_count || 0, patch.detail_requests || 0, patch.total_requests || 0,
      patch.detail_fixture_count || 0, patch.fixtures_with_stats || 0, patch.fixtures_with_events || 0,
      patch.daily_limit, patch.daily_remaining, patch.minute_limit, patch.minute_remaining,
      patch.stop_reason || null, patch.error_message || null, cycleId).run();
}
async function recordEndpointEvidence(env, requestId, endpoint, params, received, payload, payloadHash) {
  const fid = num(params?.fixture);
  if (fid == null) return null;
  let kind = null;
  if (endpoint === '/fixtures/events') kind = 'EVENTS';
  else if (endpoint === '/fixtures/statistics') kind = 'STATISTICS';
  if (!kind) return null;
  const rows = Array.isArray(payload?.response) ? payload.response : [];
  let nonNull = 0;
  if (kind === 'STATISTICS') {
    for (const team of rows) for (const st of (team?.statistics || [])) if (st?.value !== null && st?.value !== undefined) nonNull++;
  } else {
    nonNull = rows.length;
  }
  const body = JSON.stringify(payload);
  const eid = 'EV-' + (await stable(`${requestId}|${kind}|${fid}|${payloadHash}`)).slice(0,24);
  await env.DB.prepare(`INSERT OR IGNORE INTO raw_fixture_evidence
    (evidence_id,request_id,fixture_id,evidence_kind,received_at,item_count,non_null_value_count,payload_hash,payload_json)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(eid,requestId,fid,kind,received,rows.length,nonNull,payloadHash,body).run();
  return {kind, fixture_id:fid, item_count:rows.length, non_null_value_count:nonNull};
}

async function apiGet(env, endpoint, params) {
  const started = iso();
  const qs = new URLSearchParams(params);
  const url = `${BASE}${endpoint}?${qs}`;
  const r = await fetch(url, {headers:{'x-apisports-key':env.APISPORTS_KEY,'accept':'application/json'}});
  const text = await r.text();
  const received = iso();
  const quota = quotaHeaders(r.headers);
  let payload;
  try { payload = JSON.parse(text); } catch { payload = {response:[], errors:{parse:'INVALID_JSON'}}; }
  const payloadHash = await stable(text);
  const requestId = 'RAW-' + (await stable(JSON.stringify({endpoint,params,started,received,payloadHash}))).slice(0,24);
  await env.DB.prepare(`INSERT OR IGNORE INTO raw_api_requests
    (request_id,provider,api_version,endpoint,params_json,request_started_at,received_at,http_status,source,capture_schema_version,payload_hash,payload_json,daily_limit,daily_remaining,minute_limit,minute_remaining,api_results,api_errors_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(requestId, PROVIDER, API_VERSION, endpoint, JSON.stringify(params), started, received, r.status, SOURCE,
      CAPTURE_SCHEMA_VERSION, payloadHash, text, quota.daily_limit, quota.daily_remaining, quota.minute_limit, quota.minute_remaining,
      num(payload?.results, 0), JSON.stringify(payload?.errors || {})).run();
  await setState(env, 'last_daily_remaining', quota.daily_remaining ?? 'UNKNOWN');
  await setState(env, 'last_daily_limit', quota.daily_limit ?? 'UNKNOWN');
  await setState(env, 'last_received_at', received);
  if (!r.ok) throw new Error(`API_HTTP_${r.status}`);
  if (payload?.errors && Object.keys(payload.errors).length) throw new Error(`API_PAYLOAD_ERROR:${JSON.stringify(payload.errors).slice(0,300)}`);
  const endpointEvidence = await recordEndpointEvidence(env,requestId,endpoint,params,received,payload,payloadHash);
  let detailFixtureCount = 0, fixturesWithStats = 0, fixturesWithEvents = 0;
  for (const item of payload.response || []) {
    const fid = item?.fixture?.id;
    if (fid == null) continue;
    const fp = JSON.stringify(item);
    const fh = await stable(fp);
    const cid = 'FC-' + (await stable(`${requestId}|${fid}|${fh}`)).slice(0,24);
    const c = fixtureCoverage(item);
    await env.DB.prepare(`INSERT OR IGNORE INTO raw_fixture_captures
      (capture_id,request_id,fixture_id,match_clock,status_short,received_at,fixture_payload_hash,fixture_json,event_count,stats_team_count,stats_value_count,has_events,has_stats,has_lineups,has_players)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(cid,requestId,fid,item?.fixture?.status?.elapsed??null,item?.fixture?.status?.short??null,received,fh,fp,
        c.event_count,c.stats_team_count,c.stats_value_count,c.has_events,c.has_stats,c.has_lineups,c.has_players).run();
    detailFixtureCount++;
    fixturesWithStats += c.has_stats;
    fixturesWithEvents += c.has_events;
  }
  return {payload, requestId, received, quota, detailFixtureCount, fixturesWithStats, fixturesWithEvents, endpointEvidence};
}
async function apiGetWithRetry(env, endpoint, params, retries=1) {
  let last;
  for (let attempt=0; attempt<=retries; attempt++) {
    try { return await apiGet(env, endpoint, params); }
    catch (e) {
      last=e;
      if (!isRateLimitError(e) || attempt>=retries) throw e;
      await sleep(3500*(attempt+1));
    }
  }
  throw last;
}
function chunks(a,n){ const out=[]; for(let i=0;i<a.length;i+=n) out.push(a.slice(i,i+n)); return out; }
async function providerQuota(env) {
  const started = iso();
  try {
    const r = await fetch(`${BASE}/status`, {headers:{'x-apisports-key':env.APISPORTS_KEY,'accept':'application/json'}});
    const text = await r.text();
    let p;
    try { p = JSON.parse(text); } catch { p = null; }
    if (!r.ok || !p) throw new Error(`PROVIDER_STATUS_HTTP_${r.status}`);
    const body = Array.isArray(p?.response) ? p.response[0] : p?.response;
    const current = num(body?.requests?.current);
    const limitDay = num(body?.requests?.limit_day);
    if (current == null || limitDay == null || limitDay <= 0) {
      const errText = JSON.stringify(p?.errors || {});
      if (/rateLimit|Too many requests/i.test(errText)) throw new Error('PROVIDER_STATUS_RATE_LIMIT');
      throw new Error('PROVIDER_STATUS_QUOTA_MISSING');
    }
    return {
      checked_at: started,
      current,
      limit_day: limitDay,
      remaining: Math.max(0, limitDay-current),
      plan: body?.subscription?.plan ? String(body.subscription.plan).slice(0,40) : null,
      stale: false
    };
  } catch (e) {
    const [lim,cur,plan] = await Promise.all([
      getState(env,'provider_limit_day'),
      getState(env,'provider_current'),
      getState(env,'provider_plan')
    ]);
    const limitDay=num(lim?.value), current=num(cur?.value);
    const ageMs=Date.now()-Date.parse(cur?.updated_at||0);
    if (limitDay != null && current != null && ageMs >= 0 && ageMs <= 10*60*1000) {
      const safety = 5000;
      return {
        checked_at: started,
        current,
        limit_day: limitDay,
        remaining: Math.max(0,limitDay-current-safety),
        plan: plan?.value && plan.value!=='UNKNOWN' ? plan.value : null,
        stale: true,
        fallback_reason: String(e?.message||e).slice(0,120)
      };
    }
    throw e;
  }
}
async function collectorUsedToday(env) {
  const day = iso().slice(0,10);
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM raw_api_requests WHERE substr(received_at,1,10)=?").bind(day).first();
  return Math.max(0, num(r?.n,0));
}
async function quotaGuard(env) {
  const q = await providerQuota(env);
  const reserve = Math.max(0, num(env.API_SHARED_RESERVE,10000));
  const legacyBudget = Math.max(0, num(env.LEGACY_DAILY_BUDGET,50000));
  const collectorMax = Math.max(0, num(env.COLLECTOR_DAILY_BUDGET_MAX,12000));
  const collectorBudget = Math.max(0, Math.min(collectorMax, q.limit_day-legacyBudget-reserve));
  const collectorUsed = await collectorUsedToday(env);
  let stop_reason = null;
  if (q.remaining <= reserve) stop_reason = 'PROVIDER_DAILY_RESERVE';
  else if (collectorBudget <= 0) stop_reason = 'NO_SAFE_COLLECTOR_BUDGET';
  else if (collectorUsed >= collectorBudget) stop_reason = 'COLLECTOR_DAILY_BUDGET';
  return {
    skip: !!stop_reason,
    stop_reason,
    reserve,
    legacy_budget: legacyBudget,
    collector_budget: collectorBudget,
    collector_used: collectorUsed,
    collector_remaining: Math.max(0,collectorBudget-collectorUsed),
    provider: q
  };
}
async function capture(env, triggerType='SCHEDULED') {
  const cycleId = 'CY-' + (await stable(`${triggerType}|${iso()}|${crypto.randomUUID()}`)).slice(0,24);
  await recordCycleStart(env, cycleId, triggerType);
  const summary = {cycle_id:cycleId,status:'OK',live_count:0,detail_requests:0,total_requests:0,detail_fixture_count:0,fixtures_with_stats:0,fixtures_with_events:0,
    daily_limit:null,daily_remaining:null,minute_limit:null,minute_remaining:null,stop_reason:null};
  try {
    if (!flag(env.CAPTURE_ENABLED, true)) { summary.status='SKIPPED'; summary.stop_reason='CAPTURE_DISABLED'; await recordCycleEnd(env,cycleId,summary); return summary; }
    if (!env.APISPORTS_KEY) { summary.status='BLOCKED'; summary.stop_reason='APISPORTS_KEY_MISSING'; await recordCycleEnd(env,cycleId,summary); return summary; }

    const backoff = await getState(env,'rate_backoff_until');
    const backoffUntil = num(backoff?.value);
    if (backoffUntil != null && Date.now() < backoffUntil) {
      summary.status='SKIPPED'; summary.stop_reason='RATE_LIMIT_BACKOFF';
      await recordCycleEnd(env,cycleId,summary); return summary;
    }

    if (triggerType === 'SCHEDULED') {
      const lastAttempt = await getState(env,'last_capture_attempt_at');
      const lastAttemptAt = num(lastAttempt?.value);
      const intervalMs = Math.max(60000,Math.min(15*60*1000,num(env.CAPTURE_INTERVAL_MS,180000)));
      if (lastAttemptAt != null && Date.now()-lastAttemptAt < intervalMs) {
        summary.status='SKIPPED'; summary.stop_reason='CADENCE_GUARD';
        await recordCycleEnd(env,cycleId,summary); return summary;
      }
      await setState(env,'last_capture_attempt_at',Date.now());
    }

    const pre = await quotaGuard(env);
    summary.daily_limit = pre.provider.limit_day;
    summary.daily_remaining = pre.provider.remaining;
    if (!pre.provider.stale) {
      await setState(env,'provider_plan',pre.provider.plan || 'UNKNOWN');
      await setState(env,'provider_limit_day',pre.provider.limit_day);
      await setState(env,'provider_current',pre.provider.current);
    }
    await setState(env,'collector_budget',pre.collector_budget);
    await setState(env,'collector_used',pre.collector_used);
    if (pre.skip) {
      summary.status='SKIPPED';
      summary.stop_reason=pre.stop_reason;
      await recordCycleEnd(env,cycleId,summary);
      return summary;
    }

    const maxPerCycle = Math.max(1, Math.min(20, num(env.CAPTURE_MAX_REQUESTS_PER_CYCLE, 8)));
    const requestAllowance = Math.max(1, Math.min(maxPerCycle, pre.collector_remaining));
    const jitterMs = Math.max(0, Math.min(30000, num(env.CAPTURE_JITTER_MS,9000)));
    if (jitterMs) await sleep(jitterMs);
    const live = await apiGetWithRetry(env, '/fixtures', {live:'all'}, 1);
    summary.total_requests++;
    if (live.quota.daily_limit != null) summary.daily_limit = live.quota.daily_limit;
    if (live.quota.daily_remaining != null) summary.daily_remaining = live.quota.daily_remaining;
    if (live.quota.minute_limit != null) summary.minute_limit = live.quota.minute_limit;
    if (live.quota.minute_remaining != null) summary.minute_remaining = live.quota.minute_remaining;

    const liveItems = (live.payload.response || []).filter(x=>x?.fixture?.id!=null);
    const ids = liveItems.map(x=>x.fixture.id);
    summary.live_count = ids.length;
    if (!ids.length) { summary.stop_reason='NO_LIVE_FIXTURES'; await recordCycleEnd(env,cycleId,summary); return summary; }

    let requestsLeft = Math.max(0, requestAllowance - 1);
    const spacingMs = Math.max(250, Math.min(5000, num(env.DETAIL_SPACING_MS,1500)));
    const wantedEvidence = Math.max(0, Math.min(10, num(env.EVIDENCE_FIXTURES_PER_CYCLE,3)));
    const cursorState = await getState(env,'evidence_cursor');
    let cursor = Math.max(0,num(cursorState?.value,0));
    const evidenceFixtureCount = Math.min(ids.length, wantedEvidence, Math.floor(requestsLeft/2));
    const rankedIds = [...liveItems].sort((a,b)=>{
      const ae=(a?.events||[]).length, be=(b?.events||[]).length;
      if(be!==ae) return be-ae;
      const am=Number(a?.fixture?.status?.elapsed||0), bm=Number(b?.fixture?.status?.elapsed||0);
      return bm-am;
    }).map(x=>x.fixture.id);
    const selected = [];
    for (let i=0;i<evidenceFixtureCount;i++) selected.push(rankedIds[(cursor+i)%rankedIds.length]);
    if (ids.length) await setState(env,'evidence_cursor',(cursor+evidenceFixtureCount)%ids.length);

    for (const fid of selected) {
      for (const [endpoint,kind] of [['/fixtures/statistics','STATISTICS'],['/fixtures/events','EVENTS']]) {
        if (requestsLeft <= 0) break;
        await sleep(spacingMs);
        const e = await apiGetWithRetry(env, endpoint, {fixture:String(fid)}, 1);
        summary.detail_requests++; summary.total_requests++; requestsLeft--;
        if (kind==='EVENTS' && (e.endpointEvidence?.item_count||0)>0) summary.fixtures_with_events++;
        if (kind==='STATISTICS' && (e.endpointEvidence?.non_null_value_count||0)>0) summary.fixtures_with_stats++;
        if (e.quota.daily_limit != null) summary.daily_limit = e.quota.daily_limit;
        if (e.quota.daily_remaining != null) summary.daily_remaining = e.quota.daily_remaining;
        if (e.quota.minute_limit != null) summary.minute_limit = e.quota.minute_limit;
        if (e.quota.minute_remaining != null) summary.minute_remaining = e.quota.minute_remaining;
      }
    }

    if (requestsLeft > 0) {
      await sleep(spacingMs);
      const batch = ids.slice(0,20);
      const d = await apiGetWithRetry(env, '/fixtures', {ids:batch.join('-')}, 1);
      summary.detail_requests++; summary.total_requests++; requestsLeft--;
      summary.detail_fixture_count += d.detailFixtureCount;
      summary.fixtures_with_stats += d.fixturesWithStats;
      summary.fixtures_with_events += d.fixturesWithEvents;
      if (d.quota.daily_limit != null) summary.daily_limit = d.quota.daily_limit;
      if (d.quota.daily_remaining != null) summary.daily_remaining = d.quota.daily_remaining;
      if (d.quota.minute_limit != null) summary.minute_limit = d.quota.minute_limit;
      if (d.quota.minute_remaining != null) summary.minute_remaining = d.quota.minute_remaining;
    }
    if (!summary.stop_reason && ids.length > selected.length) summary.stop_reason='BOUNDED_EVIDENCE_SAMPLING';
    await setState(env,'last_capture_success_at',Date.now()).catch(()=>{});
    await recordCycleEnd(env,cycleId,summary);
    return summary;
  } catch (e) {
    summary.error_message=String(e?.message||e).slice(0,500);
    if (isRateLimitError(e)) {
      summary.status='SKIPPED';
      summary.stop_reason='MINUTE_RATE_LIMIT_BACKOFF';
      const backoffMs=Math.max(30000,Math.min(600000,num(env.RATE_BACKOFF_MS,120000)));
      await setState(env,'rate_backoff_until',Date.now()+backoffMs).catch(()=>{});
    } else {
      summary.status='ERROR';
    }
    await recordCycleEnd(env,cycleId,summary).catch(()=>{});
    return summary;
  }
}
function authorized(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  return !!env.CAPTURE_TOKEN && token === env.CAPTURE_TOKEN;
}
async function status(env) {
  const last = await env.DB.prepare('SELECT * FROM capture_cycles ORDER BY started_at DESC LIMIT 1').first();
  const captures = await env.DB.prepare(`SELECT COUNT(*) n, COUNT(DISTINCT fixture_id) fixtures,
    SUM(has_stats) stats_rows, SUM(has_events) event_rows, MIN(received_at) first_received_at, MAX(received_at) last_received_at FROM raw_fixture_captures`).first();
  const evidence = await env.DB.prepare(`SELECT COUNT(*) n, COUNT(DISTINCT fixture_id) fixtures,
    SUM(CASE WHEN evidence_kind='EVENTS' AND item_count>0 THEN 1 ELSE 0 END) event_payloads,
    SUM(CASE WHEN evidence_kind='STATISTICS' AND non_null_value_count>0 THEN 1 ELSE 0 END) stats_payloads,
    MIN(received_at) first_received_at, MAX(received_at) last_received_at FROM raw_fixture_evidence`).first();
  return {ok:true,worker_version:WORKER_VERSION,capture_schema_version:CAPTURE_SCHEMA_VERSION,capture_enabled:flag(env.CAPTURE_ENABLED,true),
    api_key_configured:!!env.APISPORTS_KEY,capture_token_configured:!!env.CAPTURE_TOKEN,last_cycle:last||null,stored:captures||null,evidence:evidence||null};
}
export default {
  async scheduled(controller, env, ctx) { ctx.waitUntil(capture(env,'SCHEDULED')); },
  async fetch(request, env) {
    const u = new URL(request.url);
    if (u.pathname === '/health') return json({ok:true,worker_version:WORKER_VERSION,capture_schema_version:CAPTURE_SCHEMA_VERSION});
    if (u.pathname === '/status') return json(await status(env));
    if (u.pathname === '/capture-now') {
      if (!authorized(request,env)) return json({ok:false,error:'UNAUTHORIZED'},401);
      return json(await capture(env,'MANUAL'));
    }
    if (u.pathname === '/export-raw') {
      if (!authorized(request,env)) return json({ok:false,error:'UNAUTHORIZED'},401);
      const since=u.searchParams.get('since')||'1970-01-01T00:00:00Z';
      const limit=Math.max(1,Math.min(10000,Number(u.searchParams.get('limit')||5000)));
      const q=await env.DB.prepare(`SELECT * FROM raw_api_requests WHERE received_at >= ? ORDER BY received_at ASC LIMIT ?`).bind(since,limit).all();
      const lines=(q.results||[]).map(r=>JSON.stringify({
        raw_id:r.request_id,provider:r.provider,api_version:r.api_version,endpoint:r.endpoint,params:JSON.parse(r.params_json),
        request_started_at:r.request_started_at,received_at:r.received_at,http_status:r.http_status,source:r.source,
        capture_schema_version:r.capture_schema_version,payload_hash:r.payload_hash,payload:JSON.parse(r.payload_json),
        quota:{daily_limit:r.daily_limit,daily_remaining:r.daily_remaining,minute_limit:r.minute_limit,minute_remaining:r.minute_remaining},
        evidence_origin:'REAL_CAPTURE'
      })).join('\n');
      return new Response(lines+(lines?'\n':''),{headers:{'content-type':'application/x-ndjson; charset=utf-8','cache-control':'no-store','content-disposition':'attachment; filename="football-edge-v2-raw.ndjson"'}});
    }
    if (u.pathname === '/latest-fixtures') {
      if (!authorized(request,env)) return json({ok:false,error:'UNAUTHORIZED'},401);
      const limit=Math.max(1,Math.min(500,Number(u.searchParams.get('limit')||100)));
      const q=await env.DB.prepare(`SELECT capture_id,fixture_id,match_clock,status_short,received_at,event_count,stats_team_count,stats_value_count,has_events,has_stats,has_lineups,has_players FROM raw_fixture_captures ORDER BY received_at DESC LIMIT ?`).bind(limit).all();
      return json({ok:true,rows:q.results||[]});
    }
    return new Response('Football Edge V2 Raw Capture Worker', {status:200});
  }
};
