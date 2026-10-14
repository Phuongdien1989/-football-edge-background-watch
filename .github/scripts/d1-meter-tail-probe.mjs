// Authenticated, read-only Tail transport test using Wrangler's supported
// WebSocket handshake. Capture event counts only; never print event contents.
import {spawn} from 'node:child_process';
const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'};
if(!env.CLOUDFLARE_API_TOKEN||!env.CLOUDFLARE_ACCOUNT_ID)throw Error('TAIL_CREDENTIALS_MISSING');
const cp=spawn('./node_modules/.bin/wrangler',['tail','football-edge-background-watch','--format','json'],{env,stdio:['ignore','pipe','pipe']});
let out='',err='',exit=null,healthSent=0;
cp.stdout.on('data',b=>{out=(out+b.toString()).slice(-64000)});
cp.stderr.on('data',b=>{err=(err+b.toString()).slice(-8000)});
cp.on('exit',code=>{exit=code});
await new Promise(r=>setTimeout(r,3800));
for(let i=0;i<3;i++){
 try{const x=await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(5000)});if(x.status===200)healthSent++}catch{}
 await new Promise(r=>setTimeout(r,700));
}
await new Promise(r=>setTimeout(r,4500));
cp.kill('SIGKILL');cp.stdout.destroy();cp.stderr.destroy();
await new Promise(r=>setTimeout(r,500));
const lines=out.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('{'));
const received=lines.filter(x=>{try{return !!JSON.parse(x).event}catch{return false}}).length;
const connected=/Successfully created tail|Connected to|tail session/i.test(out+err)||received>0;
console.log('FE_AUTH_TAIL_TRANSPORT '+JSON.stringify({api:'WRANGLER_CLI',connected,received_request_event:received>0,health_requests_sent:healthSent,exit_code:exit,production_deploy:'NOT_ATTEMPTED'}));
if(!connected||!received)process.exitCode=2;
