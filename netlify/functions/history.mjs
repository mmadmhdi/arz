import {getJSON} from './_lib/state.mjs';
export default async req=>{const rows=await getJSON('public-history').catch(()=>[])||[];let limit=30;try{limit=Math.max(1,Math.min(120,Number(new URL(req.url).searchParams.get('limit')||30)))}catch{}return Response.json({ok:true,count:Math.min(limit,rows.length),history:rows.slice(0,limit)},{headers:{'cache-control':'public,max-age=300,s-maxage=900'}})};
