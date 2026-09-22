// Node-only projections of coherent native facts. Visible box spacing/grid are not CSS implementation gates.
import {FACT_SCHEMA_VERSION_R3,validateFactR3} from './measurement-r3.mjs';
import {deriveGapFacts,deriveGridFacts,deriveOrderFacts,deriveDocumentOverflowFacts,deriveBoxGapFacts,deriveVisualGridFacts,deriveQueryOrderFacts} from './layout-facts-r3.mjs';
import {validateObservationR3,observationRefsR3,copyR3,finiteR3,failR3,digestR3} from './evaluation-plan-r3.mjs';
function rect(n){const r=n?.layout?.bounds??n?.boundingRect;if((n?.layout?.visible??n?.visible)!==true||!r||!['x','y','width','height'].every(k=>finiteR3(r[k]))||r.width<=0||r.height<=0)failR3('NATIVE_VISIBLE_RECT_UNAVAILABLE');return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.x+r.width,bottom:r.y+r.height}}
function rows(items,tolerance){const ordered=[...items].sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x||a.node.nodeIndex-b.node.nodeIndex),result=[];for(const item of ordered){const last=result.at(-1);if(last&&item.rect.y-last.anchorY<=tolerance)last.items.push(item);else result.push({anchorY:item.rect.y,items:[item]})}for(const row of result)row.items.sort((a,b)=>a.rect.x-b.rect.x||a.node.nodeIndex-b.node.nodeIndex);return result}
function selected(result,targets){
 if(result.state!=='ok')failR3(result.error?.code??'NATIVE_FACTS_UNAVAILABLE',result.error?.message??'');
 if(result.facts?.schemaVersion!=='v04-layout-facts-r3-1'||result.evidence?.singleSnapshot!==true||result.evidence?.axBracketStable!==true||typeof result.identity?.frameId!=='string')failR3('COHERENT_NATIVE_SNAPSHOT_REQUIRED');
 if(!Array.isArray(result.facts.targets)||result.facts.targets.length!==targets.length)failR3('NATIVE_TARGET_SET_MISMATCH');
 const map=new Map;for(const query of targets){const list=result.facts.targets.filter(t=>t.key===query.key);if(list.length!==1)failR3('NATIVE_TARGET_SET_MISMATCH');const t=list[0];
  if(!Number.isInteger(t.matchCount)||t.matchCount<0||!Array.isArray(t.nodes)||t.nodes.length!==t.matchCount)failR3('INVALID_NATIVE_MATCH_COUNT');
  if(t.nodes.some(n=>!Number.isInteger(n.backendNodeId)||n.backendNodeId<=0)||new Set(t.nodes.map(n=>n.backendNodeId)).size!==t.nodes.length)failR3('NATIVE_TARGET_IDENTITY_UNAVAILABLE');
  let depth=0;for(let q=query.locator.within;q;q=q.within)depth++;if(!Array.isArray(t.contextBackendNodeIds)||t.contextBackendNodeIds.length!==depth||t.contextBackendNodeIds.some(id=>!Number.isInteger(id)||id<=0))failR3('NATIVE_CONTEXT_IDENTITY_UNAVAILABLE');map.set(query.ref,t);
 }return map;
}
function unique(map,ref){const t=map.get(ref);if(!t||t.matchCount!==1)failR3('OBSERVATION_LOCATOR_NOT_UNIQUE',ref);if((t.nodes[0].layout?.visible??t.nodes[0].visible)!==true)failR3('OBSERVATION_TARGET_NOT_VISIBLE',ref);return t.nodes[0]}
function documentMetrics(result){const d=result.facts.document,v=d?.layoutViewport;if(!d||!v||![d.contentWidth,d.contentHeight,v.width,v.height,v.pageX,v.pageY].every(finiteR3)||v.width<=0||v.height<=0)failR3('NATIVE_DOCUMENT_METRICS_UNAVAILABLE');return{contentWidth:d.contentWidth,contentHeight:d.contentHeight,width:v.width,height:v.height,pageX:v.pageX,pageY:v.pageY}}
export function publicFactTargetsR3(observation,catalog){validateObservationR3(observation,catalog);return observationRefsR3(observation).map((ref,index)=>({key:'t'+index,ref,locator:copyR3(catalog[ref])}))}
export function deriveObservationFactR3({result,observation,catalog,viewport}){
 const targets=publicFactTargetsR3(observation,catalog),map=selected(result,targets),errors=[],geometry=[],stability={kind:observation.kind},diagnostics={};let value;
 const key=ref=>targets.find(t=>t.ref===ref)?.key;
 const addRect=n=>{const r=rect(n);geometry.push(r.x,r.y,r.width,r.height);return r};
 const error=(location,code,magnitude)=>errors.push({category:'layout',location,code,...(magnitude===undefined?{}:{magnitude})});
 const overflow=['overflow','documentOverflow','documentHorizontalOverflow'].includes(observation.kind);
 if(overflow){const native=deriveDocumentOverflowFacts(result);if(native.state!=='ok')failR3(native.error.code,native.error.message);const d=documentMetrics(result);geometry.push(d.contentWidth,d.contentHeight,d.width,d.height,d.pageX,d.pageY);value=(observation.axis??'x')==='x'?native.facts.horizontalPx:native.facts.verticalPx;diagnostics.document=native.facts}
 else if(observation.kind==='count'){value=map.get(observation.targetRef).matchCount;stability.members=map.get(observation.targetRef).nodes.map(n=>n.backendNodeId).sort((a,b)=>a-b)}
 else if(['order','grid'].includes(observation.kind)){
  const container=observation.targetRef?unique(map,observation.targetRef):null,containerRect=container?addRect(container):null,items=[];
  for(const ref of observation.itemRefs){const t=map.get(ref);if(t.matchCount!==1)failR3('OBSERVATION_LOCATOR_NOT_UNIQUE',ref);const node=t.nodes[0];if(!Number.isInteger(node.nodeIndex)||!Number.isInteger(node.documentIndex))failR3('NATIVE_DOM_ORDER_UNAVAILABLE');items.push({ref,node,rect:addRect(node)})}
  if(new Set(items.map(x=>x.node.backendNodeId)).size!==items.length)failR3('LAYOUT_QUERY_IDENTITIES_NOT_DISTINCT');const grouped=rows(items,observation.rowTolerance??0);stability.itemRefs=items.map(x=>x.ref);
  if(container){diagnostics.cssGrid=deriveGridFacts(result,{containerKey:key(observation.targetRef),itemKeys:items.map(x=>key(x.ref))});diagnostics.orders=deriveOrderFacts(result,{containerKey:key(observation.targetRef),itemKeys:items.map(x=>key(x.ref))})}
  if(observation.kind==='order'){
   if(['dom','row-major'].includes(observation.axis)){const native=deriveQueryOrderFacts(result,{itemKeys:items.map(x=>key(x.ref)),orderBasis:observation.axis==='dom'?'dom':'visual'});if(native.state!=='ok')failR3(native.error.code,native.error.message);const refs=new Map(targets.map(t=>[t.key,t.ref]));value=native.facts.orderedKeys.map(k=>refs.get(k));diagnostics.queryOrder=native.facts;}
   else if(observation.axis==='css-order'){if(!container||diagnostics.orders.state!=='ok'||diagnostics.orders.facts.cssOrderApplies!==true)failR3('DECLARED_CSS_ORDER_UNAVAILABLE');const refs=new Map(targets.map(t=>[t.key,t.ref]));value=diagnostics.orders.facts.cssOrderModified.map(k=>refs.get(k))}
   else{let ordered=observation.axis==='row-major'?grouped.flatMap(r=>r.items):[...items].sort((a,b)=>observation.axis==='visual-x'?a.rect.x-b.rect.x||a.rect.y-b.rect.y:a.rect.y-b.rect.y||a.rect.x-b.rect.x);for(let i=1;i<ordered.length;i++)if(ordered[i].rect.x===ordered[i-1].rect.x&&ordered[i].rect.y===ordered[i-1].rect.y)failR3('VISUAL_ORDER_TIE');value=ordered.map(x=>x.ref)}
   stability.orderBasis=observation.axis;
  }else{
   const tolerance=observation.geometryTolerance;const visual=deriveVisualGridFacts(result,{itemKeys:items.map(x=>key(x.ref)),gridClusterTolerancePx:observation.rowTolerance});if(visual.state!=='ok')failR3(visual.error.code,visual.error.message);diagnostics.visualGrid=visual.facts;
   for(const item of items)if(container){if(!Array.isArray(item.node.ancestorBackendNodeIds))failR3('SAME_SNAPSHOT_ANCESTRY_UNAVAILABLE');if(!item.node.ancestorBackendNodeIds.includes(container.backendNodeId))error(observation.targetRef+'/'+item.ref,'ITEM_OUTSIDE_DECLARED_SCOPE');const excess=Math.max(0,containerRect.x-item.rect.x,item.rect.right-containerRect.right);if(excess>tolerance)error(observation.targetRef+'/'+item.ref,'BOX_HORIZONTAL_OUTSIDE_CONTAINER',excess)}
   for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j],x=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.x,b.rect.x),y=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.y,b.rect.y);if(x>tolerance&&y>tolerance){error(a.ref+'<->'+b.ref,'VISUAL_GRID_HORIZONTAL_BOX_INTERSECTION',x);error(a.ref+'<->'+b.ref,'VISUAL_GRID_VERTICAL_BOX_INTERSECTION',y)}}
   if(['columnGap','rowGap','columnTracks','rowTracks'].includes(observation.field)){const native=diagnostics.cssGrid;if(native?.state!=='ok')failR3(native?.error?.code??'CSS_GRID_PROJECTION_UNAVAILABLE');value=observation.field==='columnGap'?native.facts.columnGapPx:observation.field==='rowGap'?native.facts.rowGapPx:observation.field==='columnTracks'?native.facts.columnSizesPx:native.facts.rowSizesPx;geometry.push(...native.facts.columnSizesPx,...native.facts.rowSizesPx);stability.projection='explicit-native-css-grid'}
   else{if(observation.field==='widthSpread'&&!items.length)failR3('EMPTY_GRID_WIDTH_SPREAD');value=observation.field==='rowCounts'?grouped.map(r=>r.items.length):observation.field==='columns'?visual.facts.columnCount:observation.field==='rows'?visual.facts.rowCount:observation.field==='visualMatrix'?grouped.map(r=>r.items.map(x=>x.ref)):Math.max(...items.map(x=>x.rect.width))-Math.min(...items.map(x=>x.rect.width));stability.projection='visible-box-row-clustering-no-css-grid-requirement'}
  }
 }else{
  const n=unique(map,observation.targetRef);
  if(observation.kind==='value'){const s=typeof n.valueState==='string'?n.valueState:n.valueState?.status;if(s!=='available'||typeof n.value!=='string'||n.rawPresence?.snapshotNode!==true||n.rawPresence?.axNode!==true||n.rawPresence?.axIgnored!==false||n.rawPresence?.hasLayout!==true)failR3(typeof n.valueError==='string'?n.valueError:n.valueError?.code??'NATIVE_VALUE_UNAVAILABLE');value=n.value}
  else if(observation.kind==='text'){if(typeof n.text!=='string')failR3('NATIVE_TEXT_UNAVAILABLE');value=n.text}
  else if(observation.kind==='enabled'){if(typeof n.enabled!=='boolean')failR3('NATIVE_ENABLED_UNAVAILABLE');value=n.enabled}
  else if(observation.kind==='attribute'){if(!n.attributes||typeof n.attributes!=='object'||Array.isArray(n.attributes))failR3('NATIVE_ATTRIBUTES_UNAVAILABLE');value=Object.prototype.hasOwnProperty.call(n.attributes,observation.attribute)?n.attributes[observation.attribute]:null;if(value!==null&&typeof value!=='string')failR3('NATIVE_ATTRIBUTE_ENCODING_UNSUPPORTED')}
  else if(observation.kind==='gap'&&observation.meaning==='computed-css-gap'){const native=deriveGapFacts(result,{containerKey:key(observation.targetRef)});if(native.state!=='ok')failR3(native.error.code,native.error.message);addRect(n);value=observation.axis==='x'?native.facts.columnPx:native.facts.rowPx;diagnostics.computedGap=native.facts;stability.meaning='computed-css-gap-explicit-not-visible-box-distance'}
  else{const r=addRect(n);
   if(observation.kind==='rect')value=r[observation.field];
   else if(observation.kind==='gap'){if(n.backendNodeId===unique(map,observation.otherRef).backendNodeId)failR3('LAYOUT_QUERY_IDENTITIES_NOT_DISTINCT');addRect(unique(map,observation.otherRef));const native=deriveBoxGapFacts(result,{fromKey:key(observation.targetRef),toKey:key(observation.otherRef),axis:observation.axis==='x'?'horizontal':'vertical'});if(native.state!=='ok')failR3(native.error.code,native.error.message);value=native.facts.separationPx;stability.meaning='symmetric-visible-box-axis-clearance-css-px';diagnostics.boxGap=native.facts;}
   else if(observation.kind==='withinViewport'){const d=documentMetrics(result),t=observation.tolerance;geometry.push(d.width,d.height,d.pageX,d.pageY);const x=r.x>=d.pageX-t&&r.right<=d.pageX+d.width+t,y=r.y>=d.pageY-t&&r.bottom<=d.pageY+d.height+t;value=observation.axis==='x'?x:observation.axis==='y'?y:x&&y}
   else failR3('R3_OBSERVATION_DOMAIN_UNSUPPORTED');
  }
 }
 errors.sort((a,b)=>(a.category+'|'+a.location+'|'+a.code).localeCompare(b.category+'|'+b.location+'|'+b.code));
 const fact={schemaVersion:FACT_SCHEMA_VERSION_R3,value,geometry:geometry.length?geometry:null,errors,stability};validateFactR3(fact);
 return{fact,targets:targets.map(t=>({key:t.key,ref:t.ref,backendNodeIds:map.get(t.ref).nodes.map(n=>n.backendNodeId),contextBackendNodeIds:copyR3(map.get(t.ref).contextBackendNodeIds)})),evidence:{observationDigest:digestR3(observation),viewport:copyR3(viewport),coordinateSpace:'document-css',semanticErrorPolicy:'category-location-code-multiset-plus-numeric-magnitude',nativeLayoutDiagnostics:diagnostics,rawPresence:observation.kind==='value'?copyR3(unique(map,observation.targetRef).rawPresence):null}};
}
