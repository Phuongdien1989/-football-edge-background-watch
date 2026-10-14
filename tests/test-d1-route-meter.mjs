import assert from 'node:assert/strict';
import {createD1RouteMeter} from '../d1-route-meter.mjs';
const saved=[];
const d1={
  prepare(sql){let params=[];return {
    bind(...v){params=v;return this},
    async run(){saved.push({sql,params});return {meta:{rows_written:4,changes:1}}},
    async all(){return {results:[]}},async first(){return {ok:1}},async raw(){return []}
  }},
  async batch(stmts){const out=[];for(const stmt of stmts)out.push(await stmt.run());return out}
};
const m=createD1RouteMeter(d1,'SYNC_ENTRY');
assert.equal(m.summary().rows_written,0,'no DB operations at setup');
const first=m.db.prepare('INSERT INTO x VALUES (?)').bind('test');
assert.equal((await first.run()).meta.rows_written,4);
await m.db.batch([m.db.prepare('INSERT INTO x VALUES (?)').bind('retry')]);
assert.deepEqual(m.summary(),{route:'SYNC_ENTRY',rows_written:8,write_statements:2,unknown_meta:0});
assert.equal(JSON.stringify(m.summary()).includes('test'),false,'no bound values in metrics');
assert.equal(JSON.stringify(m.summary()).includes('retry'),false,'no payload in metrics');
assert.equal(saved.length,2,'no instrumentation writes');
console.log('PASS: in-memory D1 metering captures run/batch meta without extra D1 writes or payload logs');
