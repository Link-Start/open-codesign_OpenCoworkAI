// Node-only bridge. Public fact collection and private expectations remain separate.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { measureUntilDeadline, realMeasurementClock, validateMeasurementPolicy, validateMeasurementExpectation, BASELINE_SCHEMA_VERSION } from './measurement-r2.mjs';
import { classifySuiteR2, SUITE_SCHEMA_VERSION } from './measurement-records-r2.mjs';
import { APP_SCRIPT_ENTRY_CONTRACT } from './entry-contract-r2.mjs';
export const ADAPTER_REVISION = 'v04-evaluate-adapter-r2-1';
export const CALIBRATION_BINDING_SCHEMA = 'v04-calibration-binding-r2-1';
export const BOUND_BASELINE_SCHEMA = 'v04-bound-baseline-r2-1';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => hash(JSON.stringify(value));
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const copy = value => structuredClone(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const fail = (code, detail = '') => { throw Object.assign(new Error(code + (detail ? ': ' + detail : '')), { code }); };
const errorRecord = error => ({ code: typeof error?.code === 'string' ? error.code : typeof error === 'string' ? error.split(':', 1)[0] : 'ADAPTER_ERROR', message: String(error?.message ?? error) });
const FATAL = new Set(['SESSION_CLOSED','NO_RENDER','CONTAINMENT_CONTROL_FAILED','SNAPSHOT_NODE_LIMIT','CDP_CLOSED','CDP_SOCKET_ERROR','PAGE_RUNTIME_ERROR','BROWSER_CLEANUP_FAILED','RENDER_LIFECYCLE_BUSY']);
function fields(value, allowed, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(code);
}
function freeze(value) { if (value && typeof value === 'object') { for (const part of Object.values(value)) freeze(part); Object.freeze(value); } return value; }
const verifiedBindings = new WeakSet();
/** Exact bytes and observer pins are supplied by the parent freeze, never by candidate source. */
export async function loadCalibratedPolicyR2({ policyPath, expectedFileSha256, expectedObserverSha256, expectedObserverRevision,
  expectedRuntimeHashes, readBytes = readFile } = {}) {
  if (typeof policyPath !== 'string' || !validHash(expectedFileSha256) || !validHash(expectedObserverSha256)
      || typeof expectedObserverRevision !== 'string' || !expectedObserverRevision.startsWith('v04-observer-r2-')) fail('CALIBRATION_PINS_REQUIRED');
  const bytes = await readBytes(policyPath);
  if (hash(bytes) !== expectedFileSha256) fail('CALIBRATION_FILE_HASH_MISMATCH');
  let policy; try { policy = JSON.parse(Buffer.from(bytes).toString('utf8')); } catch { fail('CALIBRATION_JSON_INVALID'); }
  if (!policy || typeof policy!=='object' || Array.isArray(policy)) fail('CALIBRATION_POLICY_INVALID');
  const { policyId, ...body } = policy;
  if (policy.schema !== 'r2-sparse-native-witness-v1' || policyId !== 'r2-sparse-' + digest(body)) fail('CALIBRATION_POLICY_DIGEST_MISMATCH');
  if (policy.observerSha256 !== expectedObserverSha256 || !validHash(policy.runnerSha256)) fail('CALIBRATION_OBSERVER_MISMATCH');
  for (const hashes of [policy.runtimeHashes, policy.fixtureHashes]) {
    if (!hashes || !Object.keys(hashes).length || !Object.values(hashes).every(validHash)) fail('CALIBRATION_HASH_PROVENANCE_REQUIRED');
  }
  if (expectedRuntimeHashes && !isDeepStrictEqual(expectedRuntimeHashes, policy.runtimeHashes)) fail('CALIBRATION_RUNTIME_MISMATCH');
  if (!policy.browserVersion || !Array.isArray(policy.rules) || !policy.rules.length) fail('CALIBRATION_RULES_REQUIRED');
  const browserKey = digest(Object.fromEntries(Object.entries(policy.browserVersion).sort(([a], [b]) => a.localeCompare(b)))), types = new Set();
  for (const rule of policy.rules) {
    const encoding = rule.type === 'input:text' ? { textValue: 'entry-absent', inputValue: 'string-index-minus-one', axValue: 'absent' }
      : rule.type === 'textarea' ? { textValue: 'string-index-minus-one', inputValue: 'entry-absent', axValue: 'absent' } : null;
    if (!encoding || types.has(rule.type) || !isDeepStrictEqual(rule.emptyEncoding, encoding) || rule.browserVersionKey !== browserKey
        || rule.validated !== true || rule.emptyMeansEmpty !== true || !Number.isInteger(rule.emptyWitnessCount) || rule.emptyWitnessCount < 4
        || !Number.isInteger(rule.nonemptyWitnessCount) || rule.nonemptyWitnessCount < 4 || typeof rule.ruleId !== 'string') fail('CALIBRATION_RULE_INVALID');
    types.add(rule.type);
  }
  const binding = freeze({ schemaVersion: CALIBRATION_BINDING_SCHEMA, policy, policyId, policyFileSha256: expectedFileSha256,
    observerSha256: expectedObserverSha256, observerRevision: expectedObserverRevision, browserVersionKey: browserKey });
  verifiedBindings.add(binding); return binding;
}
function bindingRequired(binding) { if (!verifiedBindings.has(binding)) fail('VERIFIED_CALIBRATION_BINDING_REQUIRED'); }
export function publicLocatorR2(locator, depth = 0) {
  if (depth > 8 || !locator || Object.getPrototypeOf(locator) !== Object.prototype) fail('INVALID_PUBLIC_LOCATOR');
  const allowed = locator.by === 'role' ? ['by','role','name','exact','within'] : locator.by === 'text' ? ['by','text','exact','within'] : null;
  if (!allowed) fail('INVALID_PUBLIC_LOCATOR'); fields(locator, allowed, 'PRIVATE_OR_UNKNOWN_LOCATOR_FIELD');
  if (locator.exact !== true || typeof locator[locator.by] !== 'string' || !locator[locator.by] || locator[locator.by].length > 4096
      || (own(locator,'name') && (typeof locator.name !== 'string' || locator.name.length > 4096))) fail('INVALID_PUBLIC_LOCATOR');
  return freeze({ by: locator.by, [locator.by]: locator[locator.by], ...(own(locator,'name') ? {name:locator.name} : {}), exact:true,
    ...(locator.within ? {within:publicLocatorR2(locator.within,depth+1)} : {}) });
}
function publicCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) fail('PUBLIC_CATALOG_REQUIRED');
  return freeze(Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, publicLocatorR2(value)])));
}
function resolve(catalog, ref) { if (typeof ref !== 'string' || !own(catalog,ref)) fail('PUBLIC_TARGET_REFERENCE_UNKNOWN'); return publicLocatorR2(catalog[ref]); }
const OBSERVATIONS = {value:['kind','targetRef'],text:['kind','targetRef'],count:['kind','targetRef'],enabled:['kind','targetRef'],attribute:['kind','targetRef','attribute'],rect:['kind','targetRef','field'],withinViewport:['kind','targetRef','axis','tolerance']};
function validateObservation(observation) {
  if (!OBSERVATIONS[observation?.kind]) fail('R2_OBSERVATION_UNSUPPORTED', String(observation?.kind));
  fields(observation,OBSERVATIONS[observation.kind],'INVALID_R2_OBSERVATION');
  if (observation.kind==='attribute' && (typeof observation.attribute!=='string'||!observation.attribute)) fail('INVALID_R2_ATTRIBUTE');
  if (observation.kind==='rect'&&!['x','y','width','height','right','bottom'].includes(observation.field)) fail('INVALID_R2_RECT_FIELD');
  if (observation.kind==='withinViewport'&&(observation.axis!=='x'||!finite(observation.tolerance)||observation.tolerance<0)) fail('INVALID_R2_VIEWPORT_OBSERVATION');
}
function viewportRequired(viewport) { if (!viewport||!Number.isInteger(viewport.width)||!Number.isInteger(viewport.height)||viewport.width<200||viewport.height<200||viewport.width>4096||viewport.height>4096) fail('INVALID_R2_VIEWPORT'); }
export function createScenarioLifecycleR2({session,calibration,receipt}={}) {
  bindingRequired(calibration);
  if (!session || typeof session.abortRender!=='function') fail('R2_SESSION_ABORT_REQUIRED');
  let invalidated=false, invalidReason=null, abortPromise=null, boundReceipt=null;
  function bindReceipt(value) {
    if (invalidated) fail('NO_RENDER');
    if (!value || value.observerRevision!==calibration.observerRevision || value.observerSha256!==calibration.observerSha256
        || !isDeepStrictEqual(value.browserVersion,calibration.policy.browserVersion) || !isDeepStrictEqual(value.runtimeHashes,calibration.policy.runtimeHashes)
        || !Number.isInteger(value.renderEpoch)||typeof value.renderId!=='string') fail('R2_RENDER_PROVENANCE_MISMATCH');
    boundReceipt=freeze(copy(value)); return boundReceipt;
  }
  function invalidate(reason) { invalidated=true; invalidReason??=errorRecord(reason); }
  const lifecycle={
    bindReceipt,invalidate,
    get receipt(){return boundReceipt;},
    get reason(){return invalidReason;},
    get abortStarted(){return abortPromise!==null;},
    get usable(){
      const d=session.diagnostics;
      if(d?.pageErrors?.length)invalidate({code:'PAGE_RUNTIME_ERROR',message:JSON.stringify(d.pageErrors)});
      if (d?.protocolFailure||d?.cleanupPending||d?.cleanupFailure||(boundReceipt&&d?.renderEpoch!==undefined&&d.renderEpoch!==boundReceipt.renderEpoch)) invalidate({code:'NO_RENDER',message:'Browser lifecycle invalidated'});
      return !invalidated;
    },
    abort({reason='observation-abort',signal}={}) {
      invalidate({code:'NO_RENDER',message:String(reason)});
      abortPromise??=Promise.resolve().then(()=>session.abortRender({reason,signal}));
      return abortPromise;
    },
  };
  if(receipt)bindReceipt(receipt);return lifecycle;
}
/** No expect, baseline, comparator, condition or private check ID is accepted by this factory. */
export function createObservationCollectorR2(options={}) {
  fields(options,['session','observation','catalog','viewport','calibration','lifecycle'],'PRIVATE_OR_UNKNOWN_COLLECTOR_FIELD');
  const {session,observation,viewport,calibration,lifecycle}=options;
  bindingRequired(calibration);validateObservation(observation);viewportRequired(viewport);
  if(typeof session?.inspect!=='function'||!lifecycle?.receipt)fail('R2_BOUND_SESSION_REQUIRED');
  const locator=resolve(options.catalog,observation.targetRef), observationCopy=copy(observation), viewportCopy=copy(viewport);
  const locatorDigest=digest(locator),viewportKey=digest(viewportCopy);let contextDepth=0;for(let l=locator.within;l;l=l.within)contextDepth++;
  return async({signal,remainingMs,sequence}={})=>{
    if(signal?.aborted)throw Object.assign(new Error('Collection aborted'),{code:'NO_RENDER'});
    if(!lifecycle.usable)throw Object.assign(new Error(lifecycle.reason?.message??'Render invalidated'),{code:lifecycle.reason?.code??'NO_RENDER'});
    if(!finite(remainingMs)||remainingMs<=0)return{state:'unknown',error:{code:'OBSERVATION_BUDGET_EXHAUSTED',message:'No remaining outer budget'}};
    try{
      // Deliberately no spreading of observation/check/private data into the browser query.
      const result=await session.inspect({locator});
      if(signal?.aborted)fail('NO_RENDER','Late result after cancellation');if(!lifecycle.usable)fail(lifecycle.reason?.code??'NO_RENDER',lifecycle.reason?.message??'Late result after invalidation');
      if(result.renderId!==lifecycle.receipt.renderId||result.renderEpoch!==lifecycle.receipt.renderEpoch)fail('NO_RENDER','Stale render identity');
      if(result.calibrationPolicyId!==calibration.policyId||!isDeepStrictEqual(result.browserVersion,calibration.policy.browserVersion))fail('CONTAINMENT_CONTROL_FAILED','Observation provenance mismatch');
      if(!Array.isArray(result.elements)||!Number.isInteger(result.matchCount)||result.matchCount<0||result.elements.length!==result.matchCount)fail('INVALID_INSPECTION_RESULT');
      const contexts=result.contextBackendNodeIds??[];
      if(!Array.isArray(contexts)||contexts.length!==contextDepth||contexts.some(id=>!Number.isInteger(id)||id<=0))fail('LOCATOR_CONTEXT_IDENTITY_UNAVAILABLE');
      if(result.elements.some(e=>!Number.isInteger(e.backendNodeId)||e.backendNodeId<=0)||new Set(result.elements.map(e=>e.backendNodeId)).size!==result.elements.length)fail('OBSERVATION_IDENTITY_UNAVAILABLE');
      const identity={renderId:result.renderId,renderEpoch:result.renderEpoch,viewportKey,locatorDigest,
        backendNodeIds:result.elements.map(e=>e.backendNodeId).sort((a,b)=>a-b),contextBackendNodeIds:[...contexts]};
      const evidence={sequence,deadlineAuthority:'outer-node-measurer',remainingBudgetPropagatedToCDP:false,
        rawSamples:result.rawSampleId?[{id:result.rawSampleId,path:result.rawSamplePath}]:[],capture:copy(result.capture??null),
        browserVersion:copy(result.browserVersion),calibrationPolicyId:result.calibrationPolicyId,calibrationPolicyFileSha256:calibration.policyFileSha256};
      if(observationCopy.kind==='count')return{state:'ok',actual:result.matchCount,identity,evidence};
      if(result.matchCount!==1)return{state:'unknown',error:{code:'OBSERVATION_LOCATOR_NOT_UNIQUE',message:String(result.matchCount)},identity,evidence};
      const element=result.elements[0];if(!Number.isInteger(element.backendNodeId))fail('OBSERVATION_IDENTITY_UNAVAILABLE');
      // The same eligibility rule applies to empty and nonempty values and all unique-target primitives.
      if(element.visible!==true)return{state:'unknown',error:{code:'OBSERVATION_TARGET_NOT_VISIBLE',message:'Unique target has no confirmed visible layout'},identity,evidence};
      let actual;
      if(observationCopy.kind==='value'){
        const state=typeof element.valueState==='string'?element.valueState:element.valueState?.status;
        evidence.valueState={status:state??'unavailable',type:element.type??null,source:copy(element.source??[]),calibrationRuleId:element.calibrationRuleId??null};
        evidence.rawPresence=copy(element.rawPresence??null);
        if(state!=='available'||typeof element.value!=='string'||element.rawPresence?.snapshotNode!==true||element.rawPresence?.axNode!==true||element.rawPresence?.axIgnored!==false||element.rawPresence?.hasLayout!==true)return{state:'unknown',error:errorRecord({code:element.valueError??'VALUE_UNAVAILABLE',message:element.valueError??'Native value unavailable'}),identity,evidence};
        actual=element.value;
      }else if(observationCopy.kind==='text'){
        if(typeof element.text!=='string')fail('TEXT_UNAVAILABLE');actual=element.text;
      }else if(observationCopy.kind==='enabled'){
        if(typeof element.enabled!=='boolean')fail('ENABLED_STATE_UNAVAILABLE');actual=element.enabled;
      }else if(observationCopy.kind==='attribute'){
        if(!element.attributes||typeof element.attributes!=='object')fail('ATTRIBUTES_UNAVAILABLE');actual=own(element.attributes,observationCopy.attribute)?element.attributes[observationCopy.attribute]:null;
      }else{
        const r=element.boundingRect;if(!r||!['x','y','width','height'].every(key=>finite(r[key]))||r.width<=0||r.height<=0)fail('INVALID_LAYOUT_RECT');
        const rect={...r,right:r.x+r.width,bottom:r.y+r.height};
        actual=observationCopy.kind==='rect'?rect[observationCopy.field]:rect.x>=-observationCopy.tolerance&&rect.right<=viewportCopy.width+observationCopy.tolerance;
      }
      return{state:'ok',actual,identity,evidence};
    }catch(error){const record=errorRecord(error);if(FATAL.has(record.code)){lifecycle.invalidate(record);throw Object.assign(new Error(record.message),{code:record.code});}return{state:'unknown',error:record,evidence:{sequence}};}
  };
}
const BASELINE_KEYS=['sourceSha256','replayDigest','catalogDigest','viewportDigest','observerSha256','observerRevision','calibrationPolicyId','measurementPolicyDigest','checkpointKey','entryContract'];
function baselineProvenance(value){fields(value,BASELINE_KEYS,'R2_BASELINE_PROVENANCE_REQUIRED');for(const key of BASELINE_KEYS)if(typeof value[key]!=='string'||!value[key])fail('R2_BASELINE_PROVENANCE_REQUIRED');for(const key of ['sourceSha256','replayDigest','catalogDigest','viewportDigest','observerSha256','measurementPolicyDigest'])if(!validHash(value[key]))fail('R2_BASELINE_PROVENANCE_REQUIRED');}
export function validateBoundBaselineR2(envelope,expectedProvenance){
  if(envelope?.schemaVersion!==BOUND_BASELINE_SCHEMA||!own(envelope,'actual')||envelope.actual===undefined)fail('R2_BOUND_BASELINE_REQUIRED');
  baselineProvenance(envelope.provenance);baselineProvenance(expectedProvenance);
  if(!isDeepStrictEqual(envelope.provenance,expectedProvenance))fail('R2_BASELINE_PROVENANCE_MISMATCH');
  return{schemaVersion:BASELINE_SCHEMA_VERSION,actual:copy(envelope.actual),sourceProvenance:copy(envelope.provenance)};
}
export async function evaluateCheckR2({session,check,catalog,viewport,calibration,lifecycle,policy={},baseline,baselineProvenance:expectedProvenance,clock=realMeasurementClock,signal}={}){
  fields(check,['op','id','observation','expect'],'INVALID_R2_CHECK');if(check.op!=='observe'||typeof check.id!=='string')fail('INVALID_R2_CHECK');
  if(!lifecycle.usable)return{notMeasured:{reason:'session-invalidated',error:lifecycle.reason}};
  const collect=createObservationCollectorR2({session,observation:check.observation,catalog,viewport,calibration,lifecycle});
  const bound=check.expect?.cmp==='sameAsBaseline'?validateBoundBaselineR2(baseline,expectedProvenance):undefined;
  const measurement=await measureUntilDeadline({collect,expect:copy(check.expect),baseline:bound,policy,geometry:['rect','withinViewport'].includes(check.observation.kind),clock,signal,abort:args=>lifecycle.abort(args)});
  if(!measurement.health.sessionUsable||measurement.health.cleanup.status==='timeout'||measurement.health.cleanup.status==='failed')lifecycle.invalidate({code:'NO_RENDER',message:'Measurement invalidated browser session'});
  // Browser invalidation can precede completion of the measurement's independent cleanup budget.
  if(!lifecycle.usable){
    measurement.health.sessionUsable=false;measurement.health.terminalError??=lifecycle.reason??{code:'NO_RENDER',message:'Browser lifecycle was invalidated'};
    if(!lifecycle.abortStarted){
      const began=clock.now();
      try{await boundedStage(()=>lifecycle.abort({reason:measurement.health.terminalError.code}),{clock,budgetMs:measurement.policy.cleanupTimeoutMs});measurement.health.cleanup={attempted:true,status:'completed',elapsedMs:clock.now()-began,error:null};}
      catch(error){measurement.health.cleanup={attempted:true,status:error.code==='SCENARIO_STAGE_TIMEOUT'?'timeout':'failed',elapsedMs:clock.now()-began,error:errorRecord(error)};}
    }
  }
  return{measurement};
}
async function boundedStage(operation,{clock,budgetMs,signal}){
  const deadline=clock.now()+budgetMs,timerController=new AbortController();let onAbort;
  const cancelled=new Promise(resolve=>{onAbort=()=>resolve({error:{code:'EXTERNAL_ABORT',message:'Scenario cancelled'}});signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();});
  try{
    const result=await Promise.race([
      Promise.resolve().then(()=>{if(signal?.aborted)fail('EXTERNAL_ABORT');return operation();}).then(value=>({value,completedAt:clock.now()}),error=>({error:errorRecord(error)})),
      clock.sleep(budgetMs,timerController.signal).then(()=>({error:{code:'SCENARIO_STAGE_TIMEOUT',message:'Public lifecycle stage budget exhausted'}}),()=>({cancelledTimer:true})),cancelled]);
    if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.code});if(result.completedAt>=deadline)fail('SCENARIO_STAGE_TIMEOUT','Stage completed at or after its cutoff');return result.value;
  }finally{timerController.abort();signal?.removeEventListener('abort',onAbort);}
}
export function scenarioCheckKeyR2(scenario,viewportName,stepIndex,checkId){return JSON.stringify([scenario.suiteId??'suite',scenario.id,viewportName,stepIndex,checkId]);}
/** One fresh, bounded scenario; gap/grid/order/reload/setViewport/overflow are explicitly unsupported. */
export async function runScenarioR2({session,renderRequest,scenario,catalog,calibration,policy={},expectedKeys,baselineEvidence={},baselineSourceSha256,
  viewportName='desktop',clock=realMeasurementClock,signal,renderTimeoutMs=15000,actionTimeoutMs=5000,maxSteps=200}={}){
  bindingRequired(calibration);const measurementPolicy=validateMeasurementPolicy(policy),safeCatalog=publicCatalog(catalog);if(!['desktop','mobile'].includes(viewportName))fail('INVALID_R2_VIEWPORT_NAME');
  fields(renderRequest,['sourceBytes','format','trustLevel','staticGate','artifactId','viewport','entryContract'],'PRIVATE_OR_UNKNOWN_RENDER_FIELD');
  if(!(renderRequest.sourceBytes instanceof Uint8Array)||!['html','jsx'].includes(renderRequest.format)||renderRequest.trustLevel!=='restricted-generated')fail('FORMAL_RENDER_REQUEST_REQUIRED');
  if(renderRequest.format==='jsx'&&renderRequest.entryContract!==APP_SCRIPT_ENTRY_CONTRACT)fail('FORMAL_APP_SCRIPT_ENTRY_REQUIRED');
  if(!renderRequest.staticGate?.accepted||renderRequest.staticGate.sourceSha256!==hash(renderRequest.sourceBytes))fail('SOURCE_BOUND_STATIC_GATE_REQUIRED');
  viewportRequired(renderRequest.viewport);
  fields(scenario,['id','suiteId','freshReload','assertNoHorizontalOverflow','steps'],'INVALID_R2_SCENARIO');
  if(typeof scenario.id!=='string'||!scenario.id||(scenario.suiteId!==undefined&&typeof scenario.suiteId!=='string')||scenario.freshReload!==true||scenario.assertNoHorizontalOverflow===true||!Array.isArray(scenario.steps)
      ||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>1000||scenario.steps.length>maxSteps)fail('R2_SCENARIO_UNSUPPORTED');
  for(const budget of [renderTimeoutMs,actionTimeoutMs])if(!Number.isInteger(budget)||budget<1||budget>60000)fail('INVALID_SCENARIO_BUDGET');
  const planned=[];
  for(const [i,step]of scenario.steps.entries()){
    if(step.op==='observe'){fields(step,['op','id','observation','expect'],'INVALID_R2_CHECK');if(typeof step.id!=='string'||!step.id)fail('INVALID_R2_CHECK');validateMeasurementExpectation(step.expect,step.expect?.cmp==='sameAsBaseline'?{schemaVersion:BASELINE_SCHEMA_VERSION,actual:null}:undefined);validateObservation(step.observation);resolve(safeCatalog,step.observation.targetRef);planned.push(scenarioCheckKeyR2(scenario,viewportName,i,step.id));}
    else if(['click','fill','key'].includes(step.op)){fields(step,['op','targetRef',...(step.op==='fill'?['value']:step.op==='key'?['key']:[])],'INVALID_R2_ACTION');resolve(safeCatalog,step.targetRef);if(step.op==='fill'&&typeof step.value!=='string'||step.op==='key'&&typeof step.key!=='string')fail('INVALID_R2_ACTION');}
    else fail('R2_SCENARIO_OPERATION_UNSUPPORTED',String(step.op));
  }
  if(!Array.isArray(expectedKeys)||!planned.length||new Set(planned).size!==planned.length||new Set(expectedKeys).size!==expectedKeys.length||!isDeepStrictEqual([...planned].sort(),[...expectedKeys].sort()))fail('FORMAL_EXPECTED_KEYS_REQUIRED');
  const request={...copy(renderRequest),sourceBytes:Uint8Array.from(renderRequest.sourceBytes)},checks=[],actions=[],errors=[],replay=[];
  const lifecycle=createScenarioLifecycleR2({session,calibration});let receipt=null,blocked=null;
  async function stop(error){blocked=errorRecord(error);lifecycle.invalidate(blocked);try{await boundedStage(()=>lifecycle.abort({reason:blocked.code}),{clock,budgetMs:measurementPolicy.cleanupTimeoutMs});}catch(cleanup){errors.push({phase:'cleanup',error:errorRecord(cleanup)});}}
  let renderStarted=false;
  try{
    if(session.diagnostics?.cleanupPending||session.diagnostics?.cleanupFailure)fail('RENDER_LIFECYCLE_BUSY');
    renderStarted=true;receipt=await boundedStage(()=>session.render(request),{clock,budgetMs:renderTimeoutMs,signal});lifecycle.bindReceipt(receipt);
    if(request.format==='jsx'&&receipt.entryContract!==APP_SCRIPT_ENTRY_CONTRACT)fail('FORMAL_APP_SCRIPT_ENTRY_REQUIRED');
    if(receipt.pageErrors?.length)fail('PAGE_RUNTIME_ERROR',JSON.stringify(receipt.pageErrors));
  }catch(error){errors.push({phase:'render',error:errorRecord(error)});if(renderStarted)await stop(error);else{blocked=errorRecord(error);lifecycle.invalidate(blocked);}}
  for(const [i,step]of scenario.steps.entries()){
    if(step.op==='observe'){
      const key=scenarioCheckKeyR2(scenario,viewportName,i,step.id);
      if(blocked||!lifecycle.usable){checks.push({key,notMeasured:{reason:'scenario-replay-invalidated',error:blocked??lifecycle.reason}});continue;}
      try{
        const provenance={sourceSha256:baselineSourceSha256??hash(request.sourceBytes),replayDigest:digest(replay),catalogDigest:digest(safeCatalog),viewportDigest:digest(request.viewport),observerSha256:calibration.observerSha256,observerRevision:calibration.observerRevision,
          calibrationPolicyId:calibration.policyId,measurementPolicyDigest:digest(measurementPolicy),checkpointKey:key,entryContract:receipt.entryContract};
        checks.push({key,...await evaluateCheckR2({session,check:step,catalog:safeCatalog,viewport:request.viewport,calibration,lifecycle,policy:measurementPolicy,baseline:baselineEvidence[key],baselineProvenance:provenance,clock,signal})});
      }catch(error){errors.push({phase:'check',key,error:errorRecord(error)});checks.push({key,notMeasured:{reason:'check-setup-error',error:errorRecord(error)}});}
    }else{
      const action={action:step.op,locator:resolve(safeCatalog,step.targetRef),...(step.op==='fill'?{value:step.value}:step.op==='key'?{key:step.key}:{})};
      if(blocked||!lifecycle.usable){actions.push({stepIndex:i,status:'skipped',error:blocked??lifecycle.reason});continue;}
      try{const evidence=await boundedStage(()=>session.act(action),{clock,budgetMs:actionTimeoutMs,signal});actions.push({stepIndex:i,status:'performed',evidence});replay.push(copy(action));}
      catch(error){actions.push({stepIndex:i,status:'error',error:errorRecord(error)});await stop(error);}
    }
  }
  if(!lifecycle.usable){
    errors.push({phase:'session-final',error:lifecycle.reason??{code:'NO_RENDER',message:'Session invalidated'}});
    if(!lifecycle.abortStarted&&renderStarted)await stop(lifecycle.reason??{code:'NO_RENDER',message:'Session invalidated'});
  }
  const suite={schemaVersion:SUITE_SCHEMA_VERSION,adapterRevision:ADAPTER_REVISION,checks,actions,errors,receipt,
    provenance:{calibrationPolicyFileSha256:calibration.policyFileSha256,observerSha256:calibration.observerSha256,observerRevision:calibration.observerRevision,sourceSha256:hash(request.sourceBytes)},lifecycle:{sessionUsable:lifecycle.usable,invalidReason:lifecycle.reason}};
  return{...suite,classification:classifySuiteR2(suite,{expectedKeys})};
}
