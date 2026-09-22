import test from 'node:test';
import assert from 'node:assert/strict';
import {toAnalysisInputV1} from '../src/methods-v1-analysis.mjs';
import {METHODS_V1,sha256} from '../src/methods-v1.mjs';
import {auditInput} from '../src/analysis-v04.mjs';
const root={evaluationSchema:'handwritten-independent-receipt-1',normalizerVersion:'handwritten-normalizer-1'};
const design={briefs:[{briefId:'b',clusterId:'b'}],configs:['c1','c2'],tasks:['t1','t2','t3','t4'],maxBriefsPerCluster:2,
  independence:{status:'unverified',basis:'pre-outcome handwritten control; frozen cap is two even though observed max is one'}};
// This is synthetic independent-owner fixture evidence, not a converter-produced hash or scientific receipt.
function independent(classification='S',unknown=false) {
  const receipt={schemaVersion:root.evaluationSchema,classification,unknown,privateExpected:'SECRET_EXPECTED_ONLY_IN_RAW_RECEIPT'};
  const bytes=JSON.stringify(receipt);
  return {evaluationBinding:structuredClone(root),receipt:{bytesUtf8:bytes,sha256:sha256(bytes)},outcomes:{R:{
    confirmedViolation:classification==='W',unknown,allRequiredPassed:classification==='S',
    binding:{...root,evidenceHash:sha256(bytes),classification}},G:null}};
}
function records(){return design.configs.flatMap(configId=>design.tasks.flatMap(taskId=>METHODS_V1.map(method=>({
  briefId:'b',configId,taskId,method,datasetKind:'dev',eligibility:{R:'eligible',G:'originalIneligible'},
  preparation:'ready',proposal:'accepted',accepted:true,candidateHash:sha256('handwritten candidate'),guard:{pass:true},acceptanceLocked:true,
  evaluation:{R:{outcome:'S',uncertainty:false}},independentEvaluation:independent()}))));}
const args=()=>({experiment:{datasetId:'handwritten-dev',datasetKind:'dev',evaluationBinding:structuredClone(root),records:records()},design:structuredClone(design)});
test('analysis preserves independent root and raw evidence binding, strips raw private content',()=>{
 const input=args(),expected=input.experiment.records[0].independentEvaluation.outcomes.R.binding.evidenceHash;
 const result=toAnalysisInputV1(input);assert.equal(result.schemaVersion,'analysis-v04-input-1');assert.deepEqual(result.evaluationBinding,root);
 assert.equal(result.records[0].outcomes.R.binding.evidenceHash,expected);assert.equal(result.records[0].outcomes.R.allRequiredPassed,true);assert.equal(result.records[0].outcomes.G,null);
 assert.doesNotMatch(JSON.stringify(result),/SECRET_EXPECTED/);assert.equal(result.design.maxBriefsPerCluster,2);
 assert.equal(auditInput(result).valid,true,JSON.stringify(auditInput(result).errors));
});
test('analysis requires exact planned matrix including missing and duplicate slots',()=>{
 const missing=args();missing.experiment.records.pop();assert.throws(()=>toAnalysisInputV1(missing),/INCOMPLETE/);
 const duplicated=args();duplicated.experiment.records.push(duplicated.experiment.records[0]);assert.throws(()=>toAnalysisInputV1(duplicated),/DUPLICATE/);
});
test('root schema and normalizer binding required; caller cannot override stale binding',()=>{
 const missing=args();delete missing.experiment.evaluationBinding;assert.throws(()=>toAnalysisInputV1(missing),/BINDING_REQUIRED/);
 assert.throws(()=>toAnalysisInputV1({...args(),evaluationBinding:{...root,normalizerVersion:'other'}}),/ROOT_EVALUATION_BINDING_MISMATCH/);
 const explicit=args();delete explicit.experiment.evaluationBinding;explicit.evaluationBinding=root;assert.deepEqual(toAnalysisInputV1(explicit).evaluationBinding,root);
});
test('bare runner outcomes cannot masquerade as independently normalized evidence',()=>{
 const input=args();delete input.experiment.records[0].independentEvaluation;assert.throws(()=>toAnalysisInputV1(input),/INDEPENDENT_EVALUATION_REQUIRED/);
 const bare=args();delete bare.experiment.records[0].independentEvaluation.outcomes.R;assert.throws(()=>toAnalysisInputV1(bare),/INDEPENDENT_NORMALIZED_OUTCOME_REQUIRED/);
});
test('missing malformed or wrong-version evidence binding fails without minting a hash',()=>{
 for(const mutate of [binding=>delete binding.evidenceHash,binding=>binding.evidenceHash='not-a-sha',binding=>binding.normalizerVersion='other',binding=>binding.evaluationSchema='other']){
   const input=args(),binding=input.experiment.records[0].independentEvaluation.outcomes.R.binding;mutate(binding);const before=structuredClone(binding);
   assert.throws(()=>toAnalysisInputV1(input),/EVALUATION_BINDING_MISMATCH/);assert.deepEqual(binding,before);
 }
});
test('classification and all three explicit booleans must agree',()=>{
 for(const mutate of [value=>value.binding.classification='W',value=>value.allRequiredPassed=false,value=>value.unknown=true,value=>value.confirmedViolation='false']){
   const input=args();mutate(input.experiment.records[0].independentEvaluation.outcomes.R);
   assert.throws(()=>toAnalysisInputV1(input),/OUTCOME|BINDING/);
 }
});
test('W may coexist with unknown, U_A requires unknown, local summary must agree',()=>{
 for(const [classification,unknown] of [['W',false],['W',true],['U_A',true]]){
   const input=args(),r=input.experiment.records[0];r.evaluation.R={outcome:classification,uncertainty:unknown};r.independentEvaluation=independent(classification,unknown);
   const result=toAnalysisInputV1(input);assert.equal(result.records[0].outcomes.R.binding.classification,classification);assert.equal(result.records[0].outcomes.R.unknown,unknown);assert.equal(auditInput(result).valid,true);
 }
 const disagree=args();disagree.experiment.records[0].evaluation.R.outcome='W';assert.throws(()=>toAnalysisInputV1(disagree),/RUNNER_NORMALIZER_DISAGREEMENT/);
 const alias=args();alias.experiment.records[0].independentEvaluation.outcomes.R.binding.classification='UA';assert.throws(()=>toAnalysisInputV1(alias),/BINDING_MISMATCH/);
});
test('maxBriefsPerCluster must be externally frozen, never computed from observed sizes',()=>{
 for(const bound of [undefined,0,-1,1.5]){const input=args();input.design.maxBriefsPerCluster=bound;assert.throws(()=>toAnalysisInputV1(input),/FROZEN_MAX_BRIEFS_PER_CLUSTER_REQUIRED/);}
 const exceeded=args();exceeded.design.maxBriefsPerCluster=1;exceeded.design.briefs.push({briefId:'b2',clusterId:'b'});assert.throws(()=>toAnalysisInputV1(exceeded),/EXCEEDS_FROZEN_BOUND/);
 const prior=args();assert.equal(toAnalysisInputV1(prior).design.maxBriefsPerCluster,2);assert.equal(prior.design.maxBriefsPerCluster,2);
});
test('only FULL scope rejection sets scopeGuardRejected, nonaccepted lock must be false',()=>{
 const input=args();for(const r of input.experiment.records)if(['FULL','PROVENANCE_OFF'].includes(r.method)){
   r.proposal='rejected';r.accepted=false;r.acceptanceLocked=false;r.guard={pass:false,reason:'scope-unsupported'};r.evaluation={};delete r.independentEvaluation;
 }
 const result=toAnalysisInputV1(input);assert.equal(result.records.find(r=>r.method==='FULL').proposal.scopeGuardRejected,true);
 assert.equal(result.records.find(r=>r.method==='PROVENANCE_OFF').proposal.scopeGuardRejected,false);assert.equal(auditInput(result).valid,true,JSON.stringify(auditInput(result).errors));
 input.experiment.records[0].acceptanceLocked=true;assert.throws(()=>toAnalysisInputV1(input),/ACCEPTANCE_LOCK_MISMATCH/);
});
test('nonaccepted and ineligible outcomes cannot be silently discarded',()=>{
 const input=args();input.experiment.records[0].independentEvaluation.outcomes.G=structuredClone(input.experiment.records[0].independentEvaluation.outcomes.R);
 assert.throws(()=>toAnalysisInputV1(input),/NONACCEPTED_OR_INELIGIBLE_OUTCOME/);
 const rejected=args(),r=rejected.experiment.records[0];r.proposal='rejected';r.accepted=false;r.acceptanceLocked=false;assert.throws(()=>toAnalysisInputV1(rejected),/NONACCEPTED_OR_INELIGIBLE_OUTCOME/);
});

test('analysis output allowlists design metadata and normalized binding fields',()=>{
 const input=args();input.design.privateExpected='SECRET_DESIGN';input.design.briefs[0].rawSource='SECRET_SOURCE';input.experiment.records[0].independentEvaluation.outcomes.R.binding.raw='SECRET_BINDING';
 assert.doesNotMatch(JSON.stringify(toAnalysisInputV1(input)),/SECRET/);
});