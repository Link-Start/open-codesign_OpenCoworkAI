// v04 F1 r3 copied from ./browser-session-r2.mjs (F0 frozen hash 75189d74d8c75c073b79db883b6e2648f72049be2ac4b31adfc06e1ec6ba498c).
// F0 r2 is immutable; r3 has its own observer hash, native-domain calibration, and explicit policy.
// Browser risk reduction only; lexical gate and CDP are not OS isolation.
// Only trusted Babel is evaluated in Node. Hidden oracle comparison belongs to the parent.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { spawn } from 'node:child_process';
import vm from 'node:vm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { APP_SCRIPT_ENTRY_CONTRACT, compileAppScriptR2 } from './entry-contract-r2.mjs';
import {DOMAIN_RULES,LAYOUT_FACTS_SCHEMA,LAYOUT_COMPUTED_PROPERTIES,snapshotLayoutFacts,deriveGapFacts,deriveGridFacts,deriveOrderFacts,deriveDocumentOverflowFacts,deriveBoxGapFacts,deriveVisualGridFacts,deriveQueryOrderFacts} from './layout-facts-r3.mjs';
export {DOMAIN_RULES,LAYOUT_FACTS_SCHEMA,deriveGapFacts,deriveGridFacts,deriveOrderFacts,deriveDocumentOverflowFacts,deriveBoxGapFacts,deriveVisualGridFacts,deriveQueryOrderFacts};
export { APP_SCRIPT_ENTRY_CONTRACT };
export const HTML_ENTRY_CONTRACT='html-srcdoc-shared-react-prefix-2';
export const POLICY_ID='v04-static-gate-3-entry-bound', ENTRY_CONTRACT='jsx-export-default-commonjs-react-1', CONTAINMENT='browser-risk-reduction-not-os-network-isolation';
export const OBSERVER_REVISION='v04-observer-r3-coherent-layout-domains-2';
export const VIEWPORT_NORMALIZATION=Object.freeze({mode:'hide-scrollbars',flag:'--hide-scrollbars',target:'requested-css-viewport-equals-usable-layout-viewport',securityRelaxation:false});
export const sha256=x=>createHash('sha256').update(x).digest('hex');
const fail=(code,detail='')=>{throw Object.assign(new Error(code+(detail?': '+detail:'')),{code})};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
const attr=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const script=s=>s.replace(/<\/script/gi,'<\\/script');
// Analysis-only masking: namespace metadata is not a request URL. Other attributes remain scanned.
function namespaceNeutralURLScan(source,format){
 return source.replace(/<svg\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi,tag=>tag.replace(/([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*'|\{\s*(?:"[^"]*"|'[^']*')\s*\}|[^\s>]+)/g,(attribute,name,literal)=>{
  if((format==='html'?name.toLowerCase():name)!=='xmlns')return attribute;
  let value=literal;if(format==='jsx'&&value.startsWith('{')&&value.endsWith('}'))value=value.slice(1,-1).trim();
  if(!((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))))return attribute;
  return value.slice(1,-1)==='http://www.w3.org/2000/svg'?'xmlns="[non-request-svg-namespace]"':attribute;
 }));
}
export function staticGate({sourceBytes,format,entryContract}){
 if(!(sourceBytes instanceof Uint8Array))fail('SOURCE_BYTES_REQUIRED');
 const reasons=[];let source='';try{source=decode(sourceBytes)}catch{reasons.push('invalid-utf8')}
 if(!['html','jsx'].includes(format))reasons.push('format');if(sourceBytes.length>1048576)reasons.push('source-size');
 const rules=[
 ['external-url',/(?:https?|file|ftp|wss?):\s*[\/\\]/i],
 ['network-worker',/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|serviceWorker|sendBeacon|RTCPeerConnection|WebTransport)\b/],
 ['dynamic-code',/\b(?:eval|Function|importScripts)\s*\(|\bimport\s*\(/],
 ['import',/\bimport\s+(?!\()/],
 ['prototype-mutation',/\b(?:__proto__|prototype|setPrototypeOf|defineProperty|defineProperties)\b/],
 ['navigation',/\b(?:window|globalThis|self|top|parent)\s*\.\s*(?:open|location|opener|frames)\b|\blocation\s*(?:\.|=)|\bdocument\s*\.\s*(?:domain|cookie|write|writeln)\b/],
 ['embedded-context',/<\s*(?:iframe|frame|object|embed|base|link)\b/i],
 ['external-script',/<\s*script\b[^>]*\bsrc\s*=/i],
 ['refresh',/<\s*meta\b[^>]*http-equiv\s*=\s*["']?refresh/i],
 ['storage-device',/\b(?:indexedDB|localStorage|sessionStorage|showOpenFilePicker|showSaveFilePicker|requestFileSystem|requestDevice|mediaDevices)\b/],
 ['download',/\bdownload\s*=|<\s*form\b[^>]*\baction\s*=/i]];
 const urlScanSource=namespaceNeutralURLScan(source,format);
 for(const [name,re] of rules)if(re.test(name==='external-url'?urlScanSource:source))reasons.push(name);
 if(format==='jsx'){
  if(![ENTRY_CONTRACT,APP_SCRIPT_ENTRY_CONTRACT].includes(entryContract))reasons.push('explicit-jsx-entry-contract-required');
  if(entryContract===ENTRY_CONTRACT&&!/\bexport\s+default\b/.test(source))reasons.push('default-export-required');
  if(/\bReactDOM\s*\.|\b(?:createRoot|hydrateRoot)\s*\(/.test(source))reasons.push('self-mount');
 }
 const result={policyId:POLICY_ID,sourceSha256:sha256(sourceBytes),format,entryContract:format==='jsx'?entryContract??null:HTML_ENTRY_CONTRACT,accepted:reasons.length===0,reasons};return{...result,digest:sha256(JSON.stringify(result))};
}
export function validateExecution(request,options){
 if(!['trusted-microfixture','restricted-generated'].includes(request.trustLevel))fail('EXPLICIT_TRUST_LEVEL_REQUIRED');
 if(options.entryContract&&options.entryContract!==request.entryContract)fail('ENTRY_CONTRACT_MISMATCH');
 if(options.trustLevel!==request.trustLevel)fail('TRUST_LEVEL_MISMATCH');
 if(request.trustLevel==='restricted-generated'&&options.allowRestrictedGenerated!==true)fail('RESTRICTED_GENERATED_NOT_AUTHORIZED');
 if(request.trustLevel==='restricted-generated'&&!(typeof options.authorizationText==='string'&&options.authorizationText.trim()))fail('AUTHORIZATION_EVIDENCE_REQUIRED');
 if(!request.staticGate?.digest)fail('STATIC_GATE_REQUIRED');const gate=staticGate(request);
 if(gate.digest!==request.staticGate.digest||gate.sourceSha256!==request.staticGate.sourceSha256)fail('STATIC_GATE_DIGEST_MISMATCH');
 if(!gate.accepted)fail('STATIC_GATE_REJECTED',gate.reasons.join(','));return gate;
}
export const CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; worker-src 'none'; frame-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; media-src 'none'";
export const CONTAINER_POLICY=Object.freeze({revision:'r3-opaque-local-form-events-1',sandbox:'allow-scripts allow-forms',innerCsp:CSP,outerCsp:"default-src 'none'; frame-src about:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",runtimeNetwork:'CDP Fetch failRequest all; external Network blocked URLs; Page navigation stopped; downloads/permissions denied',notClaimed:'OS/network isolation'});
export const CONTAINER_POLICY_ID='r3-container-'+sha256(JSON.stringify(CONTAINER_POLICY));
let cachedRuntime,cachedCompiler;
async function runtime(dir){
 if(cachedRuntime?.dir===dir)return cachedRuntime;
 const names=['react.umd.js','react-dom.umd.js'],bytes=await Promise.all(names.map(n=>readFile(join(dir,n))));
 return cachedRuntime={dir,react:decode(bytes[0]),reactDOM:decode(bytes[1]),bytes:bytes.reduce((n,b)=>n+b.length,0),hashes:Object.fromEntries(names.map((n,i)=>[n,sha256(bytes[i])]))};
}
async function compiler(dir){
 if(cachedCompiler?.dir===dir)return cachedCompiler;
 const bytes=await readFile(join(dir,'babel.standalone.js')),context=vm.createContext({});
 new vm.Script(decode(bytes)).runInContext(context,{timeout:15000});
 if(!context.Babel?.transform)fail('TRUSTED_BABEL_UNAVAILABLE');
 return cachedCompiler={dir,context,bytes:bytes.length,hashes:{'babel.standalone.js':sha256(bytes)}};
}
export async function buildEnvelope({sourceBytes,format,runtimeDir,entryContract}){
 if(!['html','jsx'].includes(format))fail('INVALID_FORMAT');
 const source=decode(sourceBytes),meta=`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">`,rt=await runtime(runtimeDir);
 const vendors=`<script>${script(rt.react)}</script><script>${script(rt.reactDOM)}</script>`;
 const runtimeHashes=rt.hashes,runtimeSupply={kind:'shared-trusted-react-runtime',rawVendorBytes:rt.bytes,inlineScriptBytes:Buffer.byteLength(vendors),chargedToRawSource:false};
 let compiled=null,compilerHashes={},compilerSupply=null,inner,entrySelection=null;
 if(format==='jsx'){
  const tool=await compiler(runtimeDir);tool.context.__source=source;
   try{
    if(entryContract===APP_SCRIPT_ENTRY_CONTRACT){tool.context.__compileAppScript=compileAppScriptR2;entrySelection=new vm.Script('__compileAppScript({source:__source,Babel})').runInContext(tool.context,{timeout:10000});compiled=entrySelection.code}
    else if(entryContract===ENTRY_CONTRACT)compiled=new vm.Script('Babel.transform(__source,{presets:["react"],plugins:["transform-modules-commonjs"],filename:"candidate.jsx",sourceType:"module",babelrc:false,configFile:false}).code').runInContext(tool.context,{timeout:10000});
    else fail('EXPLICIT_JSX_ENTRY_CONTRACT_REQUIRED');
   }finally{delete tool.context.__source;delete tool.context.__compileAppScript}
  compilerHashes=tool.hashes;compilerSupply={kind:'trusted-node-compile-only',rawVendorBytes:tool.bytes,embeddedInPage:false};
  const mount=entrySelection?`(function(){\n${compiled}\n;ReactDOM.createRoot(document.getElementById("__v03_root")).render(React.createElement(${entrySelection.entryName}));})();`:`(function(){const module={exports:{}};const exports=module.exports;\n${compiled}\n;ReactDOM.createRoot(document.getElementById('__v03_root')).render(React.createElement(module.exports.default));})();`;
  inner=`<!doctype html><html><head>${meta}</head><body><div id="__v03_root"></div>${vendors}<script>${script(mount)}</script></body></html>`;
 }else inner='<!doctype html>'+meta+vendors+source;
 const document=`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src about:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style><iframe title="candidate" sandbox="${CONTAINER_POLICY.sandbox}" srcdoc="${attr(inner)}"></iframe>`;
 return{document,compiled,sourceByteLength:sourceBytes.byteLength,executionEnvelopeBytes:Buffer.byteLength(document),sourceSha256:sha256(sourceBytes),compiledSha256:compiled===null?null:sha256(compiled),envelopeSha256:sha256(document),runtimeHashes,compilerHashes,runtimeSupply,compilerSupply,entryContract:format==='jsx'?entryContract:HTML_ENTRY_CONTRACT,...(entrySelection?{entrySelection:{entryName:entrySelection.entryName,selectionRule:entrySelection.selectionRule,declaredEntries:entrySelection.declaredEntries}}:{})};
}
export class CDP{
 constructor(socket,timeoutMs=10000){this.socket=socket;this.timeoutMs=timeoutMs;this.counter=0;this.pending=new Map;this.listeners=new Set;
 socket.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id){const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Object.assign(new Error(p.method+': '+m.error.message),{code:'CDP_ERROR'})):p.resolve(m.result)}else for(const f of this.listeners)f(m)});
 socket.addEventListener('close',()=>this.rejectAll('CDP_CLOSED'));socket.addEventListener('error',()=>this.rejectAll('CDP_SOCKET_ERROR'));}
 static async connect(url,timeout){const socket=new WebSocket(url);await new Promise((resolve,reject)=>{const t=setTimeout(()=>{socket.close();reject(new Error('CDP_CONNECT_TIMEOUT'))},timeout);socket.addEventListener('open',()=>{clearTimeout(t);resolve()},{once:true});socket.addEventListener('error',()=>{clearTimeout(t);reject(new Error('CDP_CONNECT_FAILED'))},{once:true})});return new CDP(socket,timeout)}
 send(method,params={},sessionId){const id=++this.counter;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Object.assign(new Error('CDP_TIMEOUT: '+method),{code:'CDP_TIMEOUT'}))},this.timeoutMs);this.pending.set(id,{method,resolve,reject,timer});try{this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e)}})}
 on(f){this.listeners.add(f);return()=>this.listeners.delete(f)}
 rejectAll(message){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(message))}this.pending.clear()}
 close(){this.rejectAll('CDP_CLOSED');this.socket.close()}
}
export function browserArguments(profile){return['--headless=new','--hide-scrollbars',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--disable-sync','--disable-component-update','--disable-default-apps','--disable-domain-reliability','--disable-features=MediaRouter','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','about:blank']}
const normalize=x=>String(x??'').replace(/\s+/g,' ').trim();
const equal=(a,b,exact)=>exact===false?normalize(a).includes(normalize(b)):normalize(a)===normalize(b);
export function matchAX(nodes,locator){
 if(!locator||!['role','text','form-control-label'].includes(locator.by))fail('INVALID_LOCATOR');
 if(typeof locator[locator.by==='form-control-label'?'label':locator.by]==='undefined')fail('INVALID_LOCATOR');
 const map=new Map(nodes.map(n=>[n.nodeId,n]));let allowed;
 if(locator.within){const contexts=matchAX(nodes,locator.within);if(contexts.length!==1)fail('AMBIGUOUS_LOCATOR_CONTEXT',String(contexts.length));allowed=new Set;const visit=id=>{if(allowed.has(id))return;allowed.add(id);for(const c of map.get(id)?.childIds??[])visit(c)};visit(contexts[0].nodeId)}
 const matches=nodes.filter(n=>!n.ignored&&n.backendDOMNodeId&&(!allowed||allowed.has(n.nodeId))).filter(n=>locator.by==='role'?n.role?.value===locator.role&&(locator.name===undefined||equal(n.name?.value,locator.name,locator.exact)):locator.by==='form-control-label'?['textbox','searchbox','spinbutton','combobox','listbox','checkbox','radio','switch','slider'].includes(n.role?.value)&&equal(n.name?.value,locator.label,locator.exact):equal(n.name?.value,locator.text,locator.exact));
 if(locator.by==='role'||locator.by==='form-control-label')return matches;
 const ids=new Set(matches.map(n=>n.nodeId));return matches.filter(n=>{let p=map.get(n.parentId);while(p){if(ids.has(p.nodeId))return false;p=map.get(p.parentId)}return n.role?.value!=='InlineTextBox'});
}
const CSS_PROPS=['display','visibility','opacity','color','background-color','font-size','font-weight','font-family','width','height','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-radius','position'];
const nodeText=n=>n.nodeType===3?n.nodeValue:(n.children??[]).filter(c=>!['SCRIPT','STYLE'].includes(c.nodeName)).map(nodeText).join('');
const attributes=n=>Object.fromEntries(Array.from({length:(n.attributes?.length??0)/2},(_,i)=>[n.attributes[2*i],n.attributes[2*i+1]]));
// Rendered layout text and live input values from a browser-owned snapshot, not page functions.
export function snapshotIndex(snapshot){
 const strings=snapshot.strings,entries=new Map;
 for(const document of snapshot.documents){
  const nodes=document.nodes,layout=document.layout;if(nodes.backendNodeId.length>5000)fail('SNAPSHOT_NODE_LIMIT');
  const indices=new Map(nodes.backendNodeId.map((id,i)=>[id,i])),layoutIndices=new Map(layout.nodeIndex.map((ni,i)=>[ni,i]));
  const descendant=(child,parent)=>{for(let i=child;i>=0;i=nodes.parentIndex[i])if(i===parent)return true;return false};
  const values=new Map,segments=[],pseudo=new Set(nodes.pseudoType?.index??[]),breaks=[];let breakCount=0;
  for(let i=0;i<nodes.nodeName.length;i++){if(strings[nodes.nodeName[i]]==='BR')breakCount++;breaks[i]=breakCount}
  for(const data of[nodes.textValue,nodes.inputValue])if(data)for(let i=0;i<data.index.length;i++)values.set(data.index[i],strings[data.value[i]]);
  for(let j=0;j<layout.nodeIndex.length;j++){
   const index=layout.nodeIndex[j],visibility=strings[layout.styles?.[j]?.[0]];
   if(nodes.nodeType[index]!==3||visibility==='hidden'||visibility==='collapse')continue;
   let block=-1,inPseudo=false;
   for(let i=nodes.parentIndex[index];i>=0;i=nodes.parentIndex[i]){
    if(pseudo.has(i))inPseudo=true;
    const display=strings[layout.styles?.[layoutIndices.get(i)]?.[1]];
    if(block===-1&&['block','flex','grid','list-item','table','table-row','table-cell'].includes(display))block=i;
   }
   const value=strings[layout.text[j]]??'';if(value&&!inPseudo)segments.push({index,value,block,breaks:breaks[index]});
  }
  for(const[id,index]of indices){
   let output='',previous;
   for(const segment of segments)if(descendant(segment.index,index)){
    if(previous&&(segment.block!==previous.block||segment.breaks>previous.breaks))output+=' ';
    output+=segment.value;previous=segment;
   }
   entries.set(id,{backendNodeId:id,parentBackendNodeId:nodes.backendNodeId[nodes.parentIndex[index]],nodeType:nodes.nodeType[index],tagName:String(strings[nodes.nodeName[index]]??'').toLowerCase(),text:normalize(output),value:values.has(index)?values.get(index):undefined,valueChannels:Object.fromEntries(["textValue","inputValue"].map(name=>{const data=nodes[name],position=data?.index?.indexOf(index)??-1;return[name,{fieldPresent:!!data,entryPresent:position>=0,stringIndex:position>=0?data.value[position]:null,value:position>=0?strings[data.value[position]]:null}]})),hasLayout:layoutIndices.has(index),visibleInSnapshot:layoutIndices.has(index)&&(()=>{for(let i=index;i>=0;i=nodes.parentIndex[i]){const styles=layout.styles?.[layoutIndices.get(i)]??[];if(['hidden','collapse'].includes(strings[styles[0]])||strings[styles[2]]==='0')return false}return true})(),contains:other=>indices.has(other)&&descendant(indices.get(other),index)});
  }
 }
 return entries;
}
export async function start(options={}){
 if(!['trusted-microfixture','restricted-generated'].includes(options.trustLevel))fail('EXPLICIT_TRUST_LEVEL_REQUIRED');
 if(options.trustLevel==='restricted-generated'&&options.allowRestrictedGenerated!==true)fail('RESTRICTED_GENERATED_NOT_AUTHORIZED');
 if(options.trustLevel==='restricted-generated'&&!(typeof options.authorizationText==='string'&&options.authorizationText.trim()))fail('AUTHORIZATION_EVIDENCE_REQUIRED');
 if(!options.browserPath||!options.runtimeDir||!options.artifactRoot)fail('EXPLICIT_PATHS_REQUIRED');
 await access(options.browserPath);await mkdir(options.artifactRoot,{recursive:true});
 let browserVersion=null,rawSequence=0,witnessAllowed=false,renderEpoch=0,viewportEpoch=0,viewportTransition=null,lastRenderRequest=null,reloadSequence=0,renderInFlight=false,cleanupPromise=null,cleanupFailure=null,abortPromise=null; const ownedProcesses=[],operationContext=new AsyncLocalStorage();
  const calibrationPolicy=options.calibrationPolicy?verifyCalibrationPolicy(options.calibrationPolicy):null;
  const observerSha256=sha256(await readFile(new URL(import.meta.url))),entryHelperSha256=sha256(await readFile(new URL('./entry-contract-r2.mjs',import.meta.url))),layoutHelperSha256=sha256(await readFile(new URL('./layout-facts-r3.mjs',import.meta.url)));
  if(calibrationPolicy&&calibrationPolicy.observerSha256!==observerSha256)fail('CALIBRATION_OBSERVER_MISMATCH');
  if(calibrationPolicy&&calibrationPolicy.entryHelperSha256!==entryHelperSha256)fail('CALIBRATION_ENTRY_HELPER_MISMATCH');
  if(calibrationPolicy&&calibrationPolicy.layoutHelperSha256!==layoutHelperSha256)fail('CALIBRATION_LAYOUT_HELPER_MISMATCH');
  let viewport=options.viewport??{width:1280,height:900},child,cdp,sid,candidateSid,profile,watchdog,current,closed=false,sequence=0,violations=[],protocolFailure=null,configuredTargets=[],candidateConfig=null,pageErrors=[],networkEvents=[],networkDroppedEvents=0,runtimeJournals=[],runtimeJournal=null,runtimeEventSequence=0,replaySequence=0,replayStage={kind:'render',sequence:0};
 const timeout=options.timeoutMs??15000,lifetime=options.sessionLifetimeMs??120000;
 if(!Number.isInteger(timeout)||timeout<100||timeout>60000||!Number.isInteger(lifetime)||lifetime<100||lifetime>300000)fail('INVALID_TIME_BUDGET');
 if(options.settleMs!==undefined&&(!Number.isInteger(options.settleMs)||options.settleMs<0||options.settleMs>5000))fail('INVALID_SETTLE_BUDGET');
 const command=async(method,params={})=>{const context=operationContext.getStore(),epoch=context?.epoch??renderEpoch;if(context?.viewportEpoch!==undefined&&context.viewportEpoch!==viewportEpoch)fail('VIEWPORT_CHANGED','Observation viewport invalidated');if(epoch!==renderEpoch||cleanupPromise||!cdp)fail(closed?'SESSION_CLOSED':'NO_RENDER','Render transport invalidated');const transport=cdp,target=candidateSid??sid,operationJournal=runtimeJournal;const result=await transport.send(method,params,target).catch(error=>{if(epoch===renderEpoch&&!cleanupPromise&&!closed&&operationJournal&&['CDP_CLOSED','CDP_SOCKET_ERROR','CDP_TIMEOUT'].includes(error.code??error.message)){operationJournal.complete=false;operationJournal.transportFailure={code:error.code??error.message,message:error.message}}throw error});if(epoch!==renderEpoch)fail(closed?'SESSION_CLOSED':'NO_RENDER','Stale render operation');if(context?.viewportEpoch!==undefined&&context.viewportEpoch!==viewportEpoch)fail('VIEWPORT_CHANGED','Observation viewport changed during command');return result};
  const withEpoch=fn=>(...args)=>operationContext.run({epoch:renderEpoch,viewportEpoch},()=>fn(...args));
 const record=(kind,extra={})=>violations.push({kind,...extra});
  function journalSnapshot(){const journals=runtimeJournals.map(j=>structuredClone(j));return{available:journals.length>0&&journals.every(j=>j.available),availability:journals.length>0&&journals.every(j=>j.available)?'available':'unavailable',complete:journals.length>0&&journals.every(j=>j.complete),throughEventSequence:runtimeEventSequence,nativeEventSources:['Runtime.exceptionThrown','Runtime.exceptionRevoked','Runtime.consoleAPICalled(error)','Log.entryAdded(error)'],journals,events:journals.flatMap(j=>j.events)}}
  function journalEvent(category,params,sessionId,journal=runtimeJournal,phase='planned-observation'){
   if(!journal)return;const sequence=++runtimeEventSequence,details=params.exceptionDetails??{},exception=details.exception??{},description=exception.description??details.text??'',firstLine=String(description).split('\n')[0],name=exception.className??(firstLine.match(/^([A-Za-z]*Error):/)?.[1])??(category==='console-error'?'ConsoleError':category==='browser-log-error'?'BrowserLogError':'Error');
   const message=category==='exception-revoked'?String(params.reason??''):category==='console-error'?(params.args??[]).map(a=>a.value!==undefined?String(a.value):a.description??a.type??'').join(' '):category==='browser-log-error'?String(params.entry?.text??''):firstLine.startsWith(name+':')?firstLine.slice(name.length+1).trim():firstLine;
   const event={eventSequence:sequence,phase,observedAtMs:performance.now(),sourceSha256:journal.sourceSha256,renderId:journal.renderId,category,name,message,line:details.lineNumber??params.entry?.lineNumber??null,column:details.columnNumber??null,locationBase:0,sourceURL:details.url??params.entry?.url??null,stack:details.stackTrace??params.stackTrace??params.entry?.stackTrace??null,renderEpoch:journal.renderEpoch,viewportEpochAtReceipt:viewportEpoch,replayStage:phase==='planned-observation'?{...replayStage}:{kind:'research-teardown',sequence:journal.observationCutoff?.replayStage?.sequence??null},sessionId:sessionId??null,exceptionId:details.exceptionId??params.exceptionId??null,native:{method:category==='console-error'?'Runtime.consoleAPICalled':category==='browser-log-error'?'Log.entryAdded':category==='exception-revoked'?'Runtime.exceptionRevoked':'Runtime.exceptionThrown',params:structuredClone(params)}};
   journal.lastEventSequence=sequence;if(journal.events.length>=2000){journal.complete=false;journal.droppedEvents++;return}journal.events.push(event);if(category!=='exception-revoked'&&phase==='planned-observation'&&journal===runtimeJournal)pageErrors.push(event);
  }
 const ready=()=>{if(closed)fail('SESSION_CLOSED');if(!current)fail('NO_RENDER');if(viewportTransition)fail('VIEWPORT_TRANSITION_PENDING');if(protocolFailure)fail('CONTAINMENT_CONTROL_FAILED',protocolFailure)};
  function kill(){
   if(cleanupPromise)return cleanupPromise;
   clearTimeout(watchdog);const old=child,oldCdp=cdp,oldProfile=profile;
   // Invalidate references synchronously. This cleanup closes ONLY captured owned resources.
   child=null;cdp=null;profile=null;
   cleanupPromise=Promise.resolve().then(async()=>{
    try{
     oldCdp?.close();
     if(old&&old.exitCode===null){
      if(process.platform==='win32')await new Promise(resolve=>{const killer=spawn('taskkill.exe',['/PID',String(old.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.once('error',()=>{old.kill();resolve()});killer.once('close',resolve)});else old.kill('SIGKILL');
      await Promise.race([new Promise(resolve=>{if(old.exitCode!==null)resolve();else old.once('close',resolve)}),sleep(3000)]);
      if(old.exitCode===null)fail('BROWSER_CLEANUP_FAILED','Owned browser process did not exit');
     }
     if(old){const tracked=ownedProcesses.findLast(p=>p.pid===old.pid);if(tracked)tracked.closedAt=new Date().toISOString()}
     if(oldProfile)await rm(oldProfile,{recursive:true,force:true,maxRetries:5,retryDelay:150});
    }catch(error){cleanupFailure=collectionErrorRecord({code:'BROWSER_CLEANUP_FAILED',message:error.message});record('profile-or-browser-cleanup-failed',cleanupFailure);throw error}
    finally{cleanupPromise=null}
   });return cleanupPromise;
  }
  function abortRender(){
   if(abortPromise)return abortPromise;
   if(cleanupPromise)return cleanupPromise;
   endObservation(closed?'session-close':'observation-abort');++renderEpoch;current=null;protocolFailure='external-observation-abort';candidateSid=null;
   return abortPromise=kill();
  }
 function enforce(event){const eventEpoch=renderEpoch,eventTransport=cdp;const{method,params:p={},sessionId}=event;const send=(m,p)=>{void eventTransport?.send(m,p,sessionId).catch(e=>{if(eventEpoch===renderEpoch)protocolFailure=e.message})};
  if(['Network.requestWillBeSent','Network.responseReceived','Network.loadingFailed'].includes(method)){const url=p.request?.url??p.response?.url??networkEvents.findLast(e=>e.native.params.requestId===p.requestId)?.url;if(url&&/^(?:https?|file|ftp|ws|wss):/i.test(url)){if(networkEvents.length<2000)networkEvents.push({method,url,renderEpoch,observedAtMs:performance.now(),replayStage:{...replayStage},native:{method,params:structuredClone(p),sessionId:sessionId??null}});else networkDroppedEvents++}}
  if(method==='Fetch.requestPaused'){record('request-blocked',{url:p.request?.url});send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'})}
  else if(method==='Page.javascriptDialogOpening'){record('dialog-denied');send('Page.handleJavaScriptDialog',{accept:false})}
  else if(method==='Page.fileChooserOpened')record('file-chooser-denied');
  else if(method==='Target.attachedToTarget'){
   if(p.targetInfo?.type==='iframe'&&p.targetInfo.url==='about:srcdoc'&&!candidateSid&&!current){candidateSid=p.sessionId;candidateConfig=configure(candidateSid).then(()=>{if(eventEpoch===renderEpoch)return eventTransport?.send('Runtime.runIfWaitingForDebugger',{},candidateSid)}).catch(e=>{if(eventEpoch===renderEpoch)protocolFailure=e.message})}
   else{record('new-target-denied',{type:p.targetInfo?.type,url:p.targetInfo?.url});void eventTransport?.send('Target.closeTarget',{targetId:p.targetInfo.targetId}).catch(e=>{if(eventEpoch===renderEpoch)protocolFailure=e.message})}
  }
  else if(method==='Page.frameRequestedNavigation'&&!(p.url==='about:srcdoc'&&!current)){record('navigation-denied',{url:p.url});send('Page.stopLoading',{})}
  else if(method==='Inspector.targetCrashed')protocolFailure='target-crashed';
  else if(method==='Runtime.exceptionThrown')journalEvent(String(p.exceptionDetails?.text??'').includes('(in promise)')?'unhandled-promise-rejection':'runtime-exception',p,sessionId);
   else if(method==='Runtime.exceptionRevoked')journalEvent('exception-revoked',p,sessionId);
   else if(method==='Runtime.consoleAPICalled'&&p.type==='error')journalEvent('console-error',p,sessionId);
   else if(method==='Log.entryAdded'&&p.entry?.level==='error')journalEvent('browser-log-error',p,sessionId);
  else if(method==='Log.entryAdded'&&p.entry?.source==='security')record('browser-security-log',{level:p.entry.level,text:p.entry.text});
 }
 async function launch(){profile=await mkdtemp(join(options.artifactRoot,'r3-owned-profile-'));child=spawn(options.browserPath,browserArguments(profile),{stdio:'ignore',windowsHide:true});ownedProcesses.push({pid:child.pid,profile,launchedAt:new Date().toISOString(),closedAt:null});let launchError;child.once('error',e=>launchError=e);watchdog=setTimeout(()=>{record('session-watchdog');void abortRender().catch(e=>record('watchdog-cleanup-failed',{message:e.message}))},lifetime);
  const deadline=Date.now()+timeout;let portText;while(Date.now()<deadline){if(launchError)throw launchError;if(child.exitCode!==null)fail('BROWSER_EXITED',String(child.exitCode));try{portText=await readFile(join(profile,'DevToolsActivePort'),'utf8');if(portText.includes('\n'))break}catch{}await sleep(50)}if(!portText)fail('BROWSER_START_TIMEOUT');
  const[port,path]=portText.trim().split(/\r?\n/);cdp=await CDP.connect(`ws://127.0.0.1:${port}${path}`,timeout);
  browserVersion=await cdp.send('Browser.getVersion');if(calibrationPolicy&&browserVersionKey(browserVersion)!==browserVersionKey(calibrationPolicy.browserVersion))fail('CALIBRATION_BROWSER_VERSION_MISMATCH');
   await cdp.send('Browser.setDownloadBehavior',{behavior:'deny',eventsEnabled:true});await cdp.send('Browser.resetPermissions');
  const targets=await cdp.send('Target.getTargets'),target=targets.targetInfos.find(t=>t.type==='page'&&t.url==='about:blank');if(!target)fail('INITIAL_TARGET_MISSING');sid=(await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;const launchEpoch=renderEpoch,launchJournal=runtimeJournal;cdp.on(event=>{if(renderEpoch===launchEpoch&&!cleanupPromise)enforce(event);else teardownNative(event,launchJournal)});
  await configure(sid);await applyViewport(viewport,{initial:true});
 }
 async function configure(id){
  const transport=cdp,epoch=renderEpoch;const send=(m,p={})=>{if(epoch!==renderEpoch||!transport)fail('NO_RENDER','Configuration invalidated');return transport.send(m,p,id)};
  for(const method of['Page.enable','DOM.enable','CSS.enable','Accessibility.enable','Network.enable','Runtime.enable','Log.enable'])await send(method);if(runtimeJournal){runtimeJournal.available=true;runtimeJournal.complete=runtimeJournal.droppedEvents===0&&!runtimeJournal.transportFailure;runtimeJournal.targets.push({sessionId:id,configuredAtEventSequence:runtimeEventSequence})};
  await send('Network.setBlockedURLs',{urls:['http://*','https://*','file://*','ftp://*','ws://*','wss://*']});await send('Network.setBypassServiceWorker',{bypass:true});await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});await send('Page.setInterceptFileChooserDialog',{enabled:true});await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});configuredTargets.push(id);
 }
  async function applyViewport(size,{initial=false}={}){
   if(!size||Object.keys(size).some(k=>!['width','height','state'].includes(k))||!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<200||size.height<200||size.width>4096||size.height>4096)fail('INVALID_VIEWPORT');
   if(!initial){ready();replayStage={kind:'action',action:'setViewport',sequence:++replaySequence};if(size.state!==undefined&&size.state!=='preserve')fail('INVALID_VIEWPORT_STATE_SEMANTICS');if(viewportTransition)fail('VIEWPORT_TRANSITION_PENDING')}
   const token={},epoch=renderEpoch,transport=cdp,target=sid,previousViewport={...viewport},startedMs=performance.now();viewportTransition=token;if(!initial)++viewportEpoch;
   try{
    await transport.send('Emulation.setDeviceMetricsOverride',{width:size.width,height:size.height,deviceScaleFactor:1,mobile:false},target);
    if(epoch!==renderEpoch||transport!==cdp)fail('NO_RENDER','Viewport operation invalidated');
    viewport={width:size.width,height:size.height};if(current)current={...current,viewport,viewportEpoch};
    const metrics=await transport.send('Page.getLayoutMetrics',{},candidateSid??sid);
    if(epoch!==renderEpoch||transport!==cdp)fail('NO_RENDER','Viewport completion invalidated');
    return{action:'setViewport',renderId:current?.renderId??null,renderEpoch,viewportEpoch,previousViewport,viewport:{...viewport},actualLayoutViewport:metrics.cssLayoutViewport??null,stateSemantics:initial?'initial-viewport':'preserve-live-document-and-React-state-no-remount',scrollSemantics:'browser-retains-or-clamps-existing-scroll-offset',capture:{startedMs,completedMs:performance.now(),clock:'node-performance-monotonic'}};
   }catch(error){if(runtimeJournal){runtimeJournal.complete=false;runtimeJournal.transportFailure={code:error.code??null,message:error.message}}if(!initial&&epoch===renderEpoch)await abortRender();throw error}finally{if(viewportTransition===token)viewportTransition=null}
  }
  async function setViewport(request){return applyViewport(request)}
  async function reload(request={}){
   if(!request||Object.keys(request).some(k=>!['state','artifactId'].includes(k))||request.state!==undefined&&request.state!=='reset-to-source')fail('INVALID_RELOAD_REQUEST');ready();if(!lastRenderRequest)fail('NO_RENDER');
   const previous={renderId:current.renderId,renderEpoch,viewportEpoch},artifactId=request.artifactId??'r3-reload-'+String(++reloadSequence).padStart(4,'0');
   const receipt=await render({...lastRenderRequest,sourceBytes:Buffer.from(lastRenderRequest.sourceBytes),viewport:{...viewport},artifactId});
   return{action:'reload',stateSemantics:'reset-to-rendered-source-bytes-new-document-new-React-state-new-profile',scrollSemantics:'reset-to-top-left',previous,receipt,renderId:receipt.renderId,renderEpoch:receipt.renderEpoch,viewportEpoch:receipt.viewportEpoch,viewport:receipt.viewport};
  }
 async function document(){const{root}=await command('DOM.getDocument',{depth:-1,pierce:true});if(candidateSid)return root;const find=n=>{if(n.nodeName==='IFRAME'&&n.contentDocument)return n.contentDocument;for(const c of n.children??[]){const r=find(c);if(r)return r}return null};const result=find(root);if(!result)fail('CANDIDATE_DOCUMENT_UNAVAILABLE');return result}
 async function ax(){const{frameTree}=await command('Page.getFrameTree'),frame=candidateSid?frameTree.frame:frameTree.childFrames?.[0]?.frame;if(!frame||frame.url!=='about:srcdoc')fail('CANDIDATE_FRAME_UNAVAILABLE');return(await command('Accessibility.getFullAXTree',{frameId:frame.id})).nodes}
 async function describe(backendNodeId,properties=CSS_PROPS){const{node}=await command('DOM.describeNode',{backendNodeId,depth:-1,pierce:true}),{nodeIds}=await command('DOM.pushNodesByBackendIdsToFrontend',{backendNodeIds:[backendNodeId]}),nodeId=nodeIds[0],attrs=attributes(node);let computedStyle={},boundingRect=null;
  if(node.nodeType===1){const result=await command('CSS.getComputedStyleForNode',{nodeId});computedStyle=Object.fromEntries(result.computedStyle.filter(p=>properties.includes(p.name)||['display','visibility','opacity'].includes(p.name)).map(p=>[p.name,p.value]))}
  try{const{model}=await command('DOM.getBoxModel',{backendNodeId}),xs=model.border.filter((_,i)=>i%2===0),ys=model.border.filter((_,i)=>i%2===1);boundingRect={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}}catch(e){if(e.code!=='CDP_ERROR')throw e}
  return{backendNodeId,nodeId,tagName:node.nodeName.toLowerCase(),attributes:attrs,text:normalize(nodeText(node)),inlineStyle:attrs.style??'',computedStyle,boundingRect,visible:!!(boundingRect&&boundingRect.width>0&&boundingRect.height>0&&computedStyle.display!=='none'&&!['hidden','collapse'].includes(computedStyle.visibility)&&computedStyle.opacity!=='0')};
 }
 async function nativeSnapshot(){return snapshotIndex(await command('DOMSnapshot.captureSnapshot',{computedStyles:['visibility','display','opacity']}))}
 function resolveNative(nodes,snapshot,locator){
  if(!locator||!['role','text','form-control-label'].includes(locator.by))fail('INVALID_LOCATOR');
  let matches;
  if(locator.by==='role')matches=nodes.filter(n=>!n.ignored&&n.backendDOMNodeId&&snapshot.get(n.backendDOMNodeId)?.visibleInSnapshot&&n.role?.value===locator.role&&(locator.name===undefined||equal(n.name?.value,locator.name,locator.exact)));
  else if(locator.by==='form-control-label')matches=nodes.filter(n=>!n.ignored&&n.backendDOMNodeId&&snapshot.get(n.backendDOMNodeId)?.visibleInSnapshot&&(['input','textarea','select'].includes(snapshot.get(n.backendDOMNodeId)?.tagName)||['textbox','searchbox','spinbutton','combobox','listbox','checkbox','radio','switch','slider'].includes(n.role?.value))&&equal(n.name?.value,locator.label,locator.exact));
   else{
    const accessibleText=nodes.filter(n=>!n.ignored&&n.role?.value==='StaticText'&&n.backendDOMNodeId).map(n=>n.backendDOMNodeId);
   const elements=[...snapshot.values()].filter(n=>n.nodeType===1&&n.hasLayout&&equal(n.text,locator.text,locator.exact)&&accessibleText.some(id=>n.contains(id)));
   const deepest=elements.filter(n=>!elements.some(other=>other.backendNodeId!==n.backendNodeId&&n.contains(other.backendNodeId)));
   matches=deepest.map(n=>nodes.find(a=>a.backendDOMNodeId===n.backendNodeId)??{nodeId:'dom:'+n.backendNodeId,backendDOMNodeId:n.backendNodeId});
  }
  if(locator.within){const contexts=resolveNative(nodes,snapshot,locator.within);if(contexts.length!==1)fail('AMBIGUOUS_LOCATOR_CONTEXT',String(contexts.length));const scope=snapshot.get(contexts[0].backendDOMNodeId);if(!scope)fail('LOCATOR_CONTEXT_DOM_UNAVAILABLE');matches=matches.filter(n=>n.backendDOMNodeId!==scope.backendNodeId&&scope.contains(n.backendDOMNodeId));}
  return matches;
 }
  async function inspect({locator,selector,computedProperties=CSS_PROPS}={}){
   ready();const observedRender=current,capture={startedMs:performance.now(),clock:'node-performance-monotonic',atomic:false};if(selector===undefined)locator=clonePublicLocator(locator);const doc=await document();
   const rawSnapshot=await command('DOMSnapshot.captureSnapshot',{computedStyles:['visibility','display','opacity']});
   capture.snapshotCompletedMs=performance.now();const snapshot=snapshotIndex(rawSnapshot),nodes=await ax();capture.axCompletedMs=performance.now();let ids,matches;const contextBackendNodeIds=[];
   const rawSampleId='raw-observation-'+String(++rawSequence).padStart(5,'0'),rawSamplePath=join(observedRender.directory,rawSampleId+'.json');
   await writeFile(rawSamplePath,JSON.stringify({rawSampleId,observedAt:new Date().toISOString(),observerSha256,renderEpoch:observedRender.renderEpoch,capture,browserVersion,locator,selector,rawSnapshot,rawAX:nodes},null,2),{flag:'wx'});
   if(locator){const chain=[];for(let context=locator.within;context;context=context.within)chain.unshift(context);for(const context of chain){const found=resolveNative(nodes,snapshot,context);if(found.length!==1)fail('AMBIGUOUS_LOCATOR_CONTEXT',String(found.length));contextBackendNodeIds.push(found[0].backendDOMNodeId)}}
   if(selector!==undefined){if(typeof selector!=='string'||selector.length>4096)fail('INVALID_SELECTOR');const result=await command('DOM.querySelectorAll',{nodeId:doc.nodeId,selector});ids=await Promise.all(result.nodeIds.map(async nodeId=>(await command('DOM.describeNode',{nodeId})).node.backendNodeId))}
   else{matches=resolveNative(nodes,snapshot,locator);ids=matches.map(n=>n.backendDOMNodeId)}
   if(ids.length>1000)fail('OBSERVATION_TOO_LARGE');const elements=[];
   for(const id of ids){
    const element=await describe(id,computedProperties);element.visible=element.visible&&snapshot.get(id)?.visibleInSnapshot===true;if(selector===undefined&&!element.visible)continue;const a=nodes.find(n=>n.backendDOMNodeId===id&&!n.ignored)??nodes.find(n=>n.backendDOMNodeId===id);
    const axProperties=Object.fromEntries((a?.properties??[]).map(p=>[p.name,p.value?.value])),rendered=snapshot.get(id);
    const valueEvidence=decodeValueEvidence({element,snapshotEntry:rendered,axNode:a,browserVersion,calibrationPolicy});
    elements.push({...element,text:rendered?.text??null,textEvidence:rendered?'CDP.DOMSnapshot.layout-text-block-normalized':null,axProperties,enabled:!(axProperties.disabled===true||Object.hasOwn(element.attributes,'disabled')||element.attributes['aria-disabled']==='true'),checked:axProperties.checked??element.attributes['aria-checked']??null,role:a?.role?.value,name:a?.name?.value,...valueEvidence});
   }
   capture.completedMs=performance.now();if(observedRender.viewportEpoch!==viewportEpoch)fail('VIEWPORT_CHANGED','Observation viewport invalidated');if(observedRender.renderEpoch!==renderEpoch)fail('NO_RENDER','Observation render invalidated');await writeFile(join(observedRender.directory,rawSampleId+'-decoded.json'),JSON.stringify({rawSampleId,capture,renderEpoch:observedRender.renderEpoch,contextBackendNodeIds,browserVersion,calibrationPolicyId:calibrationPolicy?.policyId??null,elements},null,2),{flag:'wx'});
   return{renderId:observedRender.renderId,renderEpoch:observedRender.renderEpoch,viewportEpoch:observedRender.viewportEpoch,viewport:observedRender.viewport,contextBackendNodeIds,capture,rawSampleId,rawSamplePath,browserVersion,calibrationPolicyId:calibrationPolicy?.policyId??null,matchCount:elements.length,status:elements.length===1?'unique':elements.length?'ambiguous':'not-found',elements};
  }
  // Fixed native getter witness: no arbitrary caller code. BOTH session/render trust and
  // exact public on-disk fixture bytes are required. No Runtime.evaluate API is exposed.
  async function trustedValueWitness({selector}={}){
   ready();if(options.trustLevel!=='trusted-microfixture'||current.trustLevel!=='trusted-microfixture'||!witnessAllowed)fail('TRUSTED_FIXTURE_WITNESS_ONLY');
   if(typeof selector!=='string'||selector.length>4096)fail('INVALID_SELECTOR');
   const doc=await document(),{nodeIds}=await command('DOM.querySelectorAll',{nodeId:doc.nodeId,selector}),elements=[];
   for(const nodeId of nodeIds){const {node}=await command('DOM.describeNode',{nodeId}),{object}=await command('DOM.resolveNode',{backendNodeId:node.backendNodeId});
    try{const result=await command('Runtime.callFunctionOn',{objectId:object.objectId,returnByValue:true,silent:true,functionDeclaration:'function(){const w=this.ownerDocument.defaultView;const tag=this.localName;const p=tag==="input"?w.HTMLInputElement.prototype:tag==="textarea"?w.HTMLTextAreaElement.prototype:null;return {tag,type:tag==="input"?this.type:null,connected:this.isConnected,value:p?Object.getOwnPropertyDescriptor(p,"value").get.call(this):null,innerWidth:w.innerWidth,innerHeight:w.innerHeight};}'});if(result.exceptionDetails)fail('NATIVE_WITNESS_ERROR');elements.push({backendNodeId:node.backendNodeId,...result.result.value})}
    finally{await command('Runtime.releaseObject',{objectId:object.objectId})}
   }
   return{source:'trusted-only-native-prototype-value-getter',browserVersion,elements};
  }
  async function captureFacts(request={}){
   if(!request||Object.keys(request).some(k=>!['targets','includeDocument'].includes(k))||!Array.isArray(request.targets)||request.targets.length>100||request.includeDocument!==undefined&&typeof request.includeDocument!=='boolean')fail('INVALID_DOMAIN_REQUEST');
   const keys=new Set(),targets=request.targets.map(target=>{if(!target||Object.keys(target).some(k=>!['key','locator'].includes(k))||typeof target.key!=='string'||!/^[A-Za-z0-9_.:-]{1,128}$/.test(target.key)||keys.has(target.key))fail('INVALID_DOMAIN_TARGET');keys.add(target.key);const locator=clonePublicLocator(target.locator);return{key:target.key,locator}});
   ready();const observedRender=current,epoch=renderEpoch,viewEpoch=viewportEpoch,rawSampleId='raw-layout-'+String(++rawSequence).padStart(5,'0'),rawSamplePath=join(observedRender.directory,rawSampleId+'.json');
   const captureSpan={startedMs:performance.now(),clock:'node-performance-monotonic',singleDOMSnapshot:true,AXAndMetricsAtomicWithSnapshot:false};
   const raw={schemaVersion:LAYOUT_FACTS_SCHEMA,captureId:rawSampleId,rawSampleId,sourceSha256:observedRender.sourceSha256,entryContract:observedRender.entryContract,observerRevision:OBSERVER_REVISION,containerPolicyId:CONTAINER_POLICY_ID,observerSha256,entryHelperSha256,layoutHelperSha256,runtimeHashes:observedRender.runtimeHashes,compilerHashes:observedRender.compilerHashes,browserVersion,calibrationPolicyId:calibrationPolicy?.policyId??null,renderId:observedRender.renderId,renderEpoch:epoch,viewportEpoch:viewEpoch,requestedViewport:{...observedRender.viewport},viewport:null,frameId:null,identity:null,computedProperties:LAYOUT_COMPUTED_PROPERTIES,request:{targets,includeDocument:request.includeDocument!==false},captureSpan};let result;
   try{
    raw.metricsBefore=await command('Page.getLayoutMetrics');captureSpan.metricsBeforeCompletedMs=performance.now();
    raw.axBefore=await ax();captureSpan.axBeforeCompletedMs=performance.now();
    raw.snapshot=await command('DOMSnapshot.captureSnapshot',{computedStyles:LAYOUT_COMPUTED_PROPERTIES,includePaintOrder:true,includeDOMRects:true});captureSpan.snapshotCompletedMs=performance.now();
    raw.axAfter=await ax();captureSpan.axAfterCompletedMs=performance.now();
    raw.metricsAfter=await command('Page.getLayoutMetrics');captureSpan.metricsAfterCompletedMs=performance.now();
    const frameBefore=raw.axBefore.find(n=>n.frameId)?.frameId,frameAfter=raw.axAfter.find(n=>n.frameId)?.frameId;
    raw.frameId=frameBefore??null;raw.frameIdAfter=frameAfter??null;if(!frameBefore||frameBefore!==frameAfter)fail('DOMAIN_LOCATOR_CHANGED','Candidate frame changed around snapshot');
    const mb=raw.metricsBefore.cssLayoutViewport,ma=raw.metricsAfter.cssLayoutViewport;
    if(ma)raw.viewport={width:ma.clientWidth,height:ma.clientHeight,pageX:ma.pageX,pageY:ma.pageY};if(!mb||!ma||!Number.isFinite(ma.clientWidth)||!Number.isFinite(ma.clientHeight))fail('DOMAIN_METRICS_UNAVAILABLE');
    if(mb.clientWidth!==ma.clientWidth||mb.clientHeight!==ma.clientHeight||mb.pageX!==ma.pageX||mb.pageY!==ma.pageY||epoch!==renderEpoch||viewEpoch!==viewportEpoch)fail('VIEWPORT_CHANGED','Capture crossed viewport/render epoch');
    const native=snapshotIndex(raw.snapshot),layout=snapshotLayoutFacts(raw.snapshot,frameBefore);
    if(layout.document.scrollOffsetX!==ma.pageX||layout.document.scrollOffsetY!==ma.pageY)fail('DOMAIN_VIEWPORT_OFFSET_CHANGED');
    const axIdentity=n=>n?{backendNodeId:n.backendDOMNodeId,ignored:n.ignored??false,role:n.role?.value,name:n.name?.value,value:n.value??null,properties:Object.fromEntries((n.properties??[]).map(p=>[p.name,p.value]).sort(([a],[b])=>a.localeCompare(b)))}:null;
    const contexts=(nodes,locator)=>{const chain=[];for(let c=locator.within;c;c=c.within)chain.unshift(c);return chain.map(c=>{const matches=resolveNative(nodes,native,c);if(matches.length!==1)fail('AMBIGUOUS_LOCATOR_CONTEXT',String(matches.length));return matches[0].backendDOMNodeId})};
    const factsTargets=[];
    for(const target of targets){
     const before=resolveNative(raw.axBefore,native,target.locator).map(n=>n.backendDOMNodeId).sort((a,b)=>a-b),after=resolveNative(raw.axAfter,native,target.locator).map(n=>n.backendDOMNodeId).sort((a,b)=>a-b),beforeContexts=contexts(raw.axBefore,target.locator),afterContexts=contexts(raw.axAfter,target.locator);
     if(JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(beforeContexts)!==JSON.stringify(afterContexts))fail('DOMAIN_LOCATOR_CHANGED',target.key);
     for(const id of [...before,...beforeContexts])if(JSON.stringify(axIdentity(raw.axBefore.find(n=>n.backendDOMNodeId===id&&!n.ignored)))!==JSON.stringify(axIdentity(raw.axAfter.find(n=>n.backendDOMNodeId===id&&!n.ignored))))fail('DOMAIN_LOCATOR_CHANGED','AX semantic state changed around snapshot');
     const nodes=before.map(id=>{const n=layout.byBackendId.get(id);if(!n)fail('DOMAIN_SNAPSHOT_NODE_MISSING',String(id));const a=raw.axAfter.find(x=>x.backendDOMNodeId===id&&!x.ignored),properties=Object.fromEntries((a?.properties??[]).map(p=>[p.name,p.value?.value])),rendered=native.get(id),value=decodeValueEvidence({element:{...n,visible:n.layout.visible},snapshotEntry:rendered,axNode:a,browserVersion,calibrationPolicy});return{...n,boundingRect:n.layout.bounds?{x:n.layout.bounds.x,y:n.layout.bounds.y,width:n.layout.bounds.width,height:n.layout.bounds.height,w:n.layout.bounds.width,h:n.layout.bounds.height}:null,visible:n.layout.visible,text:rendered?.text??null,textEvidence:'same-CDP-DOMSnapshot-layout-text',computedStyle:Object.fromEntries(Object.entries(n.computed).map(([k,v])=>[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),role:a?.role?.value,name:a?.name?.value,enabled:!(properties.disabled===true||Object.hasOwn(n.attributes,'disabled')||n.attributes['aria-disabled']==='true'),axProperties:properties,layoutContexts:n.ancestorBackendNodeIds.map(id=>layout.byBackendId.get(id)).filter(n=>n?.nodeType===1).map(n=>({backendNodeId:n.backendNodeId,parentBackendNodeId:n.parentBackendNodeId,tagName:n.tagName,computed:n.computed,bounds:n.layout.bounds})),...value}}).filter(n=>n.layout.visible);
     factsTargets.push({key:target.key,locator:target.locator,matchCount:nodes.length,status:nodes.length===1?'unique':nodes.length?'ambiguous':'not-found',contextBackendNodeIds:beforeContexts,backendNodeIds:nodes.map(n=>n.backendNodeId),nodes});
    }
    const document=request.includeDocument===false?null:{...layout.document,layoutViewport:{width:ma.clientWidth,height:ma.clientHeight,pageX:ma.pageX,pageY:ma.pageY,source:'CDP.Page.getLayoutMetrics stable bracket with snapshot scroll offsets'},viewport:{width:ma.clientWidth,height:ma.clientHeight,requested:{...viewport},source:'CDP.Page.getLayoutMetrics bracketed stable CSS layout viewport'}};
    const identity={renderId:observedRender.renderId,renderEpoch:epoch,viewportEpoch:viewEpoch,viewport:{width:ma.clientWidth,height:ma.clientHeight},frameId:frameBefore,targets:factsTargets.map(t=>({key:t.key,locatorDigest:sha256(JSON.stringify(t.locator)),backendNodeIds:t.backendNodeIds,contextBackendNodeIds:t.contextBackendNodeIds}))};
    const journal=journalSnapshot();if(!journal.available||!journal.complete)fail('RUNTIME_JOURNAL_INCOMPLETE');result={state:'ok',facts:{schemaVersion:LAYOUT_FACTS_SCHEMA,targets:factsTargets,document,runtimeJournal:journal,runtimeErrors:journal.events,pageErrors:[...pageErrors]},identity};
   }catch(error){const detail={code:error.code??'DOMAIN_COLLECTION_ERROR',message:error.message};raw.error=detail;result={state:COLLECTION_FATAL_CODES.has(detail.code)?'error':'unknown',error:detail}}
   finally{raw.identity=result?.identity??null;raw.acquisitionState=result?.state??'unknown';raw.runtimeJournal=journalSnapshot();captureSpan.completedMs=performance.now();captureSpan.durationMs=captureSpan.completedMs-captureSpan.startedMs;await writeFile(rawSamplePath,JSON.stringify(raw,null,2),{flag:'wx'})}
   result.evidence={captureId:rawSampleId,receipt:Object.fromEntries(['sourceSha256','entryHelperSha256','entryContract','renderId','renderEpoch','viewport','viewportEpoch','observerSha256','observerRevision','containerPolicyId','containerRevision','layoutHelperSha256','runtimeHashes','compilerHashes','browserVersion','calibrationPolicyId'].map(k=>[k,structuredClone(observedRender[k])])),geometryVector:result.state==='ok'?[...result.facts.targets.flatMap(t=>t.nodes.flatMap(n=>[n.layout.bounds.x,n.layout.bounds.y,n.layout.bounds.width,n.layout.bounds.height])),...(result.facts.document?[result.facts.document.contentWidth,result.facts.document.contentHeight,result.facts.document.layoutViewport.width,result.facts.document.layoutViewport.height,result.facts.document.layoutViewport.pageX,result.facts.document.layoutViewport.pageY]:[])]:null,rawSampleId,rawSamplePath,captureSpan,singleSnapshot:true,axBracketStable:result.state==='ok',observerSha256,entryHelperSha256,layoutHelperSha256,browserVersion,calibrationPolicyId:calibrationPolicy?.policyId??null,remainingBudgetPropagatedToCDP:false,cdpCommandTimeoutMs:timeout};
   if(result.state==='ok'&&(epoch!==renderEpoch||viewEpoch!==viewportEpoch))return{state:'unknown',error:{code:'VIEWPORT_CHANGED',message:'Capture invalidated before completion'},evidence:result.evidence};
   return result;
  }
  async function trustedLayoutWitness({selectors=[]}={}){
   ready();if(options.trustLevel!=='trusted-microfixture'||current.trustLevel!=='trusted-microfixture'||!witnessAllowed)fail('TRUSTED_FIXTURE_WITNESS_ONLY');
   if(!Array.isArray(selectors)||selectors.length>100||selectors.some(s=>typeof s!=='string'||s.length>4096))fail('INVALID_SELECTOR');
   const startedMs=performance.now(),doc=await document(),elements=[];
   async function callNative(backendNodeId,documentOnly=false){const{object}=await command('DOM.resolveNode',{backendNodeId});try{const result=await command('Runtime.callFunctionOn',{objectId:object.objectId,returnByValue:true,silent:true,functionDeclaration:documentOnly?'function(){const d=this.nodeType===9?this:this.ownerDocument,w=d.defaultView,e=d.scrollingElement,p=w.Element.prototype,g=n=>Object.getOwnPropertyDescriptor(p,n).get.call(e);return {scrollWidth:g("scrollWidth"),scrollHeight:g("scrollHeight"),clientWidth:g("clientWidth"),clientHeight:g("clientHeight"),innerWidth:w.innerWidth,innerHeight:w.innerHeight,scrollX:w.scrollX,scrollY:w.scrollY};}':'function(){const w=this.ownerDocument.defaultView;const read=n=>{const r=w.Element.prototype.getBoundingClientRect.call(n),s=w.getComputedStyle(n);return {id:n.id,bounds:{x:r.x+w.scrollX,y:r.y+w.scrollY,width:r.width,height:r.height,right:r.right+w.scrollX,bottom:r.bottom+w.scrollY},computed:Object.fromEntries('+JSON.stringify(LAYOUT_COMPUTED_PROPERTIES)+'.map(k=>[k,s.getPropertyValue(k)])),connected:n.isConnected}};return {...read(this),children:Array.from(this.children).map(read)};}'});if(result.exceptionDetails)fail('NATIVE_LAYOUT_WITNESS_ERROR');return result.result.value}finally{await command('Runtime.releaseObject',{objectId:object.objectId})}}
   for(const selector of selectors){const{nodeIds}=await command('DOM.querySelectorAll',{nodeId:doc.nodeId,selector});for(const nodeId of nodeIds){const{node}=await command('DOM.describeNode',{nodeId});elements.push({selector,backendNodeId:node.backendNodeId,...await callNative(node.backendNodeId)})}}
   const documentFacts=await callNative(doc.backendNodeId,true);return{source:'trusted-only-native-layout-and-scrolling-getters',elements,document:documentFacts,browserVersion,captureSpan:{startedMs,completedMs:performance.now(),atomic:false}};
  }
  function valueCollector(request){
   if(!request||Object.keys(request).some(k=>!['locator','selector'].includes(k))||('locator'in request)===('selector'in request))fail('INVALID_VALUE_COLLECTION_REQUEST');
   if(request.selector!==undefined&&options.trustLevel!=='trusted-microfixture')fail('TRUSTED_SELECTOR_COLLECTION_ONLY');
   const query=request.selector!==undefined?{selector:request.selector}:{locator:clonePublicLocator(request.locator)};
   return async function collect({signal,remainingMs,sequence}={}){
    const budgetEvidence={sequence,requestedRemainingMs:remainingMs,deadlineAuthority:'outer-node-measurer',cdpCommandTimeoutMs:timeout,remainingBudgetPropagatedToCDP:false};
    if(!Number.isFinite(remainingMs)||remainingMs<=0)return{state:'unknown',error:collectionErrorRecord({code:'OBSERVATION_BUDGET_EXHAUSTED',message:'No remaining outer observation budget'}),evidence:budgetEvidence};
    let onAbort;
    const interrupted=new Promise(resolve=>{onAbort=()=>{void abortRender().catch(()=>{});resolve({interrupted:true})};signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort()});
    try{
     const result=await Promise.race([signal?.aborted?interrupted:withEpoch(inspect)(query),interrupted]);
     if(result.interrupted||signal?.aborted)return{state:'unknown',error:collectionErrorRecord({code:'ABORTED',message:'Outer measurer aborted collection'}),evidence:budgetEvidence};
     const e=result.elements[0],evidence={...budgetEvidence,rawSampleId:result.rawSampleId,rawSamplePath:result.rawSamplePath,capture:result.capture,browserVersion,calibrationPolicyId:result.calibrationPolicyId,...(e?{valueState:collectionValueState(e),rawPresence:e.rawPresence,source:e.source}:{} )};
     if(result.matchCount!==1)return{state:'unknown',error:collectionErrorRecord({code:'VALUE_TARGET_'+result.status.toUpperCase().replaceAll('-','_'),message:'Value target is '+result.status}),evidence};
     const identity={renderId:result.renderId,renderEpoch:result.renderEpoch,viewportEpoch:result.viewportEpoch,viewport:result.viewport,backendNodeId:e.backendNodeId,contextBackendNodeIds:result.contextBackendNodeIds,type:e.type};
     return e.valueState==='available'?{state:'ok',actual:e.value,identity,evidence}:{state:'unknown',error:collectionErrorRecord({code:e.valueError,message:e.valueError}),identity,evidence};
    }catch(error){const record=collectionErrorRecord(error);return{state:COLLECTION_FATAL_CODES.has(record.code)?'error':'unknown',error:record,evidence:budgetEvidence}}finally{signal?.removeEventListener('abort',onAbort)}
   };
  }
  async function layoutMetrics(){ready();const result=await command('Page.getLayoutMetrics');if(!result.cssContentSize||!result.cssLayoutViewport)fail('CSS_LAYOUT_METRICS_UNAVAILABLE');return{contentSize:result.cssContentSize,layoutViewport:result.cssLayoutViewport,visualViewport:result.cssVisualViewport,source:'CDP.Page.getLayoutMetrics',candidateFrame:!!candidateSid}}
 async function observe(request){const result=await inspect(request);return{...result,actual:result.matchCount===1?result.elements[0]:null}}
 async function act({locator,action,value,key}){ready();if(!['click','fill','key'].includes(action))fail('UNSUPPORTED_ACTION');if(action==='key')keyboardEventPacket(key,'keyDown');replayStage={kind:'action',action,sequence:++replaySequence};locator=clonePublicLocator(locator);await document();const matches=resolveNative(await ax(),await nativeSnapshot(),locator);if(matches.length!==1)fail('ACTION_LOCATOR_NOT_UNIQUE',String(matches.length));const backendNodeId=matches[0].backendDOMNodeId;if(!(await describe(backendNodeId)).visible)fail('ACTION_TARGET_NOT_VISIBLE');
  if(action==='click'){await command('DOM.scrollIntoViewIfNeeded',{backendNodeId});const e=await describe(backendNodeId);if(!e.visible)fail('ACTION_TARGET_NOT_VISIBLE');const r=e.boundingRect,x=r.x+r.width/2,y=r.y+r.height/2;const {cssLayoutViewport}=await command('Page.getLayoutMetrics');if(!cssLayoutViewport||!Number.isFinite(cssLayoutViewport.pageX)||!Number.isFinite(cssLayoutViewport.pageY))fail('CSS_LAYOUT_METRICS_UNAVAILABLE');const hitX=Math.round(x+cssLayoutViewport.pageX),hitY=Math.round(y+cssLayoutViewport.pageY),hit=await command('DOM.getNodeForLocation',{x:hitX,y:hitY,includeUserAgentShadowDOM:true});if(hit.backendNodeId!==backendNodeId){const{node}=await command('DOM.describeNode',{backendNodeId,depth:-1});const contains=n=>n.backendNodeId===hit.backendNodeId||(n.children??[]).some(contains);if(!contains(node))fail('ACTION_TARGET_OCCLUDED')}
   await command('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await command('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await command('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await sleep(60);return{action,inputMode:'headless-cdp-real-coordinate-not-human',x,y,backendNodeId,hitTest:{coordinateSpace:'document-css',x:hitX,y:hitY},pointer:{coordinateSpace:'viewport-css',x,y},scrollOffset:{pageX:cssLayoutViewport.pageX,pageY:cssLayoutViewport.pageY}};}
  if(action==='fill'){const target=await describe(backendNodeId);if(Object.hasOwn(target.attributes,'disabled')||Object.hasOwn(target.attributes,'readonly'))fail('ACTION_TARGET_NOT_EDITABLE')}
   await command('DOM.focus',{backendNodeId});
  if(action==='fill'){if(typeof value!=='string'||value.length>10000)fail('INVALID_FILL_VALUE');for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});if(value===''){for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8})}else await command('Input.insertText',{text:value})}
  else if(action==='key'){for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',keyboardEventPacket(key,type))}else fail('UNSUPPORTED_ACTION');await sleep(60);return{action,inputMode:'headless-cdp-keyboard-not-human',backendNodeId};
 }
 async function render(request){if(closed)fail('SESSION_CLOSED');if(renderInFlight||cleanupPromise||viewportTransition)fail('RENDER_LIFECYCLE_BUSY');if(cleanupFailure)fail('BROWSER_CLEANUP_FAILED',cleanupFailure.message);renderInFlight=true;abortPromise=null;endObservation('new-render');++renderEpoch;++viewportEpoch;try{const result=await renderInner(request);lastRenderRequest={...request,sourceBytes:Buffer.from(request.sourceBytes),staticGate:structuredClone(request.staticGate)};return result}finally{renderInFlight=false}}
  async function renderInner(request){const gate=validateExecution(request,options);replaySequence=0;replayStage={kind:'render',sequence:0};runtimeJournal={renderEpoch,startedAtMs:performance.now(),sourceSha256:gate.sourceSha256,entryContract:gate.entryContract,available:false,complete:false,firstEventSequence:runtimeEventSequence+1,lastEventSequence:runtimeEventSequence,events:[],droppedEvents:0,targets:[]};runtimeJournals.push(runtimeJournal);witnessAllowed=false;if(request.fixturePath&&options.trustLevel==='trusted-microfixture'){const path=resolve(request.fixturePath),allowed=(options.trustedFixturePaths??[]).map(p=>resolve(p));if(allowed.includes(path)){const bytes=await readFile(path);if(sha256(bytes)!==sha256(request.sourceBytes))fail('FIXTURE_BYTES_MISMATCH');witnessAllowed=true}};await kill();candidateSid=null;candidateConfig=null;configuredTargets=[];pageErrors=[];current=null;violations=[];protocolFailure=null;if(request.viewport)viewport=request.viewport;
  const renderId=request.artifactId??`render-${String(++sequence).padStart(4,'0')}`;if(!/^[A-Za-z0-9_-]{1,100}$/.test(renderId))fail('INVALID_ARTIFACT_ID');const directory=join(options.artifactRoot,renderId);await mkdir(directory,{recursive:false});await writeFile(join(directory,request.format==='html'?'source.html':'source.jsx'),request.sourceBytes,{flag:'wx'});const envelope=await buildEnvelope({...request,runtimeDir:options.runtimeDir});if(calibrationPolicy&&JSON.stringify(calibrationPolicy.runtimeHashes)!==JSON.stringify(envelope.runtimeHashes))fail('CALIBRATION_RUNTIME_MISMATCH');if(calibrationPolicy)for(const[name,hash]of Object.entries(envelope.compilerHashes))if(calibrationPolicy.compilerHashes?.[name]!==hash)fail('CALIBRATION_COMPILER_HASH_MISMATCH',name);if(envelope.compiled!==null)await writeFile(join(directory,'compiled.js'),envelope.compiled,{flag:'wx'});await writeFile(join(directory,'envelope.html'),envelope.document,{flag:'wx'});
  runtimeJournal.renderId=renderId;const receipt={observerRevision:OBSERVER_REVISION,containerPolicyId:CONTAINER_POLICY_ID,containerRevision:CONTAINER_POLICY.revision,calibrationPolicyId:calibrationPolicy?.policyId??null,observerSha256,entryHelperSha256,layoutHelperSha256,renderEpoch,viewportEpoch,viewportNormalization:VIEWPORT_NORMALIZATION,observerCorrectionStage:'post-freeze-infrastructure-correction',renderId,format:request.format,trustLevel:request.trustLevel,staticGate:gate,containment:CONTAINMENT,osNetworkIsolation:'notClaimed',authorizationText:options.authorizationText??null,sourceSha256:envelope.sourceSha256,compiledSha256:envelope.compiledSha256,envelopeSha256:envelope.envelopeSha256,runtimeHashes:envelope.runtimeHashes,compilerHashes:envelope.compilerHashes,runtimeSupply:envelope.runtimeSupply,compilerSupply:envelope.compilerSupply,sourceByteLength:envelope.sourceByteLength,executionEnvelopeBytes:envelope.executionEnvelopeBytes,entryContract:envelope.entryContract,entrySelection:envelope.entrySelection??null,viewport,directory};await writeFile(join(directory,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
  try{await launch();await cdp.send('Page.navigate',{url:'data:text/html;base64,'+Buffer.from(envelope.document).toString('base64')},sid);const deadline=Date.now()+timeout;let done=false,lastError;while(Date.now()<deadline){if(protocolFailure)fail('CONTAINMENT_CONTROL_FAILED',protocolFailure);try{await ax();await document();done=true;break}catch(e){lastError=e.message;if(e.code==='CDP_TIMEOUT')throw e}await sleep(50)}if(!done)fail('RENDER_FRAME_TIMEOUT',JSON.stringify({lastError,violations}));if(candidateConfig)await candidateConfig;await sleep(options.settleMs??150);if(protocolFailure)fail('CONTAINMENT_CONTROL_FAILED',protocolFailure);receipt.browserVersion=browserVersion;current=receipt;const result={...receipt,browserVersion,runtimeJournal:journalSnapshot(),controlsConfigured:true,configuredTargetCount:configuredTargets.length,violations:[...violations],pageErrors:[...pageErrors]};await writeFile(join(directory,'execution.json'),JSON.stringify(result,null,2),{flag:'wx'});return result}catch(e){await kill();throw e}
 }
 return{render,act:withEpoch(act),observe:withEpoch(observe),inspect:withEpoch(inspect),layoutMetrics:withEpoch(layoutMetrics),setViewport,reload,captureFacts:withEpoch(captureFacts),trustedLayoutWitness:withEpoch(trustedLayoutWitness),valueCollector,trustedValueWitness:withEpoch(trustedValueWitness),abortRender,async close(){closed=true;await abortRender()},get diagnostics(){return{observerProvenance:{observerRevision:OBSERVER_REVISION,observerSha256,entryHelperSha256,layoutHelperSha256,containerPolicyId:CONTAINER_POLICY_ID,browserVersion,calibrationPolicyId:calibrationPolicy?.policyId??null},networkJournal:{scope:'external-scheme CDP target network events; not OS packet monitoring',available:configuredTargets.length>0,complete:networkDroppedEvents===0,droppedEvents:networkDroppedEvents,events:structuredClone(networkEvents)},containment:CONTAINMENT,violations:[...violations],pageErrors:[...pageErrors],protocolFailure,runtimeJournal:journalSnapshot(),current,renderEpoch,viewportEpoch,viewportTransitionPending:!!viewportTransition,renderInFlight,cleanupPending:!!cleanupPromise,cleanupFailure,ownedProcesses:[...ownedProcesses]}}};
}
export const startBrowserSession=start;
export const NAMED_KEY_BINDINGS=Object.freeze({Enter:13,Tab:9,Escape:27,Backspace:8,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,' ':32});
export function keyboardEventPacket(key,type){if(typeof key!=='string'||!Object.hasOwn(NAMED_KEY_BINDINGS,key)||!['keyDown','keyUp'].includes(type))fail('UNSUPPORTED_KEY');return{type,key,code:key===' '?'Space':key,windowsVirtualKeyCode:NAMED_KEY_BINDINGS[key],...(type==='keyDown'&&(key==='Enter'||key===' ')?{text:key==='Enter'?'\r':' '}:{})}}

// No attributes.value or textContent fallback. Missing entries remain facts, not values.
export const CALIBRATION_POLICY_SCHEMA='r3-layout-value-native-witness-v1';
export const browserVersionKey=version=>sha256(JSON.stringify(Object.fromEntries(Object.entries(version??{}).sort(([a],[b])=>a.localeCompare(b)))));
export function valueTypeKey(element){return element?.tagName==='textarea'?'textarea':element?.tagName==='input'?'input:'+(element.attributes?.type??'text').toLowerCase():null}
export function channelEncoding(channel){
 if(!channel?.fieldPresent)return 'field-missing';
 if(!channel.entryPresent)return 'entry-absent';
 if(channel.stringIndex===-1&&channel.value===undefined)return 'string-index-minus-one';
 return typeof channel.value==='string'?'string-present':'malformed';
}
export function decodeValueEvidence({element,snapshotEntry,axNode,browserVersion,calibrationPolicy}){
 const type=valueTypeKey(element),channels=snapshotEntry?.valueChannels??{};
 const rawPresence={snapshotNode:!!snapshotEntry,axNode:!!axNode,axIgnored:axNode?.ignored??null,hasLayout:snapshotEntry?.hasLayout??null,textValue:channels.textValue??null,inputValue:channels.inputValue??null,axValue:Object.hasOwn(axNode??{},'value')?{entryPresent:true,type:axNode.value?.type??null,value:axNode.value?.value}:{entryPresent:false}};
 const base={value:null,valueState:'unavailable',rawPresence,source:[],browserVersion,calibrationPolicyId:calibrationPolicy?.policyId??null,type};
 if(!type||!['textarea','input:text','input:search','input:tel','input:url','input:email','input:password','input:number'].includes(type))return{...base,valueState:'unsupported',valueError:'VALUE_TYPE_UNSUPPORTED'};
 if(!snapshotEntry)return{...base,valueError:'SNAPSHOT_NODE_MISSING'};
 if(!element.visible||!snapshotEntry.hasLayout||!axNode||axNode.ignored)return{...base,valueError:'VALUE_TARGET_INELIGIBLE'};
 try{if(calibrationPolicy)calibrationPolicy=verifyCalibrationPolicy(calibrationPolicy)}catch{return{...base,valueError:'CALIBRATION_POLICY_INVALID'}}
 const encodings={textValue:channelEncoding(channels.textValue),inputValue:channelEncoding(channels.inputValue),axValue:rawPresence.axValue.entryPresent?'present':'absent'};
 if(type==='input:number'){
   // Numeric AX values are lossy semantic numbers (00->0, 1e2->100), never raw strings.
   // Preserve the live DOM inputValue string; absence is never repaired from AX.
   if(encodings.inputValue==='string-present'){
    const value=channels.inputValue.value;
    if(encodings.textValue!=='entry-absent')return{...base,valueError:'NUMBER_VALUE_CHANNEL_SHAPE_UNSUPPORTED'};
    const source=['DOMSnapshot.inputValue'];
    if(rawPresence.axValue.entryPresent){
     if(axNode.value?.type!=='number'||typeof axNode.value.value!=='number'||!Number.isFinite(axNode.value.value))return{...base,valueError:'AX_VALUE_MALFORMED'};
     if(value===''||!/^\-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value)||!Number.isFinite(Number(value))||Number(value)!==axNode.value.value)return{...base,valueError:'VALUE_CHANNEL_CONFLICT'};
     const numericRule=calibrationPolicy?.rules?.find(r=>r.type==='input:number'&&r.browserVersionKey===browserVersionKey(browserVersion)&&r.numberAXSemantics==='finite-number-equivalence-preserve-DOM-string');
     if(value!==String(axNode.value.value)&&!numericRule)return{...base,valueError:'NUMBER_AX_SEMANTICS_UNCALIBRATED'};
     source.push('Accessibility.numeric-equivalence-only');
    }
    return{...base,valueState:'available',value,source};
   }
   if(rawPresence.axValue.entryPresent)return{...base,valueError:encodings.inputValue==='string-index-minus-one'?'VALUE_CHANNEL_CONFLICT':'NUMBER_RAW_STRING_UNAVAILABLE'};
   if(encodings.textValue==='string-present')return{...base,valueError:'NUMBER_RAW_STRING_UNAVAILABLE'};
  }
 const readings=[];let sentinel=false;
 for(const name of ['textValue','inputValue']){
  if(encodings[name]==='string-index-minus-one')sentinel=true;
  else if(channels[name]?.entryPresent){if(encodings[name]!=='string-present')return{...base,valueError:'SNAPSHOT_VALUE_MALFORMED'};readings.push({source:'DOMSnapshot.'+name,value:channels[name].value})}
 }
 if(rawPresence.axValue.entryPresent){if(!['string','number'].includes(typeof axNode.value?.value))return{...base,valueError:'AX_VALUE_MALFORMED'};readings.push({source:'Accessibility.value',value:String(axNode.value.value)})}
 if(readings.length){
  if(new Set(readings.map(r=>r.value)).size!==1||sentinel)return{...base,source:readings.map(r=>r.source),valueError:'VALUE_CHANNEL_CONFLICT',readings};
  return{...base,valueState:'available',value:readings[0].value,source:readings.map(r=>r.source)};
 }
 // The only admitted empty shape is the actually witnessed build/type-specific shape.
 // Uncalibrated -1, missing fields, double omission, absent/hidden nodes stay unavailable.
 const rule=calibrationPolicy?.schema===CALIBRATION_POLICY_SCHEMA&&calibrationPolicy?.rules?.find(r=>r.browserVersionKey===browserVersionKey(browserVersion)&&r.type===type&&r.emptyMeansEmpty===true&&r.validated===true&&validEmptyEncoding(r.type,r.emptyEncoding)&&['textValue','inputValue','axValue'].every(k=>r.emptyEncoding?.[k]===encodings[k]));
 if(rule&&axNode&&!axNode.ignored&&snapshotEntry.hasLayout&&element?.visible&&channels.textValue?.fieldPresent&&channels.inputValue?.fieldPresent){return{...base,valueState:'available',value:'',source:['calibrated-DOMSnapshot-AX-empty-encoding'],calibrationRuleId:rule.ruleId}}
 return{...base,valueError:sentinel?'VALUE_UNAVAILABLE_UNCALIBRATED_SENTINEL':'VALUE_UNAVAILABLE_UNCALIBRATED_OMISSION'};
}
// Stable Node collector contract: measurement-r2 inspects valueState.status and error.code.
const COLLECTION_FATAL_CODES=new Set(['SESSION_CLOSED','NO_RENDER','CONTAINMENT_CONTROL_FAILED','SNAPSHOT_NODE_LIMIT','CDP_CLOSED','CDP_SOCKET_ERROR','PAGE_RUNTIME_ERROR']);
const COLLECTION_ERROR_CODES=new Set([...COLLECTION_FATAL_CODES,'COLLECTION_ERROR','OBSERVATION_BUDGET_EXHAUSTED','VALUE_TARGET_NOT_FOUND','VALUE_TARGET_AMBIGUOUS','VALUE_TYPE_UNSUPPORTED','SNAPSHOT_NODE_MISSING','SNAPSHOT_VALUE_MALFORMED','AX_VALUE_MALFORMED','VALUE_CHANNEL_CONFLICT','VALUE_UNAVAILABLE_UNCALIBRATED_SENTINEL','VALUE_UNAVAILABLE_UNCALIBRATED_OMISSION','OBSERVATION_TOO_LARGE','INVALID_SELECTOR','INVALID_LOCATOR','AMBIGUOUS_LOCATOR_CONTEXT','LOCATOR_CONTEXT_DOM_UNAVAILABLE','CANDIDATE_DOCUMENT_UNAVAILABLE','CANDIDATE_FRAME_UNAVAILABLE','CDP_ERROR','CDP_TIMEOUT','ABORTED','VALUE_TARGET_INELIGIBLE','CALIBRATION_POLICY_INVALID','BROWSER_CLEANUP_FAILED','RENDER_LIFECYCLE_BUSY','INVALID_VALUE_COLLECTION_REQUEST','TRUSTED_SELECTOR_COLLECTION_ONLY','VIEWPORT_CHANGED','VIEWPORT_TRANSITION_PENDING','DOMAIN_LOCATOR_CHANGED','DOMAIN_SNAPSHOT_NODE_MISSING','DOMAIN_METRICS_UNAVAILABLE','DOMAIN_UNSUPPORTED_ENCODING','NUMBER_VALUE_CHANNEL_SHAPE_UNSUPPORTED','NUMBER_AX_SEMANTICS_UNCALIBRATED','NUMBER_RAW_STRING_UNAVAILABLE']);
export function collectionErrorRecord(error){
 const message=String(error?.message??error??'Collection error');
 const candidate=typeof error?.code==='string'?error.code:message.split(':',1)[0];
 return{code:COLLECTION_ERROR_CODES.has(candidate)?candidate:'COLLECTION_ERROR',message};
}
export function collectionValueState(element){
 return{status:element.valueState,rawPresence:element.rawPresence,source:element.source,browserVersion:element.browserVersion,calibrationPolicyId:element.calibrationPolicyId,calibrationRuleId:element.calibrationRuleId??null,type:element.type,error:element.valueError?collectionErrorRecord({code:element.valueError,message:element.valueError}):null};
}
export function clonePublicLocator(locator,depth=0){
 if(depth>8||!locator||Object.getPrototypeOf(locator)!==Object.prototype||!['role','text','form-control-label'].includes(locator.by))fail('INVALID_LOCATOR');
 const valueKey=locator.by==='form-control-label'?'label':locator.by,keys=locator.by==='role'?['by','role','name','exact','within']:['by',valueKey,'exact','within'];
 if(Object.keys(locator).some(k=>!keys.includes(k)))fail('INVALID_LOCATOR','Unknown field');
 if(typeof locator[valueKey]!=='string'||!locator[valueKey].length||locator[valueKey].length>4096||('name'in locator&&(typeof locator.name!=='string'||locator.name.length>4096))||('exact'in locator&&typeof locator.exact!=='boolean'))fail('INVALID_LOCATOR');
 const copy={by:locator.by,[valueKey]:locator[valueKey]};if('name'in locator)copy.name=locator.name;if('exact'in locator)copy.exact=locator.exact;if('within'in locator)copy.within=clonePublicLocator(locator.within,depth+1);return Object.freeze(copy);
}const verifiedCalibrationPolicies=new WeakSet();
export function validEmptyEncoding(type,encoding){
 return ['input:text','input:number','textarea'].includes(type)&&encoding&&Object.keys(encoding).length===3&&encoding.axValue==='absent'&&encoding.textValue===(type==='textarea'?'string-index-minus-one':'entry-absent')&&encoding.inputValue===(type==='textarea'?'entry-absent':'string-index-minus-one');
}
export function verifyCalibrationPolicy(input){
 if(verifiedCalibrationPolicies.has(input))return input;
 if(!input||typeof input!=='object'||Array.isArray(input))fail('CALIBRATION_POLICY_INVALID');
 const policy=structuredClone(input),{policyId,...body}=policy;
 if(policy.schema!==CALIBRATION_POLICY_SCHEMA||policyId!=='r3-calibration-'+sha256(JSON.stringify(body)))fail('CALIBRATION_POLICY_DIGEST_MISMATCH');
 const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 if(!hash(policy.observerSha256)||!hash(policy.runnerSha256)||!hash(policy.entryHelperSha256)||!hash(policy.layoutHelperSha256)||!policy.runtimeHashes||!Object.values(policy.runtimeHashes).every(hash)||!policy.fixtureHashes||!Object.values(policy.fixtureHashes).every(hash)||!Array.isArray(policy.rules)||!policy.rules.length)fail('CALIBRATION_POLICY_INVALID');
 if(policy.containerPolicyId!==CONTAINER_POLICY_ID)fail('CALIBRATION_CONTAINER_POLICY_MISMATCH');
 if(JSON.stringify(policy.domainRules)!==JSON.stringify(DOMAIN_RULES))fail('CALIBRATION_DOMAIN_RULES_INVALID');
 if(!policy.compilerHashes||!hash(policy.compilerHashes['babel.standalone.js']))fail('CALIBRATION_COMPILER_HASHES_INVALID');
 if(!policy.browserVersion||['protocolVersion','product','revision','userAgent','jsVersion'].some(k=>typeof policy.browserVersion[k]!=='string'||!policy.browserVersion[k]))fail('CALIBRATION_BROWSER_VERSION_INVALID');
 if(!['react.umd.js','react-dom.umd.js'].every(k=>hash(policy.runtimeHashes[k])))fail('CALIBRATION_RUNTIME_HASHES_INVALID');
 const version=browserVersionKey(policy.browserVersion),types=new Set();
 for(const rule of policy.rules){if(types.has(rule.type)||rule.browserVersionKey!==version||rule.validated!==true||rule.emptyMeansEmpty!==true||!validEmptyEncoding(rule.type,rule.emptyEncoding)||!Number.isInteger(rule.emptyWitnessCount)||rule.emptyWitnessCount<4||!Number.isInteger(rule.nonemptyWitnessCount)||rule.nonemptyWitnessCount<4)fail('CALIBRATION_RULE_INVALID');if(rule.type==='input:number'&&(rule.numberAXSemantics!=='finite-number-equivalence-preserve-DOM-string'||!Number.isInteger(rule.numericLexicalWitnessCount)||rule.numericLexicalWitnessCount<4))fail('CALIBRATION_NUMBER_RULE_INVALID');types.add(rule.type)}
 const freeze=x=>{if(x&&typeof x==='object'){for(const value of Object.values(x))freeze(value);Object.freeze(x)}return x};freeze(policy);verifiedCalibrationPolicies.add(policy);return policy;
}