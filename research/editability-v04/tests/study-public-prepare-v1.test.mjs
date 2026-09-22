// Publication revision: portable checkout dependency resolution.
import {productPackageURL, productFileURL, runtimeDirectory, rootRequire} from '../publication/paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createPublicPrepareV1, isNativePublicPrepareV1, PUBLIC_PREPARE_MARKER_PREFIX } from '../src/study-public-prepare-v1.mjs';
import { ENTRY_CONTRACT, POLICY_ID, staticGate } from '../src/browser-session-r3.mjs';
import { projectPublicRequest, rebuildPatch } from '../src/methods-v1.mjs';

// Read-only parser dependency, not the product engine. No browser or filesystem writes.
const requireParser = createRequire(productPackageURL());
const { parse } = requireParser('@babel/parser');
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value);
const source = 'export default function App(){return <main><button id="save" title="Public title">Save</button></main>}';
const request = (text = source, extra = {}) => ({ source: text, sourceHash: hash(text), userGoal: 'Rename Save', scope: 'source-definition', operation: { kind: 'set-text', value: 'Saved' }, locator: { by: 'role', role: 'button', name: 'Save', exact: true }, ...extra });
const journal = () => ({ available: true, complete: true, events: [] });
const binding = () => ({ entryContract: ENTRY_CONTRACT, trustLevel: 'trusted-microfixture', staticPolicyId: POLICY_ID,
  observerSha256: hash('CONTROL observer'), entryHelperSha256: hash('CONTROL entry'), layoutHelperSha256: hash('CONTROL layout'),
  runtimeHashes: { 'react.umd.js': hash('CONTROL React'), 'react-dom.umd.js': hash('CONTROL ReactDOM') },
  compilerHashes: { 'babel.standalone.js': hash('CONTROL Babel') }, calibrationPolicyId: 'CONTROL-NOT-CALIBRATED',
  browserVersion: { protocolVersion: 'CONTROL', product: 'CONTROL-not-browser', revision: 'CONTROL', userAgent: 'CONTROL', jsVersion: 'CONTROL' }, viewport: { width: 1280, height: 900 } });
function hostElements(text) {
  const result = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXElement' && node.openingElement.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.openingElement.name.name)) result.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'tokens', 'comments'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(parse(text, { sourceType: 'module', plugins: ['jsx'] }));
  return result;
}
function control(options = {}) {
  const calls = [], sessions = [], runtimeBinding = binding();
  const input = options.input ?? request();
  const originalHost = hostElements(input.source).find(node => node.openingElement.name.name === (options.tagName ?? 'button'));
  const expectedId = originalHost && `${originalHost.start}:${originalHost.end}`;
  const makeRenderRequest = async info => {
    calls.push({ type: 'request', info });
    const renderRequest = { sourceBytes: info.sourceBytes, format: 'jsx', trustLevel: runtimeBinding.trustLevel,
      entryContract: runtimeBinding.entryContract, artifactId: info.artifactId, fixturePath: `/CONTROL/${info.stage}.jsx`, viewport: runtimeBinding.viewport };
    renderRequest.staticGate = staticGate(renderRequest);
    options.mutateRequest?.(renderRequest, info);
    return renderRequest;
  };
  const sessionFactory = async info => {
    const state = { info, closed: 0 };
    sessions.push(state);
    const session = {
      async render(renderRequest) {
        state.request = renderRequest;
        calls.push({ type: 'render', stage: info.stage });
        if (options.throwRender === info.stage) throw new Error('CONTROL render failure');
        const receipt = { ...runtimeBinding, renderId: renderRequest.artifactId, format: 'jsx', staticGate: structuredClone(renderRequest.staticGate),
          sourceSha256: hash(renderRequest.sourceBytes), compiledSha256: hash('CONTROL compiled ' + info.stage), envelopeSha256: hash('CONTROL envelope ' + info.stage),
          renderEpoch: 1, viewportEpoch: 1, controlsConfigured: true, violations: [], pageErrors: [], runtimeJournal: journal() };
        options.mutateReceipt?.(receipt, info);
        state.receipt = receipt;
        return receipt;
      },
      async captureFacts(captureRequest) {
        calls.push({ type: 'capture', stage: info.stage, request: captureRequest });
        if (options.throwCapture === info.stage) throw new Error('CONTROL capture failure');
        assert.deepEqual(captureRequest, { targets: [{ key: 'public-target', locator: input.locator }], includeDocument: true });
        const markerAttributes = {};
        // This is a labelled fake native renderer: read preview JSX attrs to construct a CDP-shaped control.
        // Production implementation must obtain these only from session.captureFacts.
        if (info.stage === 'instrumented') {
          const hosts = hostElements(Buffer.from(state.request.sourceBytes).toString('utf8'));
          const chosen = hosts.find(node => node.openingElement.name.name === (options.tagName ?? 'button'));
          for (const attr of chosen.openingElement.attributes) if (attr.name?.name?.startsWith(PUBLIC_PREPARE_MARKER_PREFIX)) markerAttributes[attr.name.name] = attr.value.value;
        }
        const id = info.stage === 'original' ? 41 : 907;
        const rect = { x: 8, y: 8, width: 100, height: 24, right: 108, bottom: 32 };
        const node = { backendNodeId: id, nodeType: 1, tagName: options.tagName ?? 'button', text: 'Save',
          attributes: { id: 'save', title: 'Public title', 'data-irrelevant': 'excluded from method', ...markerAttributes }, role: 'button', name: 'Save', enabled: true,
          axProperties: {}, value: null, valueState: 'unsupported', computed: { display: 'inline-block' }, layout: { visible: true, bounds: rect } };
        const target = { key: 'public-target', locator: input.locator, status: 'unique', matchCount: 1, backendNodeIds: [id], contextBackendNodeIds: [], nodes: [node] };
        const capture = { state: 'ok', identity: { renderId: state.receipt.renderId, renderEpoch: 1, viewportEpoch: 1, viewport: runtimeBinding.viewport,
          frameId: `CONTROL-frame-${info.stage}`, targets: [{ key: 'public-target', locatorDigest: hash(canonical(input.locator)), backendNodeIds: [id], contextBackendNodeIds: [] }] },
          facts: { targets: [target], document: { contentWidth: 1280, contentHeight: 900, scrollOffsetX: 0, scrollOffsetY: 0,
            rootBounds: rect, bodyBounds: rect, viewport: runtimeBinding.viewport, dimensionsSource: 'CONTROL fake native snapshot' }, runtimeJournal: journal(), runtimeErrors: [], pageErrors: [] },
          evidence: { ...runtimeBinding, rawSampleId: `CONTROL-${info.stage}`, rawSamplePath: `/CONTROL/${info.stage}.json`, singleSnapshot: true, axBracketStable: true } };
        options.mutateCapture?.(capture, info);
        return capture;
      },
      async close() { state.closed++; calls.push({ type: 'close', stage: info.stage }); if (options.throwClose === info.stage) throw new Error('CONTROL close failure'); },
    };
    return options.reuseSession && sessions.length > 1 ? sessions[0].session : (state.session = session);
  };
  const config = { parse, sessionFactory, makeRenderRequest, runtimeBinding, mode: 'deterministic-control', ...options.config };
  return { prepare: createPublicPrepareV1(config), calls, sessions, expectedId, input, config };
}

// All successful captures below are deterministic controls, not calibration or browser readiness.
test('CONTROL: original native locate and preview marker chain retain evidence without modifying source', async () => {
  const h = control(), before = structuredClone(h.input), result = await h.prepare(h.input);
  assert.equal(result.status, 'control-ready', result.reason);
  assert.equal(result.evidence.nativeBrowserVerified, false);
  assert.match(result.evidence.controlNotice, /NOT real browser/);
  assert.deepEqual(h.input, before);
  assert.deepEqual(result.provenance, { sourceHash: before.sourceHash, targetId: h.expectedId });
  assert.deepEqual(result.publicDom, { tagName: 'button', id: 'save', text: 'Save', attributes: { title: 'Public title' } });
  assert.deepEqual(h.calls.filter(c => ['render', 'capture', 'close'].includes(c.type)).map(c => `${c.type}:${c.stage}`), ['render:original', 'capture:original', 'close:original', 'render:instrumented', 'capture:instrumented', 'close:instrumented']);
  const transform = result.evidence.transform;
  assert.equal(transform.patches.length, 2);
  assert.ok(transform.patches.every(p => p.start === p.end && p.expectedText === ''));
  assert.equal(hash(rebuildPatch(before.source, transform.patches)), transform.instrumentedSourceHash);
  assert.equal(transform.recoveredSourceHash, before.sourceHash);
  assert.equal(result.evidence.markerBinding.backendNodeId, 907);
  assert.equal(result.evidence.stages.original.capture.facts.targets[0].nodes[0].backendNodeId, 41);
  assert.equal(result.evidence.noEditRoundtrip.targetEqual, true);
  assert.equal(result.evidence.noEditRoundtrip.documentEqual, true);
  assert.equal(result.evidence.adaptationCosts.sessions, 2);
  assert.equal(result.evidence.adaptationCosts.captures, 2);
  assert.equal(h.sessions.every(s => s.closed === 1), true);
});

test('CONTROL: native policy approval is required before any parse/session/request', async () => {
  const h = control({ config: { mode: 'native', parse() { throw new Error('must not parse'); } } });
  const result = await h.prepare(h.input);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'BROWSER_POLICY_NOT_READY');
  assert.equal(h.calls.length, 0);
});

test('CONTROL: browser approval alone does not fabricate calibration ready', async () => {
  for (const calibrationPolicy of [undefined, { policyId: 'fabricated' }]) {
    const h = control({ config: { mode: 'native', browserPolicyReady: true, calibrationPolicy } });
    const result = await h.prepare(h.input);
    assert.equal(result.status, 'rejected');
    assert.match(result.reason, /CALIBRATION/);
    assert.equal(h.calls.length, 0);
  }
});

test('CONTROL: public-only boundary rejects private/provenance fields without reading them', async () => {
  for (const key of ['provenance', 'expected', 'baseline', 'privateExpectation']) {
    const h = control(), input = { ...h.input };
    Object.defineProperty(input, key, { enumerable: true, get() { throw new Error('private getter accessed'); } });
    const result = await h.prepare(input);
    assert.equal(result.reason, 'PUBLIC_PROJECTED_REQUEST_REQUIRED');
    assert.equal(h.calls.length, 0);
  }
});

test('CONTROL: stale source and non-AX locator fail before browser access', async () => {
  for (const extra of [{ sourceHash: hash('wrong') }, { locator: { tagName: 'button', text: 'Save' } }]) {
    const h = control(); const result = await h.prepare({ ...h.input, ...extra });
    assert.equal(result.status, 'rejected'); assert.equal(h.calls.length, 0);
  }
});

test('CONTROL: existing reserved marker rejects provenance but preserves original public locate', async () => {
  for (const text of [source.replace('id="save"', `${PUBLIC_PREPARE_MARKER_PREFIX}old="1:2"`), `/* ${PUBLIC_PREPARE_MARKER_PREFIX.toUpperCase()}x */` + source]) {
    const h = control({ input: request(text) }), result = await h.prepare(h.input);
    assert.equal(result.evidence.provenanceReason, 'RESERVED_MARKER_IN_ORIGINAL'); assert.equal(h.sessions.length, 1);
    assert.equal(result.status, 'control-ready'); assert.equal(result.provenance, undefined);
  }
});

test('CONTROL: source hash + static locator never substitute for missing browser marker', async () => {
  const h = control({ mutateCapture(c, { stage }) { if (stage === 'instrumented') for (const key of Object.keys(c.facts.targets[0].nodes[0].attributes)) if (key.startsWith(PUBLIC_PREPARE_MARKER_PREFIX)) delete c.facts.targets[0].nodes[0].attributes[key]; } });
  const result = await h.prepare(h.input);
  assert.equal(result.evidence.provenanceReason, 'NATIVE_MARKER_MISSING_OR_AMBIGUOUS');
  assert.equal(result.status, 'control-ready'); assert.equal(result.evidence.provenanceStatus, 'unavailable');
  assert.equal(result.provenance, undefined); assert.ok(h.sessions.every(s => s.closed === 1));
});

test('CONTROL: forged, wrong-tag and multiple markers cannot bind a raw AST span', async () => {
  for (const mutation of ['span', 'tag', 'multiple']) {
    const h = control({ mutateCapture(c, { stage }) {
      if (stage !== 'instrumented') return;
      const node = c.facts.targets[0].nodes[0], marker = Object.keys(node.attributes).find(key => key.startsWith(PUBLIC_PREPARE_MARKER_PREFIX));
      if (mutation === 'span') node.attributes[marker] = '0:1';
      if (mutation === 'tag') node.tagName = 'aside';
      if (mutation === 'multiple') node.attributes[PUBLIC_PREPARE_MARKER_PREFIX + 'other'] = '1:2';
    } });
    const result = await h.prepare(h.input);
    assert.match(result.evidence.provenanceReason, /NATIVE_MARKER/); assert.equal(result.provenance, undefined);
    assert.equal(result.status, 'control-ready');
  }
});

test('CONTROL: absent and ambiguous original target stop before instrumented session', async () => {
  for (const count of [0, 2]) {
    const h = control({ mutateCapture(c) { c.facts.targets[0].matchCount = count; } });
    const result = await h.prepare(h.input);
    assert.equal(result.reason, 'PUBLIC_TARGET_NOT_UNIQUE'); assert.equal(h.sessions.length, 1); assert.equal(h.sessions[0].closed, 1);
  }
});

test('CONTROL: semantic, attribute, geometry and document changes fail no-edit roundtrip', async () => {
  for (const mutation of ['text', 'title', 'bounds', 'document']) {
    const h = control({ mutateCapture(c, { stage }) {
      if (stage !== 'instrumented') return;
      const node = c.facts.targets[0].nodes[0];
      if (mutation === 'text') node.text = 'Changed';
      if (mutation === 'title') node.attributes.title = 'Changed';
      if (mutation === 'bounds') node.layout.bounds.width++;
      if (mutation === 'document') c.facts.document.contentWidth++;
    } });
    const result = await h.prepare(h.input);
    assert.equal(result.evidence.provenanceReason, 'NO_EDIT_ROUNDTRIP_MISMATCH'); assert.equal(result.provenance, undefined);
    assert.equal(result.status, 'control-ready'); assert.equal(result.publicDom.text, 'Save'); assert.equal(result.publicDom.attributes.title, 'Public title');
    assert.ok(result.evidence.stages.original.capture); assert.ok(result.evidence.stages.instrumented.capture);
  }
});

test('CONTROL: missing receipts, stale identities, runtime and calibration drift reject', async () => {
  const cases = [
    { mutateReceipt(r) { delete r.compiledSha256; }, reason: 'COMPILE_RECEIPT_MISSING' },
    { mutateReceipt(r) { r.sourceSha256 = hash('other'); }, reason: 'RENDER_SOURCE_BINDING_MISMATCH' },
    { mutateReceipt(r) { r.runtimeHashes = { other: hash('other') }; }, reason: 'RENDER_RUNTIME_BINDING_MISMATCH' },
    { mutateReceipt(r) { r.browserVersion = { ...r.browserVersion, product: 'other' }; }, reason: 'RENDER_RUNTIME_BINDING_MISMATCH' },
    { mutateCapture(c) { delete c.evidence.rawSamplePath; }, reason: 'NATIVE_CAPTURE_RECEIPT_MISSING' },
    { mutateCapture(c) { c.evidence.calibrationPolicyId = 'other'; }, reason: 'CAPTURE_RUNTIME_BINDING_MISMATCH' },
    { mutateCapture(c) { c.identity.renderId = 'other'; }, reason: 'CAPTURE_RENDER_BINDING_MISMATCH' },
    { mutateCapture(c) { c.identity.targets[0].backendNodeIds = [999]; }, reason: 'NATIVE_TARGET_IDENTITY_MISMATCH' },
    { mutateCapture(c) { c.facts.runtimeJournal.complete = false; }, reason: 'RUNTIME_JOURNAL_UNAVAILABLE' },
    { mutateCapture(c) { c.facts.runtimeErrors.push({ category: 'runtime-exception' }); }, reason: 'PUBLIC_PREPARE_RUNTIME_ERROR' },
  ];
  for (const item of cases) {
    const h = control(item), result = await h.prepare(h.input);
    assert.equal(result.reason, item.reason); assert.ok(h.sessions.every(s => s.closed === 1));
  }
});

test('CONTROL: raw host AST instrumentation retains custom, map, nested and spread scopes', async () => {
  const samples = [
    'function Label(){return <button>Save</button>} export default function App(){return <Label/>}',
    'export default function App(){return <main>{[1].map(x=><button key={x}>Save</button>)}</main>}',
    'function Wrap(p){return <main>{p.children}</main>} export default function App(){return <Wrap><button>Save</button></Wrap>}',
    'export default function App(){const props={title:"hi"};return <main><button {...props}>Save</button><input /></main>}',
    'export default function App(){return <><x-widget /><button>Save</button></>}',
    'export default function App(){return <main title="é💡"><button>Save</button></main>}',
  ];
  for (const text of samples) {
    const h = control({ input: request(text) }), result = await h.prepare(h.input);
    assert.equal(result.status, 'control-ready', result.reason);
    assert.equal(result.evidence.transform.targets.length, hostElements(text).length);
    assert.equal(result.provenance.targetId, h.expectedId);
    assert.equal(result.evidence.transform.recoveredSourceHash, hash(text));
  }
});

test('CONTROL: request mutations, missing trusted path and unaccepted gates fail closed', async () => {
  const cases = [
    { mutateRequest(r) { r.sourceBytes[0] = 32; }, reason: 'RENDER_REQUEST_SOURCE_MISMATCH' },
    { mutateRequest(r) { r.format = 'html'; }, reason: 'RENDER_REQUEST_RUNTIME_MISMATCH' },
    { mutateRequest(r) { delete r.fixturePath; }, reason: 'TRUSTED_FIXTURE_PATH_REQUIRED' },
    { mutateRequest(r) { r.staticGate.accepted = false; }, reason: 'RENDER_REQUEST_GATE_MISMATCH' },
  ];
  for (const item of cases) {
    const h = control(item), result = await h.prepare(h.input);
    assert.equal(result.reason, item.reason); assert.equal(h.sessions.length, 0);
  }
});

test('CONTROL: fresh session requirement and finally cleanup include failures', async () => {
  for (const kind of ['throwRender', 'throwCapture', 'throwClose']) {
    const h = control({ [kind]: 'instrumented' }), result = await h.prepare(h.input);
    assert.equal(result.status, kind === 'throwClose' ? 'rejected' : 'control-ready'); assert.ok(h.sessions.every(s => s.closed === 1));
    assert.equal(result.provenance, undefined);
  }
  const h = control({ reuseSession: true }), result = await h.prepare(h.input);
  assert.equal(result.evidence.provenanceReason, 'FRESH_SESSION_REQUIRED');
  assert.equal(result.status, 'control-ready'); assert.equal(result.provenance, undefined);
});

test('CONTROL: publicDom and PROVENANCE_OFF/LLM projection contain neither markers nor archive evidence', async () => {
  const h = control(), result = await h.prepare(h.input);
  const merged = { ...h.input, ...result };
  for (const provenance of [false, true]) {
    const projected = projectPublicRequest(merged, { provenance });
    assert.equal(projected.source, h.input.source);
    assert.equal(projected.evidence, undefined);
    assert.equal(JSON.stringify(projected).includes(PUBLIC_PREPARE_MARKER_PREFIX), false);
    assert.equal(projected.publicDom.outerHTML, undefined);
    assert.equal(projected.publicDom.attributes['data-irrelevant'], undefined);
    assert.equal(!!projected.provenance, provenance);
  }
});

test('CONTROL: native identity brand excludes stubs, control mode and unready or invalid policies', () => {
  const fake = async () => ({ status: 'ready' });
  fake.nativeBrowserVerified = true;
  assert.equal(isNativePublicPrepareV1(fake), false);
  assert.equal(isNativePublicPrepareV1(null), false);
  for (const config of [{}, { mode: 'native' }, { mode: 'native', browserPolicyReady: true }, { mode: 'native', browserPolicyReady: true, calibrationPolicy: { policyId: 'fabricated' } }]) {
    const h = control({ config });
    h.prepare.nativeBrowserVerified = true;
    assert.equal(isNativePublicPrepareV1(h.prepare), false);
    assert.equal(isNativePublicPrepareV1(h.prepare.bind(null)), false);
  }
});
test('CONTROL: Q survives missing instrumentation support, while original ambiguity remains shared failure', async () => {
  const parserFailure = control({ config: { parse() { throw new Error('CONTROL unsupported parser construct'); } } });
  const noRawHost = control({ input: request('export default function App(){return React.createElement("button",null,"Save")}') });
  for (const h of [parserFailure, noRawHost]) {
    const result = await h.prepare(h.input);
    assert.equal(result.status, 'control-ready');
    assert.equal(result.publicDom.text, 'Save');
    assert.equal(result.provenance, undefined);
    assert.equal(result.evidence.publicLocateStatus, 'available');
    assert.equal(result.evidence.provenanceStatus, 'unavailable');
    assert.equal(h.sessions.length, 1);
    assert.equal(h.sessions[0].closed, 1);
    const projectedFull = projectPublicRequest({ ...h.input, ...result }, { provenance: true });
    assert.equal(projectedFull.provenance, undefined);
    const projectedOff = projectPublicRequest({ ...h.input, ...result });
    assert.deepEqual(projectedOff.publicDom, result.publicDom);
    assert.equal(projectedOff.evidence, undefined);
  }
  const ambiguous = control({ mutateCapture(c) { c.facts.targets[0].matchCount = 2; } });
  const failed = await ambiguous.prepare(ambiguous.input);
  assert.equal(failed.status, 'rejected');
  assert.equal(failed.publicDom, undefined);
  assert.equal(failed.evidence.publicLocateStatus, 'unavailable');
  assert.equal(failed.reason, 'PUBLIC_TARGET_NOT_UNIQUE');
});
test('CONTROL: null and undefined instrumentation errors preserve original Q',async()=>{
 for(const reason of [null,undefined]){const h=control({config:{parse(){throw reason;}}});const result=await h.prepare(h.input);
  assert.equal(result.status,'control-ready');assert.equal(result.evidence.publicLocateStatus,'available');assert.equal(result.provenance,undefined);assert.equal(result.evidence.provenanceStatus,'unavailable');}
});