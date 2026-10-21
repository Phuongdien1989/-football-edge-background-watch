// Event identity is independent of statistics-history identity. No I/O or timers.
export function createHTEvents(){
 const count=x=>Number.isInteger(x)&&x>=0;
 function classify(previous,next){
  if(!previous||!next)return null;
  const a=previous.goals,b=next.goals;
  if(a&&b&&[a.home,a.away,b.home,b.away].every(count)&&(a.home!==b.home||a.away!==b.away))return b.home+b.away>a.home+a.away?'GOAL':'SCORE_CORRECTION';
  const ar=previous.metrics?.total?.red,br=next.metrics?.total?.red;
  if(count(ar)&&count(br)&&ar!==br)return br>ar?'RED_CARD':'RED_CORRECTION';
  if(['1H','LIVE'].includes(previous.status)&&next.status&&!['1H','LIVE'].includes(next.status))return 'HALF_ENDED';
  return null;
 }
 function apply(item,next,now){
  const previous=item?.latest,type=classify(previous,next);if(!type)return null;
  const scoreEvent=type==='GOAL'||type==='SCORE_CORRECTION';
  const red=next.metrics?.total?.red;
  // Carry only event identity forward. Cached statistical counters retain their
  // original observation time; no history sample or market receipt is invented.
  item.latest={...previous,goals:{...(next.goals||previous.goals)},status:next.status||previous.status,minute:next.minute??previous.minute,fixture:next.fixture??previous.fixture,
   metrics:count(red)?{...previous.metrics,total:{...previous.metrics?.total,red}}:previous.metrics,
   market_rows:[],market_at:null,market:{raw_count:0,valid_count:0,has_over:false}};
  item.lastMarketAt=null;item.lastMarketRows=[];item.resetAt=now;item.cooldownUntil=type==='HALF_ENDED'?now:now+(scoreEvent?120000:180000);
  item.collectionActive=false;item.lowStreak=0;item.state=type==='HALF_ENDED'?'ENDED':'COOLDOWN';
  item.reason=type==='SCORE_CORRECTION'?'Tỷ số được điều chỉnh; chờ dữ liệu và giá xác nhận lại.':type==='RED_CORRECTION'?'Thẻ đỏ được điều chỉnh; chờ xác nhận lại.':type==='HALF_ENDED'?'Hiệp 1 đã kết thúc.':'Biến động trận; chờ dữ liệu và giá mới.';
  item.eval={...item.eval,score:null,scoreMode:'BASELINE',dataIncomplete:true,hardVeto:true,vetoReasons:['HT_EVENT_RECONFIRMATION']};
  item.lastHTEvent={type,at:now,previousScore:{...previous.goals},score:{...item.latest.goals},statsAt:previous.fresh_at};
  return item.lastHTEvent;
 }
 return {classify,apply};
}
