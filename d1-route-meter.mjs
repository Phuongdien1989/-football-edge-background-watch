// Prepared but NOT connected to any production entrypoint.
// All counters are request/operation-local memory; no D1 telemetry tables or payload logs.
export function createD1RouteMeter(d1,route){
 if(!d1||!route)throw Error('meter requires D1 binding and fixed route label');
 const native=new WeakMap();
 const state={route:String(route).slice(0,40),rows_written:0,write_statements:0,unknown_meta:0};
 const accept=result=>{
   const value=result?.meta?.rows_written;
   if(!Number.isFinite(value)){state.unknown_meta++;return;}
   state.rows_written+=value;
   if(value>0)state.write_statements++;
 };
 const db={
   prepare(sql){
     // SQL, parameters, tokens and payloads are NEVER stored by the meter.
     let stmt=d1.prepare(sql);
     const wrapper={
       bind(...params){stmt=stmt.bind(...params);return wrapper},
       async run(){const r=await stmt.run();accept(r);return r},
       async all(){return stmt.all()},
       async first(col){return stmt.first(col)},
       async raw(){return stmt.raw()}
     };
     native.set(wrapper,()=>stmt);
     return wrapper;
   },
   async batch(statements){
     const originals=statements.map(s=>native.get(s)?.()??s);
     const out=await d1.batch(originals);
     for(const result of out||[])accept(result);
     return out;
   }
 };
 return {db,summary:()=>Object.freeze({...state})};
}
