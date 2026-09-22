import test from 'node:test';
import assert from 'node:assert/strict';
import {runExperimentV1,rollupV1,pairedScopeAuditV1,PUBLIC_CHECK_KEYS_V1} from '../src/experiment-runner-v1.mjs';
import {createMethodsV1,sha256,rebuildPatch} from '../src/methods-v1.mjs';
const source='function App(){return <p>old</p>}';
const task=()=>({sourceId:'s1',taskId:'t1',originalSource:source,originalSourceHash:sha256(source),eligibility:{R:'eligible',G:'eligible'},expectedKeys:{R:['target','preserve'],G:['target','preserve']},evaluationRef:'SECRET_EVAL',
 publicRequest:{userGoal:'Change text',scope:'source-definition',locator:{tagName:'p',text:'old',baseline:'SECRET_LOCATOR'},operation:{kind:'set-text',value:'new'}}});
const plan=(tasks=[task()])=>({datasetId:'handwritten-control',datasetKind:'dev',tasks});
function candidate(){const start=source.indexOf('old'),patches=[{start,end:start+3,expectedText:'old',replacement:'new'}],content=rebuildPatch(source,patches);return {status:'candidate',patches,content,sourceHash:sha256(content),candidateHash:sha256(content)};}
function dependencies(extra={}){
 const engine={candidate:()=>candidate(),fallback:()=>candidate(),guard:()=>({pass:true,reason:'pass'})};
 return {plan:plan(),methods:createMethodsV1({engine,oneshot:async payload=>{assert.doesNotMatch(JSON.stringify(payload),/SECRET/);return {proposal:{patches:candidate().patches}};}}),
 prepare:async input=>{assert.doesNotMatch(JSON.stringify(input),/SECRET/);return {status:'ready',provenance:{sourceHash:sha256(source),targetId:'22:32'},expected:'SECRET_PREPARED'};},
 publicCheck:async input=>{assert.doesNotMatch(JSON.stringify(input),/SECRET/);return {checks:PUBLIC_CHECK_KEYS_V1.map(key=>({key,pass:true}))};},
 executor:async input=>{assert.equal(input.originalSource,source);assert.equal(input.accepted,true);assert.equal(input.evaluationRef,'SECRET_EVAL');return {replayed:true};},
 evaluator:async()=>({R:[{key:'target',status:'pass'},{key:'preserve',status:'pass'}],G:[{key:'target',status:'pass'},{key:'preserve',status:'pass'}]}),...extra};
}
test('four unique method slots, one union proposal, all start from original, closed R/G',async()=>{
 let executions=0,evaluations=0;const deps=dependencies();const execute=deps.executor;deps.executor=async input=>{executions++;return execute(input);};const evaluate=deps.evaluator;deps.evaluator=async input=>{evaluations++;return evaluate(input);};
 const result=await runExperimentV1(deps);assert.equal(result.records.length,4);assert.equal(executions,4);assert.equal(evaluations,4);
 for(const rollup of Object.values(result.rollups)){assert.equal(rollup.counts.P,1);assert.equal(rollup.counts.A,1);assert.equal(rollup.counts.S,1);}
 assert.equal(result.formalReady,false);assert.equal(result.integrationStatus,'dependency-injected-controls-only');
 for(const record of result.records){assert.equal(sha256(rebuildPatch(source,record.patches)),record.sourceAfterHash);assert.equal(record.acceptanceLocked,true);}
});
test('scope rejection causes no executor write and matched candidate audits foregone success',async()=>{
 const deps=dependencies();deps.methods=createMethodsV1({engine:{candidate:()=>candidate(),fallback:()=>candidate(),guard:()=>({pass:false,reason:'scope-unsupported'})},oneshot:async()=>({proposal:{patches:candidate().patches}})});
 const executed=[];deps.executor=async input=>{executed.push(input.method);return {};};const result=await runExperimentV1(deps);
 assert.deepEqual(executed,['SCOPE_OFF','LLM_ONESHOT']);assert.equal(result.rollups['R/FULL'].counts.S,0);assert.equal(result.rollups['R/FULL'].rates.W_over_A,null);
 assert.equal(pairedScopeAuditV1(result.records)[0].classification,'foregone-S');
});
test('accepted cannot be rewritten after independent evaluator failure or violation',async()=>{
 const deps=dependencies({evaluator:async({candidate:locked})=>{assert.throws(()=>{locked.accepted=false;},TypeError);return {R:[{key:'target',status:'confirmed-violation'},{key:'preserve',status:'unknown'}],G:[]};}});
 const result=await runExperimentV1(deps);for(const record of result.records){assert.equal(record.accepted,true);assert.equal(record.proposal,'accepted');assert.equal(record.evaluation.R.outcome,'W');assert.equal(record.evaluation.R.uncertainty,true);assert.equal(record.evaluation.G.outcome,'U_A');assert.throws(()=>{record.accepted=false;},TypeError);}
 const failed=await runExperimentV1(dependencies({evaluator:async()=>{throw new Error('SECRET');}}));assert.equal(failed.records[0].accepted,true);assert.equal(failed.records[0].evaluation.R.outcome,'U_A');assert.doesNotMatch(JSON.stringify(failed),/SECRET/);
});
test('duplicate slots and duplicate expected keys fail before method call',async()=>{
 await assert.rejects(runExperimentV1(dependencies({plan:plan([task(),task()])})),/DUPLICATE_SLOT/);
 const t=task();t.expectedKeys.R=['x','x'];await assert.rejects(runExperimentV1(dependencies({plan:plan([t])})),/EXPECTED_KEYS/);
});
test('missing duplicate and extra checks never silently pass',async()=>{
 for(const rows of [[{key:'target',status:'pass'}],[{key:'target',status:'pass'},{key:'target',status:'pass'},{key:'preserve',status:'pass'}],
 [{key:'target',status:'pass'},{key:'preserve',status:'pass'},{key:'extra',status:'pass'}]]){
 const result=await runExperimentV1(dependencies({evaluator:async()=>({R:rows,G:rows})}));assert.equal(result.records[0].evaluation.R.outcome,'U_A');assert.ok(result.records[0].evaluation.R.auditFailures.length);
 }
});
test('common public checks mandatory, missing or duplicate receipt rejects before execution',async()=>{
 for(const checks of [[],[{key:'parse',pass:true},{key:'entry',pass:true},{key:'entry',pass:true}]]){
 const result=await runExperimentV1(dependencies({publicCheck:async()=>({checks}),executor:()=>assert.fail('must not execute')}));
 assert.equal(result.rollups['R/FULL'].counts.publicProtocolRejection,1);assert.equal(result.records[0].accepted,false);
 }
});
test('planned uncalled and upstream missing remain complete slots with algebra closure',async()=>{
 const tasks=[];for(const [index,state] of ['originalIneligible','eligibilityUnresolved','upstreamMissing','notScreened'].entries())tasks.push({...task(),taskId:`skip${index}`,eligibility:{R:state,G:state},originalSource:null});
 tasks.push({...task(),taskId:'prep',prepare:false},{...task(),taskId:'proposal',propose:false});
 const result=await runExperimentV1(dependencies({plan:plan(tasks),executor:()=>assert.fail()}));assert.equal(result.records.length,24);
 const c=result.rollups['R/FULL'].counts;assert.equal(c.P,6);assert.equal(c.E,2);assert.equal(c.Q,1);assert.equal(c.A,0);assert.equal(c.preparationNotExecuted,1);assert.equal(c.proposalNotExecuted,1);
 assert.throws(()=>rollupV1([...result.records,result.records[0]],'R','FULL'),/DUPLICATE_SLOT/);
});
test('preparation failure and method errors are not original ineligible',async()=>{
 const failed=await runExperimentV1(dependencies({prepare:async()=>{throw Error('SECRET');}}));assert.equal(failed.rollups['R/FULL'].counts.E,1);assert.equal(failed.rollups['R/FULL'].counts.preparationFailure,1);
 const errored=await runExperimentV1(dependencies({methods:{propose:async()=>{throw Error('SECRET');}}}));assert.equal(errored.rollups['R/FULL'].counts.methodError,1);assert.doesNotMatch(JSON.stringify(errored),/SECRET/);
});
test('no private evaluator or runtime is not scientific readiness or successful measurement',async()=>{
 const result=await runExperimentV1(dependencies({executor:undefined,evaluator:undefined}));assert.equal(result.records[0].accepted,true);assert.equal(result.records[0].execution,'not-executed');assert.equal(result.records[0].evaluation.R.outcome,'U_A');assert.equal(result.formalReady,false);
});
test('R/G union still proposes once when one mask is ineligible',async()=>{
 const t=task();t.eligibility.G='originalIneligible';const result=await runExperimentV1(dependencies({plan:plan([t])}));assert.equal(result.records.length,4);assert.equal(result.rollups['G/FULL'].counts.E,0);assert.equal(result.rollups['R/FULL'].counts.A,1);assert.equal(result.records[0].evaluation.G,undefined);
});

test('candidate tampering is public protocol failure and never writes',async()=>{
 const c=candidate();c.patches[0].expectedText='wrong';
 const result=await runExperimentV1(dependencies({methods:{propose:async()=>({status:'proposed',candidate:c,guard:{pass:true}})},executor:()=>assert.fail()}));
 assert.equal(result.records[0].publicProtocolFailure,'CANDIDATE_INTEGRITY');assert.equal(result.rollups['R/FULL'].counts.publicProtocolRejection,1);assert.equal(result.records[0].accepted,false);
});
test('same hash with non-scope guard rejection is not a prevented-risk claim',()=>{
 const full={datasetId:'d',sourceId:'s',taskId:'t',method:'FULL',candidateHash:'same',guard:{pass:false,reason:'candidate-mismatch'},proposal:'rejected'};
 const off={...full,method:'SCOPE_OFF',accepted:true,evaluation:{R:{outcome:'W'}}};
 assert.equal(pairedScopeAuditV1([full,off])[0].opportunity,false);
});
test('injected oneshot calls are not asserted as measured network billing attempts',async()=>{
 const result=await runExperimentV1(dependencies());
 const llm=result.records.find(r=>r.method==='LLM_ONESHOT');assert.equal(llm.cost.transportInvocations,1);assert.equal(llm.cost.experimentApiAttempts,null);
 assert.equal(result.records[0].cost.experimentApiAttempts,0);
});
test('proposal is snapshotted before async public check can mutate caller-owned candidate',async()=>{
 let retained;const result=await runExperimentV1(dependencies({
   methods:{propose:async()=>{retained=candidate();return {status:'proposed',candidate:retained,guard:{pass:true}};}},
   publicCheck:async input=>{retained.content='tampered after integrity check';retained.patches[0].replacement='injected';return {checks:PUBLIC_CHECK_KEYS_V1.map(key=>({key,pass:true}))};},
   executor:async locked=>{assert.equal(sha256(locked.content),locked.candidateHash);assert.equal(rebuildPatch(locked.originalSource,locked.patches),locked.content);assert.equal(locked.content,candidate().content);return {};}
 }));assert.ok(result.records.every(r=>r.accepted));
});
test('mapping getter failure does not erase shared Q or call provenance-free methods with mapping',async()=>{
 let reads=0;const deps=dependencies({prepare:async()=>({status:'ready',get provenance(){reads++;throw Error('SECRET_MAPPING');}})});
 const wrapped=deps.methods;deps.methods={propose:async(method,input)=>{if(['PROVENANCE_OFF','LLM_ONESHOT'].includes(method))assert.equal(Object.hasOwn(input,'provenance'),false);return wrapped.propose(method,input);}};
 const result=await runExperimentV1(deps);assert.equal(reads,1);assert.ok(result.records.every(r=>r.preparation==='ready'));
 assert.equal(result.records.find(r=>r.method==='LLM_ONESHOT').cost.transportInvocations,1);assert.doesNotMatch(JSON.stringify(result),/SECRET_MAPPING/);
});
test('null or undefined method rejection remains four terminal methodError slots',async()=>{
 for(const reason of [null,undefined]){
   const result=await runExperimentV1(dependencies({methods:{propose:async()=>{throw reason;}}}));
   assert.equal(result.records.length,4);assert.ok(result.records.every(r=>r.methodError==='METHOD_EXCEPTION'));
   for(const value of Object.values(result.rollups))assert.equal(value.counts.methodError,1);
 }
});
test('independent raw receipt and bindings survive runner without reaching methods or losing fields',async()=>{
 const root={evaluationSchema:'handwritten-receipt-1',normalizerVersion:'handwritten-normalizer-1'};
 const rawBytes=JSON.stringify({schemaVersion:root.evaluationSchema,privateExpected:'SECRET_RAW_EXPECTED',temporalEvidence:{tail:5}});
 const receipt={bytesUtf8:rawBytes,evidenceHash:sha256(rawBytes)};
 const normalized=()=>({confirmedViolation:false,unknown:false,allRequiredPassed:true,binding:{...root,evidenceHash:receipt.evidenceHash,classification:'S'}});
 const supplied={evaluationBinding:structuredClone(root),receipt:structuredClone(receipt),outcomes:{R:normalized(),G:normalized()}};
 const deps=dependencies({evaluationBinding:root});const base=deps.evaluator;
 deps.evaluator=async input=>({...await base(input),independentEvaluation:supplied});
 const result=await runExperimentV1(deps);supplied.receipt.bytesUtf8='later caller mutation';root.normalizerVersion='later root mutation';
 for(const record of result.records){assert.deepEqual(record.independentEvaluation.receipt,receipt);assert.equal(record.independentEvaluation.outcomes.R.binding.evidenceHash,receipt.evidenceHash);assert.equal(record.decisionLocked,true);assert.equal(record.acceptanceLocked,true);}
 assert.equal(result.evaluationBinding.normalizerVersion,'handwritten-normalizer-1');
 assert.throws(()=>{result.records[0].independentEvaluation.receipt.bytesUtf8='rewrite';},TypeError);
});
test('decision finality is separate from acceptance: rejected/error lock never means accepted',async()=>{
 for(const propose of [async()=>({status:'rejected',reason:'unsupported'}),async()=>{throw Error('failure');}]){
   const result=await runExperimentV1(dependencies({methods:{propose}}));
   for(const record of result.records){assert.equal(record.decisionLocked,true);assert.equal(record.acceptanceLocked,false);assert.equal(record.accepted,false);}
 }
});
test('public prepare and all methods retain label query without imposing textbox qualification',async()=>{
 const t=task();t.publicRequest.locator={by:'form-control-label',label:'Quantity',exact:true,within:{by:'role',role:'region',name:'Editor',exact:true}};
 const seen=[];const deps=dependencies({plan:plan([t]),prepare:async request=>{assert.equal(request.locator.by,'form-control-label');assert.equal(request.locator.label,'Quantity');return {status:'ready',publicDom:{tagName:'input',id:'quantity',attributes:{role:'spinbutton'}}};}});
 const underlying=deps.methods;deps.methods={propose:async(method,input)=>{seen.push(input);return underlying.propose(method,input);}};
 const result=await runExperimentV1(deps);assert.equal(seen.length,4);for(const request of seen){assert.equal(request.locator.by,'form-control-label');assert.equal(request.locator.role,undefined);assert.equal(request.publicDom.attributes.role,'spinbutton');}
 assert.equal(result.rollups['G/FULL'].counts.E,1);
});
test('no-op annotation never refines independently supplied G eligibility or creates automatic success',async()=>{
 const t=task();t.noOp=true;t.eligibility.R='originalIneligible';
 const result=await runExperimentV1(dependencies({plan:plan([t]),methods:{propose:async()=>({status:'rejected',reason:'no-op'})},executor:()=>assert.fail()}));
 assert.equal(result.rollups['G/FULL'].counts.E,1);assert.equal(result.rollups['G/FULL'].counts.rejection,1);assert.equal(result.rollups['G/FULL'].counts.S,0);assert.equal(result.rollups['R/FULL'].counts.E,0);
});