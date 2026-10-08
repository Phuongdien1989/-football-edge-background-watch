import fs from 'node:fs';import crypto from 'node:crypto';
import {createNodeHttpD1BridgeA3} from './batch05a3-http-d1-bridge.js';
import {runBatch05aSmoke} from './batch05a-smoke-orchestrator.mjs';
const [,,cmd,file]=process.argv;if(!['preflight','run','stop','export'].includes(cmd)||!file)throw Error('USAGE: eligible-cli <preflight|run|stop|export> <config>');
const c=JSON.parse(fs.readFileSync(file,'utf8'));
if(c.pilot_id!=='FE-B05A-ELIGIBLE-PILOT-01')throw Error('FIXED_PILOT_ID_REQUIRED');
if(c.staging_target_confirmed!==true||c.production_target_forbidden!==true||!/football-edge-b05a-staging-bridge\./.test(c.bridge_base_url)||!c.bridge_base_url.startsWith('https://'))throw Error('STAGING_TARGET_GUARD');
if(c.hard_limits?.fixtures!==1||c.hard_limits?.provider_attempts!==40||c.hard_limits?.duration_ms!==600000||c.max_ticks!==4)throw Error('PILOT_SCOPE_GUARD');
const model=crypto.createHash('sha256').update(fs.readFileSync(new URL('../prediction_v2/probability-engine.js',import.meta.url))).digest('hex');if(model!=='194b0c5b9870dbdcb4e06b2a823e1b0afd81f6626fb98c44917172de87257b16')throw Error('MODEL_SHA_MISMATCH');
if(cmd==='preflight'){console.log(JSON.stringify({ok:true,pilot_id:c.pilot_id,model_sha:model,provider_cap:40,selection_cap:20,reserve:20,max_ticks:4,network_calls:0,remote_mutations:0},null,2));process.exit(0)}
const token=process.env[c.bridge_token_env||'BATCH05A3_BRIDGE_TOKEN'];if(!token)throw Error('BRIDGE_TOKEN_REQUIRED');
const client=createNodeHttpD1BridgeA3({baseUrl:c.bridge_base_url,token,pilotId:c.pilot_id,ownerId:c.owner_id});
if(cmd==='export'){console.log(JSON.stringify(await client.exportEvidence(),null,2));process.exit(0)}
if(cmd==='stop'){console.log(JSON.stringify(await client.requestStop(),null,2));process.exit(0)}
if(process.env.FE_APPROVE_ELIGIBLE_PILOT!=='YES')throw Error('EXPLICIT_ELIGIBLE_PILOT_APPROVAL_REQUIRED');
const prior=await client.budgetStore.load(),session=await client.sessionStore.load();
if(prior?.stop_reason||session?.stop_reason)throw Error('DURABLE_STOP_ACTIVE');
if(Number(prior?.total_requests||0)>=40)throw Error('DURABLE_BUDGET_EXHAUSTED');
if(Boolean(prior)!==Boolean(session))throw Error('DURABLE_RESTART_STATE_MISMATCH');
const apiKey=process.env[c.api_key_env||'APISPORTS_KEY'];if(!apiKey)throw Error('API_KEY_MISSING');
const clock={now:()=>Date.now(),sleep:ms=>new Promise(r=>setTimeout(r,ms))};
const result=await runBatch05aSmoke({env:{APISPORTS_KEY:apiKey},fetchImpl:fetch,captureSink:client.captureSink,persistLockedBundle:client.persistLockedBundle,clock,store:client.budgetStore,sessionStore:client.sessionStore,loadPersistedCaptures:client.loadPersistedCaptures,loadObservation:client.loadObservation,owner:client.owner,pilotId:c.pilot_id,maxTicks:4,eligiblePilot:true,ackMode:'REMOTE',networkReal:true,transportLabel:'STAGING_B05A_ELIGIBLE_V2'});
console.log(JSON.stringify(result,null,2));
if(result.failure||result.observation_ids.length<4||result.invocation_provider_attempts>40)process.exitCode=2;
