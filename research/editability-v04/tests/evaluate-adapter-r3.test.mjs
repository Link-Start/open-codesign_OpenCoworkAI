import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {persistEvaluationReceiptR3,normalizeEvaluationReceiptR3,endpointExpectedKeysR3} from '../src/evaluation-normalizer-r3.mjs';
import {normalizeRuntimeJournalR3} from '../src/runtime-evidence-r3.mjs';
import {nativeEvidenceRequestsR3} from '../src/native-evidence-bindings-r3.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCalibratedPolicyR3,runEvaluationR3} from '../src/evaluate-adapter-r3.mjs';
import {validateEvaluationPlanR3,deriveExpectedKeysR3,publicLocatorR3,compilePublicProbeR3,compilePublicActionR3,hashBytesR3} from '../src/evaluation-plan-r3.mjs';
import {classifyMeasurementR3} from '../src/measurement-records-r3.mjs';
import {captureBaselineR3,evaluateAcceptedR3,auditEvaluationReceiptR3} from '../src/baseline-r3.mjs';
import {FakeClockR3,SHORT_POLICY_R3,fixtureCalibrationR3,renderRequestR3,planFixtureR3,fakeSessionsR3} from './helpers/evaluation-r3-fixture.mjs';
const capture={cmp:'r3',rule:{kind:'capture'}},absolute=value=>({cmp:'r3',rule:{kind:'absolute',expect:{cmp:'eq',value}}});
async function execute({plan=planFixtureR3(),fakeOptions={},rules,request=renderRequestR3(),policy=SHORT_POLICY_R3}={}){
 const f=await fixtureCalibrationR3(),fake=fakeSessionsR3(f.calibration,fakeOptions),clock=new FakeClockR3;
 const result=await clock.run(runEvaluationR3({renderRequest:request,plan,sessionFactory:fake.factory,calibration:f.calibration,environment:f.environment,policy,ruleSets:Object.fromEntries(plan.expectedKeys.map(key=>[key,rules??{capture}])),mode:'baseline',clock}));return{...f,...fake,result,clock,plan};
}
test('one full capture supports multiple private projections without private browser payloads',async()=>{
 const x=await execute({rules:{capture,R:absolute('seed'),G:absolute('PRIVATE_SENTINEL_never_in_browser')}});assert.equal(x.result.checks.length,1);const check=x.result.checks[0];assert.equal(classifyMeasurementR3(check.acquisition).partition,'S');assert.equal(classifyMeasurementR3(check.measurements.R).partition,'S');assert.equal(classifyMeasurementR3(check.measurements.G).partition,'W');assert.equal(x.calls.filter(c=>c.kind==='capture').length,3);assert.ok(!JSON.stringify(x.calls).includes('PRIVATE_SENTINEL'));assert.deepEqual(Object.keys(x.calls.find(c=>c.kind==='capture').payload).sort(),['includeDocument','targets']);assert.equal(x.result.runtimeEvidence.complete,true);assert.equal(x.sessions[0].state.closes,1);
});
test('gap uses symmetric visible edge clearance rather than CSS gap',async()=>{for(const [a,b]of [['a','b'],['b','a']]){const x=await execute({plan:planFixtureR3({observation:{kind:'gap',targetRef:a,otherRef:b,axis:'x'}})});const m=x.result.checks[0].acquisition;assert.equal(classifyMeasurementR3(m).partition,'S');assert.equal(m.samples[0].actual.value,80);assert.equal(m.samples[0].actual.geometry.length,8)}});
test('visual grid supports flex and DOM order remains distinct from visual order',async()=>{
 for(const [observation,expected]of [[{kind:'grid',targetRef:'container',itemRefs:['a','b'],field:'columns',rowTolerance:.5,geometryTolerance:.5},2],[{kind:'order',itemRefs:['a','b'],axis:'row-major',rowTolerance:.5},['a','b']],[{kind:'order',itemRefs:['a','b'],axis:'dom'},['b','a']]]){const x=await execute({plan:planFixtureR3({observation})});const m=x.result.checks[0].acquisition;assert.equal(classifyMeasurementR3(m).partition,'S',JSON.stringify(m.samples));assert.deepEqual(m.samples[0].actual.value,expected)}
});
test('setViewport preserves live filled state and reload resets exact source state',async()=>{
 const observe=id=>({op:'observe',id,observation:{kind:'value',targetRef:'field'}}),plan=planFixtureR3({steps:[{op:'fill',targetRef:'field',value:'typed'},observe('filled'),{op:'setViewport',width:390,height:844,state:'preserve'},observe('narrow'),{op:'reload',state:'reset-to-source'},observe('reset')],overflow:true});const x=await execute({plan});const values=x.result.checks.filter(c=>!JSON.parse(c.key)[4].startsWith('$')).map(c=>c.acquisition.samples[0].actual.value);assert.deepEqual(values,['typed','typed','seed']);assert.equal(x.result.checks.length,7);assert.equal(x.result.actions.every(a=>a.status==='performed'),true,JSON.stringify(x.result.actions));assert.equal(x.result.runtimeEvidence.complete,true);assert.equal(x.result.scenarios[0].renderCount,2);
});
test('genuine baseline and accepted default runner audit roundtrip with independently bound source bytes',async()=>{
 const f=await fixtureCalibrationR3(),fake=fakeSessionsR3(f.calibration),clock=new FakeClockR3,plan=planFixtureR3(),original=renderRequestR3(),candidate=renderRequestR3('function App(){return <p>AFTER</p>}'),originalSourceSha256=hashBytesR3(original.sourceBytes);
 const shared={plan,sessionFactory:fake.factory,calibration:f.calibration,environment:f.environment,policy:SHORT_POLICY_R3,clock};
 const baseline=await clock.run(captureBaselineR3({...shared,originalRenderRequest:original,originalSourceSha256}));assert.equal(baseline.endpoints.R.eligibility,'eligible');assert.equal(baseline.endpoints.G.eligibility,'eligible');
 const lock=Object.freeze({id:'public-accept-lock',status:'accepted',candidateSourceSha256:hashBytesR3(candidate.sourceBytes),originalSourceSha256,lockedBeforePrivateEvaluation:true});const evaluation=await clock.run(evaluateAcceptedR3({...shared,candidateRenderRequest:candidate,originalSourceSha256,baselineBundle:baseline,acceptanceLock:lock}));assert.equal(evaluation.endpoints.R.classification,'S');assert.equal(evaluation.endpoints.G.classification,'S');assert.notEqual(baseline.run.runId,evaluation.provenance.candidateRunId);assert.equal(fake.sessions.length,2);
 const decoded=JSON.parse(JSON.stringify({baselineBundle:baseline,evaluation,plan,calibration:f.calibration,environment:f.environment,policy:SHORT_POLICY_R3}));assert.equal(auditEvaluationReceiptR3(decoded).audited,true);
});

test('public query refs preserve form control semantics, exactness and nested contexts',()=>{
 const catalog={field:{kind:'form-control-label',label:'Quantity',within:{kind:'role',role:'group',name:'Card'}},section:{kind:'role',role:'region',name:'Cart'}};
 const q=publicLocatorR3({kind:'query-ref',ref:'field',exact:false,within:{kind:'query-ref',ref:'section'}},catalog);assert.equal(q.by,'form-control-label');assert.equal(q.exact,false);assert.equal(q.within.name,'Card');assert.equal(q.within.within.name,'Cart');assert.ok(!JSON.stringify(q).includes('textbox'));
 assert.throws(()=>publicLocatorR3({kind:'query-ref',ref:'a'},{a:{kind:'query-ref',ref:'b'},b:{kind:'query-ref',ref:'a'}}),{code:'PUBLIC_QUERY_REFERENCE_CYCLE_OR_MISSING'});
 let deep={kind:'role',role:'button'};for(let i=0;i<10;i++)deep={kind:'role',role:'group',within:deep};assert.throws(()=>publicLocatorR3(deep),{code:'INVALID_PUBLIC_QUERY'});
});
test('public eleven-kind probes compile without inferring private expected values',()=>{
 const q={kind:'form-control-label',label:'Field'},a={kind:'role',role:'button',name:'A'},b={kind:'role',role:'button',name:'B'};
 const cases=[...[ 'value','text','count','enabled'].map(kind=>[{kind,query:q},{}]),[{kind:'attribute',query:q,attribute:'title'},{}],[{kind:'rect',query:q},{field:'width'}],[{kind:'withinViewport',query:q},{tolerance:.5}],[{kind:'gap',queries:[a,b],axis:'horizontal'},{}],[{kind:'grid',queries:[a,b],gridClusterTolerancePx:.5},{field:'columns',geometryTolerance:.5}],[{kind:'order',queries:[a,b],orderBasis:'visual'},{}],[{kind:'documentOverflow'},{}]];
 for(const[probe,projection]of cases){const compiled=compilePublicProbeR3(probe,{projection,namespace:'probe'});assert.equal(compiled.observation.kind,probe.kind);assert.ok(Object.isFrozen(compiled));assert.equal(JSON.stringify(compiled).includes('expect'),false)}
 assert.throws(()=>compilePublicProbeR3({kind:'rect',query:q},{namespace:'bad'}));assert.throws(()=>compilePublicProbeR3({kind:'grid',queries:[a,b]},{namespace:'bad'}));assert.throws(()=>compilePublicProbeR3({kind:'gap',queries:[a,b],axis:'horizontal',expect:80},{namespace:'bad'}));assert.throws(()=>compilePublicProbeR3({kind:'order',queries:[a,b]},{namespace:'bad'}));
});
test('all five public actions have explicit replay semantics and no private fields',()=>{
 const q={kind:'form-control-label',label:'Field'};for(const action of [{type:'click',query:q},{type:'fill',query:q,value:'hello'},{type:'key',query:q,key:'Enter'},{type:'reload'},{type:'setViewport',viewport:{width:390,height:844}}]){const c=compilePublicActionR3(action,{namespace:'action'});assert.equal(c.step.op,action.type);if(action.type==='reload')assert.equal(c.step.state,'reset-to-source');if(action.type==='setViewport')assert.equal(c.step.state,'preserve')}
 assert.throws(()=>compilePublicActionR3({type:'click',query:q,expectedValue:'private'},{namespace:'bad'}));
});
test('expected keys and primary G no-op policy cannot be silently changed',()=>{
 for(const mutate of [p=>p.expectedKeys.pop(),p=>p.expectedKeys.push(p.expectedKeys[0]),p=>p.requirements.excludeNoopFromG=true]){const p=planFixtureR3();mutate(p);assert.throws(()=>validateEvaluationPlanR3(p))}
 const p=planFixtureR3({overflow:true});assert.equal(p.expectedKeys.length,3);const normalized=validateEvaluationPlanR3(p);assert.equal(normalized.requirements.originals.filter(r=>JSON.parse(r.key)[4].startsWith('$')).length,2);assert.equal(normalized.requirements.protections.filter(r=>JSON.parse(r.key)[4].startsWith('$')).length,2);
});
test('calibration loader rejects stale file, observer and compiler pins before sessions',async()=>{
 const f=await fixtureCalibrationR3();for(const changed of [{expectedFileSha256:'e'.repeat(64)},{expectedObserverSha256:'e'.repeat(64)},{expectedCompilerHashes:{'babel.standalone.js':'e'.repeat(64)}}])await assert.rejects(loadCalibratedPolicyR3({...f.load,...changed}));
 const fake=fakeSessionsR3(f.calibration),plan=planFixtureR3();await assert.rejects(runEvaluationR3({renderRequest:renderRequestR3(),plan,sessionFactory:fake.factory,calibration:structuredClone(f.calibration),environment:f.environment,ruleSets:Object.fromEntries(plan.expectedKeys.map(k=>[k,{capture}])),mode:'baseline'}),{code:'VERIFIED_R3_CALIBRATION_REQUIRED'});assert.equal(fake.calls.length,0);
});
test('fatal viewport invalidation after earlier stable evidence yields UA and one abort',async()=>{
 const x=await execute({rules:{capture,R:absolute('seed')},fakeOptions:{captureHook:(r,s)=>{if(s.captures===3)s.epoch++;return r}}});const m=x.result.checks[0].measurements.R;assert.equal(classifyMeasurementR3(m).partition,'U_A');assert.ok(m.evidence.firstStableSatisfying);assert.equal(m.health.sessionUsable,false);assert.equal(x.sessions[0].state.aborts,1);assert.equal(x.result.runtimeEvidence.complete,false);
});
for(const [label,hook]of [['uncalibrated empty',r=>{const n=r.facts.targets[0].nodes[0];n.value='';n.valueState='unsupported';return r}],['missing value channel',r=>{r.facts.targets[0].nodes[0].rawPresence.axNode=false;return r}],['missing raw layout document',r=>{r.facts.document=null;return r}],['incoherent native snapshot',r=>{r.evidence.axBracketStable=false;return r}]])test(label+' remains UA rather than invented empty/zero or W',async()=>{
 const observation=label==='missing raw layout document'?{kind:'documentOverflow',axis:'x'}:{kind:'value',targetRef:'field'};const x=await execute({plan:planFixtureR3({observation}),rules:{capture,R:absolute(label==='missing raw layout document'?0:'')},fakeOptions:{captureHook:hook}});assert.equal(classifyMeasurementR3(x.result.checks[0].measurements.R).partition,'U_A');assert.ok(x.result.checks[0].acquisition.samples.every(s=>s.state!=='ok'));
});
test('multi-query physical aliases are unknown instead of invented repeated boxes',async()=>{
 const plan=planFixtureR3({observation:{kind:'gap',targetRef:'a',otherRef:'b',axis:'x'}});plan.catalog.b=structuredClone(plan.catalog.a);const x=await execute({plan});assert.equal(classifyMeasurementR3(x.result.checks[0].acquisition).partition,'U_A');assert.equal(x.result.checks[0].acquisition.samples[0].error.code,'LAYOUT_QUERY_IDENTITIES_NOT_DISTINCT');
});
test('source-byte mutation cannot be rebound to the receipt even when both are changed together',async()=>{
 const x=await execute({fakeOptions:{renderHook:(receipt,state,serial,request)=>{request.sourceBytes.fill(0);receipt.sourceSha256=hashBytesR3(request.sourceBytes);return receipt}}});assert.ok(x.result.checks.every(c=>c.notMeasured));assert.equal(x.result.errors[0].error.code,'R3_RENDER_RECEIPT_PROVENANCE_MISMATCH');assert.equal(x.calls.filter(c=>c.kind==='capture').length,0);
});
test('bounded action failure skips descendants but runs following independent scenario',async()=>{
 const p=planFixtureR3({secondScenario:true,steps:[{op:'fill',targetRef:'field',value:'typed'},{op:'observe',id:'value',observation:{kind:'value',targetRef:'field'}}]});const x=await execute({plan:p,fakeOptions:{actionHook:(a,s,serial)=>serial===1?new Promise(()=>{}):undefined}});assert.equal(x.result.checks.length,2);assert.ok(x.result.checks[0].notMeasured);assert.equal(classifyMeasurementR3(x.result.checks[1].acquisition).partition,'S');assert.equal(x.sessions.length,2);assert.equal(x.sessions[0].state.aborts,1);assert.equal(x.result.runtimeEvidence.scenarios[0].complete,false);assert.equal(x.result.runtimeEvidence.scenarios[1].complete,true);
});
test('all rectangle coordinates, not only passing predicate, must stabilize across whole window',async()=>{
 const x=await execute({plan:planFixtureR3({observation:{kind:'rect',targetRef:'field',field:'width'}}),policy:{...SHORT_POLICY_R3,stableSamples:3},rules:{capture,R:{cmp:'r3',rule:{kind:'absolute',expect:{cmp:'between',min:90,max:200}}}},fakeOptions:{captureHook:(r,s)=>{r.facts.targets[0].nodes[0].layout.bounds.x+=(s.captures-1)*.4;return r}}});assert.equal(classifyMeasurementR3(x.result.checks[0].measurements.R).partition,'U_A');
});
function runtimeEvent(state,{message='boom',line=10,category='runtime-exception',sequence=1}={}){return{eventSequence:sequence,category,name:category==='console-error'?'ConsoleError':'TypeError',message,line,column:2,sourceURL:'native-source',renderEpoch:state.epoch,replayStage:{kind:'render',sequence:0},native:{method:category==='console-error'?'Runtime.consoleAPICalled':'Runtime.exceptionThrown',params:{exceptionDetails:{text:'Uncaught',exception:{className:'TypeError',description:'TypeError: '+message}}}}}}
async function paired({originalMessage=null,candidateMessage=null,candidateIncomplete=false,noop=false}={}){
 const f=await fixtureCalibrationR3(),clock=new FakeClockR3,plan=planFixtureR3(),original=renderRequestR3(noop?'function App(){return <p>AFTER</p>}':undefined),candidate=renderRequestR3(noop?'function App(){return <p>BEFORE</p>}':'function App(){return <p>AFTER</p>}');if(noop)plan.requirements.originals[0].expect.value='after';
 const fake=fakeSessionsR3(f.calibration,{captureHook:(r,s,serial)=>{if(s.captures===1){const message=serial===1?originalMessage:candidateMessage;if(message!==null)s.events.push(runtimeEvent(s,{message,line:serial===1?10:140}));if(serial!==1&&candidateIncomplete)s.journals[0].complete=false}return r}}),originalSourceSha256=hashBytesR3(original.sourceBytes),common={plan,sessionFactory:fake.factory,calibration:f.calibration,environment:f.environment,policy:SHORT_POLICY_R3,clock};
 const baseline=await clock.run(captureBaselineR3({...common,originalRenderRequest:original,originalSourceSha256})),lock=Object.freeze({id:'lock-public-'+String(noop),status:'accepted',originalSourceSha256,candidateSourceSha256:hashBytesR3(candidate.sourceBytes),lockedBeforePrivateEvaluation:true}),evaluation=await clock.run(evaluateAcceptedR3({...common,originalSourceSha256,candidateRenderRequest:candidate,baselineBundle:baseline,acceptanceLock:lock}));return{...f,plan,baseline,evaluation,lock,fake};
}
test('runtime signature ignores native line shifts but rejects different same-count error identities',async()=>{
 const same=await paired({originalMessage:'old',candidateMessage:'old'});assert.equal(same.baseline.endpoints.G.eligibility,'ineligible');assert.equal(same.evaluation.endpoints.R.classification,'S');const different=await paired({originalMessage:'old',candidateMessage:'new'});assert.equal(different.evaluation.endpoints.R.classification,'W');
});
test('incomplete native journal retains independently confirmed new W plus UA',async()=>{
 const x=await paired({candidateMessage:'new',candidateIncomplete:true});for(const endpoint of ['R','G']){assert.equal(x.evaluation.endpoints[endpoint].classification,'W');assert.ok(x.evaluation.endpoints[endpoint].uncertainty.length)}assert.equal(x.evaluation.runtimeEvidence.events[0].confirmed,true);assert.equal(x.evaluation.runtimeEvidence.complete,false);
});
test('healthy no-op remains primary G eligible and wrong accepted candidate is not automatic S',async()=>{
 const x=await paired({noop:true});assert.equal(x.baseline.noop,'confirmed-noop');assert.equal(x.baseline.endpoints.R.eligibility,'ineligible');assert.equal(x.baseline.endpoints.G.eligibility,'eligible');assert.equal(x.evaluation.endpoints.R.classification,null);assert.equal(x.evaluation.endpoints.G.classification,'W');
});
test('default native-session evaluator persists and independently normalizes exact complete evidence',async()=>{
 const x=await paired(),directory=await mkdtemp(join(tmpdir(),'r3-default-chain-'));try{
 const receiptPath=join(directory,'receipt.json'),descriptor=await persistEvaluationReceiptR3({receiptPath,baselineBundle:x.baseline,evaluation:x.evaluation,plan:x.plan,calibration:x.calibration,environment:x.environment,policy:SHORT_POLICY_R3}),normalized=await normalizeEvaluationReceiptR3({receiptPath,expectedSha256:descriptor.sha256,expectedBytes:descriptor.bytes,expectedAcceptanceLockId:x.lock.id}),bytes=await readFile(receiptPath);assert.equal(hashBytesR3(bytes),descriptor.sha256);assert.equal(bytes.at(-1),10);assert.deepEqual(normalized.R.map(r=>r.key),endpointExpectedKeysR3(x.baseline).R);assert.equal(normalized.independentEvaluation.outcomes.R.binding.classification,'S');assert.equal(normalized.independentEvaluation.outcomes.G.binding.classification,'S');assert.equal(normalized.independentEvaluation.outcomes.R.binding.evidenceHash,descriptor.sha256);
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('native console error object stack lines do not become semantic identity; reload ordinal does',()=>{
 const sourceSha256='a'.repeat(64),scope={runKey:'public-run',sourceSha256,runId:'public-id'};
 function journal(line,epoch=1,earlier=false){const e=runtimeEvent({epoch},{message:'Error: boom\n    at source:'+line,category:'console-error'});e.native.params={args:[{type:'object',subtype:'error',className:'Error',description:'Error: boom\n    at source:'+line}]};const j={sourceSha256,renderEpoch:epoch,available:true,complete:true,droppedEvents:0,events:[e]};return{available:true,complete:true,throughEventSequence:1,journals:earlier?[{...j,renderEpoch:0,events:[]},j]:[j],events:[e]}}
 const a=normalizeRuntimeJournalR3(journal(10),scope),b=normalizeRuntimeJournalR3(journal(140),scope),c=normalizeRuntimeJournalR3(journal(140,2,true),scope);assert.equal(a.complete,true);assert.equal(a.events[0].signature.code,b.events[0].signature.code);assert.notEqual(a.events[0].signature.location,c.events[0].signature.location);
});
test('reload consumes actual browser declared state semantics and distinct physical artifact IDs',async()=>{
 const source=await readFile(new URL('../src/browser-session-r3.mjs',import.meta.url),'utf8'),literal=source.match(/action:'reload',stateSemantics:'([^']+)'/);assert.ok(literal);assert.equal(literal[1],'reset-to-rendered-source-bytes-new-document-new-React-state-new-profile');
 const plan=planFixtureR3({secondScenario:true,steps:[{op:'reload',state:'reset-to-source'},{op:'observe',id:'reset',observation:{kind:'value',targetRef:'field'}}]}),f=await fixtureCalibrationR3(),fake=fakeSessionsR3(f.calibration),clock=new FakeClockR3;
 const factory=async metadata=>{const s=await fake.factory(metadata),reload=s.reload.bind(s);s.reload=async request=>({...await reload(request),stateSemantics:literal[1]});return s};
 const result=await clock.run(runEvaluationR3({renderRequest:renderRequestR3(),plan,sessionFactory:factory,calibration:f.calibration,environment:f.environment,policy:SHORT_POLICY_R3,ruleSets:Object.fromEntries(plan.expectedKeys.map(k=>[k,{capture}])),mode:'baseline',clock}));assert.ok(result.actions.every(a=>a.status==='performed'));const ids=fake.calls.filter(c=>c.kind==='reload').map(c=>c.payload.artifactId);assert.equal(new Set(ids).size,2);assert.ok(ids.every(id=>/^r3-[a-f0-9-]{36}-[01]-reload-0$/.test(id)));
});
test('native-style watchdog invalidation before trailing action cannot retain a clean scope',async()=>{
 const plan=planFixtureR3({steps:[{op:'observe',id:'value',observation:{kind:'value',targetRef:'field'}},{op:'click',targetRef:'button'}]}),f=await fixtureCalibrationR3(),fake=fakeSessionsR3(f.calibration),clock=new FakeClockR3;
 const factory=async metadata=>{const s=await fake.factory(metadata),descriptor=Object.getOwnPropertyDescriptor(s,'diagnostics');let readsAfterCapture=0;Object.defineProperty(s,'diagnostics',{get(){const d=descriptor.get.call(s);if(s.state.captures===3&&++readsAfterCapture>=4)d.renderEpoch++;return d}});return s};
 const run=await clock.run(runEvaluationR3({renderRequest:renderRequestR3(),plan,sessionFactory:factory,calibration:f.calibration,environment:f.environment,policy:SHORT_POLICY_R3,ruleSets:Object.fromEntries(plan.expectedKeys.map(k=>[k,{capture}])),mode:'baseline',clock}));assert.equal(run.actions[0].status,'skipped');assert.equal(run.runtimeEvidence.scenarios[0].lifecycleComplete,false);assert.equal(run.runtimeEvidence.complete,false);assert.equal(fake.sessions[0].state.aborts,1);
});
test('visual masonry row envelopes are not fabricated rectangle intersections',async()=>{
 const plan=planFixtureR3({observation:{kind:'grid',targetRef:'container',itemRefs:['a','b','c'],field:'columns',rowTolerance:.5,geometryTolerance:.5}});plan.catalog.c={by:'role',role:'button',name:'C',exact:true};
 const x=await execute({plan,fakeOptions:{captureHook:r=>{const reference=r.facts.targets.find(t=>t.locator.name==='A').nodes[0];for(const t of r.facts.targets){const name=t.locator.name;if(!['A','B','C'].includes(name))continue;if(name==='C'){t.nodes=[structuredClone(reference)];t.nodes[0].backendNodeId=6;t.nodes[0].nodeIndex=6;t.matchCount=1;t.backendNodeIds=[6];r.identity.targets.find(i=>i.key===t.key).backendNodeIds=[6]}const rect=name==='A'?{x:0,y:0,width:50,height:100}:name==='B'?{x:100,y:0,width:50,height:20}:{x:100,y:30,width:50,height:20};t.nodes[0].layout.bounds={...rect,right:rect.x+rect.width,bottom:rect.y+rect.height}}return r}}});const m=x.result.checks[0].acquisition;assert.equal(classifyMeasurementR3(m).partition,'S');assert.equal(m.samples[0].actual.value,2);assert.deepEqual(m.samples[0].actual.errors,[]);
});
test('native sealing request extraction refuses fake relative paths and missing successful-sample identity',async()=>{
 const x=await paired();assert.throws(()=>nativeEvidenceRequestsR3({baselineBundle:x.baseline,evaluation:x.evaluation,plan:x.plan}),{code:'R3_NATIVE_CAPTURE_IDENTITY_REQUIRED'});
 const data=structuredClone({baselineBundle:x.baseline,evaluation:x.evaluation,plan:x.plan});delete data.baselineBundle.run.checks[0].acquisition.samples[0].identity;assert.throws(()=>nativeEvidenceRequestsR3(data),{code:'R3_VALID_FACT_NATIVE_REFERENCE_REQUIRED'});
 const directory=await mkdtemp(join(tmpdir(),'r3-request-only-'));try{
  for(const run of [data.baselineBundle.run,{checks:data.evaluation.checks}])for(const check of run.checks)for(const sample of check.acquisition.samples){sample.identity??=structuredClone(check.acquisition.samples[1].identity);sample.evidence.native.rawSamplePath=join(directory,sample.identity.renderId+'-'+sample.evidence.native.rawSampleId+'.json')}
  const request=nativeEvidenceRequestsR3(data);assert.equal(request.baseline.captures.length,3);assert.equal(request.candidate.captures.length,3);assert.notEqual(request.baseline.runId,request.candidate.runId);assert.ok(request.baseline.runtimeScopes.every(s=>Object.hasOwn(s,'nativeJournal')));assert.equal(Object.hasOwn(request.baseline,'sealVerified'),false); // extraction alone is not a native seal
  data.baselineBundle.run.checks[0].acquisition.samples[1].evidence.native.rawSamplePath=data.baselineBundle.run.checks[0].acquisition.samples[0].evidence.native.rawSamplePath;assert.throws(()=>nativeEvidenceRequestsR3(data),{code:'R3_NATIVE_CAPTURE_PATH_IDENTITY_COLLISION'});
 }finally{await rm(directory,{recursive:true,force:true})}
});