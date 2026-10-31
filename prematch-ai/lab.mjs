// Fictional data only. No real club, league or historical result is represented.
import {SCHEMA} from './contracts.mjs';
export function trainingLab(now=Date.now()){
 let seed=417;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32),pois=l=>{let p=1,k=0;do{p*=rand();k++;}while(p>Math.exp(-l));return k-1;};
 const teams=[101,102,103,104,105,106],history=[];let day=0;
 for(let round=0;round<5;round++)for(const homeId of teams)for(const awayId of teams){if(homeId===awayId)continue;const kickoff=now-(200-day++)*86400000;const h=pois(homeId===101?1.05:.65),a=pois(awayId===101?.8:.5),h2=pois(homeId===101?1.3:.8),a2=pois(awayId===101?1:.65);history.push({id:90000+history.length,leagueId:99001,homeId,awayId,kickoff,availableAt:kickoff+7200000,status:'FT',halftime:{home:h,away:a},regulation:{home:h+h2,away:a+a2}});}
 return {synthetic:true,leagueId:99001,cutoff:now-86400000,history};
}
export function labInput(artifact,now=Date.now()){
 const fixtures=Array.from({length:5},(_,i)=>({id:80001+i,kind:'LAB',status:'NS',observedAt:now,kickoff:now+(i+2)*3600000,home:{id:101+i,name:'Đội LAB '+String.fromCharCode(65+i)},away:{id:106-i,name:'Đội LAB '+String.fromCharCode(70-i)},league:{id:99001,name:'Giải mô phỏng · không phải trận thật'}})).filter(f=>f.home.id!==f.away.id);
 const quotes=fixtures.flatMap(f=>[['1X2','HOME',null,2.65],['1X2','DRAW',null,3.2],['1X2','AWAY',null,2.8],['OU','OVER',2.25,2.1],['OU','UNDER',2.25,1.8],['AH','HOME',-.75,2.3],['AH','AWAY',.75,1.75],['OU','OVER',1.25,2.1]].map(([type,selection,line,odds],i)=>({fixtureId:f.id,source:'LAB_ONLY',bookmaker:'MÔ PHỎNG',marketId:type+'_'+(i===7?'HT':'FT'),type,period:i===7?'HT':'FT',selection,line,odds,basis:'REGULATION',ruleStatus:'VERIFIED',ruleReference:'LAB_TEST_CONTRACT_NOT_BOOKMAKER',receivedAt:now,sourceUpdatedAt:now,availability:'CONFIRMED',checkedAt:now,validUntil:now+600000})));
 return {schema:SCHEMA,label:'LAB — TOÀN BỘ DỮ LIỆU MÔ PHỎNG; KHÔNG DÙNG ĐỂ CƯỢC',fixtures,quotes,artifacts:[artifact],evidence:[]};
}
