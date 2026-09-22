// Publication historical group: defect assertions retained, not current/native validation.
import {assertHistoricalOptIn} from '../publication/paths.mjs';
assertHistoricalOptIn();
// Independent audit assertions; public owner helper supplies ONLY inert fake sessions/clock.
// No browser, API, generated source execution, private directory, or real credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureBaselineR3,evaluateAcceptedR3,auditEvaluationReceiptR3} from '../src/baseline-r3.mjs';
import {runEvaluationR3} from '../src/evaluate-adapter-r3.mjs';
import {persistEvaluationReceiptR3,normalizeEvaluationReceiptR3,endpointExpectedKeysR3} from '../src/evaluation-normalizer-r3.mjs';
import {classifyMeasurementR3,classifySuiteR3} from '../src/measurement-records-r3.mjs';
import {stableWindowR3,FACT_SCHEMA_VERSION_R3} from '../src/measurement-r3.mjs';
import {normalizeRuntimeJournalR3} from '../src/runtime-evidence-r3.mjs';
import {hashBytesR3,deriveExpectedKeysR3} from '../src/evaluation-plan-r3.mjs';
import {decodeValueEvidence,clonePublicLocator} from '../src/browser-session-r3.mjs';
import {FakeClockR3,SHORT_POLICY_R3,fixtureCalibrationR3,renderRequestR3,planFixtureR3,fakeSessionsR3} from './helpers/evaluation-r3-fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const notes=[];
const capture={cmp:'r3',rule:{kind:'capture'}};
const sourcePaths=['src/browser-session-r3.mjs','src/layout-facts-r3.mjs','src/measurement-r3.mjs','src/measurement-records-r3.mjs','src/baseline-r3.mjs','src/evaluation-plan-r3.mjs','src/evaluation-facts-r3.mjs','src/evaluate-adapter-r3.mjs','src/evaluation-normalizer-r3.mjs','src/runtime-evidence-r3.mjs','tests/helpers/evaluation-r3-fixture.mjs','src/browser-session-r2.mjs','src/entry-contract-r2.mjs','src/measurement-r2.mjs','src/measurement-records-r2.mjs'];
const hashes=()=>Object.fromEntries(sourcePaths.map(p=>[p,hashBytesR3(readFileSync(join(root,p)))]));
const before=hashes();
const fact=(value,geometry=null)=>({schemaVersion:FACT_SCHEMA_VERSION_R3,value,geometry,errors:[]});
function temporary(t){const directory=mkdtempSync(join(tmpdir(),'r3-independent-audit-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));return directory;}
async function paired({captureHook,runMutate,noop=false}={}){
 const f=await fixtureCalibrationR3(),clock=new FakeClockR3(),plan=planFixtureR3();
 const original=renderRequestR3(noop?'function App(){return <p>AFTER</p>}':undefined),candidate=renderRequestR3('function App(){return <p>AFTER</p>}');
 if(noop)plan.requirements.originals[0].expect.value='after';
 const fake=fakeSessionsR3(f.calibration,{captureHook});
 const runner=async options=>{const run=await runEvaluationR3(options);if(runMutate)runMutate(run,options);return run;};
 const common={plan,calibration:f.calibration,environment:f.environment,policy:SHORT_POLICY_R3,sessionFactory:fake.factory,clock,runEvaluation:runner};
 const originalSourceSha256=hashBytesR3(original.sourceBytes);
 const baselineBundle=await clock.run(captureBaselineR3({...common,originalRenderRequest:original,originalSourceSha256}));
 const acceptanceLock=Object.freeze({id:'independent-audit-lock',status:'accepted',originalSourceSha256,candidateSourceSha256:hashBytesR3(candidate.sourceBytes),lockedBeforePrivateEvaluation:true});
 const evaluation=await clock.run(evaluateAcceptedR3({...common,originalSourceSha256,baselineBundle,candidateRenderRequest:candidate,acceptanceLock}));
 const data=JSON.parse(JSON.stringify({baselineBundle,evaluation,plan,calibration:f.calibration,environment:f.environment,policy:SHORT_POLICY_R3}));
 return {data,fake};
}
function nativeError(state,message='audit native runtime violation'){
 return {eventSequence:1,category:'runtime-exception',name:'TypeError',message,line:7,column:2,sourceURL:'public-control',renderEpoch:state.epoch,replayStage:{kind:'render',sequence:0},native:{method:'Runtime.exceptionThrown',params:{exceptionDetails:{text:'Uncaught',exception:{className:'TypeError',description:'TypeError: '+message}}}}};
}

test('A01 original/after are independent and all R/G projections share one acquisition',async()=>{
 const {data:d,fake}=await paired();
 assert.equal(fake.sessions.length,2);assert.notEqual(d.baselineBundle.originalRunId,d.evaluation.provenance.candidateRunId);
 assert.notEqual(d.baselineBundle.originalSourceSha256,d.evaluation.candidateSourceSha256);
 assert.deepEqual(d.evaluation.checks.map(c=>c.key),d.plan.expectedKeys);
 for(const check of d.evaluation.checks)for(const record of Object.values(check.measurements))assert.deepEqual(record.projection.acquisition,check.acquisition);
 assert.equal(auditEvaluationReceiptR3(d).endpoints.R.classification,'S');
 const missing=structuredClone(d);missing.evaluation.checks=[];assert.throws(()=>auditEvaluationReceiptR3(missing),/EXPECTED_KEYS/);
 notes.push({id:'A01',result:'pass-implementation',independentSessions:2,scope:'synthetic typed native results; no browser'});
});

test('A02 current producer reload receipt versus consumer direct contract',async()=>{
 const producer=readFileSync(join(root,'src/browser-session-r3.mjs'),'utf8');
 const literal=producer.match(/action:'reload',stateSemantics:'([^']+)'/);assert.ok(literal);
 const f=await fixtureCalibrationR3(),fake=fakeSessionsR3(f.calibration),clock=new FakeClockR3();
 const plan=planFixtureR3({steps:[{op:'reload',state:'reset-to-source'},{op:'observe',id:'after-reload',observation:{kind:'value',targetRef:'field'}}]});
 const factory=async metadata=>{const s=await fake.factory(metadata),reload=s.reload.bind(s);s.reload=async request=>({...await reload(request),stateSemantics:literal[1]});return s;};
 const result=await clock.run(runEvaluationR3({renderRequest:renderRequestR3(),plan,sessionFactory:factory,...f,policy:SHORT_POLICY_R3,ruleSets:Object.fromEntries(plan.expectedKeys.map(k=>[k,{capture}])),mode:'baseline',clock}));
 const action=result.actions[0];
 if(action.status==='error'){assert.equal(action.error.code,'R3_RELOAD_RESET_RECEIPT_MISMATCH');assert.ok(result.checks[0].notMeasured);}
 else assert.equal(action.status,'performed');
 notes.push({id:'A02',result:action.status==='error'?'counterexample-reproduced':'contract-now-aligned',producerStateSemantics:literal[1],actionStatus:action.status,error:action.error??null,realNativeExecuted:false});
});

test('A03 real native-journal W can be erased through summary-only receipt downgrade',async t=>{
 const {data:d}=await paired({captureHook:(r,s,serial)=>{if(serial===2&&s.captures===1)s.events.push(nativeError(s));return r;}});
 assert.equal(d.evaluation.endpoints.R.classification,'W');assert.equal(d.evaluation.runtimeEvidence.events.length,1);
 const forged=structuredClone(d);
 for(const scope of forged.evaluation.runtimeEvidence.scenarios)delete scope.nativeJournal;
 forged.evaluation.runtimeEvidence.events=[];
 for(const endpoint of ['R','G']){forged.evaluation.endpoints[endpoint].reasons=[];forged.evaluation.endpoints[endpoint].classification='S';}
 let accepted=false,error=null;
 try{const path=join(temporary(t),'downgraded.json');const descriptor=await persistEvaluationReceiptR3({...forged,receiptPath:path});const normalized=await normalizeEvaluationReceiptR3({receiptPath:path,expectedSha256:descriptor.sha256,expectedAcceptanceLockId:forged.evaluation.acceptanceLockId});assert.equal(normalized.independentEvaluation.outcomes.R.binding.classification,'S');accepted=true;}
 catch(e){error=e.code??e.message;}
 notes.push({id:'A03',result:accepted?'counterexample-reproduced':'downgrade-rejected',original:'W',modified:accepted?'S':null,error,attackerCapability:'trusted producer/persistence input control, including newly authorized receipt hash; NOT alteration under original external hash'});
});

test('A04 sidecar raw bytes are not bound/redecoded by final receipt normalization',async t=>{
 const dir=temporary(t),raw=join(dir,'public-synthetic-raw.json');
 writeFileSync(raw,JSON.stringify({kind:'public-synthetic-raw',value:'after'}),{flag:'wx'});
 const {data:d}=await paired({captureHook:r=>{r.evidence.rawSamplePath=raw;return r;}});
 const receiptPath=join(dir,'final-receipt.json');const descriptor=await persistEvaluationReceiptR3({...d,receiptPath});
 const rawBefore=hashBytesR3(readFileSync(raw));writeFileSync(raw,JSON.stringify({kind:'public-synthetic-raw',value:'wrong',renderEpoch:-9}));
 const rawAfter=hashBytesR3(readFileSync(raw));assert.notEqual(rawBefore,rawAfter);
 const normalized=await normalizeEvaluationReceiptR3({receiptPath,expectedSha256:descriptor.sha256});
 assert.equal(normalized.independentEvaluation.outcomes.R.binding.classification,'S');
 assert.equal(hashBytesR3(readFileSync(receiptPath)),descriptor.sha256);
 notes.push({id:'A04',result:'raw-sidecar-not-covered',rawBefore,rawAfter,receiptSha256:descriptor.sha256,classification:'S',scope:'unchanged authentic receipt still verifies; external referenced sidecar changed; synthetic control NOT claimed native capture'});
});

test('A05 rehashed false classifications and wrong lock/source/plan are rejected',async t=>{
 const {data:d}=await paired();
 for(const mutate of [x=>x.evaluation.endpoints.R.classification='W',x=>x.evaluation.acceptanceLock.originalSourceSha256='a'.repeat(64),x=>x.evaluation.provenance.planDigest='b'.repeat(64),x=>x.baselineBundle.facts[x.plan.expectedKeys[0]].fact.value='invented']){const x=structuredClone(d);mutate(x);assert.throws(()=>auditEvaluationReceiptR3(x));}
 const receiptPath=join(temporary(t),'receipt.json'),descriptor=await persistEvaluationReceiptR3({...d,receiptPath});
 await assert.rejects(normalizeEvaluationReceiptR3({receiptPath,expectedSha256:'0'.repeat(64)}),/HASH_MISMATCH/);
 await assert.rejects(normalizeEvaluationReceiptR3({receiptPath,expectedSha256:descriptor.sha256,expectedAcceptanceLockId:'wrong-lock'}),/EXTERNAL_LOCK/);
 notes.push({id:'A05',result:'pass-implementation',claim:'typed fact/window/verdict recomputation and lock/hash bindings, not native fact authenticity'});
});

test('A06 whole-vector geometry beats unchanged bool and pairwise small steps',()=>{
 const values=[0,.4,.8].map(x=>fact(true,[x,0,20,20]));
 assert.equal(stableWindowR3(values,{delta:.5}),false);
 assert.equal(stableWindowR3([fact(true,[0,0,20,20]),fact(true,[.4,0,20,20])],{delta:.5}),true);
 notes.push({id:'A06',result:'pass-implementation'});
});

test('A07 tail/window and W+UA conservatism survive projected records',async()=>{
 const {data:d}=await paired({captureHook:(r,s,serial)=>{if(serial===2)r.facts.targets[0].nodes[0].value='wrong';return r;}});
 const measurement=d.evaluation.checks[0].measurements.R;assert.equal(classifyMeasurementR3(measurement).partition,'W');
 const suite={schemaVersion:'v04-measurement-suite-r3-1',checks:[{key:'wrong',measurement},{key:'missing',notMeasured:{reason:'audit-gap'}}],actions:[],errors:[]};
 const result=classifySuiteR3(suite,{expectedKeys:['wrong','missing']});assert.equal(result.partition,'W');assert.ok(result.unresolved.length);
 const corrupt=structuredClone(measurement);corrupt.coverage.deadlineTailWithinPoll=false;assert.throws(()=>classifyMeasurementR3(corrupt));
 notes.push({id:'A07',result:'pass-implementation',partition:result.partition,uncertaintyRetained:true});
});

test('A08 R noneligible cannot masquerade as pass while G is eligible',async t=>{
 const {data:d}=await paired({noop:true});assert.equal(d.baselineBundle.endpoints.R.eligibility,'ineligible');assert.equal(d.baselineBundle.endpoints.G.eligibility,'eligible');
 const receiptPath=join(temporary(t),'noop.json'),descriptor=await persistEvaluationReceiptR3({...d,receiptPath}),n=await normalizeEvaluationReceiptR3({receiptPath,expectedSha256:descriptor.sha256});
 assert.ok(n.R.every(r=>r.status==='notMeasured'));assert.equal(n.independentEvaluation.outcomes.R.allRequiredPassed,false);assert.equal(n.independentEvaluation.outcomes.R.binding.classification,null);assert.equal(n.independentEvaluation.outcomes.G.binding.classification,'S');assert.deepEqual(n.R.map(r=>r.key),endpointExpectedKeysR3(d.baselineBundle).R);
 notes.push({id:'A08',result:'pass-implementation'});
});

test('A09 expected sentinel never reaches fake browser; locator expected object rejected',async()=>{
 const f=await fixtureCalibrationR3(),fake=fakeSessionsR3(f.calibration),clock=new FakeClockR3(),plan=planFixtureR3();
 const sentinel='AUDIT_EXPECTED_NOT_FOR_CDP_20260920';
 await clock.run(runEvaluationR3({renderRequest:renderRequestR3(),plan,sessionFactory:fake.factory,...f,policy:SHORT_POLICY_R3,ruleSets:Object.fromEntries(plan.expectedKeys.map(k=>[k,{capture,R:{cmp:'r3',rule:{kind:'absolute',expect:{cmp:'eq',value:sentinel}}}}])),mode:'baseline',clock}));
 assert.equal(JSON.stringify(fake.calls).includes(sentinel),false);
 assert.throws(()=>clonePublicLocator({by:'role',role:'textbox',expected:{value:sentinel}}),/INVALID_LOCATOR/);
 notes.push({id:'A09',result:'pass-implementation',scope:'payload spy plus source review; not arbitrary JavaScript safety proof'});
});

test('A10 runtime signature is replay-stage identity, not actual callsite identity',()=>{
 const sha='a'.repeat(64),options={runKey:'scope',sourceSha256:sha,runId:'audit'};
 function journal(location){const e=nativeError({epoch:1});e.sourceURL=location;e.line=location==='one'?1:999;e.stack={callFrames:[{functionName:location,url:location,lineNumber:e.line,columnNumber:1}]};return{available:true,complete:true,throughEventSequence:1,journals:[{sourceSha256:sha,renderEpoch:1,available:true,complete:true,droppedEvents:0,events:[e]}],events:[e]};}
 const a=normalizeRuntimeJournalR3(journal('one'),options),b=normalizeRuntimeJournalR3(journal('two'),options);assert.deepEqual(a.events[0].signature,b.events[0].signature);
 notes.push({id:'A10',result:'declared-scope-limitation',sameMessageDifferentCallsiteCollide:true,locationContract:a.events[0].evidence.locationContract});
});

test('A11 typed empty is not absent and AX number does not replace lexical DOM number',()=>{
 const base={element:{tagName:'input',attributes:{type:'number'},visible:true},snapshotEntry:{hasLayout:true,valueChannels:{textValue:{fieldPresent:true,entryPresent:false,stringIndex:null,value:null},inputValue:{fieldPresent:true,entryPresent:false,stringIndex:null,value:null}}},axNode:{ignored:false,value:{type:'number',value:0}},browserVersion:{product:'synthetic'}};
 const missing=decodeValueEvidence(base);assert.notEqual(missing.valueState,'available');assert.equal(missing.value,null);
 const lexical=structuredClone(base);lexical.snapshotEntry.valueChannels.inputValue={fieldPresent:true,entryPresent:true,stringIndex:0,value:'00'};
 const result=decodeValueEvidence(lexical);assert.notEqual(result.valueState,'available');assert.equal(result.valueError,'NUMBER_AX_SEMANTICS_UNCALIBRATED');
 notes.push({id:'A11',result:'pass-implementation',missingError:missing.valueError,lexicalError:result.valueError});
});

test('A12 source snapshot and independent receipt are final audit outputs',()=>{
 const after=hashes(),changes=sourcePaths.filter(p=>before[p]!==after[p]);
 assert.equal(after['src/browser-session-r2.mjs'],'75189d74d8c75c073b79db883b6e2648f72049be2ac4b31adfc06e1ec6ba498c');
 if(process.env.R3_AUDIT_RECEIPT){const output=process.env.R3_AUDIT_RECEIPT;assert.ok(!/(?:private-pilot|private-test|private-results|private-governance)/i.test(output));writeFileSync(output,JSON.stringify({schemaVersion:'r3-independent-evidence-audit-v1',createdAt:new Date().toISOString(),mode:'node-only-public-controls-no-browser-no-model-api',helperDisclosure:'owner fakeSessions/Clock reused as inert producer, independent audit assertions and literal producer contract cross-check; no native claim',sourceHashesBefore:before,sourceHashesAfter:after,concurrentSourceChanges:changes,tests:notes,formalNativeChainPassed:false,prohibitedDirectoriesRead:false,ownerSourceModified:false},null,2)+'\n',{flag:'wx'});}
});
