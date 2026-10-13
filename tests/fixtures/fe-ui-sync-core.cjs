(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FEStateCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const terminal=new Set(['FT','AET','PEN','CANC','ABD','AWD','WO']);
  function phase(status){return ({'1H':'H1','2H':'H2',HT:'HALF TIME',ET:'EXTRA TIME',BT:'BREAK',P:'PENALTIES',NS:'NOT STARTED',LIVE:'LIVE'})[status]||(terminal.has(status)?'ENDED':'UNKNOWN');}
  function valid(row){return row?.schema==='FE_NOTIFY_UI_SNAPSHOT_V1'&&Number.isSafeInteger(row.fixture_id)&&row.fixture_id>0&&Number(row.captured_at)>0&&Number.isSafeInteger(row.revision)&&row.revision>0&&typeof row.version==='string'&&row.version.length>0&&row.fixture?.fixture?.id===row.fixture_id;}
  function makeStore(){let rows=new Map(),generation=0;return {
    apply(packet){if(packet?.schema!=='FE_NOTIFY_UI_STATE_V1'||!Array.isArray(packet.snapshots)||!Number.isFinite(packet.server_at))throw Error('INVALID_STATE_RESPONSE');
      if(packet.server_at<generation)return false;
      for(const row of packet.snapshots)if(!valid(row))throw Error('INVALID_SNAPSHOT');
      const next=new Map(rows);for(const row of packet.snapshots){const old=next.get(row.fixture_id);if(old&&(row.revision<old.revision||row.captured_at<old.captured_at))continue;
        if(old&&row.revision===old.revision&&row.version!==old.version)throw Error('VERSION_CONFLICT');
        next.set(row.fixture_id,JSON.parse(JSON.stringify(row)));}
      rows=next;generation=packet.server_at;return true;
    },read(id){const r=rows.get(Number(id));return r?JSON.parse(JSON.stringify(r)):null;},all(){return [...rows.values()].map(r=>JSON.parse(JSON.stringify(r)));}
  };}
  function disposition(row,now=Date.now()){
    if(!row)return {key:'NO_DATA',label:'CHUA CO DU LIEU',tone:'muted'};
    const age=now-row.captured_at,st=row.fixture?.fixture?.status?.short;
    if(terminal.has(st))return {key:'ENDED',label:'KET THUC',tone:'muted'};
    if(age< -5000)return {key:'CLOCK',label:'THOI GIAN KHONG HOP LE',tone:'bad'};
    if(age>60000)return {key:'STALE',label:'DU LIEU CU',tone:'warn'};
    if(row.active_live===false)return {key:'NOT_LIVE',label:'CHO XAC MINH TRANG THAI',tone:'warn'};
    if(row.publication_error||['ERROR','INVALID'].includes(row.source_health?.stats))return {key:'ERROR',label:'API / CAP NHAT BI LOI',tone:'bad'};
    if(row.source_health?.stats!=='OK')return {key:'NO_STATS',label:'API CHUA CO THONG KE',tone:'warn'};
    return {key:'CURRENT',label:'DA DONG BO',tone:'good'};
  }
  function deepLink(raw,origin){try{const u=new URL(raw,origin);if(u.origin!==origin)return null;const id=Number(u.searchParams.get('fe_fixture'));return Number.isSafeInteger(id)&&id>0?{id,mode:['H1','FT','HC'].includes(u.searchParams.get('fe_mode'))?u.searchParams.get('fe_mode'):'FT',version:u.searchParams.get('fe_snapshot')}:null;}catch{return null;}}
  return {phase,valid,makeStore,disposition,deepLink};
});
