import {METHODS_V1,immutable} from './methods-v1.mjs';
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
function evaluationBinding(value) {
  if (!value || !nonempty(value.evaluationSchema) || !nonempty(value.normalizerVersion)) throw new Error('INDEPENDENT_EVALUATION_BINDING_REQUIRED');
  return {evaluationSchema:value.evaluationSchema,normalizerVersion:value.normalizerVersion};
}
function sameBinding(a,b) { return a.evaluationSchema===b.evaluationSchema && a.normalizerVersion===b.normalizerVersion; }
function normalizedOutcome(value,root,local) {
  if (!value || ['confirmedViolation','unknown','allRequiredPassed'].some(key=>typeof value[key]!=='boolean')) throw new Error('INDEPENDENT_NORMALIZED_OUTCOME_REQUIRED');
  if (value.allRequiredPassed && (value.confirmedViolation || value.unknown)) throw new Error('CONTRADICTORY_NORMALIZED_OUTCOME');
  const classification=value.confirmedViolation?'W':value.unknown?'U_A':value.allRequiredPassed?'S':null;
  if (!classification) throw new Error('NONEXHAUSTIVE_NORMALIZED_OUTCOME');
  const binding=value.binding;
  if (!binding || !sameBinding(evaluationBinding(binding),root) || !sha(binding.evidenceHash) || binding.classification!==classification) throw new Error('EVALUATION_BINDING_MISMATCH');
  // This is a consistency check, never a replacement for the independent normalizer.
  if (!local || local.outcome!==classification || local.uncertainty!==value.unknown) throw new Error('RUNNER_NORMALIZER_DISAGREEMENT');
  return {confirmedViolation:value.confirmedViolation,unknown:value.unknown,allRequiredPassed:value.allRequiredPassed,
    binding:{...root,evidenceHash:binding.evidenceHash,classification:binding.classification}};
}
// This converter does not normalize evidence, mint hashes, infer cluster bounds, or read source/oracle files.
export function toAnalysisInputV1({experiment,design,evaluationBinding:requestedBinding,costEvents=[]}) {
  if (!design || !Array.isArray(design.briefs) || !Array.isArray(design.configs) || !Array.isArray(design.tasks)) throw new Error('DESIGN_REQUIRED');
  if (!Number.isSafeInteger(design.maxBriefsPerCluster) || design.maxBriefsPerCluster<1) throw new Error('FROZEN_MAX_BRIEFS_PER_CLUSTER_REQUIRED');
  const families=new Map();
  for (const brief of design.briefs) {
    if (!nonempty(brief.briefId) || !nonempty(brief.clusterId)) throw new Error('FROZEN_BRIEF_CLUSTER_REQUIRED');
    families.set(brief.clusterId,(families.get(brief.clusterId)??0)+1);
  }
  if ([...families.values()].some(size=>size>design.maxBriefsPerCluster)) throw new Error('OBSERVED_CLUSTER_EXCEEDS_FROZEN_BOUND');
  for (const values of [design.briefs.map(brief=>brief.briefId),design.configs,design.tasks])
    if (values.some(value=>!nonempty(value)) || new Set(values).size!==values.length) throw new Error('DUPLICATE_OR_INVALID_DESIGN_DIMENSION');
  const root=evaluationBinding(requestedBinding??experiment.evaluationBinding);
  if (requestedBinding && experiment.evaluationBinding && !sameBinding(root,evaluationBinding(experiment.evaluationBinding))) throw new Error('ROOT_EVALUATION_BINDING_MISMATCH');
  const statuses={'accepted':'accepted','rejected':'methodRejection','public-rejected':'publicProtocolRejection','error':'methodError','not-executed':'notExecuted'};
  const records=experiment.records.map(record=>{
    if (!nonempty(record.briefId) || !nonempty(record.configId)) throw new Error('ANALYSIS_IDENTIFIERS_REQUIRED');
    if (!statuses[record.proposal] || !['ready','failed','not-executed'].includes(record.preparation)) throw new Error('INVALID_RUNNER_RECORD_STATE');
    const accepted=record.proposal==='accepted';
    if (record.accepted!==undefined && record.accepted!==accepted) throw new Error('ACCEPTANCE_STATE_MISMATCH');
    if (record.acceptanceLocked!==accepted) throw new Error('ACCEPTANCE_LOCK_MISMATCH');
    if (record.candidateHash!==null && !sha(record.candidateHash)) throw new Error('CANDIDATE_SHA256_REQUIRED');
    if (accepted && !sha(record.candidateHash)) throw new Error('ACCEPTED_CANDIDATE_REQUIRED');
    const independent=record.independentEvaluation;
    if (accepted && (!independent || !sameBinding(evaluationBinding(independent.evaluationBinding),root))) throw new Error('INDEPENDENT_EVALUATION_REQUIRED');
    const outcomes={};
    for (const endpoint of ['R','G']) {
      const value=independent?.outcomes?.[endpoint];
      if (accepted && record.eligibility[endpoint]==='eligible') outcomes[endpoint]=normalizedOutcome(value,root,record.evaluation?.[endpoint]);
      else {
        if (record.evaluation?.[endpoint]!=null) throw new Error('NONACCEPTED_OR_INELIGIBLE_OUTCOME');
        if (value!=null) {
          // r3 retains a bound ineligible object in raw evidence; statistics uses an explicit null mask.
          const binding=value.binding;
          if (!accepted || ['confirmedViolation','unknown','allRequiredPassed'].some(key=>value[key]!==false)
            || !binding || binding.classification!==null || !sameBinding(evaluationBinding(binding),root) || !sha(binding.evidenceHash))
            throw new Error('NONACCEPTED_OR_INELIGIBLE_OUTCOME');
        }
        outcomes[endpoint]=null;
      }
    }
    return {briefId:record.briefId,configId:record.configId,taskId:record.taskId,method:record.method,eligibility:structuredClone(record.eligibility),
      preparation:{ready:'ready',failed:'failure','not-executed':'notExecuted'}[record.preparation],
      proposal:{status:statuses[record.proposal],candidateHash:record.candidateHash,
        scopeGuardRejected:record.method==='FULL'&&record.guard?.pass===false&&record.guard?.reason==='scope-unsupported',
        invoked:record.proposal!=='not-executed',acceptanceLocked:record.acceptanceLocked},outcomes,costEventIds:structuredClone(record.costEventIds??[])};
  });
  const actual=new Set();
  for (const record of records) {const key=JSON.stringify([record.briefId,record.configId,record.taskId,record.method]);if(actual.has(key))throw new Error('DUPLICATE_ANALYSIS_SLOT');actual.add(key);}
  const planned=new Set();
  for (const brief of design.briefs) for (const config of design.configs) for (const task of design.tasks) for (const method of METHODS_V1)
    planned.add(JSON.stringify([brief.briefId,config,task,method]));
  if(actual.size!==planned.size||[...planned].some(key=>!actual.has(key)))throw new Error('INCOMPLETE_ANALYSIS_MATRIX');
  return immutable({schemaVersion:'analysis-v04-input-1',datasetId:experiment.datasetId,datasetKind:experiment.datasetKind??experiment.records[0]?.datasetKind??'dev',
    evaluationBinding:root,design:{briefs:design.briefs.map(({briefId,clusterId})=>({briefId,clusterId})),configs:[...design.configs],tasks:[...design.tasks],
      methods:[...METHODS_V1],maxBriefsPerCluster:design.maxBriefsPerCluster,
      independence:{status:design.independence?.status,basis:design.independence?.basis}},records,costEvents:structuredClone(costEvents)});
}
