// Publication revision: portable checkout dependency resolution.
import {productPackageURL, productFileURL, runtimeDirectory, rootRequire} from '../publication/paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeValueEvidence,snapshotIndex,browserVersionKey,CALIBRATION_POLICY_SCHEMA,staticGate,buildEnvelope,browserArguments,start,collectionValueState,collectionErrorRecord,sha256,verifyCalibrationPolicy,clonePublicLocator,ENTRY_CONTRACT,APP_SCRIPT_ENTRY_CONTRACT,HTML_ENTRY_CONTRACT} from '../src/browser-session-r2.mjs';
import {measureUntilDeadline} from '../src/measurement-r2.mjs';
// Explicit historical imports: read-only helper baseline, never private data/generated failures.
import {staticGate as r1Gate,buildEnvelope as r1Envelope,browserArguments as r1Arguments} from './legacy/browser-session-r1.mjs';
const version={protocolVersion:'1.3',product:'Chrome/1.2.3.4',revision:'abc',userAgent:'test',jsVersion:'1.0'};
const missing=()=>({fieldPresent:true,entryPresent:false,stringIndex:null,value:null});
const present=value=>({fieldPresent:true,entryPresent:true,stringIndex:0,value});
function input(overrides={}){return{element:{tagName:'input',attributes:{type:'text',value:'STATIC-NOT-LIVE'},visible:true},snapshotEntry:{hasLayout:true,valueChannels:{textValue:missing(),inputValue:missing()}},axNode:{ignored:false,role:{value:'textbox'}},browserVersion:version,...overrides}}
const sentinel=()=>({fieldPresent:true,entryPresent:true,stringIndex:-1,value:undefined});
const emptySnapshot=()=>({hasLayout:true,valueChannels:{textValue:missing(),inputValue:sentinel()}});
const policyBody={schema:CALIBRATION_POLICY_SCHEMA,browserVersion:version,observerSha256:'a'.repeat(64),runnerSha256:'b'.repeat(64),entryHelperSha256:'e'.repeat(64),runtimeHashes:{'react.umd.js':'c'.repeat(64),'react-dom.umd.js':'f'.repeat(64)},fixtureHashes:{html:'d'.repeat(64)},rules:[{browserVersionKey:browserVersionKey(version),type:'input:text',validated:true,emptyMeansEmpty:true,emptyEncoding:{textValue:'entry-absent',inputValue:'string-index-minus-one',axValue:'absent'},ruleId:'test-text',emptyWitnessCount:4,nonemptyWitnessCount:4}]};
const policy={...policyBody,policyId:'r2-sparse-'+sha256(JSON.stringify(policyBody))};
const decode=(overrides={})=>decodeValueEvidence(input(overrides));
test('uncalibrated sparse omission is unavailable, never attribute fallback',()=>{const d=decode();assert.equal(d.valueState,'unavailable');assert.equal(d.value,null);assert.equal(d.rawPresence.axValue.entryPresent,false);assert.equal(d.valueError,'VALUE_UNAVAILABLE_UNCALIBRATED_OMISSION')});
test('exact calibrated browser/type/visible/AX-backed minus-one sentinel permits empty',()=>{const d=decode({calibrationPolicy:policy,snapshotEntry:emptySnapshot()});assert.equal(d.valueState,'available');assert.equal(d.value,'');assert.deepEqual(d.source,['calibrated-DOMSnapshot-AX-empty-encoding']);assert.equal(d.calibrationPolicyId,policy.policyId)});
test('version drift, type drift, missing node, missing field, absent AX, ignored and hidden fail closed',()=>{
 const variants=[{browserVersion:{...version,product:'Chrome/1.2.3.5'}},{browserVersion:{...version,revision:'def'}},{element:{tagName:'textarea',attributes:{},visible:true}},{snapshotEntry:null},{snapshotEntry:{hasLayout:true,valueChannels:{}}},{axNode:undefined},{axNode:{ignored:true}},{element:{tagName:'input',attributes:{type:'text'},visible:false}},{snapshotEntry:{hasLayout:false,valueChannels:{textValue:missing(),inputValue:missing()}}}];
 for(const variant of variants){const d=decode({calibrationPolicy:policy,snapshotEntry:emptySnapshot(),...variant});assert.equal(d.valueState,'unavailable',JSON.stringify(variant));assert.equal(d.value,null)}
});
test('explicit native snapshot values preserve zero, whitespace and newline without normalization',()=>{
 for(const value of ['','0','seed',' ','line1\nline2\n']){const d=decode({snapshotEntry:{hasLayout:true,valueChannels:{textValue:missing(),inputValue:present(value)}}});assert.equal(d.valueState,'available');assert.equal(d.value,value);assert.deepEqual(d.source,['DOMSnapshot.inputValue'])}
});
test('AX explicit values have presence semantics and do not stringify malformed missing value',()=>{
 assert.equal(decode({axNode:{ignored:false,value:{type:'string',value:''}}}).value,'');
 assert.equal(decode({axNode:{ignored:false,value:{type:'number',value:0}}}).value,'0');
 assert.equal(decode({axNode:{ignored:false,value:{type:'string'}}}).valueState,'unavailable');
});
test('all conflicting present channels are unknown: snapshot versus AX and snapshot versus snapshot',()=>{
 let d=decode({snapshotEntry:{hasLayout:true,valueChannels:{inputValue:present('seed'),textValue:missing()}},axNode:{ignored:false,value:{type:'string',value:''}},calibrationPolicy:policy});assert.equal(d.valueState,'unavailable');assert.equal(d.valueError,'VALUE_CHANNEL_CONFLICT');assert.equal(d.value,null);
 d=decode({snapshotEntry:{hasLayout:true,valueChannels:{inputValue:present('seed'),textValue:present('other')}}});assert.equal(d.valueState,'unavailable');assert.equal(d.valueError,'VALUE_CHANNEL_CONFLICT');
});
test('unsupported types and elements never treat textContent/value attribute as live value',()=>{
 for(const element of [{tagName:'input',attributes:{type:'checkbox',value:''},visible:true},{tagName:'div',attributes:{value:''},text:'',visible:true},{tagName:'select',attributes:{},visible:true}])assert.equal(decode({element,calibrationPolicy:policy}).valueState,'unsupported');
});
test('snapshotIndex preserves separate sparse presence including missing field and absent node',()=>{
 const snapshot={strings:['#document','INPUT','seed'],documents:[{nodes:{backendNodeId:[1,2],nodeName:[0,1],nodeType:[9,1],parentIndex:[-1,0],inputValue:{index:[1],value:[2]},textValue:{index:[],value:[]}},layout:{nodeIndex:[1],styles:[[]],text:[-1]}}]};
 const index=snapshotIndex(snapshot);assert.equal(index.get(2).valueChannels.inputValue.entryPresent,true);assert.equal(index.get(2).valueChannels.inputValue.value,'seed');assert.equal(index.get(2).valueChannels.textValue.entryPresent,false);assert.equal(index.has(3),false);
 delete snapshot.documents[0].nodes.textValue;assert.equal(snapshotIndex(snapshot).get(2).valueChannels.textValue.fieldPresent,false);
});
test('r2 preserves historical legacy envelope/containment while binding gate ABI explicitly',async()=>{
 const runtimeDir=runtimeDirectory();
 assert.deepEqual(browserArguments('dedicated-profile'),r1Arguments('dedicated-profile'));
 for(const format of ['html','jsx']){const entryContract=format==='jsx'?ENTRY_CONTRACT:HTML_ENTRY_CONTRACT,sourceBytes=await readFile(new URL('../fixtures/handwritten/'+(format==='jsx'?'value-matrix-legacy.jsx':'value-matrix.html'),import.meta.url));const gate=staticGate({sourceBytes,format,entryContract}),old=r1Gate({sourceBytes,format});assert.equal(gate.accepted,true);assert.deepEqual(gate.reasons,old.reasons);assert.equal(gate.sourceSha256,old.sourceSha256);assert.equal(gate.entryContract,entryContract);assert.deepEqual(await buildEnvelope({sourceBytes,format,runtimeDir,entryContract}),await r1Envelope({sourceBytes,format,runtimeDir}))}
 const sourceBytes=Buffer.from('export default function Thrower(){throw new Error("MUST_NOT_EXECUTE_NODE")}');await buildEnvelope({sourceBytes,format:'jsx',runtimeDir,entryContract:ENTRY_CONTRACT});
});
test('restricted sessions require authorization; source has no arbitrary Runtime.evaluate path',async()=>{
 await assert.rejects(start({trustLevel:'restricted-generated'}),/RESTRICTED_GENERATED_NOT_AUTHORIZED/);
 const source=await readFile(new URL('../src/browser-session-r2.mjs',import.meta.url),'utf8');assert.equal(source.includes("command('Runtime.evaluate'"),false);assert.match(source,/TRUSTED_FIXTURE_WITNESS_ONLY/);assert.match(source,/FIXTURE_BYTES_MISMATCH/);assert.match(source,/trustedFixturePaths/);
});

test('observed minus-one sentinel is not arbitrary omission: exact channel only',()=>{
 assert.equal(decode({snapshotEntry:emptySnapshot()}).valueError,'VALUE_UNAVAILABLE_UNCALIBRATED_SENTINEL');
 assert.equal(decode({calibrationPolicy:policy}).valueState,'unavailable');
 assert.equal(decode({calibrationPolicy:policy,snapshotEntry:{hasLayout:true,valueChannels:{textValue:sentinel(),inputValue:missing()}}}).valueState,'unavailable');
 assert.equal(decode({calibrationPolicy:policy,snapshotEntry:emptySnapshot(),axNode:{ignored:false,value:{type:'string',value:'seed'}}}).valueError,'VALUE_CHANNEL_CONFLICT');
 assert.equal(decode({calibrationPolicy:policy,snapshotEntry:emptySnapshot(),axNode:{ignored:false,value:{type:'string',value:''}}}).valueError,'VALUE_CHANNEL_CONFLICT');
});
test('collector uses typed available state and preserves all native evidence',()=>{
 const decoded=decode({calibrationPolicy:policy,snapshotEntry:emptySnapshot()});
 const state=collectionValueState(decoded);assert.equal(state.status,'available');assert.deepEqual(state.rawPresence,decoded.rawPresence);assert.deepEqual(state.source,decoded.source);assert.equal(state.browserVersion,decoded.browserVersion);assert.equal(state.calibrationPolicyId,policy.policyId);assert.equal(state.error,null);
 const unavailable=collectionValueState(decode());assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.error.code,'VALUE_UNAVAILABLE_UNCALIBRATED_OMISSION');
});
test('collector error records preserve stable fatal codes and reject arbitrary codes',()=>{
 for(const code of ['SESSION_CLOSED','NO_RENDER','CONTAINMENT_CONTROL_FAILED','SNAPSHOT_NODE_LIMIT','CDP_CLOSED','CDP_SOCKET_ERROR','PAGE_RUNTIME_ERROR']){
  assert.deepEqual(collectionErrorRecord({code,message:'detail'}),{code,message:'detail'});
  assert.equal(collectionErrorRecord(new Error(code+': detail')).code,code);
 }
 assert.equal(collectionErrorRecord({code:'ARBITRARY',message:'detail'}).code,'COLLECTION_ERROR');
 assert.equal(collectionErrorRecord({code:'VALUE_TARGET_NOT_FOUND',message:'absent'}).code,'VALUE_TARGET_NOT_FOUND');
});
test('typed decoder evidence interoperates with actual measurement-r2 without weakening its guard',async()=>{
 for(const value of ['', 'seed']){
  const d=value===''?decode({calibrationPolicy:policy,snapshotEntry:emptySnapshot()}):decode({snapshotEntry:{hasLayout:true,valueChannels:{textValue:missing(),inputValue:present(value)}}});
  const m=await measureUntilDeadline({collect:async()=>({state:'ok',actual:d.value,evidence:{valueState:collectionValueState(d)}}),expect:{cmp:'eq',value},policy:{pollIntervalMs:0}});
  assert.equal(m.outcome,'observed-satisfied');assert.equal(m.coverage.validSamples,3);assert.equal(m.samples.every(s=>s.evidence.valueState.status==='available'),true);
 }
});
test('structured collector fatal errors survive measurement normalization',async()=>{
 for(const code of ['SESSION_CLOSED','CONTAINMENT_CONTROL_FAILED','CDP_CLOSED']){
  const m=await measureUntilDeadline({collect:async()=>({state:'error',error:collectionErrorRecord({code,message:'fatal control'})}),expect:{cmp:'eq',value:''},abort:async()=>{}});
  assert.equal(m.termination.reason,'fatal-collection-error');assert.equal(m.health.terminalError.code,code);assert.equal(m.health.sessionUsable,false);assert.equal(m.samples.length,1);
 }
});
test('calibration policy checks digest, freezes deep copies, and forbids double omission even when rehashed',()=>{
 const frozen=verifyCalibrationPolicy(policy);assert.notEqual(frozen,policy);assert.ok(Object.isFrozen(frozen.rules[0].emptyEncoding));assert.throws(()=>{frozen.rules[0].validated=false},TypeError);
 assert.throws(()=>verifyCalibrationPolicy({...policy,observerSha256:'e'.repeat(64)}),/DIGEST_MISMATCH/);
 const forged=structuredClone(policyBody);forged.rules[0].emptyEncoding.inputValue='entry-absent';const rehashed={...forged,policyId:'r2-sparse-'+sha256(JSON.stringify(forged))};assert.throws(()=>verifyCalibrationPolicy(rehashed),/RULE_INVALID/);
 assert.equal(decode({calibrationPolicy:rehashed,snapshotEntry:emptySnapshot()}).valueState,'unavailable');
});
test('public locator recursive allowlist clones and never admits expectations or selector injection',()=>{
 const original={by:'role',role:'textbox',name:'Name',within:{by:'role',role:'group',name:'Context'}};const clone=clonePublicLocator(original);original.within.name='Mutated';assert.equal(clone.within.name,'Context');assert.ok(Object.isFrozen(clone.within));
 for(const locator of [{...original,expected:''},{...original,within:{...original.within,expect:{cmp:'eq',value:''}}},{by:'role',role:'textbox',selector:'input'},{by:'role',role:'textbox',exact:'true'}])assert.throws(()=>clonePublicLocator(locator),/INVALID_LOCATOR/);
});
test('formal hidden/non-AX values are ineligible even when raw native nonempty is readable; number is unsupported',()=>{
 const nonempty={hasLayout:true,valueChannels:{textValue:missing(),inputValue:present('seed')}};
 for(const changes of [{element:{tagName:'input',attributes:{type:'text'},visible:false}},{axNode:undefined},{axNode:{ignored:true}}]){const d=decode({snapshotEntry:nonempty,...changes});assert.equal(d.valueState,'unavailable');assert.equal(d.valueError,'VALUE_TARGET_INELIGIBLE')}
 for(const value of ['','0'])assert.equal(decode({element:{tagName:'input',attributes:{type:'number'},visible:true},snapshotEntry:{hasLayout:true,valueChannels:{inputValue:present(value),textValue:missing()}}}).valueState,'unsupported');
});
test('formal App-script ABI is explicit, compiles source only, rejects invalid entries without fallback',async()=>{
 const runtimeDir=runtimeDirectory();
 const sourceBytes=Buffer.from('function App(){throw new Error("MUST_NOT_EXECUTE_NODE");return <input/>}');
 assert.equal(staticGate({sourceBytes,format:'jsx'}).accepted,false);assert.equal(staticGate({sourceBytes,format:'jsx',entryContract:APP_SCRIPT_ENTRY_CONTRACT}).accepted,true);assert.equal(staticGate({sourceBytes,format:'jsx',entryContract:ENTRY_CONTRACT}).accepted,false);
 const envelope=await buildEnvelope({sourceBytes,format:'jsx',runtimeDir,entryContract:APP_SCRIPT_ENTRY_CONTRACT});assert.equal(envelope.sourceSha256,sha256(sourceBytes));assert.equal(envelope.entrySelection.entryName,'App');assert.match(envelope.document,/sandbox="allow-scripts"/);assert.match(envelope.compiled,/MUST_NOT_EXECUTE_NODE/);
 for(const source of ['export default function App(){return null}','function Other(){return null}','function App(){return null};ReactDOM.createRoot(x)'])await assert.rejects(buildEnvelope({sourceBytes:Buffer.from(source),format:'jsx',runtimeDir,entryContract:APP_SCRIPT_ENTRY_CONTRACT}),/APP_SCRIPT_/);
 const both=await buildEnvelope({sourceBytes:Buffer.from('function _App(){return null} function App(){return null}'),format:'jsx',runtimeDir,entryContract:APP_SCRIPT_ENTRY_CONTRACT});assert.equal(both.entrySelection.entryName,'App');assert.equal(both.entrySelection.selectionRule,'App-before-_App');
 await assert.rejects(buildEnvelope({sourceBytes,format:'jsx',runtimeDir}),/EXPLICIT_JSX_ENTRY_CONTRACT_REQUIRED/);
});