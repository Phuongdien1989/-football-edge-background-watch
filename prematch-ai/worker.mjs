import {analyze} from './runtime.mjs';
self.onmessage=async e=>{try{self.postMessage({id:e.data.id,result:await analyze(e.data.input,{now:e.data.now})});}catch(x){self.postMessage({id:e.data.id,error:String(x.message||x).slice(0,250)});}};
