// Reuse captured bundles only. No API call, key, scanner or database client.
import {SCHEMA,fixtureOK} from '../prematch-ai/contracts.mjs';
import {readSelection,marketType} from '../prematch-ai/market-lines.mjs';
const num=x=>x==null||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function fromCachedBundles(bundles,seed,now=Date.now()){
 const fixtures=new Map((seed.fixtures||[]).filter(f=>f.kickoff>now).map(f=>[f.id,structuredClone(f)])),quotes=[],contexts=[];
 for(const b of bundles||[]){const m=b?.meta,f=m?.fixture,at=b?.observed_at,id=m?.fixture_id;if(f?.status?.short!=='NS'||!Number.isSafeInteger(at)||at>now)continue;
  const x={id,kind:'REAL',status:'NS',observedAt:Math.max(at,seed.snapshotAt||at),kickoff:f.timestamp*1000,home:m.teams?.home,away:m.teams?.away,league:m.league};if(!fixtureOK(x)||x.kickoff<=now)continue;fixtures.set(id,x);contexts.push({fixtureId:id,observedAt:at,homeRecent:b.normalized?.home_recent||[],awayRecent:b.normalized?.away_recent||[]});
  for(const market of b.normalized?.market?.prematch||[]){if(market.integrity?.valid===false)continue;const mapping={match_winner:['1X2','FT'],h1_match_winner:['1X2','HT'],asian_handicap:['AH','FT'],over_under:['OU','FT'],h1_total:['OU','HT'],h1_handicap:['AH','HT']},name=market.feed_bet_name||market.bet,spec=name?marketType(name):null,type=name?(spec?[spec.type,spec.period]:null):mapping[market.category];if(!type)continue;
   for(const v of market.values||[]){if(v.suspended)continue;const parsed=readSelection(v,type[0],x);if(!parsed)continue;const {selection,line,sourceSelection:label,sourceLine}=parsed;const odds=num(v.odd??v.price);if(!odds||odds<=1)continue;
    const updated=market.update==null?null:Date.parse(market.update);quotes.push({fixtureId:id,source:'API_FOOTBALL_EXISTING_DEEP',sourceSelection:label,sourceLine,sourceFixtureId:b.market_fixture_verified===true?id:null,sourceMarketName:market.feed_bet_name||market.bet||null,bookmaker:market.bookmaker||'Nguồn DEEP',marketId:String(market.bet_id??market.bet),type:type[0],period:type[1],selection,line,odds,basis:'REGULATION',ruleStatus:'UNKNOWN',ruleReference:'',receivedAt:b.market_received_at??at,sourceUpdatedAt:Number.isFinite(updated)?updated:null,availability:'INDICATIVE',suspended:false});
   }
  }
 }
 const truncated=quotes.length>2000;return {schema:SCHEMA,fixtures:[...fixtures.values()].sort((a,b)=>a.kickoff-b.kickoff).slice(0,100),quotes:quotes.slice(0,2000),contexts,artifacts:seed.artifacts||[],evidence:truncated?[{id:'quote-cap',kind:'FACT',text:'Đạt giới hạn 2.000 giá trong phiên; các giá còn lại chưa được đánh giá.'}]:[],label:'PRE-MATCH AI · THỬ NGHIỆM · dữ liệu hiện có'+(truncated?' · GIỚI HẠN 2.000 GIÁ, các giá còn lại chưa đánh giá.':'')};
}
export function confirmFixtureQuotes(input,fixtureId,now=Date.now()){
 const copy=structuredClone(input),f=copy.fixtures.find(f=>f.id===fixtureId);if(!f||f.kickoff<=now)throw Error('PRE_MATCH_CLOSED');
 let changed=0;for(const q of copy.quotes)if(q.fixtureId===fixtureId&&q.receivedAt<=now){q.ruleStatus='VERIFIED';q.ruleReference='USER_CONFIRMED_REGULATION_AND_EXISTING_PRICE_AT_'+now;q.availability='CONFIRMED';q.checkedAt=now;q.validUntil=Math.min(f.kickoff,now+300000);changed++;}
 if(!changed)throw Error('Chưa có giá trong DEEP; mở công cụ PRE/DEEP hiện có để nhận dữ liệu trước.');return copy;
}
