import {getJSON,dataFreshness} from './_lib/state.mjs';
import {nextTehranDate,hoursOld} from './_lib/utils.mjs';

const pub=(x,locked)=>({ok:true,targetDate:x.targetDate,forecast:x.forecast,current:x.current,generatedAt:x.generatedAt,locked,quality:x.quality});
const cached=(payload,{locked=false,status=200}={})=>Response.json(payload,{status,headers:{
  // Browser cache stays short. Netlify's shared durable cache absorbs repeated public traffic.
  'cache-control': locked?'public,max-age=120':'public,max-age=45',
  'netlify-cdn-cache-control': locked
    ?'public, durable, max-age=900, stale-while-revalidate=300'
    :'public, durable, max-age=180, stale-while-revalidate=60'
}});

export default async()=>{
  try{
    const target=nextTehranDate(),lock=await getJSON('latest-lock').catch(()=>null);
    if(lock?.targetDate===target)return cached(pub(lock,true),{locked:true});
    const p=await getJSON('provisional').catch(()=>null),state=await getJSON('latest-data').catch(()=>null);
    if(!p||p.targetDate!==target||hoursOld(p.computedAt||p.generatedAt)>5)throw new Error('No fresh provisional');
    const age=dataFreshness(state);
    // Free-mode refresh cadence is lower, so public provisional freshness allows the scheduled spacing.
    // The official nightly lock still uses the much stricter quality gate in lock-forecast.mjs.
    if(age.currentMarket>5||age.usdt>5||age.news>6||p.quality==='low')throw new Error('Quality gate');
    return cached(pub(p,false));
  }catch{
    return Response.json({ok:false,error:'Forecast unavailable. Verified data are not fresh enough.'},{status:503,headers:{'cache-control':'no-store','netlify-cdn-cache-control':'no-store'}});
  }
};
