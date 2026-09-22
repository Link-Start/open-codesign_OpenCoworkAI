import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudyRuntimeV1,inspectStudySourcePinsV1,isStudyRuntimeV1,validateFullCalibrationReportV1} from '../src/study-runtime-v1.mjs';
import {handwrittenStudyTasksV1} from '../scripts/run-study-controls-v1.mjs';
import {validateEvaluationPlanR3} from '../src/evaluation-plan-r3.mjs';
test('runtime dependency pins cover actual bridge, prepare, methods and r3 implementation',async()=>{
 const pins=await inspectStudySourcePinsV1();for(const name of ['study-runtime-v1.mjs','study-execution-bridge-v1.mjs','study-public-prepare-v1.mjs','methods-v1-engine.mjs','evaluation-normalizer-r3.mjs','browser-session-r3.mjs'])assert.match(pins[name],/^[a-f0-9]{64}$/);
 assert.equal(isStudyRuntimeV1({}),false);
});
test('runtime cannot be constructed without explicit full calibration admission',async()=>{
 await assert.rejects(createStudyRuntimeV1({}),/ADMISSION_REQUIRED/);
 await assert.rejects(createStudyRuntimeV1({manifest:{schemaVersion:'v04-study-controls-admission-1',authorizedTrustedControls:true,calibrationReady:false}}),/ADMISSION_REQUIRED/);
});
test('public direct/map control plans use actual full r3 expected-key validator, not toy stub schemas',()=>{
 const tasks=handwrittenStudyTasksV1();assert.equal(tasks.length,2);
 for(const task of tasks){const plan=validateEvaluationPlanR3(task.evaluationPlan);assert.ok(plan.expectedKeys.length>=6);assert.equal(plan.requirements.excludeNoopFromG,false);assert.ok(plan.runs[0].expanded.some(item=>item.type==='action'&&item.step.op==='reload'));assert.ok(plan.checkpoints.some(c=>c.autoOverflow));}
});

test('passing calibration boolean alone is not a full report or current-policy association',()=>{
 assert.throws(()=>validateFullCalibrationReportV1({report:{passed:true},calibration:{},caseCoverage:{}}),/STRUCTURE_REQUIRED/);
 const calibration={observerSha256:'a'.repeat(64),entryHelperSha256:'b'.repeat(64),layoutHelperSha256:'c'.repeat(64),runnerSha256:'d'.repeat(64),observerRevision:'r3-controlled',policyId:'policy-control',runtimeHashes:{react:'e'.repeat(64)},compilerHashes:{babel:'f'.repeat(64)},policy:{browserVersion:{product:'synthetic'}}};
 const before={observer:calibration.observerSha256,entryHelper:calibration.entryHelperSha256,layoutHelper:calibration.layoutHelperSha256,runner:calibration.runnerSha256};
 const report={schema:'browser-calibration-r3-report-1',runKind:'trusted-control-calibration-not-scientific-sampling',passed:true,inputIntegrity:{stable:true,before,after:structuredClone(before)},...calibration,cases:[{caseId:'public-native-matrix',passed:true,receipt:{...calibration,calibrationPolicyId:calibration.policyId,browserVersion:calibration.policy.browserVersion}}]};
 const coverage=Object.fromEntries(['value','numberValue','formControlLabel','gap','grid','order','documentOverflow','reload','setViewport'].map(domain=>[domain,['public-native-matrix']]));
 assert.equal(validateFullCalibrationReportV1({report,calibration,caseCoverage:coverage}),true);
 assert.throws(()=>validateFullCalibrationReportV1({report,calibration,caseCoverage:{}}),/COVERAGE_REQUIRED/);
 const changed=structuredClone(report);changed.cases[0].receipt.calibrationPolicyId='other';assert.throws(()=>validateFullCalibrationReportV1({report:changed,calibration,caseCoverage:coverage}),/RUNTIME_POLICY_MISMATCH/);
 const wrongPin=structuredClone(report);wrongPin.inputIntegrity.after.observer='0'.repeat(64);assert.throws(()=>validateFullCalibrationReportV1({report:wrongPin,calibration,caseCoverage:coverage}),/STRUCTURE_REQUIRED/);
});