// Publication historical artifact program: retained for review, inputs not distributed.
throw Error('HISTORICAL_ARTIFACTS_REQUIRE_REVIEWED_PORTABLE_MANIFEST: see publication/historical-requirements.json; original paths are never followed');
// Independent audit: synthetic only. No product, private, model, browser or network access.
// Plan fixed before this control's first run: exact grids below, no stochastic seed search.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {bootstrapRatio, bootstrapPairedDifference, clusterRatioSensitivity, analyze, auditInput} from '../src/analysis-v04.mjs';
const start=performance.now(), startedAt=new Date().toISOString();
const checks=[];
function check(name,fn){const detail=fn();checks.push({name,passed:true,detail:detail??null});}
const near=(x,y,t=1e-12)=>assert.ok(Math.abs(x-y)<=t,`${x} != ${y}`);
function binomial(n,p){if(p===0)return Array.from({length:n+1},(_,i)=>+(i===0));if(p===1)return Array.from({length:n+1},(_,i)=>+(i===n));const a=[(1-p)**n];for(let k=1;k<=n;k++)a[k]=a[k-1]*(n-k+1)/k*p/(1-p);return a;}
function discreteQuantile(mass,p){let s=0;for(let k=0;k<mass.length;k++){s+=mass[k];if(s>=p)return k;}return mass.length-1;}
function refHoeffding(w,a,k,L,alpha=.05){const x=w/(k*L),y=a/(k*L),e=Math.sqrt(Math.log(4/alpha)/(2*k));return [Math.max(0,x-e)/Math.min(1,y+e),y>e?Math.min(1,(x+e)/(y-e)):1];}
function inside(ci,t){return ci!==null&&ci[0]<=t+1e-14&&ci[1]>=t-1e-14;}
function wilson(k,n,z=1.959963984540054){const p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [c-h,c+h];}
const inputs=['plans/statistical-analysis-v1.md','src/analysis-v04.mjs','tests/analysis-v04.test.mjs','results/analysis-v04-simulation-v1-productionB.json','results/analysis-v04-final-verification-v1.json','public-contracts/sampling-framework.md','plans/protocol-v04.md'];
const inputHashes=inputs.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const verification=JSON.parse(readFileSync(inputs[4],'utf8'));
check('Candidate code, tests and simulation hashes match author final receipt',()=>{for(const p of [inputs[1],inputs[2],inputs[3]])assert.equal(inputHashes.find(x=>x.path===p).sha256,verification.inputHashes.find(x=>x.path===p).sha256);});
const receipt=JSON.parse(readFileSync(inputs[3],'utf8'));
const mc=receipt.scenarios.flatMap(s=>['bootstrap','secondary'].filter(f=>s[f]?.reported).map(f=>{const a=s[f];return {scenario:s.name,endpoint:f,covered:a.covered,reported:a.reported,total:s.replicates,conditional:a.covered/a.reported,unconditionalCovered:a.covered/s.replicates,wilson95AcrossSyntheticDatasets:wilson(a.covered,a.reported)};}));
const nominalMass=binomial(600,.95);
const nominal99PredictionCounts=[discreteQuantile(nominalMass,.005),discreteQuantile(nominalMass,.995)];
check('Independent simulation arithmetic, not a coverage certification',()=>{for(const s of receipt.scenarios){if(!s.bootstrap)continue;const a=s.bootstrap;if(a.reported){near(a.conditionalCoverage,a.covered/a.reported);near(a.monteCarloSE,Math.sqrt((a.covered/a.reported)*(1-a.covered/a.reported)/a.reported));}near(a.unconditionalCoveredFraction,a.covered/600);}return {nominal99PredictionCounts,allSuccess600OneSided95Lower:Math.pow(.05,1/600)};});
// Ideal infinite-B percentile intervals on iid Bernoulli CLUSTERS; not task-binomial inference.
const exactBootstrap=[];
for(const p of [.2,.15,.005,.7]){const k=48, sampling=binomial(k,p);let coverage=0,reported=0;for(let x=1;x<k;x++){const m=binomial(k,x/k),ci=[discreteQuantile(m,.025)/k,discreteQuantile(m,.975)/k];reported+=sampling[x];if(inside(ci,p))coverage+=sampling[x];}exactBootstrap.push({clusterCount:k,p,method:'ideal infinite-B percentile; suppress constant empirical distribution',reportedProbability:reported,unconditionalCoverage:coverage,conditionalCoverage:coverage/reported,zeroEventProbability:sampling[0]});}
check('Exact Bernoulli cluster calculation exposes persistent bootstrap limitations',()=>{assert.ok(exactBootstrap.find(x=>x.p===.2).unconditionalCoverage<.95);assert.ok(exactBootstrap.find(x=>x.p===.005).unconditionalCoverage<.25);return exactBootstrap;});
// Exhaust all three-state counts: nonaccept / accepted-correct / accepted-wrong.
// Independent cluster law P(A=1)=q, P(W=1|A=1)=r; population ratio r when q>0.
const exactRatio=[];
for(const k of [1,8,20,48,96])for(const q of [.005,.05,.2,1])for(const r of [0,.2,1]){
 let mass=0,coverage=0,originalCoverage=0;const am=binomial(k,q);
 for(let a=0;a<=k;a++){const wm=binomial(a,r);for(let w=0;w<=a;w++){const prob=am[a]*wm[w],ci=refHoeffding(w,a,k,1);mass+=prob;if(inside(ci,r)){coverage+=prob;if(a>0)originalCoverage+=prob;}}}
 near(mass,1,2e-12);assert.ok(coverage>=.95-1e-12);
 exactRatio.push({k,q,r,coverageWithNoAcceptancePopulationCI:[coverage],originalNullSuppressionCoverage:originalCoverage,noAcceptanceProbability:am[0]});
}
check('60 exact multinomial grid laws: proposed complete Hoeffding population procedure covers',()=>({laws:exactRatio.length,minimumCoverage:Math.min(...exactRatio.map(x=>x.coverageWithNoAcceptancePopulationCI[0]))}));
check('Critical counterexample: observed A=0 does not imply population ratio undefined',()=>{const c=exactRatio.find(x=>x.k===48&&x.q===.005&&x.r===1);const current=clusterRatioSensitivity(Array.from({length:48},()=>({n:0,d:0})),1);assert.equal(current.interval,null);assert.ok(c.originalNullSuppressionCoverage<.22);return c;});
check('Independent direct formula matches candidate finite bound for every count',()=>{let n=0;for(const k of [1,8,20,48,96])for(let a=1;a<=k;a++)for(let w=0;w<=a;w++){const rows=Array.from({length:k},(_,i)=>({n:+(i<w),d:+(i<a)}));const candidate=clusterRatioSensitivity(rows,1).interval,expected=refHoeffding(w,a,k,1);near(candidate[0],expected[0]);near(candidate[1],expected[1]);n++;}return {countPairs:n};});
check('Mathematical assumptions matter: perfect cross-cluster dependence fails',()=>{const k=96,p=.2;const zero=refHoeffding(0,k,k,1),one=refHoeffding(k,k,k,1);const coverage=(1-p)*+inside(zero,p)+p*+inside(one,p);assert.equal(coverage,0);return {k,p,allZero:zero,allOne:one,coverage,meaning:'All rows share one Bernoulli latent; 96 labels are not 96 independent clusters.'};});
check('Fixed L and zero-event finite bounds',()=>{const rows=Array.from({length:96},()=>({n:0,d:8}));const ci=clusterRatioSensitivity(rows,8).interval;assert.ok(ci[1]>0);assert.throws(()=>clusterRatioSensitivity([{n:0,d:9}],8));return {K96L8ZeroWAllAccepted:ci,K48Epsilon:Math.sqrt(Math.log(80)/96),K96Epsilon:Math.sqrt(Math.log(80)/192),formalSPHalfWidth:Math.sqrt(Math.log(40)/192),formalPairedSPHalfWidth:Math.sqrt(2*Math.log(40)/96)};});
// Independent expanded-slot reference: paired cluster draws reused for BOTH methods.
function rngReference(seed){let state=seed>>>0;return()=>{state=(state+1831565813)>>>0;let v=Math.imul(state^(state>>>15),state|1);v=v^(v+Math.imul(v^(v>>>7),v|61));return ((v^(v>>>14))>>>0)/4294967296;};}
function qLinear(x,p){const h=(x.length-1)*p,i=Math.floor(h);return x[i]+(x[Math.ceil(h)]-x[i])*(h-i);}
check('Paired 9999-draw expanded-slot reference preserves informative family sizes',()=>{
 const rows=Array.from({length:24},(_,i)=>{const d=1+(i%6);return [i%(d+1),d,(i*3+1)%(d+1),d];});
 const expanded=rows.map(([a,d,b,e])=>[Array.from({length:d},(_,j)=>+(j<a)),Array.from({length:e},(_,j)=>+(j<b))]);
 const random=rngReference(67379238),draws=[];
 for(let b=0;b<9999;b++){let an=0,ad=0,bn=0,bd=0;for(let j=0;j<24;j++){const [a,c]=expanded[Math.floor(random()*24)];an+=a.reduce((x,y)=>x+y,0);ad+=a.length;bn+=c.reduce((x,y)=>x+y,0);bd+=c.length;}draws.push(an/ad-bn/bd);}draws.sort((a,b)=>a-b);
 const expected=[qLinear(draws,.025),qLinear(draws,.975)],actual=bootstrapPairedDifference(rows,{seed:67379238,replicates:9999});assert.deepEqual(actual.interval,expected);
 const identical=bootstrapPairedDifference(rows.map(r=>[r[0],r[1],r[0],r[1]]),{seed:67379238,replicates:9999});assert.equal(identical.interval,null);assert.equal(identical.point,0);
 return {interval:actual.interval,point:actual.point,replicates:9999,seed:67379238};
});
function ledger(){const methods=['FULL','SCOPE_OFF','PROVENANCE_OFF','LLM_ONESHOT'],briefs=Array.from({length:7},(_,i)=>({briefId:`audit-${i}`,clusterId:i===0?'small':'large'})),configs=['a','b'],tasks=['t0','t1','t2','t3'],binding={evaluationSchema:'audit-synthetic-1',normalizerVersion:'audit-synthetic-1'};const records=[];for(let i=0;i<7;i++)for(const configId of configs)for(const taskId of tasks)for(const method of methods){const cl=i===0?'W':'S',o=()=>({confirmedViolation:cl==='W',unknown:false,allRequiredPassed:cl==='S',binding:{...binding,evidenceHash:'e'.repeat(64),classification:cl}});records.push({briefId:briefs[i].briefId,configId,taskId,method,eligibility:{R:'eligible',G:'eligible'},preparation:'ready',proposal:{status:'accepted',candidateHash:'a'.repeat(64),scopeGuardRejected:false,invoked:true,acceptanceLocked:true},outcomes:{R:o(),G:o()},costEventIds:[]});}return {schemaVersion:'analysis-v04-input-1',datasetId:'audit-synthetic-only',datasetKind:'dev',design:{briefs,configs,tasks,methods,maxBriefsPerCluster:6,independence:{status:'verified',basis:'synthetic only'}},evaluationBinding:binding,records,costEvents:[]};}
check('Independent synthetic ledger: brief weights are not family equal weights',()=>{const a=analyze(ledger());assert.equal(a.audit.valid,true);near(a.endpoints.R.methods.FULL.rates.S_over_P,6/7);near(a.endpoints.R.methods.FULL.equalBrief.S_over_P.point,6/7);assert.notEqual(a.endpoints.R.methods.FULL.equalBrief.S_over_P.point,.5);assert.equal(a.costs.inputTokens.total,null);return {briefWeighted:6/7,familyEqual:.5,clusters:a.audit.clusterCount};});
check('Independent missing and nonignorable UA checks, no selective denominator removal',()=>{const x=ledger(),r=x.records[0];r.outcomes.R={confirmedViolation:false,unknown:true,allRequiredPassed:false,binding:{...x.evaluationBinding,evidenceHash:'f'.repeat(64),classification:'U_A'}};let a=analyze(x).endpoints.R.methods.FULL;assert.equal(a.counts.A,56);assert.equal(a.counts.U_A,1);assert.equal(a.counts.W,7);near(a.riskIdentification.confirmedLower,7/56);near(a.riskIdentification.possibleUpper,8/56);x.records.pop();assert.equal(auditInput(x).valid,false);assert.equal(analyze(x).endpoints,null);return {A:56,W:7,UA:1,observedFiniteCheckIdentification:[7/56,8/56]};});
const invalidAlpha=[];for(const alpha of [0,1,-.1,NaN]){try{const r=clusterRatioSensitivity([{n:0,d:1}],1,alpha);invalidAlpha.push({alpha:String(alpha),threw:false,interval:r.interval.map(String)});}catch(e){invalidAlpha.push({alpha:String(alpha),threw:true,message:e.message});}}
const endedAt=new Date().toISOString();
const output={kind:'independent-statistical-audit-synthetic-exact-controls',version:1,passed:checks.every(x=>x.passed),inputHashes,checks,exactBootstrap,exactRatio,monteCarloRecalculation:mc,nominal99PredictionCounts,invalidAlphaDiagnostic:invalidAlpha,execution:{startedAt,endedAt,wallSeconds:(performance.now()-start)/1000,activeHumanSeconds:null,authoringModelAttempts:null,inputTokens:null,outputTokens:null,money:null,experimentModelApiAttempts:0,browserRuns:0},limitations:['No private or product files read. No future data. No natural models or browser run.','Exact Bernoulli counts are synthetic independent CLUSTERS, never task-binomial confidence intervals.','Ideal infinite-B bootstrap is not identical to finite-B linear-interpolation implementation; expanded reference separately checks B9999.','Grid exact coverage is model-specific corroboration, not a universal proof. Report provides the Hoeffding proof and necessary assumptions.','Existing simulation inspection is retrospective; no tolerance is retroactively called preregistered.']};
writeFileSync('results/statistical-audit-v1-controls.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:output.passed,checks:checks.length,exactBootstrap,nominal99PredictionCounts,wallSeconds:output.execution.wallSeconds},null,2));