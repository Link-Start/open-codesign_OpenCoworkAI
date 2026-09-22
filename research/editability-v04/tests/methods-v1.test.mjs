import test from 'node:test';
import assert from 'node:assert/strict';
import {createMethodsV1,projectPublicRequest,sha256,rebuildPatch} from '../src/methods-v1.mjs';
const source='function App(){return <p>old</p>}';
const request=()=>({source,sourceHash:sha256(source),userGoal:'Change displayed text',scope:'source-definition',locator:{tagName:'p',text:'old'},operation:{kind:'set-text',value:'new'},provenance:{sourceHash:sha256(source),targetId:'22:32'}});
const candidate=()=>{const start=source.indexOf('old'),patches=[{start,end:start+3,expectedText:'old',replacement:'new'}],content=rebuildPatch(source,patches);return {status:'candidate',patches,content,sourceHash:sha256(content),candidateHash:sha256(content)};};
test('FULL and SCOPE_OFF consume exact same candidate, not alternate policy',async()=>{
 let calls=0;const methods=createMethodsV1({engine:{candidate:()=>{calls++;return candidate();},guard:()=>({pass:false,reason:'scope-unsupported'}),fallback:()=>candidate()}});
 const full=await methods.propose('FULL',request()),off=await methods.propose('SCOPE_OFF',request());
 assert.equal(calls,1);assert.equal(full.status,'rejected');assert.equal(off.status,'proposed');assert.equal(full.candidate,off.candidate);assert.equal(full.candidate.candidateHash,off.candidate.candidateHash);
});
test('mapping failure has no pre-guard candidate for either paired method',async()=>{
 const methods=createMethodsV1({engine:{candidate:()=>({status:'rejected',reason:'mapping-unavailable'}),guard:()=>assert.fail(),fallback:()=>assert.fail()}});
 for(const method of ['FULL','SCOPE_OFF']){const result=await methods.propose(method,request());assert.equal(result.candidate,null);assert.equal(result.guard,null);}
});
test('provenance-off receives no mapping or private sentinel at any nesting level',async()=>{
 const input=request();input.expected='SECRET_EXPECTED';input.provenance.extra='SECRET_MAP';input.locator.sourceRange='SECRET_RANGE';input.locator.baseline='SECRET_BASELINE';input.operation.oracle='SECRET_ORACLE';
 let seen;const methods=createMethodsV1({engine:{candidate:()=>assert.fail(),fallback:r=>{seen=r;return candidate();},guard:r=>{assert.equal(r.provenance,undefined);return {pass:true};}}});
 await methods.propose('PROVENANCE_OFF',input);assert.equal(seen.provenance,undefined);assert.doesNotMatch(JSON.stringify(seen),/SECRET/);assert.deepEqual(seen.locator,{tagName:'p',text:'old'});
});
test('oneshot one call and one raw JSON parse, malformed response never repaired',async()=>{
 let calls=0;const methods=createMethodsV1({engine:{candidate:()=>assert.fail(),fallback:()=>assert.fail(),guard:()=>assert.fail()},oneshot:async payload=>{calls++;assert.equal(payload.request.provenance,undefined);assert.doesNotMatch(JSON.stringify(payload),/SECRET/);return {proposal:'```json\n{}\n```'};}});
 const result=await methods.propose('LLM_ONESHOT',{...request(),baseline:'SECRET'});assert.equal(calls,1);assert.equal(result.status,'public-protocol-rejection');assert.equal(result.apiAttempts,1);
});
test('oneshot valid patch is reconstructed and provider error has no secret echo',async()=>{
 const engine={candidate:()=>assert.fail(),fallback:()=>assert.fail(),guard:()=>assert.fail()};
 const good=createMethodsV1({engine,oneshot:async()=>({proposal:JSON.stringify({patches:candidate().patches}),usage:{inputTokens:7,outputTokens:3,secret:'SECRET'}})});
 const result=await good.propose('LLM_ONESHOT',request());assert.equal(result.candidate.candidateHash,sha256(result.candidate.content));assert.equal(result.usage.inputTokens,7);
 const bad=createMethodsV1({engine,oneshot:async()=>{throw new Error('SECRET_KEY');}});assert.doesNotMatch(JSON.stringify(await bad.propose('LLM_ONESHOT',request())),/SECRET/);
});
test('patch offsets sorted and bound to original expected bytes',()=>{
 assert.throws(()=>rebuildPatch(source,[{start:0,end:2,expectedText:'xx',replacement:''}]),/INVALID_PATCH/);
 assert.throws(()=>rebuildPatch(source,[{start:3,end:5,expectedText:'ct',replacement:''},{start:0,end:1,expectedText:'f',replacement:''}]),/INVALID_PATCH/);
 assert.equal(rebuildPatch(source,candidate().patches),candidate().content);
});
test('projection validates source hash and preserves original raw source',()=>{
 assert.equal(projectPublicRequest(request()).source,source);assert.throws(()=>projectPublicRequest({...request(),sourceHash:'bad'}),/SOURCE_HASH/);
});

test('AX within recursion and DOM fact projection remove hidden mapping in every method',async()=>{
 const base=request();base.locator={by:'role',role:'button',name:'Save',exact:true,within:{by:'role',role:'region',name:'Editor',exact:true,sourceId:'SECRET_WITHIN'}};
 base.publicDom={tagName:'button',text:'old',id:'save',outerHTML:'SECRET_HTML',sourceMap:'SECRET_MAP',attributes:{title:'Save','data-codesign-id':'SECRET_MARKER','data-source-line':'SECRET_LINE',nested:{secret:'SECRET_NESTED'}}};
 const projected=projectPublicRequest(base);assert.equal(projected.locator.within.name,'Editor');assert.doesNotMatch(JSON.stringify(projected),/SECRET/);
 const seen=[];const engine={candidate:r=>{seen.push(r);return candidate();},fallback:r=>{seen.push(r);return candidate();},guard:()=>({pass:true})};
 const methods=createMethodsV1({engine,oneshot:async payload=>{seen.push(payload.request);return {proposal:{patches:candidate().patches}};}});
 for(const method of ['FULL','SCOPE_OFF','PROVENANCE_OFF','LLM_ONESHOT'])await methods.propose(method,base);
 assert.doesNotMatch(JSON.stringify(seen),/SECRET/);assert.equal(seen[0].locator.tagName,'button');assert.equal(seen.at(-1).locator.by,'role');assert.deepEqual(seen[0].publicDom,seen.at(-1).publicDom);
});
test('form-control label semantics survive all four methods without textbox role or input-type gate',async()=>{
 const input=request();input.locator={by:'form-control-label',label:'Quantity',exact:true,role:'textbox',expected:'SECRET_EXPECTED',within:{by:'role',role:'region',name:'Editor',exact:true,baseline:'SECRET_BASELINE'}};
 input.publicDom={tagName:'input',id:'quantity',attributes:{role:'spinbutton'},outerHTML:'SECRET_MARKER_HTML'};
 const seen=[];const engine={candidate:r=>{seen.push(r);return candidate();},fallback:r=>{seen.push(r);return candidate();},guard:r=>{seen.push(r);return {pass:true};}};
 const methods=createMethodsV1({engine,oneshot:async({request:r})=>{seen.push(r);return {proposal:{patches:candidate().patches}};}});
 for(const method of ['FULL','SCOPE_OFF','PROVENANCE_OFF','LLM_ONESHOT'])await methods.propose(method,input);
 for(const value of seen){const semantic=value.semanticLocator??value.locator;assert.equal(semantic.by,'form-control-label');assert.equal(semantic.label,'Quantity');assert.equal(semantic.role,undefined);assert.equal(semantic.within.name,'Editor');assert.equal(value.publicDom.attributes.role,'spinbutton');}
 assert.doesNotMatch(JSON.stringify(seen),/SECRET/);
 const projected=projectPublicRequest(input);assert.equal(projected.locator.role,undefined);
});
test('unresolved abstract kind/query-ref is not silently downgraded to a legacy source locator',()=>{
 for(const locator of [{kind:'form-control-label',label:'Quantity',tagName:'input'},{by:'query-ref',ref:'control',tagName:'input'}])assert.throws(()=>projectPublicRequest({...request(),locator}),/UNRESOLVED_OR_UNSUPPORTED_PUBLIC_QUERY/);
});
test('visual intent projection preserves exact semantic fields and strips nested private sentinels',()=>{
  for(const [intent,value] of [['borderBoxDistance','24.0'],['borderBoxDistance',-2.5],['visualColumns',3],['visualColumns','3']]) {
    const item={by:'role',role:'article',name:'Card',exact:true,sourceRange:'SECRET_RANGE',within:{by:'role',role:'region',name:'Cards',exact:true,expected:'SECRET_WITHIN'}};
    const operation={kind:'set-visual-intent',intent,value,unit:'css-px',axis:'horizontal',itemLocators:[item],property:'SECRET_CSS',expected:'SECRET_EXPECTED',baseline:'SECRET_BASELINE'};
    const projected=projectPublicRequest({...request(),operation,evaluationPlan:{oracle:'SECRET_ORACLE'}});
    assert.deepEqual(projected.operation,{kind:'set-visual-intent',intent,value,unit:'css-px',axis:'horizontal',itemLocators:[{by:'role',role:'article',name:'Card',exact:true,within:{by:'role',role:'region',name:'Cards',exact:true}}]});
    assert.equal(typeof projected.operation.value,typeof value);assert.doesNotMatch(JSON.stringify(projected),/SECRET/);
    assert.ok(Object.isFrozen(projected.operation.itemLocators[0].within));assert.ok(Object.isFrozen(projected.operation.itemLocators));
    assert.equal(item.sourceRange,'SECRET_RANGE');
  }
  const minimal={kind:'set-visual-intent',intent:'visualColumns',value:2};
  assert.deepEqual(projectPublicRequest({...request(),operation:minimal}).operation,minimal);
});
test('visual malformed values and CSS aliases remain public protocol errors',()=>{
  const base={kind:'set-visual-intent',intent:'borderBoxDistance',value:16};
  const invalid=[{intent:'gap'},{intent:'gridTemplateColumns'},{intent:'other'},... [null,undefined,NaN,Infinity,-Infinity,{},[],true].map(value=>({value})),{unit:'px'},{unit:null},{axis:'inline'},{axis:null},{itemLocators:{}},{itemLocators:Array(1)},{itemLocators:[{tagName:'article'}]},{itemLocators:[{by:'query-ref',ref:'card'}]},{itemLocators:[{by:'role',role:'article',exact:false}]},{itemLocators:[{by:'role',role:'article',exact:true,within:{tagName:'section'}}]}];
  for(const extra of invalid)assert.throws(()=>projectPublicRequest({...request(),operation:{...base,...extra}}),/INVALID_|UNRESOLVED_OR_UNSUPPORTED/);
  assert.throws(()=>projectPublicRequest({...request(),operation:{kind:'set-other',value:'x'}}),/INVALID_OPERATION/);
  // Normal text/style/attribute types are unchanged, not generalized to numeric values.
  assert.throws(()=>projectPublicRequest({...request(),operation:{kind:'set-style',property:'width',value:16}}),/INVALID_VALUE/);
});
test('unsupported visual methods reject after valid projection without candidate fallback or guard',async()=>{
  const engine={candidate:()=>assert.fail('candidate must not run'),fallback:()=>assert.fail('fallback must not run'),guard:()=>assert.fail('guard must not run')};
  const methods=createMethodsV1({engine});
  for(const intent of ['borderBoxDistance','visualColumns'])for(const method of ['FULL','SCOPE_OFF','PROVENANCE_OFF']) {
    const input={...request(),operation:{kind:'set-visual-intent',intent,value:2}};
    delete input.provenance;
    assert.deepEqual(await methods.propose(method,input),{status:'rejected',reason:'UNSUPPORTED_VISUAL_INTENT',candidate:null,guard:null,apiAttempts:0});
  }
});
test('visual oneshot sees full public semantics and arbitrary span patch without private request or proposal fields',async()=>{
  const operation={kind:'set-visual-intent',intent:'visualColumns',value:'2',itemLocators:[{by:'text',text:'old',exact:true,baseline:'SECRET_ITEM'}]};
  let calls=0;
  const methods=createMethodsV1({engine:{candidate:()=>assert.fail(),fallback:()=>assert.fail(),guard:()=>assert.fail()},oneshot:async payload=>{
    calls++;assert.deepEqual(payload.request.operation,{kind:operation.kind,intent:operation.intent,value:'2',itemLocators:[{by:'text',text:'old',exact:true}]});
    assert.equal(payload.request.provenance,undefined);assert.doesNotMatch(JSON.stringify(payload),/SECRET/);
    return {proposal:{patches:candidate().patches.map(p=>({...p,oracle:'SECRET_PATCH'})),privateNotes:'SECRET_PROPOSAL'},usage:{inputTokens:1,outputTokens:2,private:'SECRET_USAGE'}};
  }});
  const result=await methods.propose('LLM_ONESHOT',{...request(),operation,expected:'SECRET_EXPECTED',baseline:'SECRET_BASELINE'});
  assert.equal(result.status,'proposed');assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(result),/SECRET/);
  assert.deepEqual(result.candidate.patches,candidate().patches);
});
test('normal set-style public projection and oneshot are not restricted to MVP7 properties',async()=>{
  const engine={candidate:()=>assert.fail(),fallback:()=>assert.fail(),guard:()=>assert.fail()};
  for(const property of ['marginInlineStart','display','gridTemplateColumns','gap','--public-card-width']) {
    const operation={kind:'set-style',property,value:'24px'};
    assert.deepEqual(projectPublicRequest({...request(),operation}).operation,operation);
    const methods=createMethodsV1({engine,oneshot:async({request:r})=>{assert.deepEqual(r.operation,operation);return {proposal:{patches:candidate().patches}};}});
    assert.equal((await methods.propose('LLM_ONESHOT',{...request(),operation})).status,'proposed');
  }
});
