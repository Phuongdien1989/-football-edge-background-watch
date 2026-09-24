#!/usr/bin/env bash
set -euo pipefail

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
  printf 'TOKEN_GENERATION=FAIL\nFCM_SEND=NOT_RUN\nNOTIFICATION_RECEIPT=NOT_RUN\n' > /tmp/fcm-runtime-report.txt
  exit 1
fi

echo "::add-mask::$TOKEN"
TOKEN_HASH=$(printf '%s' "$TOKEN" | sha256sum | awk '{print $1}')
HASH16=$(printf '%s' "$TOKEN_HASH" | cut -c1-16)
echo "FCM token generation PASS • length=${#TOKEN} • sha256=${HASH16}…"

if [ -z "${FCM_SERVICE_ACCOUNT_JSON:-}" ]; then
  echo 'FCM direct-send phase cannot run because FCM_SERVICE_ACCOUNT_JSON is empty.'
  printf 'TOKEN_GENERATION=PASS\nFCM_SEND=NO_CREDENTIAL\nNOTIFICATION_RECEIPT=NOT_RUN\n' > /tmp/fcm-runtime-report.txt
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
  if adb shell dumpsys notification --noredact | grep -q 'Football Edge CI Native Push'; then
    RECEIVED=1
    break
  fi
  sleep 2
done

if [ "$RECEIVED" != '1' ]; then
  echo 'FCM send succeeded but Android notification was not observed.'
  adb shell dumpsys notification --noredact | tail -n 240 || true
  printf 'TOKEN_GENERATION=PASS\nFCM_SEND=PASS\nNOTIFICATION_RECEIPT=FAIL\n' > /tmp/fcm-runtime-report.txt
  exit 1
fi

echo 'Android notification receipt PASS'
printf 'TOKEN_GENERATION=PASS\nFCM_SEND=PASS\nNOTIFICATION_RECEIPT=PASS\n' > /tmp/fcm-runtime-report.txt
