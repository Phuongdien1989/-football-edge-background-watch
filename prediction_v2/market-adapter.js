/* FOOTBALL EDGE — Prediction V2 / B4
 * Extracts actual supported market offers from normalized API-Football live rows.
 * Never invents a line. No synthetic market is created when a real offer is absent.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const text=v=>String(v??'').trim();
function lineFrom(v){const h=finite(v?.handicap);if(h!=null)return h;const m=text(v?.value).match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null}
function sideFromValue(v,market){
  const s=text(v?.value).toUpperCase();
  if(market==='TOTAL')return /OVER|TÀI|TAI/.test(s)?'OVER':/UNDER|XỈU|XIU/.test(s)?'UNDER':null;
  if(market==='ASIAN_HANDICAP'){
    const explicit=String(v?.selection_side??v?.selection_outcome??'').toUpperCase();if(explicit==='HOME')return 'HOME';if(explicit==='AWAY')return 'AWAY';
    return /HOME|1\b|CHỦ|CHU/.test(s)?'HOME':/AWAY|2\b|KHÁCH|KHACH/.test(s)?'AWAY':null;
  }
  return null;
}
function marketType(row){
  const c=text(row?.category).toLowerCase(),n=text(row?.market??row?.bet).toLowerCase();
  if(c==='over_under'||/over.?under|total goals|asian total/.test(n))return 'TOTAL';
  if(c==='asian_handicap'||/asian handicap|handicap/.test(n))return 'ASIAN_HANDICAP';
  return null;
}
export function extractActualOffers(rows=[]){
  const offers=[];
  for(const row of rows||[]){
    const st=row?.feed_status||row?.status||{};if(row?.integrity?.valid===false||st.blocked||st.stopped||st.finished)continue;
    const mt=marketType(row);if(!mt)continue;
    for(const v of row?.values||[]){
      if(v?.suspended)continue;const odds=finite(v?.odd),line=lineFrom(v),selection=sideFromValue(v,mt);
      if(odds==null||odds<=1||line==null||!selection)continue;
      offers.push({market:mt,selection,line,odds,main:v?.main===true,bookmaker:row?.bookmaker||null,market_name:row?.market||row?.bet||null,
        source_value:v?.value||null,update:row?.update||null});
    }
  }
  const key=o=>[o.market,o.line,o.bookmaker||'',o.selection].join('|'),map=new Map();
  for(const o of offers){const k=key(o),p=map.get(k);if(!p||Number(o.main)>Number(p.main))map.set(k,o)}
  return [...map.values()];
}
export function pairTwoWayOffers(offers=[]){
  const groups=new Map();for(const o of offers){const k=[o.market,o.line,o.bookmaker||''].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o)}
  const out=[];for(const [key,rows] of groups){const a=rows.find(x=>x.selection==='OVER'||x.selection==='HOME'),b=rows.find(x=>x.selection==='UNDER'||x.selection==='AWAY');
    out.push({key,market:rows[0]?.market,line:rows[0]?.line,bookmaker:rows[0]?.bookmaker,a:a||null,b:b||null})}
  return out;
}
