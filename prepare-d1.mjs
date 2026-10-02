import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const NAME='football-edge-v2-raw';
const env={...process.env};
function run(args){
  return execFileSync('npx',['wrangler',...args],{encoding:'utf8',env,stdio:['ignore','pipe','pipe']});
}

let dbs=[];
try {
  dbs=JSON.parse(run(['d1','list','--json']));
} catch(e) {
  console.error(e.stderr?.toString()||e.message);
  process.exit(2);
}

let db=dbs.find(x=>x.name===NAME || x.database_name===NAME);
let id=db?.uuid || db?.id || db?.database_id;
if(!id){
  const out=run(['d1','create',NAME,'--location','apac']);
  const m=out.match(/database_id\s*=\s*"([a-f0-9-]+)"/i) || out.match(/([a-f0-9]{8}-[a-f0-9-]{27,})/i);
  if(!m){
    console.error('Could not parse D1 database_id from wrangler output:\n'+out);
    process.exit(3);
  }
  id=m[1];
  console.log('Created D1 '+NAME+' '+id);
} else {
  console.log('Using existing D1 '+NAME+' '+id);
}

const template=readFileSync('wrangler.toml','utf8');
writeFileSync('wrangler.deploy.toml',template.replace('__D1_DATABASE_ID__',id));
writeFileSync('.d1-id',id+'\n');
