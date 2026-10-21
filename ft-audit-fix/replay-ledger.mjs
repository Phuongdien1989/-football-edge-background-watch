// Staged D1 adapter, disabled by default. No schema creation and no provider calls.
const canonical=v=>{
 if(v===null)return 'null';
 if(typeof v==='number'&&!Number.isFinite(v))throw Error('NON_JSON_PAYLOAD');
 if(['undefined','function','symbol','bigint'].includes(typeof v))throw Error('NON_JSON_PAYLOAD');
 if(typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
};
export const INSERT_SQL='INSERT INTO ft_replay_records_v1 (record_id,kind,observation_id,fixture_id,recorded_at,content_hash,payload_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(record_id) DO NOTHING';
export const READ_SQL='SELECT content_hash FROM ft_replay_records_v1 WHERE record_id=?';
export async function prepareRecord(kind,payload,maxBytes){
 if(!['OBSERVATION','OUTCOME'].includes(kind)||!payload||!Number.isSafeInteger(maxBytes)||maxBytes<=0)throw Error('INVALID_LEDGER_INPUT');
 // Enforce JSON semantics; undefined/nonfinite values cannot silently change meaning.
 const text=canonical(payload);
 let decoded;try{decoded=JSON.parse(text)}catch{throw Error('NON_JSON_PAYLOAD');}
 if(!Number.isSafeInteger(decoded.fixture_id)||decoded.fixture_id<=0)throw Error('INVALID_FIXTURE');
 const observation_id=kind==='OBSERVATION'?decoded.id:decoded.observation_id;
 const recorded_at=kind==='OBSERVATION'?decoded.decision_at:decoded.observed_at;
 if(typeof observation_id!=='string'||!observation_id||!Number.isSafeInteger(recorded_at)||recorded_at<=0)throw Error('INVALID_RECORD_IDENTITY');
 if(kind==='OBSERVATION'&&decoded.schema!=='FT_OBSERVATION_V1_DRAFT')throw Error('INVALID_OBSERVATION_SCHEMA');
 if(kind==='OUTCOME'&&(decoded.schema!=='FT_OUTCOME_V2_DRAFT'||decoded.state!=='RESOLVED'))throw Error('UNRESOLVED_OUTCOME');
 const bytes=new TextEncoder().encode(text);if(bytes.byteLength>maxBytes)throw Error('RECORD_TOO_LARGE');
 const content_hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 // Same observation key with changed contents is rejected; outcome revisions append.
 const record_id=kind==='OBSERVATION'?'OBS:'+observation_id:'OUT:'+observation_id+':'+recorded_at+':'+content_hash;
 return {record_id,kind,observation_id,fixture_id:decoded.fixture_id,recorded_at,content_hash,payload_json:text,bytes:bytes.byteLength};
}
export async function appendRecord(db,kind,payload,{enabled=false,maxBytes}={}){
 if(!enabled)return {status:'DISABLED',sql_requests:0};
 const r=await prepareRecord(kind,payload,maxBytes);
 // A content mismatch never overwrites the original observation.
 const old=await db.prepare(READ_SQL).bind(r.record_id).first();
 if(old){if(old.content_hash!==r.content_hash)throw Error('IMMUTABLE_RECORD_CONFLICT');return {status:'DUPLICATE',sql_requests:1};}
 const result=await db.prepare(INSERT_SQL).bind(r.record_id,r.kind,r.observation_id,r.fixture_id,r.recorded_at,r.content_hash,r.payload_json).run();
 // Handles a concurrent writer winning after the initial read.
 const saved=await db.prepare(READ_SQL).bind(r.record_id).first();
 if(saved?.content_hash!==r.content_hash)throw Error('IMMUTABLE_RECORD_CONFLICT');
 return {status:Number(result.meta?.changes)===0?'DUPLICATE':'STORED',sql_requests:3,reported_rows_written:result.meta?.rows_written??null,bytes:r.bytes};
}
