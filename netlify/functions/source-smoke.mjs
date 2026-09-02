import {gatherAll,fetchUSDTAnchorWindow} from './_lib/sources.mjs';

export default async req=>{
  const token=process.env.ADMIN_TOKEN,auth=req.headers.get('authorization')||'';
  if(!token||auth!==`Bearer ${token}`)return new Response('Not found',{status:404});
  const started=Date.now();
  try{
    const now=new Date(),data=await gatherAll({semanticNews:false});
    const anchor=await fetchUSDTAnchorWindow({from:new Date(now.getTime()-3*86400000),to:now}).catch(e=>({rows:[],sourceHealth:{},errors:[String(e?.message||e)]}));
    return Response.json({ok:true,version:'6.1.0-free',elapsedMs:Date.now()-started,asOf:now.toISOString(),checks:{usdHistory:{rows:data.history?.length||0,first:data.history?.[0]?.date||null,last:data.history?.at(-1)?.date||null,source:data.history?.at(-1)?.source||null},currentUsd:{mid:data.currentMarket?.mid||null,asOf:data.currentMarket?.asOf||null,quality:data.currentMarket?.quality||null,directSources:data.currentMarket?.points?.map(x=>x.source)||[],disagreementPct:data.currentMarket?.disagreementPct??null,aedCrossCheckPct:data.currentMarket?.aedCrossCheckPct??null},usdt:{mid:data.usdt?.mid||null,quality:data.usdt?.quality||null,sources:data.usdt?.sources||[],exchangeCount:data.usdt?.exchangeCount||0,disagreementPct:data.usdt?.disagreementPct??null},news:{score:data.news?.score??null,relevantCount:data.news?.relevantCount||0,independentDomains:data.news?.independentDomains||0,sourceHealth:data.news?.sourceHealth||{}},macro:{score:data.macro?.score??null,components:Object.keys(data.macro?.components||{})},usdtHistorical:{recentAnchorRows:anchor.rows?.length||0,sourceHealth:anchor.sourceHealth||{},errors:anchor.errors||[]}},errors:data.errors||[]},{headers:{'cache-control':'no-store'}});
  }catch(e){return Response.json({ok:false,version:'6.1.0-free',elapsedMs:Date.now()-started,error:String(e?.message||e)},{status:503,headers:{'cache-control':'no-store'}})}
};
