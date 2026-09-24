#!/usr/bin/env bash
set -euo pipefail

REPORT='/tmp/fcm-runtime-report.txt'
APK='native/android/app/build/outputs/apk/debug/app-debug.apk'
adb install -r "$APK"
adb shell pm grant vn.footballedge.app android.permission.POST_NOTIFICATIONS || true
adb logcat -c
adb shell am force-stop vn.footballedge.app
adb shell am start -n vn.footballedge.app/.MainActivity

TOKEN=''
for i in $(seq 1 40); do
  LINE=$(adb logcat -d -s FE_FCM_TEST:I '*:S' | grep 'TOKEN=' | tail -n1 || true)
  if [ -n "$LINE" ]; then
    TOKEN=${LINE#*TOKEN=}
    TOKEN=$(printf '%s' "$TOKEN" | tr -d '\r\n ')
    break
  fi
  sleep 2
done

if [ -z "$TOKEN" ]; then
  echo 'FCM token was not generated.'
  adb logcat -d -s FE_FCM_TEST:I '*:S' || true
  printf 'TOKEN_GENERATION=FAIL\nFCM_SEND=NOT_RUN\nNOTIFICATION_RECEIPT=NOT_RUN\nWORKER_CAPS=NOT_RUN\nWORKER_SUBSCRIBE=NOT_RUN\nWORKER_TEST=NOT_RUN\nWORKER_NOTIFICATION=NOT_RUN\n' > "$REPORT"
  exit 1
fi

echo "::add-mask::$TOKEN"
TOKEN_HASH=$(printf '%s' "$TOKEN" | sha256sum | awk '{print $1}')
HASH16=$(printf '%s' "$TOKEN_HASH" | cut -c1-16)
echo "FCM token generation PASS • length=${#TOKEN} • sha256=${HASH16}…"

if [ -z "${FCM_SERVICE_ACCOUNT_JSON:-}" ]; then
  echo 'FCM direct-send phase cannot run because FCM_SERVICE_ACCOUNT_JSON is empty.'
  printf 'TOKEN_GENERATION=PASS\nFCM_SEND=NO_CREDENTIAL\nNOTIFICATION_RECEIPT=NOT_RUN\nWORKER_CAPS=NOT_RUN\nWORKER_SUBSCRIBE=NOT_RUN\nWORKER_TEST=NOT_RUN\nWORKER_NOTIFICATION=NOT_RUN\n' > "$REPORT"
  exit 1
fi

adb shell input keyevent KEYCODE_HOME
export FCM_DEVICE_TOKEN="$TOKEN"
node <<'NODE'
const crypto=require('crypto');
const sa=JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const input=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:sa.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
const sig=crypto.sign('RSA-SHA256',Buffer.from(input),sa.private_key).toString('base64url');
const assertion=input+'.'+sig;
(async()=>{
  const t=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const tj=await t.json();
  if(!t.ok||!tj.access_token) throw new Error('OAuth failed '+t.status+' '+JSON.stringify(tj));
  const title='Football Edge CI Native Push';
  const body='FCM runtime end-to-end test';
  const r=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`,{method:'POST',headers:{authorization:'Bearer '+tj.access_token,'content-type':'application/json'},body:JSON.stringify({message:{token:process.env.FCM_DEVICE_TOKEN,notification:{title,body},data:{tag:'fe-ci-fcm-runtime',fe_mode:'FT',fixture_id:'0'}}})});
  const raw=await r.text();
  if(!r.ok) throw new Error('FCM send failed '+r.status+' '+raw.slice(0,300));
  console.log('FCM HTTP v1 send PASS');
})().catch(e=>{console.error(e);process.exit(1)});
NODE

RECEIVED=0
for i in $(seq 1 20); do
  if adb shell dumpsys notification --noredact | grep -Fq 'Football Edge CI Native Push'; then
    RECEIVED=1
    break
  fi
  sleep 2
done

if [ "$RECEIVED" != '1' ]; then
  echo 'FCM send succeeded but Android notification was not observed.'
  adb shell dumpsys notification --noredact | tail -n 240 || true
  printf 'TOKEN_GENERATION=PASS\nFCM_SEND=PASS\nNOTIFICATION_RECEIPT=FAIL\nWORKER_CAPS=NOT_RUN\nWORKER_SUBSCRIBE=NOT_RUN\nWORKER_TEST=NOT_RUN\nWORKER_NOTIFICATION=NOT_RUN\n' > "$REPORT"
  exit 1
fi

echo 'Android notification receipt PASS'

if [ -z "${BACKGROUND_TOKEN:-}" ]; then
  echo 'Production Worker E2E skipped: BACKGROUND_TOKEN secret is not configured in GitHub Actions.'
  printf 'TOKEN_GENERATION=PASS\nFCM_SEND=PASS\nNOTIFICATION_RECEIPT=PASS\nWORKER_CAPS=SKIPPED_NO_TOKEN\nWORKER_SUBSCRIBE=SKIPPED_NO_TOKEN\nWORKER_TEST=SKIPPED_NO_TOKEN\nWORKER_NOTIFICATION=SKIPPED_NO_TOKEN\n' > "$REPORT"
  exit 0
fi

WORKER_URL="${BACKGROUND_WORKER_URL:-https://football-edge-background-watch.ngophuonghuy.workers.dev}"
WORKER_URL="${WORKER_URL%/}"
export BACKGROUND_WORKER_URL="$WORKER_URL"
rm -f /tmp/fe_worker_device_id

cleanup_worker_device(){
  if [ ! -s /tmp/fe_worker_device_id ]; then return 0; fi
  export WORKER_DEVICE_ID="$(cat /tmp/fe_worker_device_id)"
  node <<'NODE' || true
(async()=>{
  const base=process.env.BACKGROUND_WORKER_URL;
  const token=process.env.BACKGROUND_TOKEN;
  const id=process.env.WORKER_DEVICE_ID;
  if(!base||!token||!id)return;
  const r=await fetch(base+'/api/notify/unsubscribe',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({id})});
  if(r.ok) console.log('Production Worker cleanup PASS');
  else console.log('Production Worker cleanup WARN • HTTP '+r.status);
})().catch(()=>{});
NODE
  rm -f /tmp/fe_worker_device_id
}
trap cleanup_worker_device EXIT

node <<'NODE'
const fs=require('fs');
const base=process.env.BACKGROUND_WORKER_URL;
const auth=process.env.BACKGROUND_TOKEN;
const deviceToken=process.env.FCM_DEVICE_TOKEN;
const headers={authorization:'Bearer '+auth,'content-type':'application/json','accept':'application/json'};
async function readJson(r){const t=await r.text();let j={};try{j=t?JSON.parse(t):{}}catch{j={raw:t}}return j}
(async()=>{
  let r=await fetch(base+'/api/notify/native/capabilities',{headers});
  let j=await readJson(r);
  if(!r.ok||!j?.ok||j?.fcm_configured!==true)throw new Error('WORKER_CAPS_FAILED HTTP '+r.status+' '+JSON.stringify(j).slice(0,250));
  console.log('Production Worker native capabilities PASS • FCM configured');

  r=await fetch(base+'/api/notify/native/subscribe',{method:'POST',headers,body:JSON.stringify({platform:'android',token:deviceToken,prefs:{enabled:false,h1:false,goal:false,gap:false,h1Threshold:72,goalThreshold:70,gapThreshold:70},app_version:'CI-RUNTIME',native_version:'N1.2-CI'})});
  j=await readJson(r);
  if(!r.ok||!j?.ok||!j?.id||j?.sender_ready!==true)throw new Error('WORKER_SUBSCRIBE_FAILED HTTP '+r.status+' '+JSON.stringify(j).slice(0,250));
  fs.writeFileSync('/tmp/fe_worker_device_id',String(j.id));
  console.log('Production Worker native subscribe PASS • device '+String(j.id).slice(0,12)+'…');

  r=await fetch(base+'/api/notify/test',{method:'POST',headers,body:JSON.stringify({id:j.id})});
  const t=await readJson(r);
  if(!r.ok||!t?.ok)throw new Error('WORKER_TEST_FAILED HTTP '+r.status+' '+JSON.stringify(t).slice(0,250));
  console.log('Production Worker native test send PASS');
})().catch(e=>{console.error(e);process.exit(1)});
NODE

WORKER_RECEIVED=0
for i in $(seq 1 20); do
  if adb shell dumpsys notification --noredact | grep -Fq 'Football Edge • Thông báo thử'; then
    WORKER_RECEIVED=1
    break
  fi
  sleep 2
done

if [ "$WORKER_RECEIVED" != '1' ]; then
  echo 'Production Worker accepted native test but Android notification was not observed.'
  adb shell dumpsys notification --noredact | tail -n 240 || true
  printf 'TOKEN_GENERATION=PASS\nFCM_SEND=PASS\nNOTIFICATION_RECEIPT=PASS\nWORKER_CAPS=PASS\nWORKER_SUBSCRIBE=PASS\nWORKER_TEST=PASS\nWORKER_NOTIFICATION=FAIL\n' > "$REPORT"
  exit 1
fi

echo 'Production Worker native notification receipt PASS'
printf 'TOKEN_GENERATION=PASS\nFCM_SEND=PASS\nNOTIFICATION_RECEIPT=PASS\nWORKER_CAPS=PASS\nWORKER_SUBSCRIBE=PASS\nWORKER_TEST=PASS\nWORKER_NOTIFICATION=PASS\n' > "$REPORT"
cleanup_worker_device
trap - EXIT
