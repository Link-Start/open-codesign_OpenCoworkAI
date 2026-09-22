// Post-freeze infrastructure correction r1; original observer remains immutable.
// Browser risk reduction only; lexical gate and CDP are not OS isolation.
// Only trusted Babel is evaluated in Node. Hidden oracle comparison belongs to the parent.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import vm from 'node:vm';
export const POLICY_ID='v03-static-gate-2', ENTRY_CONTRACT='jsx-export-default-commonjs-react-1', CONTAINMENT='browser-risk-reduction-not-os-network-isolation';
export const OBSERVER_REVISION='v03-observer-r1-coordinate-scrollbar-1';
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
export function staticGate({sourceBytes,format}){
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
 if(format==='jsx'){if(!/\bexport\s+default\b/.test(source))reasons.push('default-export-required');if(/\bReactDOM\s*\.|\b(?:createRoot|hydrateRoot)\s*\(/.test(source))reasons.push('self-mount');}
 const result={policyId:POLICY_ID,sourceSha256:sha256(sourceBytes),format,accepted:reasons.length===0,reasons};return{...result,digest:sha256(JSON.stringify(result))};
}
export function validateExecution(request,options){
 if(!['trusted-microfixture','restricted-generated'].includes(request.trustLevel))fail('EXPLICIT_TRUST_LEVEL_REQUIRED');
 if(options.trustLevel!==request.trustLevel)fail('TRUST_LEVEL_MISMATCH');
 if(request.trustLevel==='restricted-generated'&&options.allowRestrictedGenerated!==true)fail('RESTRICTED_GENERATED_NOT_AUTHORIZED');
 if(request.trustLevel==='restricted-generated'&&!(typeof options.authorizationText==='string'&&options.authorizationText.trim()))fail('AUTHORIZATION_EVIDENCE_REQUIRED');
 if(!request.staticGate?.digest)fail('STATIC_GATE_REQUIRED');const gate=staticGate(request);
 if(gate.digest!==request.staticGate.digest||gate.sourceSha256!==request.staticGate.sourceSha256)fail('STATIC_GATE_DIGEST_MISMATCH');
 if(!gate.accepted)fail('STATIC_GATE_REJECTED',gate.reasons.join(','));return gate;
}
export const CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; worker-src 'none'; frame-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; media-src 'none'";
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
export async function buildEnvelope({sourceBytes,format,runtimeDir}){
 if(!['html','jsx'].includes(format))fail('INVALID_FORMAT');
 const source=decode(sourceBytes),meta=`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">`,rt=await runtime(runtimeDir);
 const vendors=`<script>${script(rt.react)}</script><script>${script(rt.reactDOM)}</script>`;
 const runtimeHashes=rt.hashes,runtimeSupply={kind:'shared-trusted-react-runtime',rawVendorBytes:rt.bytes,inlineScriptBytes:Buffer.byteLength(vendors),chargedToRawSource:false};
 let compiled=null,compilerHashes={},compilerSupply=null,inner;
 if(format==='jsx'){
  const tool=await compiler(runtimeDir);tool.context.__source=source;
  try{compiled=new vm.Script('Babel.transform(__source,{presets:["react"],plugins:["transform-modules-commonjs"],filename:"candidate.jsx",sourceType:"module",babelrc:false,configFile:false}).code').runInContext(tool.context,{timeout:10000})}finally{delete tool.context.__source}
  compilerHashes=tool.hashes;compilerSupply={kind:'trusted-node-compile-only',rawVendorBytes:tool.bytes,embeddedInPage:false};
  const mount=`(function(){const module={exports:{}};const exports=module.exports;\n${compiled}\n;ReactDOM.createRoot(document.getElementById('__v03_root')).render(React.createElement(module.exports.default));})();`;
  inner=`<!doctype html><html><head>${meta}</head><body><div id="__v03_root"></div>${vendors}<script>${script(mount)}</script></body></html>`;
 }else inner='<!doctype html>'+meta+vendors+source;
 const document=`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src about:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style><iframe title="candidate" sandbox="allow-scripts" srcdoc="${attr(inner)}"></iframe>`;
 return{document,compiled,sourceByteLength:sourceBytes.byteLength,executionEnvelopeBytes:Buffer.byteLength(document),sourceSha256:sha256(sourceBytes),compiledSha256:compiled===null?null:sha256(compiled),envelopeSha256:sha256(document),runtimeHashes,compilerHashes,runtimeSupply,compilerSupply,entryContract:format==='jsx'?ENTRY_CONTRACT:'html-srcdoc-shared-react-prefix-2'};
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
 if(!locator||!['role','text'].includes(locator.by))fail('INVALID_LOCATOR');
 if(typeof locator[locator.by]==='undefined')fail('INVALID_LOCATOR');
 const map=new Map(nodes.map(n=>[n.nodeId,n]));let allowed;
 if(locator.within){const contexts=matchAX(nodes,locator.within);if(contexts.length!==1)fail('AMBIGUOUS_LOCATOR_CONTEXT',String(contexts.length));allowed=new Set;const visit=id=>{if(allowed.has(id))return;allowed.add(id);for(const c of map.get(id)?.childIds??[])visit(c)};visit(contexts[0].nodeId)}
 const matches=nodes.filter(n=>!n.ignored&&n.backendDOMNodeId&&(!allowed||allowed.has(n.nodeId))).filter(n=>locator.by==='role'?n.role?.value===locator.role&&(locator.name===undefined||equal(n.name?.value,locator.name,locator.exact)):equal(n.name?.value,locator.text,locator.exact));
 if(locator.by==='role')return matches;
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
   entries.set(id,{backendNodeId:id,parentBackendNodeId:nodes.backendNodeId[nodes.parentIndex[index]],nodeType:nodes.nodeType[index],text:normalize(output),value:values.has(index)?values.get(index):undefined,hasLayout:layoutIndices.has(index),contains:other=>indices.has(other)&&descendant(indices.get(other),index)});
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
 let viewport=options.viewport??{width:1280,height:900},child,cdp,sid,candidateSid,profile,watchdog,current,closed=false,sequence=0,violations=[],protocolFailure=null,configuredTargets=[],candidateConfig=null,pageErrors=[];
 const timeout=options.timeoutMs??15000,lifetime=options.sessionLifetimeMs??120000;
 if(!Number.isInteger(timeout)||timeout<100||timeout>60000||!Number.isInteger(lifetime)||lifetime<100||lifetime>300000)fail('INVALID_TIME_BUDGET');
 if(options.settleMs!==undefined&&(!Number.isInteger(options.settleMs)||options.settleMs<0||options.settleMs>5000))fail('INVALID_SETTLE_BUDGET');
 const command=(method,params={})=>cdp.send(method,params,candidateSid??sid);
 const record=(kind,extra={})=>violations.push({kind,...extra});
 const ready=()=>{if(closed)fail('SESSION_CLOSED');if(!current)fail('NO_RENDER');if(protocolFailure)fail('CONTAINMENT_CONTROL_FAILED',protocolFailure)};
 async function kill(){clearTimeout(watchdog);if(cdp){const old=cdp;cdp=null;old.close()}if(child&&child.exitCode===null){const old=child;if(process.platform==='win32'){await new Promise(resolve=>{const killer=spawn('taskkill.exe',['/PID',String(old.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.once('error',()=>{old.kill();resolve()});killer.once('close',resolve)})}else old.kill('SIGKILL');await Promise.race([new Promise(resolve=>{if(old.exitCode!==null)resolve();else old.once('close',resolve)}),sleep(3000)])}child=null;if(profile){await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:150}).catch(e=>record('profile-cleanup-failed',{message:e.message}));profile=null}}
 function enforce(event){const{method,params:p={},sessionId}=event;const send=(m,p)=>{void cdp?.send(m,p,sessionId).catch(e=>{protocolFailure=e.message})};
  if(method==='Fetch.requestPaused'){record('request-blocked',{url:p.request?.url});send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'})}
  else if(method==='Page.javascriptDialogOpening'){record('dialog-denied');send('Page.handleJavaScriptDialog',{accept:false})}
  else if(method==='Page.fileChooserOpened')record('file-chooser-denied');
  else if(method==='Target.attachedToTarget'){
   if(p.targetInfo?.type==='iframe'&&p.targetInfo.url==='about:srcdoc'&&!candidateSid&&!current){candidateSid=p.sessionId;candidateConfig=configure(candidateSid).then(()=>cdp?.send('Runtime.runIfWaitingForDebugger',{},candidateSid)).catch(e=>{protocolFailure=e.message})}
   else{record('new-target-denied',{type:p.targetInfo?.type,url:p.targetInfo?.url});void cdp?.send('Target.closeTarget',{targetId:p.targetInfo.targetId}).catch(e=>{protocolFailure=e.message})}
  }
  else if(method==='Page.frameRequestedNavigation'&&!(p.url==='about:srcdoc'&&!current)){record('navigation-denied',{url:p.url});send('Page.stopLoading',{})}
  else if(method==='Inspector.targetCrashed')protocolFailure='target-crashed';
  else if(method==='Runtime.exceptionThrown')pageErrors.push({text:p.exceptionDetails?.text,description:p.exceptionDetails?.exception?.description??null});
  else if(method==='Log.entryAdded'&&p.entry?.source==='security')record('browser-security-log',{level:p.entry.level,text:p.entry.text});
 }
 async function launch(){profile=await mkdtemp(join(tmpdir(),'v03-browser-profile-'));child=spawn(options.browserPath,browserArguments(profile),{stdio:'ignore',windowsHide:true});let launchError;child.once('error',e=>launchError=e);watchdog=setTimeout(()=>{protocolFailure='session-watchdog';record('session-watchdog');void kill()},lifetime);
  const deadline=Date.now()+timeout;let portText;while(Date.now()<deadline){if(launchError)throw launchError;if(child.exitCode!==null)fail('BROWSER_EXITED',String(child.exitCode));try{portText=await readFile(join(profile,'DevToolsActivePort'),'utf8');if(portText.includes('\n'))break}catch{}await sleep(50)}if(!portText)fail('BROWSER_START_TIMEOUT');
  const[port,path]=portText.trim().split(/\r?\n/);cdp=await CDP.connect(`ws://127.0.0.1:${port}${path}`,timeout);
  await cdp.send('Browser.setDownloadBehavior',{behavior:'deny',eventsEnabled:true});await cdp.send('Browser.resetPermissions');
  const targets=await cdp.send('Target.getTargets'),target=targets.targetInfos.find(t=>t.type==='page'&&t.url==='about:blank');if(!target)fail('INITIAL_TARGET_MISSING');sid=(await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;cdp.on(enforce);
  await configure(sid);await setViewport(viewport);
 }
 async function configure(id){
  const send=(m,p={})=>cdp.send(m,p,id);
  for(const method of['Page.enable','DOM.enable','CSS.enable','Accessibility.enable','Network.enable','Runtime.enable','Log.enable'])await send(method);
  await send('Network.setBlockedURLs',{urls:['http://*','https://*','file://*','ftp://*','ws://*','wss://*']});await send('Network.setBypassServiceWorker',{bypass:true});await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});await send('Page.setInterceptFileChooserDialog',{enabled:true});await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});configuredTargets.push(id);
 }
 async function setViewport(size){if(!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<200||size.height<200||size.width>4096||size.height>4096)fail('INVALID_VIEWPORT');viewport={width:size.width,height:size.height};if(cdp)await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false},sid);if(current)current={...current,viewport};return viewport}
 async function document(){const{root}=await command('DOM.getDocument',{depth:-1,pierce:true});if(candidateSid)return root;const find=n=>{if(n.nodeName==='IFRAME'&&n.contentDocument)return n.contentDocument;for(const c of n.children??[]){const r=find(c);if(r)return r}return null};const result=find(root);if(!result)fail('CANDIDATE_DOCUMENT_UNAVAILABLE');return result}
 async function ax(){const{frameTree}=await command('Page.getFrameTree'),frame=candidateSid?frameTree.frame:frameTree.childFrames?.[0]?.frame;if(!frame||frame.url!=='about:srcdoc')fail('CANDIDATE_FRAME_UNAVAILABLE');return(await command('Accessibility.getFullAXTree',{frameId:frame.id})).nodes}
 async function describe(backendNodeId,properties=CSS_PROPS){const{node}=await command('DOM.describeNode',{backendNodeId,depth:-1,pierce:true}),{nodeIds}=await command('DOM.pushNodesByBackendIdsToFrontend',{backendNodeIds:[backendNodeId]}),nodeId=nodeIds[0],attrs=attributes(node);let computedStyle={},boundingRect=null;
  if(node.nodeType===1){const result=await command('CSS.getComputedStyleForNode',{nodeId});computedStyle=Object.fromEntries(result.computedStyle.filter(p=>properties.includes(p.name)||['display','visibility','opacity'].includes(p.name)).map(p=>[p.name,p.value]))}
  try{const{model}=await command('DOM.getBoxModel',{backendNodeId}),xs=model.border.filter((_,i)=>i%2===0),ys=model.border.filter((_,i)=>i%2===1);boundingRect={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}}catch(e){if(e.code!=='CDP_ERROR')throw e}
  return{backendNodeId,nodeId,tagName:node.nodeName.toLowerCase(),attributes:attrs,text:normalize(nodeText(node)),inlineStyle:attrs.style??'',computedStyle,boundingRect,visible:!!(boundingRect&&boundingRect.width>0&&boundingRect.height>0&&computedStyle.display!=='none'&&!['hidden','collapse'].includes(computedStyle.visibility)&&computedStyle.opacity!=='0')};
 }
 async function nativeSnapshot(){return snapshotIndex(await command('DOMSnapshot.captureSnapshot',{computedStyles:['visibility','display']}))}
 function resolveNative(nodes,snapshot,locator){
  if(!locator||!['role','text'].includes(locator.by))fail('INVALID_LOCATOR');
  let matches;
  if(locator.by==='role')matches=nodes.filter(n=>!n.ignored&&n.backendDOMNodeId&&n.role?.value===locator.role&&(locator.name===undefined||equal(n.name?.value,locator.name,locator.exact)));
  else{
   const accessibleText=nodes.filter(n=>!n.ignored&&n.role?.value==='StaticText'&&n.backendDOMNodeId).map(n=>n.backendDOMNodeId);
   const elements=[...snapshot.values()].filter(n=>n.nodeType===1&&n.hasLayout&&equal(n.text,locator.text,locator.exact)&&accessibleText.some(id=>n.contains(id)));
   const deepest=elements.filter(n=>!elements.some(other=>other.backendNodeId!==n.backendNodeId&&n.contains(other.backendNodeId)));
   matches=deepest.map(n=>nodes.find(a=>a.backendDOMNodeId===n.backendNodeId)??{nodeId:'dom:'+n.backendNodeId,backendDOMNodeId:n.backendNodeId});
  }
  if(locator.within){const contexts=resolveNative(nodes,snapshot,locator.within);if(contexts.length!==1)fail('AMBIGUOUS_LOCATOR_CONTEXT',String(contexts.length));const scope=snapshot.get(contexts[0].backendDOMNodeId);if(!scope)fail('LOCATOR_CONTEXT_DOM_UNAVAILABLE');matches=matches.filter(n=>n.backendDOMNodeId!==scope.backendNodeId&&scope.contains(n.backendDOMNodeId));}
  return matches;
 }
 async function inspect({locator,selector,computedProperties=CSS_PROPS}={}){ready();const doc=await document();const snapshot=await nativeSnapshot();let ids,matches;if(selector!==undefined){if(typeof selector!=='string'||selector.length>4096)fail('INVALID_SELECTOR');const result=await command('DOM.querySelectorAll',{nodeId:doc.nodeId,selector});ids=await Promise.all(result.nodeIds.map(async nodeId=>(await command('DOM.describeNode',{nodeId})).node.backendNodeId))}else{matches=resolveNative(await ax(),snapshot,locator);ids=matches.map(n=>n.backendDOMNodeId)}if(ids.length>1000)fail('OBSERVATION_TOO_LARGE');const elements=[];for(const id of ids){const element=await describe(id,computedProperties),a=matches?.find(n=>n.backendDOMNodeId===id);const axProperties=Object.fromEntries((a?.properties??[]).map(p=>[p.name,p.value?.value]));const rendered=snapshot.get(id);if(!rendered)fail('OBSERVATION_SNAPSHOT_NODE_MISSING');elements.push({...element,text:rendered.text,textEvidence:'CDP.DOMSnapshot.layout-text-block-normalized',axProperties,enabled:!(axProperties.disabled===true||Object.hasOwn(element.attributes,'disabled')||element.attributes['aria-disabled']==='true'),checked:axProperties.checked??element.attributes['aria-checked']??null,...(a?{role:a.role?.value,name:a.name?.value,value:rendered?.value??(a.value?.value===undefined?null:String(a.value.value))}:{})})}return{renderId:current.renderId,matchCount:elements.length,status:elements.length===1?'unique':elements.length?'ambiguous':'not-found',elements}}
 async function layoutMetrics(){ready();const result=await command('Page.getLayoutMetrics');if(!result.cssContentSize||!result.cssLayoutViewport)fail('CSS_LAYOUT_METRICS_UNAVAILABLE');return{contentSize:result.cssContentSize,layoutViewport:result.cssLayoutViewport,visualViewport:result.cssVisualViewport,source:'CDP.Page.getLayoutMetrics',candidateFrame:!!candidateSid}}
 async function observe(request){const result=await inspect(request);return{...result,actual:result.matchCount===1?result.elements[0]:null}}
 async function act({locator,action,value,key}){ready();await document();const matches=resolveNative(await ax(),await nativeSnapshot(),locator);if(matches.length!==1)fail('ACTION_LOCATOR_NOT_UNIQUE',String(matches.length));const backendNodeId=matches[0].backendDOMNodeId;
  if(action==='click'){await command('DOM.scrollIntoViewIfNeeded',{backendNodeId});const e=await describe(backendNodeId);if(!e.visible)fail('ACTION_TARGET_NOT_VISIBLE');const r=e.boundingRect,x=r.x+r.width/2,y=r.y+r.height/2;const {cssLayoutViewport}=await command('Page.getLayoutMetrics');if(!cssLayoutViewport||!Number.isFinite(cssLayoutViewport.pageX)||!Number.isFinite(cssLayoutViewport.pageY))fail('CSS_LAYOUT_METRICS_UNAVAILABLE');const hitX=Math.round(x+cssLayoutViewport.pageX),hitY=Math.round(y+cssLayoutViewport.pageY),hit=await command('DOM.getNodeForLocation',{x:hitX,y:hitY,includeUserAgentShadowDOM:true});if(hit.backendNodeId!==backendNodeId){const{node}=await command('DOM.describeNode',{backendNodeId,depth:-1});const contains=n=>n.backendNodeId===hit.backendNodeId||(n.children??[]).some(contains);if(!contains(node))fail('ACTION_TARGET_OCCLUDED')}
   await command('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await command('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await command('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await sleep(60);return{action,inputMode:'headless-cdp-real-coordinate-not-human',x,y,backendNodeId,hitTest:{coordinateSpace:'document-css',x:hitX,y:hitY},pointer:{coordinateSpace:'viewport-css',x,y},scrollOffset:{pageX:cssLayoutViewport.pageX,pageY:cssLayoutViewport.pageY}};}
  await command('DOM.focus',{backendNodeId});
  if(action==='fill'){if(typeof value!=='string'||value.length>10000)fail('INVALID_FILL_VALUE');for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});if(value===''){for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8})}else await command('Input.insertText',{text:value})}
  else if(action==='key'){const keys={Enter:13,Tab:9,Escape:27,Backspace:8,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,' ':32};if(!(key in keys))fail('UNSUPPORTED_KEY');for(const type of['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key,windowsVirtualKeyCode:keys[key],...(type==='keyDown'&&key==='Enter'?{text:'\r'}:{})})}else fail('UNSUPPORTED_ACTION');await sleep(60);return{action,inputMode:'headless-cdp-keyboard-not-human',backendNodeId};
 }
 async function render(request){if(closed)fail('SESSION_CLOSED');const gate=validateExecution(request,options);await kill();candidateSid=null;candidateConfig=null;configuredTargets=[];pageErrors=[];current=null;violations=[];protocolFailure=null;if(request.viewport)viewport=request.viewport;
  const renderId=request.artifactId??`render-${String(++sequence).padStart(4,'0')}`;if(!/^[A-Za-z0-9_-]{1,100}$/.test(renderId))fail('INVALID_ARTIFACT_ID');const directory=join(options.artifactRoot,renderId);await mkdir(directory,{recursive:false});await writeFile(join(directory,request.format==='html'?'source.html':'source.jsx'),request.sourceBytes,{flag:'wx'});const envelope=await buildEnvelope({...request,runtimeDir:options.runtimeDir});if(envelope.compiled!==null)await writeFile(join(directory,'compiled.js'),envelope.compiled,{flag:'wx'});await writeFile(join(directory,'envelope.html'),envelope.document,{flag:'wx'});
  const receipt={observerRevision:OBSERVER_REVISION,viewportNormalization:VIEWPORT_NORMALIZATION,observerCorrectionStage:'post-freeze-infrastructure-correction',renderId,format:request.format,trustLevel:request.trustLevel,staticGate:gate,containment:CONTAINMENT,osNetworkIsolation:'notClaimed',authorizationText:options.authorizationText??null,sourceSha256:envelope.sourceSha256,compiledSha256:envelope.compiledSha256,envelopeSha256:envelope.envelopeSha256,runtimeHashes:envelope.runtimeHashes,compilerHashes:envelope.compilerHashes,runtimeSupply:envelope.runtimeSupply,compilerSupply:envelope.compilerSupply,sourceByteLength:envelope.sourceByteLength,executionEnvelopeBytes:envelope.executionEnvelopeBytes,entryContract:envelope.entryContract,viewport,directory};await writeFile(join(directory,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
  try{await launch();await cdp.send('Page.navigate',{url:'data:text/html;base64,'+Buffer.from(envelope.document).toString('base64')},sid);const deadline=Date.now()+timeout;let done=false,lastError;while(Date.now()<deadline){if(protocolFailure)fail('CONTAINMENT_CONTROL_FAILED',protocolFailure);try{await ax();await document();done=true;break}catch(e){lastError=e.message;if(e.code==='CDP_TIMEOUT')throw e}await sleep(50)}if(!done)fail('RENDER_FRAME_TIMEOUT',JSON.stringify({lastError,violations}));if(candidateConfig)await candidateConfig;await sleep(options.settleMs??150);if(protocolFailure)fail('CONTAINMENT_CONTROL_FAILED',protocolFailure);current=receipt;const result={...receipt,browserVersion:await cdp.send('Browser.getVersion'),controlsConfigured:true,configuredTargetCount:configuredTargets.length,violations:[...violations],pageErrors:[...pageErrors]};await writeFile(join(directory,'execution.json'),JSON.stringify(result,null,2),{flag:'wx'});return result}catch(e){await kill();throw e}
 }
 return{render,act,observe,inspect,layoutMetrics,setViewport,async abortRender(){protocolFailure='external-observation-timeout';await kill();current=null},async close(){closed=true;await kill()},get diagnostics(){return{containment:CONTAINMENT,violations:[...violations],pageErrors:[...pageErrors],protocolFailure,current}}};
}
export const startBrowserSession=start;
