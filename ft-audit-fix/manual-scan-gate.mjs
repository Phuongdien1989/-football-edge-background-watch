// Pure offline scanner safety decision. NEVER starts scanning, writes D1, or uses external APIs.
export const D1_FREE_WRITE_LIMIT=100000;
export function evaluateManualScanGate({analytics,live,utcDay,now,plannedMaxWrittenRows=1000}){
 const reasons=[];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(utcDay||''))reasons.push('UTC_DAY_NOT_SUPPLIED');
 if(!Number.isFinite(plannedMaxWrittenRows)||plannedMaxWrittenRows<1||plannedMaxWrittenRows>10000)reasons.push('INVALID_PLANNED_BUDGET');
 if(analytics?.status!=='PASS')reasons.push('D1_ANALYTICS_MISSING');
 const records=analytics?.databases;
 if(!Array.isArray(records)||!records.length)reasons.push('D1_DATABASE_RECORDS_MISSING');
 const sameDay=Array.isArray(records)?records.filter(r=>r.day===utcDay):[];
 if(!sameDay.length)reasons.push('NEW_UTC_DAY_DATA_MISSING');
 if(sameDay.some(r=>!Number.isFinite(r.rowsWritten)||r.rowsWritten<0))reasons.push('INVALID_D1_ROW_COUNT');
 const total=sameDay.reduce((n,r)=>n+(Number.isFinite(r.rowsWritten)?r.rowsWritten:0),0);
 const accounts=new Set(sameDay.map(r=>r.database));
 if(!accounts.has('KNOWN_PROD_DB'))reasons.push('PRODUCTION_D1_NOT_REPORTED');
 if(accounts.has('UNLISTED_DB'))reasons.push('UNCLASSIFIED_D1');
 const observedAt=Date.parse(analytics?.at||'');
 const time=Date.parse(now||'');
 if(!Number.isFinite(time)||!Number.isFinite(observedAt)||observedAt>time+60000||time-observedAt>20*60*1000)reasons.push('ANALYTICS_NOT_FRESH_ENOUGH');
 if(live?.status!=='PASS'||live?.backend?.status!=='OK'||live?.mobile?.status!=='OK'||live?.health?.status!=='OK'||live?.rollback?.status!=='OK'||live?.rollback?.exists!==true)reasons.push('LIVE_VERSION_CHECK_INCOMPLETE');
 const deployedBackend=live?.backend?.versions;
 if(!Array.isArray(deployedBackend)||deployedBackend.length!==1||deployedBackend[0]?.percentage!==100||deployedBackend[0]?.id!=='e7d2090c-d0e1-4f58-9f5a-4360acd2ced3')reasons.push('BACKEND_VERSION_DRIFT');
 const deployedMobile=live?.mobile?.versions;
 if(!Array.isArray(deployedMobile)||deployedMobile.length!==1||deployedMobile[0]?.percentage!==100||deployedMobile[0]?.id!=='e1beb5bf-3617-4c54-805a-623cfafd7411')reasons.push('MOBILE_VERSION_DRIFT');
 if(live?.health?.http!==200||live?.health?.deploy_commit!=='3cd210d2d74aff547de4587ab4a3c96b982a728c')reasons.push('BACKEND_HEALTH_OR_COMMIT_UNKNOWN');
 if(live?.health?.enabled!==false||live?.health?.manual_enabled!==false||live?.health?.next_alarm!==null)reasons.push('SCANNER_NOT_CONFIRMED_OFF');
 const liveAt=Date.parse(live?.at||'');
 if(!Number.isFinite(time)||!Number.isFinite(liveAt)||liveAt>time+60000||time-liveAt>20*60*1000)reasons.push('HEALTH_NOT_FRESH_ENOUGH');
 if(total+plannedMaxWrittenRows>D1_FREE_WRITE_LIMIT)reasons.push('INSUFFICIENT_D1_BUDGET');
 const dedup=[...new Set(reasons)];
 return {decision:dedup.length?'NO_GO':'REVIEW_FOR_MANUAL_SHORT_SCAN',reasons:dedup,utc_day:utcDay,rows_written_observed:total,headroom_estimate:Math.max(0,D1_FREE_WRITE_LIMIT-total),planned_max_rows:plannedMaxWrittenRows,
 caveat:'Adaptive metrics are delayed. REVIEW is not permission to scan and cannot prove current billable headroom. Operator must independently confirm live client sync/ACK and approve a bounded manual test. No automatic scanner activation.'};
}
