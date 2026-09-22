import {normalizeRuntimeJournalR3} from './runtime-evidence-r3.mjs';
// Full-domain Node evaluator. Private rules are never supplied to browser collectors or methods.
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {APP_SCRIPT_ENTRY_CONTRACT} from './entry-contract-r2.mjs';
import {measureRulesUntilDeadlineR3,validateMeasurementExpectationR3,validateMeasurementPolicyR3,realMeasurementClockR3} from './measurement-r3.mjs';
import {deriveObservationFactR3,publicFactTargetsR3} from './evaluation-facts-r3.mjs';
import {validateEvaluationPlanR3,evaluationProvenanceR3,copyR3,freezeR3,digestR3,hashBytesR3,validHashR3,fieldsR3,failR3,errorR3,viewportR3,finiteR3} from './evaluation-plan-r3.mjs';
export const EVALUATOR_REVISION_R3='v04-evaluate-adapter-r3-1';
export const CALIBRATION_BINDING_SCHEMA_R3='v04-calibration-binding-r3-1';
export const EVALUATION_RUN_SCHEMA_R3='v04-evaluation-run-r3-1';
const verifiedCalibrations=new WeakSet();
const fatalCodes=new Set(['SESSION_CLOSED','NO_RENDER','CONTAINMENT_CONTROL_FAILED','SNAPSHOT_NODE_LIMIT','CDP_CLOSED','CDP_SOCKET_ERROR','BROWSER_CLEANUP_FAILED','RENDER_LIFECYCLE_BUSY','VIEWPORT_CHANGED','VIEWPORT_TRANSITION_PENDING','R3_OBSERVATION_PROVENANCE_MISMATCH']);
function calibrationRequired(value){if(!verifiedCalibrations.has(value))failR3('VERIFIED_R3_CALIBRATION_REQUIRED')}
export async function loadCalibratedPolicyR3({policyPath,expectedFileSha256,expectedObserverSha256,expectedObserverRevision,expectedEntryHelperSha256,expectedLayoutHelperSha256,expectedRunnerSha256,expectedRuntimeHashes,expectedCompilerHashes,readBytes=readFile}={}){
 for(const pin of [expectedFileSha256,expectedObserverSha256,expectedEntryHelperSha256,expectedLayoutHelperSha256,expectedRunnerSha256])if(!validHashR3(pin))failR3('R3_CALIBRATION_PINS_REQUIRED');
 if(typeof policyPath!=='string'||typeof expectedObserverRevision!=='string'||!expectedObserverRevision.startsWith('v04-observer-r3-'))failR3('R3_CALIBRATION_PINS_REQUIRED');
 const bytes=await readBytes(policyPath);if(hashBytesR3(bytes)!==expectedFileSha256)failR3('R3_CALIBRATION_FILE_HASH_MISMATCH');let policy;try{policy=JSON.parse(Buffer.from(bytes).toString('utf8'))}catch{failR3('R3_CALIBRATION_JSON_INVALID')}
 const {policyId,...body}=policy;if(policy.schema!=='r3-layout-value-native-witness-v1'||policyId!=='r3-calibration-'+hashBytesR3(JSON.stringify(body)))failR3('R3_CALIBRATION_POLICY_DIGEST_MISMATCH');
 for(const [field,pin]of [['observerSha256',expectedObserverSha256],['entryHelperSha256',expectedEntryHelperSha256],['layoutHelperSha256',expectedLayoutHelperSha256],['runnerSha256',expectedRunnerSha256]])if(policy[field]!==pin)failR3('R3_CALIBRATION_SOURCE_PIN_MISMATCH',field);
 if(!expectedRuntimeHashes||!expectedCompilerHashes||!Object.values(expectedRuntimeHashes).every(validHashR3)||!Object.values(expectedCompilerHashes).every(validHashR3)||!isDeepStrictEqual(policy.runtimeHashes,expectedRuntimeHashes)||!isDeepStrictEqual(policy.compilerHashes,expectedCompilerHashes)||!['react.umd.js','react-dom.umd.js'].every(k=>validHashR3(expectedRuntimeHashes[k])))failR3('R3_CALIBRATION_RUNTIME_PIN_MISMATCH');
 if(!policy.fixtureHashes||!Object.values(policy.fixtureHashes).every(validHashR3)||!policy.browserVersion||!Array.isArray(policy.rules)||!policy.rules.length)failR3('R3_CALIBRATION_PROVENANCE_REQUIRED');
 const browserVersionKey=hashBytesR3(JSON.stringify(Object.fromEntries(Object.entries(policy.browserVersion).sort(([a],[b])=>a.localeCompare(b))))),types=new Set;
 for(const rule of policy.rules){if(typeof rule.type!=='string'||types.has(rule.type)||rule.browserVersionKey!==browserVersionKey||rule.validated!==true||rule.emptyMeansEmpty!==true||!Number.isInteger(rule.emptyWitnessCount)||rule.emptyWitnessCount<4||!Number.isInteger(rule.nonemptyWitnessCount)||rule.nonemptyWitnessCount<4||!rule.emptyEncoding||Object.keys(rule.emptyEncoding).length!==3)failR3('R3_CALIBRATION_RULE_INVALID');types.add(rule.type)}
 const binding=freezeR3({schemaVersion:CALIBRATION_BINDING_SCHEMA_R3,policy,policyId,policyFileSha256:expectedFileSha256,observerSha256:expectedObserverSha256,observerRevision:expectedObserverRevision,entryHelperSha256:expectedEntryHelperSha256,layoutHelperSha256:expectedLayoutHelperSha256,runnerSha256:expectedRunnerSha256,runtimeHashes:copyR3(expectedRuntimeHashes),compilerHashes:copyR3(expectedCompilerHashes),browserVersionKey});verifiedCalibrations.add(binding);return binding;
}
function environmentRequired(environment,calibration,entryContract){
 if(!environment||typeof environment!=='object'||environment.entryContract!==entryContract||!environment.runtimeHashes||!environment.compilerHashes||!isDeepStrictEqual(environment.runtimeHashes,calibration.runtimeHashes)||!isDeepStrictEqual(environment.compilerHashes,calibration.compilerHashes))failR3('R3_ENVIRONMENT_RUNTIME_OR_ABI_MISMATCH');
 if(environment.observerSha256!==calibration.observerSha256||environment.observerRevision!==calibration.observerRevision||environment.entryHelperSha256!==calibration.entryHelperSha256||environment.layoutHelperSha256!==calibration.layoutHelperSha256||environment.calibrationPolicyFileSha256!==calibration.policyFileSha256||!isDeepStrictEqual(environment.browserVersion,calibration.policy.browserVersion))failR3('R3_ENVIRONMENT_BINDING_MISMATCH');
 if(!environment.dependencyHashes||typeof environment.dependencyHashes!=='object'||!Object.keys(environment.dependencyHashes).length||!Object.values(environment.dependencyHashes).every(validHashR3))failR3('R3_ENVIRONMENT_DEPENDENCY_PINS_REQUIRED');digestR3(environment);
}
async function bounded(operation,{clock,budgetMs,signal}){
 const cutoff=clock.now()+budgetMs,controller=new AbortController();let listener;
 const cancelled=new Promise(resolve=>{listener=()=>resolve({error:{code:'EXTERNAL_ABORT',message:'Evaluation interrupted'}});signal?.addEventListener('abort',listener,{once:true});if(signal?.aborted)listener()});
 try{const r=await Promise.race([Promise.resolve().then(()=>{if(signal?.aborted)failR3('EXTERNAL_ABORT');return operation()}).then(value=>({value,completed:clock.now()}),error=>({error:errorR3(error)})),clock.sleep(budgetMs,controller.signal).then(()=>({error:{code:'R3_STAGE_TIMEOUT',message:'Bounded lifecycle stage exhausted'}}),()=>({timerCancelled:true})),cancelled]);if(r.error)failR3(r.error.code,r.error.message);if(r.completed>=cutoff)failR3('R3_STAGE_TIMEOUT','Completion at or after cutoff');return r.value}finally{controller.abort();signal?.removeEventListener('abort',listener)}
}
function receiptMatches(value,calibration,request,viewport,sourceSha256){
 if(!value||value.sourceSha256!==sourceSha256||hashBytesR3(request.sourceBytes)!==sourceSha256||value.entryContract!==request.entryContract||value.observerSha256!==calibration.observerSha256||value.observerRevision!==calibration.observerRevision||value.entryHelperSha256!==calibration.entryHelperSha256||value.layoutHelperSha256!==calibration.layoutHelperSha256||value.calibrationPolicyId!==calibration.policyId||!isDeepStrictEqual(value.runtimeHashes,calibration.runtimeHashes)||!isDeepStrictEqual(value.compilerHashes,calibration.compilerHashes)||!isDeepStrictEqual(value.browserVersion,calibration.policy.browserVersion)||!isDeepStrictEqual(value.viewport,viewport)||typeof value.renderId!=='string'||!Number.isInteger(value.renderEpoch)||!Number.isInteger(value.viewportEpoch))failR3('R3_RENDER_RECEIPT_PROVENANCE_MISMATCH');
}
export function createLifecycleR3({session,calibration,request,viewport}){
 calibrationRequired(calibration);const sourceSha256=hashBytesR3(request.sourceBytes);let receipt=null,invalid=null,abortPromise=null;
 const lifecycle={get receipt(){return receipt},get reason(){return invalid},get abortStarted(){return abortPromise!==null},
  get usable(){const d=session.diagnostics;if(d?.protocolFailure||d?.cleanupPending||d?.cleanupFailure)invalid??={code:'NO_RENDER',message:'Transport or cleanup invalidated'};if(receipt&&(d?.renderEpoch!==undefined&&d.renderEpoch!==receipt.renderEpoch||d?.viewportEpoch!==undefined&&d.viewportEpoch!==receipt.viewportEpoch))invalid??={code:'VIEWPORT_CHANGED',message:'Bound observation epoch invalidated'};return invalid===null},
  invalidate(error){invalid??=errorR3(error)},bind(value,size=viewport){if(invalid)failR3('NO_RENDER');receiptMatches(value,calibration,request,size,sourceSha256);receipt=freezeR3(copyR3(value));return receipt},
  bindViewport(update,size){if(!receipt||update?.renderId!==receipt.renderId||update.renderEpoch!==receipt.renderEpoch||!Number.isInteger(update.viewportEpoch)||update.viewportEpoch<=receipt.viewportEpoch||!isDeepStrictEqual(update.viewport,size)||update.stateSemantics!=='preserve-live-document-and-React-state-no-remount'||update.actualLayoutViewport?.clientWidth!==size.width||update.actualLayoutViewport?.clientHeight!==size.height)failR3('R3_VIEWPORT_PRESERVATION_RECEIPT_MISMATCH');receipt=freezeR3({...copyR3(receipt),viewport:copyR3(size),viewportEpoch:update.viewportEpoch});return receipt},
  abort({reason='evaluation-abort',signal}={}){invalid??={code:'NO_RENDER',message:String(reason)};abortPromise??=Promise.resolve().then(()=>session.abortRender({reason,signal}));return abortPromise}
 };return lifecycle;
}
export function createObservationCollectorR3(options={}){
 fieldsR3(options,['session','observation','catalog','viewport','calibration','lifecycle'],'PRIVATE_OR_UNKNOWN_R3_COLLECTOR_FIELD');const {session,observation,catalog,viewport,calibration,lifecycle}=options;calibrationRequired(calibration);viewportR3(viewport);
 if(typeof session?.captureFacts!=='function'||!lifecycle?.receipt)failR3('R3_FACT_SESSION_REQUIRED');const targets=publicFactTargetsR3(observation,catalog),payload={targets:targets.map(({key,locator})=>({key,locator})),includeDocument:true};
 return async({signal,remainingMs,sequence}={})=>{
  if(signal?.aborted)failR3('NO_RENDER','Aborted collector');if(!lifecycle.usable)failR3(lifecycle.reason?.code??'NO_RENDER',lifecycle.reason?.message);if(!finiteR3(remainingMs)||remainingMs<=0)return{state:'unknown',error:{code:'OBSERVATION_BUDGET_EXHAUSTED',message:'No outer budget remains'}};
  let retainedNative=null,retainedIdentity=null;try{const result=await session.captureFacts(copyR3(payload));retainedNative=copyR3(result.evidence??null);retainedIdentity=copyR3(result.identity??null);if(signal?.aborted)failR3('NO_RENDER','Late capture after cancellation');if(!lifecycle.usable)failR3(lifecycle.reason.code,lifecycle.reason.message);
   if(result.state!=='ok'){const error=errorR3(result.error??{code:'NATIVE_FACTS_UNAVAILABLE',message:'No observed facts'});if(fatalCodes.has(error.code)){lifecycle.invalidate(error);throw Object.assign(new Error(error.message),{code:error.code})}return{state:'unknown',error,evidence:{sequence,native:copyR3(result.evidence??null)}}}
   const id=result.identity,e=result.evidence,r=lifecycle.receipt;
   if(!id||id.renderId!==r.renderId||id.renderEpoch!==r.renderEpoch||id.viewportEpoch!==r.viewportEpoch||!isDeepStrictEqual(id.viewport,viewport)||e?.observerSha256!==calibration.observerSha256||e.entryHelperSha256!==calibration.entryHelperSha256||e.layoutHelperSha256!==calibration.layoutHelperSha256||e.calibrationPolicyId!==calibration.policyId||!isDeepStrictEqual(e.browserVersion,calibration.policy.browserVersion))failR3('R3_OBSERVATION_PROVENANCE_MISMATCH');
   const derived=deriveObservationFactR3({result,observation,catalog,viewport});
   if(!Array.isArray(id.targets)||id.targets.length!==targets.length)failR3('R3_OBSERVATION_PROVENANCE_MISMATCH');
   for(const target of targets){const identity=id.targets.filter(t=>t.key===target.key),actual=derived.targets.find(t=>t.key===target.key);if(identity.length!==1||identity[0].locatorDigest!==hashBytesR3(JSON.stringify(target.locator))||!isDeepStrictEqual(identity[0].backendNodeIds,actual.backendNodeIds)||!isDeepStrictEqual(identity[0].contextBackendNodeIds,actual.contextBackendNodeIds))failR3('R3_OBSERVATION_PROVENANCE_MISMATCH')}
   return{state:'ok',actual:derived.fact,identity:{renderId:id.renderId,renderEpoch:id.renderEpoch,viewportEpoch:id.viewportEpoch,viewport:copyR3(id.viewport),frameId:id.frameId,targets:copyR3(id.targets)},evidence:{sequence,deadlineAuthority:'outer-node-measurer-only',remainingBudgetPropagatedToCDP:false,native:copyR3(e),...derived.evidence}};
  }catch(error){const record=errorR3(error);if(fatalCodes.has(record.code)){lifecycle.invalidate(record);throw Object.assign(new Error(record.message),{code:record.code})}return{state:'unknown',error:record,evidence:{sequence,native:retainedNative,captureIdentity:retainedIdentity}}}
 };
}
export async function runEvaluationR3({renderRequest,plan:inputPlan,sessionFactory,calibration,environment,policy:inputPolicy={},ruleSets,mode,clock=realMeasurementClockR3,signal,renderTimeoutMs=15000,actionTimeoutMs=5000}={}){
 calibrationRequired(calibration);const plan=validateEvaluationPlanR3(inputPlan),policy=validateMeasurementPolicyR3(inputPolicy);
 if(!['baseline','accepted'].includes(mode)||typeof sessionFactory!=='function')failR3('R3_RUN_DEPENDENCY_REQUIRED');
 fieldsR3(renderRequest,['sourceBytes','format','trustLevel','staticGate','artifactId','viewport','entryContract','fixturePath'],'PRIVATE_OR_UNKNOWN_R3_RENDER_FIELD');
 if(!(renderRequest.sourceBytes instanceof Uint8Array)||!['jsx','html'].includes(renderRequest.format)||!['restricted-generated','trusted-microfixture'].includes(renderRequest.trustLevel)||renderRequest.format==='jsx'&&renderRequest.entryContract!==APP_SCRIPT_ENTRY_CONTRACT||renderRequest.staticGate?.accepted!==true||renderRequest.staticGate.sourceSha256!==hashBytesR3(renderRequest.sourceBytes))failR3('R3_SOURCE_BOUND_FORMAL_RENDER_REQUIRED');
 if(renderRequest.fixturePath!==undefined&&renderRequest.trustLevel!=='trusted-microfixture')failR3('TRUSTED_FIXTURE_PATH_FORBIDDEN');
 environmentRequired(environment,calibration,renderRequest.entryContract);environment=freezeR3(copyR3(environment));
 for(const n of [renderTimeoutMs,actionTimeoutMs])if(!Number.isInteger(n)||n<1||n>60000)failR3('R3_STAGE_BUDGET_REQUIRED');
 if(!ruleSets||!isDeepStrictEqual(Object.keys(ruleSets).sort(),[...plan.expectedKeys].sort()))failR3('R3_ALL_RULE_KEYS_REQUIRED');for(const rules of Object.values(ruleSets)){if(!rules||!Object.keys(rules).length)failR3('R3_PRIVATE_RULES_REQUIRED');for(const expected of Object.values(rules))validateMeasurementExpectationR3(expected)}
 ruleSets=freezeR3(copyR3(ruleSets));const sourceBytes=Uint8Array.from(renderRequest.sourceBytes),sourceSha256=hashBytesR3(sourceBytes),runId=randomUUID(),checks=[],actions=[],errors=[],scenarios=[],receipts=[],runtimeScopes=[],runtimeEvents=[],usedSessions=new WeakSet;
 for(const [runIndex,run]of plan.runs.entries()){
  let session=null,lifecycle=null,blocked=null,rendered=false,viewport=copyR3(run.initialViewport),replay=[];const scenario={runKey:run.runKey,status:'pending',renderCount:0};scenarios.push(scenario);
  const request={...copyR3(renderRequest),sourceBytes:Uint8Array.from(sourceBytes),viewport,artifactId:'r3-'+runId+'-'+runIndex};
  async function stop(error){blocked=errorR3(error);lifecycle?.invalidate(blocked);if(session&&lifecycle&&!lifecycle.abortStarted)try{await bounded(()=>lifecycle.abort({reason:blocked.code}),{clock,budgetMs:policy.cleanupTimeoutMs})}catch(cleanup){errors.push({runKey:run.runKey,phase:'cleanup',error:errorR3(cleanup)})}}
  try{
   if(signal?.aborted)failR3('EXTERNAL_ABORT');session=await bounded(()=>sessionFactory({artifactId:request.artifactId,viewport:copyR3(viewport),sourceSha256}),{clock,budgetMs:renderTimeoutMs,signal});
   if(!session||usedSessions.has(session)||typeof session.render!=='function'||typeof session.abortRender!=='function'||typeof session.close!=='function')failR3('FRESH_INDEPENDENT_SCENARIO_SESSION_REQUIRED');usedSessions.add(session);
   if(session.diagnostics?.cleanupPending||session.diagnostics?.cleanupFailure)failR3('RENDER_LIFECYCLE_BUSY');lifecycle=createLifecycleR3({session,calibration,request,viewport});
   const receipt=await bounded(()=>session.render(request),{clock,budgetMs:renderTimeoutMs,signal});rendered=true;lifecycle.bind(receipt);receipts.push({runKey:run.runKey,stage:'render',receipt:copyR3(receipt)});scenario.renderCount++;
  }catch(error){errors.push({runKey:run.runKey,phase:'render',error:errorR3(error)});await stop(error)}
  for(const item of run.expanded){
   if(item.type==='check'){
    const checkpoint=item.checkpoint,provenance=evaluationProvenanceR3({plan,checkpoint,sourceSha256,runId,calibration,environment,policy});
    if(blocked||!lifecycle?.usable){if(!blocked)await stop(lifecycle?.reason??{code:'NO_RENDER',message:'Scene invalidated before required checkpoint'});checks.push({key:checkpoint.key,provenance,notMeasured:{reason:'scenario-dependency-invalidated',error:blocked??lifecycle?.reason??{code:'NO_RENDER',message:'No bound scene'}}});continue}
    if(!isDeepStrictEqual(viewport,checkpoint.viewport)||!isDeepStrictEqual(replay,checkpoint.replay)){const error={code:'R3_REPLAY_PROVENANCE_MISMATCH',message:'Performed public prefix differs from frozen plan'};checks.push({key:checkpoint.key,provenance,notMeasured:{reason:'replay-binding-mismatch',error}});await stop(error);continue}
    try{
     const collect=createObservationCollectorR3({session,observation:checkpoint.observation,catalog:plan.catalog,viewport,calibration,lifecycle});
     const measured=await measureRulesUntilDeadlineR3({collect,rules:ruleSets[checkpoint.key],policy,geometry:['rect','gap','grid','order','overflow','documentOverflow','documentHorizontalOverflow','withinViewport'].includes(checkpoint.observation.kind),clock,signal,abort:args=>lifecycle.abort(args)});
     if(!lifecycle.usable&&measured.acquisition.health.sessionUsable)checks.push({key:checkpoint.key,provenance,notMeasured:{reason:'lifecycle-invalidated-at-acquisition-boundary',error:lifecycle.reason},retainedEvidence:measured});else checks.push({key:checkpoint.key,provenance,...measured});
     if(!measured.acquisition.health.sessionUsable||!lifecycle.usable){await stop(lifecycle.reason??measured.acquisition.health.terminalError??{code:'NO_RENDER',message:'Acquisition invalidated session'})}
    }catch(error){checks.push({key:checkpoint.key,provenance,notMeasured:{reason:'measurement-setup-or-domain-error',error:errorR3(error)}});errors.push({runKey:run.runKey,key:checkpoint.key,phase:'measurement',error:errorR3(error)});if(fatalCodes.has(error.code))await stop(error)}
   }else{
    const step=item.step,action={runKey:run.runKey,stepIndex:item.stepIndex,action:copyR3(step)};
    if(blocked||!lifecycle?.usable){if(!blocked)await stop(lifecycle?.reason??{code:'NO_RENDER',message:'Scene invalidated before required action'});actions.push({...action,status:'skipped',error:blocked??lifecycle?.reason});continue}
    try{let evidence;
     if(step.op==='reload'){
      const previous=lifecycle.receipt;evidence=await bounded(()=>session.reload({state:'reset-to-source',artifactId:request.artifactId+'-reload-'+item.stepIndex}),{clock,budgetMs:renderTimeoutMs,signal});const receipt=evidence?.receipt;
      if(!receipt||receipt.renderEpoch<=previous.renderEpoch||receipt.viewportEpoch<=previous.viewportEpoch||evidence.stateSemantics!=='reset-to-rendered-source-bytes-new-document-new-React-state-new-profile')failR3('R3_RELOAD_RESET_RECEIPT_MISMATCH');lifecycle.bind(receipt,viewport);receipts.push({runKey:run.runKey,stage:'reload',receipt:copyR3(receipt)});scenario.renderCount++;
     }else if(step.op==='setViewport'){const size={width:step.width,height:step.height};evidence=await bounded(()=>session.setViewport({...size,state:'preserve'}),{clock,budgetMs:actionTimeoutMs,signal});lifecycle.bindViewport(evidence,size);viewport=size;receipts.push({runKey:run.runKey,stage:'setViewport',receipt:copyR3(evidence)})}
     else evidence=await bounded(()=>session.act({action:step.op,locator:copyR3(plan.catalog[step.targetRef]),...(step.op==='fill'?{value:step.value}:step.op==='key'?{key:step.key}:{})}),{clock,budgetMs:actionTimeoutMs,signal});
     actions.push({...action,status:'performed',evidence:copyR3(evidence)});replay.push({...copyR3(step),...(step.targetRef?{locator:copyR3(plan.catalog[step.targetRef])}:{})});
    }catch(error){actions.push({...action,status:'error',error:errorR3(error)});await stop(error)}
   }
  }
  const nativeJournal=copyR3(session?.diagnostics?.runtimeJournal??null),runtime=normalizeRuntimeJournalR3(nativeJournal,{runKey:run.runKey,sourceSha256,runId});let lifecycleComplete=rendered&&!blocked&&lifecycle?.usable===true&&actions.filter(a=>a.runKey===run.runKey).every(a=>a.status==='performed');runtime.complete=runtime.complete&&lifecycleComplete;runtimeEvents.push(...runtime.events);
  if(session)try{await bounded(()=>session.close(),{clock,budgetMs:policy.cleanupTimeoutMs})}catch(error){runtime.complete=false;lifecycleComplete=false;errors.push({runKey:run.runKey,phase:'close',error:errorR3(error)})}
  runtimeScopes.push({runKey:run.runKey,complete:runtime.complete,lifecycleComplete,nativeJournal});scenario.status=blocked?'dependency-blocked':'completed';scenario.error=blocked;
 }
 if(checks.length!==plan.expectedKeys.length||new Set(checks.map(c=>c.key)).size!==checks.length||checks.some(c=>!plan.expectedKeys.includes(c.key)))failR3('R3_FINAL_EXPECTED_KEYS_AUDIT_ERROR');
 return{schemaVersion:EVALUATION_RUN_SCHEMA_R3,evaluatorRevision:EVALUATOR_REVISION_R3,runId,mode,sourceSha256,planDigest:plan.planDigest,environmentDigest:digestR3(environment),calibrationBindingDigest:digestR3(calibration),measurementPolicy:copyR3(policy),checks,actions,errors,scenarios,receipts,runtimeEvidence:{complete:runtimeScopes.every(s=>s.complete),scenarios:runtimeScopes,events:runtimeEvents},formalReadinessClaimed:false};
}
