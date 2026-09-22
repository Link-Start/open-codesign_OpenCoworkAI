import {METHODS_V1, sha256, immutable, projectPublicRequest, rebuildPatch} from './methods-v1.mjs';
export const PUBLIC_CHECK_KEYS_V1 = Object.freeze(['parse','entry','patch-safety']);
const ENDPOINTS = ['R','G'];
const ELIGIBILITY = ['eligible','originalIneligible','eligibilityUnresolved','upstreamMissing','notScreened'];
const clone = value => structuredClone(value);
function validatePlan(plan) {
  if (!plan || typeof plan.datasetId !== 'string' || !['dev','pilot','formal'].includes(plan.datasetKind) || !Array.isArray(plan.tasks)) throw new Error('INVALID_PLAN');
  const seen = new Set();
  for (const task of plan.tasks) {
    if (typeof task.sourceId !== 'string' || typeof task.taskId !== 'string') throw new Error('TASK_ID_REQUIRED');
    const key = JSON.stringify([task.sourceId,task.taskId]);
    if (seen.has(key)) throw new Error('DUPLICATE_SLOT');
    seen.add(key);
    for (const endpoint of ENDPOINTS) {
      if (!ELIGIBILITY.includes(task.eligibility?.[endpoint])) throw new Error('INVALID_ELIGIBILITY');
      const keys = task.expectedKeys?.[endpoint];
      if (task.eligibility[endpoint] === 'eligible' && (!Array.isArray(keys) || !keys.length || keys.some(k => typeof k !== 'string') || new Set(keys).size !== keys.length)) throw new Error('EXPECTED_KEYS_REQUIRED_UNIQUE');
    }
  }
}
function publicChecks(receipt) {
  if (!receipt || !Array.isArray(receipt.checks)) return false;
  const checks = receipt.checks;
  return checks.length === PUBLIC_CHECK_KEYS_V1.length && PUBLIC_CHECK_KEYS_V1.every(key => checks.filter(c => c.key === key && c.pass === true).length === 1);
}
function classifyEvaluation(keys, rows) {
  const list = Array.isArray(rows) ? rows : [];
  const normalized = [], auditFailures = [];
  for (const key of keys) {
    const matches = list.filter(row => row?.key === key);
    if (matches.length !== 1) {
      auditFailures.push(matches.length ? 'DUPLICATE_CHECK' : 'MISSING_CHECK');
      normalized.push({key,status:'notMeasured'});
    } else if (!['pass','confirmed-violation','unknown','notMeasured'].includes(matches[0].status)) {
      auditFailures.push('INVALID_CHECK_STATUS'); normalized.push({key,status:'notMeasured'});
    } else normalized.push({key,status:matches[0].status});
  }
  if (list.some(row => !keys.includes(row?.key))) auditFailures.push('UNEXPECTED_CHECK');
  const unknown = normalized.some(row => ['unknown','notMeasured'].includes(row.status)) || auditFailures.length > 0;
  return {outcome: normalized.some(row => row.status === 'confirmed-violation') ? 'W' : unknown ? 'U_A' : 'S',
    checks: normalized, auditFailures, uncertainty: unknown};
}
function baseRecord(plan, task, method) {
  return {schemaVersion:'v04-method-slot-1',datasetId:plan.datasetId,datasetKind:plan.datasetKind,
    sourceId:task.sourceId,taskId:task.taskId,briefId:task.briefId ?? null,configId:task.configId ?? null,method,eligibility:clone(task.eligibility),
    originalSourceHash: typeof task.originalSource === 'string' ? sha256(task.originalSource):null,
    sourceAfterHash:null,patches:null,candidateHash:null,guard:null,rejection:null,methodError:null,
    publicProtocolFailure:null,preparation:'not-executed',proposal:'not-executed',accepted:false,
    decisionLocked:false,acceptanceLocked:false,execution:'not-executed',evaluation:{},cost:{wallMilliseconds:null,transportInvocations:0,experimentApiAttempts:0,inputTokens:null,outputTokens:null,cachedInputTokens:null}};
}
// Trusted orchestrator only. Do not run methods and a secret-bearing evaluator in a shared untrusted process.
// Injected JS boundaries are explicit projections, not a replacement for executor/OS access isolation.
export async function runExperimentV1({plan,methods,prepare,publicCheck,executor,evaluator,evaluationBinding=null,integrationEvidence=null} = {}) {
  validatePlan(plan);
  if (typeof methods?.propose !== 'function') throw new Error('METHODS_REQUIRED');
  const frozenPlan = immutable(clone(plan));
  const frozenEvaluationBinding = evaluationBinding ? immutable(clone(evaluationBinding)):null;
  const records = [];
  for (const task of frozenPlan.tasks) {
    let prepared = null, preparation = 'not-executed';
    const eligible = ENDPOINTS.some(endpoint => task.eligibility[endpoint] === 'eligible');
    if (eligible && task.prepare !== false && typeof prepare === 'function') {
      try {
        const publicInput = projectPublicRequest(task);
        const rawPreparation = await prepare(publicInput);
        const publicFacts = projectPublicRequest({...publicInput,publicDom:rawPreparation?.publicDom ?? publicInput.publicDom});
        let provenance;
        // A mapping failure is method information unavailability, not shared public Q failure.
        try {
          const rawMapping = rawPreparation?.provenance;
          if (rawMapping && typeof rawMapping.sourceHash === 'string' && typeof rawMapping.targetId === 'string')
            provenance = {sourceHash:rawMapping.sourceHash,targetId:rawMapping.targetId};
        } catch {}
        prepared = immutable({status:rawPreparation?.status,publicDom:publicFacts.publicDom,...(provenance?{provenance}:{})});
        preparation = prepared?.status === 'ready' ? 'ready':'failed';
      } catch { preparation = 'failed'; }
    }
    for (const method of METHODS_V1) {
      const record = baseRecord(frozenPlan,task,method);
      records.push(record);
      if (!eligible) { record.uncalledReason = 'NO_ELIGIBLE_ENDPOINT'; continue; }
      record.preparation = preparation;
      if (preparation !== 'ready') { record.uncalledReason = preparation === 'failed' ? 'PUBLIC_PREPARATION_FAILED':'PUBLIC_PREPARATION_NOT_EXECUTED'; continue; }
      if (task.propose === false) { record.uncalledReason = 'PROPOSAL_PLANNED_UNCALLED'; continue; }
      const started = performance.now();
      let proposal;
      try {
        // Never spread task, prepare response, evaluator binding or expectedKeys into a method request.
        const input = {...projectPublicRequest(task),publicDom:prepared.publicDom ?? task.publicRequest?.publicDom,
          ...((method === 'FULL' || method === 'SCOPE_OFF') ? {provenance:prepared.provenance}:{})};
        proposal = immutable(clone(await methods.propose(method,projectPublicRequest(input,{provenance:method === 'FULL' || method === 'SCOPE_OFF'}))));
        record.proposal = 'called';
        record.cost.transportInvocations = proposal.apiAttempts ?? 0;
        record.cost.experimentApiAttempts = method === 'LLM_ONESHOT' && record.cost.transportInvocations > 0 ? null : 0;
        for (const key of ['inputTokens','outputTokens','cachedInputTokens']) record.cost[key] = proposal.usage?.[key] ?? null;
        if (proposal.candidate) {
          const candidate = proposal.candidate;
          record.candidateHash = candidate.candidateHash;
          record.patches = clone(candidate.patches);
          record.sourceAfterHash = sha256(candidate.content);
          let rebuilt; try { rebuilt = rebuildPatch(task.originalSource,candidate.patches); } catch { throw Object.assign(new Error('CANDIDATE_INTEGRITY'),{protocol:true}); }
          if (rebuilt !== candidate.content || candidate.sourceHash !== record.sourceAfterHash
              || candidate.candidateHash !== record.sourceAfterHash) throw Object.assign(new Error('CANDIDATE_INTEGRITY'),{protocol:true});
        }
        record.guard = proposal.guard ? clone(proposal.guard):null;
        if (proposal.status === 'rejected') { record.proposal = 'rejected'; record.rejection = proposal.reason ?? 'METHOD_REJECTED'; }
        else if (proposal.status === 'error') { record.proposal = 'error'; record.methodError = proposal.reason ?? 'METHOD_ERROR'; }
        else if (proposal.status === 'public-protocol-rejection') { record.proposal = 'public-rejected'; record.publicProtocolFailure = proposal.reason; }
        else if (proposal.status !== 'proposed' || !proposal.candidate) { record.proposal='public-rejected'; record.publicProtocolFailure='INVALID_PROPOSAL'; }
        else {
          let receipt;
          try { receipt = typeof publicCheck === 'function' ? await publicCheck(immutable({
            ...projectPublicRequest(task),content:proposal.candidate.content,patches:clone(proposal.candidate.patches),candidateHash:record.candidateHash})):null; }
          catch { receipt = null; }
          record.publicChecks = Array.isArray(receipt?.checks) ? receipt.checks.map(c=>({key:c.key,pass:c.pass})):[];
          if (!publicChecks(receipt)) { record.proposal='public-rejected'; record.publicProtocolFailure='COMMON_PUBLIC_CHECK_FAILED_OR_MISSING'; }
          else { record.proposal='accepted'; record.accepted=true; }
        }
      } catch (error) {
        record.proposal = error?.protocol === true ? 'public-rejected':'error';
        if (error?.protocol === true) record.publicProtocolFailure='CANDIDATE_INTEGRITY'; else record.methodError='METHOD_EXCEPTION';
      }
      record.cost.wallMilliseconds = performance.now() - started;
      // Lock proposal and acceptance BEFORE any private evaluation/execution. Results are a separate object.
      record.decisionLocked = true;
      record.acceptanceLocked = record.accepted;
      const decision = immutable(clone(record));
      if (!decision.accepted) { immutable(record); continue; }
      let execution = null, result = null;
      const lockedCandidate = immutable({datasetId:frozenPlan.datasetId,sourceId:task.sourceId,taskId:task.taskId,method,
        originalSource:task.originalSource,originalSourceHash:decision.originalSourceHash,content:proposal.candidate.content,
        sourceAfterHash:decision.sourceAfterHash,patches:clone(decision.patches),candidateHash:decision.candidateHash,accepted:true,
        // Only independent executor/evaluator sees this opaque binding; never method/oneshot/public checks.
        evaluationRef:task.evaluationRef ?? null});
      try {
        if (typeof executor === 'function') { execution = await executor(lockedCandidate); record.execution='executed'; }
        else record.execution='not-executed';
      } catch { record.execution='error'; }
      if (execution !== null && typeof evaluator === 'function') {
        try {
          result = immutable(clone(await evaluator(immutable({candidate:lockedCandidate,execution:clone(execution)}))));
          // Opaque independent raw receipt + normalized outcomes stay on the trusted ledger.
          // Do not synthesize a binding/hash from the local row summary.
          if (result?.independentEvaluation) record.independentEvaluation = result.independentEvaluation;
        }
        catch { record.evaluatorError='INDEPENDENT_EVALUATOR_ERROR'; }
      }
      for (const endpoint of ENDPOINTS) if (task.eligibility[endpoint] === 'eligible') record.evaluation[endpoint] = classifyEvaluation(task.expectedKeys[endpoint],result?.[endpoint]);
      immutable(record);
    }
  }
  const rollups = {};
  for (const endpoint of ENDPOINTS) for (const method of METHODS_V1) rollups[`${endpoint}/${method}`] = rollupV1(records,endpoint,method);
  return immutable({schemaVersion:'v04-experiment-1',datasetId:frozenPlan.datasetId,datasetKind:frozenPlan.datasetKind,
    evaluationBinding:frozenEvaluationBinding,records,rollups,
    integrationStatus:integrationEvidence ? 'evidence-supplied-not-independently-certified':'dependency-injected-controls-only',
    formalReady:false,integrationEvidence: integrationEvidence ? clone(integrationEvidence):null});
}
export function rollupV1(records,endpoint,method) {
  const counts = Object.fromEntries(['P','E','Q','A','S','W','U_A','originalIneligible','eligibilityUnresolved','upstreamMissing','notScreened',
    'preparationFailure','preparationNotExecuted','rejection','methodError','proposalNotExecuted','methodRejection','publicProtocolRejection'].map(key=>[key,0]));
  const seen = new Set();
  for (const record of records.filter(r=>r.method===method)) {
    const key=JSON.stringify([record.datasetId,record.sourceId,record.taskId,record.method]);
    if (seen.has(key)) throw new Error('DUPLICATE_SLOT'); seen.add(key); counts.P++;
    const eligibility=record.eligibility[endpoint];
    if (eligibility!=='eligible') { if (!ELIGIBILITY.includes(eligibility)) throw new Error('INVALID_ELIGIBILITY'); counts[eligibility]++; continue; }
    counts.E++;
    if(record.preparation!=='ready') {counts[record.preparation==='failed'?'preparationFailure':'preparationNotExecuted']++;continue;}
    counts.Q++;
    if(record.accepted) {
      if(record.proposal!=='accepted'||!record.acceptanceLocked)throw new Error('ACCEPTANCE_NOT_LOCKED');
      counts.A++; const outcome=record.evaluation[endpoint]?.outcome;
      if(!['S','W','U_A'].includes(outcome))throw new Error('ACCEPTED_OUTCOME_MISSING'); counts[outcome]++;
    } else {
      if(Object.keys(record.evaluation).length)throw new Error('NONACCEPTED_OUTCOME');
      if(record.proposal==='rejected'){counts.rejection++;counts.methodRejection++;}
      else if(record.proposal==='public-rejected'){counts.rejection++;counts.publicProtocolRejection++;}
      else if(record.proposal==='error')counts.methodError++;
      else if(record.proposal==='not-executed')counts.proposalNotExecuted++;
      else throw new Error('INVALID_PROPOSAL_STATE');
    }
  }
  if(counts.P!==counts.E+counts.originalIneligible+counts.eligibilityUnresolved+counts.upstreamMissing+counts.notScreened
    ||counts.E!==counts.Q+counts.preparationFailure+counts.preparationNotExecuted
    ||counts.Q!==counts.A+counts.rejection+counts.methodError+counts.proposalNotExecuted
    ||counts.A!==counts.S+counts.W+counts.U_A||counts.rejection!==counts.methodRejection+counts.publicProtocolRejection)throw new Error('FUNNEL_NOT_CLOSED');
  const rates=Object.fromEntries([['S_over_P','S','P'],['S_over_E','S','E'],['Q_over_E','Q','E'],['A_over_E','A','E'],
    ['W_over_A','W','A'],['U_A_over_A','U_A','A'],['rejection_over_Q','rejection','Q']].map(([name,n,d])=>[name,counts[d]?counts[n]/counts[d]:null]));
  return {counts,rates};
}
export function pairedScopeAuditV1(records,endpoint='R') {
  return records.filter(r=>r.method==='FULL').map(full=>{
    const off=records.find(r=>r.datasetId===full.datasetId&&r.sourceId===full.sourceId&&r.taskId===full.taskId&&r.method==='SCOPE_OFF');
    const sameCandidate=Boolean(full.candidateHash&&off?.candidateHash===full.candidateHash);
    const opportunity=sameCandidate&&full.guard?.pass===false&&full.guard.reason==='scope-unsupported'&&full.proposal==='rejected'&&off.accepted;
    return {sourceId:full.sourceId,taskId:full.taskId,sameCandidate,opportunity,
      classification:!opportunity?'not-scope-opportunity':off.evaluation[endpoint]?.outcome==='W'?'prevented-W':off.evaluation[endpoint]?.outcome==='S'?'foregone-S':'uncertain'};
  });
}
