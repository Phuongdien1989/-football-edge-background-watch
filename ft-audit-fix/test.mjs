import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const base=process.argv[2]||'baseline',out=process.argv[3]||'ft-audit-output';
async function engine(path){const code=readFileSync(path,'utf8');return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).createEngine();}
const old=await engine(base+'/candidate/notify-core.js'),fixed=await engine(out+'/candidate/notify-core.js');
const row=(category,market,line=2.5,odd=1.9)=>({category,market,values:[{value:'Over',handicap:line,odd,main:true}],integrity:{valid:true}});
assert.equal(old.watchMarketInfo([row('h1_total','First Half Over/Under',.5)]).has_over,true);
assert.equal(old.watchMarketInfo([row('over_under','Over/Under',null)]).best_over.line,0);
const checks=[];function test(name,fn){fn();checks.push(name);}
for(const category of ['h1_total','h2_total','team_total','corners','unknown'])test('exclude '+category,()=>assert.equal(fixed.watchMarketInfo([row(category,'First Half Over/Under')]).has_over,false));
for(const line of [0,.25,.5,1,1.75,2,2.25,2.5,2.75])test('valid FT line '+line,()=>assert.equal(fixed.watchMarketInfo([row('over_under','Over/Under',line)]).best_over.line,line));
for(const line of [null,undefined,''])test('preserve missing line '+String(line),()=>{const r=row('over_under','Over/Under',line);if(line===undefined)delete r.values[0].handicap;assert.equal(fixed.watchMarketInfo([r]).best_over.line,null);});
test('label fallback',()=>{const r=row('over_under','Over/Under',null);r.values[0].value='Over 2.5';assert.equal(fixed.watchMarketInfo([r]).best_over.line,2.5);});
test('mixed market selects FT',()=>assert.equal(fixed.watchMarketInfo([row('h1_total','First Half Over/Under',.5),row('over_under','Over/Under',2.5,2.9)]).best_over.odd,2.9));
test('high odds retained',()=>assert.equal(fixed.watchMarketInfo([row('over_under','Over/Under',1.5,2.9)]).best_over.odd,2.9));
for(const state of ['blocked','stopped','finished'])test('market '+state,()=>{const r=row('over_under','Over/Under');r.status={[state]:true};assert.equal(fixed.watchMarketInfo([r]).has_over,false);});
test('suspended selection',()=>{const r=row('over_under','Over/Under');r.values[0].suspended=true;assert.equal(fixed.watchMarketInfo([r]).best_over,null);});
test('invalid market',()=>{const r=row('over_under','Over/Under');r.integrity.valid=false;assert.equal(fixed.watchMarketInfo([r]).has_over,false);});
test('valid FT unchanged',()=>{const rows=[row('over_under','Over/Under',2.25)];assert.deepEqual(fixed.watchMarketInfo(rows),old.watchMarketInfo(rows));});
const result={status:'PASS',reproduced_baseline_defects:2,checks:checks.length,names:checks,model_accuracy_validated:false,production_deployed:false};writeFileSync(out+'/tests.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
