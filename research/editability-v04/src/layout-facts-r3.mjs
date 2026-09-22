// F1 public native-layout fact decoding. No page code and no expected values enter here.
export const LAYOUT_FACTS_SCHEMA='v04-layout-facts-r3-1';
export const DOMAIN_RULES=Object.freeze({schema:'v04-domain-rules-r3-1',factsSchema:LAYOUT_FACTS_SCHEMA,snapshot:'single-DOMSnapshot-layout-with-stable-AX-and-viewport-brackets',gap:'visible-border-box-axis-clearance',grid:'visual-top-left-complete-link-clusters',order:'physical-top-to-bottom-left-to-right',orderTolerancePx:0.5,runtimeJournal:'CDP-native-error-stream-before-execution',nativeCSSDiagnostics:true,viewport:'preserve-document-and-state',reload:'reset-source-state-new-document'});
export const LAYOUT_COMPUTED_PROPERTIES=Object.freeze(['visibility','display','opacity','color','background-color','font-size','font-weight','font-family','border-radius','position','box-sizing','width','height','min-width','max-width','min-height','max-height','padding-top','padding-right','padding-bottom','padding-left','border-top-width','border-right-width','border-bottom-width','border-left-width','margin-top','margin-right','margin-bottom','margin-left','row-gap','column-gap','grid-template-columns','grid-template-rows','grid-auto-columns','grid-auto-rows','grid-auto-flow','grid-column-start','grid-column-end','grid-row-start','grid-row-end','order','flex-direction','flex-wrap','justify-content','align-content','align-items','align-self','justify-items','justify-self','direction','writing-mode','overflow-x','overflow-y','transform','contain']);
const error=(code,message=code)=>({state:'unknown',error:{code,message}});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function rectFromBounds(bounds){if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(finite))return null;const[x,y,width,height]=bounds;return{x,y,width,height,right:x+width,bottom:y+height}}
export function pixelLength(raw,{normalZero=false}={}){if(normalZero&&raw==='normal')return 0;if(typeof raw!=='string'||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)px$/.test(raw))return null;const n=Number(raw.slice(0,-2));return Number.isFinite(n)?n:null}
export function resolvedTrackSizes(raw){
 if(typeof raw!=='string')return null;if(raw==='none')return[];
 // Computed used tracks are px lengths; optional named grid lines are metadata, not tracks.
 const tokens=raw.replace(/\[[^\]]*\]/g,' ').trim().split(/\s+/).filter(Boolean),sizes=tokens.map(x=>pixelLength(x));
 return tokens.length&&sizes.every(x=>x!==null&&x>=0)?sizes:null;
}
export function snapshotLayoutFacts(snapshot,frameId){
 const strings=snapshot?.strings;if(!Array.isArray(strings)||!Array.isArray(snapshot?.documents))throw Object.assign(new Error('DOMAIN_SNAPSHOT_MALFORMED'),{code:'DOMAIN_SNAPSHOT_MALFORMED'});
 const string=x=>typeof x==='number'?strings[x]:x;
 const document=snapshot.documents.find(d=>string(d.frameId)===frameId);if(!document)throw Object.assign(new Error('DOMAIN_DOCUMENT_MISSING'),{code:'DOMAIN_DOCUMENT_MISSING'});
 const raw=document.nodes,layout=document.layout,byBackendId=new Map,layoutIndices=new Map(layout.nodeIndex.map((ni,i)=>[ni,i]));
 const children=Array.from({length:raw.backendNodeId.length},()=>[]);for(let i=0;i<children.length;i++)if(raw.parentIndex[i]>=0)children[raw.parentIndex[i]].push(i);
 for(let index=0;index<raw.backendNodeId.length;index++){
  const li=layoutIndices.get(index),computed=Object.fromEntries(LAYOUT_COMPUTED_PROPERTIES.map((name,i)=>[name,li===undefined?null:strings[layout.styles?.[li]?.[i]]??null]));
  const attrs=raw.attributes?.[index]??[],attributes=Object.fromEntries(Array.from({length:attrs.length/2},(_,i)=>[strings[attrs[i*2]],strings[attrs[i*2+1]]]));
  const ancestors=[];let visible=li!==undefined;
  for(let i=index;i>=0;i=raw.parentIndex[i]){if(i!==index)ancestors.push(raw.backendNodeId[i]);const styles=layout.styles?.[layoutIndices.get(i)]??[];if(['hidden','collapse'].includes(strings[styles[0]])||strings[styles[2]]==='0')visible=false}
  const bounds=li===undefined?null:rectFromBounds(layout.bounds?.[li]);visible=visible&&!!bounds&&bounds.width>0&&bounds.height>0;
  const node={documentIndex:snapshot.documents.indexOf(document),backendNodeId:raw.backendNodeId[index],nodeIndex:index,nodeType:raw.nodeType[index],tagName:String(strings[raw.nodeName[index]]??'').toLowerCase(),attributes,parentBackendNodeId:raw.parentIndex[index]>=0?raw.backendNodeId[raw.parentIndex[index]]:null,ancestorBackendNodeIds:ancestors,childBackendNodeIds:children[index].map(i=>raw.backendNodeId[i]),elementChildBackendNodeIds:children[index].filter(i=>raw.nodeType[i]===1).map(i=>raw.backendNodeId[i]),computed,layout:{hasLayout:li!==undefined,visible,bounds,coordinateSpace:'document-css',paintOrder:li===undefined?null:layout.paintOrders?.[li]??null,offsetRect:li===undefined?null:rectFromBounds(layout.offsetRects?.[li]),clientRect:li===undefined?null:rectFromBounds(layout.clientRects?.[li]),scrollRect:li===undefined?null:rectFromBounds(layout.scrollRects?.[li])}};
  byBackendId.set(node.backendNodeId,node);
 }
 const root=[...byBackendId.values()].find(n=>n.tagName==='html'),body=[...byBackendId.values()].find(n=>n.tagName==='body');
 return{byBackendId,document:{frameId,contentWidth:document.contentWidth??null,contentHeight:document.contentHeight??null,scrollOffsetX:document.scrollOffsetX??null,scrollOffsetY:document.scrollOffsetY??null,rootBackendNodeId:root?.backendNodeId??null,bodyBackendNodeId:body?.backendNodeId??null,rootBounds:root?.layout.bounds??null,bodyBounds:body?.layout.bounds??null,dimensionsSource:'CDP.DOMSnapshot.DocumentSnapshot'}};
}
function target(capture,key){const t=capture?.facts?.targets?.find(x=>x.key===key);return t?.matchCount===1&&t.nodes[0]?.layout?.visible?t.nodes[0]:null}
function layoutContext(capture,key){const n=target(capture,key);if(!n)return null;return{node:n,display:n.computed.display,writingMode:n.computed['writing-mode'],direction:n.computed.direction,flexDirection:n.computed['flex-direction'],flexWrap:n.computed['flex-wrap'],justifyContent:n.computed['justify-content'],alignContent:n.computed['align-content'],gridAutoFlow:n.computed['grid-auto-flow']}}
export function deriveGapFacts(capture,{containerKey,fromKey,toKey}={}){
 const context=layoutContext(capture,containerKey);if(!context)return error('DOMAIN_TARGET_NOT_UNIQUE');
 if(!['flex','inline-flex','grid','inline-grid'].includes(context.display))return error('DOMAIN_GAP_CONTAINER_NOT_FLEX_OR_GRID');
 const c=context.node.computed,rowPx=pixelLength(c['row-gap'],{normalZero:true}),columnPx=pixelLength(c['column-gap'],{normalZero:true});
 if(rowPx===null||columnPx===null)return error('DOMAIN_GAP_USED_LENGTH_UNAVAILABLE','Computed gaps are not px or calibrated normal-zero; no rect substitute');
 let pair=null;
 if(fromKey!==undefined||toKey!==undefined){const a=target(capture,fromKey),b=target(capture,toKey);if(!a||!b)return error('DOMAIN_TARGET_NOT_UNIQUE');if(a.parentBackendNodeId!==context.node.backendNodeId||b.parentBackendNodeId!==context.node.backendNodeId)return error('DOMAIN_GAP_NOT_DIRECT_SIBLINGS');const ar=a.layout.bounds,br=b.layout.bounds;pair={fromBackendNodeId:a.backendNodeId,toBackendNodeId:b.backendNodeId,horizontalSignedPx:br.x-ar.right,verticalSignedPx:br.y-ar.bottom,fromMargins:{left:a.computed['margin-left'],right:a.computed['margin-right'],top:a.computed['margin-top'],bottom:a.computed['margin-bottom']},toMargins:{left:b.computed['margin-left'],right:b.computed['margin-right'],top:b.computed['margin-top'],bottom:b.computed['margin-bottom']},meaning:'signed border-box separation, NOT a replacement for CSS gap'}}
 return{state:'ok',facts:{kind:'gap',containerBackendNodeId:context.node.backendNodeId,rowPx,columnPx,raw:{row:c['row-gap'],column:c['column-gap']},pair,context}};
}
export function deriveGridFacts(capture,{containerKey,itemKeys=[]}={}){
 const context=layoutContext(capture,containerKey);if(!context)return error('DOMAIN_TARGET_NOT_UNIQUE');if(!['grid','inline-grid'].includes(context.display))return error('DOMAIN_GRID_CONTAINER_NOT_GRID');
 const c=context.node.computed,columns=resolvedTrackSizes(c['grid-template-columns']),rows=resolvedTrackSizes(c['grid-template-rows']);if(columns===null||rows===null)return error('DOMAIN_GRID_TRACKS_UNAVAILABLE','No guessing repeat/minmax/subgrid from bounding rectangles');
 const gap=deriveGapFacts(capture,{containerKey});if(gap.state!=='ok')return gap;
 const items=[];for(const key of itemKeys){const n=target(capture,key);if(!n||n.parentBackendNodeId!==context.node.backendNodeId)return error('DOMAIN_GRID_ITEM_NOT_DIRECT_CHILD');items.push({key,backendNodeId:n.backendNodeId,domNodeIndex:n.nodeIndex,cssOrder:n.computed.order,placement:{columnStart:n.computed['grid-column-start'],columnEnd:n.computed['grid-column-end'],rowStart:n.computed['grid-row-start'],rowEnd:n.computed['grid-row-end']},bounds:n.layout.bounds})}
 return{state:'ok',facts:{kind:'grid',containerBackendNodeId:context.node.backendNodeId,columnCount:columns.length,rowCount:rows.length,columnSizesPx:columns,rowSizesPx:rows,rowGapPx:gap.facts.rowPx,columnGapPx:gap.facts.columnPx,raw:{columns:c['grid-template-columns'],rows:c['grid-template-rows']},items,context,placementMeaning:'computed CSS declarations and same-snapshot rendered boxes; auto is not falsely labelled resolved line index'}};
}
export function deriveOrderFacts(capture,{containerKey,itemKeys=[]}={}){
 const context=layoutContext(capture,containerKey);if(!context)return error('DOMAIN_TARGET_NOT_UNIQUE');if(!itemKeys.length)return error('DOMAIN_ORDER_ITEMS_REQUIRED');
 const items=[];for(const key of itemKeys){const n=target(capture,key),order=Number(n?.computed.order);if(!n||n.parentBackendNodeId!==context.node.backendNodeId)return error('DOMAIN_ORDER_ITEM_NOT_DIRECT_CHILD');if(typeof n.computed.order!=='string'||!/^[-+]?\d+$/.test(n.computed.order)||!Number.isInteger(order))return error('DOMAIN_ORDER_UNAVAILABLE');items.push({key,backendNodeId:n.backendNodeId,domNodeIndex:n.nodeIndex,cssOrder:order,bounds:n.layout.bounds,paintOrder:n.layout.paintOrder})}
 const dom=[...items].sort((a,b)=>a.domNodeIndex-b.domNodeIndex),css=[...items].sort((a,b)=>a.cssOrder-b.cssOrder||a.domNodeIndex-b.domNodeIndex),x=[...items].sort((a,b)=>a.bounds.x-b.bounds.x||a.bounds.y-b.bounds.y||a.domNodeIndex-b.domNodeIndex),y=[...items].sort((a,b)=>a.bounds.y-b.bounds.y||a.bounds.x-b.bounds.x||a.domNodeIndex-b.domNodeIndex);
 return{state:'ok',facts:{kind:'order',containerBackendNodeId:context.node.backendNodeId,cssOrderApplies:['flex','inline-flex','grid','inline-grid'].includes(context.display),domOrder:dom.map(i=>i.key),cssOrderModified:css.map(i=>i.key),visualXAscending:x.map(i=>i.key),visualYAscending:y.map(i=>i.key),items,context,meaning:'DOM, CSS-order-modified, physical x/y orders are separate facts; no undocumented visual/DOM equivalence'}};
}
export function deriveDocumentOverflowFacts(capture){
 const d=capture?.facts?.document;if(!d||![d.contentWidth,d.contentHeight,d.viewport?.width,d.viewport?.height].every(finite))return error('DOMAIN_DOCUMENT_METRICS_UNAVAILABLE');
 return{state:'ok',facts:{kind:'documentOverflow',horizontalPx:Math.max(0,d.contentWidth-d.viewport.width),verticalPx:Math.max(0,d.contentHeight-d.viewport.height),contentWidth:d.contentWidth,contentHeight:d.contentHeight,viewportWidth:d.viewport.width,viewportHeight:d.viewport.height,scrollOffsetX:d.scrollOffsetX,scrollOffsetY:d.scrollOffsetY,source:d.dimensionsSource,meaning:'document scrollable content extent minus actual CSS layout viewport; inner-scroll content is not counted as document overflow'}};
}

// Pilot v1.1 user-visible domains are separate from CSS declarations/tracks above.
export const VISUAL_ORDER_TOLERANCE_PX=0.5;
function queryItems(capture,keys){
 if(!Array.isArray(keys)||!keys.length||new Set(keys).size!==keys.length)return null;
 const items=keys.map(key=>{const n=target(capture,key);return n?{key,node:n,box:n.layout.bounds}:null});
 return items.every(Boolean)&&new Set(items.map(i=>i.node.documentIndex)).size===1?items:null;
}
function commonLayoutContext(items){
 const first=items[0]?.node;for(const id of first?.ancestorBackendNodeIds??[]){if(items.every(i=>i.node.ancestorBackendNodeIds.includes(id)))return first.layoutContexts?.find(c=>c.backendNodeId===id)??{backendNodeId:id,computed:null,bounds:null}}return null;
}
export function deriveBoxGapFacts(capture,{fromKey,toKey,axis}={}){
 if(!['horizontal','vertical'].includes(axis))return error('DOMAIN_AXIS_REQUIRED');const items=queryItems(capture,[fromKey,toKey]);if(!items)return error('DOMAIN_TARGET_NOT_UNIQUE');
 const[a,b]=items,start=axis==='horizontal'?'x':'y',end=axis==='horizontal'?'right':'bottom';
 const separationPx=Math.max(a.box[start],b.box[start])-Math.min(a.box[end],b.box[end]),fromToSignedPx=b.box[start]-a.box[end],context=commonLayoutContext(items);
 return{state:'ok',facts:{kind:'gap',basis:'visible-border-box-axis-clearance',axis,separationPx,fromToSignedPx,overlapPx:Math.max(0,-separationPx),from:{key:fromKey,backendNodeId:a.node.backendNodeId,box:a.box},to:{key:toKey,backendNodeId:b.node.backendNodeId,box:b.box},context,cssGap:context?.computed?{row:context.computed['row-gap'],column:context.computed['column-gap'],display:context.computed.display}:null,meaning:'positive empty edge interval; overlap is negative; independent of query order and not relabelled computed CSS gap'}};
}
export function clusterAxis(items,coordinate,tolerancePx){
 const sorted=[...items].sort((a,b)=>a.box[coordinate]-b.box[coordinate]||a.node.nodeIndex-b.node.nodeIndex),clusters=[];
 for(const item of sorted){let cluster=clusters.at(-1);if(!cluster||item.box[coordinate]-cluster.min>tolerancePx){cluster={index:clusters.length,min:item.box[coordinate],max:item.box[coordinate],keys:[]};clusters.push(cluster)}cluster.max=item.box[coordinate];cluster.keys.push(item.key)}
 return clusters;
}
export function deriveVisualGridFacts(capture,{itemKeys,gridClusterTolerancePx}={}){
 if(!finite(gridClusterTolerancePx)||gridClusterTolerancePx<0)return error('DOMAIN_GRID_TOLERANCE_REQUIRED');const items=queryItems(capture,itemKeys);if(!items)return error('DOMAIN_TARGET_NOT_UNIQUE');
 const columns=clusterAxis(items,'x',gridClusterTolerancePx),rows=clusterAxis(items,'y',gridClusterTolerancePx),positions=items.map(i=>({key:i.key,backendNodeId:i.node.backendNodeId,row:rows.find(c=>c.keys.includes(i.key)).index,column:columns.find(c=>c.keys.includes(i.key)).index,box:i.box})),context=commonLayoutContext(items);
 return{state:'ok',facts:{kind:'grid',basis:'visual-top-left-complete-link-clusters',gridClusterTolerancePx,columnCount:columns.length,rowCount:rows.length,columns,rows,positions,context,cssGridTracks:context?.computed?{display:context.computed.display,columns:context.computed['grid-template-columns'],rows:context.computed['grid-template-rows']}:null,meaning:'visual positions of specified boxes; flex/block/grid are all legitimate; CSS used tracks are separate diagnostics'}};
}
export function deriveQueryOrderFacts(capture,{itemKeys,orderBasis}={}){
 if(!['visual','dom'].includes(orderBasis))return error('DOMAIN_ORDER_BASIS_REQUIRED');const items=queryItems(capture,itemKeys);if(!items)return error('DOMAIN_TARGET_NOT_UNIQUE');
 const dom=[...items].sort((a,b)=>a.node.documentIndex-b.node.documentIndex||a.node.nodeIndex-b.node.nodeIndex),rows=clusterAxis(items,'y',VISUAL_ORDER_TOLERANCE_PX),visual=rows.flatMap(row=>items.filter(i=>row.keys.includes(i.key)).sort((a,b)=>a.box.x-b.box.x||a.node.nodeIndex-b.node.nodeIndex));
 const ties=[];for(let i=0;i<visual.length;i++)for(let j=i+1;j<visual.length;j++)if(Math.abs(visual[i].box.x-visual[j].box.x)<=VISUAL_ORDER_TOLERANCE_PX&&Math.abs(visual[i].box.y-visual[j].box.y)<=VISUAL_ORDER_TOLERANCE_PX)ties.push([visual[i].key,visual[j].key]);
 if(orderBasis==='visual'&&ties.length)return{...error('DOMAIN_VISUAL_ORDER_TIED'),facts:{ties,items:items.map(i=>({key:i.key,box:i.box})),orderBasis}};
 return{state:'ok',facts:{kind:'order',orderBasis,orderedKeys:(orderBasis==='dom'?dom:visual).map(i=>i.key),domOrder:dom.map(i=>i.key),visualOrder:visual.map(i=>i.key),visualRule:'physical-top-to-bottom-left-to-right; complete-link row tolerance fixed 0.5 CSS px',visualRowTolerancePx:VISUAL_ORDER_TOLERANCE_PX,context:commonLayoutContext(items),items:items.map(i=>({key:i.key,backendNodeId:i.node.backendNodeId,documentIndex:i.node.documentIndex,nodeIndex:i.node.nodeIndex,box:i.box,cssOrder:i.node.computed.order}))}};
}