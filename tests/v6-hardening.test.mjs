import assert from 'node:assert/strict';
import {buildForecast} from '../netlify/functions/_lib/forecast-engine.mjs';
import {liveForecastGuard} from '../netlify/functions/_lib/state-logic.mjs';
import {validateHistorySeries} from '../netlify/functions/_lib/sources.mjs';

const history=[];let p=150000;
for(let i=0;i<220;i++){
  p*=Math.exp(.0007+.002*Math.sin(i/9));
  history.push({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),close:p});
}
const last=history.at(-1).close,asOf=history.at(-1).date;
const trusted={mid:last*1.20,asOf,quality:'high',disagreementPct:.004,hasTGJU:true,aedCrossCheckPct:.02};
const shock=buildForecast({history,currentMarket:trusted,news:{score:0},macro:{score:0},now:new Date('2026-08-18T20:00:00Z')});
assert.ok(Math.abs(shock.current/(last*1.20)-1)<1e-9,'confirmed large move must be used');
const untrusted=buildForecast({history,currentMarket:{...trusted,quality:'conflicted',disagreementPct:.08},news:{score:0},macro:{score:0},now:new Date('2026-08-18T20:00:00Z')});
assert.ok(Math.abs(untrusted.current/last-1)<1e-9,'unconfirmed large move must not contaminate series');
assert.throws(()=>buildForecast({history,currentMarket:{...trusted,mid:last*1.50},news:{score:0},macro:{score:0},now:new Date('2026-08-18T20:00:00Z')}),/circuit breaker/i);

const cal={errors:[]};
for(let i=0;i<70;i++){
  const current=200000+i*200;
  const forecast=current*1.02;
  const actual=current*1.006;
  cal.errors.push({date:`2026-06-${String((i%28)+1).padStart(2,'0')}`,current,forecast,actual,logError:Math.log(actual/forecast),absoluteErrorPct:Math.abs(actual/forecast-1)*100});
}
const raw={current:220000,forecast:224400};
const guard=liveForecastGuard(cal,raw);
assert.ok(guard.enabled,'live guard should activate on persistent overreaction');
assert.ok(guard.forecast<raw.forecast&&guard.forecast>=raw.current,'guard should shrink, not invert, a positive move');

const good=history.slice(-120).map((x,i,a)=>({date:x.date,open:x.close*.999,low:x.close*.995,high:x.close*1.005,close:x.close}));
assert.equal(validateHistorySeries(good,{minRows:55,maxLagDays:400,now:new Date('2026-09-01T12:00:00Z')}).ok,true);
const bad=good.map(x=>({...x}));bad[70].close*=10;
assert.equal(validateHistorySeries(bad,{minRows:55,maxLagDays:400,now:new Date('2026-09-01T12:00:00Z')}).reason,'implausible-unit-jump');
console.log('v6-hardening ok',guard.mode,guard.scale);
