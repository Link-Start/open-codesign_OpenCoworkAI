import {publicationCLI,blockPublicationNativeExecution} from './publication-safety.mjs';
publicationCLI(import.meta.url);
// Only these public handwritten controls; never loads any dataset/private directory.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {deriveExpectedKeysR3}=await import('../src/evaluation-plan-r3.mjs');

function evaluationPlan(id,target,protect,targetBefore,protectedValue){
  const plan={schemaVersion:'v04-evaluation-plan-r3-1',id,catalog:{target,protect},viewports:{desktop:{width:1280,height:900}},
    defaults:{documentOverflowTolerancePx:0},scenarios:[{id:'initial-and-reload',viewport:'desktop',freshReload:true,assertNoHorizontalOverflow:true,
      steps:[{op:'observe',id:'target',observation:{kind:'text',targetRef:'target'}},
        {op:'observe',id:'protect',observation:{kind:'text',targetRef:'protect'}},{op:'reload',state:'reset-to-source'},
        {op:'observe',id:'target-reload',observation:{kind:'text',targetRef:'target'}},
        {op:'observe',id:'protect-reload',observation:{kind:'text',targetRef:'protect'}}]}],
    requirements:{targets:[],originals:[],protections:[],reachability:[],excludeNoopFromG:false}};
  plan.expectedKeys=deriveExpectedKeysR3(plan);
  for(const key of plan.expectedKeys){const id=JSON.parse(key)[4];if(id.startsWith('$'))continue;
    if(id.startsWith('target')){plan.requirements.targets.push({key,expect:{cmp:'eq',value:'New'}});plan.requirements.originals.push({key,expect:{cmp:'eq',value:targetBefore}});plan.requirements.reachability.push({key,mode:'available'});}
    else{plan.requirements.originals.push({key,expect:{cmp:'eq',value:protectedValue}});plan.requirements.protections.push({key,mode:'preserve',tolerance:0});}
  }
  return plan;
}
const role=(role,name,within)=>({by:'role',role,...(name!==undefined?{name}:{}),exact:true,...(within?{within}:{})});
export function handwrittenStudyTasksV1(){
  const direct='function App(){return <main><h1 id="headline">Old</h1><button>Keep</button></main>}';
  const mapped='function App(){return <main>{[1,2].map(x=><section role="region" aria-label={"Item "+x}><span role="status">Old</span></section>)}</main>}';
  const one=role('status',undefined,role('region','Item 1')),two=role('status',undefined,role('region','Item 2'));
  return [{sourceId:'handwritten-direct',taskId:'replace-heading',briefId:'control-direct',configId:'handwritten',originalSource:direct,
    publicRequest:{userGoal:'Change the heading text to New and preserve the Keep button',scope:'source-definition',locator:role('heading','Old'),operation:{kind:'set-text',value:'New'}},
    evaluationPlan:evaluationPlan('handwritten-direct-plan',role('heading'),role('button','Keep'),'Old','Keep')},
   {sourceId:'handwritten-mapped',taskId:'replace-one-instance',briefId:'control-mapped',configId:'handwritten',originalSource:mapped,
    publicRequest:{userGoal:'Change the status in Item 1 to New and preserve Item 2',scope:'source-definition',locator:one,operation:{kind:'set-text',value:'New'}},
    evaluationPlan:evaluationPlan('handwritten-map-plan',one,two,'Old','Old')}];
}
function publicPath(value){
  const absolute=path.resolve(value);
  if(/(?:^|[\\/])(?:private[^\\/]*|\.env[^\\/]*|credentials?)(?:[\\/]|$)/i.test(absolute))throw Error('PRIVATE_INPUT_PATH_FORBIDDEN');
  return absolute;
}
export async function runTrustedStudyControlsV1({manifest,outputDirectory}={}){
  blockPublicationNativeExecution();
  const {createEngineV1}=await import('../src/methods-v1-engine.mjs');
  const {createMethodsV1,sha256}=await import('../src/methods-v1.mjs');
  const {createPublicPrepareV1}=await import('../src/study-public-prepare-v1.mjs');
  const {createStudyRuntimeV1}=await import('../src/study-runtime-v1.mjs');
  const {runStudyExecutionV1}=await import('../src/study-execution-bridge-v1.mjs');
  if(manifest?.productEngineSha256!=='76d7043215b025430fbdbb6e27666a8807c3ca922aca0b273770f1490eedb56e')throw Error('FROZEN_PRODUCT_ENGINE_PIN_REQUIRED');
  const packagePath=publicPath(manifest.productPackagePath),enginePath=path.join(path.dirname(packagePath),'src/main/source-edit-engine.ts');
  if(sha256(await readFile(enginePath))!==manifest.productEngineSha256)throw Error('PRODUCT_ENGINE_DRIFT');
  const requireProduct=createRequire(packagePath),{parse}=requireProduct('@babel/parser');
  const stockEngine=requireProduct('tsx/cjs/api').require(enginePath,packagePath);
  const engine=createEngineV1({parse,stockEngine});
  // Sentinel transport only: proves isolation and one proposal; NEVER a real model or performance baseline.
  let transportCalls=0;
  const methods=createMethodsV1({engine,oneshot:async({request})=>{
    transportCalls++;if(/PRIVATE_SENTINEL/.test(JSON.stringify(request)))throw Error('PUBLIC_REQUEST_LEAK');
    const start=request.source.indexOf('Old');if(start<0)throw Error('HANDWRITTEN_TARGET_MISSING');
    return{proposal:{patches:[{start,end:start+3,expectedText:'Old',replacement:'New'}]}};
  }});
  const runtime=await createStudyRuntimeV1({manifest,outputDirectory});
  const prepare=createPublicPrepareV1({parse,sessionFactory:runtime.sessionFactory,makeRenderRequest:runtime.makeRenderRequest,
    runtimeBinding:runtime.runtimeBinding,calibrationPolicy:runtime.calibration.policy,browserPolicyReady:true,mode:'native'});
  const result=await runStudyExecutionV1({datasetId:'public-handwritten-study-controls-v1',datasetKind:'dev',tasks:handwrittenStudyTasksV1(),
    outputDirectory,methods,prepare,runtime,policy:manifest.measurementPolicy??{},
    admission:{mode:'trusted-controls',authorized:true,calibrationReady:true,manifestId:manifest.id??null}});
  return{...result,sentinelTransportCalls:transportCalls,realModelCalls:0};
}
