// FT OVERVIEW V1: pure research analysis. No I/O, engine setters or Push.
export const VERSION = 'FT_OVERVIEW_RESEARCH_V1';
export const number = v => v === null || v === undefined || v === '' || typeof v === 'boolean' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const finite = v => number(v) !== null;
const validTime = (at, now) => finite(at) && at > 0 && at <= now + 5000;
export function fingerprint(value) {
  const stable = x => Array.isArray(x) ? x.map(stable) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])])) : x;
  return JSON.stringify(stable(value)); // Exact comparison; no hash-collision ACKs.
}
export function settlement(total, line) {
  if (!Number.isInteger(total) || total < 0 || !finite(line) || line < 0 || Math.abs(line * 4 - Math.round(line * 4)) > 1e-8) throw Error('INVALID_TOTAL_LINE');
  const legs = Number.isInteger(line * 2) ? [line] : [line - .25, line + .25];
  return legs.reduce((sum, leg) => sum + (total > leg ? 1 : total === leg ? 0 : -1), 0) / legs.length;
}
export function validatePMF(pmf) {
  if (!Array.isArray(pmf) || !pmf.length || pmf.some(p => typeof p !== 'number' || !Number.isFinite(p) || p < 0)) return false;
  return Math.abs(pmf.reduce((a, b) => a + b, 0) - 1) <= 1e-7;
}
export function priceOver(pmf, goals, line, odds) {
  if (!validatePMF(pmf) || !Number.isInteger(goals) || goals < 0 || number(odds) === null || odds <= 1) return null;
  try { settlement(goals, line); } catch { return null; }
  const states = {win:0,halfWin:0,push:0,halfLose:0,lose:0};
  pmf.forEach((p, i) => { const s = settlement(goals + i, line); states[s === 1 ? 'win' : s === .5 ? 'halfWin' : s === 0 ? 'push' : s === -.5 ? 'halfLose' : 'lose'] += p; });
  const winWeight = states.win + states.halfWin / 2, loseWeight = states.lose + states.halfLose / 2;
  return {...states,winWeight,loseWeight,fairOdds:winWeight > 0 ? 1 + loseWeight / winWeight : null,ev:winWeight * (odds - 1) - loseWeight};
}
// This is deliberately available only for .5 binary lines. Quarter/integer lines
// need a settlement-aware inverse model; reciprocal odds aren't event probabilities.
export function noVig(market) {
  if (!market || market.period !== 'FT' || market.basis !== 'FULL_MATCH' || !market.bookmaker || !finite(market.line) || Math.abs(market.line % 1 - .5) > 1e-8 || !finite(market.over) || !finite(market.under) || market.over <= 1 || market.under <= 1) return null;
  const a = 1 / market.over, b = 1 / market.under;
  return {over:a / (a + b),under:b / (a + b),overround:a + b - 1,method:'PROPORTIONAL_BINARY'};
}
function poisson(lambda) {
  if (!finite(lambda) || lambda < 0 || lambda > 20) return null;
  let p = Math.exp(-lambda), sum = p; const out = [p];
  for (let i = 1; i <= 100; i++) { p *= lambda / i; out.push(p); sum += p; if (i > lambda && 1 - sum < 1e-12) break; }
  if (1 - sum > 1e-8) return null;
  out[out.length - 1] += 1 - sum;
  return out;
}
// Transparent baseline only. No market odds, legacy score or guessed live xG.
// Until a LIVE model is validated this uses a constant pre-match scoring rate.
export function researchBaseline({homeId,awayId,homeRecent,awayRecent,kickoff,at,minute,status}) {
  if (!validTime(kickoff, at) && !(finite(kickoff) && kickoff > at)) return null;
  const sample = (rows, id) => {
    const seen = new Set(), result = [];
    for (const r of [...(rows || [])].sort((a,b) => Date.parse(b.date) - Date.parse(a.date))) {
      const date = Date.parse(r.date), h = number(r.goals?.home), a = number(r.goals?.away);
      if (r.status !== 'FT' || !Number.isFinite(date) || date >= kickoff || date > at || h === null || a === null || !Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || ![r.home_id,r.away_id].map(number).includes(number(id)) || number(id) === null) continue;
      const key = fingerprint([date,r.home_id,r.away_id]); if (seen.has(key)) continue; seen.add(key);
      result.push(r.home_id === id || Number(r.home_id) === Number(id) ? {gf:h,ga:a} : {gf:a,ga:h});
      if (result.length === 8) break;
    }
    return result;
  };
  const h = sample(homeRecent, homeId), a = sample(awayRecent, awayId);
  if (!h.length || !a.length || !['NS','1H','HT','2H','LIVE'].includes(status) || !finite(minute) || minute < 0 || minute > 90) return null;
  const avg = (rows, key) => rows.reduce((s,r) => s + r[key], 0) / rows.length;
  const lambda = (avg(h,'gf') + avg(a,'ga') + avg(a,'gf') + avg(h,'ga')) / 2;
  return {version:'RECENT_RATE_TIME_ONLY_V1',independent:true,validated:false,kind:'RESEARCH',pmf:poisson(lambda * (90 - minute) / 90),sample:{home:h.length,away:a.length},assumptions:['CONSTANT_SCORING_RATE','NO_OPPONENT_STRENGTH_ADJUSTMENT','NO_LIVE_INTENSITY_OR_RED_CARD_ADJUSTMENT','NO_CALIBRATED_UNCERTAINTY'],lambda90:lambda,at};
}
export function footballView(history, current) {
  const rows = (history || []).filter(r => r.at < current.at && current.at - r.at <= 10 * 60000 && r.goals?.home === current.goals?.home && r.goals?.away === current.goals?.away).sort((a,b) => a.at - b.at);
  const base = rows[0]; if (!base) return {label:'BASELINE',reason:'Chưa có cửa sổ diễn biến cùng tỷ số',minutes:null};
  const minutes = (current.at - base.at) / 60000;
  if (minutes < 2) return {label:'BASELINE',reason:'Cửa sổ quan sát dưới 2 phút',minutes};
  const changes = {};
  for (const k of ['shots','sot','inbox','xg']) {
    const x = number(current.metrics?.[k]), y = number(base.metrics?.[k]);
    changes[k] = x !== null && y !== null && x >= y ? x - y : null;
  }
  const known = Object.values(changes).filter(x => x !== null);
  if (!known.length) return {label:'DATA WAIT',reason:'Thiếu thống kê có thể đối chiếu',minutes,changes};
  const quality = [changes.sot,changes.inbox,changes.xg].filter(x => x !== null);
  const label = quality.some(x => x > 0) ? 'CHANCES ADDED' : quality.length ? 'NO NEW QUALITY SIGNAL' : 'PARTIAL';
  return {label,reason:label === 'CHANCES ADDED' ? 'Có thêm chỉ dấu cơ hội; chưa suy ra xác suất' : 'Chưa xác nhận thêm cơ hội rõ từ dữ liệu đang có',minutes,changes};
}
export function assess(snapshot, now) {
  const at = number(snapshot.at), minute = number(snapshot.minute), goals = snapshot.goals || {};
  const valid = validTime(at, now) && minute !== null && Number.isInteger(goals.home) && Number.isInteger(goals.away) && goals.home >= 0 && goals.away >= 0;
  const terminal = ['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(snapshot.status);
  const fresh = valid && now - at <= (snapshot.status === 'NS' ? 15 * 60000 : 60000);
  const blocked = !valid || terminal || !fresh || ['ET','BT','P','INT','SUSP'].includes(snapshot.status) || snapshot.statsError || snapshot.cooldownUntil > now;
  const market = snapshot.market, marketFresh = !!market && validTime(market.at, now) && now - market.at <= (snapshot.status === 'NS' ? 15 * 60000 : 60000) && market.at >= (snapshot.eventAt || 0) && market.score?.home === goals.home && market.score?.away === goals.away && market.period === 'FT' && market.basis === 'FULL_MATCH';
  const model = snapshot.model, modelOK = !!model?.independent && !!model.version && model.at === at && validatePMF(model.pmf);
  const quote = modelOK && marketFresh ? priceOver(model.pmf, goals.home + goals.away, market.line, market.over) : null;
  const binary = marketFresh ? noVig(market) : null;
  const delta = binary && quote ? quote.win - binary.over : null;
  const data = footballView(snapshot.history, snapshot);
  let entry = 'MODEL WAIT',reason = 'Chưa có phân phối bàn độc lập; không chuyển điểm HT/FT thành xác suất';
  if (terminal) { entry = 'ENDED'; reason = 'Trận đã kết thúc'; }
  else if (blocked) { entry = fresh ? 'DATA WAIT' : 'STALE'; reason = snapshot.cooldownUntil > now ? 'Đang cooldown sau biến động trận; chờ dữ liệu và giá xác nhận lại' : snapshot.statsError ? 'Nguồn thống kê lỗi; giữ lịch sử để xem lại' : 'Dữ liệu hoặc trạng thái chưa phù hợp để nhận định mới'; }
  else if (!marketFresh) { entry = 'WAIT PRICE';reason = 'Cần giá FT mới, đúng tỷ số và quy tắc thanh toán'; }
  else if (!modelOK) { /* preserve model-wait explanation */ }
  else if (model.validated !== true) { entry = model.kind === 'DEMO' ? 'DEMO' : 'RESEARCH';reason = 'Định giá thử nghiệm; chưa đủ bằng chứng để phát khuyến nghị thật'; }
  else { entry = 'REVIEW';reason = 'Đã có định giá; cần nghiệm thu cơ chế ra quyết định trước khi bật khuyến nghị'; }
  const reconciliation = !binary ? 'MARKET INCOMPLETE' : delta === null ? 'MODEL WAIT' : Math.abs(delta) < 1e-9 ? 'ALIGNED' : delta > 0 ? 'MODEL ABOVE MARKET' : 'MODEL BELOW MARKET';
  const synthesis=blocked?'Dữ liệu hiện tại chưa dùng để đưa ra nhận định mới.':!quote?'Giữ nhận định diễn biến; chờ đủ phân phối bàn và giá cùng trạng thái.':quote.ev<=0?'Ở giá đang trả, model chưa cho lợi thế. Dù có thể cao hơn thị trường, giá vẫn chưa vượt mức hòa vốn theo model.':'Giá đang trả cao hơn giá công bằng ước tính. Cần kiểm chứng giả định model và lý do khác biệt trước khi coi đây là lợi thế thực.';
  return {id:snapshot.id,snapshot,at,minute,fresh,blocked:!!blocked,entry,reason,synthesis,data,quote,binary,delta,reconciliation,modelOK,marketFresh,modelVersion:modelOK?model.version:null,
    recommendation:{selection:'OVER',period:'FT',line:marketFresh?market.line:null,odds:marketFresh?market.over:null,action:'NO_LIVE_RECOMMENDATION'},
    whyChange:'Đối chiếu dữ liệu, trạng thái và giá cùng thời điểm'};
}
export function createStore({maxFixtures=100,maxPoints=120,maxLedger=500} = {}) {
  const snapshots = new Map(), ledger = [], ranks = new Map(); let sequence = 0;
  function ingest(input) {
    const s = structuredClone(input);
    if (!Number.isSafeInteger(s.id) || s.id <= 0 || !finite(s.at) || !finite(s.revision)) return {accepted:false,reason:'INVALID_ID_TIME_REVISION'};
    const old = snapshots.get(s.id);
    if (old && (s.at < old.snapshot.at || s.revision < old.snapshot.revision)) return {accepted:false,reason:'OUT_OF_ORDER'};
    const fp = fingerprint(s);
    if (old && old.snapshot.revision === s.revision && old.snapshot.at === s.at && old.fp !== fp) {
      // A newly fetched DEEP history can enrich an existing observation, but
      // cannot advance its time, alter its score/stats/price or overwrite it.
      const observation=x=>{const {model,contextAt,...rest}=x;return rest;};
      if (!(number(s.contextAt)>number(old.snapshot.contextAt)&&number(s.contextAt)>0&&fingerprint(observation(s))===fingerprint(observation(old.snapshot))))return {accepted:false,reason:'REVISION_CONFLICT'};
    }
    if (old?.fp === fp) return {accepted:false,reason:'DUPLICATE'};
    snapshots.set(s.id,{snapshot:s,fp,sequence:++sequence,points:old?.points || []});
    if (snapshots.size > maxFixtures) snapshots.delete([...snapshots.entries()].sort((a,b) => a[1].sequence-b[1].sequence)[0][0]);
    return {accepted:true};
  }
  function read(now,{controls=[]}={}) {
    const controlById=new Map();
    for(const c of controls){const id=number(c.id),old=controlById.get(id)||{};controlById.set(id,{cooldownUntil:Math.max(number(old.cooldownUntil)||0,number(c.cooldownUntil)||0),eventAt:Math.max(number(old.eventAt)||0,number(c.resetAt)||0)});}
    const rows = [...snapshots.values()].map(v => {const c=controlById.get(v.snapshot.id);return assess(c?{...v.snapshot,cooldownUntil:Math.max(number(v.snapshot.cooldownUntil)||0,c.cooldownUntil),eventAt:Math.max(number(v.snapshot.eventAt)||0,c.eventAt)}:v.snapshot, now);});
    // Attention order only; no unvalidated EV weighting or forced bet promotion.
    // Stable insertion order inside equal completeness/freshness classes.
    const bucket = r => r.blocked ? 0 : r.modelOK && r.marketFresh ? 3 : r.marketFresh ? 2 : 1;
    rows.sort((a,b) => bucket(b)-bucket(a) || (ranks.get(a.id) || 999)-(ranks.get(b.id) || 999) || a.id-b.id);
    const previousRanks = new Map(ranks); ranks.clear(); let rank = 0;
    for (const r of rows) {
      r.rank = r.blocked ? null : ++rank; r.move = r.rank && previousRanks.has(r.id) ? previousRanks.get(r.id)-r.rank : null;
      if (r.rank) ranks.set(r.id,r.rank);
      const v = snapshots.get(r.id), m = r.snapshot.market;
      const key = m ? fingerprint([m.bookmaker,m.period,m.basis,m.line]) : null;
      // One point per source observation, never one per UI refresh.
      const point={at:r.at,minute:r.minute,revision:r.snapshot.revision,key,goals:r.snapshot.goals,model:r.quote && r.binary ? r.quote.win : null,market:r.binary?.over ?? null,gap:r.blocked || !r.marketFresh,source:r.snapshot.model?.kind || null};
      if (v.points.at(-1)?.revision !== r.snapshot.revision) {
        v.points.push(point);
        v.points = v.points.slice(-maxPoints);
      } else v.points[v.points.length-1]=point;
      r.points = structuredClone(v.points);
      const record = {id:r.id,version:VERSION,model:r.modelVersion,at:r.at,revision:r.snapshot.revision,entry:r.entry,line:m?.line,odds:m?.over,goals:r.snapshot.goals};
      const last = [...ledger].reverse().find(x => x.id === r.id);
      if (!last || fingerprint(last) !== fingerprint(record)) { ledger.push(record); if (ledger.length > maxLedger) ledger.shift(); }
    }
    return structuredClone(rows);
  }
  return Object.freeze({ingest,read,export:() => structuredClone({schema:VERSION,snapshots:[...snapshots.values()].map(v=>v.snapshot),ledger}),restore:packet => {
    if (packet?.schema !== VERSION || !Array.isArray(packet.snapshots)) return false;
    for (const s of packet.snapshots.slice(-maxFixtures)) ingest(s);
    for (const r of (packet.ledger || []).slice(-maxLedger)) if (Number.isSafeInteger(r.id)) ledger.push(structuredClone(r));
    return true;
  }});
}
