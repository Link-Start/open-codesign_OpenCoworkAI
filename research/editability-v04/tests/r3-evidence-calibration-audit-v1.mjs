// Publication historical artifact program: retained for review, inputs not distributed.
throw Error('HISTORICAL_ARTIFACTS_REQUIRE_REVIEWED_PORTABLE_MANIFEST: see publication/historical-requirements.json; original paths are never followed');
// Read-only independent numeric checks of existing public calibration; never launches a browser.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hashBytesR3} from '../src/evaluation-plan-r3.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=join(root,'results/browser-calibration-r3-MDiU66');
const reportBytes=readFileSync(join(dir,'report.json')),r=JSON.parse(reportBytes);
const summary={schemaVersion:'r3-independent-existing-calibration-audit-v1',checkedAt:new Date().toISOString(),reportSha256:hashBytesR3(reportBytes),reportPassed:r.passed,counts:{},currentPins:[],numericChecks:{stableValuePairs:0,stableLayoutCoordinates:0,coherentCaptures:0,numberLexemes:[]},issues:[],cleanup:{ownedProcessReceipts:0,allRecordedClosed:true,allProfilesAbsent:true,liveProcessInspection:false},newBrowserExecuted:false,fullNativeEvaluationChainClaimed:false};
for(const [key,p] of Object.entries(r.inputIntegrity.paths)){
 if(/private-pilot|private-test|private-results|private-governance/i.test(p))throw Error('Forbidden manifest path');
 const actual=hashBytesR3(readFileSync(p));summary.currentPins.push({key,current:actual,before:r.inputIntegrity.before[key],after:r.inputIntegrity.after[key],matches:actual===r.inputIntegrity.before[key]&&actual===r.inputIntegrity.after[key]});
}
for(const group of ['cases','numberCases','domainCases','abiCases']){
 summary.counts[group]={total:r[group].length,passed:r[group].filter(x=>x.passed===true).length};
 for(const c of r[group]){
  const id=c.caseId??c.name;
  if(c.cleanup?.cleanupPending||c.cleanup?.cleanupFailure||c.cleanup?.current!==null)summary.issues.push({id,kind:'cleanup-not-settled'});
  for(const p of c.cleanup?.ownedProcesses??[]){summary.cleanup.ownedProcessReceipts++;if(!p.closedAt)summary.cleanup.allRecordedClosed=false;if(!resolve(p.profile).startsWith(resolve(dir)))throw Error('Unexpected profile outside audited result');if(existsSync(p.profile))summary.cleanup.allProfilesAbsent=false;}
  if(group==='cases'||group==='numberCases')for(const s of c.samples){
   const pre=s.before?.elements??[],post=(s.after??s.nativeWitness)?.elements??[],observed=(s.observation??s.inspection)?.elements??[];
   for(const n of observed){const a=pre.find(x=>x.backendNodeId===n.backendNodeId),b=post.find(x=>x.backendNodeId===n.backendNodeId);if(!a||!b||a.value!==b.value||n.valueState!=='available')continue;summary.numericChecks.stableValuePairs++;if(n.value!==a.value)summary.issues.push({id,label:s.label,kind:'native-value-mismatch',native:a.value,decoded:n.value});if(n.type==='input:number')summary.numericChecks.numberLexemes.push(n.value);}
  }
  if(group==='domainCases')for(const s of c.samples){const cap=s.capture;if(cap?.state!=='ok')continue;
   const e=cap.evidence,ident=cap.identity;summary.numericChecks.coherentCaptures++;
   if(e?.singleSnapshot!==true||e?.axBracketStable!==true||e.receipt?.sourceSha256!==c.fixtureSha256||ident.renderEpoch!==e.receipt.renderEpoch||ident.viewportEpoch!==e.receipt.viewportEpoch)summary.issues.push({id,label:s.label,kind:'capture-binding-inconsistency'});
   const pre=(s.before?.elements??[]).flatMap(n=>[n,...(n.children??[])]),post=(s.after?.elements??[]).flatMap(n=>[n,...(n.children??[])]);
   for(const n of cap.facts.targets.flatMap(t=>t.nodes)){const a=pre.find(x=>x.backendNodeId===n.backendNodeId||x.id&&x.id===n.attributes?.id),b=post.find(x=>x.backendNodeId===n.backendNodeId||x.id&&x.id===n.attributes?.id);if(!a?.bounds||!b?.bounds)continue;
    for(const k of ['x','y','width','height'])if(a.bounds[k]===b.bounds[k]&&Number.isFinite(a.bounds[k])){summary.numericChecks.stableLayoutCoordinates++;if(Math.abs(n.layout.bounds[k]-a.bounds[k])>.5)summary.issues.push({id,label:s.label,node:n.attributes?.id,kind:'native-layout-mismatch',coordinate:k,native:a.bounds[k],snapshot:n.layout.bounds[k]});}
   }
  }
 }
}
summary.numericChecks.numberLexemes=[...new Set(summary.numericChecks.numberLexemes)].sort();
summary.limits=['Witness equality is finite before/after bracketing, not atomicity or continuous-time coverage.','Recorded closed timestamps and absent owned profiles are not independent OS-process-tree verification.','Existing calibration binds r2 measurement/records; new r3 baseline/evaluator/normalizer native path not exercised by 27 controls.','Hashes identify exact bytes, not semantic correctness; trusted fixtures do not establish arbitrary JavaScript safety.'];
const out=process.argv[2];if(out){if(!resolve(out).startsWith(resolve(join(root,'results'))))throw Error('Audit output must be new public results file');writeFileSync(out,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({counts:summary.counts,currentPins:summary.currentPins.length,currentPinMismatches:summary.currentPins.filter(x=>!x.matches),numericChecks:summary.numericChecks,issues:summary.issues,cleanup:summary.cleanup},null,2));
