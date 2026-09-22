import { createHash } from 'node:crypto';
import { projectPublicRequest, rebuildPatch } from './methods-v1.mjs';
import { staticGate, verifyCalibrationPolicy, browserVersionKey } from './browser-session-r3.mjs';

const nativePreparers = new WeakSet();
export function isNativePublicPrepareV1(fn) { return nativePreparers.has(fn); }

export const PUBLIC_PREPARE_SCHEMA = 'study-public-prepare-v1';
export const PUBLIC_PREPARE_MARKER_PREFIX = 'data-ocd-public-prepare-';
const ATTRIBUTES = Object.freeze(['title', 'placeholder', 'alt', 'role', 'aria-label', 'data-testid']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const canonical = value => JSON.stringify(order(value));
function order(value) {
  if (Array.isArray(value)) return value.map(order);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, order(value[key])]));
  return value;
}
const same = (a, b) => canonical(a) === canonical(b);
const hashObject = value => sha256(canonical(value));
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const reserved = key => key.toLowerCase().startsWith(PUBLIC_PREPARE_MARKER_PREFIX);
const copy = value => structuredClone(value);

function publicInput(input) {
  const allowed = ['source', 'sourceHash', 'userGoal', 'scope', 'operation', 'locator', 'environment', 'publicDom'];
  if (!input || Object.getPrototypeOf(input) !== Object.prototype || Object.keys(input).some(key => !allowed.includes(key))) fail('PUBLIC_PROJECTED_REQUEST_REQUIRED');
  const request = projectPublicRequest(input);
  if (!['role', 'text', 'form-control-label'].includes(request.locator.by)) fail('PUBLIC_AX_LOCATOR_REQUIRED');
  // Neither caller-provided publicDom nor any inferred static target is authoritative.
  const { publicDom, ...projected } = request;
  return projected;
}

function instrument(source, parse, sourceHash) {
  if (source.toLowerCase().includes(PUBLIC_PREPARE_MARKER_PREFIX)) fail('RESERVED_MARKER_IN_ORIGINAL');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false });
  if (!ast || ast.errors?.length) fail('SOURCE_PARSE_FAILED');
  const markerName = PUBLIC_PREPARE_MARKER_PREFIX + sourceHash.slice(0, 20);
  const targets = [], patches = [], seen = new Set();
  function walk(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'JSXElement' && node.openingElement?.name?.type === 'JSXIdentifier' && /^[a-z]/.test(node.openingElement.name.name)) {
      const opening = node.openingElement;
      if (![node.start, node.end, opening.start, opening.end].every(Number.isSafeInteger) || node.start < 0 || node.end > source.length || node.start >= node.end || opening.start !== node.start || opening.end > node.end) fail('INVALID_ORIGINAL_AST_SPAN');
      const suffix = opening.selfClosing ? '/>' : '>';
      const position = opening.end - suffix.length;
      if (source.slice(position, opening.end) !== suffix || source[node.start] !== '<') fail('INVALID_ORIGINAL_AST_SPAN');
      const targetId = `${node.start}:${node.end}`;
      if (seen.has(targetId)) fail('DUPLICATE_ORIGINAL_AST_SPAN');
      seen.add(targetId);
      targets.push({ targetId, tagName: opening.name.name, start: node.start, end: node.end, openingStart: opening.start, openingEnd: opening.end });
      // Append after all original attributes/spreads. Never rewrite original bytes.
      patches.push({ start: position, end: position, expectedText: '', replacement: ` ${markerName}="${targetId}"` });
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'extra', 'tokens', 'comments'].includes(key) || key.endsWith('Comments')) continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  if (!targets.length) fail('NO_RAW_HOST_JSX');
  patches.sort((a, b) => a.start - b.start);
  const preview = rebuildPatch(source, patches);
  const reparsed = parse(preview, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false });
  if (!reparsed || reparsed.errors?.length) fail('PREVIEW_PARSE_FAILED');
  let recovered = preview;
  let delta = patches.reduce((sum, p) => sum + p.replacement.length, 0);
  for (let i = patches.length - 1; i >= 0; i--) {
    const p = patches[i]; delta -= p.replacement.length;
    const start = p.start + delta;
    if (recovered.slice(start, start + p.replacement.length) !== p.replacement) fail('TRANSFORM_ROUNDTRIP_FAILED');
    recovered = recovered.slice(0, start) + recovered.slice(start + p.replacement.length);
  }
  if (recovered !== source || sha256(recovered) !== sourceHash) fail('ORIGINAL_BYTES_CHANGED');
  return { preview, markerName, targets, patches, transformHash: hashObject(patches), recoveredSourceHash: sha256(recovered) };
}

function checkBinding(binding) {
  for (const key of ['entryContract', 'trustLevel', 'calibrationPolicyId', 'staticPolicyId']) if (typeof binding?.[key] !== 'string' || !binding[key]) fail('RUNTIME_BINDING_REQUIRED');
  for (const key of ['observerSha256', 'entryHelperSha256', 'layoutHelperSha256']) if (!hash(binding[key])) fail('RUNTIME_BINDING_REQUIRED');
  for (const key of ['runtimeHashes', 'compilerHashes']) if (!binding[key] || !Object.keys(binding[key]).length || !Object.values(binding[key]).every(hash)) fail('RUNTIME_BINDING_REQUIRED');
  if (!binding.browserVersion || ['protocolVersion', 'product', 'revision', 'userAgent', 'jsVersion'].some(key => typeof binding.browserVersion[key] !== 'string' || !binding.browserVersion[key])) fail('RUNTIME_BINDING_REQUIRED');
}

function semanticTarget(node, markerName) {
  const attributes = Object.fromEntries(Object.entries(node.attributes).filter(([key]) => key !== markerName));
  return { tagName: node.tagName, text: node.text, attributes, role: node.role ?? null, name: node.name ?? null,
    enabled: node.enabled ?? null, axProperties: node.axProperties ?? null, value: node.value ?? null,
    valueState: node.valueState ?? null, computed: node.computed ?? null,
    layout: { visible: node.layout.visible, bounds: node.layout.bounds } };
}
function semanticDocument(document) {
  if (!document || !document.viewport) fail('DOCUMENT_FACTS_MISSING');
  const result = {};
  for (const key of ['contentWidth', 'contentHeight', 'scrollOffsetX', 'scrollOffsetY', 'rootBounds', 'bodyBounds', 'viewport', 'layoutViewport', 'dimensionsSource']) result[key] = document[key] ?? null;
  return result;
}
function publicDom(node) {
  return { tagName: node.tagName, ...(typeof node.attributes.id === 'string' ? { id: node.attributes.id } : {}),
    ...(typeof node.text === 'string' ? { text: node.text } : {}),
    attributes: Object.fromEntries(ATTRIBUTES.filter(key => typeof node.attributes[key] === 'string').map(key => [key, node.attributes[key]])) };
}
function cleanJournal(journal) {
  if (!journal || journal.available !== true || journal.complete !== true || !Array.isArray(journal.events)) fail('RUNTIME_JOURNAL_UNAVAILABLE');
  if (journal.events.some(event => event.category !== 'exception-revoked')) fail('PUBLIC_PREPARE_RUNTIME_ERROR');
}
function checkReceipt(receipt, request, binding) {
  if (!receipt || receipt.controlsConfigured !== true || typeof receipt.renderId !== 'string' || !receipt.renderId || !Number.isInteger(receipt.renderEpoch) || !Number.isInteger(receipt.viewportEpoch)) fail('RENDER_RECEIPT_MISSING');
  if (request.artifactId !== undefined && receipt.renderId !== request.artifactId) fail('RENDER_ARTIFACT_BINDING_MISMATCH');
  if (receipt.sourceSha256 !== request.staticGate.sourceSha256 || receipt.format !== 'jsx' || receipt.entryContract !== request.entryContract || receipt.trustLevel !== request.trustLevel || !same(receipt.staticGate, request.staticGate)) fail('RENDER_SOURCE_BINDING_MISMATCH');
  if (!hash(receipt.compiledSha256) || !hash(receipt.envelopeSha256)) fail('COMPILE_RECEIPT_MISSING');
  for (const key of ['observerSha256', 'entryHelperSha256', 'layoutHelperSha256', 'runtimeHashes', 'compilerHashes', 'browserVersion', 'calibrationPolicyId']) if (!same(receipt[key], binding[key])) fail('RENDER_RUNTIME_BINDING_MISMATCH');
  if (binding.observerRevision !== undefined && receipt.observerRevision !== binding.observerRevision) fail('RENDER_RUNTIME_BINDING_MISMATCH');
  if (binding.viewport && !same(receipt.viewport, binding.viewport)) fail('RENDER_VIEWPORT_MISMATCH');
  if ((receipt.violations?.length ?? 0) || (receipt.pageErrors?.length ?? 0)) fail('PUBLIC_PREPARE_RUNTIME_ERROR');
  cleanJournal(receipt.runtimeJournal);
}
function checkCapture(capture, receipt, locator, binding) {
  if (capture?.state !== 'ok') fail('NATIVE_CAPTURE_UNAVAILABLE');
  const { identity, evidence, facts } = capture;
  if (!evidence || typeof evidence.rawSampleId !== 'string' || !evidence.rawSampleId || typeof evidence.rawSamplePath !== 'string' || !evidence.rawSamplePath || evidence.singleSnapshot !== true || evidence.axBracketStable !== true) fail('NATIVE_CAPTURE_RECEIPT_MISSING');
  for (const key of ['observerSha256', 'entryHelperSha256', 'layoutHelperSha256', 'browserVersion', 'calibrationPolicyId']) if (!same(evidence[key], binding[key])) fail('CAPTURE_RUNTIME_BINDING_MISMATCH');
  for (const key of ['renderId', 'renderEpoch', 'viewportEpoch']) if (identity?.[key] !== receipt[key]) fail('CAPTURE_RENDER_BINDING_MISMATCH');
  if (!identity?.frameId || !same(identity.viewport, receipt.viewport)) fail('CAPTURE_VIEWPORT_BINDING_MISMATCH');
  const target = facts?.targets?.find(target => target.key === 'public-target');
  const identityTarget = identity.targets?.find(target => target.key === 'public-target');
  if (facts.targets.length !== 1 || target?.matchCount !== 1 || target.status !== 'unique' || target.nodes?.length !== 1) fail('PUBLIC_TARGET_NOT_UNIQUE');
  const node = target.nodes[0];
  if (!Number.isSafeInteger(node.backendNodeId) || node.backendNodeId <= 0 || node.nodeType !== 1 || node.layout?.visible !== true || !node.attributes || typeof node.tagName !== 'string' || typeof node.text !== 'string') fail('NATIVE_TARGET_FACTS_MISSING');
  if (!same(target.locator, locator) || identityTarget?.locatorDigest !== sha256(JSON.stringify(target.locator)) || !same(target.backendNodeIds, [node.backendNodeId]) || !same(identityTarget.backendNodeIds, [node.backendNodeId]) || !same(identityTarget.contextBackendNodeIds, target.contextBackendNodeIds)) fail('NATIVE_TARGET_IDENTITY_MISMATCH');
  cleanJournal(facts.runtimeJournal);
  if ((facts.runtimeErrors?.length ?? 0) || (facts.pageErrors?.length ?? 0)) fail('PUBLIC_PREPARE_RUNTIME_ERROR');
  semanticDocument(facts.document);
  return node;
}

function verifiedBoundCalibration(policy, binding) {
  if (!policy) fail('CALIBRATION_POLICY_REQUIRED');
  const verified = verifyCalibrationPolicy(policy);
  if (verified.policyId !== binding.calibrationPolicyId || browserVersionKey(verified.browserVersion) !== browserVersionKey(binding.browserVersion)) fail('CALIBRATION_BINDING_MISMATCH');
  for (const key of ['observerSha256', 'entryHelperSha256', 'layoutHelperSha256', 'runtimeHashes']) if (!same(verified[key], binding[key])) fail('CALIBRATION_BINDING_MISMATCH');
  return verified;
}

/** Trusted dependency injection boundary. Evidence is archive-only, not a method request. */
export function createPublicPrepareV1({ parse, sessionFactory, makeRenderRequest, runtimeBinding, calibrationPolicy, browserPolicyReady = false, mode = 'native' } = {}) {
  if ([parse, sessionFactory, makeRenderRequest].some(fn => typeof fn !== 'function')) throw new TypeError('Inject parse, sessionFactory and makeRenderRequest functions.');
  if (!['native', 'deterministic-control'].includes(mode)) throw new TypeError('Invalid prepare mode.');
  const binding = copy(runtimeBinding ?? {}), policy = calibrationPolicy ? copy(calibrationPolicy) : null;
  const usedSessions = new WeakSet();
  let sequence = 0;
  const prepare = async function prepare(publicRequest) {
    const startedMs = performance.now();
    let originalPublicDom;
    const evidence = { schemaVersion: PUBLIC_PREPARE_SCHEMA, mode, nativeBrowserVerified: false,
      baseline: 'not-collected-here-parent-must-capture-independent-uninstrumented-baseline',
      runtimeBinding: copy(binding), adaptationCosts: { sessions: 0, renders: 0, captures: 0, sourceTransforms: 0, stageTimings: {} }, stages: {} };
    try {
      const request = publicInput(publicRequest);
      evidence.originalSourceHash = request.sourceHash;
      if (mode === 'native' && browserPolicyReady !== true) return { status: 'blocked', reason: 'BROWSER_POLICY_NOT_READY', evidence };
      checkBinding(binding);
      if (mode === 'native') {
        evidence.calibrationPolicy = copy(verifiedBoundCalibration(policy, binding));
      } else evidence.controlNotice = 'Deterministic fake native-capture control; NOT real browser or calibration evidence.';
      if (request.environment?.entryContract && request.environment.entryContract !== binding.entryContract) fail('PUBLIC_ENVIRONMENT_MISMATCH');
      if (request.environment?.policyId && request.environment.policyId !== binding.staticPolicyId) fail('PUBLIC_ENVIRONMENT_MISMATCH');
      let transform;
      evidence.adaptationCosts.originalBytes = Buffer.byteLength(request.source);
      const invocation = ++sequence;
      async function run(stage, source) {
        const stageStart = performance.now(), sourceHash = sha256(source);
        const archive = evidence.stages[stage] = { sourceHash };
        const artifactId = `public-prepare-${invocation}-${stage}-${request.sourceHash.slice(0, 12)}`;
        const sourceBytes = new Uint8Array(Buffer.from(source, 'utf8'));
        const renderRequest = await makeRenderRequest({ publicRequest: copy(request), sourceBytes, sourceHash, stage, artifactId });
        if (!(renderRequest?.sourceBytes instanceof Uint8Array) || sha256(sourceBytes) !== sourceHash || sha256(renderRequest.sourceBytes) !== sourceHash) fail('RENDER_REQUEST_SOURCE_MISMATCH');
        if (renderRequest.format !== 'jsx' || renderRequest.entryContract !== binding.entryContract || renderRequest.trustLevel !== binding.trustLevel) fail('RENDER_REQUEST_RUNTIME_MISMATCH');
        if (renderRequest.trustLevel === 'trusted-microfixture' && (typeof renderRequest.fixturePath !== 'string' || !renderRequest.fixturePath)) fail('TRUSTED_FIXTURE_PATH_REQUIRED');
        const gate = staticGate(renderRequest);
        if (!gate.accepted || gate.policyId !== binding.staticPolicyId || !same(gate, renderRequest.staticGate)) fail('RENDER_REQUEST_GATE_MISMATCH');
        const expectedRequest = { ...renderRequest, sourceBytes: new Uint8Array(renderRequest.sourceBytes), staticGate: copy(gate) };
        archive.request = { artifactId: renderRequest.artifactId, sourceHash, format: renderRequest.format, trustLevel: renderRequest.trustLevel, entryContract: renderRequest.entryContract, fixturePath: renderRequest.fixturePath ?? null, staticGate: copy(gate) };
        let session;
        try {
          session = await sessionFactory({ stage, publicRequest: copy(request), runtimeBinding: copy(binding) });
          if (!session || typeof session !== 'object' || ['render', 'captureFacts', 'close'].some(key => typeof session[key] !== 'function')) fail('SESSION_API_REQUIRED');
          if (usedSessions.has(session)) fail('FRESH_SESSION_REQUIRED');
          usedSessions.add(session); evidence.adaptationCosts.sessions++;
          evidence.adaptationCosts.renders++;
          const receipt = await session.render(renderRequest);
          archive.renderReceipt = copy(receipt); archive.renderReceiptHash = hashObject(receipt);
          if (sha256(renderRequest.sourceBytes) !== sourceHash) fail('RENDER_SOURCE_BYTES_MUTATED');
          checkReceipt(receipt, expectedRequest, binding);
          evidence.adaptationCosts.captures++;
          const capture = await session.captureFacts({ targets: [{ key: 'public-target', locator: copy(request.locator) }], includeDocument: true });
          archive.capture = copy(capture); archive.captureHash = hashObject(capture);
          const node = checkCapture(capture, receipt, request.locator, binding);
          archive.semanticTarget = semanticTarget(node, transform?.markerName);
          archive.semanticDocument = semanticDocument(capture.facts.document);
          return { node, receipt, capture };
        } finally {
          try {
            if (session && typeof session.close === 'function') { await session.close(); archive.closed = true; }
          } catch { archive.closed = false; fail('PUBLIC_PREPARE_CLEANUP_FAILED'); }
          finally { evidence.adaptationCosts.stageTimings[stage] = performance.now() - stageStart; }
        }
      }
      const original = await run('original', request.source);
      originalPublicDom = publicDom(original.node);
      evidence.publicLocateStatus = 'available';
      evidence.nativeBrowserVerified = mode === 'native';
      if (Object.keys(original.node.attributes).some(reserved)) fail('RESERVED_MARKER_IN_ORIGINAL_CAPTURE');
      const transformStart = performance.now();
      evidence.adaptationCosts.sourceTransforms++;
      try { transform = instrument(request.source, parse, request.sourceHash); }
      finally { evidence.adaptationCosts.instrumentationMs = performance.now() - transformStart; }
      evidence.transform = { kind: 'raw-original-host-jsx-opening-attribute-insertions', markerName: transform.markerName,
        offsetUnit: 'UTF-16-code-units-original-source', sourceHash: request.sourceHash, instrumentedSourceHash: sha256(transform.preview),
        patches: transform.patches, transformHash: transform.transformHash, targets: transform.targets, recoveredSourceHash: transform.recoveredSourceHash };
      evidence.adaptationCosts.previewBytes = Buffer.byteLength(transform.preview);
      evidence.adaptationCosts.addedBytes = Buffer.byteLength(transform.preview) - Buffer.byteLength(request.source);
      evidence.adaptationCosts.instrumentedHostCount = transform.targets.length;
      const preview = await run('instrumented', transform.preview);
      if (original.receipt.renderId === preview.receipt.renderId || original.capture.evidence.rawSamplePath === preview.capture.evidence.rawSamplePath) fail('FRESH_RENDER_EVIDENCE_REQUIRED');
      const markers = Object.keys(preview.node.attributes).filter(reserved);
      if (markers.length !== 1 || markers[0] !== transform.markerName) fail('NATIVE_MARKER_MISSING_OR_AMBIGUOUS');
      const targetId = preview.node.attributes[transform.markerName];
      const matched = transform.targets.filter(target => target.targetId === targetId);
      if (matched.length !== 1 || matched[0].tagName.toLowerCase() !== preview.node.tagName.toLowerCase()) fail('NATIVE_MARKER_SPAN_MISMATCH');
      evidence.markerBinding = { source: 'captureFacts.DOMSnapshot.native-attributes', markerName: transform.markerName, targetId,
        renderId: preview.receipt.renderId, renderEpoch: preview.receipt.renderEpoch, frameId: preview.capture.identity.frameId,
        backendNodeId: preview.node.backendNodeId, rawSampleId: preview.capture.evidence.rawSampleId, captureHash: evidence.stages.instrumented.captureHash };
      const a = evidence.stages.original, b = evidence.stages.instrumented;
      evidence.noEditRoundtrip = { targetEqual: same(a.semanticTarget, b.semanticTarget), documentEqual: same(a.semanticDocument, b.semanticDocument),
        originalTargetHash: hashObject(a.semanticTarget), instrumentedTargetHash: hashObject(b.semanticTarget), comparison: 'exact-public-native-semantic-target-and-document-facts-excluding-preview-marker-and-session-local-identities' };
      if (!evidence.noEditRoundtrip.targetEqual || !evidence.noEditRoundtrip.documentEqual) fail('NO_EDIT_ROUNDTRIP_MISMATCH');
      if (sha256(request.source) !== request.sourceHash) fail('ORIGINAL_BYTES_CHANGED');
      evidence.provenanceStatus = 'available';
      return { status: mode === 'native' ? 'ready' : 'control-ready', publicDom: originalPublicDom, provenance: { sourceHash: request.sourceHash, targetId }, evidence };
    } catch (error) {
      evidence.provenanceStatus = 'unavailable';
      evidence.provenanceReason = error?.code ?? (originalPublicDom ? 'PROVENANCE_PREPARATION_FAILED' : 'PUBLIC_PREPARE_FAILED');
      // Q is the original public locate. Method-specific provenance support must not
      // remove Q or bar PROVENANCE_OFF/LLM; FULL/SCOPE_OFF reject absent provenance.
      if (originalPublicDom && error?.code !== 'PUBLIC_PREPARE_CLEANUP_FAILED') {
        return { status: mode === 'native' ? 'ready' : 'control-ready', publicDom: originalPublicDom, evidence };
      }
      evidence.publicLocateStatus ??= 'unavailable';
      return { status: 'rejected', reason: evidence.provenanceReason, evidence };
    } finally {
      evidence.adaptationCosts.totalMs = performance.now() - startedMs;
    }
  };
  // Identity brand cannot be copied onto arbitrary stubs. It denotes this factory and
  // validated bound configuration, not independent authentication of injected I/O.
  if (mode === 'native' && browserPolicyReady === true) {
    try { checkBinding(binding); verifiedBoundCalibration(policy, binding); nativePreparers.add(prepare); }
    catch { /* Invalid bindings remain unbranded; prepare returns the structured rejection. */ }
  }
  return prepare;
}
