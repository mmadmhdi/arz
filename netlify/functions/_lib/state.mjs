import {getStore} from '@netlify/blobs';
export {metaAdjustment,dataFreshness,deriveIntradayFeatures,metaFeatureVector,deriveSignalScales,liveForecastGuard} from './state-logic.mjs';
// Stable namespace: never include the application version here. Model upgrades must
// keep their historical forecasts, calibration rows and audit trail.
export const STORE='tmrw-usd-production';
export const store=()=>getStore({name:STORE,consistency:'strong'});
export async function getJSON(key,consistency='strong'){return store().get(key,{type:'json',consistency})}
export async function setJSON(key,value,options={}){return store().setJSON(key,value,options)}
