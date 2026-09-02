const base=String(process.env.SITE_URL||'').replace(/\/$/,'');
if(!/^https?:\/\//.test(base))throw new Error('Set SITE_URL=https://your-site.example');
async function read(path,headers={}){const r=await fetch(base+path,{headers:{accept:'application/json',...headers}});let body;try{body=await r.json()}catch{body=await r.text()}return {status:r.status,ok:r.ok,body}}
const health=await read('/api/health');
const forecast=await read('/api/forecast');
const result={site:base,health,forecast};
if(process.env.ADMIN_TOKEN){result.sourceSmoke=await read('/api/source-smoke',{authorization:`Bearer ${process.env.ADMIN_TOKEN}`});result.diagnostics=await read('/api/diagnostics',{authorization:`Bearer ${process.env.ADMIN_TOKEN}`})}
console.log(JSON.stringify(result,null,2));
if(!health.ok||health.body?.ok!==true)process.exitCode=2;
if(!forecast.ok||forecast.body?.ok!==true)process.exitCode=3;
if(result.sourceSmoke&&(!result.sourceSmoke.ok||result.sourceSmoke.body?.ok!==true))process.exitCode=4;
