// Pure UTC day selection — can be tested without Cloudflare credentials or network.
export function d1UtcWindow(isoNow){
 const ms=Date.parse(isoNow);
 if(!Number.isFinite(ms))throw Error('INVALID_CLOCK');
 const day=new Date(ms).toISOString().slice(0,10);
 const prev=new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 return {utcDay:day,utcYesterday:prev};
}
export function d1DailyTotals(rows,utcDay){
 if(!Array.isArray(rows)||!/^\d{4}-\d{2}-\d{2}$/.test(utcDay))throw Error('INVALID_D1_DAILY_INPUT');
 const selected=rows.filter(x=>x?.day===utcDay);
 if(!selected.some(x=>x.database==='KNOWN_PROD_DB'))throw Error('CURRENT_UTC_PRODUCTION_D1_DATA_NOT_AVAILABLE');
 const keys=['rowsRead','rowsWritten','readQueries','writeQueries'];
 const total=Object.fromEntries(keys.map(k=>[k,0]));
 for(const x of selected){for(const k of keys){
  if(typeof x[k]!=='number'||!Number.isFinite(x[k])||x[k]<0)throw Error('INVALID_METRIC_'+k);
  total[k]+=x[k];
 }}
 return total;
}
