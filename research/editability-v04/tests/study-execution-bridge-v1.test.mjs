// Publication revision: portable checkout dependency resolution.
import {productPackageURL, productFileURL, runtimeDirectory, rootRequire} from '../publication/paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runStudyExecutionV1,persistAcceptanceLockV1,verifyAcceptanceLockV1,invokeGenerationSlotV1} from '../src/study-execution-bridge-v1.mjs';
import {captureBaselineR3,evaluateAcceptedR3} from '../src/baseline-r3.mjs';
import {evaluationProvenanceR3,digestR3,deriveExpectedKeysR3} from '../src/evaluation-plan-r3.mjs';
import {measureRulesUntilDeadlineR3,FACT_SCHEMA_VERSION_R3} from '../src/measurement-r3.mjs';
import {createMethodsV1,sha256,rebuildPatch} from '../src/methods-v1.mjs';
import {createEngineV1} from '../src/methods-v1-engine.mjs';
import {toAnalysisInputV1} from '../src/methods-v1-analysis.mjs';
import {auditInput as auditStatisticsV2} from '../src/analysis-v04-v2.mjs';
import {staticGate,APP_SCRIPT_ENTRY_CONTRACT} from '../src/browser-session-r3.mjs';
const requireProduct=createRequire(productPackageURL());
const {parse}=requireProduct('@babel/parser');
const stock=rootRequire()('tsx/cjs/api').require(fileURLToPath(productFileURL('apps/desktop/src/main/source-edit-engine.ts')),fileURLToPath(import.meta.url));
class Clock{
 time=0;timers=[];now=()=>this.time;
 sleep=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted){reject(Error('aborted'));return;}const timer={at:this.time+ms,active:true};const abort=()=>{if(timer.active){timer.active=false;reject(Error('aborted'));}};timer.finish=()=>{if(timer.active){timer.active=false;signal?.removeEventListener('abort',abort);resolve();}};signal?.addEventListener('abort',abort,{once:true});this.timers.push(timer);});
 async run(promise){let done=false,value,error;promise.then(v=>{done=true;value=v;},e=>{done=true;error=e;});for(let i=0;i<10000&&!done;i++){for(let j=0;j<30;j++)await Promise.resolve();if(done)break;const timers=this.timers.filter(t=>t.active);assert.ok(timers.length);this.time=Math.max(this.time,Math.min(...timers.map(t=>t.at)));for(const t of this.timers.filter(t=>t.active&&t.at<=this.time))t.finish();}assert.ok(done);if(error)throw error;return value;}
}
const source='function App(){return <h1>Old</h1>}';
const target='<h1>Old</h1>',start=source.indexOf(target),targetId=`${start}:${start+target.length}`;
async function fixture(t,options={}){
 const localSource=options.noop?source.replace('Old','New'):source,baseText=options.noop?'New':'Old';
 const outputDirectory=await mkdtemp(path.join(os.tmpdir(),'study-bridge-public-control-'));t.after(()=>rm(outputDirectory,{recursive:true,force:true}));
 const plan={schemaVersion:'v04-evaluation-plan-r3-1',id:'PUBLIC_SYNTHETIC_PRIVATE_SENTINEL',catalog:{heading:{by:'role',role:'heading',exact:true}},viewports:{desktop:{width:800,height:600}},defaults:{documentOverflowTolerancePx:0},
  scenarios:[{id:'heading',viewport:'desktop',freshReload:true,assertNoHorizontalOverflow:false,steps:[{op:'observe',id:'value',observation:{kind:'text',targetRef:'heading'}}]}],
  requirements:{targets:[],originals:[],protections:[],reachability:[],excludeNoopFromG:false}};
 plan.expectedKeys=deriveExpectedKeysR3(plan);const key=plan.expectedKeys[0];plan.requirements.targets=[{key,expect:{cmp:'eq',value:'New'}}];plan.requirements.originals=[{key,expect:{cmp:'eq',value:options.originalFail?'Wrong Original':baseText}}];plan.requirements.reachability=[{key,mode:'available'}];
 const calibration={policyId:'handwritten-no-browser',observerSha256:'1'.repeat(64),observerRevision:'synthetic-r3',policyFileSha256:'2'.repeat(64)};
 const environment={entryContract:APP_SCRIPT_ENTRY_CONTRACT,runtime:'NO_BROWSER_SYNTHETIC_FACTS'};
 const policy={timeoutMs:200,pollIntervalMs:50,stableSamples:2,geometryDeltaPx:0.5};let calls=0,oneshots=0;
 const runEvaluation=async({renderRequest,plan,policy,ruleSets,mode,calibration,environment})=>{
  calls++;const hash=sha256(renderRequest.sourceBytes),runId='synthetic-'+calls,checks=[];
  if(mode==='baseline')assert.equal(Buffer.from(renderRequest.sourceBytes).toString('utf8'),localSource);
  for(const checkpoint of plan.checkpoints){const clock=new Clock();const measured=await clock.run(measureRulesUntilDeadlineR3({clock,policy,rules:ruleSets[checkpoint.key],collect:async()=>({state:'ok',actual:{schemaVersion:FACT_SCHEMA_VERSION_R3,value:mode==='baseline'?baseText:'New',geometry:null,errors:[]},identity:{runId,key:checkpoint.key}})}));checks.push({key:checkpoint.key,provenance:evaluationProvenanceR3({plan,checkpoint,sourceSha256:hash,runId,calibration,environment,policy}),...measured});}
  return{schemaVersion:'v04-evaluation-run-r3-1',runId,sourceSha256:hash,planDigest:plan.planDigest,environmentDigest:digestR3(environment),calibrationBindingDigest:digestR3(calibration),measurementPolicy:policy,checks,actions:[],errors:[],scenarios:[],receipts:[],runtimeEvidence:{complete:true,scenarios:plan.runs.map(run=>({runKey:run.runKey,complete:true,lifecycleComplete:true,nativeJournal:{available:true,complete:true,throughEventSequence:0,journals:[{sourceSha256:hash,renderEpoch:1,available:true,complete:true,droppedEvents:0,events:[]}],events:[]}})),events:[]}};
 };
 const engine=createEngineV1({parse,stockEngine:stock});
 const methods=createMethodsV1({engine,oneshot:async payload=>{oneshots++;assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_SENTINEL/);const c=engine.fallback({...payload.request,locator:{tagName:'h1',text:baseText}});return{proposal:{patches:c.patches}};}});
 const deps={datasetId:'public-bridge-control',tasks:[{sourceId:'s',taskId:'t',briefId:'b',configId:'c',originalSource:localSource,
  publicRequest:{userGoal:'Change heading to New',scope:'source-definition',locator:{by:'role',role:'heading',exact:true},operation:{kind:'set-text',value:'New'}},evaluationPlan:plan}],
  outputDirectory,methods,prepare:async request=>{assert.doesNotMatch(JSON.stringify(request),/PRIVATE_SENTINEL/);return{status:'ready',publicDom:{tagName:'h1',text:baseText},provenance:{sourceHash:sha256(localSource),targetId},evidence:{mode:'synthetic-prepare-only'}};},
  publicCheck:async input=>{parse(input.content,{plugins:['jsx']});assert.equal(rebuildPatch(input.source,input.patches),input.content);const gate=staticGate({sourceBytes:Buffer.from(input.content),format:'jsx',entryContract:APP_SCRIPT_ENTRY_CONTRACT});return{checks:[{key:'parse',pass:true},{key:'entry',pass:stock.analyzeSourceEdit({path:'App.jsx',source:input.content}).status==='ready'},{key:'patch-safety',pass:gate.accepted}]};},
  makeRenderRequest:async({sourceBytes,sourceHash})=>({sourceBytes,format:'jsx',trustLevel:'trusted-microfixture',entryContract:APP_SCRIPT_ENTRY_CONTRACT,staticGate:staticGate({sourceBytes,format:'jsx',entryContract:APP_SCRIPT_ENTRY_CONTRACT})}),
  sessionFactory:()=>assert.fail('synthetic facts must never start browser'),calibration,environment,policy,
  admission:{mode:'trusted-controls',authorized:true,calibrationReady:true},dependencyControl:{label:'handwritten-dependency-control-not-browser',api:{
    captureBaseline:input=>captureBaselineR3({...input,runEvaluation}),evaluateAccepted:async input=>{
      const bytes=await readFile(path.join(outputDirectory,input.acceptanceLock.id+'.json'));assert.deepEqual(JSON.parse(bytes),input.acceptanceLock);
      assert.equal(bytes.toString(),JSON.stringify(input.acceptanceLock,null,2)+'\n');assert.ok(Object.isFrozen(input.acceptanceLock));
      if(options.failEvaluation)throw Error('private evaluator failure');return evaluateAcceptedR3({...input,runEvaluation});
    }}}};
 return {deps,calls:()=>calls,oneshots:()=>oneshots};
}
test('real engine→real r3 baseline/evaluate/audit/persist/normalize; synthetic facts are explicitly not browser evidence',async t=>{
 const f=await fixture(t),{result}=await runStudyExecutionV1(f.deps);assert.equal(result.mode,'dependency-control-not-browser');assert.equal(result.formalReady,false);assert.equal(f.calls(),5,JSON.stringify(result.events));assert.equal(f.oneshots(),1);assert.equal(result.receipts.length,4);
 const records=result.experiment.records;assert.equal(records.length,4);assert.equal(records[0].candidateHash,records[1].candidateHash);
 for(const record of records){assert.equal(record.accepted,true);assert.equal(record.evaluation.R.outcome,'S',JSON.stringify(result.events));const raw=await readFile(record.independentEvaluation.receipt.path);assert.equal(raw.toString('utf8'),JSON.stringify(JSON.parse(raw),null,2)+'\n');assert.equal(sha256(raw),record.independentEvaluation.outcomes.R.binding.evidenceHash);assert.equal(JSON.parse(raw).evaluation.originalSourceSha256,sha256(source));}
 const files=await readdir(f.deps.outputDirectory);assert.equal(files.filter(name=>name.startsWith('accept-')).length,4);
});
test('native mode refuses stubs and no admission starts no source evaluation',async t=>{
 const f=await fixture(t);await assert.rejects(runStudyExecutionV1({...f.deps,dependencyControl:null}),/REAL_BRANDED/);assert.equal(f.calls(),0);
 await assert.rejects(runStudyExecutionV1({...f.deps,admission:null}),/ADMISSION/);assert.equal(f.calls(),0);
});
test('duplicate planned task fails before any baseline or acceptance file',async t=>{
 const f=await fixture(t);f.deps.tasks.push(f.deps.tasks[0]);await assert.rejects(runStudyExecutionV1(f.deps),/DUPLICATE_STUDY_TASK/);assert.equal(f.calls(),0);assert.deepEqual(await readdir(f.deps.outputDirectory),[]);
});
test('accepted evaluation error keeps durable lock, A and U_A with no retry or forged receipt',async t=>{
 const f=await fixture(t,{failEvaluation:true}),{result}=await runStudyExecutionV1(f.deps);assert.equal(f.calls(),1);assert.equal(result.receipts.length,0);
 for(const record of result.experiment.records){assert.equal(record.accepted,true);assert.equal(record.evaluation.R.outcome,'U_A');assert.equal(record.independentEvaluation,undefined);}
 assert.equal((await readdir(f.deps.outputDirectory)).filter(name=>name.startsWith('accept-')).length,4);
});
test('exclusive acceptance creation forbids overwrite and detects subsequent bytes mutation',async t=>{
 const f=await fixture(t),start=source.indexOf('Old'),patches=[{start,end:start+3,expectedText:'Old',replacement:'New'}],content=rebuildPatch(source,patches),candidate={accepted:true,originalSource:source,originalSourceHash:sha256(source),content,candidateHash:sha256(content),sourceAfterHash:sha256(content),patches};
 const id='accept-11111111-1111-4111-8111-111111111111',locked=await persistAcceptanceLockV1({directory:f.deps.outputDirectory,candidate,id});
 await assert.rejects(persistAcceptanceLockV1({directory:f.deps.outputDirectory,candidate,id}),error=>error.code==='EEXIST');
 await writeFile(locked.descriptor.path,'tampered');await assert.rejects(verifyAcceptanceLockV1(locked),/BYTES_CHANGED/);
});
test('generation injection receives requirements/runtime only and invokes exactly once without repair',async()=>{
 let calls=0;const generated=await invokeGenerationSlotV1({publicRequirements:'Public handwritten requirement',runtimeContract:{format:'jsx',entryContract:APP_SCRIPT_ENTRY_CONTRACT,expected:'PRIVATE_SENTINEL'},expected:'PRIVATE_SENTINEL',generate:async input=>{calls++;assert.doesNotMatch(JSON.stringify(input),/PRIVATE_SENTINEL/);return{source:'\n raw source bytes \n'};}});
 assert.equal(calls,1);assert.equal(generated.source,'\n raw source bytes \n');
 const failed=await invokeGenerationSlotV1({publicRequirements:'p',runtimeContract:{},generate:async()=>{calls++;throw null;}});assert.equal(calls,2);assert.equal(failed.status,'error');
});

test('G-only and R-only raw endpoint masks survive persisted normalization through analysis-v2',async t=>{
 for(const options of [{noop:true},{originalFail:true}]){
  const f=await fixture(t,options),base=f.deps.tasks[0];
  f.deps.tasks=['c1','c2'].flatMap(configId=>['t1','t2','t3','t4'].map(taskId=>({...base,sourceId:'s-'+configId,configId,taskId})));
  const {result}=await runStudyExecutionV1(f.deps);
  const input=toAnalysisInputV1({experiment:result.experiment,design:{briefs:[{briefId:'b',clusterId:'b'}],configs:['c1','c2'],tasks:['t1','t2','t3','t4'],maxBriefsPerCluster:1,independence:{status:'unverified',basis:'handwritten dependency chain only'}}});
  const absent=options.noop?'R':'G',present=options.noop?'G':'R';
  for(let i=0;i<input.records.length;i++){
    assert.equal(input.records[i].outcomes[absent],null);assert.equal(input.records[i].outcomes[present].binding.classification,'S');
    const raw=result.experiment.records[i].independentEvaluation.outcomes[absent];assert.equal(raw.binding.classification,null);assert.equal(raw.confirmedViolation,false);assert.equal(raw.unknown,false);assert.equal(raw.allRequiredPassed,false);
    assert.equal(input.records[i].eligibility[absent],'originalIneligible');assert.equal(input.records[i].eligibility[present],'eligible');
  }
  const audit=auditStatisticsV2(input);assert.equal(audit.valid,true,JSON.stringify(audit.errors));
 }
});
test('all 16 missing generation sources retain 256 uncalled slots with null source hashes',async t=>{
 const f=await fixture(t);f.deps.tasks=Array.from({length:64},(_,index)=>({sourceId:'source-'+Math.floor(index/4),taskId:'task-'+index%4,briefId:'brief-'+Math.floor(index/8),configId:'c'+Math.floor(index/4)%2,originalSource:null}));
 const {result}=await runStudyExecutionV1(f.deps);assert.equal(result.experiment.records.length,256);assert.equal(f.calls(),0);assert.equal(f.oneshots(),0);
 for(const record of result.experiment.records){assert.equal(record.originalSourceHash,null);assert.equal(record.candidateHash,null);assert.equal(record.proposal,'not-executed');assert.equal(record.eligibility.R,'upstreamMissing');}
 for(const rollup of Object.values(result.experiment.rollups)){assert.equal(rollup.counts.P,64);assert.equal(rollup.counts.upstreamMissing,64);assert.equal(rollup.counts.A,0);}
});
test('method refusal creates no acceptance file and triggers no candidate evaluation',async t=>{
 const f=await fixture(t);f.deps.methods={propose:async()=>({status:'rejected',reason:'unsupported-public-control'})};
 const {result}=await runStudyExecutionV1(f.deps);assert.equal(f.calls(),1);assert.equal(result.receipts.length,0);
 assert.equal((await readdir(f.deps.outputDirectory)).filter(name=>name.startsWith('accept-')).length,0);
 for(const record of result.experiment.records){assert.equal(record.accepted,false);assert.equal(record.proposal,'rejected');assert.deepEqual(record.evaluation,{});}
});