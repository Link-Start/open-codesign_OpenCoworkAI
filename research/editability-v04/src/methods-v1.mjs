import { createHash } from 'node:crypto';
export const METHODS_V1 = Object.freeze(['FULL', 'SCOPE_OFF', 'PROVENANCE_OFF', 'LLM_ONESHOT']);
export const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');
export function immutable(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
const string = (value, name) => { if (typeof value !== 'string') throw new Error(`INVALID_${name}`); return value; };
export function projectLocatorV1(input, depth=0) {
  if (!input || depth>8) throw new Error('INVALID_LOCATOR');
  const result={};
  if (['role','text','form-control-label'].includes(input.by)) {
    const field=input.by==='form-control-label'?'label':input.by;
    if (input.exact !== true || typeof input[field] !== 'string' || (field!=='text' && !input[field])) throw new Error('INVALID_AX_LOCATOR');
    result.by=input.by; result[field]=input[field]; result.exact=true;
    if (input.by==='role' && typeof input.name==='string') result.name=input.name;
    if (input.within) result.within=projectLocatorV1(input.within,depth+1);
  } else {
    if (input.by!==undefined || input.kind!==undefined) throw new Error('UNRESOLVED_OR_UNSUPPORTED_PUBLIC_QUERY');
    for (const key of ['tagName','id','text']) if (typeof input[key]==='string') result[key]=input[key];
    if (!result.tagName) throw new Error('INVALID_DEV_LOCATOR');
  }
  return result;
}
// Visual endpoints describe visible geometry, not a CSS implementation or an engine eligibility rule.
function projectVisualItemLocator(input, depth=0) {
  if (!input || depth>8 || !['role','text','form-control-label'].includes(input.by)) throw new Error('INVALID_VISUAL_ITEM_LOCATOR');
  const result = projectLocatorV1(input, depth);
  if (input.within) result.within = projectVisualItemLocator(input.within, depth+1);
  return result;
}
function projectOperation(operation) {
  if (!operation || !['set-text','set-attribute','set-style','set-visual-intent'].includes(operation.kind)) throw new Error('INVALID_OPERATION');
  if (operation.kind === 'set-visual-intent') {
    if (!['borderBoxDistance','visualColumns'].includes(operation.intent)) throw new Error('INVALID_VISUAL_INTENT');
    if (typeof operation.value !== 'string' && !(typeof operation.value === 'number' && Number.isFinite(operation.value))) throw new Error('INVALID_VISUAL_VALUE');
    const result = {kind:operation.kind,intent:operation.intent,value:operation.value};
    if (operation.unit !== undefined) {
      if (operation.unit !== 'css-px') throw new Error('INVALID_VISUAL_UNIT');
      result.unit = operation.unit;
    }
    if (operation.axis !== undefined) {
      if (!['horizontal','vertical'].includes(operation.axis)) throw new Error('INVALID_VISUAL_AXIS');
      result.axis = operation.axis;
    }
    if (operation.itemLocators !== undefined) {
      if (!Array.isArray(operation.itemLocators)) throw new Error('INVALID_VISUAL_ITEM_LOCATORS');
      result.itemLocators = Array.from(operation.itemLocators, locator => projectVisualItemLocator(locator));
    }
    return result;
  }
  const result = {kind:operation.kind,value:string(operation.value,'VALUE')};
  if (operation.kind === 'set-attribute') result.name = string(operation.name,'ATTRIBUTE');
  // Public CSS requests are not restricted to the deterministic engine's MVP property subset.
  if (operation.kind === 'set-style') result.property = string(operation.property,'STYLE');
  return result;
}
// An allowlist, not deletion of known private fields: unknown nested fields never cross this boundary.
export function projectPublicRequest(input, { provenance = false } = {}) {
  const request = input.publicRequest ?? input;
  const source = string(input.originalSource ?? input.source, 'SOURCE');
  const projectedOperation = projectOperation(request.operation);
  const locator = projectLocatorV1(request.locator);
  const publicDom = {};
  for (const key of ['tagName','id','text']) if (typeof request.publicDom?.[key] === 'string') publicDom[key] = request.publicDom[key];
  if (request.publicDom?.attributes) {
    publicDom.attributes = {};
    for (const key of ['title','placeholder','alt','role','aria-label','data-testid']) {
      if (typeof request.publicDom.attributes[key] === 'string') publicDom.attributes[key] = request.publicDom.attributes[key];
    }
  }
  const result = {source, sourceHash: sha256(source), userGoal: string(request.userGoal, 'GOAL'),
    scope: string(request.scope, 'SCOPE'), operation: projectedOperation, locator};
  if (Object.keys(publicDom).length) result.publicDom = publicDom;
  const environment = {};
  for (const key of ['runtimeId','entryContract','compilerVersion','observerVersion','policyId']) {
    if (typeof request.environment?.[key] === 'string') environment[key] = request.environment[key];
  }
  if (Object.keys(environment).length) result.environment = environment;
  if (input.originalSourceHash !== undefined && input.originalSourceHash !== result.sourceHash) throw new Error('SOURCE_HASH_MISMATCH');
  if (input.sourceHash !== undefined && input.sourceHash !== result.sourceHash) throw new Error('SOURCE_HASH_MISMATCH');
  if (provenance && input.provenance) result.provenance = {
    sourceHash: string(input.provenance.sourceHash, 'PROVENANCE_HASH'), targetId: string(input.provenance.targetId, 'TARGET_ID')};
  return immutable(result);
}
export function rebuildPatch(source, patches) {
  if (!Array.isArray(patches) || !patches.length) throw new Error('PATCH_REQUIRED');
  let cursor = 0, result = '';
  for (const patch of patches) {
    if (!Number.isInteger(patch.start) || !Number.isInteger(patch.end) || patch.start < cursor || patch.end < patch.start
        || patch.end > source.length || typeof patch.replacement !== 'string' || typeof patch.expectedText !== 'string'
        || source.slice(patch.start, patch.end) !== patch.expectedText) throw new Error('INVALID_PATCH');
    result += source.slice(cursor, patch.start) + patch.replacement;
    cursor = patch.end;
  }
  return result + source.slice(cursor);
}
const reject = reason => ({status: 'rejected', reason, candidate: null, guard: null});
const usage = receipt => Object.fromEntries(['inputTokens','outputTokens','cachedInputTokens'].map(key =>
  [key, Number.isInteger(receipt?.[key]) && receipt[key] >= 0 ? receipt[key] : null]));
export function createMethodsV1({engine, oneshot} = {}) {
  if (!engine || ['candidate','guard','fallback'].some(key => typeof engine[key] !== 'function')) throw new Error('ENGINE_REQUIRED');
  // The pair cache belongs to this experiment instance. Both guards consume the exact same frozen candidate.
  const paired = new Map();
  function pair(request) {
    const key = sha256(JSON.stringify(request));
    if (!paired.has(key)) paired.set(key, immutable(engine.candidate(request)));
    return paired.get(key);
  }
  async function propose(method, input) {
    if (!METHODS_V1.includes(method)) throw new Error('UNKNOWN_METHOD');
    const request = projectPublicRequest(input, {provenance: method === 'FULL' || method === 'SCOPE_OFF'});
    if (method === 'LLM_ONESHOT') {
      if (typeof oneshot !== 'function') return {status:'error',reason:'ONESHOT_TRANSPORT_UNAVAILABLE',apiAttempts:0};
      // A single injected transport call. No repair, retry, tool loop, or evaluation context.
      let response;
      try { response = await oneshot(immutable({schemaVersion:'v04-oneshot-1',request,
        responseContract:{type:'patches',fields:['start','end','expectedText','replacement'],order:'ascending-original-offsets'}})); }
      catch { return {status:'error',reason:'ONESHOT_TRANSPORT_ERROR',apiAttempts:1}; }
      try {
        const proposal = typeof response?.proposal === 'string' ? JSON.parse(response.proposal) : response?.proposal;
        const patches = proposal?.patches?.map(p => ({start:p.start,end:p.end,expectedText:p.expectedText,replacement:p.replacement}));
        const content = rebuildPatch(request.source, patches);
        return {status:'proposed',candidate:immutable({status:'candidate',patches,content,sourceHash:sha256(content),candidateHash:sha256(content)}),
          guard:{pass:true,reason:'LLM_NO_METHOD_SCOPE_GUARD'},apiAttempts:1,usage:usage(response?.usage)};
      } catch { return {status:'public-protocol-rejection',reason:'ONESHOT_INVALID_PROPOSAL',apiAttempts:1,usage:usage(response?.usage)}; }
    }
    // Shared public preparation already succeeded; unsupported method capability must not erase E/Q.
    if (request.operation.kind === 'set-visual-intent') return immutable({...reject('UNSUPPORTED_VISUAL_INTENT'),apiAttempts:0});
    const engineRequest = immutable({...request,semanticLocator:request.locator,locator:request.publicDom?.tagName ? {
      tagName:request.publicDom.tagName,
      ...(request.publicDom.id !== undefined ? {id:request.publicDom.id}:{}),
      ...(request.publicDom.text !== undefined ? {text:request.publicDom.text}:{})
    }:request.locator});
    const candidate = method === 'PROVENANCE_OFF' ? immutable(engine.fallback(engineRequest)) : pair(engineRequest);
    if (candidate.status !== 'candidate') return {...reject(candidate.reason ?? 'NO_CANDIDATE'),apiAttempts:0};
    // Scope removal is the only difference; candidate generator and safety prerequisites are not switched.
    const guard = method === 'SCOPE_OFF' ? {pass:true,reason:'SCOPE_DISABLED_ONLY'} : engine.guard(engineRequest, candidate);
    return immutable({status:guard.pass ? 'proposed':'rejected',reason:guard.pass ? null:guard.reason,candidate,guard,apiAttempts:0});
  }
  return Object.freeze({version:'research-methods-v1',propose});
}
