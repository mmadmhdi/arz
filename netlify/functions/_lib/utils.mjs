export const EPS=1e-12;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
export const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
export const weightedMean=(a,w)=>{let n=0,d=0;for(let i=0;i<a.length;i++){if(Number.isFinite(a[i])&&Number.isFinite(w[i])&&w[i]>0){n+=a[i]*w[i];d+=w[i]}}return d?n/d:0};
export const weightedQuantile=(a,w,q=.5)=>{const rows=a.map((v,i)=>({v,w:w?.[i]??1})).filter(x=>Number.isFinite(x.v)&&Number.isFinite(x.w)&&x.w>0).sort((x,y)=>x.v-y.v);if(!rows.length)return 0;const total=rows.reduce((s,x)=>s+x.w,0),target=clamp(q,0,1)*total;let acc=0;for(const row of rows){acc+=row.w;if(acc>=target)return row.v}return rows.at(-1).v};
export const weightedMedian=(a,w)=>weightedQuantile(a,w,.5);
export const std=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
export const quantile=(a,q)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),p=(s.length-1)*q,i=Math.floor(p),f=p-i;return s[i]+(s[Math.min(i+1,s.length-1)]-s[i])*f};
export const mad=a=>{if(!a.length)return 0;const m=median(a);return median(a.map(x=>Math.abs(x-m)))};
export const ema=(values,period)=>{if(!values.length)return 0;const k=2/(period+1);let e=values[0];for(let i=1;i<values.length;i++)e=values[i]*k+e*(1-k);return e};
export const returns=values=>{const r=[];for(let i=1;i<values.length;i++)if(values[i]>0&&values[i-1]>0)r.push(Math.log(values[i]/values[i-1]));return r};
export const rsi=(values,period=14)=>{if(values.length<period+1)return 50;let g=0,l=0;for(let i=values.length-period;i<values.length;i++){const d=values[i]-values[i-1];if(d>=0)g+=d;else l-=d}if(!l)return 100;const rs=(g/period)/(l/period);return 100-100/(1+rs)};
export const tehranDate=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const nextTehranDate=(d=new Date())=>{const [y,m,day]=tehranDate(d).split('-').map(Number),n=new Date(Date.UTC(y,m-1,day)+86400000);return n.toISOString().slice(0,10)};
export const hoursOld=(iso,now=new Date())=>{const t=new Date(iso||0).getTime();return Number.isFinite(t)?Math.max(0,(now.getTime()-t)/3600000):Infinity};
export const isoDayUTC=ts=>new Date(ts).toISOString().slice(0,10);
const DIGITS={'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
export const normalizeDigits=v=>String(v??'').replace(/[۰-۹٠-٩]/g,d=>DIGITS[d]).replace(/[٬،]/g,',').replace(/٫/g,'.');
export const safeNum=v=>{const s=normalizeDigits(v).replace(/[^0-9.\-]/g,'');const n=Number(s);return Number.isFinite(n)?n:NaN};
export const stripHtml=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
export function solveLinear(A,b){const n=b.length,M=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;[M[i],M[p]]=[M[p],M[i]];const d=M[i][i];if(Math.abs(d)<1e-10)return null;for(let k=i;k<=n;k++)M[i][k]/=d;for(let j=0;j<n;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k]}}return M.map(r=>r[n])}
export function ridgePredict(X,y,x,lambda=2.0){if(X.length<8)return 0;const p=X[0].length,mu=Array(p).fill(0),sd=Array(p).fill(1);for(let j=0;j<p;j++){const c=X.map(r=>r[j]);mu[j]=mean(c);sd[j]=std(c)||1}const Z=X.map(r=>[1,...r.map((v,j)=>(v-mu[j])/sd[j])]);const zx=[1,...x.map((v,j)=>(v-mu[j])/sd[j])];const k=p+1,ATA=Array.from({length:k},()=>Array(k).fill(0)),ATy=Array(k).fill(0);for(let i=0;i<Z.length;i++)for(let a=0;a<k;a++){ATy[a]+=Z[i][a]*y[i];for(let c=0;c<k;c++)ATA[a][c]+=Z[i][a]*Z[i][c]}for(let j=1;j<k;j++)ATA[j][j]+=lambda;const beta=solveLinear(ATA,ATy);if(!beta)return mean(y);return beta.reduce((s,v,j)=>s+v*zx[j],0)}
