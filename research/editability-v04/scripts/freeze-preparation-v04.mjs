import {publicationCLI} from './publication-safety.mjs';
publicationCLI(import.meta.url);
// F0 preparation tooling only. No browser/API/model execution and no private tree traversal.
import {lstat,realpath,readdir,open,readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join,relative,parse,sep,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
export const F0_SCHEMA='v04-F0-preparation-byte-snapshot-1';
export const ACCEPTED_CALIBRATION='results/browser-calibration-r2-U5AyYj';
export const PUBLIC_ROOTS=Object.freeze(['src','tests','scripts','plans','public-contracts','fixtures/handwritten']);
export const INPUT_RELATIVE=Object.freeze({observer:'src/browser-session-r2.mjs',entryHelper:'src/entry-contract-r2.mjs',measurement:'src/measurement-r2.mjs',records:'src/measurement-records-r2.mjs',runner:'scripts/run-trusted-calibration-r2.mjs',...Object.fromEntries(['value-matrix.html','value-matrix.jsx','value-matrix-legacy.jsx','entry-underscore.jsx','entry-both.jsx'].map(name=>['fixture:'+name,'fixtures/handwritten/'+name]))});
export const RUNTIME_NAMES=Object.freeze(['react.umd.js','react-dom.umd.js','babel.standalone.js']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=(code,detail='')=>{throw Object.assign(new Error(code+(detail?': '+detail:'')),{code})};
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const forward=value=>value.split(sep).join('/');
const within=(path,root)=>{const r=relative(root,path);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r))};
function segmentsAllowed(segments){for(const s of segments){if(!s||s==='.'||s==='..'||/[\x00-\x1f<>:"|?*]/.test(s)||/[. ]$/.test(s)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))fail('ILLEGAL_PATH_COMPONENT',s);if(/^private(?:$|[-_])/i.test(s)||['.git','.env','.ssh'].includes(s.toLowerCase()))fail('PRIVATE_PATH_FORBIDDEN',s)}}
export function safeRelative(value){if(typeof value!=='string'||value.includes('\\')||value.startsWith('/')||value.endsWith('/')||value.length>4096)fail('ILLEGAL_RELATIVE_PATH');const parts=value.split('/');segmentsAllowed(parts);return parts.join('/')}
function absoluteAllowed(value){if(typeof value!=='string'||!isAbsolute(value))fail('ABSOLUTE_PATH_REQUIRED');const full=resolve(value),rest=value.slice(parse(value).root.length).split(/[\\/]/);segmentsAllowed(rest);return full}
function publicPath(value){const p=safeRelative(value);if(!PUBLIC_ROOTS.some(root=>p===root||p.startsWith(root+'/')))fail('PUBLIC_PATH_NOT_ALLOWED',p);return p}
function referencePath(value){const p=safeRelative(value);if(p===ACCEPTED_CALIBRATION||p.startsWith(ACCEPTED_CALIBRATION+'/')||['results/browser-calibration-r2-summary-final-helper.md','results/browser-calibration-r2-cleanup-final-helper.json'].includes(p)||/^results\/[^/]+\.tap$/.test(p)||/^results\/[^/]*(?:authoring|author)[^/]*\.jsonl$/.test(p))return p;fail('REFERENCE_PATH_NOT_ALLOWED',p)}
async function noLinks(path,{allowMissingLeaf=false}={}){
  const abs=absoluteAllowed(path),root=parse(abs).root;let current=root;
  for(const [i,part]of abs.slice(root.length).split(sep).entries()){
    current=join(current,part);let stat;try{stat=await lstat(current)}catch(error){if(error.code==='ENOENT'&&allowMissingLeaf&&samePath(current,abs))return;throw error}
    if(stat.isSymbolicLink())fail('SYMLINK_FORBIDDEN',current);
    if(!samePath(current,abs)&&!stat.isDirectory())fail('NON_DIRECTORY_ANCESTOR',current);
  }
  if(!samePath(await realpath(abs),abs))fail('PATH_ALIAS_FORBIDDEN',abs);
}
async function regularBytes(path){
  await noLinks(path);const before=await lstat(path);
  if(!before.isFile())fail('REGULAR_FILE_REQUIRED',path);
  if(before.nlink>1)fail('HARDLINK_FORBIDDEN',path);
  if(before.size>128*1024*1024)fail('PUBLIC_FILE_SIZE_LIMIT',path);
  const handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));let bytes;
  try{const opened=await handle.stat();if(opened.ino!==before.ino||opened.dev!==before.dev)fail('SOURCE_READ_DRIFT',path);bytes=await handle.readFile();const after=await handle.stat();if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)fail('SOURCE_READ_DRIFT',path)}finally{await handle.close()}
  const final=await lstat(path);if(final.isSymbolicLink()||final.ino!==before.ino||final.dev!==before.dev||final.size!==bytes.length||final.mtimeMs!==before.mtimeMs||final.ctimeMs!==before.ctimeMs)fail('SOURCE_READ_DRIFT',path);
  return bytes;
}
const pinBytes=(path,bytes)=>({path,sha256:hash(bytes),bytes:bytes.length});
async function pin(path,absolute){return pinBytes(path,await regularBytes(absolute))}
async function jsonAt(path){try{return JSON.parse((await regularBytes(path)).toString('utf8'))}catch(error){if(error.code)throw error;fail('INVALID_JSON',path)}}
async function tree(root,selection,validator){
  const files=[];const seen=new Set();
  async function visit(rel){validator(rel);const abs=join(root,...rel.split('/'));await noLinks(abs);const stat=await lstat(abs);
    if(stat.isDirectory()){for(const name of (await readdir(abs)).sort()){segmentsAllowed([name]);await visit(rel+'/'+name)}}
    else if(stat.isFile()){const key=rel.toLowerCase();if(seen.has(key))return;seen.add(key);files.push(rel);if(files.length>50000)fail('FILE_COUNT_LIMIT')}
    else fail('SPECIAL_FILE_FORBIDDEN',rel);
  }
  for(const item of selection)await visit(item);return files.sort();
}
function exactKeys(object,keys,code){if(!object||typeof object!=='object'||Array.isArray(object)||!isDeepStrictEqual(Object.keys(object).sort(),[...keys].sort()))fail(code)}
function inputPaths(sourceRoot,runtimeRoot){return{...Object.fromEntries(Object.entries(INPUT_RELATIVE).map(([key,path])=>[key,join(sourceRoot,...path.split('/'))])),...Object.fromEntries(RUNTIME_NAMES.map(name=>['runtime:'+name,join(runtimeRoot,name)]))}}
async function inspectCalibration({sourceRoot,runtimeRoot,sourceResolver=path=>join(sourceRoot,...path.split('/'))}){
  const base=join(sourceRoot,...ACCEPTED_CALIBRATION.split('/'));
  const report=await jsonAt(join(base,'report.json')),policy=await jsonAt(join(base,'policy.json')),ledger=await jsonAt(join(base,'input-hashes.json'));
  if(report.schema!=='browser-calibration-r2-report-1'||report.passed!==true||report.runKind!=='trusted-control-calibration-not-scientific-sampling'||report.inputHashesStable===false||report.inputIntegrity?.stable!==true||ledger.stable!==true)fail('CALIBRATION_NOT_ACCEPTED');
  if(!isDeepStrictEqual(report.inputIntegrity,ledger))fail('CALIBRATION_LEDGER_MISMATCH');
  if(!Array.isArray(report.cases)||report.cases.length!==8||report.cases.some(c=>c.passed!==true)||!Array.isArray(report.abiCases)||report.abiCases.length!==3||report.abiCases.some(c=>c.passed!==true))fail('CALIBRATION_CASES_NOT_PASSED');
  const paths=inputPaths(sourceRoot,runtimeRoot),keys=Object.keys(paths);if(keys.length!==13)fail('INTERNAL_INPUT_COUNT');
  for(const value of [ledger.paths,ledger.before,ledger.after])exactKeys(value,keys,'CALIBRATION_INPUT_SET_MISMATCH');
  const pins=[];
  for(const key of keys){
    const expectedPath=paths[key];if(!samePath(absoluteAllowed(ledger.paths[key]),expectedPath))fail('CALIBRATION_INPUT_PATH_MISMATCH',key);
    if(!validHash(ledger.before[key])||ledger.before[key]!==ledger.after[key])fail('CALIBRATION_INPUT_DRIFT',key);
    const internal=INPUT_RELATIVE[key],actualPath=internal?sourceResolver(internal):expectedPath;const bytes=await regularBytes(actualPath),actual=hash(bytes);
    if(actual!==ledger.before[key])fail('CURRENT_CALIBRATION_INPUT_MISMATCH',key);
    pins.push({name:key,kind:internal?'snapshot':'external-runtime',path:internal??expectedPath,sha256:actual,bytes:bytes.length});
  }
  const {policyId,...body}=policy;
  if(policy.schema!=='r2-sparse-native-witness-v1'||policyId!=='r2-sparse-'+hash(JSON.stringify(body)))fail('CALIBRATION_POLICY_DIGEST_MISMATCH');
  for(const [field,key]of [['observerSha256','observer'],['entryHelperSha256','entryHelper'],['runnerSha256','runner']])if(policy[field]!==ledger.before[key]||report[field]!==ledger.before[key])fail('CALIBRATION_SOURCE_BINDING_MISMATCH',field);
  if(report.measurementSha256!==ledger.before.measurement||!isDeepStrictEqual(report.calibrationPolicy,policy))fail('CALIBRATION_REPORT_POLICY_MISMATCH');
  for(const [format,file]of [['html','value-matrix.html'],['jsx','value-matrix.jsx']])if(policy.fixtureHashes?.[format]!==ledger.before['fixture:'+file])fail('CALIBRATION_FIXTURE_BINDING_MISMATCH');
  for(const file of ['react.umd.js','react-dom.umd.js'])if(policy.runtimeHashes?.[file]!==ledger.before['runtime:'+file])fail('CALIBRATION_RUNTIME_BINDING_MISMATCH');
  const observer=(await regularBytes(sourceResolver(INPUT_RELATIVE.observer))).toString('utf8');
  const declaration=/export\s+const\s+OBSERVER_REVISION\s*=\s*(['"])([^'"\r\n]+)\1/.exec(observer);
  if(!declaration||declaration[2]!==report.observerRevision)fail('CALIBRATION_OBSERVER_REVISION_MISMATCH');
  for(const [file,key]of [['observer-source.mjs','observer'],['entry-helper-source.mjs','entryHelper'],['runner-source.mjs','runner']])if(hash(await regularBytes(join(base,file)))!==ledger.before[key])fail('CALIBRATION_SOURCE_COPY_MISMATCH',file);
  return{acceptedDirectory:ACCEPTED_CALIBRATION,policyId,observerRevision:report.observerRevision,inputHashesStable:true,inputCount:13,inputs:pins,runKind:report.runKind,passed:true};
}
function checkManifestEntry(entry){if(!entry||typeof entry!=='object'||!validHash(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0)fail('INVALID_MANIFEST_ENTRY');safeRelative(entry.path)}
function identicalPins(actual,expected,code){if(!isDeepStrictEqual(actual,expected))fail(code)}
/** No default creation. Caller must explicitly acknowledge preparation-only and select public roots. */
export async function createPreparationFreeze({root,destination='freeze/F0-v1',include,reference,protocol='plans/F0-preparation-protocol-v1.md',readiness='plans/readiness-v04.md',runtimeRoot,ackPreparationOnly=false,testHooks}={}){
  if(ackPreparationOnly!==true)fail('PREPARATION_ONLY_ACK_REQUIRED');if(typeof root!=='string'||!root||typeof runtimeRoot!=='string'||!runtimeRoot)fail('EXPLICIT_ROOTS_REQUIRED');root=absoluteAllowed(resolve(root??'.'));runtimeRoot=absoluteAllowed(resolve(runtimeRoot??''));await noLinks(root);await noLinks(runtimeRoot);
  if(!runtimeRoot||samePath(runtimeRoot,root)||within(runtimeRoot,root))fail('EXTERNAL_RUNTIME_ROOT_REQUIRED');
  const target=safeRelative(destination);if(!/^freeze\/F0-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(target))fail('INVALID_FREEZE_DESTINATION');
  const directory=join(root,...target.split('/'));await noLinks(join(root,'freeze'));try{await lstat(directory);fail('FREEZE_DESTINATION_EXISTS')}catch(error){if(error.code!=='ENOENT')throw error}
  if(!Array.isArray(include)||!include.length||!Array.isArray(reference)||!reference.includes(ACCEPTED_CALIBRATION))fail('EXPLICIT_PUBLIC_SELECTION_REQUIRED');
  include=[...new Set(include.map(publicPath))].sort();reference=[...new Set(reference.map(referencePath))].sort();protocol=publicPath(protocol);readiness=publicPath(readiness);
  if(!protocol.startsWith('plans/')||!readiness.startsWith('plans/'))fail('PROTOCOL_PLAN_PATH_REQUIRED');
  const files=await tree(root,include,publicPath),references=await tree(root,reference,referencePath);
  for(const required of [...Object.values(INPUT_RELATIVE),protocol,readiness])if(!files.includes(required))fail('REQUIRED_PUBLIC_SNAPSHOT_INPUT_MISSING',required);
  if(!references.includes(ACCEPTED_CALIBRATION+'/policy.json')||!references.includes(ACCEPTED_CALIBRATION+'/report.json'))fail('ACCEPTED_CALIBRATION_REFERENCE_REQUIRED');
  const startedAt=new Date().toISOString(),calibration=await inspectCalibration({sourceRoot:root,runtimeRoot});
  try{await mkdir(directory)}catch(error){if(error.code==='EEXIST')fail('FREEZE_DESTINATION_EXISTS');throw error}
  const snapshots=[],fixedReferences=[];
  // On failure retain partial directory without COMPLETE.json; never overwrite or silently delete it.
  for(const file of files){
    const source=join(root,...file.split('/')),bytes=await regularBytes(source),entry=pinBytes(file,bytes);
    await testHooks?.afterSourceRead?.(file,source);
    const out=join(directory,'snapshot',...file.split('/'));await mkdir(parse(out).dir,{recursive:true});await noLinks(parse(out).dir);await writeFile(out,bytes,{flag:'wx'});
    const copied=await pin(file,out);identicalPins(copied,entry,'SNAPSHOT_COPY_MISMATCH');
    identicalPins(await pin(file,source),entry,'SOURCE_COPY_DRIFT');snapshots.push(entry);
  }
  for(const file of references)fixedReferences.push(await pin(file,join(root,...file.split('/'))));
  // Re-enumeration and second full byte pass detect membership/content drift while snapshotting.
  identicalPins(await tree(root,include,publicPath),files,'PUBLIC_SOURCE_MEMBERSHIP_DRIFT');
  identicalPins(await tree(root,reference,referencePath),references,'REFERENCE_MEMBERSHIP_DRIFT');
  for(const entry of snapshots)identicalPins(await pin(entry.path,join(root,...entry.path.split('/'))),entry,'SOURCE_COPY_DRIFT');
  for(const entry of fixedReferences)identicalPins(await pin(entry.path,join(root,...entry.path.split('/'))),entry,'FIXED_REFERENCE_DRIFT');
  identicalPins(await inspectCalibration({sourceRoot:root,runtimeRoot}),calibration,'CALIBRATION_DRIFT_DURING_FREEZE');
  const manifest={schemaVersion:F0_SCHEMA,phase:'F0-preparation-only',formalExecutionAuthorized:false,noScientificOutcomesClaimed:true,formalReadiness:false,
    createdAt:new Date().toISOString(),captureStartedAt:startedAt,sourceRoot:root,runtimeRoot,selectedPublic:include,selectedReferences:reference,protocol,readiness,
    snapshots,fixedReferences,calibration,copyPolicy:{publicInputs:'byte-copies',acceptedCalibration:'fixed-in-place-hash-references',externalRuntime:'pin-only-no-vendoring',oldAttempts:'left-in-place-unmodified'},
    verificationPolicy:{developmentSourceChangesAfterFreeze:'allowed; verify snapshot bytes instead',fixedReferences:'must match pinned bytes and membership',symlinks:'forbidden',manifestAnchor:'external caller supplied SHA256 required'},
    cost:{authoringTokens:null,activeAuthoringMs:null,money:null,unknownFields:['authoringTokens','activeAuthoringMs','money']}};
  const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n'),manifestSha256=hash(manifestBytes),stamp={schemaVersion:'v04-F0-manifest-digest-1',path:'manifest.json',sha256:manifestSha256,bytes:manifestBytes.length};
  await writeFile(join(directory,'manifest.json'),manifestBytes,{flag:'wx'});await writeFile(join(directory,'manifest.sha256.json'),JSON.stringify(stamp,null,2)+'\n',{flag:'wx'});
  await writeFile(join(directory,'COMPLETE.json'),JSON.stringify({schemaVersion:'v04-F0-complete-1',manifestSha256,manifestBytes:manifestBytes.length,phase:'F0-preparation-only'},null,2)+'\n',{flag:'wx'});
  try{await verifyPreparationFreeze({directory,expectedManifestSha256:manifestSha256})}catch(error){await rename(join(directory,'COMPLETE.json'),join(directory,'UNVERIFIED-COMPLETE.json'));throw error}
  return{directory,manifestSha256,manifestBytes:manifestBytes.length,snapshotFileCount:snapshots.length,referenceFileCount:fixedReferences.length,phase:manifest.phase,formalExecutionAuthorized:false,noScientificOutcomesClaimed:true};
}
export async function verifyPreparationFreeze({directory,expectedManifestSha256}={}){
  if(!validHash(expectedManifestSha256))fail('EXTERNAL_MANIFEST_HASH_REQUIRED');directory=absoluteAllowed(resolve(directory??'.'));await noLinks(directory);
  const names=(await readdir(directory)).sort();if(!isDeepStrictEqual(names,['COMPLETE.json','manifest.json','manifest.sha256.json','snapshot'].sort()))fail('INCOMPLETE_OR_UNEXPECTED_FREEZE_FILES');
  const bytes=await regularBytes(join(directory,'manifest.json')),stamp=await jsonAt(join(directory,'manifest.sha256.json')),complete=await jsonAt(join(directory,'COMPLETE.json'));
  if(hash(bytes)!==expectedManifestSha256||stamp.schemaVersion!=='v04-F0-manifest-digest-1'||stamp.path!=='manifest.json'||stamp.sha256!==expectedManifestSha256||stamp.bytes!==bytes.length
      ||complete.schemaVersion!=='v04-F0-complete-1'||complete.phase!=='F0-preparation-only'||complete.manifestSha256!==expectedManifestSha256||complete.manifestBytes!==bytes.length)fail('MANIFEST_BYTES_OR_HASH_MISMATCH');
  let manifest;try{manifest=JSON.parse(bytes.toString('utf8'))}catch{fail('INVALID_MANIFEST_JSON')}
  if(manifest.schemaVersion!==F0_SCHEMA||manifest.phase!=='F0-preparation-only'||manifest.formalExecutionAuthorized!==false||manifest.noScientificOutcomesClaimed!==true||manifest.formalReadiness!==false)fail('INVALID_F0_PREPARATION_SCOPE');
  const root=absoluteAllowed(manifest.sourceRoot),runtimeRoot=absoluteAllowed(manifest.runtimeRoot);if(within(runtimeRoot,root))fail('EXTERNAL_RUNTIME_ROOT_REQUIRED');
  if(!Array.isArray(manifest.snapshots)||!Array.isArray(manifest.fixedReferences)||!Array.isArray(manifest.selectedPublic)||!Array.isArray(manifest.selectedReferences))fail('INVALID_MANIFEST_SELECTION');
  for(const p of manifest.selectedPublic)publicPath(p);for(const p of manifest.selectedReferences)referencePath(p);if(!manifest.selectedReferences.includes(ACCEPTED_CALIBRATION))fail('ACCEPTED_CALIBRATION_REFERENCE_REQUIRED');
  const snapshotRoot=join(directory,'snapshot'),expectedSnapshotPaths=manifest.snapshots.map(e=>{checkManifestEntry(e);return publicPath(e.path)});
  if(new Set(expectedSnapshotPaths.map(p=>p.toLowerCase())).size!==expectedSnapshotPaths.length)fail('DUPLICATE_SNAPSHOT_PATH');
  if(expectedSnapshotPaths.some(p=>!manifest.selectedPublic.some(s=>p===s||p.startsWith(s+'/'))))fail('SNAPSHOT_OUTSIDE_SELECTION');
  const actualSnapshotPaths=await tree(snapshotRoot,(await readdir(snapshotRoot)).sort(),p=>{safeRelative(p);if(p==='fixtures')return;publicPath(p)});
  identicalPins(actualSnapshotPaths,[...expectedSnapshotPaths].sort(),'SNAPSHOT_MEMBERSHIP_MISMATCH');
  for(const entry of manifest.snapshots)identicalPins(await pin(entry.path,join(snapshotRoot,...entry.path.split('/'))),entry,'SNAPSHOT_BYTES_OR_HASH_MISMATCH');
  const expectedReferences=manifest.fixedReferences.map(e=>{checkManifestEntry(e);return referencePath(e.path)});
  if(new Set(expectedReferences.map(p=>p.toLowerCase())).size!==expectedReferences.length)fail('DUPLICATE_REFERENCE_PATH');
  identicalPins(await tree(root,manifest.selectedReferences,referencePath),[...expectedReferences].sort(),'REFERENCE_MEMBERSHIP_MISMATCH');
  for(const entry of manifest.fixedReferences)identicalPins(await pin(entry.path,join(root,...entry.path.split('/'))),entry,'FIXED_REFERENCE_BYTES_OR_HASH_MISMATCH');
  for(const required of [...Object.values(INPUT_RELATIVE),publicPath(manifest.protocol),publicPath(manifest.readiness)])if(!expectedSnapshotPaths.includes(required))fail('REQUIRED_PUBLIC_SNAPSHOT_INPUT_MISSING');
  const calibration=await inspectCalibration({sourceRoot:root,runtimeRoot,sourceResolver:path=>join(snapshotRoot,...path.split('/'))});
  identicalPins(calibration,manifest.calibration,'FROZEN_CALIBRATION_BINDING_MISMATCH');
  return{verified:true,phase:'F0-preparation-only',formalExecutionAuthorized:false,noScientificOutcomesClaimed:true,manifestSha256:expectedManifestSha256,snapshotFileCount:manifest.snapshots.length,referenceFileCount:manifest.fixedReferences.length,developmentSourcesReread:false};
}
export function parseFreezeCLI(argv){
  const [mode,...rest]=argv;if(!['create','verify'].includes(mode))fail('USAGE','create|verify with explicit public selections; preparation only');
  const args={mode,include:[],reference:[]};const names={'--root':'root','--destination':'destination','--protocol':'protocol','--readiness':'readiness','--runtime-root':'runtimeRoot','--directory':'directory','--expected-manifest-sha256':'expectedManifestSha256'};
  for(let i=0;i<rest.length;i++){const flag=rest[i];if(flag==='--ack-preparation-only'){if(args.ackPreparationOnly)fail('DUPLICATE_CLI_FLAG',flag);args.ackPreparationOnly=true;continue}if(flag==='--include'||flag==='--reference'){if(!rest[i+1]||rest[i+1].startsWith('--'))fail('CLI_VALUE_REQUIRED',flag);args[flag.slice(2)].push(rest[++i]);continue}const key=names[flag];if(!key||!rest[i+1]||rest[i+1].startsWith('--')||args[key]!==undefined)fail('INVALID_CLI_FLAG',flag);args[key]=rest[++i]}
  if(mode==='create'&&(!args.root||!args.runtimeRoot||!args.ackPreparationOnly||args.directory||args.expectedManifestSha256))fail('CREATE_ARGUMENTS_REQUIRED');
  if(mode==='verify'&&(!args.directory||!args.expectedManifestSha256||args.root||args.runtimeRoot||args.include.length||args.reference.length||args.ackPreparationOnly||args.destination||args.protocol||args.readiness))fail('VERIFY_ARGUMENTS_REQUIRED');return args;
}
