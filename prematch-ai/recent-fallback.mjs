// Existing transparent team Gamma-Poisson model, PRE-only read-only fallback.
// Not the opponent-adjusted trained model. No HT guess, odds or provider input.
import {modelHC} from '../hc-model/core.mjs';
import {summarize} from './model.mjs';
import {digest,fixtureOK,time} from './contracts.mjs';
export async function predictRecent(f,context,{now=Date.now()}={}){
 if(!fixtureOK(f)||f.kind!=='REAL'||f.status!=='NS'||f.observedAt>now||context?.fixtureId!==f.id||!time(context.observedAt)||context.observedAt>f.observedAt)return null;
 const r=modelHC({fixtureId:f.id,homeId:f.home.id,awayId:f.away.id,kickoff:f.kickoff,at:f.observedAt,minute:0,status:'NS',goals:{home:0,away:0},homeRecent:context.homeRecent,awayRecent:context.awayRecent});if(!r.ok)return null;const m=r.model,joint=m.homeRemaining.map(h=>m.awayRemaining.map(a=>h*a));
 const forecast={schema:'FE_PREMATCH_FORECAST_V1',fixtureId:f.id,kind:'REAL',cutoff:f.observedAt,kickoff:f.kickoff,artifactHash:await digest(context),modelVersion:'PM_EXISTING_RECENT_GAMMA_POISSON_FALLBACK_V1',trainCutoff:context.observedAt,calibrated:false,means:{FT:{home:m.meanHomeRemaining,away:m.meanAwayRemaining},HT:null,H2:null},distributions:{FT:joint,HT:null},summary:{FT:summarize(joint),HT:null,HTFT:null},variants:[],sample:{home:m.sample.home,away:m.sample.away,league:m.sample.unique,ht:0},uncertainty:{kind:'NOT_CALIBRATED_RECENT_HISTORY_ONLY',validated:false,reason:'Mô hình lịch sử sẵn có; chưa hiệu chỉnh đối thủ, chưa lượng hóa sai số ngoài mẫu.'},applicability:'LIMITED_RECENT_HISTORY',assumptions:m.assumptions,synthetic:false};forecast.id=await digest(forecast);return {status:'LIMITED',reason:'RECENT_HISTORY_FALLBACK_NOT_OPPONENT_ADJUSTED',fixture:structuredClone(f),forecast};
}
