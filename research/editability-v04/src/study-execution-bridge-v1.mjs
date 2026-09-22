import {randomUUID,createHash} from 'node:crypto';
import {open,readFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {runExperimentV1} from './experiment-runner-v1.mjs';
import {sha256,immutable,projectPublicRequest,rebuildPatch} from './methods-v1.mjs';
import {captureBaselineR3,evaluateAcceptedR3} from './baseline-r3.mjs';
import {persistEvaluationReceiptR3,normalizeEvaluationReceiptR3,endpointExpectedKeysR3,EVALUATION_BINDING_R3} from './evaluation-normalizer-r3.mjs';
import {publicLocatorR3} from './evaluation-plan-r3.mjs';
import {isStudyRuntimeV1} from './study-runtime-v1.mjs';
import {isNativePublicPrepareV1} from './study-public-prepare-v1.mjs';

export const STUDY_BRIDGE_VERSION='v04-study-execution-bridge-1';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const copy=value=>structuredClone(value);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const errorCode=error=>typeof error?.code==='string'?error.code:'STUDY_BRIDGE_DEPENDENCY_ERROR';
const plain=value=>JSON.parse(JSON.stringify(value));
const same=(a,b,code)=>{if(!isDeepStrictEqual(a,b))fail(code);};
// Files are private-owner evidence by default. The public control script chooses a public control directory.
// Existing independently owned directory required; reject linked ancestry, traversal, hardlinks and overwrite.
export async function persistStudyJsonV1(directory,basename,value) {
  if(!path.isAbsolute(directory)||!/^[-a-zA-Z0-9_.]+\.json$/.test(basename)||basename.includes('..'))fail('UNSAFE_STUDY_OUTPUT_PATH');
  const normalized=path.resolve(directory);
  if(directory.split(/[\\/]/).some(part=>part==='..'||part==='.') || await realpath(normalized)!==normalized)fail('UNSAFE_STUDY_OUTPUT_ANCESTRY');
  let current=normalized;
  while(true){const stat=await lstat(current);if(stat.isSymbolicLink()||!stat.isDirectory())fail('UNSAFE_STUDY_OUTPUT_ANCESTRY');const parent=path.dirname(current);if(parent===current)break;current=parent;}
  const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n','utf8'),filePath=path.join(normalized,basename);
  const handle=await open(filePath,'wx',0o600);
  try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
  const stat=await lstat(filePath);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail('UNSAFE_STUDY_OUTPUT_FILE');
  const actual=await readFile(filePath);if(!actual.equals(bytes))fail('STUDY_PERSISTENCE_BYTES_MISMATCH');
  return immutable({path:filePath,sha256:digest(bytes),bytes:bytes.length});
}
export async function persistAcceptanceLockV1({directory,candidate,id='accept-'+randomUUID()}={}) {
  if(!candidate?.accepted || candidate.originalSourceHash!==sha256(candidate.originalSource)
    ||candidate.candidateHash!==sha256(candidate.content)||candidate.sourceAfterHash!==candidate.candidateHash
    ||rebuildPatch(candidate.originalSource,candidate.patches)!==candidate.content)fail('ACCEPTANCE_CANDIDATE_INTEGRITY');
  if(!/^accept-[a-f0-9-]{36}$/.test(id))fail('INVALID_ACCEPTANCE_LOCK_ID');
  const lock=immutable({id,status:'accepted',candidateSourceSha256:candidate.candidateHash,
    originalSourceSha256:candidate.originalSourceHash,lockedBeforePrivateEvaluation:true});
  const descriptor=await persistStudyJsonV1(directory,id+'.json',lock);
  return immutable({lock,descriptor});
}
export async function verifyAcceptanceLockV1({lock,descriptor}) {
  const bytes=await readFile(descriptor.path);
  if(digest(bytes)!==descriptor.sha256||bytes.length!==descriptor.bytes)fail('ACCEPTANCE_LOCK_BYTES_CHANGED');
  same(JSON.parse(bytes.toString('utf8')),lock,'ACCEPTANCE_LOCK_CONTENT_CHANGED');
}
// Only legal frozen transport is injected by the execution owner; one call, no extraction repair/retry.
export async function invokeGenerationSlotV1({publicRequirements,runtimeContract,generate}) {
  if(typeof publicRequirements!=='string'||typeof generate!=='function')fail('GENERATION_PUBLIC_INPUT_REQUIRED');
  const contract={};for(const key of ['format','entryContract','offlineBehavior'])if(typeof runtimeContract?.[key]==='string')contract[key]=runtimeContract[key];
  const request=immutable({schemaVersion:'v04-generation-public-1',publicRequirements,runtimeContract:contract});
  let response;try{response=await generate(request);}catch{return immutable({status:'error',reason:'GENERATION_TRANSPORT_ERROR',transportInvocations:1,source:null});}
  if(typeof response?.source!=='string')return immutable({status:'error',reason:'GENERATION_SOURCE_MISSING',transportInvocations:1,source:null});
  return immutable({status:'generated',source:response.source,sourceSha256:sha256(response.source),transportInvocations:1});
}
const eligibility=value=>({eligible:'eligible',ineligible:'originalIneligible',unresolved:'eligibilityUnresolved'}[value]??fail('UNKNOWN_BASELINE_ELIGIBILITY'));
const defaultApi=Object.freeze({captureBaseline:captureBaselineR3,evaluateAccepted:evaluateAcceptedR3,persistReceipt:persistEvaluationReceiptR3,
  normalizeReceipt:normalizeEvaluationReceiptR3,expectedKeys:endpointExpectedKeysR3});

/** One source/task union, baseline before methods, accepted lock persisted before private evaluation. */
export async function runStudyExecutionV1({datasetId,datasetKind='dev',tasks,outputDirectory,methods,prepare,publicCheck,makeRenderRequest,
  sessionFactory,calibration,environment,policy,admission,runtime,dependencyControl=null}={}) {
  if(!admission||admission.mode!=='trusted-controls'||admission.authorized!==true||admission.calibrationReady!==true)fail('STUDY_ADMISSION_REQUIRED');
  if(datasetKind!=='dev')fail('NATURAL_STUDY_EXECUTION_NOT_ADMITTED_BY_THIS_BRIDGE');
  if(!dependencyControl){
    if(!isStudyRuntimeV1(runtime)||!isNativePublicPrepareV1(prepare))fail('REAL_BRANDED_RUNTIME_AND_PREPARATION_REQUIRED');
    ({makeRenderRequest,publicCheck,sessionFactory,calibration,environment}=runtime);
  }
  if(!Array.isArray(tasks)||!tasks.length||typeof prepare!=='function'||typeof publicCheck!=='function'||typeof makeRenderRequest!=='function'||typeof sessionFactory!=='function')fail('STUDY_DEPENDENCIES_REQUIRED');
  const api=dependencyControl?{...defaultApi,...dependencyControl.api}:defaultApi;
  if(dependencyControl&&dependencyControl.label!=='handwritten-dependency-control-not-browser')fail('EXPLICIT_DEPENDENCY_CONTROL_LABEL_REQUIRED');
  const frozenTasks=immutable(copy(tasks));const states=new Map(),runnerTasks=[],seen=new Set(),events=[],receipts=[];
  for(const task of frozenTasks){
    if(typeof task.sourceId!=='string'||typeof task.taskId!=='string')fail('STUDY_TASK_ID_REQUIRED');
    const key=JSON.stringify([task.sourceId,task.taskId]);if(seen.has(key))fail('DUPLICATE_STUDY_TASK');seen.add(key);
  }
  // Scope of task descriptors is independent-owner only; private evaluationPlan is never sent to methods.
  for(const task of frozenTasks){
    const ref=sha256(JSON.stringify([datasetId,task.sourceId,task.taskId])),state={task,ref,baseline:null,baselineError:null};states.set(ref,state);
    const entry={sourceId:task.sourceId,taskId:task.taskId,briefId:task.briefId,configId:task.configId,
      originalSource:task.originalSource??null,originalSourceHash:typeof task.originalSource==='string'?sha256(task.originalSource):null,
      publicRequest:null,eligibility:{R:'notScreened',G:'notScreened'},expectedKeys:{R:[],G:[]},evaluationRef:ref};
    runnerTasks.push(entry);state.entry=entry;
    if(task.screen===false)continue;
    if(typeof task.originalSource!=='string'){entry.eligibility={R:'upstreamMissing',G:'upstreamMissing'};continue;}
    const publicRequest={...copy(task.publicRequest),locator:publicLocatorR3(task.publicRequest.locator,task.publicCatalog??{})};
    entry.publicRequest=publicRequest;
    projectPublicRequest(entry); // prevalidate projection without expected/baseline/other-task data
    try{
      const request=await makeRenderRequest({sourceBytes:Buffer.from(task.originalSource,'utf8'),sourceHash:entry.originalSourceHash,
        stage:'baseline',artifactId:'baseline-'+ref.slice(0,20),publicRequest:projectPublicRequest(entry)});
      const baseline=await api.captureBaseline({originalRenderRequest:request,originalSourceSha256:entry.originalSourceHash,
        plan:task.evaluationPlan,sessionFactory,calibration,environment,policy});
      state.baseline=baseline;
      if(baseline.originalSourceSha256!==entry.originalSourceHash)fail('BASELINE_SOURCE_BINDING_MISMATCH');
      entry.eligibility=Object.fromEntries(['R','G'].map(endpoint=>[endpoint,eligibility(baseline.endpoints[endpoint].eligibility)]));
      entry.expectedKeys=copy(api.expectedKeys(baseline));
      state.baselineDescriptor=await persistStudyJsonV1(outputDirectory,'baseline-'+ref+'.json',plain(baseline));
      events.push({phase:'baseline',evaluationRef:ref,status:'captured',descriptor:state.baselineDescriptor});
    }catch(error){
      state.baselineError=errorCode(error);entry.eligibility={R:'eligibilityUnresolved',G:'eligibilityUnresolved'};
      events.push({phase:'baseline',evaluationRef:ref,status:'error',code:state.baselineError});
    }
  }
  const preparationQueue=runnerTasks.filter(task=>['R','G'].some(endpoint=>task.eligibility[endpoint]==='eligible'));let preparationIndex=0;
  const executionBySlot=new Map();
  const result=await runExperimentV1({plan:{datasetId,datasetKind,tasks:runnerTasks},methods,evaluationBinding:EVALUATION_BINDING_R3,
    prepare:async request=>{
      const task=preparationQueue[preparationIndex++];if(!task)fail('PREPARATION_PLAN_EXHAUSTED');
      same(request,projectPublicRequest(task),'PREPARATION_PUBLIC_REQUEST_MISMATCH');
      const prepared=await prepare(request),ref=task.evaluationRef;
      const descriptor=await persistStudyJsonV1(outputDirectory,'prepare-'+ref+'.json',plain(prepared));
      events.push({phase:'public-prepare',evaluationRef:ref,status:prepared.status,descriptor});
      if(prepared.status!=='ready')return {status:'failed'};
      return prepared;
    },publicCheck,
    executor:async candidate=>{
      const state=states.get(candidate.evaluationRef);if(!state?.baseline)fail('OPAQUE_BASELINE_NOT_FOUND');
      if(candidate.originalSourceHash!==state.entry.originalSourceHash)fail('CANDIDATE_ORIGINAL_BINDING_MISMATCH');
      const slotId=sha256(JSON.stringify([datasetId,candidate.sourceId,candidate.taskId,candidate.method]));
      if(executionBySlot.has(slotId))fail('ACCEPTED_SLOT_ALREADY_EXECUTED');
      // Store reservation before any asynchronous work. A failed slot is terminal, never retried here.
      const reserved={status:'reserved'};executionBySlot.set(slotId,reserved);
      const acceptance=await persistAcceptanceLockV1({directory:outputDirectory,candidate});
      reserved.acceptance=acceptance;reserved.candidate=copy(candidate);
      events.push({phase:'acceptance-lock',slotId,status:'persisted',descriptor:acceptance.descriptor});
      return {slotId,acceptanceLockId:acceptance.lock.id,acceptanceDescriptor:acceptance.descriptor};
    },evaluator:async({candidate,execution})=>{
      const reserved=executionBySlot.get(execution.slotId),state=states.get(candidate.evaluationRef);
      if(!reserved?.acceptance||reserved.status!=='reserved')fail('ACCEPTED_SLOT_EVALUATION_DUPLICATE');
      reserved.status='evaluation-started';same(candidate,reserved.candidate,'ACCEPTED_CANDIDATE_CHANGED');
      await verifyAcceptanceLockV1(reserved.acceptance);
      const request=await makeRenderRequest({sourceBytes:Buffer.from(candidate.content,'utf8'),sourceHash:candidate.candidateHash,
        stage:'candidate',artifactId:'candidate-'+execution.slotId.slice(0,20),publicRequest:projectPublicRequest(state.entry)});
      const evaluation=await api.evaluateAccepted({candidateRenderRequest:request,originalSourceSha256:candidate.originalSourceHash,
        baselineBundle:state.baseline,acceptanceLock:reserved.acceptance.lock,plan:state.task.evaluationPlan,
        sessionFactory,calibration,environment,policy});
      await verifyAcceptanceLockV1(reserved.acceptance);
      const slotBinding={sourceId:candidate.sourceId,taskId:candidate.taskId,method:candidate.method,slotId:execution.slotId,
        originalSourceSha256:candidate.originalSourceHash,candidateSourceSha256:candidate.candidateHash,acceptanceLockId:reserved.acceptance.lock.id};
      const receipt=await api.persistReceipt({receiptPath:path.join(outputDirectory,'evaluation-'+execution.slotId+'.json'),
        baselineBundle:state.baseline,evaluation,plan:state.task.evaluationPlan,calibration,environment,policy,slotBinding});
      receipts.push(receipt);reserved.receipt=receipt;
      let normalized;
      try{normalized=await api.normalizeReceipt({receiptPath:receipt.path,expectedSha256:receipt.sha256,expectedBytes:receipt.bytes,
        expectedSlotBinding:slotBinding,expectedAcceptanceLockId:reserved.acceptance.lock.id});}
      catch(error){events.push({phase:'receipt-normalization',slotId:execution.slotId,status:'error',code:errorCode(error)});throw error;}
      reserved.status='evaluated-and-normalized';events.push({phase:'independent-evaluation',slotId:execution.slotId,status:reserved.status,receipt});
      return normalized;
    },integrationEvidence:{bridgeVersion:STUDY_BRIDGE_VERSION,mode:dependencyControl?'dependency-control':'native-r3',
      originalBaseline:'uninstrumented-original-bytes',acceptancePersistence:'exclusive-create-before-private-evaluation',
      receiptNormalizer:EVALUATION_BINDING_R3,admission:copy(admission)}});
  const summary=immutable({schemaVersion:STUDY_BRIDGE_VERSION,mode:dependencyControl?'dependency-control-not-browser':'native-r3-trusted-controls',
    experiment:result,events,receipts,runtimeSemantics:runtime?.runtimeSemantics??null,publicSafetyPolicy:runtime?.publicSafetyPolicy??null,formalReady:false,naturalExecutionAuthorized:false,nativeRawEvidenceIndependentlyReverified:false});
  const descriptor=await persistStudyJsonV1(outputDirectory,'study-result.json',plain(summary));
  return immutable({result:summary,descriptor});
}
