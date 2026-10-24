import assert from 'node:assert/strict';
import {d1UtcWindow,d1DailyTotals} from './d1-utc-day.mjs';
const cases=[
 ['2026-10-22T23:59:59Z','2026-10-22','2026-10-21'],
 ['2026-10-23T00:00:00Z','2026-10-23','2026-10-22'],
 ['2026-10-23T07:00:00+07:00','2026-10-23','2026-10-22'],
 ['2026-10-23T06:59:59+07:00','2026-10-22','2026-10-21'],
 ['2027-01-01T00:00:00Z','2027-01-01','2026-12-31'],
 ['2028-03-01T00:00:00Z','2028-03-01','2028-02-29']
];
for(const [input,today,yesterday] of cases)assert.deepEqual(d1UtcWindow(input),{utcDay:today,utcYesterday:yesterday});
assert.throws(()=>d1UtcWindow('not a time'),/INVALID_CLOCK/);
const rows=[{day:'2026-10-22',database:'KNOWN_PROD_DB',rowsWritten:102066,rowsRead:20,readQueries:1,writeQueries:2},
{day:'2026-10-23',database:'KNOWN_PROD_DB',rowsWritten:10,rowsRead:11,readQueries:3,writeQueries:5},
{day:'2026-10-23',database:'ISOLATED_FT_DB',rowsWritten:2,rowsRead:4,readQueries:1,writeQueries:1}];
assert.deepEqual(d1DailyTotals(rows,'2026-10-23'),{rowsRead:15,rowsWritten:12,readQueries:4,writeQueries:6});
assert.throws(()=>d1DailyTotals(rows,'2026-10-24'),/CURRENT_UTC_PRODUCTION_D1_DATA_NOT_AVAILABLE/);
assert.throws(()=>d1DailyTotals([rows[0]],'2026-10-23'),/CURRENT_UTC_PRODUCTION_D1_DATA_NOT_AVAILABLE/);
assert.throws(()=>d1DailyTotals([{...rows[1],rowsWritten:-1}],'2026-10-23'),/INVALID_METRIC/);
assert.throws(()=>d1DailyTotals([{...rows[1],rowsWritten:NaN}],'2026-10-23'),/INVALID_METRIC/);
console.log('FE_D1_UTC_DAY_QA_PASS '+JSON.stringify({tests:12,readOnly:true,externalCalls:0,scannerToggles:0}));
