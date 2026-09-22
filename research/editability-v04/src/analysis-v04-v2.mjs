import {createHash,createPublicKey,verify as cryptoVerify} from 'node:crypto';
/** Independent record-only analysis. No method/runtime/observer imports, network or secrets. */
export const POLICY = Object.freeze({
  version: 'statistical-analysis-v2', bootstrapReplicates: 9999, seed: 67379238,
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
  if(input.datasetKind==='formal' && d.briefs.length!==96) errors.push('formal requires 96 planned briefs; highest dependency cluster count is separately reported and may be below 96');
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

export const V2_POLICY=Object.freeze({version:'statistical-analysis-v2',familyAlpha:0.05,primaryCount:3,primaryAlpha:0.05/3,pointwiseAlpha:0.05,simulationSeed:1374772973,simulationReplicates:600,bootstrapReplicates:9999,target:'locked-design-cluster-expectations',weight:'ratio-of-expected-cluster-totals',primary:['R/FULL/S_over_P','R/FULL/S_over_E','R/FULL_minus_SCOPE_OFF/S_over_P']});
export function canonical(value){
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw new Error('canonical JSON values required');
}
export const sha256=value=>createHash('sha256').update(canonical(value)).digest('hex');
export function designFingerprint(input){return sha256({datasetId:input.datasetId,datasetKind:input.datasetKind,design:input.design,evaluationBinding:input.evaluationBinding,collectionStartedAt:input.collectionStartedAt??null});}
function clusterLayout(input){const map=new Map();for(const b of input.design.briefs)map.set(b.clusterId,(map.get(b.clusterId)||0)+1);return [...map].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([clusterId,briefCount])=>({clusterId,briefCount,plannedSlots:briefCount*8}));}
/** Payload constructor does NOT approve assumptions. Independent authorities must review and sign. */
export function assumptionPayload(input,{trustDomain,lockedAt,evidenceRefs,positiveDenominators=[]}){
  const layout=clusterLayout(input);
  return {schemaVersion:'analysis-v04-assumptions-2',analysisVersion:V2_POLICY.version,datasetId:input.datasetId,datasetKind:input.datasetKind,designSha256:designFingerprint(input),trustDomain,lockedAt,preOutcomeCommitment:true,target:V2_POLICY.target,weight:V2_POLICY.weight,independenceModel:'independent-highest-cluster-execution-conditional-on-locked-brief-set',K:layout.length,L:input.design.maxBriefsPerCluster*8,clusterLayout:layout,familyAlpha:V2_POLICY.familyAlpha,primaryAlpha:V2_POLICY.primaryAlpha,pointwiseAlpha:V2_POLICY.pointwiseAlpha,primary:[...V2_POLICY.primary],positiveDenominators,evidenceRefs};
}
export function verifyAssumptionEvidence(input,context={}){
  try{return verifyAssumptionEvidenceUnchecked(input,context);}catch(error){return {verified:false,primaryAuthorized:false,reasons:[`malformed assumption evidence: ${error.message}`],trustDomain:context?.trustDomain??null};}
}
function verifyAssumptionEvidenceUnchecked(input,context={}){
  const reasons=[],e=input.assumptionEvidence,p=e?.payload,authorities=context.trustedAuthorities;
  const blocked=()=>({verified:false,reasons,primaryAuthorized:false,trustDomain:context.trustDomain??null});
  if(!p||!Array.isArray(e.signatures)){reasons.push('missing independent assumption payload/signatures');return blocked();}
  if(!['study','synthetic-control'].includes(context.trustDomain)||context.trustDomain!==p.trustDomain)reasons.push('trusted execution domain absent or mismatched');
  if(input.datasetKind==='formal'&&p.trustDomain!=='study')reasons.push('synthetic trust domain cannot authorize formal analysis');
  if(!Array.isArray(authorities)||authorities.length!==2){reasons.push('independent executor must supply exactly two external trust anchors; ledger cannot supply its own trust');return blocked();}
  const roles=['independent-owner','independent-audit'];
  const keyIdentities=authorities.map(a=>{try{return createPublicKey(a.publicKeyPem).export({type:'spki',format:'der'}).toString('hex');}catch{return null;}});
  if(new Set(authorities.map(a=>a.authorityId)).size!==2||keyIdentities.includes(null)||new Set(keyIdentities).size!==2)reasons.push('owner and auditor must have distinct identities and cryptographic public keys');
  if(authorities.some(a=>!roles.includes(a.role)||(context.analysisAuthorIds||[]).includes(a.authorityId)))reasons.push('analysis author cannot approve own assumptions');
  if(e.signatures.length!==2)reasons.push('exactly two independent signatures required');
  for(const role of roles){
    const anchors=authorities.filter(a=>a.role===role),signatures=e.signatures.filter(s=>s.role===role);
    if(anchors.length!==1||signatures.length!==1){reasons.push(`missing/duplicate ${role}`);continue;}
    const anchor=anchors[0],signature=signatures[0];
    try{const publicKey=createPublicKey(anchor.publicKeyPem);if(publicKey.asymmetricKeyType!=='ed25519'||signature.authorityId!==anchor.authorityId||!cryptoVerify(null,Buffer.from(canonical(p)),publicKey,Buffer.from(signature.signatureBase64||'','base64')))reasons.push(`invalid ${role} signature`);}catch{reasons.push(`invalid ${role} public signature material`);}
  }
  const expected=assumptionPayload(input,{trustDomain:p.trustDomain,lockedAt:p.lockedAt,evidenceRefs:p.evidenceRefs,positiveDenominators:p.positiveDenominators});
  for(const name of ['schemaVersion','analysisVersion','datasetId','datasetKind','designSha256','preOutcomeCommitment','target','weight','independenceModel','K','L','clusterLayout','familyAlpha','primaryAlpha','pointwiseAlpha','primary'])if(canonical(p[name]??null)!==canonical(expected[name]))reasons.push(`frozen assumption mismatch: ${name}`);
  if(!Array.isArray(p.positiveDenominators)||p.positiveDenominators.some(x=>typeof x!=='string'))reasons.push('explicit positive-denominator assumptions required');
  const refs=p.evidenceRefs;
  for(const purpose of ['source-family-dependence','execution-independence','frame-bound','pre-outcome-lock'])if(!Array.isArray(refs)||!refs.some(r=>r.purpose===purpose&&typeof r.reference==='string'&&r.reference.length>0&&/^[a-f0-9]{64}$/i.test(r.sha256||'')))reasons.push(`missing independent evidence reference: ${purpose}`);
  const locked=Date.parse(p.lockedAt),collection=Date.parse(input.collectionStartedAt);
  if(!Number.isFinite(locked)||!Number.isFinite(collection)||locked>=collection)reasons.push('independent assumptions must be committed before source collection starts');
  // A signature authenticates an approval, NOT empirical truth or a trusted timestamp.
  return {verified:reasons.length===0,primaryAuthorized:reasons.length===0,reasons,trustDomain:context.trustDomain,payloadSha256:sha256(p),K:p.K,L:p.L,target:p.target,weight:p.weight,limitations:['External independent executor controls trust anchors; author-supplied anchors are not authorized study execution.','Signature authenticates approval content, not scientific truth; evidence and append-only pre-outcome lock must be audited independently.','Inference is conditional on the locked requirement set and independent cluster execution mechanisms, not representative demand-population inference.']};
}
function checkedRows(rows,capacities,alpha){
  if(!Array.isArray(rows)||!rows.length||!Array.isArray(capacities)||rows.length!==capacities.length||!(alpha>0&&alpha<1))throw new Error('nonempty matched cluster rows, capacities and alpha required');
  if(capacities.some(c=>!Number.isSafeInteger(c)||c<=0)||rows.some((r,i)=>!finiteNonnegative(r.n)||!finiteNonnegative(r.d)||r.n>r.d||r.d>capacities[i]))throw new Error('cluster outcome outside frozen capacity');
  return {n:rows.reduce((s,r)=>s+r.n,0),d:rows.reduce((s,r)=>s+r.d,0),sumSquares:capacities.reduce((s,c)=>s+c*c,0)};
}
function ratioRectangle(nLow,nHigh,dLow,dHigh){
  if(dLow<=0)return [0,1];
  return [Math.max(0,Math.min(1,nLow/dHigh)),Math.max(0,Math.min(1,nHigh/dLow))];
}
/** Finite-sample population ratio bound. Observed zero D NEVER means population E[D]=0. */
export function populationRatioBound(rows,capacities,{alpha=V2_POLICY.pointwiseAlpha,fixedDenominator=false}={}){
  const {n,d,sumSquares}=checkedRows(rows,capacities,alpha),radius=Math.sqrt(sumSquares*Math.log((fixedDenominator?2:4)/alpha)/2);
  if(fixedDenominator&&d===0)throw new Error('fixed planned denominator must be positive');
  const interval=fixedDenominator?[Math.max(0,(n-radius)/d),Math.min(1,(n+radius)/d)]:ratioRectangle(Math.max(0,n-radius),n+radius,Math.max(0,d-radius),d+radius);
  return {observedRatio:ratio(n,d),interval,status:interval[0]===0&&interval[1]===1?'population-no-information':'finite-sample-bound',alpha,K:rows.length,capacities,fixedDenominator,radius,method:fixedDenominator?'independent-cluster-Hoeffding-fixed-denominator':'independent-cluster-Hoeffding-ratio',parameterDomain:fixedDenominator?'known positive planned denominator':'sum of population expected denominator counts > 0',target:V2_POLICY.target,weight:V2_POLICY.weight};
}
/** Shared E/P masks allow a direct signed paired bound, with cluster range 2*capacity. */
export function populationSharedDifferenceBound(rows,capacities,{alpha=V2_POLICY.pointwiseAlpha,fixedDenominator=false}={}){
  const a=rows.map(r=>({n:r[0],d:r[1]})),b=rows.map(r=>({n:r[2],d:r[3]}));
  const x=checkedRows(a,capacities,alpha),y=checkedRows(b,capacities,alpha);
  if(rows.some(r=>r.length!==4||r[1]!==r[3]))throw new Error('shared-denominator paired rows required');
  const z=x.n-y.n,d=x.d,rz=Math.sqrt(2*x.sumSquares*Math.log((fixedDenominator?2:4)/alpha)),rd=Math.sqrt(x.sumSquares*Math.log(4/alpha)/2);
  if(fixedDenominator&&d===0)throw new Error('fixed denominator must be positive');
  let interval;
  if(fixedDenominator)interval=[Math.max(-1,(z-rz)/d),Math.min(1,(z+rz)/d)];
  else if(d<=rd)interval=[-1,1];
  else {const values=[(z-rz)/(d-rd),(z-rz)/(d+rd),(z+rz)/(d-rd),(z+rz)/(d+rd)];interval=[Math.max(-1,Math.min(...values)),Math.min(1,Math.max(...values))];}
  return {observedDifference:d?z/d:null,interval,status:interval[0]===-1&&interval[1]===1?'population-no-information':'finite-sample-bound',alpha,K:rows.length,capacities,method:'independent-cluster-Hoeffding-shared-denominator-pair',fixedDenominator,numeratorRadius:rz,denominatorRadius:fixedDenominator?0:rd,parameterDomain:fixedDenominator?'known positive planned denominator':'shared population expected denominator > 0',target:V2_POLICY.target,weight:V2_POLICY.weight};
}
/** Different selected acceptance denominators: four simultaneous mean bounds (alpha/4 each). */
export function populationRiskDifferenceBound(rows,capacities,{alpha=V2_POLICY.pointwiseAlpha}={}){
  const full=populationRatioBound(rows.map(r=>({n:r[0],d:r[1]})),capacities,{alpha:alpha/2}),other=populationRatioBound(rows.map(r=>({n:r[2],d:r[3]})),capacities,{alpha:alpha/2});
  return {observedDifference:full.observedRatio===null||other.observedRatio===null?null:full.observedRatio-other.observedRatio,interval:[Math.max(-1,full.interval[0]-other.interval[1]),Math.min(1,full.interval[1]-other.interval[0])],alpha,method:'independent-cluster-Hoeffding-four-means-risk-contrast',K:rows.length,capacities,full,other,parameterDomain:'both population expected acceptance denominators > 0; different selected populations, not a causal risk effect'};
}
function evidenceBlocked(gate,alpha,reason=null){return {interval:null,status:'inference-blocked',alpha,reasons:reason?[reason]:gate.reasons,notAConfidenceClaim:true};}
function scopeObserved(input,endpoint){
  const map=new Map(input.records.map(r=>[key(r.briefId,r.configId,r.taskId,r.method),r])),c={P:0,E:0,preventedW:0,foregoneS:0,unknown:0,unknownAccepted:0,unevaluable:0,noCandidate:0,notGuardDiscordant:0,ineligible:0};
  for(const f of input.records.filter(r=>r.method==='FULL')){const s=map.get(key(f.briefId,f.configId,f.taskId,'SCOPE_OFF'));c.P++;if(f.eligibility[endpoint]!=='eligible'){c.ineligible++;continue;}c.E++;if(!f.proposal.candidateHash||!s.proposal.candidateHash){c.noCandidate++;continue;}if(!f.proposal.scopeGuardRejected){c.notGuardDiscordant++;continue;}if(s.proposal.status!=='accepted'){c.unknown++;c.unevaluable++;continue;}const classification=classifyOutcome(s.outcomes[endpoint]);if(classification==='W')c.preventedW++;else if(classification==='S')c.foregoneS++;else{c.unknown++;c.unknownAccepted++;}}
  return {counts:c,rates:Object.fromEntries(['preventedW','foregoneS','unknown'].flatMap(n=>['P','E'].map(d=>[`${n}_over_${d}`,ratio(c[n],c[d])])))};
}
export function analyze(input,context={}){
  const audit=auditInput(input);if(!audit.valid)return {version:V2_POLICY.version,status:'audit-failed',audit,observed:null,population:null};
  const gate=verifyAssumptionEvidence(input,context),layout=clusterLayout(input),capacities=layout.map(c=>c.plannedSlots),clusterIndex=new Map(layout.map((c,i)=>[c.clusterId,i])),briefMap=new Map(input.design.briefs.map(b=>[b.briefId,b])),rows={},observed={},exploratory={},pointwise={};
  for(const endpoint of ENDPOINTS){
    observed[endpoint]={methods:{},scopeAblation:scopeObserved(input,endpoint),contrasts:{},equalBriefContrasts:{},configContrasts:{}};exploratory[endpoint]={};pointwise[endpoint]={};rows[endpoint]={};
    for(const method of METHODS){
      const cr=layout.map(()=>blank()),br=new Map(input.design.briefs.map(b=>[b.briefId,blank()])),configs=input.design.configs.map(()=>layout.map(()=>blank()));
      const selected=input.records.filter(r=>r.method===method);
      for(const r of selected){const c=recordCounts(r,endpoint),i=clusterIndex.get(briefMap.get(r.briefId).clusterId);add(cr[i],c);add(br.get(r.briefId),c);add(configs[input.design.configs.indexOf(r.configId)][i],c);}
      rows[endpoint][method]=cr;const counts=sum(cr);assertClosure(counts);
      const ids=new Set(selected.flatMap(r=>r.costEventIds));let changed=true;while(changed){changed=false;for(const e of input.costEvents)if(ids.has(e.eventId)&&e.parentEventId!==null&&!ids.has(e.parentEventId)){ids.add(e.parentEventId);changed=true;}}
      const equalBrief={};for(const den of ['P','E']){const cs=[...br.values()].filter(c=>c[den]>0);equalBrief[`S_over_${den}`]={point:cs.length?cs.reduce((s,c)=>s+c.S/c[den],0)/cs.length:null,contributingBriefs:cs.length};}
      observed[endpoint].methods[method]={counts,rates:rates(counts),equalBrief,clusters:layout.map((l,i)=>({...l,counts:cr[i]})),riskIdentification:{confirmedLower:ratio(counts.W,counts.A),possibleUpper:ratio(counts.W+counts.U_A,counts.A),notAConfidenceInterval:true},diagnostics:{acceptedWithUnknown:selected.filter(r=>r.proposal.status==='accepted'&&r.eligibility[endpoint]==='eligible'&&r.outcomes[endpoint].unknown).length,confirmedWrongWithUnknown:selected.filter(r=>r.proposal.status==='accepted'&&r.eligibility[endpoint]==='eligible'&&r.outcomes[endpoint].confirmedViolation&&r.outcomes[endpoint].unknown).length},costs:summarizeCosts(input.costEvents.filter(e=>ids.has(e.eventId)))};
      exploratory[endpoint][method]={};pointwise[endpoint][method]={};
      for(const [name,[n,d]] of Object.entries(RATE_PAIRS)){
        const rs=cr.map(c=>({n:c[n],d:c[d]}));
        exploratory[endpoint][method][name]={...bootstrapRatio(rs,{seed:derivedSeed(`v2/${endpoint}/${method}/${name}`),risk:d==='A',independenceVerified:gate.verified}),role:'exploratory-only-no-finite-sample-coverage-guarantee'};
        pointwise[endpoint][method][name]=gate.verified?{...populationRatioBound(rs,capacities,{fixedDenominator:d==='P'}),role:'pointwise-sensitivity-not-primary'}:evidenceBlocked(gate,V2_POLICY.pointwiseAlpha);
      }
      pointwise[endpoint][method].unknownWorstCaseRisk=gate.verified?{...populationRatioBound(cr.map(c=>({n:c.W+c.U_A,d:c.A})),capacities),role:'pointwise-unknown-worst-case-sensitivity'}:evidenceBlocked(gate,V2_POLICY.pointwiseAlpha);
      for(const den of ['P','E']){const paired=layout.map((_,i)=>[configs[0][i].S,configs[0][i][den],configs[1][i].S,configs[1][i][den]]),label=`${method}/${input.design.configs[0]}_minus_${input.design.configs[1]}/S_over_${den}`;observed[endpoint].configContrasts[label]={difference:sum(configs[0])[den]&&sum(configs[1])[den]?sum(configs[0]).S/sum(configs[0])[den]-sum(configs[1]).S/sum(configs[1])[den]:null};pointwise[endpoint][label]=gate.verified?{...populationRiskDifferenceBound(paired,capacities.map(n=>n/2)),role:'pointwise-config-pair-sensitivity',parameterDomain:'both expected configuration-specific denominators > 0; fixed configurations paired within highest cluster'}:evidenceBlocked(gate,V2_POLICY.pointwiseAlpha);}
    }
    for(const other of METHODS.filter(m=>m!=='FULL'))for(const [name,[n,d]] of Object.entries(RATE_PAIRS)){
      const paired=layout.map((_,i)=>[rows[endpoint].FULL[i][n],rows[endpoint].FULL[i][d],rows[endpoint][other][i][n],rows[endpoint][other][i][d]]),label=`FULL_minus_${other}/${name}`,f=sum(rows[endpoint].FULL),o=sum(rows[endpoint][other]);
      observed[endpoint].contrasts[label]={difference:f[d]&&o[d]?f[n]/f[d]-o[n]/o[d]:null};
      pointwise[endpoint][label]=gate.verified?{...(d==='A'?populationRiskDifferenceBound(paired,capacities):populationSharedDifferenceBound(paired,capacities,{fixedDenominator:d==='P'})),role:'pointwise-paired-sensitivity-not-primary'}:evidenceBlocked(gate,V2_POLICY.pointwiseAlpha);
    }
  }
  for(const endpoint of ENDPOINTS)for(const other of METHODS.filter(m=>m!=='FULL'))for(const den of ['P','E']){const a=observed[endpoint].methods.FULL.equalBrief[`S_over_${den}`].point,b=observed[endpoint].methods[other].equalBrief[`S_over_${den}`].point;observed[endpoint].equalBriefContrasts[`FULL_minus_${other}/S_over_${den}`]={difference:a===null||b===null?null:a-b,role:'descriptive-equal-brief-pair-not-ratio-of-sums'};}
  const primary={};
  for(const name of ['S_over_P','S_over_E']){const [n,d]=RATE_PAIRS[name],label=`R/FULL/${name}`,positive=d==='P'||input.assumptionEvidence?.payload?.positiveDenominators?.includes('R:eligible');primary[label]=!gate.verified?evidenceBlocked(gate,V2_POLICY.primaryAlpha):!positive?evidenceBlocked(gate,V2_POLICY.primaryAlpha,'primary S/E target needs independently signed positive expected R eligibility denominator'):{...populationRatioBound(rows.R.FULL.map(c=>({n:c[n],d:c[d]})),capacities,{alpha:V2_POLICY.primaryAlpha,fixedDenominator:d==='P'}),role:'primary-three-estimand-familywise-bound'};}
  primary['R/FULL_minus_SCOPE_OFF/S_over_P']=gate.verified?{...populationSharedDifferenceBound(layout.map((_,i)=>[rows.R.FULL[i].S,rows.R.FULL[i].P,rows.R.SCOPE_OFF[i].S,rows.R.SCOPE_OFF[i].P]),capacities,{alpha:V2_POLICY.primaryAlpha,fixedDenominator:true}),role:'primary-three-estimand-familywise-bound'}:evidenceBlocked(gate,V2_POLICY.primaryAlpha);
  return {version:V2_POLICY.version,status:gate.verified?'independent-evidence-verified-bounded-inference':'descriptive-only-assumptions-unverified',audit,assumptionGate:gate,policy:V2_POLICY,observed,exploratory,population:{primary,primaryFamily:{complete:Object.values(primary).every(p=>p.interval!==null),nominalFamilyCoverage:Object.values(primary).every(p=>p.interval!==null)?.95:null,budget:'.05/3 for each of three predeclared estimands; no reassignment'},pointwise},costs:summarizeCosts(input.costEvents),limitations:['Observed zero denominator remains null; population interval can be [0,1] under the positive expected denominator parameter domain.','Highest family count C may be below 96 without design violation; interval uses actual capacities and C, not a 96-brief precision slogan.','Independent signatures and source-family evidence still require external audit; no inference for unresolved cross-cluster execution dependence.','Percentile bootstrap is exploratory; increasing B cannot fix structural undercoverage.','No natural-study effect conclusion from synthetic controls.']};
}

export function syntheticLedger(briefCount=2){
  const d={briefs:Array.from({length:briefCount},(_,i)=>({briefId:`synthetic-${i}`,clusterId:`synthetic-family-${i}`})),configs:['config-a','config-b'],tasks:['task-0','task-1','task-2','task-3'],methods:[...METHODS],maxBriefsPerCluster:1,independence:{status:'unverified',basis:'Synthetic fixture does not itself authorize any population inference'}};
  const input={schemaVersion:'analysis-v04-input-1',datasetId:'synthetic-only',datasetKind:'dev',collectionStartedAt:'2026-01-02T00:00:00Z',design:d,evaluationBinding:{evaluationSchema:'synthetic-evaluation-1',normalizerVersion:'synthetic-normalizer-1'},records:[],costEvents:[]};
  for(const b of d.briefs)for(const c of d.configs)for(const t of d.tasks)for(const m of METHODS){const outcome=()=>({confirmedViolation:false,unknown:false,allRequiredPassed:true,binding:{evaluationSchema:input.evaluationBinding.evaluationSchema,normalizerVersion:input.evaluationBinding.normalizerVersion,evidenceHash:'e'.repeat(64),classification:'S'}});input.records.push({briefId:b.briefId,configId:c,taskId:t,method:m,eligibility:{R:'eligible',G:'eligible'},preparation:'ready',proposal:{status:'accepted',candidateHash:'a'.repeat(64),scopeGuardRejected:false,invoked:true,acceptanceLocked:true},outcomes:{R:outcome(),G:outcome()},costEventIds:[]});}
  return input;
}
export function exactClusterGridControls(){
  const rows=[];
  for(const K of [24,48,96])for(const p of [.005,.01,.05,.15,.2,.4,.6,.8,.95,.995])for(const model of ['all-accepted-cluster-W','sparse-accepted-all-W']){
    let probability=(1-p)**K,coverage=0,total=0,zeroObservedInterval=null;
    for(let count=0;count<=K;count++){
      if(count>0)probability*=((K-count+1)/count)*(p/(1-p));
      const data=Array.from({length:K},(_,i)=>({n:i<count?1:0,d:model==='all-accepted-cluster-W'?1:(i<count?1:0)})),bound=populationRatioBound(data,Array(K).fill(1)),truth=model==='all-accepted-cluster-W'?p:1;
      coverage+=probability*Number(bound.interval[0]<=truth&&bound.interval[1]>=truth);total+=probability;if(count===0)zeroObservedInterval=bound.interval;
    }
    rows.push({model,K,p,truth:model==='all-accepted-cluster-W'?p:1,alpha:.05,coverage:coverage/total,coverageErrorFromNominal:coverage/total-.95,rawCoveredProbability:coverage,probabilitySum:total,zeroObservedInterval,pass:coverage>=.95-1e-12});
  }
  return {kind:'exact-independent-cluster-Bernoulli-enumeration-not-task-binomial-inference',gridCount:rows.length,minCoverage:Math.min(...rows.map(r=>r.coverage)),allPass:rows.every(r=>r.pass),rows,limitations:['Binomial probabilities enumerate independent synthetic CLUSTERS, never the real study tasks.','Grid verifies these models only; general validity comes from signed assumptions plus Hoeffding proof, not numerical grid coverage.']};
}
export function runSimulationControls({replicates=V2_POLICY.simulationReplicates,bootstrapReplicates=V2_POLICY.bootstrapReplicates,seed=V2_POLICY.simulationSeed}={}){
  if(!Number.isSafeInteger(replicates)||replicates<1)throw new Error('positive simulation replicate count');
  const specs=[
    {name:'null',truth:0,model:'Independent 48 clusters, paired p=.5 with .75 common latent; eight identical within-cluster outcomes.'},
    {name:'positiveDependence',truth:.2,model:'All accepted, cluster W Bernoulli(.2), eight perfectly dependent tasks per cluster.'},
    {name:'imbalancedCluster',truth:null,model:'Locked roster sizes 1/6 briefs drawn before outcomes; each cluster S probability .2/.8 given size; target conditional on actual locked roster = sum(capacity*p)/sum(capacity), not unconditional 5/7.'},
    {name:'censored',truth:.15,model:'All accepted; cluster S=.55,W=.15,UA=.30. Main target confirmed W, secondary worst-case W+UA=.45; neither asserts latent total wrong=.15.'},
    {name:'zeroAcceptance',truth:null,model:'Structural zero acceptance probability; observed risk null AND population ratio undefined, no claim for a nonexistent parameter.'},
    {name:'rareZeroEvents',truth:.005,model:'All accepted, cluster W probability .005; zero observed W must not imply zero population risk.'},
    {name:'sparseAcceptanceAllWrong',truth:1,model:'Cluster accepted with q=.005; W=A. Positive population E[A], population risk 1; observed A0 probability .995^48 about .786. Population [0,1] on A0 must count as reported coverage.'},
    {name:'riskContrast',truth:.2,model:'Same cluster U: FULL A iff U<.05, W iff U<.025 (risk .5); SCOPE_OFF A iff U<.8, W iff U<.24 (risk .3); true selected-population risk difference .2, not a causal common-population effect.'},
    {name:'dualEndpoint',truth:.7,secondaryTruth:.5,model:'Shared U: R S/P=I(U<.7); G E=I(U<.8), S=I(U<.4); population G S/E=.5. Same outcomes, separate endpoints.'},
    {name:'primaryFamily',truth:.5,secondaryTruth:.625,thirdTruth:-.1,model:'Shared U: E=I(U<.8), FULL S=I(U<.5), SCOPE_OFF S=I(U<.6). Three prespecified R primary targets with alpha=.05/3 each.'}
  ];
  const make=()=>({nominalCoverage:.95,reported:0,covered:0,widthSum:0,noInformation:0,truthMin:null,truthMax:null,statuses:{}});
  const update=(a,b,truth)=>{if(b.alpha!==undefined)a.nominalCoverage=1-b.alpha;a.statuses[b.status||'bound']=(a.statuses[b.status||'bound']||0)+1;if(truth!==null){a.truthMin=a.truthMin===null?truth:Math.min(a.truthMin,truth);a.truthMax=a.truthMax===null?truth:Math.max(a.truthMax,truth);}if(b.interval&&truth!==null){a.reported++;a.covered+=Number(b.interval[0]<=truth&&b.interval[1]>=truth);a.widthSum+=b.interval[1]-b.interval[0];a.noInformation+=Number((b.interval[0]===0&&b.interval[1]===1)||(b.interval[0]===-1&&b.interval[1]===1));}};
  const finish=(a,defined=true)=>{const c=a.reported?a.covered/a.reported:null;return {...a,coverage:c,coverageErrorFromNominal:c===null?null:c-a.nominalCoverage,monteCarloSE:c===null?null:Math.sqrt(c*(1-c)/a.reported),reportedFraction:a.reported/replicates,unconditionalCoveredFraction:defined?a.covered/replicates:null,meanWidth:a.reported?a.widthSum/a.reported:null};};
  const scenarios=[];
  for(const spec of specs){
    const rng=prng(derivedSeed(`v2/${spec.name}`,seed)),finite=make(),exploratory=make(),second=make(),third=make(),joint={reported:0,covered:0};let observedUndefined=0,zeroWrongDatasets=0;
    for(let iteration=0;iteration<replicates;iteration++){
      const rows=[],paired=[],secondary=[],caps=[];let expectedSuccess=0,planned=0;
      for(let i=0;i<48;i++){
        const u=rng();let cap=8;
        if(spec.name==='null'){const v=rng()<.75?u:rng();paired.push([u<.5?8:0,8,v<.5?8:0,8]);rows.push({n:u<.5?8:0,d:8});}
        else if(spec.name==='positiveDependence')rows.push({n:u<.2?8:0,d:8});
        else if(spec.name==='imbalancedCluster'){cap=u<.5?8:48;const p=cap===8?.2:.8;rows.push({n:rng()<p?cap:0,d:cap});expectedSuccess+=cap*p;planned+=cap;}
        else if(spec.name==='censored'){rows.push({n:u>=.55&&u<.70?8:0,d:8});secondary.push({n:u>=.55?8:0,d:8});}
        else if(spec.name==='zeroAcceptance')rows.push({n:0,d:0});
        else if(spec.name==='rareZeroEvents')rows.push({n:u<.005?8:0,d:8});
        else if(spec.name==='sparseAcceptanceAllWrong')rows.push({n:u<.005?8:0,d:u<.005?8:0});
        else if(spec.name==='riskContrast'){rows.push({n:u<.025?8:0,d:u<.05?8:0});paired.push([u<.025?8:0,u<.05?8:0,u<.24?8:0,u<.8?8:0]);}
        else if(spec.name==='dualEndpoint'){rows.push({n:u<.7?8:0,d:8});secondary.push({n:u<.4?8:0,d:u<.8?8:0});}
        else {rows.push({n:u<.5?8:0,d:8});secondary.push({n:u<.5?8:0,d:u<.8?8:0});paired.push([u<.5?8:0,8,u<.6?8:0,8]);}
        caps.push(cap);
      }
      const truth=spec.name==='imbalancedCluster'?expectedSuccess/planned:spec.truth;
      const primaryAlpha=spec.name==='primaryFamily'?V2_POLICY.primaryAlpha:V2_POLICY.pointwiseAlpha;
      let bound;
      if(spec.name==='zeroAcceptance')bound={interval:null,status:'model-population-parameter-undefined'};
      else if(spec.name==='riskContrast')bound=populationRiskDifferenceBound(paired,caps,{alpha:primaryAlpha});
      else if(spec.name==='null')bound=populationSharedDifferenceBound(paired,caps,{alpha:primaryAlpha,fixedDenominator:true});
      else bound=populationRatioBound(rows,caps,{alpha:primaryAlpha,fixedDenominator:['imbalancedCluster','primaryFamily'].includes(spec.name)});
      update(finite,bound,truth);
      const bsOptions={seed:derivedSeed(`v2/${spec.name}/${iteration}`,seed),replicates:bootstrapReplicates,risk:!['null','imbalancedCluster','primaryFamily','dualEndpoint'].includes(spec.name)};
      update(exploratory,['null','riskContrast'].includes(spec.name)?bootstrapPairedDifference(paired,bsOptions):bootstrapRatio(rows,bsOptions),truth);
      observedUndefined+=Number(rows.every(r=>r.d===0));zeroWrongDatasets+=Number(rows.every(r=>r.n===0));
      if(secondary.length){const secondaryTruth=spec.name==='censored'?.45:spec.secondaryTruth,b2=populationRatioBound(secondary,caps,{alpha:primaryAlpha});update(second,b2,secondaryTruth);if(spec.name==='primaryFamily'){const b3=populationSharedDifferenceBound(paired,caps,{alpha:primaryAlpha,fixedDenominator:true});update(third,b3,spec.thirdTruth);joint.reported++;joint.covered+=Number(bound.interval[0]<=truth&&bound.interval[1]>=truth&&b2.interval[0]<=secondaryTruth&&b2.interval[1]>=secondaryTruth&&b3.interval[0]<=spec.thirdTruth&&b3.interval[1]>=spec.thirdTruth);}else if(spec.name==='dualEndpoint'){joint.reported++;joint.covered+=Number(bound.interval[0]<=truth&&bound.interval[1]>=truth&&b2.interval[0]<=secondaryTruth&&b2.interval[1]>=secondaryTruth);}}
    }
    scenarios.push({...spec,seed:derivedSeed(`v2/${spec.name}`,seed),replicates,K:48,observedUndefined,zeroWrongDatasets,finiteSample:finish(finite,spec.name!=='zeroAcceptance'),exploratoryBootstrap:finish(exploratory,spec.name!=='zeroAcceptance'),secondary:second.reported?finish(second):null,third:third.reported?finish(third):null,joint:joint.reported?{...joint,coverage:joint.covered/joint.reported,claim:spec.name==='primaryFamily'?'Three-primary-family coverage at least .95 under assumptions; Bonferroni.':'Pointwise dual-endpoint sensitivity only; not a joint .95 guarantee.'}:null});
  }
  const rng=prng(derivedSeed('v2/missing',seed));let missingDetected=0,duplicateDetected=0,notInvokedRetained=0;
  for(let i=0;i<replicates;i++){const input=syntheticLedger(),j=Math.floor(rng()*input.records.length),r=input.records.splice(j,1)[0];missingDetected+=Number(auditInput(input).missing.length===1);input.records.push(r,structuredClone(r));duplicateDetected+=Number(auditInput(input).duplicates.length===1);input.records.pop();const s=input.records[Math.floor(rng()*input.records.length)];s.proposal={status:'notExecuted',candidateHash:null,scopeGuardRejected:false,invoked:false,acceptanceLocked:false};s.outcomes={R:null,G:null};notInvokedRetained+=Number(auditInput(input).valid&&auditInput(input).notInvoked.length===1);}
  scenarios.push({name:'missing',seed:derivedSeed('v2/missing',seed),replicates,missingDetected,duplicateDetected,notInvokedRetained,coverage:null});
  return {kind:'v2-synthetic-finite-sample-and-exploratory-controls-not-natural-effects',policy:V2_POLICY,seed,replicates,bootstrapReplicates,scenarios,exactGrid:exactClusterGridControls(),limitations:['Primary finite-sample bounds require independently signed pre-outcome assumptions; these controls are not signatures for real study data.','600 dataset Monte Carlo is a model check, not the mathematical guarantee; Hoeffding proof and actual independent-cluster/capacity assumptions determine applicability.','MCSE is plug-in across synthetic independent datasets; all-covered MCSE=0 does not establish true coverage without uncertainty.','Exploratory bootstrap remains structurally undercalibrated in some models, independent of B.','Observed denominator zero and population expected denominator zero are explicitly different cases.']};
}
