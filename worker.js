const BASE = 'https://v3.football.api-sports.io';
const WORKER_VERSION = 'RAW_COLLECTOR_V0.3';
const CAPTURE_SCHEMA_VERSION = 'RAW_CAPTURE_V0.3';
const API_VERSION = 'v3';
const PROVIDER = 'API_FOOTBALL';
const SOURCE = 'CLOUDFLARE_V2_RAW_CAPTURE';
const iso = () => new Date().toISOString();
const num = (v, d = null) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const flag = (v, d = false) => v == null ? d : /^(1|true|yes|on)$/i.test(String(v));
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
  return {payload, requestId, received, quota, detailFixtureCount, fixturesWithStats, fixturesWithEvents};
}
function chunks(a,n){ const out=[]; for(let i=0;i<a.length;i+=n) out.push(a.slice(i,i+n)); return out; }
async function shouldSkipForQuota(env) {
  const reserve = Math.max(0, num(env.API_SHARED_RESERVE, 10000));
  const st = await getState(env, 'last_daily_remaining');
  if (!st || st.value === 'UNKNOWN') return {skip:false,reserve};
  const remaining = num(st.value);
  if (remaining == null || remaining > reserve) return {skip:false,reserve,remaining};
  const ageMs = Date.now() - Date.parse(st.updated_at || 0);
  const probeMinutes = Math.max(5, num(env.QUOTA_PROBE_MINUTES, 30));
  return {skip: ageMs < probeMinutes*60000, reserve, remaining, probe_after_minutes:probeMinutes};
}
async function capture(env, triggerType='SCHEDULED') {
  const cycleId = 'CY-' + (await stable(`${triggerType}|${iso()}|${crypto.randomUUID()}`)).slice(0,24);
  await recordCycleStart(env, cycleId, triggerType);
  const summary = {cycle_id:cycleId,status:'OK',live_count:0,detail_requests:0,total_requests:0,detail_fixture_count:0,fixtures_with_stats:0,fixtures_with_events:0,
    daily_limit:null,daily_remaining:null,minute_limit:null,minute_remaining:null,stop_reason:null};
  try {
    if (!flag(env.CAPTURE_ENABLED, true)) { summary.status='SKIPPED'; summary.stop_reason='CAPTURE_DISABLED'; await recordCycleEnd(env,cycleId,summary); return summary; }
    if (!env.APISPORTS_KEY) { summary.status='BLOCKED'; summary.stop_reason='APISPORTS_KEY_MISSING'; await recordCycleEnd(env,cycleId,summary); return summary; }
    const pre = await shouldSkipForQuota(env);
    if (pre.skip) { summary.status='SKIPPED'; summary.stop_reason='SHARED_DAILY_QUOTA_RESERVE'; summary.daily_remaining=pre.remaining; await recordCycleEnd(env,cycleId,summary); return summary; }
    const live = await apiGet(env, '/fixtures', {live:'all'});
    summary.total_requests++;
    Object.assign(summary, live.quota);
    const ids = (live.payload.response || []).map(x=>x?.fixture?.id).filter(x=>x!=null);
    summary.live_count = ids.length;
    if (!ids.length) { summary.stop_reason='NO_LIVE_FIXTURES'; await recordCycleEnd(env,cycleId,summary); return summary; }
    const reserve = Math.max(0, num(env.API_SHARED_RESERVE, 10000));
    const maxPerCycle = Math.max(1, Math.min(20, num(env.CAPTURE_MAX_REQUESTS_PER_CYCLE, 8)));
    const detailBudget = Math.max(0, maxPerCycle - 1);
    for (const batch of chunks(ids,20).slice(0,detailBudget)) {
      if (summary.daily_remaining != null && summary.daily_remaining <= reserve) { summary.stop_reason='SHARED_DAILY_QUOTA_RESERVE'; break; }
      if (summary.minute_remaining != null && summary.minute_remaining <= 2) { summary.stop_reason='MINUTE_RATE_LIMIT_GUARD'; break; }
      const d = await apiGet(env, '/fixtures', {ids:batch.join('-')});
      summary.detail_requests++; summary.total_requests++;
      summary.detail_fixture_count += d.detailFixtureCount;
      summary.fixtures_with_stats += d.fixturesWithStats;
      summary.fixtures_with_events += d.fixturesWithEvents;
      Object.assign(summary, d.quota);
    }
    if (!summary.stop_reason && chunks(ids,20).length > detailBudget) summary.stop_reason='MAX_REQUESTS_PER_CYCLE_REACHED';
    await recordCycleEnd(env,cycleId,summary);
    return summary;
  } catch (e) {
    summary.status='ERROR'; summary.error_message=String(e?.message||e).slice(0,500);
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
  return {ok:true,worker_version:WORKER_VERSION,capture_schema_version:CAPTURE_SCHEMA_VERSION,capture_enabled:flag(env.CAPTURE_ENABLED,true),
    api_key_configured:!!env.APISPORTS_KEY,capture_token_configured:!!env.CAPTURE_TOKEN,last_cycle:last||null,stored:captures||null};
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
