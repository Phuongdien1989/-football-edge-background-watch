import {v2AppHtml} from './v2-app.js';
import {buildV2Overview, buildV2Match} from './v2-engine.js';
import {generateVAPIDKeys,generateRequestDetails} from './notify-transport.js';
const BASE = 'https://v3.football.api-sports.io';
const WORKER_VERSION = 'RAW_COLLECTOR_V0.5.1';
const CAPTURE_SCHEMA_VERSION = 'RAW_CAPTURE_V0.5';
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
async function storeFixtureEvidence(env, requestId, fid, kind, received, rows, parentHash) {
  if (fid == null || !kind) return null;
  const arr = Array.isArray(rows) ? rows : [];
  let nonNull = 0;
  if (kind === 'STATISTICS') {
    for (const team of arr) for (const st of (team?.statistics || [])) if (st?.value !== null && st?.value !== undefined) nonNull++;
  } else if (kind === 'EVENTS' || kind === 'LINEUPS' || kind === 'PLAYERS') {
    nonNull = arr.length;
  } else {
    const walk = v => {
      if (v === null || v === undefined) return;
      if (Array.isArray(v)) { for (const x of v) walk(x); return; }
      if (typeof v === 'object') { for (const x of Object.values(v)) walk(x); return; }
      nonNull++;
    };
    walk(arr);
  }
  const payload = {response:arr};
  const body = JSON.stringify(payload);
  const payloadHash = await stable(body);
  const eid = 'EV-' + (await stable(`${requestId}|${kind}|${fid}|${payloadHash}|${parentHash||''}`)).slice(0,24);
  await env.DB.prepare(`INSERT OR IGNORE INTO raw_fixture_evidence
    (evidence_id,request_id,fixture_id,evidence_kind,received_at,item_count,non_null_value_count,payload_hash,payload_json)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(eid,requestId,fid,kind,received,arr.length,nonNull,payloadHash,body).run();
  return {kind, fixture_id:fid, item_count:arr.length, non_null_value_count:nonNull, payload_hash:payloadHash};
}
async function recordEndpointEvidence(env, requestId, endpoint, params, received, payload, payloadHash) {
  const fid = num(params?.fixture);
  if (fid == null) return null;
  let kind = null;
  if (endpoint === '/fixtures/events') kind = 'EVENTS';
  else if (endpoint === '/fixtures/statistics') kind = 'STATISTICS';
  else if (endpoint === '/fixtures/lineups') kind = 'LINEUPS';
  else if (endpoint === '/fixtures/players') kind = 'PLAYERS';
  else if (endpoint === '/odds/live') kind = 'LIVE_ODDS';
  else if (endpoint === '/odds') kind = 'PRE_ODDS';
  else if (endpoint === '/predictions') kind = 'PREDICTIONS';
  if (!kind) return null;
  return storeFixtureEvidence(env,requestId,fid,kind,received,Array.isArray(payload?.response)?payload.response:[],payloadHash);
}
async function recordEmbeddedFixtureEvidence(env, requestId, item, received, parentHash) {
  const fid = num(item?.fixture?.id);
  if (fid == null) return [];
  const out = [];
  for (const [kind,rows] of [
    ['EVENTS',item?.events],
    ['STATISTICS',item?.statistics],
    ['LINEUPS',item?.lineups],
    ['PLAYERS',item?.players]
  ]) {
    if (!Array.isArray(rows)) continue;
    out.push(await storeFixtureEvidence(env,requestId,fid,kind,received,rows,parentHash));
  }
  return out.filter(Boolean);
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
    if (endpoint === '/fixtures' && params?.ids) {
      await recordEmbeddedFixtureEvidence(env,requestId,item,received,payloadHash);
    }
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
  const probeMin=Math.max(1,Math.min(60,num(env.QUOTA_PROBE_MINUTES,10)));
  const [limState,curState,planState]=await Promise.all([getState(env,'provider_limit_day'),getState(env,'provider_current'),getState(env,'provider_plan')]);
  const limCached=num(limState?.value),curCached=num(curState?.value),ageMs=Date.now()-Date.parse(curState?.updated_at||0);
  if(limCached!=null&&curCached!=null&&ageMs>=0&&ageMs<probeMin*60*1000){
    return {checked_at:started,current:curCached,limit_day:limCached,remaining:Math.max(0,limCached-curCached-500),plan:planState?.value||null,stale:true,fallback_reason:'CACHED_QUOTA_WINDOW'};
  }
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
    const spacingMs = Math.max(1000, Math.min(12000, num(env.DETAIL_SPACING_MS,6500)));

    // Primary detail batch: API-Football can return embedded events/lineups/statistics/players
    // for up to 20 fixture IDs in one request. This is the highest-value call in the cycle.
    let detail = null;
    let detailBatchItems = [];
    if (requestsLeft > 0) {
      const batchState = await getState(env,'detail_batch_cursor');
      const batchCursor = Math.max(0,num(batchState?.value,0));
      const groups = chunks(liveItems,20);
      const groupIndex = groups.length ? batchCursor % groups.length : 0;
      detailBatchItems = groups[groupIndex] || liveItems.slice(0,20);
      await setState(env,'detail_batch_cursor',batchCursor+1);
      await sleep(spacingMs);
      detail = await apiGetWithRetry(env, '/fixtures', {ids:detailBatchItems.map(x=>x.fixture.id).join('-')}, 1);
      summary.detail_requests++; summary.total_requests++; requestsLeft--;
      summary.detail_fixture_count += detail.detailFixtureCount;
      summary.fixtures_with_stats += detail.fixturesWithStats;
      summary.fixtures_with_events += detail.fixturesWithEvents;
      if (detail.quota.daily_limit != null) summary.daily_limit = detail.quota.daily_limit;
      if (detail.quota.daily_remaining != null) summary.daily_remaining = detail.quota.daily_remaining;
      if (detail.quota.minute_limit != null) summary.minute_limit = detail.quota.minute_limit;
      if (detail.quota.minute_remaining != null) summary.minute_remaining = detail.quota.minute_remaining;
    }

    // Optional third call planner:
    // 1) when embedded detail has no stats, probe league/season coverage or explicit stats;
    // 2) otherwise refresh PRE slate when due;
    // 3) otherwise rotate explicit stats and live odds.
    if (requestsLeft > 0) {
      const preState = await getState(env,'last_pre_capture_at');
      const preAt = num(preState?.value);
      const preInterval = Math.max(10*60*1000,Math.min(6*60*60*1000,num(env.PRE_CAPTURE_INTERVAL_MS,30*60*1000)));
      const preDue = preAt == null || Date.now()-preAt >= preInterval;
      try {
        await sleep(spacingMs);
        let handled = false;
        if ((detail?.fixturesWithStats||0) === 0 && detailBatchItems.length) {
          const covCursorState = await getState(env,'coverage_cursor');
          const covCursor = Math.max(0,num(covCursorState?.value,0));
          const candidateItem = detailBatchItems[covCursor % detailBatchItems.length];
          const leagueId = num(candidateItem?.league?.id), season = num(candidateItem?.league?.season);
          const fixtureId = num(candidateItem?.fixture?.id);
          const key = leagueId!=null && season!=null ? `coverage:${leagueId}:${season}` : null;
          const cached = key ? await getState(env,key) : null;
          let coverage = null;
          try { coverage = cached?.value ? JSON.parse(cached.value) : null; } catch {}
          if (!coverage && leagueId!=null && season!=null) {
            const lr = await apiGetWithRetry(env,'/leagues',{id:String(leagueId),season:String(season)},0);
            summary.detail_requests++; summary.total_requests++; requestsLeft--; handled=true;
            const row = Array.isArray(lr.payload?.response) ? lr.payload.response[0] : null;
            const cov = row?.seasons?.find(x=>Number(x?.year)===season)?.coverage || row?.coverage || null;
            coverage = cov ? {league_id:leagueId,season,statistics_fixtures:!!cov?.fixtures?.statistics_fixtures,events:!!cov?.fixtures?.events,lineups:!!cov?.fixtures?.lineups,players:!!cov?.fixtures?.statistics_players,standings:!!cov?.standings,predictions:!!cov?.predictions,odds:!!cov?.odds,checked_at:iso()} : {league_id:leagueId,season,unknown:true,checked_at:iso()};
            await setState(env,key,JSON.stringify(coverage));
            await setState(env,'coverage_cursor',covCursor+1);
            await setState(env,'last_coverage_probe',JSON.stringify(coverage));
          } else if (coverage?.statistics_fixtures && fixtureId!=null) {
            const sr = await apiGetWithRetry(env,'/fixtures/statistics',{fixture:String(fixtureId)},0);
            summary.detail_requests++; summary.total_requests++; requestsLeft--; handled=true;
            await setState(env,'coverage_cursor',covCursor+1);
            await setState(env,'last_stats_probe',JSON.stringify({fixture_id:fixtureId,league_id:leagueId,season,non_null:sr.endpointEvidence?.non_null_value_count||0,received_at:sr.received}));
            if ((sr.endpointEvidence?.non_null_value_count||0)>0) summary.fixtures_with_stats++;
          } else {
            await setState(env,'coverage_cursor',covCursor+1);
          }
        }
        if (!handled && preDue && requestsLeft > 0) {
          const vn = new Date(Date.now()+7*60*60*1000).toISOString().slice(0,10);
          const pr = await apiGetWithRetry(env,'/fixtures',{date:vn,timezone:'Asia/Ho_Chi_Minh'},0);
          summary.detail_requests++; summary.total_requests++; requestsLeft--; handled=true;
          await setState(env,'last_pre_capture_at',Date.now());
          await setState(env,'last_pre_fixture_count',Array.isArray(pr.payload?.response)?pr.payload.response.length:0);
        }
        if (!handled && requestsLeft > 0) {
          const auxState=await getState(env,'aux_cursor'),auxCursor=Math.max(0,num(auxState?.value,0));
          const candidate=(detail?.payload?.response||[]).find(x=>fixtureCoverage(x).has_stats)?.fixture?.id || ids[auxCursor%ids.length];
          if(candidate!=null){
            const useOdds=auxCursor%3===2,ep=useOdds?'/odds/live':'/fixtures/statistics';
            const ar=await apiGetWithRetry(env,ep,{fixture:String(candidate)},0);
            summary.detail_requests++;summary.total_requests++;requestsLeft--;
            await setState(env,'aux_cursor',auxCursor+1);
            if(!useOdds&&(ar.endpointEvidence?.non_null_value_count||0)>0)summary.fixtures_with_stats++;
          }
        }
      } catch (auxErr) {
        const msg=String(auxErr?.message||auxErr);
        if (isRateLimitError(auxErr)) {
          summary.stop_reason='AUX_RATE_LIMIT_BACKOFF';
          const backoffMs=Math.max(30000,Math.min(600000,num(env.RATE_BACKOFF_MS,300000)));
          await setState(env,'rate_backoff_until',Date.now()+backoffMs).catch(()=>{});
        } else summary.stop_reason='AUX_REQUEST_FAILED';
        summary.error_message=msg.slice(0,500);
      }
    }

    if (!summary.stop_reason) summary.stop_reason='BOUNDED_CAPTURE_COMPLETE';
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
async function upcomingPreFixturesFromDb(env, limit=12) {
  const q=await env.DB.prepare("SELECT fixture_id,fixture_json,received_at FROM raw_fixture_captures WHERE status_short='NS' ORDER BY received_at DESC LIMIT 400").all();
  const seen=new Set(),out=[],now=Date.now(),horizon=now+12*60*60*1000;
  for(const r of (q.results||[])){
    if(seen.has(String(r.fixture_id)))continue;seen.add(String(r.fixture_id));
    let item;try{item=JSON.parse(r.fixture_json)}catch{continue}
    const dt=Date.parse(item?.fixture?.date||0);if(!Number.isFinite(dt)||dt<now-10*60*1000||dt>horizon)continue;
    out.push(item);
  }
  out.sort((a,b)=>Date.parse(a.fixture.date)-Date.parse(b.fixture.date));
  return out.slice(0,limit);
}
async function capturePreContextOnly(env) {
  const cycleId='CY-'+(await stable(`PRE_CONTEXT|${iso()}|${crypto.randomUUID()}`)).slice(0,24);
  await recordCycleStart(env,cycleId,'PRE_CONTEXT');
  const summary={cycle_id:cycleId,status:'OK',live_count:0,detail_requests:0,total_requests:0,detail_fixture_count:0,fixtures_with_stats:0,fixtures_with_events:0,daily_limit:null,daily_remaining:null,minute_limit:null,minute_remaining:null,stop_reason:null};
  try{
    if(!flag(env.CAPTURE_ENABLED,true)||!env.APISPORTS_KEY){summary.status='BLOCKED';summary.stop_reason=!env.APISPORTS_KEY?'APISPORTS_KEY_MISSING':'CAPTURE_DISABLED';await recordCycleEnd(env,cycleId,summary);return summary;}
    const bo=await getState(env,'rate_backoff_until'),until=num(bo?.value);if(until!=null&&Date.now()<until){summary.status='SKIPPED';summary.stop_reason='RATE_LIMIT_BACKOFF';await recordCycleEnd(env,cycleId,summary);return summary;}
    const q=await quotaGuard(env);summary.daily_limit=q.provider.limit_day;summary.daily_remaining=q.provider.remaining;if(q.skip){summary.status='SKIPPED';summary.stop_reason=q.stop_reason;await recordCycleEnd(env,cycleId,summary);return summary;}
    const upcoming=await upcomingPreFixturesFromDb(env,8);if(!upcoming.length){summary.status='SKIPPED';summary.stop_reason='NO_PRE_FIXTURES';await recordCycleEnd(env,cycleId,summary);return summary;}
    const fs=await getState(env,'pre_context_fixture_cursor'),fixtureCursor=Math.max(0,num(fs?.value,0)),target=upcoming[fixtureCursor%upcoming.length];
    const fid=num(target?.fixture?.id),league=num(target?.league?.id),season=num(target?.league?.season),home=num(target?.teams?.home?.id),away=num(target?.teams?.away?.id);
    const ks=await getState(env,`prectx:${fid}:cursor`),kindCursor=Math.max(0,num(ks?.value,0));
    const kinds=['PRE_ODDS','PREDICTIONS','STANDINGS','H2H','HOME_FORM','AWAY_FORM'],kind=kinds[kindCursor%kinds.length];
    const jitter=Math.max(0,Math.min(30000,num(env.PRE_CONTEXT_JITTER_MS,21000)));if(jitter)await sleep(jitter);
    let ep,params;
    if(kind==='PRE_ODDS'){ep='/odds';params={fixture:String(fid)}}
    else if(kind==='PREDICTIONS'){ep='/predictions';params={fixture:String(fid)}}
    else if(kind==='STANDINGS'){if(league==null||season==null)throw new Error('PRE_CONTEXT_LEAGUE_SEASON_MISSING');ep='/standings';params={league:String(league),season:String(season)}}
    else if(kind==='H2H'){if(home==null||away==null)throw new Error('PRE_CONTEXT_TEAMS_MISSING');ep='/fixtures/headtohead';params={h2h:`${home}-${away}`,last:'5'}}
    else if(kind==='HOME_FORM'){if(home==null)throw new Error('PRE_CONTEXT_HOME_MISSING');ep='/fixtures';params={team:String(home),last:'5'}}
    else {if(away==null)throw new Error('PRE_CONTEXT_AWAY_MISSING');ep='/fixtures';params={team:String(away),last:'5'}}
    const cr=await apiGetWithRetry(env,ep,params,0);summary.total_requests=1;summary.detail_requests=1;summary.detail_fixture_count=cr.detailFixtureCount||0;
    if(cr.quota.daily_remaining!=null)summary.daily_remaining=cr.quota.daily_remaining;
    if(['STANDINGS','H2H','HOME_FORM','AWAY_FORM'].includes(kind))await storeFixtureEvidence(env,cr.requestId,fid,kind,cr.received,Array.isArray(cr.payload?.response)?cr.payload.response:[],cr.requestId);
    await setState(env,`prectx:${fid}:cursor`,kindCursor+1);
    if((kindCursor+1)%kinds.length===0)await setState(env,'pre_context_fixture_cursor',fixtureCursor+1);
    await setState(env,'last_pre_context_probe',JSON.stringify({fixture_id:fid,kind,item_count:Array.isArray(cr.payload?.response)?cr.payload.response.length:0,received_at:cr.received}));
    summary.stop_reason='PRE_CONTEXT_COMPLETE';await recordCycleEnd(env,cycleId,summary);return summary;
  }catch(e){
    summary.error_message=String(e?.message||e).slice(0,500);
    if(isRateLimitError(e)){summary.status='SKIPPED';summary.stop_reason='PRE_CONTEXT_RATE_LIMIT_BACKOFF';const ms=Math.max(30000,Math.min(600000,num(env.RATE_BACKOFF_MS,300000)));await setState(env,'rate_backoff_until',Date.now()+ms).catch(()=>{});}
    else{summary.status='ERROR';summary.stop_reason='PRE_CONTEXT_FAILED';}
    await recordCycleEnd(env,cycleId,summary).catch(()=>{});return summary;
  }
}
async function capturePreOnly(env) {
  const cycleId='CY-'+(await stable(`PRE_SCHEDULED|${iso()}|${crypto.randomUUID()}`)).slice(0,24);
  await recordCycleStart(env,cycleId,'PRE_SCHEDULED');
  const summary={cycle_id:cycleId,status:'OK',live_count:0,detail_requests:0,total_requests:0,detail_fixture_count:0,fixtures_with_stats:0,fixtures_with_events:0,daily_limit:null,daily_remaining:null,minute_limit:null,minute_remaining:null,stop_reason:null};
  try{
    if(!flag(env.CAPTURE_ENABLED,true)){summary.status='SKIPPED';summary.stop_reason='CAPTURE_DISABLED';await recordCycleEnd(env,cycleId,summary);return summary;}
    if(!env.APISPORTS_KEY){summary.status='BLOCKED';summary.stop_reason='APISPORTS_KEY_MISSING';await recordCycleEnd(env,cycleId,summary);return summary;}
    const backoff=await getState(env,'rate_backoff_until'),until=num(backoff?.value);
    if(until!=null&&Date.now()<until){summary.status='SKIPPED';summary.stop_reason='RATE_LIMIT_BACKOFF';await recordCycleEnd(env,cycleId,summary);return summary;}
    const q=await quotaGuard(env);summary.daily_limit=q.provider.limit_day;summary.daily_remaining=q.provider.remaining;
    if(q.skip){summary.status='SKIPPED';summary.stop_reason=q.stop_reason;await recordCycleEnd(env,cycleId,summary);return summary;}
    const jitter=Math.max(0,Math.min(30000,num(env.PRE_JITTER_MS,24000))),spacing=Math.max(1000,Math.min(12000,num(env.DETAIL_SPACING_MS,6500)));
    if(jitter)await sleep(jitter);
    const vn=new Date(Date.now()+7*60*60*1000).toISOString().slice(0,10);
    const pr=await apiGetWithRetry(env,'/fixtures',{date:vn,timezone:'Asia/Ho_Chi_Minh'},0);
    summary.total_requests++;summary.detail_requests++;summary.detail_fixture_count+=pr.detailFixtureCount;
    if(pr.quota.daily_limit!=null)summary.daily_limit=pr.quota.daily_limit;if(pr.quota.daily_remaining!=null)summary.daily_remaining=pr.quota.daily_remaining;
    const rows=Array.isArray(pr.payload?.response)?pr.payload.response:[];
    await setState(env,'last_pre_capture_at',Date.now());await setState(env,'last_pre_fixture_count',rows.length);

    const upcoming=rows.filter(x=>x?.fixture?.status?.short==='NS'&&Date.parse(x?.fixture?.date||0)>=Date.now()-10*60*1000)
      .sort((a,b)=>Date.parse(a.fixture.date)-Date.parse(b.fixture.date));
    const detailItems=upcoming.slice(0,20);
    if(detailItems.length){
      await sleep(spacing);
      const dr=await apiGetWithRetry(env,'/fixtures',{ids:detailItems.map(x=>x.fixture.id).join('-')},0);
      summary.total_requests++;summary.detail_requests++;summary.detail_fixture_count+=dr.detailFixtureCount;
      if(dr.quota.daily_remaining!=null)summary.daily_remaining=dr.quota.daily_remaining;
    }

    if(upcoming.length){
      const pc=await getState(env,'pre_context_cursor'),cursor=Math.max(0,num(pc?.value,0)),target=upcoming[cursor%upcoming.length],fid=num(target?.fixture?.id);
      if(fid!=null){
        await sleep(spacing);
        const mode=cursor%2===0?'PRE_ODDS':'PREDICTIONS',ep=mode==='PRE_ODDS'?'/odds':'/predictions';
        const cr=await apiGetWithRetry(env,ep,{fixture:String(fid)},0);
        summary.total_requests++;summary.detail_requests++;
        await setState(env,'pre_context_cursor',cursor+1);
        await setState(env,'last_pre_context_probe',JSON.stringify({fixture_id:fid,kind:mode,item_count:cr.endpointEvidence?.item_count||0,received_at:cr.received}));
      }
    }
    summary.stop_reason='PRE_CAPTURE_COMPLETE';await recordCycleEnd(env,cycleId,summary);return summary;
  }catch(e){
    summary.error_message=String(e?.message||e).slice(0,500);
    if(isRateLimitError(e)){summary.status='SKIPPED';summary.stop_reason='PRE_RATE_LIMIT_BACKOFF';const ms=Math.max(30000,Math.min(600000,num(env.RATE_BACKOFF_MS,300000)));await setState(env,'rate_backoff_until',Date.now()+ms).catch(()=>{});}
    else{summary.status='ERROR';summary.stop_reason='PRE_CAPTURE_FAILED';}
    await recordCycleEnd(env,cycleId,summary).catch(()=>{});return summary;
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
  const recent = await env.DB.prepare(`SELECT fixture_id,match_clock,status_short,received_at,event_count,stats_value_count,has_events,has_stats
    FROM raw_fixture_captures ORDER BY received_at DESC LIMIT 10`).all();
  return {ok:true,worker_version:WORKER_VERSION,capture_schema_version:CAPTURE_SCHEMA_VERSION,capture_enabled:flag(env.CAPTURE_ENABLED,true),
    api_key_configured:!!env.APISPORTS_KEY,capture_token_configured:!!env.CAPTURE_TOKEN,last_cycle:last||null,stored:captures||null,
    evidence:evidence||null,recent:(recent.results||[])};
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b1739">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="FE V2 Monitor">
<title>Football Edge V2 Monitor</title>
<style>
:root{color-scheme:dark;--bg:#071127;--card:#0e1b3d;--card2:#11244f;--text:#f5f8ff;--muted:#9db0d4;--line:#223866;--good:#39d98a;--warn:#ffcc66;--bad:#ff6b7a;--blue:#63a4ff}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#071127,#0a1530 55%,#071127);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text)}
.wrap{max-width:760px;margin:0 auto;padding:calc(env(safe-area-inset-top) + 16px) 14px calc(env(safe-area-inset-bottom) + 28px)}
.head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-weight:800;font-size:22px;letter-spacing:.2px}.sub{font-size:12px;color:var(--muted);margin-top:4px}
.btn{border:1px solid var(--line);background:#132654;color:#fff;border-radius:12px;padding:10px 13px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.card{background:rgba(14,27,61,.92);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 8px 28px rgba(0,0,0,.18)}
.k{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px}.v{font-size:25px;font-weight:800;margin-top:5px}.small{font-size:12px;color:var(--muted);margin-top:4px}
.full{grid-column:1/-1}.row{display:flex;align-items:center;justify-content:space-between;gap:10px}.pill{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:800}.good{background:rgba(57,217,138,.14);color:var(--good)}.warn{background:rgba(255,204,102,.14);color:var(--warn)}.bad{background:rgba(255,107,122,.14);color:var(--bad)}.neutral{background:rgba(99,164,255,.14);color:var(--blue)}
.section{margin-top:12px}.section h3{font-size:14px;margin:0 0 8px;color:#dbe6ff}.item{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 0;border-top:1px solid rgba(34,56,102,.7)}.item:first-child{border-top:0}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.right{text-align:right}
.bar{height:7px;background:#09152f;border-radius:10px;overflow:hidden;margin-top:10px}.fill{height:100%;background:linear-gradient(90deg,#4c8dff,#39d98a);width:0}
.note{font-size:12px;line-height:1.5;color:var(--muted)}.footer{text-align:center;color:#6f84ae;font-size:11px;margin-top:16px}
@media(min-width:600px){.grid{grid-template-columns:repeat(4,1fr)}.full{grid-column:1/-1}}
</style>
</head>
<body><div class="wrap">
<div class="head"><div><div class="title">FOOTBALL EDGE V2</div><div class="sub">RAW CAPTURE MONITOR · GIAM SAT DU LIEU THAT</div></div><button class="btn" onclick="load()">Refresh</button></div>
<div id="top" class="grid">
  <div class="card"><div class="k">Fixtures</div><div class="v" id="fixtures">—</div><div class="small">Tran da thu raw</div></div>
  <div class="card"><div class="k">Snapshots</div><div class="v" id="snapshots">—</div><div class="small">Moc du lieu da luu</div></div>
  <div class="card"><div class="k">Events</div><div class="v" id="events">—</div><div class="small">Payload co event</div></div>
  <div class="card"><div class="k">Stats</div><div class="v" id="stats">—</div><div class="small">Payload statistics hop le</div></div>
  <div class="card full">
    <div class="row"><div><div class="k">Readiness</div><div class="v" style="font-size:20px" id="readiness">CHECKING</div></div><span id="readyPill" class="pill neutral">...</span></div>
    <div class="bar"><div id="readyBar" class="fill"></div></div>
    <div id="readyNote" class="note" style="margin-top:9px"></div>
  </div>
  <div class="card full">
    <div class="row"><div><div class="k">Last collector cycle</div><div class="v" style="font-size:18px" id="cycle">—</div></div><span id="cyclePill" class="pill neutral">—</span></div>
    <div class="note" id="cycleNote" style="margin-top:9px"></div>
  </div>
  <div class="card full">
    <div class="row"><div><div class="k">API quota</div><div class="v" style="font-size:20px"><span id="remaining">—</span></div></div><div class="right small"><div id="limit">limit —</div><div id="minute">minute —</div></div></div>
  </div>
</div>
<div class="section card"><h3>RECENT CAPTURES · DU LIEU GAN NHAT</h3><div id="recent"><div class="note">Loading...</div></div></div>
<div class="section card"><h3>WHAT THIS MEANS · Y NGHIA</h3><div class="note">Raw capture available = collector da thu du lieu API that. LRS scorable = can co statistics that hop le. Hai trang thai nay khac nhau; dashboard se khong coi raw da co la LRS da san sang.</div></div>
<div class="footer">Auto refresh 30s · Worker <span id="ver">—</span></div>
</div>
<script>
const $=id=>document.getElementById(id);
const fmt=n=>n===null||n===undefined?'—':Number(n).toLocaleString('en-US');
const when=s=>{if(!s)return '—';try{return new Date(s).toLocaleString('vi-VN',{hour12:false})}catch{return s}};
function pill(el,text,cls){el.textContent=text;el.className='pill '+cls}
async function load(){
  try{
    const r=await fetch('/status',{cache:'no-store'}); const s=await r.json();
    $('ver').textContent=s.worker_version||'—';
    $('fixtures').textContent=fmt(s.stored?.fixtures);
    $('snapshots').textContent=fmt(s.stored?.n);
    $('events').textContent=fmt(s.evidence?.event_payloads);
    $('stats').textContent=fmt(s.evidence?.stats_payloads);
    const stats=Number(s.evidence?.stats_payloads||0), raw=Number(s.stored?.n||0);
    if(stats>0){$('readiness').textContent='REAL STATS AVAILABLE';pill($('readyPill'),'READY FOR REPLAY','good');$('readyBar').style.width='100%';$('readyNote').textContent='Da co statistics that. Co the export va chay Strict Replay/LRS shadow.'}
    else if(raw>0){$('readiness').textContent='RAW YES · LRS NOT YET';pill($('readyPill'),'STATS BLOCKER','warn');$('readyBar').style.width='55%';$('readyNote').textContent='Da thu raw that, nhung chua co statistics hop le. Khong du dieu kien cham LRS.'}
    else{$('readiness').textContent='COLLECTING';pill($('readyPill'),'WAITING RAW','neutral');$('readyBar').style.width='20%';$('readyNote').textContent='Collector dang cho chu ky du lieu dau tien.'}
    const c=s.last_cycle||{};$('cycle').textContent=(c.status||'—')+' · '+(c.live_count??0)+' LIVE';
    const stop=c.stop_reason||'NONE';const cc=c.status==='ERROR'?'bad':(stop.includes('RATE')?'warn':'good');pill($('cyclePill'),stop,cc);
    $('cycleNote').textContent='Last: '+when(c.completed_at||c.started_at)+' · requests '+fmt(c.total_requests)+' · detail '+fmt(c.detail_requests)+(c.error_message?' · '+c.error_message:'');
    $('remaining').textContent=c.daily_remaining==null?'—':fmt(c.daily_remaining)+' remaining';
    $('limit').textContent='daily limit '+fmt(c.daily_limit);$('minute').textContent='minute '+fmt(c.minute_remaining)+' / '+fmt(c.minute_limit);
    const rows=s.recent||[];$('recent').innerHTML=rows.length?rows.map(x=>'<div class="item"><div><div class="mono">#'+x.fixture_id+' · '+(x.status_short||'—')+' · '+(x.match_clock??'—')+'\'</div><div class="small">'+when(x.received_at)+'</div></div><div class="right"><div class="mono">E '+(x.event_count??0)+' · S '+(x.stats_value_count??0)+'</div><div class="small">'+(x.has_stats?'STATS OK':'NO STATS')+'</div></div></div>').join(''):'<div class="note">No captures yet.</div>';
  }catch(e){$('readiness').textContent='STATUS ERROR';pill($('readyPill'),'CHECK WORKER','bad');$('readyNote').textContent=String(e)}
}
load();setInterval(load,30000);
</script></body></html>`;
}

const V2_APP_URL='https://football-edge-v2-raw-capture.ngophuonghuy.workers.dev/v2';
function validPushSubscription(sub){
  try{
    const u=new URL(sub?.endpoint||'');
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
      (u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname.endsWith('.fcm.googleapis.com')||u.hostname==='updates.push.services.mozilla.com')&&
      /^[A-Za-z0-9_-]{80,100}$/.test(sub?.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{16,32}$/.test(sub?.keys?.auth||'');
  }catch{return false}
}
async function v2PushDeviceId(endpoint){return await stable(String(endpoint||''))}
async function v2PushKeys(env){
  const st=await getState(env,'v2push:vapid');
  if(st?.value){try{const k=JSON.parse(st.value);if(k?.publicKey&&k?.privateKey)return k}catch{}}
  const keys=generateVAPIDKeys();await setState(env,'v2push:vapid',JSON.stringify(keys));return keys;
}
async function v2PushDevices(env){
  const q=await env.DB.prepare("SELECT key,value,updated_at FROM collector_state WHERE key LIKE 'v2push:device:%' ORDER BY updated_at DESC LIMIT 10").all();
  const out=[];for(const r of (q.results||[])){try{const d=JSON.parse(r.value);if(d?.id&&d?.subscription)out.push(d)}catch{}}
  return out;
}
function v2PushPrefs(p={}){return {enabled:p.enabled!==false,signals:p.signals!==false,entry:p.entry!==false,minLrs:Math.max(0,Math.min(100,num(p.minLrs,60))),cooldownMin:Math.max(3,Math.min(60,num(p.cooldownMin,5)))}}
async function v2PushSend(env,device,payload){
  const keys=await v2PushKeys(env);
  const req=generateRequestDetails(device.subscription,JSON.stringify(payload),{TTL:180,urgency:'high',vapidDetails:{subject:V2_APP_URL,publicKey:keys.publicKey,privateKey:keys.privateKey}});
  const r=await fetch(req.endpoint,{method:'POST',headers:req.headers,body:req.body,redirect:'manual',signal:AbortSignal.timeout(12000)});
  if([404,410].includes(r.status)){await env.DB.prepare("DELETE FROM collector_state WHERE key=?").bind('v2push:device:'+device.id).run();return false}
  if(!r.ok)throw new Error('PUSH_HTTP_'+r.status);
  return true;
}
async function handleV2Push(request,env,path){
  try{
    if(path==='/api/v2/push/key'&&request.method==='GET')return json({ok:true,publicKey:(await v2PushKeys(env)).publicKey});
    if(path==='/api/v2/push/status'&&request.method==='GET'){const ds=await v2PushDevices(env);return json({ok:true,devices:ds.map(d=>({id:d.id,prefs:d.prefs,updated_at:d.updated_at}))})}
    if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    const raw=await request.text();if(raw.length>250000)return json({ok:false,error:'REQUEST_TOO_LARGE'},413);
    const b=JSON.parse(raw||'{}');
    if(path==='/api/v2/push/subscribe'){
      if(!validPushSubscription(b.subscription))return json({ok:false,error:'INVALID_PUSH_SUBSCRIPTION'},400);
      const id=await v2PushDeviceId(b.subscription.endpoint),devices=await v2PushDevices(env);
      if(devices.length>=10&&!devices.some(d=>d.id===id))return json({ok:false,error:'DEVICE_LIMIT_10'},409);
      const d={id,subscription:b.subscription,prefs:v2PushPrefs(b.prefs),updated_at:Date.now(),app:'FE_V2'};
      await setState(env,'v2push:device:'+id,JSON.stringify(d));return json({ok:true,id,prefs:d.prefs});
    }
    const id=String(b.id||'');
    if(!/^[a-f0-9]{64}$/.test(id))return json({ok:false,error:'DEVICE_REQUIRED'},400);
    const st=await getState(env,'v2push:device:'+id);if(!st?.value)return json({ok:false,error:'DEVICE_NOT_FOUND'},404);
    const d=JSON.parse(st.value);
    if(path==='/api/v2/push/unsubscribe'){await env.DB.prepare("DELETE FROM collector_state WHERE key=?").bind('v2push:device:'+id).run();return json({ok:true})}
    if(path==='/api/v2/push/settings'){d.prefs=v2PushPrefs(b.prefs);d.updated_at=Date.now();await setState(env,'v2push:device:'+id,JSON.stringify(d));return json({ok:true,prefs:d.prefs})}
    if(path==='/api/v2/push/test'){
      const ok=await v2PushSend(env,d,{title:'⚽ Football Edge V2',body:'Background Push V2 đang hoạt động.',url:V2_APP_URL,tag:'fe-v2-test',created_at:Date.now()});
      return json({ok});
    }
    return json({ok:false,error:'NOT_FOUND'},404);
  }catch(e){return json({ok:false,error:String(e?.message||e).slice(0,200)},500)}
}
async function dispatchV2Notifications(env){
  const devices=(await v2PushDevices(env)).filter(d=>d.prefs?.enabled!==false);
  if(!devices.length)return {devices:0,sent:0};
  const data=await buildV2Overview(env);let sent=0;
  for(const m of (data.matches||[])){
    const e=m.engine||{},lrs=Number(e.lrs?.final_lrs),active=e.signal?.lifecycle==='ACTIVE',open=e.entry?.state==='OPEN';
    if(e.lrs?.status!=='OK'||(!active&&!open))continue;
    for(const d of devices){
      const p=v2PushPrefs(d.prefs);if((active&&!p.signals)&&(open&&!p.entry))continue;if(!Number.isFinite(lrs)||lrs<p.minLrs)continue;
      const fingerprint=[m.fixture_id,e.signal?.signal_type,e.signal?.side||'',e.entry?.state,e.goal_pressure?.level].join('|');
      const key='v2push:sent:'+d.id+':'+m.fixture_id,last=await getState(env,key);let prev={};try{prev=last?.value?JSON.parse(last.value):{}}catch{}
      const cooldown=p.cooldownMin*60000;if(prev.fingerprint===fingerprint&&Date.now()-Number(prev.sent_at||0)<cooldown)continue;
      const title=open?'⚡ Football Edge V2 • ENTRY OPEN':'⚽ Football Edge V2 • SIGNAL';
      const body=`${m.teams.home.name} ${m.goals.home??'-'}-${m.goals.away??'-'} ${m.teams.away.name} • ${e.signal?.signal_type||'SIGNAL'} • LRS ${Math.round(lrs)}/100`;
      try{if(await v2PushSend(env,d,{title,body,url:V2_APP_URL+'?fixture='+m.fixture_id,tag:'fe-v2-'+m.fixture_id,fixture_id:m.fixture_id,signal:e.signal,entry:e.entry,lrs,created_at:Date.now()})){sent++;await setState(env,key,JSON.stringify({fingerprint,sent_at:Date.now()}));}}catch(err){await setState(env,'v2push:last_error',String(err?.message||err).slice(0,160))}
    }
  }
  await setState(env,'v2push:last_dispatch',JSON.stringify({at:Date.now(),devices:devices.length,sent}));
  return {devices:devices.length,sent};
}
export default {
  async scheduled(controller, env, ctx) {
    const minute=new Date().getUTCMinutes();
    if(minute%30===7) ctx.waitUntil(capturePreOnly(env));
    else if(minute%10===7) ctx.waitUntil(capturePreContextOnly(env));
    else ctx.waitUntil((async()=>{const r=await capture(env,'SCHEDULED');if(['OK','SKIPPED'].includes(r.status)&&!['RATE_LIMIT_BACKOFF','MINUTE_RATE_LIMIT_BACKOFF'].includes(r.stop_reason||''))await dispatchV2Notifications(env).catch(()=>{});})());
  },
  async fetch(request, env) {
    const u = new URL(request.url);
    if (u.pathname === '/' || u.pathname === '/app' || u.pathname === '/v2') {
      return new Response(v2AppHtml(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
    }
    if (u.pathname === '/dashboard') {
      return new Response(dashboardHtml(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
    }
    if (u.pathname === '/v2-manifest.webmanifest') {
      return new Response(JSON.stringify({name:'Football Edge V2',short_name:'FE V2',start_url:'/v2',display:'standalone',background_color:'#f3f7fb',theme_color:'#2378ee',description:'Live Football Intelligence'}),{headers:{'content-type':'application/manifest+json; charset=utf-8','cache-control':'public,max-age=3600'}});
    }
    if (u.pathname === '/v2-sw.js') {
      return new Response("self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).catch(()=>new Response('Offline',{status:503})))})",{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store'}});
    }
    if (u.pathname === '/api/v2/overview') {
      try{return json(await buildV2Overview(env));}catch(e){return json({ok:false,error:String(e?.message||e),schema:'FE_V2_APP_OVERVIEW_V1'},500);}
    }
    if (u.pathname === '/api/v2/match') {
      const id=Number(u.searchParams.get('id')); if(!Number.isFinite(id))return json({ok:false,error:'FIXTURE_ID_REQUIRED'},400);
      try{const m=await buildV2Match(env,id);return m?json({ok:true,match:m}):json({ok:false,error:'FIXTURE_NOT_FOUND'},404);}catch(e){return json({ok:false,error:String(e?.message||e)},500);}
    }
    if (u.pathname.startsWith('/api/v2/push/')) return handleV2Push(request,env,u.pathname);
    if (u.pathname === '/health') return json({ok:true,worker_version:WORKER_VERSION,capture_schema_version:CAPTURE_SCHEMA_VERSION,app_version:'V2.1.0-ALPHA'});
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
    return new Response('Not found', {status:404});
  }
};
