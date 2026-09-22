// Publication revision: portable checkout dependency resolution.
import {productPackageURL, productFileURL, runtimeDirectory, rootRequire} from '../publication/paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createEngineV1 } from '../src/methods-v1-engine.mjs';

const productPackage = productPackageURL();
const requireProduct = createRequire(productPackage);
const { parse } = requireProduct('@babel/parser');
const stockEngine = rootRequire()('tsx/cjs/api').require(fileURLToPath(new URL('./src/main/source-edit-engine.ts', productPackage)), fileURLToPath(productPackage));
const engine = createEngineV1({ parse, stockEngine });
const hash = (value) => createHash('sha256').update(value).digest('hex');
function request(source, fragment, overrides = {}) {
  const start = source.indexOf(fragment);
  assert.notEqual(start, -1);
  return { source, sourceHash: hash(source), scope: 'source-definition', locator: { tagName: 'span', text: 'Old' }, operation: { kind: 'set-text', value: 'New' }, provenance: { sourceHash: hash(source), targetId: `${start}:${start + fragment.length}` }, ...overrides };
}
function assertCandidate(input, pass = true) {
  const result = engine.candidate(input);
  assert.equal(result.status, 'candidate', result.reason);
  assert.equal(result.sourceHash, hash(result.content));
  assert.equal(result.candidateHash, hash(result.content));
  const patch = result.patches[0];
  assert.equal(input.source.slice(patch.start, patch.end), patch.expectedText);
  assert.equal(engine.guard(input, result).pass, pass);
  return result;
}

test('direct static text candidate uses exact provenance and stock-equal patch', () => {
  const source = 'function App(){return <main><span>Old</span></main>}';
  const input = request(source, '<span>Old</span>');
  const result = assertCandidate(input);
  assert.equal(result.content, 'function App(){return <main><span>{"New"}</span></main>}');
  assert.equal(result.evidence.selection, 'exact-provenance-span');
  assert.deepEqual(result, engine.candidate(input));
});

test('map target has candidate before structural guard; guard never changes hash', () => {
  const source = 'function App(){return <main>{[1,2].map(x => <span>Old</span>)}</main>}';
  const input = request(source, '<span>Old</span>');
  const first = assertCandidate(input, false);
  const before = structuredClone(first);
  assert.deepEqual(engine.guard(input, first), { pass: false, reason: 'scope-unsupported' });
  assert.deepEqual(first, before);
  assert.equal(engine.candidate(input).candidateHash, first.candidateHash);
});

test('custom-component descendants retain same candidate across guard on/off', () => {
  const source = 'function Wrap(props){return <section>{props.children}</section>} function App(){return <Wrap><span>Old</span></Wrap>}';
  const input = request(source, '<span>Old</span>');
  const result = assertCandidate(input, false);
  assert.equal(engine.guard(input, result).reason, 'scope-unsupported');
  assert.deepEqual(engine.candidate(input), result);
});

test('custom component own host definition receives candidate but not guard approval', () => {
  const source = 'function Label(){return <span>Old</span>} function App(){return <main><Label /></main>}';
  const input = request(source, '<span>Old</span>');
  const result = assertCandidate(input, false);
  assert.equal(engine.guard(input, result).reason, 'scope-unsupported');
});

test('dynamic text has no candidate, even under map scope exclusion', () => {
  for (const source of ['function App(){const label="Old";return <span>{label}</span>}', 'function App(){return <main>{[1].map(x => <span>{x}</span>)}</main>}']) {
    const fragment = source.includes('{label}') ? '<span>{label}</span>' : '<span>{x}</span>';
    const input = request(source, fragment, { locator: { tagName: 'span' } });
    const result = engine.candidate(input);
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason, 'unsupported-field');
    assert.deepEqual(engine.guard(input, result), { pass: false, reason: 'no-candidate' });
  }
});

test('static attributes and numeric style match stock byte for byte', () => {
  const fragment = '<span title="old" style={{fontSize:12,color:"red"}}>Old</span>';
  const source = `function App(){return ${fragment}}`;
  const attribute = assertCandidate(request(source, fragment, { operation: { kind: 'set-attribute', name: 'title', value: 'A < B & "C"' } }));
  assert.equal(attribute.patches[0].replacement, '{"A \\u003c B \\u0026 \\"C\\""}');
  const style = assertCandidate(request(source, fragment, { operation: { kind: 'set-style', property: 'fontSize', value: '20.0' } }));
  assert.equal(style.patches[0].replacement, '20');
});

test('invalid style and runtime controls never become map candidates', () => {
  const fragment = '<span style={{color:"red"}}>Old</span>';
  const source = `function App(){return <main>{[1].map(x => ${fragment})}</main>}`;
  for (const [operation, reason] of [
    [{ kind: 'set-style', property: 'color', value: 'url(evil)' }, 'invalid-style'],
    [{ kind: 'set-text', value: 'ReactDOM.createRoot' }, 'runtime-reserved-value'],
    [{ kind: 'set-text', value: '<!-- AGENT_BODY_BEGIN -->' }, 'runtime-reserved-value'],
    [{ kind: 'set-text', value: 'function App(){}' }, 'runtime-reserved-value'],
    [{ kind: 'set-attribute', name: 'onClick', value: 'x' }, 'invalid-operation'],
    [{ kind: 'set-text', value: 'x', expression: 'run()' }, 'invalid-operation'],
  ]) assert.deepEqual(engine.candidate(request(source, fragment, { operation })), { status: 'rejected', reason });
});

test('original unsafe source cannot bypass shared safety under structural exclusion', () => {
  for (const prefix of ['document.title="x";', 'setTimeout(()=>{},1);', 'useEffect(()=>{});']) {
    const source = `function App(){${prefix}return <main>{[1].map(x=><span>Old</span>)}</main>}`;
    const input = request(source, '<span>Old</span>');
    assert.deepEqual(engine.candidate(input), { status: 'rejected', reason: 'unsafe-source' });
  }
});

test('all stock analysis rejections retained; no scope relabeling', () => {
  for (const [source, reason] of [
    ['export function App(){return <span>Old</span>}', 'unsupported-module'],
    ['function App(props){return <span>Old</span>}', 'unsupported-entry'],
    ['function App(){return <span>Old</span>} const other=App;', 'reused-entry'],
  ]) assert.deepEqual(engine.candidate(request(source, '<span>Old</span>')), { status: 'rejected', reason });
});

test('map opening hazards and inherited unsafe hosts are not scope benefits', () => {
  for (const [fragment, reason] of [
    ['<span {...props}>Old</span>', 'spread-attributes'],
    ['<span title="a" title="b">Old</span>', 'duplicate-attributes'],
    ['<span data-ocd-target="x">Old</span>', 'reserved-provenance'],
    ['<span contentEditable>Old</span>', 'mutable-host'],
    ['<span children="x">Old</span>', 'children-prop'],
  ]) {
    const source = `function App(){return <main>{[1].map(x=>${fragment})}</main>}`;
    assert.deepEqual(engine.candidate(request(source, fragment)), { status: 'rejected', reason });
  }
  const source = 'function App(){return <script>{[1].map(x=><span>Old</span>)}</script>}';
  assert.equal(engine.candidate(request(source, '<span>Old</span>')).reason, 'unsupported-host');
});

test('shared, computed, spread, duplicate and dynamic styles have no candidate', () => {
  for (const value of ['theme', '{[key]:"red"}', '{...theme,color:"red"}', '{color:"red",color:"blue"}', '{color:color}']) {
    const fragment = `<span style={${value}}>Old</span>`;
    const source = `function App(){return <main>{[1].map(x=>${fragment})}</main>}`;
    const input = request(source, fragment, { operation: { kind: 'set-style', property: 'color', value: 'blue' } });
    assert.equal(engine.candidate(input).reason, 'unsupported-field');
  }
});

test('fallback uses raw static locator and never reads injected mapping or provenance', () => {
  const source = 'function App(){return <main><span id="chosen">Old</span><span>Other</span></main>}';
  const input = request(source, '<span id="chosen">Old</span>', { locator: { tagName: 'span', id: 'chosen', text: 'Old' } });
  const full = engine.candidate(input);
  delete input.provenance;
  Object.defineProperty(input, 'mapping', { get() { throw new Error('Mapping must never be read'); } });
  const fallback = engine.fallback(input);
  assert.equal(fallback.status, 'candidate');
  assert.equal(fallback.evidence.selection, 'unprivileged-static-locator');
  assert.equal(fallback.candidateHash, full.candidateHash);
  assert.equal(engine.guard(input, fallback).pass, true);
  Object.defineProperty(input, 'provenance', { get() { throw new Error('Fallback must not read provenance'); } });
  assert.equal(engine.fallback(input).candidateHash, full.candidateHash);
});

test('fallback ambiguity rejects despite injected exact mapping', () => {
  const source = 'function App(){return <main><span>Old</span><span>Old</span></main>}';
  const input = request(source, '<span>Old</span>');
  assert.equal(engine.candidate(input).status, 'candidate');
  input.mapping = { targetId: input.provenance.targetId };
  assert.deepEqual(engine.fallback(input), { status: 'rejected', reason: 'ambiguous-target' });
});

test('stale hashes, non-exact provenance and unsupported scope are rejected', () => {
  const source = 'function App(){return <span>Old</span>}';
  const input = request(source, '<span>Old</span>');
  assert.equal(engine.candidate({ ...input, sourceHash: '0'.repeat(64) }).reason, 'stale-source');
  assert.equal(engine.candidate({ ...input, provenance: { ...input.provenance, sourceHash: '0'.repeat(64) } }).reason, 'stale-provenance');
  assert.equal(engine.candidate({ ...input, provenance: { ...input.provenance, targetId: '0:1' } }).reason, 'target-not-found');
  assert.equal(engine.candidate({ ...input, scope: 'instance' }).reason, 'invalid-scope');
});

test('guard detects tampering and does not label it scope unsupported', () => {
  const source = 'function App(){return <main>{[1].map(x=><span>Old</span>)}</main>}';
  const input = request(source, '<span>Old</span>');
  const result = engine.candidate(input);
  assert.deepEqual(engine.guard(input, { ...result, candidateHash: 'wrong' }), { pass: false, reason: 'candidate-mismatch' });
});

test('stock direct patch drift is rejected before scope-off can consume it', () => {
  const drifting = createEngineV1({ parse, stockEngine: { ...stockEngine, planSourceEdit(input) {
    const result = stockEngine.planSourceEdit(input);
    return result.status === 'applied' && input.source.includes('<span>') ? { ...result, patch: { ...result.patch, replacement: 'wrong' } } : result;
  } } });
  const source = 'function App(){return <span>Old</span>}';
  assert.equal(drifting.candidate(request(source, '<span>Old</span>')).reason, 'stock-patch-mismatch');
});

test('actual engine through methods wrapper pairs map hashes and projects mapping-free fallback', async () => {
  const { createMethodsV1, rebuildPatch } = await import('../src/methods-v1.mjs');
  let fallbackCalls = 0;
  const methods = createMethodsV1({ engine: { ...engine, fallback(input) {
    fallbackCalls++;
    assert.equal(Object.hasOwn(input, 'provenance'), false);
    assert.equal(Object.hasOwn(input, 'mapping'), false);
    assert.deepEqual(input.locator, { tagName: 'span', text: 'Old' });
    return engine.fallback(input);
  } } });
  const source = 'function App(){return <main>{[1,2].map(x=><span>Old</span>)}</main>}';
  const input = { ...request(source, '<span>Old</span>'), userGoal: 'Change source definition text to New',
    locator: { by: 'text', text: 'Old', exact: true }, publicDom: { tagName: 'span', text: 'Old' } };
  Object.defineProperty(input, 'mapping', { get() { throw new Error('Injected source mapping is forbidden'); } });
  const full = await methods.propose('FULL', input);
  const off = await methods.propose('SCOPE_OFF', input);
  assert.equal(full.status, 'rejected');
  assert.equal(full.reason, 'scope-unsupported');
  assert.equal(off.status, 'proposed');
  assert.equal(full.candidate, off.candidate);
  assert.equal(full.candidate.candidateHash, off.candidate.candidateHash);
  assert.equal(rebuildPatch(source, off.candidate.patches), off.candidate.content);
  assert.equal(off.candidate.content, 'function App(){return <main>{[1,2].map(x=><span>{"New"}</span>)}</main>}');
  const direct = 'function App(){return <span>Old</span>}';
  const fallback = await methods.propose('PROVENANCE_OFF', { ...input, ...request(direct, '<span>Old</span>') });
  assert.equal(fallback.status, 'proposed');
  assert.equal(fallback.candidate.evidence.selection, 'unprivileged-static-locator');
  assert.equal(fallbackCalls, 1);
});

test('actual engine runner integration uses real static checks, synthetic runtime remains unknown', async () => {
  const { createMethodsV1, rebuildPatch } = await import('../src/methods-v1.mjs');
  const { runExperimentV1, pairedScopeAuditV1 } = await import('../src/experiment-runner-v1.mjs');
  const source = 'function App(){return <main>{[1,2].map(x=><span>Old</span>)}</main>}';
  const input = request(source, '<span>Old</span>');
  let fallbackCalls = 0;
  const methods = createMethodsV1({ engine: { ...engine, fallback(projected) {
    fallbackCalls++;
    assert.equal(Object.hasOwn(projected, 'provenance'), false);
    assert.equal(Object.hasOwn(projected, 'mapping'), false);
    return engine.fallback(projected);
  } } });
  const task = { sourceId: 'dev-map-control', taskId: 'static-text', originalSource: source,
    publicRequest: { userGoal: 'Change source definition text to New', scope: input.scope, operation: input.operation,
      locator: { by: 'text', text: 'Old', exact: true }, publicDom: { tagName: 'span', text: 'Old' } },
    eligibility: { R: 'eligible', G: 'notScreened' }, expectedKeys: { R: ['synthetic-runtime-not-measured'], G: [] } };
  const executionContents = [];
  const report = await runExperimentV1({ plan: { datasetId: 'dev-real-engine-synthetic-runtime', datasetKind: 'dev', tasks: [task] }, methods,
    prepare(publicInput) {
      // Hand-authored DEV fixture preparation receipt, not measured DOM provenance.
      assert.equal(publicInput.source, source);
      return { status: 'ready', provenance: input.provenance, publicDom: task.publicRequest.publicDom,
        mapping: { mustNotReachMethod: true } };
    },
    publicCheck(proposal) {
      let parsed = false;
      try { parse(proposal.content, { sourceType: 'module', plugins: ['jsx'] }); parsed = true; } catch {}
      const inspected = stockEngine.analyzeSourceEdit({ path: 'App.jsx', source: proposal.content });
      return { checks: [
        { key: 'parse', pass: parsed },
        { key: 'entry', pass: inspected.status === 'ready' },
        { key: 'patch-safety', pass: rebuildPatch(proposal.source, proposal.patches) === proposal.content && hash(proposal.content) === proposal.candidateHash },
      ] };
    },
    executor(candidate) {
      assert.equal(candidate.accepted, true);
      assert.equal(rebuildPatch(candidate.originalSource, candidate.patches), candidate.content);
      executionContents.push(candidate.content);
      return { kind: 'synthetic-control-no-browser', rendered: false };
    },
    evaluator({ execution }) {
      assert.equal(execution.rendered, false);
      return { R: [{ key: 'synthetic-runtime-not-measured', status: 'unknown' }] };
    },
  });
  assert.equal(report.records.length, 4);
  const full = report.records.find(row => row.method === 'FULL');
  const off = report.records.find(row => row.method === 'SCOPE_OFF');
  const fallback = report.records.find(row => row.method === 'PROVENANCE_OFF');
  assert.equal(full.accepted, false);
  assert.equal(full.rejection, 'scope-unsupported');
  assert.equal(off.accepted, true);
  assert.equal(off.acceptanceLocked, true);
  assert.equal(full.candidateHash, off.candidateHash);
  assert.equal(off.evaluation.R.outcome, 'U_A');
  assert.equal(fallback.rejection, 'scope-unsupported');
  assert.equal(fallbackCalls, 1);
  assert.deepEqual(executionContents, [rebuildPatch(source, off.patches)]);
  assert.equal(report.rollups['R/SCOPE_OFF'].counts.U_A, 1);
  assert.equal(pairedScopeAuditV1(report.records)[0].classification, 'uncertain');
  assert.equal(report.integrationStatus, 'dependency-injected-controls-only');
  assert.equal(report.formalReady, false);
});

test('candidate requires exact provenance while fallback stays available, JSX excludes TSX', () => {
  const source = 'function App(){return <span>Old</span>}';
  const input = request(source, '<span>Old</span>');
  delete input.provenance;
  assert.deepEqual(engine.candidate(input), { status: 'rejected', reason: 'provenance-required' });
  const fallback = engine.fallback(input);
  assert.equal(fallback.status, 'candidate');
  assert.equal(engine.guard(input, fallback).pass, true);
  const typescript = 'function App(){const value: string="Old";return <span>Old</span>}';
  assert.deepEqual(engine.candidate(request(typescript, '<span>Old</span>')), { status: 'rejected', reason: 'parse-error' });
});

test('guard inspects supplied candidate without invoking independent extraction again', () => {
  let parseCalls = 0;
  const instrumented = createEngineV1({ parse(...args) { parseCalls++; return parse(...args); }, stockEngine });
  const source = 'function App(){return <span>Old</span>}';
  const input = request(source, '<span>Old</span>');
  const candidate = instrumented.candidate(input);
  const before = parseCalls;
  assert.equal(instrumented.guard(input, candidate).pass, true);
  assert.equal(parseCalls, before);
});
