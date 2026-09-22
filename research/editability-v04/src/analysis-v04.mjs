/** Independent record-only analysis. No method/runtime/observer imports, network or secrets. */
export const POLICY = Object.freeze({
  version: 'statistical-analysis-v1', bootstrapReplicates: 9999, seed: 67379238,
  alpha: 0.05, minimumClusters: 20, minimumAccepted: 20, minimumAcceptedClusters: 10,
  simulationSeed: 1374772973, simulationReplicates: 600, simulationBootstrapReplicates: 9999
});
export const METHODS = ['FULL', 'SCOPE_OFF', 'PROVENANCE_OFF', 'LLM_ONESHOT'];
const ENDPOINTS = ['R', 'G'];
const ELIGIBILITY = ['eligible', 'originalIneligible', 'eligibilityUnresolved', 'upstreamMissing', 'notScreened'];
const PROPOSALS = ['accepted', 'methodRejection', 'publicProtocolRejection', 'methodError', 'notExecuted'];
const COUNT_NAMES = ['P','E','Q','A','S','W','U_A','originalIneligible','eligibilityUnresolved','upstreamMissing','notScreened','preparationFailure','preparationNotExecuted','rejection','methodError','proposalNotExecuted','methodRejection','publicProtocolRejection'];
const RATE_PAIRS = {S_over_P:['S','P'], S_over_E:['S','E'], Q_over_E:['Q','E'], A_over_E:['A','E'], W_over_A:['W','A'], U_A_over_A:['U_A','A'], rejection_over_Q:['rejection','Q']};
const key = (...values) => JSON.stringify(values);
const ratio = (n,d) => d > 0 ? n/d : null;
const finiteNonnegative = n => Number.isFinite(n) && n >= 0;
const blank = () => Object.fromEntries(COUNT_NAMES.map(n => [n,0]));
const add = (a,b) => { for (const n of COUNT_NAMES) a[n] += b[n]; return a; };
const sum = rows => rows.reduce(add, blank());
const rates = c => Object.fromEntries(Object.entries(RATE_PAIRS).map(([n,[x,d]]) => [n,ratio(c[x],c[d])]));
export function prng(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('uint32 seed required');
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function derivedSeed(label, seed=POLICY.seed) { let h=seed>>>0; for(const c of label) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; return h; }
function quantile(sorted,p) { const i=(sorted.length-1)*p, lo=Math.floor(i); return sorted[lo]+(sorted[Math.ceil(i)]-sorted[lo])*(i-lo); }
export function assertClosure(c) {
  for (const n of COUNT_NAMES) if (!Number.isSafeInteger(c[n]) || c[n]<0) throw new Error(`invalid count ${n}`);
  if(c.P!==c.E+c.originalIneligible+c.eligibilityUnresolved+c.upstreamMissing+c.notScreened || c.E!==c.Q+c.preparationFailure+c.preparationNotExecuted || c.Q!==c.A+c.rejection+c.methodError+c.proposalNotExecuted || c.A!==c.S+c.W+c.U_A || c.rejection!==c.methodRejection+c.publicProtocolRejection) throw new Error('funnel does not close');
  return true;
}
export function classifyOutcome(outcome) {
  if (!outcome || ['confirmedViolation','unknown','allRequiredPassed'].some(n=>typeof outcome[n]!=='boolean')) throw new Error('explicit outcome booleans required');
  if (outcome.allRequiredPassed && (outcome.confirmedViolation || outcome.unknown)) throw new Error('contradictory outcome');
  if (outcome.confirmedViolation) return 'W';
  if (outcome.unknown) return 'U_A';
  if (outcome.allRequiredPassed) return 'S';
  throw new Error('outcome has no exhaustive classification');
}
function recordCounts(r,endpoint) {
  const c=blank(); c.P=1;
  const e=r.eligibility[endpoint];
  if(e!=='eligible') { c[e]=1; return c; }
  c.E=1;
  if(r.preparation!=='ready') { c[r.preparation==='failure'?'preparationFailure':'preparationNotExecuted']=1; return c; }
  c.Q=1;
  const p=r.proposal.status;
  if(p==='accepted') { c.A=1; c[classifyOutcome(r.outcomes[endpoint])]=1; }
  else if(p==='methodRejection'||p==='publicProtocolRejection') { c.rejection=1; c[p]=1; }
  else c[p==='notExecuted'?'proposalNotExecuted':'methodError']=1;
  assertClosure(c); return c;
}
function costAudit(events) {
  const errors=[], ids=new Set();
  const numbers=['wallSeconds','activeHumanSeconds','cpuSeconds','peakMemoryBytes','experimentApiAttempts','authoringModelAttempts','inputTokens','outputTokens','cachedInputTokens'];
  for(const e of events) {
    if(!e || typeof e.eventId!=='string' || ids.has(e.eventId)) {errors.push('invalid/duplicate cost eventId');continue;}
    ids.add(e.eventId);
    for(const n of numbers) if(e[n]!==null && !finiteNonnegative(e[n])) errors.push(`${e.eventId}: invalid/absent ${n}`);
    if(e.activeHumanSeconds!==null && e.timeBasis!=='direct-active-timer') errors.push(`${e.eventId}: human time without direct timer`);
    if(e.cachedInputTokens!==null && e.inputTokens!==null && e.cachedInputTokens>e.inputTokens) errors.push(`${e.eventId}: cached exceeds input`);
    if(!e.money || (e.money.amount!==null && !finiteNonnegative(e.money.amount))) errors.push(`${e.eventId}: invalid money`);
    const start=Date.parse(e.startedAt), end=Date.parse(e.endedAt);
    if(e.startedAt!==null && !Number.isFinite(start)) errors.push(`${e.eventId}: invalid start`);
    if(e.endedAt!==null && !Number.isFinite(end)) errors.push(`${e.eventId}: invalid end`);
    if(Number.isFinite(start)&&Number.isFinite(end)&&(end<start || e.wallSeconds===null || Math.abs(e.wallSeconds-(end-start)/1000)>0.001)) errors.push(`${e.eventId}: wall window mismatch`);
    if(e.wallSeconds!==null && (!Number.isFinite(start)||!Number.isFinite(end))) errors.push(`${e.eventId}: wall without observable window`);
  }
  for(const e of events) {
    if(e.parentEventId!==null && !ids.has(e.parentEventId)) errors.push(`${e.eventId}: absent parent event`);
    const seen=new Set([e.eventId]); let p=e.parentEventId;
    while(p!==null && ids.has(p)) {if(seen.has(p)){errors.push(`${e.eventId}: nested cost cycle`);break;} seen.add(p);p=events.find(x=>x.eventId===p).parentEventId;}
  }
  return errors;
}
export function auditInput(input) {
  try { return auditInputUnchecked(input); }
  catch (error) { return {valid:false,errors:[`malformed input: ${error.message}`],missing:[],duplicates:[],unexpected:[],notInvoked:[]}; }
}
function auditInputUnchecked(input) {
  const errors=[], missing=[], duplicates=[], unexpected=[], notInvoked=[];
  const fail = message => ({valid:false, errors:[message], missing, duplicates, unexpected, notInvoked});
  if(!input || input.schemaVersion!=='analysis-v04-input-1') return fail('wrong input schemaVersion');
  if(!['dev','pilot','formal'].includes(input.datasetKind) || typeof input.datasetId!=='string' || !input.datasetId) return fail('dataset identity required; no pooled kinds');
  if(!input.evaluationBinding || typeof input.evaluationBinding.evaluationSchema!=='string' || !input.evaluationBinding.evaluationSchema || typeof input.evaluationBinding.normalizerVersion!=='string' || !input.evaluationBinding.normalizerVersion) return fail('frozen evaluation schema/independent normalizer binding required');
  const d=input.design;
  if(!d || !Array.isArray(d.briefs)||!Array.isArray(d.configs)||!Array.isArray(d.tasks)||!Array.isArray(d.methods)||!Array.isArray(input.records)||!Array.isArray(input.costEvents)) return fail('design arrays, records and costEvents required');
  if(!d.briefs.length||d.configs.length!==2||d.tasks.length!==4||key([...d.methods].sort())!==key([...METHODS].sort())) errors.push('requires nonempty briefs, two configurations, four tasks and four core methods');
  for(const [name,arr] of [['briefs',d.briefs.map(x=>x.briefId)],['configs',d.configs],['tasks',d.tasks],['methods',d.methods]]) if(arr.some(x=>typeof x!=='string'||!x)||new Set(arr).size!==arr.length) errors.push(`invalid/duplicate design ${name}`);
  if(d.briefs.some(x=>typeof x.clusterId!=='string'||!x.clusterId)) errors.push('highest dependency clusterId required for every brief');
  if(!d.independence || !['verified','unverified'].includes(d.independence.status) || typeof d.independence.basis!=='string') errors.push('independence status and pre-outcome evidence basis required');
  if(!Number.isSafeInteger(d.maxBriefsPerCluster)||d.maxBriefsPerCluster<1) errors.push('pre-outcome sampling-frame maxBriefsPerCluster required');
  const familySizes=new Map(); for(const b of d.briefs) familySizes.set(b.clusterId,(familySizes.get(b.clusterId)||0)+1);
  if([...familySizes.values()].some(n=>n>d.maxBriefsPerCluster)) errors.push('observed family exceeds frozen frame bound');
  if(input.datasetKind==='formal' && (d.briefs.length!==96 || familySizes.size!==96 || d.independence?.status!=='verified')) errors.push('formal deferred: sampling framework requires 96 independently verified requirement units, not 96 dependent labels');
  const expected=new Set(); for(const b of d.briefs)for(const c of d.configs)for(const t of d.tasks)for(const m of d.methods)expected.add(key(b.briefId,c,t,m));
  const found=new Map(), shared=new Map();
  for(const r of input.records) {
    if(!r || typeof r!=='object'){errors.push('invalid record');continue;}
    const k=key(r.briefId,r.configId,r.taskId,r.method);
    if(!expected.has(k)) unexpected.push(k);
    if(found.has(k)) duplicates.push(k); else found.set(k,r);
    if(!r.eligibility||ENDPOINTS.some(e=>!ELIGIBILITY.includes(r.eligibility[e]))) {errors.push(`${k}: invalid eligibility`);continue;}
    if(!['ready','failure','notExecuted'].includes(r.preparation)) errors.push(`${k}: invalid preparation`);
    const union=ENDPOINTS.some(e=>r.eligibility[e]==='eligible');
    const p=r.proposal;
    if(!p||!PROPOSALS.includes(p.status)||typeof p.invoked!=='boolean'||typeof p.acceptanceLocked!=='boolean'||typeof p.scopeGuardRejected!=='boolean') {errors.push(`${k}: invalid proposal`);continue;}
    if(p.candidateHash!==null && (typeof p.candidateHash!=='string'||!/^[a-f0-9]{64}$/i.test(p.candidateHash))) errors.push(`${k}: candidateHash must be SHA256 or explicit null`);
    if(!p.invoked) notInvoked.push(k);
    if((!union || r.preparation!=='ready') && p.status!=='notExecuted') errors.push(`${k}: proposal despite unavailable preparation/eligibility`);
    if(p.status==='notExecuted' && p.invoked) errors.push(`${k}: notExecuted marked invoked`);
    if(p.status!=='notExecuted' && !p.invoked) errors.push(`${k}: terminal proposal lacks invocation`);
    if(p.status==='accepted' && (!p.acceptanceLocked || p.candidateHash===null)) errors.push(`${k}: acceptance not locked or candidate absent`);
    if(p.status!=='accepted' && p.acceptanceLocked) errors.push(`${k}: nonaccepted acceptance lock`);
    if(p.scopeGuardRejected && (r.method!=='FULL'||p.status!=='methodRejection'||p.candidateHash===null)) errors.push(`${k}: inconsistent scope guard refusal`);
    if(!r.outcomes) errors.push(`${k}: explicit R/G outcomes required`);
    else for(const e of ENDPOINTS) {
      if(p.status==='accepted'&&r.eligibility[e]==='eligible') {
        try {
          const classification=classifyOutcome(r.outcomes[e]), binding=r.outcomes[e].binding;
          if(!binding || binding.evaluationSchema!==input.evaluationBinding.evaluationSchema || binding.normalizerVersion!==input.evaluationBinding.normalizerVersion || binding.classification!==classification || !/^[a-f0-9]{64}$/i.test(binding.evidenceHash||'')) errors.push(`${k}/${e}: missing/mismatched immutable raw evaluation binding`);
        } catch(err) { errors.push(`${k}/${e}: ${err.message}`); }
      }
      else if(r.outcomes[e]!==null) errors.push(`${k}/${e}: nonaccepted/ineligible outcome must be null`);
    }
    if(!Array.isArray(r.costEventIds)||new Set(r.costEventIds).size!==r.costEventIds.length) errors.push(`${k}: costEventIds array required, no duplicates`);
    const sk=key(r.briefId,r.configId,r.taskId), signature=key(r.eligibility.R,r.eligibility.G,r.preparation);
    if(shared.has(sk)&&shared.get(sk)!==signature) errors.push(`${sk}: eligibility/public preparation differ across methods`); else shared.set(sk,signature);
  }
  for(const k of expected) if(!found.has(k)) missing.push(k);
  for(const k of expected) {
    const [b,c,t,m]=JSON.parse(k); if(m!=='FULL')continue;
    const a=found.get(k), z=found.get(key(b,c,t,'SCOPE_OFF'));
    if(a?.proposal?.candidateHash && z?.proposal?.candidateHash && a.proposal.candidateHash!==z.proposal.candidateHash) errors.push(`${key(b,c,t)}: FULL/SCOPE_OFF candidate mismatch`);
  }
  errors.push(...costAudit(input.costEvents));
  const costIds=new Set(input.costEvents.map(e=>e.eventId));
  for(const r of input.records) for(const id of r?.costEventIds||[]) if(!costIds.has(id)) errors.push('record refers to absent cost event '+id);
  if(missing.length)errors.push('missing planned records; never impute success or silently drop');
  if(duplicates.length)errors.push('duplicate planned records; never choose best/latest');
  if(unexpected.length)errors.push('unexpected records outside frozen design');
  return {valid:errors.length===0,errors,missing,duplicates,unexpected,notInvoked,plannedSlots:expected.size,receivedRecords:input.records.length,distinctRecords:found.size,briefCount:d.briefs.length,clusterCount:familySizes.size};
}
/** Percentile pairs cluster bootstrap. Rows are highest independent units, never tasks. */
export function bootstrapRatio(rows, {seed=POLICY.seed, replicates=POLICY.bootstrapReplicates, alpha=POLICY.alpha, minimumClusters=POLICY.minimumClusters, risk=false, independenceVerified=true}={}) {
  if(!Number.isSafeInteger(replicates)||replicates<100) throw new Error('at least 100 bootstrap replicates');
  if(!(alpha>0&&alpha<1))throw new Error('invalid alpha');
  if(rows.some(r=>!finiteNonnegative(r.n)||!finiteNonnegative(r.d)||r.n>r.d))throw new Error('bounded count ratio rows required');
  const n=rows.reduce((s,r)=>s+r.n,0), d=rows.reduce((s,r)=>s+r.d,0), point=ratio(n,d), acceptedClusters=rows.filter(r=>r.d>0).length;
  const result={point,interval:null,status:'ok',replicates,seed,alpha,clusterCount:rows.length,denominator:d,contributingClusters:acceptedClusters,undefinedReplicates:0};
  if(!d)return {...result,status:'no-information-zero-denominator'};
  if(!independenceVerified)return {...result,status:'independence-unverified-descriptive-only'};
  if(rows.length<minimumClusters || (risk&&(d<POLICY.minimumAccepted||acceptedClusters<POLICY.minimumAcceptedClusters)))return {...result,status:'small-effective-denominator'};
  const random=prng(seed), draws=[];
  for(let b=0;b<replicates;b++){let sn=0,sd=0;for(let j=0;j<rows.length;j++){const r=rows[Math.floor(random()*rows.length)];sn+=r.n;sd+=r.d;}if(sd)draws.push(sn/sd);else result.undefinedReplicates++;}
  if(result.undefinedReplicates)return {...result,status:'undefined-resamples-no-interval'};
  draws.sort((a,b)=>a-b);
  if(draws[0]===draws.at(-1))return {...result,status:'degenerate-bootstrap-no-risk-guarantee'};
  result.interval=[quantile(draws,alpha/2),quantile(draws,1-alpha/2)]; return result;
}
export function bootstrapPairedDifference(rows,{seed=POLICY.seed,replicates=POLICY.bootstrapReplicates,alpha=POLICY.alpha,minimumClusters=POLICY.minimumClusters,independenceVerified=true,risk=false}={}) {
  if(!Number.isSafeInteger(replicates)||replicates<100||!(alpha>0&&alpha<1))throw new Error('invalid bootstrap settings');
  if(rows.some(r=>r.length!==4||r.some(x=>!finiteNonnegative(x))||r[0]>r[1]||r[2]>r[3]))throw new Error('bounded paired count rows required');
  const total=rows.reduce((a,r)=>a.map((v,i)=>v+r[i]),[0,0,0,0]);
  const point=total[1]&&total[3]?total[0]/total[1]-total[2]/total[3]:null;
  const out={point,interval:null,status:'ok',seed,replicates,alpha,clusterCount:rows.length,undefinedReplicates:0};
  if(point===null)return {...out,status:'no-information-zero-denominator'};
  if(!independenceVerified)return {...out,status:'independence-unverified-descriptive-only'};
  if(rows.length<minimumClusters || (risk && (total[1]<POLICY.minimumAccepted || total[3]<POLICY.minimumAccepted || rows.filter(r=>r[1]>0).length<POLICY.minimumAcceptedClusters || rows.filter(r=>r[3]>0).length<POLICY.minimumAcceptedClusters)))return {...out,status:'small-effective-denominator'};
  if(risk&&(total[0]===0||total[0]===total[1]||total[2]===0||total[2]===total[3]))return {...out,status:'degenerate-marginal-risk-no-interval'};
  const rng=prng(seed),draws=[];
  for(let b=0;b<replicates;b++){let a=0,d=0,c=0,e=0;for(let j=0;j<rows.length;j++){const r=rows[Math.floor(rng()*rows.length)];a+=r[0];d+=r[1];c+=r[2];e+=r[3];}if(d&&e)draws.push(a/d-c/e);else out.undefinedReplicates++;}
  if(out.undefinedReplicates)return {...out,status:'undefined-resamples-no-interval'};
  draws.sort((a,b)=>a-b);if(draws[0]===draws.at(-1))return {...out,status:'degenerate-bootstrap-no-risk-guarantee'};
  return {...out,interval:[quantile(draws,alpha/2),quantile(draws,1-alpha/2)]};
}
/** Distribution-free ratio-of-expectations sensitivity, NOT a task-binomial bound.
 * Independent clusters, fixed frame bound L, all clusters including A=0 retained.
 * Union of two two-sided Hoeffding bounds; non-identical cluster laws allowed.
 */
export function clusterRatioSensitivity(rows, maxSlotsPerCluster, alpha=POLICY.alpha) {
  if(!Number.isSafeInteger(maxSlotsPerCluster)||maxSlotsPerCluster<1||rows.some(r=>!finiteNonnegative(r.n)||!finiteNonnegative(r.d)||r.n>r.d||r.d>maxSlotsPerCluster))throw new Error('frozen cluster bound violated');
  if(!rows.length||!rows.some(r=>r.d>0))return {interval:null,status:'no-information-zero-denominator'};
  const k=rows.length, x=rows.reduce((s,r)=>s+r.n,0)/(k*maxSlotsPerCluster), y=rows.reduce((s,r)=>s+r.d,0)/(k*maxSlotsPerCluster), e=Math.sqrt(Math.log(4/alpha)/(2*k));
  const lo=Math.max(0,x-e)/Math.min(1,y+e), hi=y>e?Math.min(1,(x+e)/(y-e)):1;
  return {interval:[Math.min(1,lo),hi],status:y>e?'assumption-conditional-conservative':'weak-denominator-upper-uninformative',method:'cluster-Hoeffding-ratio-of-expectations',alpha,clusterCount:k,maxSlotsPerCluster,epsilon:e,assumptions:'independent highest-level clusters; fixed sampling-frame bound; bounded counts; target ratio of cluster mean W to mean A; not task independence, not conditional on observed A; no claim under unknown cross-cluster dependence'};
}
function unionSeconds(events) {
  const intervals=events.filter(e=>e.wallSeconds!==null).map(e=>[Date.parse(e.startedAt),Date.parse(e.endedAt)]).sort((a,b)=>a[0]-b[0]);
  if(!intervals.length)return null;
  let total=0,[s,e]=intervals[0];for(const [a,b] of intervals.slice(1)){if(a>e){total+=e-s;s=a;e=b;}else e=Math.max(e,b);}return (total+e-s)/1000;
}
export function summarizeCosts(events) {
  const audit=costAudit(events);if(audit.length)throw new Error(audit.join('; '));
  const roots=events.filter(e=>e.parentEventId===null);
  const measurement=n=>({total:roots.length&&roots.every(e=>e[n]!==null)?roots.reduce((s,e)=>s+e[n],0):null,knownSubtotal:roots.reduce((s,e)=>s+(e[n]??0),0),unknownEvents:roots.filter(e=>e[n]===null).length});
  const currencies=new Set(roots.filter(e=>e.money.amount!==null).map(e=>e.money.currency));
  return {events:events.length,rootEvents:roots.length,observedWindowUnionSeconds:unionSeconds(events),wallUnknownEvents:events.filter(e=>e.wallSeconds===null).length,activeHumanSeconds:measurement('activeHumanSeconds'),experimentApiAttempts:measurement('experimentApiAttempts'),authoringModelAttempts:measurement('authoringModelAttempts'),inputTokens:measurement('inputTokens'),outputTokens:measurement('outputTokens'),cachedInputTokens:measurement('cachedInputTokens'),money:{total:roots.length&&currencies.size===1&&roots.every(e=>e.money.amount!==null)?roots.reduce((s,e)=>s+e.money.amount,0):null,currency:currencies.size===1?[...currencies][0]:null,unknownEvents:roots.filter(e=>e.money.amount===null).length},limitations:['Observed window union is not active labor, CPU sum or overall project elapsed.','Only root inclusive events are additive; descendants are explanatory, never counted twice.','Input tokens already include cached input; no invented zero for empty or unknown accounts.','Method-linked shared events may appear in several method summaries; do not add method summaries.']};
}
function scopePairs(input,endpoint) {
  const map=new Map(input.records.map(r=>[key(r.briefId,r.configId,r.taskId,r.method),r]));
  const counts={P:0,E:0,preventedW:0,foregoneS:0,unknown:0,unknownAccepted:0,unevaluable:0,noCandidate:0,notGuardDiscordant:0,ineligible:0};
  const perBrief=new Map(input.design.briefs.map(b=>[b.briefId,{P:0,E:0,preventedW:0,foregoneS:0,unknown:0}]));
  for(const b of input.design.briefs)for(const c of input.design.configs)for(const t of input.design.tasks){
    const f=map.get(key(b.briefId,c,t,'FULL')),s=map.get(key(b.briefId,c,t,'SCOPE_OFF')),bc=perBrief.get(b.briefId);counts.P++;bc.P++;
    if(f.eligibility[endpoint]!=='eligible'){counts.ineligible++;continue;}counts.E++;bc.E++;
    if(!f.proposal.candidateHash||!s.proposal.candidateHash){counts.noCandidate++;continue;}
    if(!f.proposal.scopeGuardRejected){counts.notGuardDiscordant++;continue;}
    if(s.proposal.status!=='accepted'){counts.unknown++;counts.unevaluable++;bc.unknown++;continue;}
    const outcome=classifyOutcome(s.outcomes[endpoint]), n=outcome==='W'?'preventedW':outcome==='S'?'foregoneS':'unknown';counts[n]++;bc[n]++;if(n==='unknown')counts.unknownAccepted++;
  }
  const byCluster=new Map();for(const b of input.design.briefs){const c=byCluster.get(b.clusterId)||{P:0,E:0,preventedW:0,foregoneS:0,unknown:0};for(const n of Object.keys(c))c[n]+=perBrief.get(b.briefId)[n];byCluster.set(b.clusterId,c);}
  const inference={};for(const n of ['preventedW','foregoneS','unknown'])for(const d of ['P','E'])inference[`${n}_over_${d}`]=bootstrapRatio([...byCluster.values()].map(c=>({n:c[n],d:c[d]})),{seed:derivedSeed(`${endpoint}/scope/${n}/${d}`),independenceVerified:input.design.independence.status==='verified'});
  return {counts,rates:Object.fromEntries(['preventedW','foregoneS','unknown'].flatMap(n=>['P','E'].map(d=>[`${n}_over_${d}`,ratio(counts[n],counts[d])]))),inference,interpretation:'Same guard-before candidate only. Unknown includes accepted SCOPE_OFF UA or a guard-rejected same candidate that SCOPE_OFF did not accept; those subcounts are separate. Absent candidate is never prevented harm. Operational prevention, not proof FULL repair or general safety.'};
}
export function analyze(input) {
  const audit=auditInput(input);if(!audit.valid)return {analysisVersion:POLICY.version,status:'audit-failed',audit,endpoints:null};
  const d=input.design, verified=d.independence.status==='verified', clusters=[...new Set(d.briefs.map(b=>b.clusterId))].sort(), briefMap=new Map(d.briefs.map(b=>[b.briefId,b]));
  const result={analysisVersion:POLICY.version,status:'descriptive-and-assumption-conditional-inference',datasetId:input.datasetId,datasetKind:input.datasetKind,policy:POLICY,audit,endpoints:{},costs:summarizeCosts(input.costEvents),limitations:['No pooled R/G; no natural effect conclusion from synthetic controls.','Percentile cluster bootstrap is approximate, not certified coverage; frame exchangeability and independent clusters are assumptions.','Records assert acceptance lock and outcome truth; separate independent evidence audit must verify their provenance.']};
  for(const endpoint of ENDPOINTS){
    const reports={}, rowsByMethod={}, briefRowsByMethod={};
    for(const method of METHODS){
      const selected=input.records.filter(r=>r.method===method), clusterCounts=new Map(clusters.map(c=>[c,blank()])),briefCounts=new Map(d.briefs.map(b=>[b.briefId,blank()]));
      for(const r of selected){const c=recordCounts(r,endpoint);add(clusterCounts.get(briefMap.get(r.briefId).clusterId),c);add(briefCounts.get(r.briefId),c);}
      const rows=[...clusterCounts.values()], counts=sum(rows);assertClosure(counts);rowsByMethod[method]=rows;briefRowsByMethod[method]=briefCounts;
      const inference={};for(const [name,[n,den]] of Object.entries(RATE_PAIRS))inference[name]=bootstrapRatio(rows.map(c=>({n:c[n],d:c[den]})),{seed:derivedSeed(`${endpoint}/${method}/${name}`),risk:den==='A',independenceVerified:verified});
      const equalBrief={};for(const den of ['P','E']){const rs=clusters.map(cluster=>{const cs=d.briefs.filter(b=>b.clusterId===cluster).map(b=>briefCounts.get(b.briefId)).filter(c=>c[den]>0);return {n:cs.reduce((s,c)=>s+c.S/c[den],0),d:cs.length};});equalBrief[`S_over_${den}`]=bootstrapRatio(rs,{seed:derivedSeed(`${endpoint}/${method}/equalBrief/${den}`),independenceVerified:verified});}
      const ids=new Set(selected.flatMap(r=>r.costEventIds));
      // Include parent chain so shared/nested accounting remains structurally valid.
      let changed=true;while(changed){changed=false;for(const e of input.costEvents)if(ids.has(e.eventId)&&e.parentEventId!==null&&!ids.has(e.parentEventId)){ids.add(e.parentEventId);changed=true;}}
      reports[method]={counts,rates:rates(counts),inference,equalBrief,diagnostics:{acceptedWithUnknown:selected.filter(r=>r.proposal.status==='accepted'&&r.eligibility[endpoint]==='eligible'&&r.outcomes[endpoint].unknown).length,confirmedWrongWithUnknown:selected.filter(r=>r.proposal.status==='accepted'&&r.eligibility[endpoint]==='eligible'&&r.outcomes[endpoint].confirmedViolation&&r.outcomes[endpoint].unknown).length},acceptedByCluster:clusters.map((cluster,i)=>({clusterId:cluster,A:rows[i].A,W:rows[i].W,U_A:rows[i].U_A})),riskIdentification:{confirmedLower:ratio(counts.W,counts.A),possibleUpper:ratio(counts.W+counts.U_A,counts.A),meaning:'Observed accepted risk partially identified by UA; not a confidence interval.'},riskSensitivity:clusterRatioSensitivity(rows.map(c=>({n:c.W,d:c.A})),d.maxBriefsPerCluster*d.configs.length*d.tasks.length),unknownWorstCaseSensitivity:clusterRatioSensitivity(rows.map(c=>({n:c.W+c.U_A,d:c.A})),d.maxBriefsPerCluster*d.configs.length*d.tasks.length),costs:summarizeCosts(input.costEvents.filter(e=>ids.has(e.eventId)))};
    }
    const contrasts={};for(const other of METHODS.filter(m=>m!=='FULL'))for(const [name,[n,den]] of Object.entries(RATE_PAIRS))contrasts[`FULL_minus_${other}/${name}`]=bootstrapPairedDifference(clusters.map((_,i)=>[rowsByMethod.FULL[i][n],rowsByMethod.FULL[i][den],rowsByMethod[other][i][n],rowsByMethod[other][i][den]]),{seed:derivedSeed(`${endpoint}/contrast/${other}/${name}`),risk:den==='A',independenceVerified:verified});
    const configContrasts={};for(const method of METHODS){const byConfig=d.configs.map(config=>{const map=new Map(clusters.map(c=>[c,blank()]));for(const r of input.records.filter(r=>r.method===method&&r.configId===config))add(map.get(briefMap.get(r.briefId).clusterId),recordCounts(r,endpoint));return [...map.values()];});for(const den of ['P','E'])configContrasts[`${method}/${d.configs[0]}_minus_${d.configs[1]}/S_over_${den}`]=bootstrapPairedDifference(clusters.map((_,i)=>[byConfig[0][i].S,byConfig[0][i][den],byConfig[1][i].S,byConfig[1][i][den]]),{seed:derivedSeed(`${endpoint}/${method}/config/${den}`),independenceVerified:verified});}
    const equalBriefContrasts={};
    for(const other of METHODS.filter(m=>m!=='FULL'))for(const den of ['P','E']){
      const paired=clusters.map(cluster=>{const bs=d.briefs.filter(b=>b.clusterId===cluster&&briefRowsByMethod.FULL.get(b.briefId)[den]>0);return [bs.reduce((s,b)=>s+briefRowsByMethod.FULL.get(b.briefId).S/briefRowsByMethod.FULL.get(b.briefId)[den],0),bs.length,bs.reduce((s,b)=>s+briefRowsByMethod[other].get(b.briefId).S/briefRowsByMethod[other].get(b.briefId)[den],0),bs.length];});
      equalBriefContrasts[`FULL_minus_${other}/S_over_${den}`]=bootstrapPairedDifference(paired,{seed:derivedSeed(`${endpoint}/equalBriefContrast/${other}/${den}`),independenceVerified:verified});
    }
    result.endpoints[endpoint]={methods:reports,contrasts,equalBriefContrasts,configContrasts,scopeAblation:scopePairs(input,endpoint)};
  }
  return result;
}

/** Predeclared synthetic Monte Carlo controls. Never loads research samples. */
export function runSimulationControls({replicates=POLICY.simulationReplicates,bootstrapReplicates=POLICY.simulationBootstrapReplicates,seed=POLICY.simulationSeed}={}) {
  const specifications=[
    {name:'null',truth:0,model:'48 independent clusters; shared latent uniform induces paired covariance; FULL and comparator both Bernoulli(.5); all 8 nested task/config outcomes identical within each method-cluster.'},
    {name:'positiveDependence',truth:0.2,model:'48 independent clusters, each 8 perfectly correlated accepted outcomes; cluster W probability .2. This deliberately violates task independence.'},
    {name:'imbalancedCluster',truth:5/7,model:'48 iid families: sizes 1 or 6 briefs with probability .5; conditional all-success probability .2 or .8 respectively. Informative family size; ratio target (.2+6*.8)/7, not equal-family mean .5; frozen maximum 6 briefs.'},
    {name:'censored',truth:0.15,model:'48 independent clusters, all 8 tasks accepted; same latent cluster uniform gives S=.55, confirmed W=.15, UA=.30. Target confirmed W/A=.15, not latent total wrong risk; worst-case observed bound .45.'},
    {name:'zeroAcceptance',truth:null,model:'48 independent clusters; all proposals refused. W/A undefined, never zero.'},
    {name:'rareZeroEvents',truth:0.005,model:'48 independent clusters with 8 perfectly dependent accepted outcomes, W probability .005. Zero event datasets must not produce [0,0] risk CI.'},
    {name:'dualEndpoint',truth:0.7,secondaryTruth:0.5,model:'Shared cluster U: R all eligible, S iff U<.7; G eligible iff U<.8 and S iff U<.4. Same patch, dependent endpoint masks; separate R S/P=.7 and G S/E=.5.'}
  ];
  const measure=(truth)=>({truth,reported:0,covered:0,widthSum:0,statuses:{}});
  const update=(acc,estimate)=>{acc.statuses[estimate.status]=(acc.statuses[estimate.status]||0)+1;if(estimate.interval){acc.reported++;acc.covered+=Number(estimate.interval[0]<=acc.truth&&estimate.interval[1]>=acc.truth);acc.widthSum+=estimate.interval[1]-estimate.interval[0];}};
  const finish=a=>{const coverage=a.reported?a.covered/a.reported:null;return {...a,conditionalCoverage:coverage,coverageErrorFromNominal:coverage===null?null:coverage-(1-POLICY.alpha),monteCarloSE:coverage===null?null:Math.sqrt(coverage*(1-coverage)/a.reported),meanWidth:a.reported?a.widthSum/a.reported:null,reportedFraction:a.reported/replicates,unconditionalCoveredFraction:a.covered/replicates};};
  const scenarios=[];
  for(const spec of specifications){
    const scenarioSeed=derivedSeed(spec.name,seed), rng=prng(scenarioSeed), main=measure(spec.truth), sensitivity=measure(spec.truth), second=measure(spec.secondaryTruth), joint={reported:0,covered:0};
    let zeroEventDatasets=0;
    for(let iteration=0;iteration<replicates;iteration++){
      const rows=[], paired=[], secondary=[];
      for(let k=0;k<48;k++){
        const u=rng();
        if(spec.name==='null'){const v=rng()<.75?u:rng();paired.push([u<.5?8:0,8,v<.5?8:0,8]);rows.push({n:u<.5?8:0,d:8});}
        else if(spec.name==='positiveDependence')rows.push({n:u<.2?8:0,d:8});
        else if(spec.name==='imbalancedCluster'){const size=u<.5?1:6;rows.push({n:rng()<(size===1?.2:.8)?8*size:0,d:8*size});}
        else if(spec.name==='censored')rows.push({n:u>=.55&&u<.70?8:0,d:8});
        else if(spec.name==='zeroAcceptance')rows.push({n:0,d:0});
        else if(spec.name==='rareZeroEvents')rows.push({n:u<.005?8:0,d:8});
        else {rows.push({n:u<.7?8:0,d:8});secondary.push({n:u<.4?8:0,d:u<.8?8:0});}
      }
      const bs=derivedSeed(`${spec.name}/${iteration}`,seed), options={seed:bs,replicates:bootstrapReplicates,risk:['positiveDependence','censored','rareZeroEvents','zeroAcceptance'].includes(spec.name)};
      const estimate=spec.name==='null'?bootstrapPairedDifference(paired,options):bootstrapRatio(rows,options);update(main,estimate);
      if(rows.every(r=>r.n===0))zeroEventDatasets++;
      if(spec.name!=='null')update(sensitivity,clusterRatioSensitivity(rows,spec.name==='imbalancedCluster'?48:8));
      if(spec.name==='dualEndpoint'){const e=bootstrapRatio(secondary,{...options,seed:derivedSeed(`${spec.name}/G/${iteration}`,seed)});update(second,e);if(estimate.interval&&e.interval){joint.reported++;joint.covered+=Number(estimate.interval[0]<=spec.truth&&estimate.interval[1]>=spec.truth&&e.interval[0]<=spec.secondaryTruth&&e.interval[1]>=spec.secondaryTruth);}}
    }
    scenarios.push({...spec,seed:scenarioSeed,replicates,clusterCount:48,zeroEventDatasets,bootstrap:finish(main),clusterHoeffding:spec.name==='null'?null:finish(sensitivity),secondary:spec.name==='dualEndpoint'?finish(second):null,joint:spec.name==='dualEndpoint'?{...joint,coverage:joint.reported?joint.covered/joint.reported:null,claim:'No simultaneous 95% coverage claim for two pointwise intervals.'}:null});
  }
  // Seeded structural corruption trials: wrong/missing/duplicate are NOT silently imputed observations.
  const rng=prng(derivedSeed('missing',seed));let missingDetected=0,duplicateDetected=0,unexecutedRetained=0;
  for(let iteration=0;iteration<replicates;iteration++){
    const input=syntheticLedger(2),index=Math.floor(rng()*input.records.length), removed=input.records.splice(index,1)[0];
    missingDetected+=Number(auditInput(input).missing.length===1);
    input.records.push(removed,structuredClone(removed));duplicateDetected+=Number(auditInput(input).duplicates.length===1);
    input.records.pop();const target=input.records[Math.floor(rng()*input.records.length)];target.proposal={status:'notExecuted',candidateHash:null,scopeGuardRejected:false,invoked:false,acceptanceLocked:false};target.outcomes={R:null,G:null};unexecutedRetained+=Number(auditInput(input).valid&&auditInput(input).notInvoked.length===1&&recordCounts(target,'R').proposalNotExecuted===1);
  }
  scenarios.push({name:'missing',seed:derivedSeed('missing',seed),replicates,model:'Random planned slot removed, duplicated, or explicitly not invoked from a complete two-brief/four-method/two-config/four-task synthetic ledger. Structural detection, not interval coverage.',missingDetected,duplicateDetected,unexecutedRetained,coverage:null});
  return {kind:'synthetic-inference-control-not-natural-effects',version:POLICY.version,seed,replicates,bootstrapReplicates,productionBootstrapReplicates:POLICY.bootstrapReplicates,alpha:POLICY.alpha,scenarios,limitations:['Registered simulation uses production B=9999; explicit overrides are synthetic diagnostics only, never silent production settings.','Monte Carlo SE is binomial across independently generated synthetic datasets, NEVER across study tasks.','48 iid model clusters do not certify the real sampling frame has any independent clusters.','Percentile intervals may under-cover, especially rare events; report suppression and unconditional covered fraction, not selected-interval coverage alone.','Sensitivity bounds require independent bounded clusters; unknown dependence invalidates empirical coverage transfer.']};
}
/** Public hand-built ledger fixture, not a natural sample, product output or future brief. */
export function syntheticLedger(briefCount=2) {
  const d={briefs:Array.from({length:briefCount},(_,i)=>({briefId:`synthetic-${i}`,clusterId:`synthetic-family-${i}`})),configs:['config-a','config-b'],tasks:['task-0','task-1','task-2','task-3'],methods:[...METHODS],maxBriefsPerCluster:1,independence:{status:'verified',basis:'Synthetic independently indexed control units only; no real sampling claim'}};
  const input={schemaVersion:'analysis-v04-input-1',datasetId:'synthetic-only',datasetKind:'dev',design:d,evaluationBinding:{evaluationSchema:'synthetic-evaluation-1',normalizerVersion:'synthetic-normalizer-1'},records:[],costEvents:[]};
  for(const b of d.briefs)for(const c of d.configs)for(const t of d.tasks)for(const m of METHODS){const outcome=()=>({confirmedViolation:false,unknown:false,allRequiredPassed:true,binding:{evaluationSchema:input.evaluationBinding.evaluationSchema,normalizerVersion:input.evaluationBinding.normalizerVersion,evidenceHash:'e'.repeat(64),classification:'S'}});input.records.push({briefId:b.briefId,configId:c,taskId:t,method:m,eligibility:{R:'eligible',G:'eligible'},preparation:'ready',proposal:{status:'accepted',candidateHash:'a'.repeat(64),scopeGuardRejected:false,invoked:true,acceptanceLocked:true},outcomes:{R:outcome(),G:outcome()},costEventIds:[]});}
  return input;
}
