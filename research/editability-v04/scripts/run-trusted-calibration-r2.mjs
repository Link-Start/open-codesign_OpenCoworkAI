// Public handwritten controls only. No private tests, generated programs, model, or network.
import {publicationCLI,blockPublicationNativeExecution} from './publication-safety.mjs';
publicationCLI(import.meta.url);
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Retained legacy calibration body; publication execution is unconditionally blocked.
async function runTrustedCalibration(){
blockPublicationNativeExecution();
const {researchRoot,runtimeDirectory}=await import('../publication/paths.mjs');
const {start,staticGate,sha256,browserVersionKey,CALIBRATION_POLICY_SCHEMA,OBSERVER_REVISION,channelEncoding,APP_SCRIPT_ENTRY_CONTRACT,HTML_ENTRY_CONTRACT,ENTRY_CONTRACT}=await import('../src/browser-session-r2.mjs');
const {measureUntilDeadline,DEFAULT_MEASUREMENT_POLICY}=await import('../src/measurement-r2.mjs');
const root=researchRoot; // Research sources/fixtures/out, not the product checkout root.
const browserPath=process.env.CODESIGN_BROWSER_PATH;
const runtimeDir=runtimeDirectory();
const startedAt=new Date().toISOString(),started=performance.now();
await mkdir(join(root,'out'),{recursive:true});
const output=await mkdtemp(join(root,'out','browser-calibration-r2-'));
const inputPaths={observer:join(root,'src','browser-session-r2.mjs'),entryHelper:join(root,'src','entry-contract-r2.mjs'),measurement:join(root,'src','measurement-r2.mjs'),records:join(root,'src','measurement-records-r2.mjs'),runner:fileURLToPath(import.meta.url),...Object.fromEntries(['value-matrix.html','value-matrix.jsx','value-matrix-legacy.jsx','entry-underscore.jsx','entry-both.jsx'].map(name=>['fixture:'+name,join(root,'fixtures','handwritten',name)])),...Object.fromEntries(['react.umd.js','react-dom.umd.js','babel.standalone.js'].map(name=>['runtime:'+name,join(runtimeDir,name)]))};
async function readInputHashes(){return Object.fromEntries(await Promise.all(Object.entries(inputPaths).map(async([key,path])=>[key,sha256(await readFile(path))])))}
const inputHashesBefore=await readInputHashes(),inputHashesStartedAt=new Date().toISOString();
const observerSha256=sha256(await readFile(new URL('../src/browser-session-r2.mjs',import.meta.url)));
const runnerSha256=sha256(await readFile(fileURLToPath(import.meta.url)));
const entryHelperSha256=sha256(await readFile(new URL('../src/entry-contract-r2.mjs',import.meta.url)));
await writeFile(join(output,'observer-source.mjs'),await readFile(new URL('../src/browser-session-r2.mjs',import.meta.url)),{flag:'wx'});
await writeFile(join(output,'runner-source.mjs'),await readFile(fileURLToPath(import.meta.url)),{flag:'wx'});
await writeFile(join(output,'entry-helper-source.mjs'),await readFile(new URL('../src/entry-contract-r2.mjs',import.meta.url)),{flag:'wx'});
const measurementSha256=sha256(await readFile(new URL('../src/measurement-r2.mjs',import.meta.url)));
const report={schema:'browser-calibration-r2-report-1',startedAt,observerRevision:OBSERVER_REVISION,observerSha256,runnerSha256,measurementSha256,entryHelperSha256,output,runKind:'trusted-control-calibration-not-scientific-sampling',inputIntegrity:{paths:inputPaths,startedAt:inputHashesStartedAt,before:inputHashesBefore,after:null,stable:false},policy:DEFAULT_MEASUREMENT_POLICY,cases:[],abiCases:[],cost:{wallMs:null,humanMinutes:null,authoringTokens:'unknown',modelCalls:0,networkCalls:0},passed:false};
const role=(role,name)=>({by:'role',role,name,exact:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const initial={ 'ct-accept':'seed','ct-reject':'seed','n-empty':'','n-zero':'0','readonly-seed':'seed','readonly-empty':'','disabled-seed':'seed','disabled-empty':'','visibility-seed':'seed','visibility-empty':'','aria-seed':'seed','aria-empty':'','migrating':'seed', 'i-empty':'','i-zero':'0','i-seed':'seed','i-space':' ','t-empty':'','t-zero':'0','t-seed':'seed','t-space':' ','t-newline':'line1\nline2\n','hidden-input':'seed','override-input':'','c-accept':'seed','c-reject':'seed','c-restore':'seed'};
async function runCase(format,viewportName,viewport,calibrationPolicy){
 const fixturePath=join(root,'fixtures','handwritten','value-matrix.'+format),sourceBytes=await readFile(fixturePath);
 assert.equal(sha256(sourceBytes),inputHashesBefore['fixture:value-matrix.'+format],'FIXTURE_HASH_DRIFT_BEFORE_RENDER');
 const entryContract=format==='jsx'?APP_SCRIPT_ENTRY_CONTRACT:HTML_ENTRY_CONTRACT;
 const stage=calibrationPolicy?'validation':'discovery',caseId=stage+'-'+format+'-'+viewportName;
 const record={caseId,format,viewportName,viewport,fixturePath,fixtureSha256:sha256(sourceBytes),samples:[],actions:[],passed:false};report.cases.push(record);
 const session=await start({browserPath,runtimeDir,artifactRoot:join(output,caseId),trustLevel:'trusted-microfixture',trustedFixturePaths:[fixturePath],entryContract,viewport,calibrationPolicy,sessionLifetimeMs:180000,settleMs:250});
 async function sample(label,selector,expectedById,{transient=false}={}){
  const before=await session.trustedValueWitness({selector}),observation=await session.inspect({selector}),after=await session.trustedValueWitness({selector});
  const row={label,selector,before,observation,after,transient,checks:[]};record.samples.push(row);
  assert.equal(before.elements.length,observation.matchCount);assert.equal(after.elements.length,observation.matchCount);
  for(const e of observation.elements){
   const b=before.elements.find(w=>w.backendNodeId===e.backendNodeId),a=after.elements.find(w=>w.backendNodeId===e.backendNodeId);
   assert.ok(b&&a);assert.equal(a.innerWidth,viewport.width);assert.equal(b.innerWidth,viewport.width);
   const stable=b.value===a.value&&b.connected&&a.connected;
   row.checks.push({id:e.attributes.id??null,backendNodeId:e.backendNodeId,type:e.type,stable,witnessValue:a.value,rawPresence:e.rawPresence,visible:e.visible,valueState:e.valueState,decodedValue:e.value});
   if(!transient)assert.ok(stable,'witness changed around '+label);
   if(expectedById&&Object.hasOwn(expectedById,e.attributes.id))assert.equal(a.value,expectedById[e.attributes.id],label+' native witness '+e.attributes.id);
   if(stable&&e.valueState==='available')assert.equal(e.value,a.value,label+' independent native witness agrees');
   if(calibrationPolicy&&stable&&e.visible&&e.rawPresence.axNode&&!e.rawPresence.axIgnored&&['input:text','textarea'].includes(e.type))assert.equal(e.valueState,'available',label+' calibrated visible value');
  }
  return row;
 }
 async function fill(name){const action=await session.act({locator:role('textbox',name),action:'fill',value:''});record.actions.push({label:'clear '+name,action})}
 async function click(name){const action=await session.act({locator:role('button',name),action:'click'});record.actions.push({label:'click '+name,action});return action}
 try{
  record.receipt=await session.render({sourceBytes,format,entryContract,fixturePath,trustLevel:'trusted-microfixture',staticGate:staticGate({sourceBytes,format,entryContract}),artifactId:caseId});
  assert.deepEqual(record.receipt.pageErrors,[]);
  record.metrics=await session.layoutMetrics();assert.equal(record.metrics.layoutViewport.clientWidth,viewport.width);assert.equal(record.metrics.visualViewport.clientWidth,viewport.width);
  await sample('initial','input,textarea',initial);
  for(const name of ['Visibility hidden seed','Visibility hidden empty','Aria hidden seed','Aria hidden empty'])assert.equal((await session.inspect({locator:role('textbox',name)})).matchCount,0);
  record.qualification=await session.inspect({selector:'#hidden-input,#visibility-seed,#visibility-empty,#aria-seed,#aria-empty,#n-empty,#n-zero'});
  for(const e of record.qualification.elements)assert.equal(e.valueState,e.type==='input:number'?'unsupported':'unavailable');
  for(const name of ['Readonly seed','Readonly empty','Disabled seed','Disabled empty'])await assert.rejects(fill(name),/ACTION_TARGET_NOT_EDITABLE/);
  await sample('readonly-disabled-unchanged','input[readonly],input[disabled]',{'readonly-seed':'seed','readonly-empty':'','disabled-seed':'seed','disabled-empty':''});
  record.typedAction=await session.act({locator:role('textbox','Input empty'),action:'fill',value:'typed'});await sample('typed-before-clear','#i-empty',{'i-empty':'typed'});
  const hidden=await session.inspect({locator:role('textbox','Hidden input')});assert.equal(hidden.matchCount,0);record.hiddenAX=hidden;
  const override=await session.inspect({locator:role('textbox','Override input')});assert.equal(override.matchCount,1);assert.equal(override.elements[0].visible,true);record.displayOverride=override;
  const duplicate=await session.inspect({locator:role('textbox','Duplicate input')});assert.equal(duplicate.matchCount,2);record.duplicate=duplicate;
  await assert.rejects(session.inspect({locator:{...role('textbox','Duplicate input'),within:role('group','Duplicate context')}}),/AMBIGUOUS_LOCATOR_CONTEXT: 2/);
  const absent=await session.inspect({selector:'#dynamic'});assert.equal(absent.matchCount,0);record.dynamicBefore=absent;
  for(const name of ['Input empty','Input zero','Input seed','Input space'])await fill(name);
  await sample('inputs-clear','input[id^="i-"]',{'i-empty':'','i-zero':'','i-seed':'','i-space':''});
  for(const name of ['Input empty','Input seed'])await fill(name);
  await sample('inputs-repeat-clear','input[id^="i-"]',{'i-empty':'','i-zero':'','i-seed':'','i-space':''});
  for(const name of ['Textarea empty','Textarea zero','Textarea seed','Textarea space','Textarea newline'])await fill(name);
  await sample('textareas-clear','textarea',{'t-empty':'','t-zero':'','t-seed':'','t-space':'','t-newline':''});
  await fill('Textarea newline');await sample('textarea-repeat-clear','#t-newline',{'t-newline':''});
  await fill('Accept clear');await sample('controlled-accept-clear','#c-accept',{'c-accept':''});
  await fill('Accept clear');await sample('controlled-accept-repeat-clear','#c-accept',{'c-accept':''});
  await fill('Reject clear');await sample('controlled-reject-clear','#c-reject',{'c-reject':'seed'});
  await fill('Textarea accept clear');await sample('controlled-textarea-accept-clear','#ct-accept',{'ct-accept':''});await fill('Textarea reject clear');await sample('controlled-textarea-reject-clear','#ct-reject',{'ct-reject':'seed'});
  await fill('Restore clear');await sample('controlled-restore-transient','#c-restore',null,{transient:true});await pause(350);await sample('controlled-restore-final','#c-restore',{'c-restore':'seed'});
  await click('Mount');await sample('dynamic-mounted','#dynamic',{'dynamic':''});
  await click('Unmount');const unmounted=await session.inspect({selector:'#dynamic'});assert.equal(unmounted.matchCount,0);record.dynamicAfter=unmounted;
  const bottom=await click('Bottom 0');assert.ok(bottom.scrollOffset.pageY>0);assert.ok(bottom.y>=0&&bottom.y<viewport.height);assert.equal(bottom.hitTest.y,Math.round(bottom.y+bottom.scrollOffset.pageY));assert.equal((await session.inspect({selector:'#bottom'})).elements[0].text,'Bottom 1');
  const inner=await click('Inner 0');assert.equal(inner.hitTest.x,Math.round(inner.x+inner.scrollOffset.pageX));assert.equal((await session.inspect({selector:'#inner-button'})).elements[0].text,'Inner 1');
  const migratingLocator={...role('textbox','Migrating input'),within:role('group','Migration context')};
  record.migrationBefore=await session.valueCollector({locator:migratingLocator})({signal:new AbortController().signal,remainingMs:5000,sequence:1});
  await click('Move context');record.migrationAfter=await session.valueCollector({locator:migratingLocator})({signal:new AbortController().signal,remainingMs:5000,sequence:2});
  assert.equal(record.migrationBefore.state,'ok');assert.equal(record.migrationAfter.state,'ok');assert.equal(record.migrationBefore.identity.backendNodeId,record.migrationAfter.identity.backendNodeId);assert.notDeepEqual(record.migrationBefore.identity.contextBackendNodeIds,record.migrationAfter.identity.contextBackendNodeIds);assert.equal(record.migrationBefore.identity.renderEpoch,record.migrationAfter.identity.renderEpoch);
  const migrationCollect=session.valueCollector({locator:migratingLocator});
  record.migrationMeasurement=await measureUntilDeadline({collect:async request=>{if(request.sequence===2)await click('Move context');return migrationCollect(request)},expect:{cmp:'eq',value:'seed'},abort:()=>session.abortRender()});
  assert.equal(record.migrationMeasurement.outcome,'observed-satisfied');assert.equal(record.migrationMeasurement.samples.length,4);assert.deepEqual(record.migrationMeasurement.evidence.lastStable.sampleSequences,[2,3,4]);assert.equal(record.migrationMeasurement.samples[0].identity.backendNodeId,record.migrationMeasurement.samples[1].identity.backendNodeId);assert.notDeepEqual(record.migrationMeasurement.samples[0].identity.contextBackendNodeIds,record.migrationMeasurement.samples[1].identity.contextBackendNodeIds);
  record.collect=await session.valueCollector({selector:'#c-reject'})({signal:new AbortController().signal,remainingMs:5000,sequence:1});assert.equal(record.collect.state,'ok');assert.equal(record.collect.actual,'seed');
  record.collectMissing=await session.valueCollector({selector:'#absent'})({signal:new AbortController().signal,remainingMs:5000,sequence:2});assert.equal(record.collectMissing.state,'unknown');
  assert.equal(record.collectMissing.error.code,'VALUE_TARGET_NOT_FOUND');assert.equal(record.collect.evidence.valueState.status,'available');
  record.measurements=[];
  if(calibrationPolicy)for(const [selector,value] of [['Accept clear',''],['Textarea newline',''],['Reject clear','seed'],['Restore clear','seed'],['Textarea accept clear',''],['Textarea reject clear','seed']]){
   const measured=await measureUntilDeadline({collect:session.valueCollector({locator:role('textbox',selector)}),expect:{cmp:'eq',value},abort:()=>session.abortRender()});
   record.measurements.push({selector,measured});assert.equal(measured.outcome,'observed-satisfied');assert.equal(measured.termination.reason,'satisfied');assert.equal(measured.coverage.validSamples,3);assert.equal(measured.health.sessionUsable,true);assert.ok(measured.samples.every(s=>s.completedMs<5000&&s.evidence.valueState.status==='available'));
  }
  if(calibrationPolicy){
   const controller=new AbortController(),epoch=session.diagnostics.renderEpoch;
   const pending=session.valueCollector({locator:role('textbox','Reject clear')})({signal:controller.signal,remainingMs:5000,sequence:1});controller.abort();
   const first=session.abortRender(),second=session.abortRender();assert.equal(first,second,'cleanup promise is single-flight');
   await assert.rejects(session.render({sourceBytes,format,entryContract,fixturePath,trustLevel:'trusted-microfixture',staticGate:staticGate({sourceBytes,format,entryContract}),artifactId:caseId+'-forbidden-during-cleanup'}),/RENDER_LIFECYCLE_BUSY/);
   record.cancelledCollect=await pending;await first;assert.ok(['unknown','error'].includes(record.cancelledCollect.state));assert.equal(Object.hasOwn(record.cancelledCollect,'actual'),false);
   record.afterCancelReceipt=await session.render({sourceBytes,format,entryContract,fixturePath,trustLevel:'trusted-microfixture',staticGate:staticGate({sourceBytes,format,entryContract}),artifactId:caseId+'-after-cancel'});assert.ok(record.afterCancelReceipt.renderEpoch>epoch);
   record.afterCancelValue=await session.valueCollector({locator:role('textbox','Reject clear')})({signal:new AbortController().signal,remainingMs:5000,sequence:1});assert.equal(record.afterCancelValue.actual,'seed');
   const raceController=new AbortController(),raceTimer=setTimeout(()=>raceController.abort(),1);
   try{record.deadlineCancelRace=await measureUntilDeadline({collect:session.valueCollector({locator:role('textbox','Reject clear')}),expect:{cmp:'eq',value:'seed'},policy:{timeoutMs:1,pollIntervalMs:0},signal:raceController.signal,abort:()=>session.abortRender()})}finally{clearTimeout(raceTimer);await session.abortRender()}
   assert.notEqual(record.deadlineCancelRace.outcome,'observed-satisfied');assert.ok(record.deadlineCancelRace.samples.filter(x=>x.eligibleBeforeDeadline).every(x=>x.completedMs<1));
   record.afterRaceReceipt=await session.render({sourceBytes,format,entryContract,fixturePath,trustLevel:'trusted-microfixture',staticGate:staticGate({sourceBytes,format,entryContract}),artifactId:caseId+'-after-race'});
   record.afterRaceValue=await session.valueCollector({locator:role('textbox','Reject clear')})({signal:new AbortController().signal,remainingMs:5000,sequence:1});assert.equal(record.afterRaceValue.actual,'seed');
  }
  await session.close();
  record.closedMeasurement=await measureUntilDeadline({collect:session.valueCollector({selector:'#c-reject'}),expect:{cmp:'eq',value:'seed'},abort:()=>session.close()});
  assert.equal(record.closedMeasurement.termination.reason,'fatal-collection-error');assert.equal(record.closedMeasurement.health.terminalError.code,'SESSION_CLOSED');assert.equal(record.closedMeasurement.health.sessionUsable,false);assert.equal(record.closedMeasurement.samples.length,1);assert.equal(record.closedMeasurement.health.cleanup.status,'completed');
  record.passed=true;
 }catch(error){record.error={message:error.message,stack:error.stack};throw error}
 finally{await session.close();record.cleanup=session.diagnostics;assert.ok(record.cleanup.ownedProcesses.every(p=>p.closedAt));await writeFile(join(output,caseId+'.json'),JSON.stringify(record,null,2),{flag:'wx'})}
}
async function runAbiCase(name,entryContract,label,value,policy){
 const fixturePath=join(root,'fixtures','handwritten',name+'.jsx'),sourceBytes=await readFile(fixturePath),format='jsx';
 assert.equal(sha256(sourceBytes),inputHashesBefore['fixture:'+name+'.jsx'],'FIXTURE_HASH_DRIFT_BEFORE_ABI_RENDER');
 const record={name,entryContract,fixturePath,fixtureSha256:sha256(sourceBytes),passed:false};report.abiCases.push(record);
 const session=await start({browserPath,runtimeDir,artifactRoot:join(output,'abi-'+name),trustLevel:'trusted-microfixture',entryContract,trustedFixturePaths:[fixturePath],calibrationPolicy:policy});
 try{
  record.receipt=await session.render({sourceBytes,format,entryContract,fixturePath,trustLevel:'trusted-microfixture',staticGate:staticGate({sourceBytes,format,entryContract}),artifactId:'abi-'+name});assert.deepEqual(record.receipt.pageErrors,[]);assert.equal(record.receipt.sourceSha256,sha256(sourceBytes));
  record.beforeWitness=await session.trustedValueWitness({selector:name==='value-matrix-legacy'?'#i-seed':'input'});assert.equal(record.beforeWitness.elements[0].value,value);
  record.before=await measureUntilDeadline({collect:session.valueCollector({locator:role('textbox',label)}),expect:{cmp:'eq',value},abort:()=>session.abortRender()});assert.equal(record.before.outcome,'observed-satisfied');
  await session.act({locator:role('textbox',label),action:'fill',value:''});record.afterWitness=await session.trustedValueWitness({selector:name==='value-matrix-legacy'?'#i-seed':'input'});assert.equal(record.afterWitness.elements[0].value,'');
  record.after=await measureUntilDeadline({collect:session.valueCollector({locator:role('textbox',label)}),expect:{cmp:'eq',value:''},abort:()=>session.abortRender()});assert.equal(record.after.outcome,'observed-satisfied');
  if(name==='entry-underscore')assert.equal(record.receipt.entrySelection.entryName,'_App');if(name==='entry-both')assert.equal(record.receipt.entrySelection.entryName,'App');
  record.passed=true;
 }catch(error){record.error={message:error.message,stack:error.stack};throw error}finally{await session.close();record.cleanup=session.diagnostics;await writeFile(join(output,'abi-'+name+'.json'),JSON.stringify(record,null,2),{flag:'wx'})}
}
function derivePolicy(){
 const discovery=report.cases.filter(c=>c.caseId.startsWith('discovery-'));
 assert.equal(discovery.length,4);assert.ok(discovery.every(c=>c.passed));
 const version=discovery[0].receipt.browserVersion;assert.ok(discovery.every(c=>browserVersionKey(c.receipt.browserVersion)===browserVersionKey(version)));
 const rules=[];
 for(const type of ['input:text','textarea']){
  const checks=discovery.flatMap(c=>c.samples.filter(s=>!s.transient).flatMap(s=>s.checks.map(x=>({...x,caseId:c.caseId,label:s.label})))).filter(x=>x.type===type&&x.visible&&x.rawPresence.axNode&&!x.rawPresence.axIgnored&&x.stable);
  const emptyEncoding={textValue:type==='textarea'?'string-index-minus-one':'entry-absent',inputValue:type==='input:text'?'string-index-minus-one':'entry-absent',axValue:'absent'};
  const sparse=x=>channelEncoding(x.rawPresence.textValue)===emptyEncoding.textValue&&channelEncoding(x.rawPresence.inputValue)===emptyEncoding.inputValue&&!x.rawPresence.axValue.entryPresent;
  const empties=checks.filter(x=>x.witnessValue===''),nonempty=checks.filter(x=>x.witnessValue!=='');
  assert.ok(empties.length>=4&&nonempty.length>=4);assert.ok(empties.every(sparse),'all empty controls must expose the calibrated omission shape');assert.ok(nonempty.every(x=>!sparse(x)),'negative controls must never expose empty omission shape');
  for(const c of discovery){const values=new Set(nonempty.filter(x=>x.caseId===c.caseId).map(x=>x.witnessValue));for(const value of ['0','seed',' '])assert.ok(values.has(value));if(type==='textarea')assert.ok(values.has('line1\nline2\n'))}
  rules.push({ruleId:'r2-'+type+'-'+browserVersionKey(version),browserVersionKey:browserVersionKey(version),type,emptyMeansEmpty:true,emptyEncoding,validated:true,emptyWitnessCount:empties.length,nonemptyWitnessCount:nonempty.length,scope:'visible AX-backed native text controls; both RareStringData fields exist; native type channel contains stringIndex=-1, other channel entry absent and AX value absent'});
 }
 const body={schema:CALIBRATION_POLICY_SCHEMA,browserVersion:version,observerSha256,runnerSha256,entryHelperSha256,discoveryCaseIds:discovery.map(c=>c.caseId),fixtureHashes:Object.fromEntries(discovery.map(c=>[c.format,c.fixtureSha256])),runtimeHashes:discovery[0].receipt.runtimeHashes,rules};
 return{...body,policyId:'r2-sparse-'+sha256(JSON.stringify(body))};
}
try{
 assert.equal(observerSha256,inputHashesBefore.observer);assert.equal(entryHelperSha256,inputHashesBefore.entryHelper);assert.equal(runnerSha256,inputHashesBefore.runner);assert.equal(measurementSha256,inputHashesBefore.measurement);
 for(const format of ['html','jsx'])for(const[name,viewport]of Object.entries({desktop:{width:1280,height:900},mobile:{width:390,height:844}}))await runCase(format,name,viewport,null);
 const policy=derivePolicy();report.calibrationPolicy=policy;await writeFile(join(output,'policy.json'),JSON.stringify(policy,null,2),{flag:'wx'});
 for(const format of ['html','jsx'])for(const[name,viewport]of Object.entries({desktop:{width:1280,height:900},mobile:{width:390,height:844}}))await runCase(format,name,viewport,policy);
 for(const [name,entryContract,label,value] of [['entry-underscore',APP_SCRIPT_ENTRY_CONTRACT,'ABI value','underscore'],['entry-both',APP_SCRIPT_ENTRY_CONTRACT,'ABI value','App selected'],['value-matrix-legacy',ENTRY_CONTRACT,'Input seed','seed']])await runAbiCase(name,entryContract,label,value,policy);
 report.passed=true;
}catch(error){report.error={message:error.message,stack:error.stack};process.exitCode=1}
finally{
 try{report.inputIntegrity.after=await readInputHashes();report.inputIntegrity.finishedAt=new Date().toISOString();assert.deepEqual(report.inputIntegrity.after,inputHashesBefore,'INPUT_HASH_DRIFT: observer/helper/fixture/runner/measurement/records/runtime changed during calibration');report.inputIntegrity.stable=true}
 catch(error){report.inputIntegrity.error={code:'INPUT_HASH_DRIFT',message:error.message};report.passed=false;report.error??=report.inputIntegrity.error;process.exitCode=1}
 report.finishedAt=new Date().toISOString();report.cost.wallMs=performance.now()-started;
 await writeFile(join(output,'input-hashes.json'),JSON.stringify(report.inputIntegrity,null,2),{flag:'wx'});
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({output,passed:report.passed,inputHashesStable:report.inputIntegrity.stable,error:report.error?.message,cases:report.cases.map(c=>({caseId:c.caseId,passed:c.passed})),abiCases:report.abiCases.map(c=>({name:c.name,passed:c.passed})),wallMs:report.cost.wallMs}));
}

}
