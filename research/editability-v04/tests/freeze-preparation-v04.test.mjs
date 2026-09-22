import {tmpdir} from 'node:os';
// Isolated handwritten fake evidence only. Never creates a project F0 freeze or reads private trees.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink,access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createPreparationFreeze,verifyPreparationFreeze,parseFreezeCLI,safeRelative,INPUT_RELATIVE,RUNTIME_NAMES,PUBLIC_ROOTS,ACCEPTED_CALIBRATION,F0_SCHEMA} from '../scripts/freeze-preparation-v04.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const results=tmpdir(); // Publication revision: isolated unit output, never original results.
async function put(path,bytes){await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'})}
async function fixture(){
 const directory=await mkdtemp(join(results,'f0-handwritten-unit-')),root=join(directory,'public-project'),runtimeRoot=join(directory,'trusted-fake-vendor');
 await mkdir(join(root,'freeze'),{recursive:true});await mkdir(runtimeRoot);
 for(const path of Object.values(INPUT_RELATIVE))await put(join(root,...path.split('/')),path===INPUT_RELATIVE.observer?"export const OBSERVER_REVISION='v04-observer-r2-unit-only';\n":'HANDWRITTEN FAKE BYTES '+path+'\n');
 await put(join(root,'src','binary.dat'),Buffer.from([0,255,10,13,128]));await put(join(root,'src','supporting-source.txt'),'auxiliary source\n');
 await put(join(root,'tests','public-unit.test.mjs'),'// handwritten fake test file, never executed\n');
 await put(join(root,'plans','F0-preparation-protocol-v1.md'),'# F0 preparation only\nNo formal execution authorized.\n');await put(join(root,'plans','readiness-v04.md'),'# Readiness\nFormal readiness false.\n');
 await put(join(root,'public-contracts','public.json'),'{"fixture":true}\n');
 for(const name of RUNTIME_NAMES)await put(join(runtimeRoot,name),'HANDWRITTEN FAKE RUNTIME '+name);
 const paths={...Object.fromEntries(Object.entries(INPUT_RELATIVE).map(([key,p])=>[key,join(root,...p.split('/'))])),...Object.fromEntries(RUNTIME_NAMES.map(n=>['runtime:'+n,join(runtimeRoot,n)]))};
 const before=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,hash(await readFile(p))]))),ledger={paths,startedAt:'2000-01-01T00:00:00Z',before,after:{...before},stable:true,finishedAt:'2000-01-01T00:00:01Z'};
 const body={schema:'r2-sparse-native-witness-v1',browserVersion:{product:'Fake/0'},observerSha256:before.observer,runnerSha256:before.runner,entryHelperSha256:before.entryHelper,fixtureHashes:{html:before['fixture:value-matrix.html'],jsx:before['fixture:value-matrix.jsx']},runtimeHashes:{'react.umd.js':before['runtime:react.umd.js'],'react-dom.umd.js':before['runtime:react-dom.umd.js']},rules:[]},policy={...body,policyId:'r2-sparse-'+hash(JSON.stringify(body))};
 const report={schema:'browser-calibration-r2-report-1',observerRevision:'v04-observer-r2-unit-only',observerSha256:before.observer,entryHelperSha256:before.entryHelper,runnerSha256:before.runner,measurementSha256:before.measurement,runKind:'trusted-control-calibration-not-scientific-sampling',passed:true,inputIntegrity:ledger,cases:Array.from({length:8},(_,i)=>({caseId:'fake-'+i,passed:true})),abiCases:Array.from({length:3},(_,i)=>({caseId:'fake-abi-'+i,passed:true})),calibrationPolicy:policy};
 const calibration=join(root,...ACCEPTED_CALIBRATION.split('/'));await mkdir(calibration,{recursive:true});
 for(const [name,value]of [['policy.json',policy],['report.json',report],['input-hashes.json',ledger],['raw-observation-00001.json',{fixture:true,value:''}]])await put(join(calibration,name),JSON.stringify(value,null,2)+'\n');
 for(const [name,key]of [['observer-source.mjs','observer'],['entry-helper-source.mjs','entryHelper'],['runner-source.mjs','runner']])await put(join(calibration,name),await readFile(paths[key]));
 const options={root,runtimeRoot,include:[...PUBLIC_ROOTS],reference:[ACCEPTED_CALIBRATION],ackPreparationOnly:true};
 return{directory,root,runtimeRoot,calibration,paths,ledger,report,policy,options,async close(){await rm(directory,{recursive:true,force:true})}};
}
async function using(fn){const f=await fixture();try{return await fn(f)}finally{await f.close()}}
async function rewrite(path,value){await writeFile(path,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n')}
const verify=result=>verifyPreparationFreeze({directory:result.directory,expectedManifestSha256:result.manifestSha256});

test('CLI requires preparation ack, explicit roots, selections and external verification anchor',()=>{
 const c=parseFreezeCLI(['create','--root','C:/public','--runtime-root','C:/vendor','--include','src','--reference',ACCEPTED_CALIBRATION,'--ack-preparation-only']);assert.equal(c.mode,'create');assert.equal(c.ackPreparationOnly,true);
 assert.throws(()=>parseFreezeCLI(['create','--root','C:/public','--runtime-root','C:/vendor']),/CREATE_ARGUMENTS_REQUIRED/);
 assert.throws(()=>parseFreezeCLI(['verify','--directory','C:/frozen']),/VERIFY_ARGUMENTS_REQUIRED/);
 assert.throws(()=>parseFreezeCLI(['verify','--directory','C:/frozen','--expected-manifest-sha256','a'.repeat(64),'--root','C:/elsewhere']),/VERIFY_ARGUMENTS_REQUIRED/);
});
test('unsafe path spellings and private path components are rejected before access',()=>{
 for(const p of ['../private-test','src/../private-results','/src','C:/src','src\\x','src//x','src/a:stream','src/a.','private-test/never-open','src/private-results/never-open','src/.env'])assert.throws(()=>safeRelative(p),/PATH/);
 assert.equal(safeRelative('fixtures/handwritten/control.jsx'),'fixtures/handwritten/control.jsx');
});
test('F0 is actual byte snapshot, references raw evidence in place and never vendors external runtimes',async()=>using(async f=>{
 const made=await createPreparationFreeze(f.options),checked=await verify(made),m=JSON.parse(await readFile(join(made.directory,'manifest.json'),'utf8'));
 assert.equal(m.schemaVersion,F0_SCHEMA);assert.equal(m.phase,'F0-preparation-only');assert.equal(m.formalExecutionAuthorized,false);assert.equal(m.noScientificOutcomesClaimed,true);assert.equal(m.formalReadiness,false);
 assert.equal(m.calibration.inputCount,13);assert.equal(m.calibration.inputHashesStable,true);assert.equal(m.calibration.inputs.filter(i=>i.kind==='external-runtime').length,3);
 assert.ok(m.fixedReferences.some(x=>x.path.endsWith('raw-observation-00001.json')));assert.ok(!m.snapshots.some(x=>x.path.startsWith('results/')||x.path.includes('vendor')));
 assert.deepEqual(await readFile(join(made.directory,'snapshot','src','binary.dat')),Buffer.from([0,255,10,13,128]));
 assert.equal(checked.developmentSourcesReread,false);assert.equal(m.cost.money,null);assert.equal(m.cost.authoringTokens,null);
}));
test('existing destination is rejected even if empty and never overwritten',async()=>using(async f=>{
 await mkdir(join(f.root,'freeze','F0-v1'));await assert.rejects(createPreparationFreeze(f.options),/FREEZE_DESTINATION_EXISTS/);assert.deepEqual(await readdir(join(f.root,'freeze','F0-v1')),[]);
}));
test('private roots and unapproved old calibration cannot be selected',async()=>using(async f=>{
 await assert.rejects(createPreparationFreeze({...f.options,include:['private-test']}),/PRIVATE_PATH_FORBIDDEN/);
 await assert.rejects(createPreparationFreeze({...f.options,reference:[ACCEPTED_CALIBRATION,'results/private-results']}),/PRIVATE_PATH_FORBIDDEN/);
 await assert.rejects(createPreparationFreeze({...f.options,reference:[ACCEPTED_CALIBRATION,'results/browser-calibration-r2-qWnJvq']}),/REFERENCE_PATH_NOT_ALLOWED/);
 await assert.rejects(access(join(f.root,'freeze','F0-v1')));
}));
test('later development source edits and deletion do not invalidate an independent old snapshot',async()=>using(async f=>{
 const made=await createPreparationFreeze(f.options);await rewrite(f.paths.observer,'AFTER FREEZE DEVELOPMENT CHANGE');await rm(join(f.root,'plans'),{recursive:true});await put(join(f.root,'src','later-new-file.txt'),'later development');
 assert.equal((await verify(made)).verified,true);
}));
test('snapshot byte tampering is rejected even when original development file remains correct',async()=>using(async f=>{
 const made=await createPreparationFreeze(f.options);await rewrite(join(made.directory,'snapshot','src','supporting-source.txt'),'tampered');await assert.rejects(verify(made),/SNAPSHOT_BYTES_OR_HASH_MISMATCH/);
}));
test('manifest byte tampering cannot be blessed by an unchanged external hash anchor',async()=>using(async f=>{
 const made=await createPreparationFreeze(f.options);const p=join(made.directory,'manifest.json');await rewrite(p,Buffer.concat([await readFile(p),Buffer.from(' ')]));await assert.rejects(verify(made),/MANIFEST_BYTES_OR_HASH_MISMATCH/);
}));
test('manifest byte count metadata and completion marker are independently checked',async()=>using(async f=>{
 const made=await createPreparationFreeze(f.options),p=join(made.directory,'manifest.sha256.json'),stamp=JSON.parse(await readFile(p,'utf8'));await rewrite(p,{...stamp,bytes:stamp.bytes+1});await assert.rejects(verify(made),/MANIFEST_BYTES_OR_HASH_MISMATCH/);
 await rewrite(p,stamp);const c=join(made.directory,'COMPLETE.json'),complete=JSON.parse(await readFile(c,'utf8'));await rewrite(c,{...complete,manifestSha256:'0'.repeat(64)});await assert.rejects(verify(made),/MANIFEST_BYTES_OR_HASH_MISMATCH/);
}));
test('fixed raw evidence edits and tree membership additions invalidate verification',async()=>using(async f=>{
 const made=await createPreparationFreeze(f.options),raw=join(f.calibration,'raw-observation-00001.json'),before=await readFile(raw);await rewrite(raw,'{}');await assert.rejects(verify(made),/FIXED_REFERENCE_BYTES_OR_HASH_MISMATCH/);
 await rewrite(raw,before);await put(join(f.calibration,'new-raw.json'),'{}');await assert.rejects(verify(made),/REFERENCE_MEMBERSHIP_MISMATCH/);
}));
test('external runtime is pinned not copied and changing it invalidates the fixed reference',async()=>using(async f=>{
 const made=await createPreparationFreeze(f.options);await rewrite(join(f.runtimeRoot,RUNTIME_NAMES[0]),'changed trusted runtime');await assert.rejects(verify(made),/CURRENT_CALIBRATION_INPUT_MISMATCH/);
}));
test('changed current helper cannot reuse an old successful calibration',async()=>using(async f=>{
 await rewrite(f.paths.entryHelper,'changed final helper');await assert.rejects(createPreparationFreeze(f.options),/CURRENT_CALIBRATION_INPUT_MISMATCH/);await assert.rejects(access(join(f.root,'freeze','F0-v1')));
}));
test('reported pass, ledger stability and exact input count are required independently',async()=>using(async f=>{
 await rewrite(join(f.calibration,'report.json'),{...f.report,passed:false});await assert.rejects(createPreparationFreeze(f.options),/CALIBRATION_NOT_ACCEPTED/);
 await rewrite(join(f.calibration,'report.json'),{...f.report,inputHashesStable:false});await assert.rejects(createPreparationFreeze(f.options),/CALIBRATION_NOT_ACCEPTED/);
 const extra={...f.ledger,paths:{...f.ledger.paths,unapproved:join(f.root,'private-test','never-open')}};await rewrite(join(f.calibration,'report.json'),{...f.report,inputIntegrity:extra});await rewrite(join(f.calibration,'input-hashes.json'),extra);await assert.rejects(createPreparationFreeze(f.options),/CALIBRATION_INPUT_SET_MISMATCH/);
}));
test('ledger private path redirection is rejected rather than followed',async()=>using(async f=>{
 const bad={...f.ledger,paths:{...f.ledger.paths,observer:join(f.root,'private-results','never-open')}};await rewrite(join(f.calibration,'report.json'),{...f.report,inputIntegrity:bad});await rewrite(join(f.calibration,'input-hashes.json'),bad);await assert.rejects(createPreparationFreeze(f.options),/PRIVATE_PATH_FORBIDDEN/);
}));
test('policy digest tampering and observer copied-source drift fail closed',async()=>using(async f=>{
 await rewrite(join(f.calibration,'policy.json'),{...f.policy,policyId:'r2-sparse-'+ '0'.repeat(64)});await assert.rejects(createPreparationFreeze(f.options),/CALIBRATION_POLICY_DIGEST_MISMATCH/);
 await rewrite(join(f.calibration,'policy.json'),f.policy);await rewrite(join(f.calibration,'observer-source.mjs'),'wrong copy');await assert.rejects(createPreparationFreeze(f.options),/CALIBRATION_SOURCE_COPY_MISMATCH/);
}));
test('source-copy race leaves retained incomplete evidence but no verifiable completion',async()=>using(async f=>{
 await assert.rejects(createPreparationFreeze({...f.options,testHooks:{afterSourceRead:async(rel,path)=>{if(rel==='src/supporting-source.txt')await rewrite(path,'changed during copy')}}}),/SOURCE_COPY_DRIFT/);
 const directory=join(f.root,'freeze','F0-v1');await assert.rejects(access(join(directory,'COMPLETE.json')));await assert.rejects(verifyPreparationFreeze({directory,expectedManifestSha256:'a'.repeat(64)}),/INCOMPLETE_OR_UNEXPECTED_FREEZE_FILES/);
 await assert.rejects(createPreparationFreeze(f.options),/FREEZE_DESTINATION_EXISTS/);
}));
test('new source file appearing during capture triggers membership drift',async()=>using(async f=>{
 let added=false;await assert.rejects(createPreparationFreeze({...f.options,testHooks:{afterSourceRead:async()=>{if(!added){added=true;await put(join(f.root,'src','race-added.txt'),'new')}}}}),/PUBLIC_SOURCE_MEMBERSHIP_DRIFT/);
}));
test('directory symlink or junction is rejected without following its target',async t=>using(async f=>{
 const link=join(f.root,'src','linked-vendor');try{await symlink(f.runtimeRoot,link,process.platform==='win32'?'junction':'dir')}catch(e){if(['EPERM','EACCES'].includes(e.code)){t.skip('OS forbids symlink creation; no escalation attempted');return}throw e}
 await assert.rejects(createPreparationFreeze(f.options),/SYMLINK_FORBIDDEN/);
}));
test('no freeze is created without explicit preparation-only acknowledgment',async()=>using(async f=>{
 await assert.rejects(createPreparationFreeze({...f.options,ackPreparationOnly:false}),/PREPARATION_ONLY_ACK_REQUIRED/);await assert.rejects(access(join(f.root,'freeze','F0-v1')));
}));
