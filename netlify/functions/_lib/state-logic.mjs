import {hoursOld,clamp,median,mean,ridgePredict} from './utils.mjs';

export function metaFeatureVector(f){const e=f?.model?.external||{},t=f?.model?.technical||{},i=e.intraday||{};return [e.usdt?.premium||0,e.usdt?.momentum24h||0,e.usdt?.imbalance||0,e.usdt?.tradeImbalance||0,e.aed?.premium||0,e.goldFX?.fxProxy||0,e.news?.score||0,e.macro?.score||0,i.lead||0,i.premiumChange6h||0,t.momentum3||0,t.momentum10||0,t.z20||0,t.volatility||0,(f?.changePct||0)/100].map(x=>Number.isFinite(x)?x:0)}

export function metaAdjustment(calibration,currentForecast=null){const rows=(calibration?.errors||[]).filter(x=>Number.isFinite(x.logError));const currentFeatures=currentForecast?metaFeatureVector(currentForecast):null;if(rows.length<20)return {adjustment:0,enabled:false,mode:'off',samples:rows.length};const usable=rows.filter(x=>Array.isArray(x.metaFeatures)&&x.metaFeatures.length===15&&x.metaFeatures.every(Number.isFinite));if(currentFeatures&&usable.length>=30){const n=usable.length,split=Math.max(22,Math.floor(n*.72)),train=usable.slice(0,split),test=usable.slice(split),X=train.map(x=>x.metaFeatures),y=train.map(x=>x.logError);let zero=0,corrected=0;for(const row of test){const p=clamp(ridgePredict(X,y,row.metaFeatures,12)*.55,-.008,.008);zero+=Math.abs(row.logError);corrected+=Math.abs(row.logError-p)}zero/=test.length||1;corrected/=test.length||1;const gain=zero?1-corrected/zero:0;if(test.length>=7&&gain>.04){const p=clamp(ridgePredict(X,y,currentFeatures,12)*.55,-.007,.007);return {adjustment:p,enabled:true,mode:'context-ridge',samples:n,holdoutGain:gain,holdoutSamples:test.length}}}
const n=rows.length,split=Math.max(14,Math.floor(n*.72)),train=rows.slice(0,split),test=rows.slice(split),bias=median(train.map(x=>x.logError)),zero=mean(test.map(x=>Math.abs(x.logError))),corrected=mean(test.map(x=>Math.abs(x.logError-bias))),gain=zero?1-corrected/zero:0;if(test.length>=5&&gain>.035)return {adjustment:clamp(bias*.35,-.005,.005),enabled:true,mode:'bias',samples:n,holdoutGain:gain,holdoutSamples:test.length};return {adjustment:0,enabled:false,mode:'off',samples:n,holdoutGain:gain||0}}

export function deriveIntradayFeatures(snapshots,now=new Date()){const rows=(snapshots||[]).filter(x=>{const t=new Date(x?.at||0).getTime();return Number.isFinite(t)&&now.getTime()-t>=0&&now.getTime()-t<=30*3600000}).sort((a,b)=>new Date(a.at)-new Date(b.at));if(rows.length<2)return {coverage:0,samples:rows.length};const latest=rows.at(-1),pick=hours=>{const target=now.getTime()-hours*3600000;return rows.reduce((best,x)=>Math.abs(new Date(x.at).getTime()-target)<Math.abs(new Date(best.at).getTime()-target)?x:best,rows[0])},r=(field,h)=>{const a=pick(h),x=latest?.[field],y=a?.[field];return Number.isFinite(x)&&Number.isFinite(y)&&x>0&&y>0?Math.log(x/y):0},premium=x=>Number.isFinite(x?.usdt)&&Number.isFinite(x?.usd)&&x.usdt>0&&x.usd>0?Math.log(x.usdt/x.usd):0,a6=pick(6),a24=pick(24),recent=rows.filter(x=>now-new Date(x.at)<=7*3600000),coverage=recent.length?mean(recent.map(x=>{const h=x.health||{};const keys=['currentMarket','usdt','news','macro'];return keys.filter(k=>h[k]).length/keys.length})):0;return {samples:rows.length,coverage,usdChange6h:r('usd',6),usdChange24h:r('usd',24),usdtChange6h:r('usdt',6),usdtChange24h:r('usdt',24),premiumChange6h:premium(latest)-premium(a6),premiumChange24h:premium(latest)-premium(a24),newsDelta6h:(Number.isFinite(latest.news)?latest.news:0)-(Number.isFinite(a6.news)?a6.news:0),macroDelta6h:(Number.isFinite(latest.macro)?latest.macro:0)-(Number.isFinite(a6.macro)?a6.macro:0)}}

export function dataFreshness(state,now=new Date()){const at=state?.sourceAt||{};return {history:hoursOld(at.history,now),currentMarket:hoursOld(at.currentMarket,now),usdt:hoursOld(at.usdt,now),news:hoursOld(at.news,now),macro:hoursOld(at.macro,now),aedHistory:hoursOld(at.aedHistory,now),localGoldHistory:hoursOld(at.localGoldHistory,now)}}

export function deriveSignalScales(shadowHistory){
  const rows=(shadowHistory?.rows||shadowHistory||[]).filter(x=>x&&x.errors&&Number.isFinite(x.errors.fullRaw)).slice(-120);
  const defaults={usdt:.90,aed:.78,goldFX:.58,news:.62,macro:.50,intraday:.70};
  const variants={usdt:'noUSDT',aed:'noAED',goldFX:'noGoldFX',news:'noNews',macro:'noMacro',intraday:'noIntraday'};
  const scales={...defaults},evidence={};
  for(const [group,variant] of Object.entries(variants)){
    const ds=rows.filter(r=>Number.isFinite(r.errors?.[variant])).map(r=>{
      const f=r.errors.fullRaw,a=r.errors[variant];
      return (a-f)/(a+.0005);
    }).slice(-90);
    if(ds.length<18){evidence[group]={samples:ds.length,mode:'prior',scale:scales[group]};continue}
    const effect=median(ds),disp=median(ds.map(x=>Math.abs(x-effect)))||.01,se=Math.max(.006,1.4826*disp/Math.sqrt(ds.length)),z=effect/se,conf=clamp((Math.abs(z)-.6)/2.2,0,1);
    let scale=defaults[group];
    if(effect>.012)scale=defaults[group]+(1-defaults[group])*conf;
    else if(effect<-.012)scale=defaults[group]*(1-.78*conf);
    scales[group]=clamp(scale,.08,1.05);
    evidence[group]={samples:ds.length,effect,robustZ:z,confidence:conf,mode:'live-ablation',scale:scales[group]};
  }
  const master=rows.filter(r=>Number.isFinite(r.errors?.coreOnly)).map(r=>({full:r.errors.fullRaw,tech:r.errors.coreOnly})).slice(-90);
  if(master.length>=22){const full=mean(master.map(x=>x.full)),tech=mean(master.map(x=>x.tech)),overlaySkill=tech/(full+.0001);if(overlaySkill<.97){const shrink=clamp(overlaySkill/.97,.45,.95);for(const k of Object.keys(scales))scales[k]*=shrink;evidence.overlayGate={samples:master.length,fullMaePct:full,coreOnlyMaePct:tech,overlaySkill,shrink}}else evidence.overlayGate={samples:master.length,fullMaePct:full,coreOnlyMaePct:tech,overlaySkill,shrink:1}}
  return {scales,evidence,samples:rows.length};
}

export function liveForecastGuard(calibration,currentForecast){
  const rows=(calibration?.errors||[]).filter(r=>Number.isFinite(r?.actual)&&r.actual>0&&Number.isFinite(r?.current)&&r.current>0&&Number.isFinite(r?.forecast)&&r.forecast>0).slice(-120);
  const base={enabled:false,mode:'off',samples:rows.length,scale:1,forecast:currentForecast?.forecast??null};
  if(!currentForecast||!Number.isFinite(currentForecast.forecast)||!Number.isFinite(currentForecast.current)||currentForecast.current<=0||rows.length<28)return base;
  const obs=rows.map(r=>({x:Math.log(r.forecast/r.current),y:Math.log(r.actual/r.current)})).filter(r=>Number.isFinite(r.x)&&Number.isFinite(r.y));
  if(obs.length<28)return {...base,samples:obs.length};
  const split=Math.max(20,Math.floor(obs.length*.72)),train=obs.slice(0,split),test=obs.slice(split);
  if(test.length<7)return {...base,samples:obs.length};
  const xx=train.reduce((s,r)=>s+r.x*r.x,0),xy=train.reduce((s,r)=>s+r.x*r.y,0),ridge=.00002*train.length;
  const fitted=clamp(xy/(xx+ridge),0,1);
  const err=beta=>mean(test.map(r=>Math.abs(r.y-beta*r.x))),e1=err(1),ef=err(fitted),e0=err(0);
  let scale=1,mode='off';
  if(e0<e1*.96&&e0<=ef*1.02){scale=0;mode='naive-fallback'}
  else if(ef<e1*.97){scale=fitted;mode='live-shrink'}
  const ret=Math.log(currentForecast.forecast/currentForecast.current),raw=currentForecast.current*Math.exp(ret*scale),step=raw>=100000?10:5,forecast=Math.round(raw/step)*step;
  return {enabled:mode!=='off',mode,samples:obs.length,scale,forecast,holdoutSamples:test.length,holdoutMae:{original:e1,calibrated:ef,naive:e0},holdoutGain:e1?1-Math.min(ef,e0)/e1:0,fittedScale:fitted};
}
