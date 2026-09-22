// Public observation/replay plan validation; private requirements remain Node-only.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

import {validateMeasurementExpectation,validateMeasurementPolicy} from './measurement-r2.mjs';
export const PLAN_SCHEMA_R3='v04-evaluation-plan-r3-1';
export const failR3=(code,detail='')=>{throw Object.assign(new Error(code+(detail?': '+detail:'')),{code})};
export const ownR3=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
export const finiteR3=v=>typeof v==='number'&&Number.isFinite(v);
export const copyR3=v=>structuredClone(v);
export const hashBytesR3=v=>createHash('sha256').update(v).digest('hex');
export const validHashR3=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));if(v===null||typeof v==='string'||typeof v==='boolean'||finiteR3(v))return v;failR3('R3_JSON_VALUE_REQUIRED')}
export const digestR3=v=>hashBytesR3(JSON.stringify(canonical(v)));
export function freezeR3(v){if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){for(const x of Object.values(v))freezeR3(x);Object.freeze(v)}return v}
export function fieldsR3(v,keys,code){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).some(k=>!keys.includes(k)))failR3(code)}
export const errorR3=e=>({code:typeof e?.code==='string'?e.code:'R3_EVALUATION_ERROR',message:String(e?.message??e)});
export function viewportR3(v){fieldsR3(v,['width','height'],'INVALID_R3_VIEWPORT');if(!Number.isInteger(v.width)||!Number.isInteger(v.height)||v.width<200||v.height<200||v.width>4096||v.height>4096)failR3('INVALID_R3_VIEWPORT');return{width:v.width,height:v.height}}
export function publicLocatorR3(input,catalog={},stack=[],depth=0){
 if(depth>8||!input||Object.getPrototypeOf(input)!==Object.prototype)failR3('INVALID_PUBLIC_QUERY');
 if(input.kind==='query-ref'){
  fieldsR3(input,['kind','ref','within','exact'],'PRIVATE_OR_UNKNOWN_QUERY_FIELD');if(typeof input.ref!=='string'||!ownR3(catalog,input.ref)||stack.includes(input.ref))failR3('PUBLIC_QUERY_REFERENCE_CYCLE_OR_MISSING');
  let base=publicLocatorR3(catalog[input.ref],catalog,[...stack,input.ref],depth+1);if(input.exact!==undefined){if(typeof input.exact!=='boolean')failR3('INVALID_PUBLIC_QUERY');base={...base,exact:input.exact}}
  if(input.within){const outer=publicLocatorR3(input.within,catalog,stack,depth+1),append=(node,level)=>{if(level>8)failR3('INVALID_PUBLIC_QUERY');return{...node,within:node.within?append(node.within,level+1):outer}};base=append(base,depth);let size=0;for(let node=base;node;node=node.within)if(++size>9)failR3('INVALID_PUBLIC_QUERY')}return freezeR3(base);
 }
 const kind=input.kind??input.by,allowed=kind==='role'?['role','name']:kind==='text'?['text']:kind==='form-control-label'?['label']:null;
 if(!allowed||input.kind!==undefined&&input.by!==undefined)failR3('INVALID_PUBLIC_QUERY');fieldsR3(input,[input.kind!==undefined?'kind':'by',...allowed,'exact','within'],'PRIVATE_OR_UNKNOWN_QUERY_FIELD');
 if(input.exact!==undefined&&typeof input.exact!=='boolean')failR3('INVALID_PUBLIC_QUERY');
 const primary=kind==='form-control-label'?'label':kind;if(typeof input[primary]!=='string'||!input[primary]||input[primary].length>4096||ownR3(input,'name')&&(typeof input.name!=='string'||input.name.length>4096))failR3('INVALID_PUBLIC_QUERY');
 return freezeR3({by:kind,...Object.fromEntries(allowed.filter(k=>ownR3(input,k)).map(k=>[k,input[k]])),exact:input.exact??true,...(input.within?{within:publicLocatorR3(input.within,catalog,stack,depth+1)}:{})});
}
export function originalExpectationR3(e){if(!['eq','includes','notIncludes','between'].includes(e?.cmp))failR3('R3_ABSOLUTE_EXPECTATION_REQUIRED');validateMeasurementExpectation(e);digestR3(e);return copyR3(e)}
const OBS={value:['kind','targetRef'],text:['kind','targetRef'],count:['kind','targetRef'],enabled:['kind','targetRef'],attribute:['kind','targetRef','attribute'],rect:['kind','targetRef','field'],withinViewport:['kind','targetRef','axis','tolerance'],gap:['kind','targetRef','otherRef','axis','meaning'],order:['kind','targetRef','itemRefs','axis','rowTolerance'],grid:['kind','targetRef','itemRefs','field','rowTolerance','geometryTolerance'],overflow:['kind','axis'],documentHorizontalOverflow:['kind'],documentOverflow:['kind','axis']};
export function observationRefsR3(o){return[...new Set([o.targetRef,o.otherRef,...(o.itemRefs??[])].filter(x=>x!==undefined))]}
export function validateObservationR3(o,catalog){
 const allowed=OBS[o?.kind];if(!allowed)failR3('R3_OBSERVATION_DOMAIN_UNSUPPORTED',String(o?.kind));fieldsR3(o,allowed,'INVALID_R3_OBSERVATION');
 if(allowed.includes('targetRef')&&(!['grid','order'].includes(o.kind)||ownR3(o,'targetRef'))&&(typeof o.targetRef!=='string'||!ownR3(catalog,o.targetRef)))failR3('PUBLIC_TARGET_REFERENCE_UNKNOWN');
 if(allowed.includes('otherRef')&&o.meaning!=='computed-css-gap'&&(typeof o.otherRef!=='string'||!ownR3(catalog,o.otherRef)||o.otherRef===o.targetRef))failR3('PUBLIC_TARGET_REFERENCE_UNKNOWN');
 if(allowed.includes('itemRefs')&&(!Array.isArray(o.itemRefs)||!o.itemRefs.length||o.itemRefs.length>100||new Set(o.itemRefs).size!==o.itemRefs.length||o.itemRefs.some(r=>typeof r!=='string'||!ownR3(catalog,r))))failR3('INVALID_R3_ITEM_REFS');
 if(o.kind==='attribute'&&(typeof o.attribute!=='string'||!o.attribute||o.attribute.length>128))failR3('INVALID_R3_ATTRIBUTE');
 if(o.kind==='rect'&&!['width','height','x','y','right','bottom'].includes(o.field))failR3('INVALID_R3_RECT_FIELD');
 if(o.kind==='gap'&&!['x','y'].includes(o.axis))failR3('INVALID_R3_GAP_AXIS');
 if(o.kind==='order'&&!['row-major','dom','css-order','visual-x','visual-y'].includes(o.axis))failR3('INVALID_R3_ORDER_AXIS');
 if(o.kind==='order'&&o.axis==='row-major'&&o.rowTolerance!==0.5)failR3('PUBLIC_VISUAL_ORDER_TOLERANCE_MISMATCH');
 if(o.kind==='grid'&&!['rowCounts','columns','rows','visualMatrix','widthSpread','columnGap','rowGap','columnTracks','rowTracks'].includes(o.field))failR3('INVALID_R3_GRID_FIELD');
 if(o.kind==='withinViewport'&&(!['x','y','both'].includes(o.axis)||!finiteR3(o.tolerance)||o.tolerance<0))failR3('INVALID_R3_VIEWPORT_OBSERVATION');
 if(['overflow','documentOverflow'].includes(o.kind)&&!['x','y'].includes(o.axis))failR3('INVALID_R3_OVERFLOW_AXIS');
 for(const k of ['rowTolerance','geometryTolerance'])if(ownR3(o,k)&&(!finiteR3(o[k])||o[k]<0||o[k]>100))failR3('INVALID_R3_GEOMETRY_TOLERANCE');
 if((o.kind==='grid'||o.kind==='order'&&o.axis==='row-major')&&!ownR3(o,'rowTolerance'))failR3('EXPLICIT_ROW_TOLERANCE_REQUIRED');
 if(o.kind==='grid'&&!ownR3(o,'geometryTolerance'))failR3('EXPLICIT_GRID_TOLERANCE_REQUIRED');
 if(o.kind==='gap'&&ownR3(o,'meaning')&&!['border-box-separation','computed-css-gap'].includes(o.meaning))failR3('INVALID_R3_GAP_MEANING');
 if(o.kind==='grid'&&['columnGap','rowGap','columnTracks','rowTracks'].includes(o.field)&&!o.targetRef)failR3('CSS_GRID_CONTAINER_REQUIRED');
 return copyR3(o);
}
export const evaluationCheckKeyR3=(scenario,viewportName,stepIndex,id)=>JSON.stringify([scenario.suiteId??'suite',scenario.id,viewportName,stepIndex,id]);
export function expandCheckpointsR3({scenarios,viewports,defaults,catalog}){
 const checkpoints=[],runs=[];
 for(const [scenarioIndex,s]of scenarios.entries())for(const viewportName of s.viewport==='both'?['desktop','mobile']:[s.viewport]){
  const runKey=JSON.stringify([s.suiteId??'suite',s.id,viewportName]),initialViewport=viewportR3(viewports[viewportName]);let viewport={...initialViewport};const expanded=[],replay=[];
  const append=(index,id,observation,autoOverflow=false)=>{const c={key:evaluationCheckKeyR3(s,viewportName,index,id),runKey,scenarioIndex,scenarioId:s.id,suiteId:s.suiteId??'suite',viewportName,stepIndex:index,checkId:id,observation,viewport:{...viewport},replay:copyR3(replay),autoOverflow};checkpoints.push(c);expanded.push({type:'check',checkpoint:c})};
  for(const [index,step]of s.steps.entries()){
   if(step.op==='observe'){append(index,step.id,copyR3(step.observation));if(s.assertNoHorizontalOverflow)append(index,'$overflow:'+step.id,{kind:'overflow',axis:'x'},true)}
   else{expanded.push({type:'action',stepIndex:index,step:copyR3(step)});replay.push({...copyR3(step),...(step.targetRef?{locator:publicLocatorR3(catalog[step.targetRef],catalog)}:{})});if(step.op==='setViewport')viewport={width:step.width,height:step.height}}
  }
  if(s.assertNoHorizontalOverflow)append(s.steps.length,'$overflow:end',{kind:'overflow',axis:'x'},true);
  runs.push({runKey,scenarioIndex,scenarioId:s.id,viewportName,initialViewport,expanded});
 }
 return{checkpoints,runs};
}
export function deriveExpectedKeysR3(plan){return expandCheckpointsR3(plan).checkpoints.map(c=>c.key)}
const validatedPlansR3=new WeakSet();
export function validateEvaluationPlanR3(input){
 if(validatedPlansR3.has(input))return input;
 fieldsR3(input,['schemaVersion','id','catalog','viewports','scenarios','defaults','expectedKeys','requirements'],'INVALID_R3_PLAN');
 if(input.schemaVersion!==PLAN_SCHEMA_R3||typeof input.id!=='string'||!input.id)failR3('R3_PLAN_SCHEMA_REQUIRED');
 if(!input.catalog||Object.getPrototypeOf(input.catalog)!==Object.prototype)failR3('PUBLIC_CATALOG_REQUIRED');
 const catalog=Object.fromEntries(Object.entries(input.catalog).map(([ref,l])=>{if(!ref||ref.length>128)failR3('INVALID_PUBLIC_REFERENCE');return[ref,publicLocatorR3(l,input.catalog,[ref])]}));
 fieldsR3(input.viewports,['desktop','mobile'],'INVALID_R3_VIEWPORTS');for(const v of Object.values(input.viewports))viewportR3(v);
 fieldsR3(input.defaults,['documentOverflowTolerancePx'],'INVALID_R3_DEFAULTS');if(!finiteR3(input.defaults.documentOverflowTolerancePx)||input.defaults.documentOverflowTolerancePx<0||input.defaults.documentOverflowTolerancePx>100)failR3('EXPLICIT_OVERFLOW_TOLERANCE_REQUIRED');
 if(!Array.isArray(input.scenarios)||!input.scenarios.length||input.scenarios.length>100)failR3('INVALID_R3_SCENARIOS');const scenarioIds=new Set;
 for(const s of input.scenarios){
  fieldsR3(s,['id','suiteId','viewport','freshReload','assertNoHorizontalOverflow','steps'],'INVALID_R3_SCENARIO');const id=JSON.stringify([s.suiteId??'suite',s.id]);
  if(typeof s.id!=='string'||!s.id||scenarioIds.has(id)||s.freshReload!==true||typeof s.assertNoHorizontalOverflow!=='boolean'||!['desktop','mobile','both'].includes(s.viewport)||!Array.isArray(s.steps)||!s.steps.length||s.steps.length>500)failR3('INVALID_R3_SCENARIO');scenarioIds.add(id);
  for(const v of s.viewport==='both'?['desktop','mobile']:[s.viewport])if(!input.viewports[v])failR3('VIEWPORT_UNAVAILABLE');
  const ids=new Set;for(const step of s.steps){
   if(step.op==='observe'){fieldsR3(step,['op','id','observation'],'PRIVATE_EXPECTATION_IN_PUBLIC_OBSERVE_STEP');if(typeof step.id!=='string'||!step.id||step.id.startsWith('$')||ids.has(step.id))failR3('DUPLICATE_OR_RESERVED_CHECK_ID');ids.add(step.id);validateObservationR3(step.observation,catalog)}
   else if(['click','fill','key'].includes(step.op)){fieldsR3(step,['op','targetRef',...(step.op==='fill'?['value']:step.op==='key'?['key']:[])],'INVALID_R3_ACTION');if(typeof step.targetRef!=='string'||!ownR3(catalog,step.targetRef)||step.op==='fill'&&typeof step.value!=='string'||step.op==='key'&&typeof step.key!=='string')failR3('INVALID_R3_ACTION')}
   else if(step.op==='reload'){fieldsR3(step,['op','state'],'INVALID_R3_RELOAD');if(step.state!=='reset-to-source')failR3('EXPLICIT_RELOAD_RESET_REQUIRED')}
   else if(step.op==='setViewport'){fieldsR3(step,['op','width','height','state'],'INVALID_R3_VIEWPORT_ACTION');viewportR3({width:step.width,height:step.height});if(step.state!=='preserve')failR3('EXPLICIT_VIEWPORT_PRESERVE_REQUIRED')}
   else failR3('R3_ACTION_DOMAIN_UNSUPPORTED',String(step.op));
  }
  if(!ids.size)failR3('SCENARIO_HAS_NO_OBSERVATIONS');
 }
 const expanded=expandCheckpointsR3(input),planned=expanded.checkpoints.map(c=>c.key);
 if(!Array.isArray(input.expectedKeys)||input.expectedKeys.some(k=>typeof k!=='string')||new Set(input.expectedKeys).size!==input.expectedKeys.length||!isDeepStrictEqual([...input.expectedKeys].sort(),[...planned].sort()))failR3('INDEPENDENT_COMPLETE_EXPECTED_KEYS_REQUIRED');
 fieldsR3(input.requirements,['targets','originals','protections','reachability','excludeNoopFromG'],'INVALID_R3_REQUIREMENTS');const r=copyR3(input.requirements);
 if(typeof r.excludeNoopFromG!=='boolean')failR3('EXPLICIT_G_NOOP_POLICY_REQUIRED');if(r.excludeNoopFromG!==false)failR3('PRIMARY_G_NOOP_EXCLUSION_FORBIDDEN');
 for(const name of ['targets','originals','protections','reachability']){if(!Array.isArray(r[name])||new Set(r[name].map(x=>x.key)).size!==r[name].length)failR3('INVALID_R3_REQUIREMENT_KEYS',name);for(const x of r[name])if(!planned.includes(x.key))failR3('UNKNOWN_R3_REQUIREMENT_KEY',x.key)}
 if(!r.targets.length||!r.originals.length||!r.reachability.length)failR3('TARGET_ORIGINAL_REACHABILITY_REQUIREMENTS_REQUIRED');
 for(const name of ['targets','originals'])for(const x of r[name]){fieldsR3(x,['key','expect'],'INVALID_R3_ABSOLUTE_REQUIREMENT');originalExpectationR3(x.expect)}
 for(const x of r.protections){fieldsR3(x,['key','mode','expect','tolerance'],'INVALID_R3_PROTECTION');if(!['preserve','nonWorsening'].includes(x.mode)||!finiteR3(x.tolerance)||x.tolerance<0||r.targets.some(t=>t.key===x.key))failR3('INVALID_R3_PROTECTION');if(x.mode==='nonWorsening')originalExpectationR3(x.expect);else if(ownR3(x,'expect'))failR3('PRESERVE_EXPECTATION_FORBIDDEN')}
 for(const x of r.reachability){fieldsR3(x,['key','mode','expect'],'INVALID_R3_REACHABILITY');if(!['available','predicate'].includes(x.mode))failR3('INVALID_R3_REACHABILITY');if(x.mode==='predicate')originalExpectationR3(x.expect);else if(ownR3(x,'expect'))failR3('AVAILABLE_EXPECTATION_FORBIDDEN')}
 const rRunKeys=new Set(expanded.checkpoints.filter(c=>[...r.targets,...r.protections,...r.reachability].some(x=>x.key===c.key)).map(c=>c.runKey));
 for(const c of expanded.checkpoints.filter(c=>c.autoOverflow)){
  const expect={cmp:'between',min:0,max:input.defaults.documentOverflowTolerancePx};
  if(r.targets.some(x=>x.key===c.key))failR3('AUTO_OVERFLOW_TARGET_OVERRIDE_FORBIDDEN');
  const old=r.originals.find(x=>x.key===c.key);if(old&&!isDeepStrictEqual(old.expect,expect))failR3('AUTO_OVERFLOW_EXPECTATION_OVERRIDE_FORBIDDEN');if(!old)r.originals.push({key:c.key,expect});
  if(rRunKeys.has(c.runKey)){const old=r.protections.find(x=>x.key===c.key);const value={key:c.key,mode:'nonWorsening',expect,tolerance:0};if(old&&!isDeepStrictEqual(old,value))failR3('AUTO_OVERFLOW_PROTECTION_OVERRIDE_FORBIDDEN');if(!old)r.protections.push(value)}
 }
 const covered=new Set([...r.targets,...r.originals,...r.protections,...r.reachability].map(x=>x.key));if(planned.some(k=>!covered.has(k)))failR3('UNASSIGNED_DECLARED_OBSERVATION');
 const plan={...copyR3(input),catalog,requirements:r};const planDigest=digestR3(plan);const normalized=freezeR3({...plan,...expanded,planDigest});validatedPlansR3.add(normalized);return normalized;
}

export function evaluationProvenanceR3({plan,checkpoint,sourceSha256,runId,calibration,environment,policy}={}){
 if(!validHashR3(sourceSha256)||typeof runId!=='string'||!runId||!checkpoint?.key||!plan?.planDigest)failR3('R3_PROVENANCE_INPUT_REQUIRED');
 return{sourceSha256,runId,planDigest:plan.planDigest,replayDigest:digestR3(checkpoint.replay),catalogDigest:digestR3(plan.catalog),
  observationDigest:digestR3({observation:checkpoint.observation,locators:observationRefsR3(checkpoint.observation).map(ref=>[ref,plan.catalog[ref]])}),
  viewportDigest:digestR3(checkpoint.viewport),observerSha256:calibration.observerSha256,observerRevision:calibration.observerRevision,
  calibrationPolicyId:calibration.policyId,calibrationBindingDigest:digestR3(calibration),measurementPolicyDigest:digestR3(validateMeasurementPolicy(policy)),
  checkpointKey:checkpoint.key,entryContract:environment.entryContract,environmentDigest:digestR3(environment)};
}
// Bridge the public v1.1 vocabulary to explicit Node-private scalar projections.
// Projection declares WHAT is measured, never the expected value. No inference from expected predicates.
function publicQueriesR3(catalog,queries,namespace){
 if(typeof namespace!=='string'||!namespace||namespace.length>128)failR3('PUBLIC_QUERY_NAMESPACE_REQUIRED');
 const result=copyR3(catalog),refs=[];for(const[index,query]of queries.entries()){const ref=namespace+':q'+index;if(ownR3(result,ref))failR3('PUBLIC_QUERY_NAMESPACE_COLLISION');result[ref]=publicLocatorR3(query,catalog);refs.push(ref)}return{catalog:result,refs};
}
export function compilePublicProbeR3(probe,{catalog={},projection={},namespace}={}){
 fieldsR3(probe,['kind','query','queries','attribute','axis','orderBasis','gridClusterTolerancePx'],'PRIVATE_OR_UNKNOWN_PUBLIC_PROBE_FIELD');
 fieldsR3(projection,['field','tolerance','geometryTolerance'],'PRIVATE_OR_UNKNOWN_PROJECTION_FIELD');
 const known=['value','text','count','enabled','attribute','rect','withinViewport','gap','grid','order','documentOverflow'];if(!known.includes(probe.kind))failR3('UNSUPPORTED_PUBLIC_PROBE_KIND');
 const many=['gap','grid','order'].includes(probe.kind),overflow=probe.kind==='documentOverflow';
 if(many&&(!Array.isArray(probe.queries)||!probe.queries.length)||!many&&!overflow&&!probe.query||!many&&probe.queries!==undefined||overflow&&(probe.query!==undefined||probe.queries!==undefined))failR3('PUBLIC_PROBE_QUERIES_REQUIRED');
 if(probe.kind==='gap'&&(probe.queries.length!==2||probe.query!==undefined||!['horizontal','vertical'].includes(probe.axis)))failR3('PUBLIC_GAP_TWO_QUERIES_AND_AXIS_REQUIRED');
 if(probe.kind==='order'&&(probe.query!==undefined||!['visual','dom'].includes(probe.orderBasis)))failR3('PUBLIC_ORDER_BASIS_REQUIRED');
 if(probe.kind==='grid'&&(!finiteR3(probe.gridClusterTolerancePx)||probe.gridClusterTolerancePx<0||!ownR3(projection,'field')||!finiteR3(projection.geometryTolerance)||projection.geometryTolerance<0))failR3('PUBLIC_GRID_EXPLICIT_PROJECTION_REQUIRED');
 if(probe.axis!==undefined&&!['gap','withinViewport','documentOverflow'].includes(probe.kind)||probe.attribute!==undefined&&probe.kind!=='attribute'||probe.orderBasis!==undefined&&probe.kind!=='order'||probe.gridClusterTolerancePx!==undefined&&probe.kind!=='grid')failR3('PUBLIC_PROBE_FIELD_DOMAIN_MISMATCH');
 if(Object.keys(projection).some(k=>!(probe.kind==='rect'?['field']:probe.kind==='grid'?['field','geometryTolerance']:probe.kind==='withinViewport'?['tolerance']:[]).includes(k)))failR3('PUBLIC_PROJECTION_DOMAIN_MISMATCH');
 const queries=overflow?[]:many?[...(probe.query?[probe.query]:[]),...probe.queries]:[probe.query],resolved=publicQueriesR3(catalog,queries,namespace),refs=resolved.refs;let observation;
 if(probe.kind==='gap')observation={kind:'gap',targetRef:refs[0],otherRef:refs[1],axis:probe.axis==='horizontal'?'x':'y',meaning:'border-box-separation'};
 else if(probe.kind==='grid')observation={kind:'grid',...(probe.query?{targetRef:refs[0]}:{}),itemRefs:probe.query?refs.slice(1):refs,field:projection.field,rowTolerance:probe.gridClusterTolerancePx,geometryTolerance:projection.geometryTolerance};
 else if(probe.kind==='order')observation={kind:'order',itemRefs:refs,axis:probe.orderBasis==='dom'?'dom':'row-major',...(probe.orderBasis==='visual'?{rowTolerance:.5}:{})};
 else if(overflow)observation={kind:'documentOverflow',axis:probe.axis==='vertical'?'y':'x'};
 else observation={kind:probe.kind,targetRef:refs[0],...(probe.kind==='attribute'?{attribute:probe.attribute}:probe.kind==='rect'?{field:projection.field}:probe.kind==='withinViewport'?{axis:probe.axis===undefined?'both':probe.axis==='horizontal'?'x':'y',tolerance:projection.tolerance}:{})};
 if(probe.axis!==undefined&&!['horizontal','vertical'].includes(probe.axis))failR3('PUBLIC_AXIS_INVALID');validateObservationR3(observation,resolved.catalog);return freezeR3({catalog:resolved.catalog,observation});
}
export function compilePublicActionR3(action,{catalog={},namespace}={}){
 fieldsR3(action,['type','query','value','key','viewport'],'PRIVATE_OR_UNKNOWN_PUBLIC_ACTION_FIELD');
 const op=action.type;if(!['click','fill','key','reload','setViewport'].includes(op))failR3('UNSUPPORTED_PUBLIC_ACTION');
 if(Object.keys(action).some(k=>!(op==='fill'?['type','query','value']:op==='key'?['type','query','key']:op==='click'?['type','query']:op==='setViewport'?['type','viewport']:['type']).includes(k)))failR3('PUBLIC_ACTION_FIELD_DOMAIN_MISMATCH');
 if(op==='reload')return freezeR3({catalog:copyR3(catalog),step:{op,state:'reset-to-source'}});
 if(op==='setViewport'){viewportR3(action.viewport);return freezeR3({catalog:copyR3(catalog),step:{op,...copyR3(action.viewport),state:'preserve'}})}
 if(op==='fill'&&typeof action.value!=='string'||op==='key'&&typeof action.key!=='string')failR3('PUBLIC_ACTION_PAYLOAD_REQUIRED');
 const resolved=publicQueriesR3(catalog,[action.query],namespace);return freezeR3({catalog:resolved.catalog,step:{op,targetRef:resolved.refs[0],...(op==='fill'?{value:action.value}:op==='key'?{key:action.key}:{})}});
}