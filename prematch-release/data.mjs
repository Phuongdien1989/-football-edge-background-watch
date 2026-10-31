// Reuse captured bundles only. No API call, key, scanner or database client.
import {SCHEMA,fixtureOK} from '../prematch-ai/contracts.mjs';
const num=x=>x==null||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function fromCachedBundles(bundles,seed,now=Date.now()){
 const fixtures=new Map((seed.fixtures||[]).filter(f=>f.kickoff>now).map(f=>[f.id,structuredClone(f)])),quotes=[],contexts=[];
 for(const b of bundles||[]){const m=b?.meta,f=m?.fixture,at=b?.observed_at,id=m?.fixture_id;if(f?.status?.short!=='NS'||!Number.isSafeInteger(at)||at>now)continue;
  const x={id,kind:'REAL',status:'NS',observedAt:Math.max(at,seed.snapshotAt||at),kickoff:f.timestamp*1000,home:m.teams?.home,away:m.teams?.away,league:m.league};if(!fixtureOK(x)||x.kickoff<=now)continue;fixtures.set(id,x);contexts.push({fixtureId:id,observedAt:at,homeRecent:b.normalized?.home_recent||[],awayRecent:b.normalized?.away_recent||[]});
  for(const market of b.normalized?.market?.prematch||[]){if(market.integrity?.valid===false)continue;const mapping={match_winner:['1X2','FT'],asian_handicap:['AH','FT'],over_under:['OU','FT'],h1_total:['OU','HT'],h1_handicap:['AH','HT']},type=mapping[market.category];if(!type)continue;
   for(const v of market.values||[]){if(v.suspended)continue;const label=String(v.value||''),selection=type[0]==='OU'?/^over\b/i.test(label)?'OVER':/^under\b/i.test(label)?'UNDER':null:String(v.selection_outcome||v.selection_side||(/^(home|away|draw)$/i.test(label)?label:'')).toUpperCase();
    if(!(type[0]==='OU'?['OVER','UNDER']:type[0]==='1X2'?['HOME','DRAW','AWAY']:['HOME','AWAY']).includes(selection))continue;
    const odds=num(v.odd),line=type[0]==='1X2'?null:num(v.handicap??label.match(/([+-]?\d+(?:\.\d+)?)\s*$/)?.[1]);if(!odds||odds<=1||type[0]!=='1X2'&&line===null)continue;
    const updated=market.update==null?null:Date.parse(market.update);quotes.push({fixtureId:id,source:'API_FOOTBALL_EXISTING_DEEP',bookmaker:market.bookmaker||'Nguồn DEEP',marketId:String(market.bet_id??market.bet),type:type[0],period:type[1],selection,line,odds,basis:'REGULATION',ruleStatus:'UNKNOWN',ruleReference:'',receivedAt:b.market_received_at??at,sourceUpdatedAt:Number.isFinite(updated)?updated:null,availability:'INDICATIVE',suspended:false});
   }
  }
 }
 return {schema:SCHEMA,fixtures:[...fixtures.values()].sort((a,b)=>a.kickoff-b.kickoff).slice(0,100),quotes,contexts,artifacts:seed.artifacts||[],evidence:[],label:'PRE-MATCH AI · THỬ NGHIỆM · dữ liệu hiện có'};
}
export function confirmFixtureQuotes(input,fixtureId,now=Date.now()){
 const copy=structuredClone(input),f=copy.fixtures.find(f=>f.id===fixtureId);if(!f||f.kickoff<=now)throw Error('PRE_MATCH_CLOSED');
 let changed=0;for(const q of copy.quotes)if(q.fixtureId===fixtureId&&q.receivedAt<=now){q.ruleStatus='VERIFIED';q.ruleReference='USER_CONFIRMED_REGULATION_AND_EXISTING_PRICE_AT_'+now;q.availability='CONFIRMED';q.checkedAt=now;q.validUntil=Math.min(f.kickoff,now+300000);changed++;}
 if(!changed)throw Error('Chưa có giá trong DEEP; mở công cụ PRE/DEEP hiện có để nhận dữ liệu trước.');return copy;
}
