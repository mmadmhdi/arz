import {fetchTGJUHistory} from '../netlify/functions/_lib/sources.mjs';
import {buildForecast} from '../netlify/functions/_lib/forecast-engine.mjs';

const history=await fetchTGJUHistory('price_dollar_rl');
const f=buildForecast({history,news:{score:0},macro:{score:0},now:new Date()});
const b=f.model.backtest;
const out={
  asOf:history.at(-1)?.date,
  historyRows:history.length,
  modelVersion:f.model.version,
  regime:b.regime,
  nestedSamples:b.ensemble.samples,
  ensembleMAPEPercent:b.ensemble.mape*100,
  naiveMAPEPercent:b.naive.mape*100,
  skillVsNaive:b.skillVsNaive,
  recent30Skill:b.recent30?.skill??null,
  directionAccuracy:b.ensemble.direction,
  modelWeights:f.model.weights
};
console.log(JSON.stringify(out,null,2));
if(b.ensemble.samples<28)process.exitCode=2;
if(b.skillVsNaive<.90)process.exitCode=3;
