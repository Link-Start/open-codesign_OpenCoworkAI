// Publication revision: portable checkout dependency resolution.
import {productPackageURL, productFileURL, runtimeDirectory, rootRequire} from '../publication/paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createMethodsV1,projectPublicRequest,rebuildPatch,sha256,METHODS_V1} from '../src/methods-v1.mjs';
import {createEngineV1} from '../src/methods-v1-engine.mjs';
import {runExperimentV1,pairedScopeAuditV1,PUBLIC_CHECK_KEYS_V1} from '../src/experiment-runner-v1.mjs';
import {staticGate,buildEnvelope,APP_SCRIPT_ENTRY_CONTRACT} from '../src/browser-session-r3.mjs';

// Product source/vendor bytes are read-only. No browser start, model transport, or native measurement.
const productPackage=productPackageURL();
const requireProduct=createRequire(productPackage);
const {parse}=requireProduct('@babel/parser');
const stockEngine=rootRequire()('tsx/cjs/api').require(fileURLToPath(new URL('./src/main/source-edit-engine.ts',productPackage)),fileURLToPath(productPackage));
const engine=createEngineV1({parse,stockEngine});
const runtimeDir=runtimeDirectory();
const build=source=>buildEnvelope({sourceBytes:Buffer.from(source),format:'jsx',runtimeDir,entryContract:APP_SCRIPT_ENTRY_CONTRACT});
const gate=source=>staticGate({sourceBytes:Buffer.from(source),format:'jsx',entryContract:APP_SCRIPT_ENTRY_CONTRACT});
const clean=value=>assert.doesNotMatch(JSON.stringify(value),/SECRET_/);
const unknownKey='synthetic-visual-not-measured';
function spanPatch(source,expectedText,replacement){
  const start=source.indexOf(expectedText);assert.notEqual(start,-1);
  return {start,end:start+expectedText.length,expectedText,replacement};
}
// Pins come from actual trusted compiler/runtime loading, never a fabricated native-ready manifest.
async function commonSourceCheck(original){
  assert.equal(gate(original).accepted,true);
  const baseline=await build(original);
  assert.equal(baseline.sourceSha256,sha256(original));
  assert.equal(baseline.entryContract,APP_SCRIPT_ENTRY_CONTRACT);
  assert.deepEqual(Object.keys(baseline.runtimeHashes).sort(),['react-dom.umd.js','react.umd.js']);
  assert.deepEqual(Object.keys(baseline.compilerHashes),['babel.standalone.js']);
  const observations=[];
  return {baseline,observations,async check(input){
    clean(input);
    let parsed=false,entry=false,safety=false;
    try {
      const receipt=gate(input.content);assert.equal(receipt.accepted,true);
      assert.equal(receipt.sourceSha256,sha256(input.content));
      const compiled=await build(input.content);
      assert.deepEqual(compiled.runtimeHashes,baseline.runtimeHashes);
      assert.deepEqual(compiled.compilerHashes,baseline.compilerHashes);
      assert.equal(compiled.sourceSha256,input.candidateHash);
      assert.equal(compiled.compiledSha256,sha256(compiled.compiled));
      parsed=typeof compiled.compiled==='string'&&compiled.compiled.length>0;
      entry=compiled.entryContract===baseline.entryContract&&compiled.entrySelection.entryName==='App';
      safety=rebuildPatch(input.source,input.patches)===input.content&&sha256(input.content)===input.candidateHash;
      observations.push({sourceHash:compiled.sourceSha256,compiledHash:compiled.compiledSha256,operation:input.operation});
    }catch{}
    const checks=[{key:'parse',pass:parsed},{key:'entry',pass:entry},{key:'patch-safety',pass:safety}];
    assert.deepEqual(checks.map(item=>item.key),PUBLIC_CHECK_KEYS_V1);
    return {checks};
  }};
}
const source='function App(){return <section aria-label="Cards"><span>First</span><span>Second</span><span>Third</span><span>Fourth</span></section>}';
const fragment='<section aria-label="Cards"><span>First</span><span>Second</span><span>Third</span><span>Fourth</span></section>';
const items=['First','Second','Third','Fourth'].map(text=>({by:'text',text,exact:true,within:{by:'role',role:'region',name:'Cards',exact:true}}));
const controls=[
  {name:'visualColumns can be flex not CSSgrid',operation:{kind:'set-visual-intent',intent:'visualColumns',value:'2',itemLocators:items},
    replacement:'<section aria-label="Cards" style={{display:"flex",flexWrap:"wrap",width:200}}><span style={{width:100}}>First</span><span style={{width:100}}>Second</span><span style={{width:100}}>Third</span><span style={{width:100}}>Fourth</span></section>'},
  {name:'borderBoxDistance not CSS gap',operation:{kind:'set-visual-intent',intent:'borderBoxDistance',value:24,unit:'css-px',axis:'horizontal',itemLocators:items.slice(0,2)},
    replacement:'<section aria-label="Cards" style={{display:"flex"}}><span>First</span><span style={{marginLeft:24}}>Second</span><span>Third</span><span>Fourth</span></section>'},
];
for(const control of controls)test(control.name+'; FULL retains Q, LLM span patch passes real common compile',async()=>{
  assert.doesNotMatch(source,/style=/);
  assert.doesNotMatch(control.replacement,/\bgap\b|\bgrid\b|gridTemplateColumns/);
  const common=await commonSourceCheck(source),patch=spanPatch(source,fragment,control.replacement);
  const expectedContent=rebuildPatch(source,[patch]);
  let transportCalls=0,prepares=0,executions=0,evaluations=0;
  const seenProposals=[];
  const methods=createMethodsV1({engine:{candidate:()=>assert.fail('visual candidate extraction forbidden'),fallback:()=>assert.fail('visual fallback forbidden'),guard:()=>assert.fail('visual guard forbidden')},oneshot:async payload=>{
    transportCalls++;clean(payload);assert.equal(payload.request.provenance,undefined);
    assert.deepEqual(payload.request.operation,control.operation);
    return {proposal:{patches:[{...patch,expected:'SECRET_PROPOSAL_PATCH'}],baseline:'SECRET_PROPOSAL'},usage:{inputTokens:1,outputTokens:1,oracle:'SECRET_USAGE'}};
  }});
  const task={sourceId:'handwritten-public-visual-control',taskId:control.operation.intent,originalSource:source,
    publicRequest:{userGoal:control.name,scope:'source-definition',locator:{by:'role',role:'region',name:'Cards',exact:true},
      operation:{...control.operation,expected:'SECRET_OPERATION',itemLocators:control.operation.itemLocators.map(item=>({...item,baseline:'SECRET_ITEM',within:{...item.within,sourceRange:'SECRET_RANGE'}}))},oracle:'SECRET_PUBLIC_EXTRA'},
    eligibility:{R:'eligible',G:'eligible'},expectedKeys:{R:[unknownKey],G:[unknownKey]},baseline:{secret:'SECRET_BASELINE'},evaluationPlan:{expected:'SECRET_EXPECTED'}};
  const report=await runExperimentV1({plan:{datasetId:'public-compile-only-visual',datasetKind:'dev',tasks:[task]},
    methods:{async propose(method,input){clean(input);const proposal=await methods.propose(method,input);clean(proposal);seenProposals.push({method,proposal});return proposal;}},
    prepare(input){prepares++;clean(input);assert.deepEqual(input.operation,control.operation);
      // Hand-authored preparation is explicitly synthetic, NOT a native AX/provenance receipt.
      return {status:'ready',publicDom:{tagName:'section',attributes:{'aria-label':'Cards'},sourceId:'SECRET_DOM'},mapping:'SECRET_MAPPING',baseline:'SECRET_PREPARE'};
    },publicCheck:input=>common.check(input),
    executor(candidate){executions++;assert.equal(candidate.accepted,true);assert.equal(candidate.content,expectedContent);assert.equal(rebuildPatch(candidate.originalSource,candidate.patches),candidate.content);return {kind:'synthetic-control-no-browser',rendered:false};},
    evaluator({execution}){evaluations++;assert.equal(execution.rendered,false);return {R:[{key:unknownKey,status:'unknown'}],G:[{key:unknownKey,status:'unknown'}]};},
  });
  assert.equal(prepares,1);assert.equal(transportCalls,1);assert.equal(executions,1);assert.equal(evaluations,1);
  assert.equal(report.records.length,4);assert.equal(common.observations.length,1);
  assert.equal(common.observations[0].sourceHash,sha256(expectedContent));
  assert.deepEqual(common.observations[0].operation,control.operation);
  for(const method of METHODS_V1){
    const row=report.records.find(item=>item.method===method);
    assert.equal(row.preparation,'ready');assert.equal(row.methodError,null);assert.equal(row.publicProtocolFailure,null);
    for(const endpoint of ['R','G']){
      const c=report.rollups[`${endpoint}/${method}`].counts;
      assert.equal(c.P,1);assert.equal(c.E,1);assert.equal(c.Q,1);assert.equal(c.preparationFailure,0);
      assert.equal(c.publicProtocolRejection,0);assert.equal(c.methodRejection,method==='LLM_ONESHOT'?0:1);
    }
    if(method==='LLM_ONESHOT'){
      assert.equal(row.accepted,true);assert.equal(row.acceptanceLocked,true);assert.equal(row.candidateHash,sha256(expectedContent));
      assert.deepEqual(row.publicChecks,PUBLIC_CHECK_KEYS_V1.map(key=>({key,pass:true})));
      for(const endpoint of ['R','G'])assert.equal(row.evaluation[endpoint].outcome,'U_A');
    }else{
      assert.equal(row.accepted,false);assert.equal(row.rejection,'UNSUPPORTED_VISUAL_INTENT');assert.equal(row.candidateHash,null);assert.equal(row.guard,null);assert.equal(row.patches,null);
      assert.equal(seenProposals.find(item=>item.method===method).proposal.candidate,null);
    }
  }
  assert.equal(pairedScopeAuditV1(report.records)[0].classification,'not-scope-opportunity');
  assert.equal(report.formalReady,false);assert.equal(report.integrationStatus,'dependency-injected-controls-only');clean(report);
});

test('real engine FULL/OFF same candidate unaffected; all methods share real compile checks',async()=>{
  for(const mapped of [false,true]){
    const original=mapped?'function App(){return <main>{[1,2].map(x=><span>Old</span>)}</main>}':'function App(){return <main><span>Old</span></main>}';
    const common=await commonSourceCheck(original),start=original.indexOf('<span>Old</span>');
    const input={source:original,userGoal:'Change source definition text',scope:'source-definition',operation:{kind:'set-text',value:'New'},locator:{by:'text',text:'Old',exact:true},publicDom:{tagName:'span',text:'Old'},provenance:{sourceHash:sha256(original),targetId:`${start}:${start+16}`}};
    let candidateCalls=0;const supplied=spanPatch(original,'Old','New');
    const methods=createMethodsV1({engine:{...engine,candidate(request){candidateCalls++;return engine.candidate(request);}},oneshot:async()=>({proposal:{patches:[supplied]}})});
    const full=await methods.propose('FULL',input),off=await methods.propose('SCOPE_OFF',input);
    assert.equal(candidateCalls,1);assert.equal(full.candidate,off.candidate);assert.equal(full.candidate.candidateHash,off.candidate.candidateHash);
    assert.equal(full.status,mapped?'rejected':'proposed');assert.equal(off.status,'proposed');
    if(mapped)assert.equal(full.reason,'scope-unsupported');
    for(const method of METHODS_V1){
      const proposal=await methods.propose(method,input);
      if(proposal.status!=='proposed')continue;
      const receipt=await common.check({...projectPublicRequest(input),...proposal.candidate});
      assert.deepEqual(receipt.checks,PUBLIC_CHECK_KEYS_V1.map(key=>({key,pass:true})));
    }
    assert.equal(common.observations.length,mapped?2:4);
  }
});

test('common source checker rejects unsafe source, invalid JSX, invalid ABI, and mismatched patch',async()=>{
  const original='function App(){return <span>Old</span>}',common=await commonSourceCheck(original);
  for(const replacement of ['function App(){fetch("/offline");return <span>New</span>}','function App(){return <span>}','function NotApp(){return <span>New</span>}']){
    const patch=spanPatch(original,original,replacement);
    const receipt=await common.check({source:original,content:replacement,patches:[patch],candidateHash:sha256(replacement)});
    assert.ok(receipt.checks.some(check=>!check.pass));
  }
  const patch=spanPatch(original,'Old','New'),content=rebuildPatch(original,[patch]);
  const receipt=await common.check({source:original,content,patches:[{...patch,expectedText:'wrong'}],candidateHash:sha256(content)});
  assert.equal(receipt.checks.find(check=>check.key==='patch-safety').pass,false);
});
