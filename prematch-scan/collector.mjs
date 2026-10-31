import {normalizeMarkets} from '../prematch-ai/market-lines.mjs';
// One user-initiated batch. I/O is injected, endpoints bounded by the host bridge.
const stop=e=>/CANCELLED|BUDGET|QUOTA|COOLDOWN|rate.?limit|requests per minute|429/i.test(String(e.message||e));
const vnDay=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
export const localVN=t=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
export const parseVN=s=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)?Date.parse(s+'+07:00'):NaN;
const recent=rows=>(Array.isArray(rows)?rows:[]).map(r=>({fixture_id:r.fixture?.id,date:r.fixture?.date,halftime:r.score?.halftime??null,status:r.fixture?.status?.short,home_id:r.teams?.home?.id,away_id:r.teams?.away?.id,goals:r.goals}));
export function createScan(bridge,{onProgress=()=>{},clock=Date.now}={}){
 let id=null,busy=false,catalog=null,windowKey=null,processed=new Set(),bundles=new Map(),evidence=[];
 const status=x=>onProgress({...x,stats:id?bridge.stats(id):null});
 return {cancel(){if(id)bridge.cancel(id);},get busy(){return busy;},async run({from,to,next=false}){
  if(busy)throw Error('PRE_SCAN_BUSY');const now=clock();if(!Number.isFinite(from)||!Number.isFinite(to)||to<=Math.max(from,now)||to-from>86400000)throw Error('Chọn khung giờ tương lai, tối đa 24 giờ.');if(!bridge.ready())throw Error('Chưa có Football API Key trong cấu hình hiện hành.');
  busy=true;let error=null,stats=null;const key=from+':'+to;
  try{id=bridge.begin();if(!next||windowKey!==key){catalog=null;processed=new Set();bundles=new Map();evidence=[];windowKey=key;}
   if(!catalog){const days=[...new Set([vnDay(Math.max(from,now)),vnDay(to-1)])],all=[];for(const date of days){status({phase:'CATALOG',message:'Đang tìm trận sắp diễn ra…'});const r=await bridge.request(id,'/fixtures',{date,timezone:'Asia/Ho_Chi_Minh'},60000);all.push(...(Array.isArray(r.data)?r.data:[]).map(f=>({f,receivedAt:r.receivedAt})));}
    catalog=[...new Map(all.filter(({f})=>f.fixture?.status?.short==='NS'&&f.fixture.timestamp*1000>=Math.max(from,now)&&f.fixture.timestamp*1000<to&&f.teams?.home?.id&&f.teams?.away?.id).map(r=>[r.f.fixture.id,r])).values()].sort((a,b)=>a.f.fixture.timestamp-b.f.fixture.timestamp||a.f.fixture.id-b.f.fixture.id);
   }
   const batch=catalog.filter(x=>!processed.has(x.f.fixture.id)&&x.f.fixture.timestamp*1000>clock()).slice(0,5);
   for(const {f,receivedAt}of batch){
    status({phase:'FIXTURE',message:`Đọc ${f.teams.home.name} – ${f.teams.away.name}`,completed:processed.size,total:catalog.length});
    const b={observed_at:receivedAt,meta:{fixture_id:f.fixture.id,fixture:f.fixture,teams:f.teams,league:f.league},normalized:{home_recent:[],away_recent:[],market:{prematch:[]}}};
    try{
     const h=await bridge.request(id,'/fixtures',{team:f.teams.home.id,last:8},1200000),a=await bridge.request(id,'/fixtures',{team:f.teams.away.id,last:8},1200000);b.normalized.home_recent=recent(h.data);b.normalized.away_recent=recent(a.data);b.observed_at=Math.max(receivedAt,h.receivedAt,a.receivedAt);
     // Forecast context is frozen before market acquisition.
     try{const o=await bridge.request(id,'/odds',{fixture:f.fixture.id},300000);b.market_received_at=o.receivedAt;if(!Array.isArray(o.data)||o.data.some(row=>row.fixture?.id!==f.fixture.id))throw Error('ODDS_SOURCE_FIXTURE_MISMATCH');b.market_fixture_verified=true;b.normalized.market.prematch=normalizeMarkets(o.data,f);}catch(e){if(stop(e))throw e;b.marketError=String(e.message).slice(0,160);}
     let coverage=null;try{const c=await bridge.request(id,'/leagues',{id:f.league.id,season:f.league.season},86400000);coverage=c.data?.[0]?.coverage??null;}catch(e){if(stop(e))throw e;}
     for(const [path,module,allowed]of [['/injuries','Injury & Suspension',coverage?.injuries],['/fixtures/lineups','Lineup & Chemistry',coverage?.fixtures?.lineups]]){
      if(allowed===false){evidence.push({fixtureId:f.fixture.id,module,id:path+':'+f.fixture.id,kind:'UNKNOWN',text:'Nguồn báo không phủ dữ liệu này.'});continue;}
      try{const r=await bridge.request(id,path,{fixture:f.fixture.id},path==='/injuries'?14400000:120000);const rows=Array.isArray(r.data)?r.data:[];const text=path==='/injuries'?rows.length?'Nguồn ghi nhận '+rows.slice(0,8).map(x=>`${x.team?.name||''}: ${x.player?.name||'chưa có tên'} (${x.player?.reason||x.reason||'chưa rõ lý do'})`).join('; '):'Nguồn trả danh sách vắng mặt rỗng; không khẳng định nguồn bao phủ đầy đủ.':rows.length?'Đội hình nguồn: '+rows.map(x=>`${x.team?.name||''} ${x.formation||''}, ${(x.startXI||[]).length} cầu thủ xuất phát`).join('; '):'Chưa có đội hình được nguồn công bố.';evidence.push({fixtureId:f.fixture.id,module,id:path+':'+f.fixture.id,kind:'FACT',receivedAt:r.receivedAt,text});}catch(e){if(stop(e))throw e;evidence.push({fixtureId:f.fixture.id,module,id:path+':'+f.fixture.id,kind:'UNKNOWN',text:'Không đọc được nguồn: '+String(e.message).slice(0,120)});}
     }
     processed.add(f.fixture.id);
    }catch(e){b.sourceError=String(e.message).slice(0,200);if(stop(e)){bundles.set(f.fixture.id,b);throw e;}processed.add(f.fixture.id);}
    bundles.set(f.fixture.id,b);status({phase:'UPDATED',completed:processed.size,total:catalog.length,bundles:[...bundles.values()],evidence:[...evidence]});
   }
  }catch(e){error=String(e.message||e);}
  finally{if(id)stats=bridge.end(id);id=null;busy=false;}
  const remaining=(catalog||[]).filter(x=>!processed.has(x.f.fixture.id)&&x.f.fixture.timestamp*1000>clock()).length;
  return {bundles:[...bundles.values()],evidence:[...evidence],completed:processed.size,total:catalog?.length??0,remaining,stats,error,status:error?'PARTIAL':'DONE'};
 }};
}
