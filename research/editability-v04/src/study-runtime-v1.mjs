import {readFile,mkdir,open} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {start,staticGate,buildEnvelope,POLICY_ID,APP_SCRIPT_ENTRY_CONTRACT,OBSERVER_REVISION} from './browser-session-r3.mjs';
import {loadCalibratedPolicyR3} from './evaluate-adapter-r3.mjs';
import {immutable,rebuildPatch,sha256} from './methods-v1.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const brands=new WeakSet();
export const isStudyRuntimeV1=value=>brands.has(value);
const publicSourceFiles=['browser-session-r3.mjs','entry-contract-r2.mjs','layout-facts-r3.mjs','evaluate-adapter-r3.mjs','evaluation-plan-r3.mjs','evaluation-facts-r3.mjs','baseline-r3.mjs','evaluation-normalizer-r3.mjs','measurement-r3.mjs','measurement-records-r3.mjs','measurement-r2.mjs','measurement-records-r2.mjs','methods-v1.mjs','methods-v1-engine.mjs','methods-v1-analysis.mjs','experiment-runner-v1.mjs','study-public-prepare-v1.mjs','study-execution-bridge-v1.mjs','study-runtime-v1.mjs','../scripts/run-study-controls-v1.mjs'];
export async function inspectStudySourcePinsV1(){
  return Object.fromEntries(await Promise.all(publicSourceFiles.map(async name=>[name,hash(await readFile(new URL(name,import.meta.url)))])));
}
export function validateFullCalibrationReportV1({report,calibration,caseCoverage}){
  if(!/^browser-calibration-r3-report-\d+$/.test(report?.schema??'')||report.runKind!=='trusted-control-calibration-not-scientific-sampling'
    ||report.passed!==true||report.inputIntegrity?.stable!==true||!report.inputIntegrity.before
    ||!isDeepStrictEqual(report.inputIntegrity.before,report.inputIntegrity.after))fail('FULL_CALIBRATION_REPORT_STRUCTURE_REQUIRED');
  for(const [field,pinKey,inputKey]of [['observerSha256','observerSha256','observer'],['entryHelperSha256','entryHelperSha256','entryHelper'],['layoutHelperSha256','layoutHelperSha256','layoutHelper'],['runnerSha256','runnerSha256','runner']])
    if(report[field]!==calibration[pinKey]||report.inputIntegrity.before[inputKey]!==calibration[pinKey])fail('FULL_CALIBRATION_REPORT_POLICY_PIN_MISMATCH');
  if(report.observerRevision!==calibration.observerRevision)fail('FULL_CALIBRATION_REPORT_POLICY_PIN_MISMATCH');
  const records=['cases','abiCases','domainCases','numberCases','labelCases'].flatMap(key=>Array.isArray(report[key])?report[key]:[]);
  const requiredDomains=['value','numberValue','formControlLabel','gap','grid','order','documentOverflow','reload','setViewport'];
  for(const domain of requiredDomains){
    const ids=caseCoverage?.[domain];if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!id))fail('FULL_CALIBRATION_PREDECLARED_CASE_COVERAGE_REQUIRED');
    for(const id of ids){
      const matches=records.filter(record=>(record.caseId??record.name)===id);if(matches.length!==1||matches[0].passed!==true)fail('FULL_CALIBRATION_REQUIRED_CASE_NOT_PASSED');
      const receipt=matches[0].receipt??matches[0].renderReceipt;
      if(!receipt||receipt.calibrationPolicyId!==calibration.policyId||receipt.observerSha256!==calibration.observerSha256
        ||receipt.entryHelperSha256!==calibration.entryHelperSha256||receipt.layoutHelperSha256!==calibration.layoutHelperSha256
        ||!isDeepStrictEqual(receipt.runtimeHashes,calibration.runtimeHashes)||!isDeepStrictEqual(receipt.compilerHashes,calibration.compilerHashes)
        ||!isDeepStrictEqual(receipt.browserVersion,calibration.policy.browserVersion))fail('FULL_CALIBRATION_CASE_RUNTIME_POLICY_MISMATCH');
    }
  }
  return true;
}
/** Native only: actual r3 gate, same buildEnvelope compiler/runtime, pinned branded calibration. */
export async function createStudyRuntimeV1({manifest,outputDirectory}={}) {
  manifest=immutable(structuredClone(manifest));
  if(manifest?.schemaVersion!=='v04-study-controls-admission-1'||manifest.authorizedTrustedControls!==true
    ||manifest.calibrationReady!==true||manifest.evaluatorContractReady!==true||manifest.authorizedNaturalExecution===true)fail('FULL_TRUSTED_CONTROL_ADMISSION_REQUIRED');
  // Publication revision safety default: seal/normalizer integration and full calibration remain WIP.
  fail('PUBLICATION_NATIVE_ADMISSION_BLOCKED');
  for(const key of ['browserPath','runtimeDir'])if(typeof manifest[key]!=='string'||!path.isAbsolute(manifest[key]))fail('STUDY_RUNTIME_PATH_REQUIRED');
  if(!path.isAbsolute(outputDirectory))fail('STUDY_OUTPUT_DIRECTORY_REQUIRED');
  const sourcePins=await inspectStudySourcePinsV1();
  if(!isDeepStrictEqual(sourcePins,manifest.sourcePins))fail('STUDY_SOURCE_PINS_DRIFT');
  if(!manifest.calibrationReport||typeof manifest.calibrationReport.path!=='string'||!path.isAbsolute(manifest.calibrationReport.path)
    ||!/^[a-f0-9]{64}$/.test(manifest.calibrationReport.sha256??''))fail('FULL_CALIBRATION_REPORT_ANCHOR_REQUIRED');
  const reportBytes=await readFile(manifest.calibrationReport.path);
  if(hash(reportBytes)!==manifest.calibrationReport.sha256)fail('FULL_CALIBRATION_REPORT_HASH_MISMATCH');
  const calibrationReport=JSON.parse(reportBytes.toString('utf8'));
  if(calibrationReport.passed!==true)fail('FULL_CALIBRATION_REPORT_NOT_PASSED');
  const calibration=await loadCalibratedPolicyR3(manifest.calibration);
  validateFullCalibrationReportV1({report:calibrationReport,calibration,caseCoverage:manifest.calibrationCaseCoverage});
  if(calibration.observerRevision!==OBSERVER_REVISION)fail('STUDY_OBSERVER_REVISION_DRIFT');
  const environment={entryContract:APP_SCRIPT_ENTRY_CONTRACT,runtimeHashes:calibration.runtimeHashes,compilerHashes:calibration.compilerHashes,
    observerSha256:calibration.observerSha256,observerRevision:calibration.observerRevision,entryHelperSha256:calibration.entryHelperSha256,
    layoutHelperSha256:calibration.layoutHelperSha256,calibrationPolicyFileSha256:calibration.policyFileSha256,
    browserVersion:calibration.policy.browserVersion,dependencyHashes:sourcePins};
  const viewport=manifest.viewport??{width:1280,height:900};
  const runtimeBinding={entryContract:APP_SCRIPT_ENTRY_CONTRACT,trustLevel:'trusted-microfixture',observerSha256:calibration.observerSha256,observerRevision:calibration.observerRevision,
    entryHelperSha256:calibration.entryHelperSha256,layoutHelperSha256:calibration.layoutHelperSha256,
    runtimeHashes:calibration.runtimeHashes,compilerHashes:calibration.compilerHashes,browserVersion:calibration.policy.browserVersion,
    calibrationPolicyId:calibration.policyId,staticPolicyId:POLICY_ID,viewport};
  const publicSafetyPolicy=immutable({schemaVersion:'v04-study-public-safety-1',id:POLICY_ID,entryContract:APP_SCRIPT_ENTRY_CONTRACT,
    gateSourceSha256:sourcePins['browser-session-r3.mjs'],entryCompilerSha256:sourcePins['entry-contract-r2.mjs'],
    contract:'same-lexical-source-gate-plus-actual-JSX-compile-and-ABI-for-every-method',securityClaim:'browser-risk-reduction-not-OS-isolation'});
  const sourceDirectory=path.join(outputDirectory,'source-archive'),browserDirectory=path.join(outputDirectory,'browser');
  await mkdir(sourceDirectory);await mkdir(browserDirectory);const sources=new Map();
  async function envelope(sourceBytes){
    const gate=staticGate({sourceBytes,format:'jsx',entryContract:APP_SCRIPT_ENTRY_CONTRACT});if(!gate.accepted)fail('STUDY_COMMON_STATIC_GATE_REJECTED');
    const compiled=await buildEnvelope({sourceBytes,format:'jsx',runtimeDir:manifest.runtimeDir,entryContract:APP_SCRIPT_ENTRY_CONTRACT});
    if(!isDeepStrictEqual(compiled.runtimeHashes,calibration.runtimeHashes)||!isDeepStrictEqual(compiled.compilerHashes,calibration.compilerHashes))fail('STUDY_RUNTIME_COMPILER_PIN_DRIFT');
    return {gate,compiled};
  }
  async function archive(sourceBytes,sourceHash){
    if(hash(sourceBytes)!==sourceHash)fail('STUDY_RENDER_SOURCE_HASH_MISMATCH');
    if(sources.has(sourceHash)){if(!Buffer.from(await readFile(sources.get(sourceHash))).equals(Buffer.from(sourceBytes)))fail('STUDY_SOURCE_ARCHIVE_CHANGED');return sources.get(sourceHash);}
    const file=path.join(sourceDirectory,sourceHash+'.jsx'),handle=await open(file,'wx',0o600);
    try{await handle.writeFile(sourceBytes);await handle.sync();}finally{await handle.close();}
    sources.set(sourceHash,file);return file;
  }
  async function makeRenderRequest({sourceBytes,sourceHash,artifactId,publicRequest}){
    const bytes=Uint8Array.from(sourceBytes);if(hash(bytes)!==sourceHash)fail('STUDY_RENDER_SOURCE_HASH_MISMATCH');
    const {gate}=await envelope(bytes),fixturePath=await archive(bytes,sourceHash);
    return{sourceBytes:bytes,format:'jsx',entryContract:APP_SCRIPT_ENTRY_CONTRACT,trustLevel:'trusted-microfixture',staticGate:gate,
      fixturePath,artifactId:artifactId??'study-'+randomUUID(),viewport};
  }
  async function publicCheck(input){
    let parsed=false,entry=false,safety=false;
    try{
      const bytes=Buffer.from(input.content,'utf8');const {compiled}=await envelope(bytes);parsed=!!compiled.compiled;entry=compiled.entryContract===APP_SCRIPT_ENTRY_CONTRACT;
      safety=rebuildPatch(input.source,input.patches)===input.content&&sha256(input.content)===input.candidateHash;
    }catch{}
    return{checks:[{key:'parse',pass:parsed},{key:'entry',pass:entry},{key:'patch-safety',pass:safety}],policy:publicSafetyPolicy};
  }
  async function sessionFactory(options={}){
    const artifactRoot=path.join(browserDirectory,'session-'+randomUUID());await mkdir(artifactRoot);
    return start({browserPath:manifest.browserPath,runtimeDir:manifest.runtimeDir,artifactRoot,entryContract:APP_SCRIPT_ENTRY_CONTRACT,
      trustLevel:'trusted-microfixture',trustedFixturePaths:[...sources.values()],calibrationPolicy:calibration.policy,
      viewport:options.viewport??viewport,settleMs:250,sessionLifetimeMs:180000});
  }
  const runtime=Object.freeze({calibration,environment:immutable(environment),runtimeBinding:immutable(runtimeBinding),publicSafetyPolicy,
    sourcePins:immutable(sourcePins),makeRenderRequest,publicCheck,sessionFactory,
    runtimeSemantics:immutable({renderer:'browser-session-r3.buildEnvelope',entryContract:APP_SCRIPT_ENTRY_CONTRACT,
      vendorHashes:calibration.runtimeHashes,compilerHashes:calibration.compilerHashes,
      equivalenceClaim:'same-trusted-research-runtime-for-original-preview-copy-and-candidate; not-certified-product-desktop-equivalence'})});
  brands.add(runtime);return runtime;
}
