// Extract expected native leaf identities before sealing. No inference from oracle labels or verdicts.
import {isAbsolute,normalize} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {validateEvaluationPlanR3,copyR3,freezeR3,failR3,validHashR3} from './evaluation-plan-r3.mjs';
export const NATIVE_EVIDENCE_REQUESTS_SCHEMA_R3='v04-native-evidence-requests-r3-1';
function runRequest({runId,sourceSha256,checks,runtimeEvidence},plan){
 if(typeof runId!=='string'||!runId||!validHashR3(sourceSha256)||!Array.isArray(checks)||!runtimeEvidence||!Array.isArray(runtimeEvidence.scenarios))failR3('R3_NATIVE_RUN_EVIDENCE_REQUIRED');
 const scopes=runtimeEvidence.scenarios;if(scopes.length!==plan.runs.length||new Set(scopes.map(s=>s.runKey)).size!==scopes.length||plan.runs.some(r=>!scopes.some(s=>s.runKey===r.runKey))||scopes.some(s=>!Object.hasOwn(s,'nativeJournal')||typeof s.lifecycleComplete!=='boolean'||typeof s.complete!=='boolean'))failR3('R3_NATIVE_PLANNED_JOURNALS_REQUIRED');
 const captures=[],references=[],unavailableAttempts=[],seen=new Map;
 for(const check of checks){const acquisition=check.acquisition??check.retainedEvidence?.acquisition;if(!acquisition)continue;
  for(const sample of acquisition.samples){
   const native=sample.evidence?.native,identity=sample.identity??sample.evidence?.captureIdentity;
   if(!native?.rawSamplePath||!native.rawSampleId||!identity){
    if(sample.state==='ok')failR3('R3_VALID_FACT_NATIVE_REFERENCE_REQUIRED',check.key+':'+sample.sequence);
    unavailableAttempts.push({checkpointKey:check.key,sampleSequence:sample.sequence,state:sample.state,reason:'collection-did-not-produce-a-bound-native-artifact'});continue;
   }
   if(typeof native.rawSamplePath!=='string'||!isAbsolute(native.rawSamplePath)||typeof native.rawSampleId!=='string'||typeof identity.renderId!=='string'||!Number.isInteger(identity.renderEpoch)||!Number.isInteger(identity.viewportEpoch)||!identity.viewport||!Number.isFinite(identity.viewport.width)||!Number.isFinite(identity.viewport.height)||typeof identity.frameId!=='string'||!identity.frameId)failR3('R3_NATIVE_CAPTURE_IDENTITY_REQUIRED');
   const descriptor={path:normalize(native.rawSamplePath),captureId:native.rawSampleId,renderId:identity.renderId,renderEpoch:identity.renderEpoch,viewportEpoch:identity.viewportEpoch,viewport:copyR3(identity.viewport),frameId:identity.frameId,sourceSha256};
   const previous=seen.get(descriptor.path);if(previous&&!isDeepStrictEqual(previous,descriptor))failR3('R3_NATIVE_CAPTURE_PATH_IDENTITY_COLLISION');if(!previous){seen.set(descriptor.path,descriptor);captures.push(descriptor)}
   references.push({checkpointKey:check.key,sampleSequence:sample.sequence,state:sample.state,path:descriptor.path,captureId:descriptor.captureId});
  }
 }
 return{runId,sourceSha256,captures,runtimeScopes:copyR3(scopes),references,unavailableAttempts};
}
export function nativeEvidenceRequestsR3({baselineBundle,evaluation,plan:inputPlan}){
 const plan=validateEvaluationPlanR3(inputPlan);
 if(!baselineBundle?.run||baselineBundle.originalSourceSha256!==baselineBundle.run.sourceSha256||evaluation?.originalSourceSha256!==baselineBundle.originalSourceSha256)failR3('R3_NATIVE_SOURCE_BINDING_REQUIRED');
 const baseline=runRequest(baselineBundle.run,plan);let candidate=null;
 if(evaluation.afterExecution==='executed-once-shared-endpoints')candidate=runRequest({runId:evaluation.provenance?.candidateRunId,sourceSha256:evaluation.candidateSourceSha256,checks:evaluation.checks,runtimeEvidence:evaluation.runtimeEvidence},plan);
 else if(evaluation.afterExecution!=='not-executed-no-eligible-endpoint')failR3('R3_NATIVE_EXECUTION_STATE_REQUIRED');
 return freezeR3({schemaVersion:NATIVE_EVIDENCE_REQUESTS_SCHEMA_R3,baseline,candidate});
}
