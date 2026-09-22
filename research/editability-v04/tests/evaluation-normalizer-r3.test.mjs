import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureBaselineR3, evaluateAcceptedR3 } from '../src/baseline-r3.mjs';
import { deriveExpectedKeysR3, evaluationProvenanceR3, digestR3 } from '../src/evaluation-plan-r3.mjs';
import { FACT_SCHEMA_VERSION_R3, measureRulesUntilDeadlineR3 } from '../src/measurement-r3.mjs';
import { normalizeRuntimeJournalR3 } from '../src/runtime-evidence-r3.mjs';
import { persistEvaluationReceiptR3, normalizeEvaluationReceiptR3, endpointExpectedKeysR3,
  EVALUATION_BINDING_R3, EVALUATION_RECEIPT_SCHEMA_R3 } from '../src/evaluation-normalizer-r3.mjs';
import { runExperimentV1 } from '../src/experiment-runner-v1.mjs';
import { toAnalysisInputV1 } from '../src/methods-v1-analysis.mjs';

// Hand-written inert source labels and typed facts only; never source/browser/API execution.
class Clock {
  time = 0; timers = [];
  now = () => this.time;
  sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('aborted')); return; }
    const timer = { at: this.time + ms, active: true };
    const abort = () => { if (timer.active) { timer.active = false; reject(new Error('aborted')); } };
    timer.finish = () => { if (timer.active) { timer.active = false; signal?.removeEventListener('abort', abort); resolve(); } };
    signal?.addEventListener('abort', abort, { once: true }); this.timers.push(timer);
  });
  async run(promise) {
    let done = false, value, error;
    promise.then(v => { done = true; value = v; }, e => { done = true; error = e; });
    for (let turn = 0; turn < 10000 && !done; turn++) {
      for (let tick = 0; tick < 30; tick++) await Promise.resolve();
      if (done) break;
      const pending = this.timers.filter(t => t.active);
      assert.ok(pending.length, 'fake clock wakeup exists');
      this.time = Math.max(this.time, Math.min(...pending.map(t => t.at)));
      for (const timer of this.timers.filter(t => t.active && t.at <= this.time)) timer.finish();
    }
    assert.ok(done, 'fake clock settled'); if (error) throw error; return value;
  }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const policy = { timeoutMs: 200, pollIntervalMs: 50, stableSamples: 2, geometryDeltaPx: 0.5 };
const calibration = { policyId: 'normalizer-handwritten-control', observerSha256: '1'.repeat(64), observerRevision: 'fake-r3', policyFileSha256: '2'.repeat(64) };
const environment = { entryContract: 'v04-jsx-app-script-react-1', browser: 'none-fake-clock-only' };
const eq = value => ({ cmp: 'eq', value });
const k = (...parts) => JSON.stringify(parts);
function renderRequest(text) {
  const sourceBytes = new TextEncoder().encode(text);
  return { sourceBytes, format: 'jsx', trustLevel: 'restricted-generated', entryContract: environment.entryContract,
    viewport: { width: 800, height: 600 }, staticGate: { accepted: true, sourceSha256: hash(sourceBytes) } };
}
async function fixture(options = {}) {
  const names = ['target', 'protected', 'unrelated'];
  const plan = { schemaVersion: 'v04-evaluation-plan-r3-1', id: 'handwritten-normalizer-control',
    catalog: Object.fromEntries(names.map(name => [name, { by: 'role', role: 'textbox', name, exact: true }])),
    viewports: { desktop: { width: 800, height: 600 } }, defaults: { documentOverflowTolerancePx: 0 },
    scenarios: names.map(name => ({ id: name, viewport: 'desktop', freshReload: true, assertNoHorizontalOverflow: false,
      steps: [{ op: 'observe', id: name, observation: { kind: 'value', targetRef: name } }] })),
    requirements: { targets: [], originals: [], protections: [], reachability: [], excludeNoopFromG: false } };
  plan.expectedKeys = deriveExpectedKeysR3(plan);
  const checkKey = name => plan.expectedKeys.find(key => JSON.parse(key)[1] === name);
  plan.requirements.targets = [{ key: checkKey('target'), expect: eq('new') }];
  plan.requirements.originals = [{ key: checkKey('target'), expect: eq(options.noop ? 'new' : 'old') },
    { key: checkKey('protected'), expect: options.originalProtectedExpect ?? eq(10) }, { key: checkKey('unrelated'), expect: eq('healthy') }];
  plan.requirements.protections = [{ key: checkKey('protected'), mode: options.preserve ? 'preserve' : 'nonWorsening',
    ...(!options.preserve ? { expect: eq(10) } : {}), tolerance: options.tolerance ?? 0 }];
  plan.requirements.reachability = [{ key: checkKey(options.predicateReachability ? 'protected' : 'target'),
    mode: options.predicateReachability ? 'predicate' : 'available', ...(options.predicateReachability ? { expect: eq(10) } : {}) }];
  const originalSource = 'handwritten ORIGINAL inert bytes λ', candidateSource = 'handwritten CANDIDATE inert bytes λ';
  const original = renderRequest(originalSource), candidate = renderRequest(candidateSource);
  let calls = 0;
  const runEvaluation = async ({ plan, policy, ruleSets, mode, calibration, environment, renderRequest }) => {
    calls++;
    const sourceSha256 = hash(renderRequest.sourceBytes), runId = `normalizer-fake-${calls}`, checks = [];
    for (const checkpoint of plan.checkpoints) {
      const { key, scenarioId } = checkpoint;
      const provenance = evaluationProvenanceR3({ plan, checkpoint, sourceSha256, runId, calibration, environment, policy });
      if (options.notMeasured?.[mode]?.includes(scenarioId)) { checks.push({ key, provenance, notMeasured: { reason: 'handwritten-unavailable' } }); continue; }
      const values = options[mode] ?? {};
      const value = Object.hasOwn(values, scenarioId) ? values[scenarioId] : scenarioId === 'protected' ? 10
        : scenarioId === 'unrelated' ? 'healthy' : mode === 'baseline' && !options.noop ? 'old' : 'new';
      const clock = new Clock();
      const measured = await clock.run(measureRulesUntilDeadlineR3({ clock, policy, rules: ruleSets[key], collect: async ({ sequence }) => {
        const actual = typeof value === 'function' ? value(sequence) : value;
        return actual?.state ? actual : { state: 'ok', actual: { schemaVersion: FACT_SCHEMA_VERSION_R3, value: actual, geometry: null, errors: [] }, identity: { node: key, runId } };
      } }));
      checks.push({ key, provenance, ...measured });
    }
    const run = { schemaVersion: 'v04-evaluation-run-r3-1', runId, sourceSha256, planDigest: plan.planDigest,
      environmentDigest: digestR3(environment), calibrationBindingDigest: digestR3(calibration), measurementPolicy: policy,
      checks, actions: [], errors: [], scenarios: [], receipts: [], runtimeEvidence: { complete: true, events: [],
        scenarios: plan.runs.map(run => ({ runKey: run.runKey, complete: true, lifecycleComplete: true, nativeJournal: handwrittenJournal(sourceSha256) })) } };
    refreshRuntime(run);
    options.mutate?.(run, { mode, plan }); return run;
  };
  const originalSourceSha256 = hash(original.sourceBytes);
  const baselineBundle = await captureBaselineR3({ originalRenderRequest: original, originalSourceSha256, plan, calibration, environment, policy, runEvaluation });
  const acceptanceLock = Object.freeze({ id: 'trusted-handwritten-executor-lock', status: 'accepted', originalSourceSha256,
    candidateSourceSha256: hash(candidate.sourceBytes), lockedBeforePrivateEvaluation: true });
  const evaluate = lock => evaluateAcceptedR3({ candidateRenderRequest: candidate, originalSourceSha256, baselineBundle,
    acceptanceLock: lock ?? acceptanceLock, plan, calibration, environment, policy, runEvaluation });
  const expectedKeysBefore = endpointExpectedKeysR3(baselineBundle);
  const evaluation = await evaluate();
  const slotBinding = { sourceId: 'handwritten-source', taskId: 'handwritten-task', method: 'FULL', slotId: 'handwritten-slot',
    originalSourceSha256, candidateSourceSha256: hash(candidate.sourceBytes), acceptanceLockId: acceptanceLock.id };
  return { baselineBundle, evaluation, plan, calibration, environment, policy, slotBinding, checkKey, expectedKeysBefore,
    originalSource, candidateSource, evaluate, calls: () => calls };
}
function temp(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'handwritten-evaluation-normalizer-r3-'));
  t.after(() => rmSync(dir, { recursive: true, force: true })); return dir;
}
async function persisted(t, options = {}) {
  const f = await fixture(options), receiptPath = path.join(temp(t), 'receipt.json');
  const descriptor = await persistEvaluationReceiptR3({ ...f, receiptPath });
  const result = await normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256, expectedBytes: descriptor.bytes,
    expectedSlotBinding: f.slotBinding, expectedAcceptanceLockId: f.evaluation.acceptanceLockId });
  return { f, receiptPath, descriptor, result };
}
function row(result, endpoint, ...parts) { return result[endpoint].find(r => r.key === k(...parts)); }
// Native-shaped typed journals are hand-written controls, NOT authentic browser captures.
function handwrittenJournal(sourceSha256) {
  return { available: true, complete: true, throughEventSequence: 0, events: [], journals: [
    { sourceSha256, renderEpoch: 1, available: true, complete: true, droppedEvents: 0, events: [] },
  ] };
}
function refreshRuntime(run) {
  const evidence = run.runtimeEvidence;
  evidence.events = [];
  for (const scope of evidence.scenarios) {
    const replayed = normalizeRuntimeJournalR3(scope.nativeJournal, { runKey: scope.runKey, sourceSha256: run.sourceSha256, runId: run.runId });
    scope.complete = replayed.complete && scope.lifecycleComplete;
    evidence.events.push(...replayed.events);
  }
  evidence.complete = evidence.scenarios.every(scope => scope.complete);
}
function addError(run, runKey) {
  const journal = run.runtimeEvidence.scenarios.find(scope => scope.runKey === runKey).nativeJournal;
  const event = { eventSequence: journal.throughEventSequence + 1, category: 'runtime-exception', name: 'TypeError',
    message: 'handwritten typed runtime violation', renderEpoch: 1, replayStage: { kind: 'render', sequence: 0 },
    native: { method: 'Runtime.exceptionThrown', params: { exceptionDetails: { text: 'Uncaught',
      exception: { className: 'TypeError', description: 'TypeError: handwritten typed runtime violation' } } } } };
  journal.events.push(event); journal.journals[0].events.push(structuredClone(event)); journal.throughEventSequence = event.eventSequence;
  refreshRuntime(run);
}

test('full genuine baseline and accepted evidence survives exact-byte persist/reload, immutable descriptor and bindings', async t => {
  const { f, receiptPath, descriptor, result } = await persisted(t);
  const bytes = readFileSync(receiptPath), raw = JSON.parse(bytes);
  assert.equal(descriptor.schemaVersion, EVALUATION_RECEIPT_SCHEMA_R3);
  assert.equal(descriptor.sha256, hash(bytes)); assert.equal(descriptor.bytes, bytes.length);
  const prescribedBytes = Buffer.from(JSON.stringify(raw, null, 2) + '\n', 'utf8');
  assert.deepEqual(bytes, prescribedBytes, 'exact two-space JSON plus one LF, encoded as UTF-8');
  assert.equal(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, 'no UTF-8 BOM');
  assert.equal(bytes.at(-1), 0x0a); assert.equal(bytes.at(-2), 0x7d, 'exactly one final LF after root closing brace');
  assert.equal(bytes.includes(0x0d), false, 'no CRLF translation');
  assert.ok(bytes.toString('utf8').startsWith('{\n  "schemaVersion": '), 'two-space root indentation');
  assert.equal(result.independentEvaluation.receipt.sha256, hash(prescribedBytes));
  assert.equal(result.independentEvaluation.receipt.bytes, prescribedBytes.length);
  assert.deepEqual(raw.baselineBundle, f.baselineBundle); assert.deepEqual(raw.evaluation, f.evaluation);
  for (const field of ['plan', 'calibration', 'environment', 'policy', 'slotBinding']) assert.deepEqual(raw[field], f[field]);
  assert.deepEqual(raw.evaluation.acceptanceLock, f.evaluation.acceptanceLock);
  assert.equal(f.calls(), 2, 'normalizer and auditor do not acquire observations');
  assert.ok(Object.isFrozen(descriptor)); assert.ok(Object.isFrozen(descriptor.slotBinding)); assert.ok(Object.isFrozen(result.R));
  assert.deepEqual(result.independentEvaluation.evaluationBinding, EVALUATION_BINDING_R3);
  for (const endpoint of ['R', 'G']) {
    assert.deepEqual(result[endpoint].map(r => r.key), f.expectedKeysBefore[endpoint]);
    assert.ok(result[endpoint].every(r => r.status === 'pass'));
    assert.deepEqual(result.independentEvaluation.outcomes[endpoint], { confirmedViolation: false, unknown: false, allRequiredPassed: true,
      binding: { ...EVALUATION_BINDING_R3, evidenceHash: hash(bytes), classification: 'S' } });
    assert.deepEqual(result[endpoint].filter(r => JSON.parse(r.key)[0] === 'check').map(r => JSON.parse(r.key)[1]), f.baselineBundle.endpointRequirements[endpoint].checkKeys);
  }
  assert.equal(Object.hasOwn(raw, 'cost'), false, 'unobserved costs are not invented');
});

test('external hash mandatory; byte mutation, whitespace change and byte-count mismatch rejected', async t => {
  const { receiptPath, descriptor } = await persisted(t);
  for (const expectedSha256 of [undefined, '', 'a', 'g'.repeat(64)]) await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath, expectedSha256 }), /EXTERNAL_RECEIPT_HASH/);
  await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256, expectedBytes: descriptor.bytes + 1 }), /BYTES_MISMATCH/);
  writeFileSync(receiptPath, Buffer.concat([readFileSync(receiptPath), Buffer.from('\n')]));
  await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256 }), /HASH_MISMATCH/);
});

test('exclusive create refuses overwrite and leaves original receipt bytes intact', async t => {
  const { f, receiptPath, descriptor } = await persisted(t);
  await assert.rejects(persistEvaluationReceiptR3({ ...f, receiptPath }), error => error.code === 'EEXIST');
  assert.equal(hash(readFileSync(receiptPath)), descriptor.sha256);
});

test('JSON-only receipt rejects omitted/coerced/accessor/prototype/cyclic fields without creating a file', async t => {
  const f = await fixture(), dir = temp(t);
  const cycle = {}; cycle.self = cycle;
  let getterCalls = 0;
  const getter = {}; Object.defineProperty(getter, 'value', { enumerable: true, get() { getterCalls++; return 'bad'; } });
  for (const [i, value] of [undefined, NaN, Infinity, -0, 1n, () => {}, new Date(), new Uint8Array([1]), cycle, getter, [,,], { toJSON() { return 'bad'; } }].entries()) {
    const receiptPath = path.join(dir, `invalid-${i}.json`);
    await assert.rejects(persistEvaluationReceiptR3({ ...f, calibration: { ...f.calibration, extra: value }, receiptPath }), /EXPLICIT_JSON/);
    assert.equal(existsSync(receiptPath), false);
  }
  assert.equal(getterCalls, 0);
});

test('planner rejects missing/duplicate keys and namespaced virtual keys cannot collide with private key text', async () => {
  const f = await fixture();
  for (const mutate of [b => delete b.endpointRequirements.R.checkKeys,
    b => b.endpointRequirements.R.checkKeys.push(b.endpointRequirements.R.checkKeys[0]),
    b => b.endpointRequirements.R.runtimeRunKeys.push(b.endpointRequirements.R.runtimeRunKeys[0]),
    b => b.expectedKeys.push(b.expectedKeys[0]), b => b.endpointRequirements.R.checkKeys.push('undeclared')]) {
    const bundle = structuredClone(f.baselineBundle); mutate(bundle); assert.throws(() => endpointExpectedKeysR3(bundle), /KEYS/);
  }
  const bundle = structuredClone(f.baselineBundle), unusual = k('qualification', 'R');
  bundle.expectedKeys.push(unusual); bundle.endpointRequirements.R.checkKeys.push(unusual);
  const keys = endpointExpectedKeysR3(bundle).R;
  assert.ok(keys.includes(k('check', unusual))); assert.ok(keys.includes(unusual)); assert.equal(new Set(keys).size, keys.length);
});

test('auditor rejects forged classifications, baseline eligibility/facts and missing/duplicate candidate checks before persist', async t => {
  const f = await fixture(), dir = temp(t);
  const mutations = [x => x.evaluation.endpoints.R.classification = 'W', x => x.baselineBundle.endpoints.G.eligibility = 'ineligible',
    x => x.baselineBundle.facts[f.checkKey('protected')].fact.value = 99,
    x => x.evaluation.checks.pop(), x => x.evaluation.checks[1] = x.evaluation.checks[0],
    x => x.evaluation.expectedKeys.pop(), x => x.baselineBundle.endpointRequirements.R.checkKeys.pop()];
  for (const [i, mutate] of mutations.entries()) {
    const data = structuredClone({ baselineBundle: f.baselineBundle, evaluation: f.evaluation }); mutate(data);
    const receiptPath = path.join(dir, `forged-${i}.json`);
    await assert.rejects(persistEvaluationReceiptR3({ ...f, ...data, receiptPath }), /R3_/); assert.equal(existsSync(receiptPath), false);
  }
});

test('rehashed forged persisted classification is independently rejected, not trusted as outcome strings', async t => {
  const { receiptPath } = await persisted(t), data = JSON.parse(readFileSync(receiptPath));
  data.evaluation.endpoints.R.classification = 'W';
  const bytes = Buffer.from(JSON.stringify(data)); writeFileSync(receiptPath, bytes);
  await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: hash(bytes) }), /REPLAY_MISMATCH/);
});

test('independent W check and U_A check both survive rows and bound booleans', async t => {
  const { f, result } = await persisted(t, { accepted: { target: 'wrong' }, notMeasured: { accepted: ['protected'] } });
  for (const endpoint of ['R', 'G']) {
    assert.equal(row(result, endpoint, 'check', f.checkKey('target')).status, 'confirmed-violation');
    assert.equal(row(result, endpoint, 'check', f.checkKey('protected')).status, 'notMeasured');
    const outcome = result.independentEvaluation.outcomes[endpoint];
    assert.equal(outcome.confirmedViolation, true); assert.equal(outcome.unknown, true); assert.equal(outcome.allRequiredPassed, false);
    assert.equal(outcome.binding.classification, 'W');
  }
});

test('runtime W and check U_A both retained; unrelated scenario runtime W remains scoped to G', async t => {
  const { f, result } = await persisted(t, { notMeasured: { accepted: ['protected'] }, mutate(run, { mode, plan }) {
    if (mode === 'accepted') addError(run, plan.runs.find(r => JSON.parse(r.runKey)[1] === 'unrelated')?.runKey ?? plan.checkpoints.find(c => c.scenarioId === 'unrelated').runKey);
  } });
  const unrelated = f.baselineBundle.endpointRequirements.G.runtimeRunKeys.find(k => !f.baselineBundle.endpointRequirements.R.runtimeRunKeys.includes(k));
  assert.equal(result.independentEvaluation.outcomes.R.binding.classification, 'U_A');
  assert.equal(result.independentEvaluation.outcomes.G.binding.classification, 'W');
  assert.equal(result.independentEvaluation.outcomes.G.unknown, true);
  assert.equal(row(result, 'G', 'runtime', 'G', unrelated).status, 'confirmed-violation');
  assert.ok(result.R.filter(r => JSON.parse(r.key)[0] === 'runtime').every(r => r.status === 'pass'));
});

test('runtime per-run coverage gaps affect only scoped rows; missing journal affects all relevant runtime rows', async t => {
  const scoped = await persisted(t, { mutate(run, { mode, plan }) {
    if (mode !== 'accepted') return;
    const runKey = plan.checkpoints.find(c => c.scenarioId === 'unrelated').runKey;
    run.runtimeEvidence.scenarios.find(scope => scope.runKey === runKey).lifecycleComplete = false;
    refreshRuntime(run);
  } });
  assert.equal(scoped.result.independentEvaluation.outcomes.R.binding.classification, 'S');
  const rows = scoped.result.G.filter(r => JSON.parse(r.key)[0] === 'runtime');
  assert.equal(rows.filter(r => r.status === 'unknown').length, 1);
  const missing = await persisted(t, { mutate(run, { mode }) {
    if (mode !== 'accepted') return;
    for (const scope of run.runtimeEvidence.scenarios) { scope.nativeJournal = null; scope.lifecycleComplete = false; }
    refreshRuntime(run);
  } });
  for (const endpoint of ['R', 'G']) {
    assert.equal(missing.result.independentEvaluation.outcomes[endpoint].binding.classification, 'U_A');
    assert.ok(missing.result[endpoint].filter(r => JSON.parse(r.key)[0] === 'runtime').every(r => r.status === 'unknown'));
  }
});

test('same runtime row W plus unknown keeps W and uses predeclared audit row for uncertainty', async t => {
  const { result } = await persisted(t, { mutate(run, { mode, plan }) {
    if (mode !== 'accepted') return;
    const runKey = plan.checkpoints.find(c => c.scenarioId === 'target').runKey;
    addError(run, runKey);
    run.runtimeEvidence.scenarios.find(scope => scope.runKey === runKey).lifecycleComplete = false;
    refreshRuntime(run);
  } });
  for (const endpoint of ['R', 'G']) {
    assert.equal(result.independentEvaluation.outcomes[endpoint].binding.classification, 'W');
    assert.equal(result.independentEvaluation.outcomes[endpoint].unknown, true);
    assert.equal(row(result, endpoint, 'audit', endpoint).status, 'unknown');
  }
});

test('G folds G and GProtection on one original checkpoint without dropping either rule', async t => {
  // Absolute G fails at 11; nonWorsening also fails. Both are independently audited and one key remains.
  const { f, result } = await persisted(t, { accepted: { protected: 11 } });
  const check = f.evaluation.checks.find(c => c.key === f.checkKey('protected'));
  assert.ok(check.measurements.G); assert.ok(check.measurements.GProtection);
  assert.equal(result.G.filter(r => r.key === k('check', f.checkKey('protected'))).length, 1);
  assert.equal(row(result, 'G', 'check', f.checkKey('protected')).status, 'confirmed-violation');
});

test('no-op masks keep full required rows, R noneligible false/false/false while G independently evaluated', async t => {
  const { f, result } = await persisted(t, { noop: true, accepted: { target: 'wrong' } });
  assert.equal(f.baselineBundle.endpoints.R.eligibility, 'ineligible');
  assert.equal(f.baselineBundle.endpoints.G.eligibility, 'eligible');
  assert.deepEqual(result.R.map(r => r.key), f.expectedKeysBefore.R);
  assert.ok(result.R.every(r => r.status === 'notMeasured'));
  assert.deepEqual(result.independentEvaluation.outcomes.R, { confirmedViolation: false, unknown: false, allRequiredPassed: false,
    binding: { ...EVALUATION_BINDING_R3, evidenceHash: result.independentEvaluation.receipt.sha256, classification: null } });
  assert.equal(result.independentEvaluation.outcomes.G.binding.classification, 'W');
});

test('both noneligible endpoints preserve nonempty expected rows without invoking candidate acquisition', async t => {
  const { f, result } = await persisted(t, { noop: true, baseline: { unrelated: 'broken' } });
  assert.equal(f.calls(), 1);
  for (const endpoint of ['R', 'G']) {
    assert.ok(result[endpoint].length); assert.ok(result[endpoint].every(r => r.status === 'notMeasured'));
    assert.equal(result.independentEvaluation.outcomes[endpoint].binding.classification, null);
  }
});

test('external lock, slot identifiers and source hashes must agree; inconsistent persistence binding fails', async t => {
  const { f, receiptPath, descriptor } = await persisted(t);
  for (const field of ['sourceId', 'taskId', 'method', 'slotId', 'acceptanceLockId', 'originalSourceSha256', 'candidateSourceSha256']) {
    const expectedSlotBinding = { ...f.slotBinding, [field]: field.endsWith('Sha256') ? 'f'.repeat(64) : 'different' };
    await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256, expectedSlotBinding }), /BINDING_MISMATCH|SOURCE_OR_LOCK/);
  }
  await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256, expectedAcceptanceLockId: 'different' }), /EXTERNAL_LOCK_MISMATCH/);
  await assert.rejects(persistEvaluationReceiptR3({ ...f, receiptPath: path.join(path.dirname(receiptPath), 'bad-lock.json'), slotBinding: { ...f.slotBinding, acceptanceLockId: 'different' } }), /SOURCE_OR_LOCK/);
  await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256, expectedSlotBinding: { sourceId: 'handwritten-source' } }), /SLOT_BINDING_REQUIRED/);
});

test('optional unbound slot stays explicitly null and cannot satisfy an external slot anchor', async t => {
  const f = await fixture(), receiptPath = path.join(temp(t), 'unbound.json');
  const descriptor = await persistEvaluationReceiptR3({ ...f, slotBinding: null, receiptPath });
  const result = await normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256 });
  assert.equal(result.independentEvaluation.receipt.slotBinding, null);
  await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256, expectedSlotBinding: f.slotBinding }), /EXTERNAL_SLOT/);
});

test('relative, traversal, symlink/junction ancestry and linked destination are refused', async t => {
  const f = await fixture(), dir = temp(t), target = path.join(dir, 'target'); mkdirSync(target);
  for (const receiptPath of ['relative.json', `${dir}${path.sep}target${path.sep}..${path.sep}escape.json`]) {
    await assert.rejects(persistEvaluationReceiptR3({ ...f, receiptPath }), /UNSAFE_RECEIPT_PATH/);
  }
  const link = path.join(dir, 'link'); symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(persistEvaluationReceiptR3({ ...f, receiptPath: path.join(link, 'blocked.json') }), /UNSAFE_RECEIPT_ANCESTRY/);
  await assert.rejects(normalizeEvaluationReceiptR3({ receiptPath: path.join(link, 'blocked.json'), expectedSha256: 'a'.repeat(64) }), /UNSAFE_RECEIPT_ANCESTRY/);
  assert.equal(existsSync(path.join(target, 'blocked.json')), false);
  await assert.rejects(persistEvaluationReceiptR3({ ...f, receiptPath: link }), /UNSAFE_RECEIPT_DESTINATION/);
});

test('actual current method runner and analysis consume receipt bindings without manufacturing hashes', async t => {
  const f = await fixture(), dir = temp(t), candidateHash = hash(f.candidateSource);
  const task = { sourceId: f.slotBinding.sourceId, taskId: f.slotBinding.taskId, briefId: 'brief', configId: 'config',
    originalSource: f.originalSource, originalSourceHash: hash(f.originalSource), eligibility: { R: 'eligible', G: 'eligible' },
    expectedKeys: f.expectedKeysBefore, publicRequest: { userGoal: 'handwritten goal', scope: 'source-definition',
      locator: { by: 'role', role: 'textbox', name: 'target', exact: true }, operation: { kind: 'set-text', value: 'new' } } };
  const experiment = await runExperimentV1({ plan: { datasetId: 'handwritten-normalizer', datasetKind: 'dev', tasks: [task] },
    evaluationBinding: EVALUATION_BINDING_R3, methods: { propose: async () => ({ status: 'proposed', apiAttempts: 0,
      candidate: { content: f.candidateSource, sourceHash: candidateHash, candidateHash,
        patches: [{ start: 0, end: f.originalSource.length, expectedText: f.originalSource, replacement: f.candidateSource }] }, guard: { pass: true } }) },
    prepare: async () => ({ status: 'ready' }), publicCheck: async () => ({ checks: ['parse', 'entry', 'patch-safety'].map(key => ({ key, pass: true })) }),
    executor: async () => ({ syntheticExecuted: true }), evaluator: async ({ candidate }) => {
      const evaluation = await f.evaluate(candidate.acceptanceLock);
      const receiptPath = path.join(dir, `${candidate.method}.json`);
      const slotBinding = { ...f.slotBinding, method: candidate.method, slotId: candidate.slotId ?? candidate.method, acceptanceLockId: evaluation.acceptanceLockId };
      const descriptor = await persistEvaluationReceiptR3({ ...f, evaluation, slotBinding, receiptPath });
      return normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256, expectedBytes: descriptor.bytes, expectedSlotBinding: slotBinding });
    } });
  assert.equal(experiment.records.length, 4);
  for (const record of experiment.records) {
    assert.equal(record.proposal, 'accepted', JSON.stringify(record)); assert.equal(record.evaluation.R.outcome, 'S');
    assert.equal(record.independentEvaluation.outcomes.R.binding.evidenceHash, hash(readFileSync(record.independentEvaluation.receipt.path)));
  }
  const converted = toAnalysisInputV1({ experiment, design: { briefs: [{ briefId: 'brief', clusterId: 'cluster' }], configs: ['config'],
    tasks: [task.taskId], maxBriefsPerCluster: 1, independence: { status: 'unverified', basis: 'handwritten-only control' } } });
  assert.deepEqual(converted.evaluationBinding, EVALUATION_BINDING_R3);
  assert.ok(converted.records.every(r => r.outcomes.R.allRequiredPassed && r.outcomes.G.allRequiredPassed));
  const bare = structuredClone(experiment); delete bare.records[0].independentEvaluation;
  assert.throws(() => toAnalysisInputV1({ experiment: bare, design: converted.design }), /INDEPENDENT_EVALUATION_REQUIRED/);
});
 test('mixed G rule W and U_A on the same original checkpoint retain uncertainty through fixed audit row', async t => {
  const { f, result } = await persisted(t, { preserve: true, originalProtectedExpect: { cmp: 'between', min: 9, max: 11 },
    accepted: { protected: 'wrong-type' } });
  assert.equal(row(result, 'G', 'check', f.checkKey('protected')).status, 'confirmed-violation');
  assert.equal(row(result, 'G', 'audit', 'G').status, 'unknown');
  assert.equal(result.independentEvaluation.outcomes.G.confirmedViolation, true);
  assert.equal(result.independentEvaluation.outcomes.G.unknown, true);
  assert.equal(result.independentEvaluation.outcomes.G.allRequiredPassed, false);
});

test('G absolute and protection rules each independently influence one folded original key', async t => {
  const absolute = await persisted(t, { preserve: true, tolerance: 2, accepted: { protected: 11 } });
  assert.equal(absolute.result.independentEvaluation.outcomes.G.binding.classification, 'W');
  assert.equal(absolute.result.independentEvaluation.outcomes.R.binding.classification, 'S');
  const preservation = await persisted(t, { preserve: true, originalProtectedExpect: { cmp: 'between', min: 9, max: 11 }, accepted: { protected: 11 } });
  assert.equal(preservation.result.independentEvaluation.outcomes.G.binding.classification, 'W');
  assert.equal(row(preservation.result, 'G', 'check', preservation.f.checkKey('protected')).status, 'confirmed-violation');
});

test('reachability predicate counterexample contributes to both endpoint check rows', async t => {
  const { f, result } = await persisted(t, { predicateReachability: true, preserve: true, tolerance: 2, accepted: { protected: 11 } });
  for (const endpoint of ['R', 'G']) {
    assert.ok(f.evaluation.endpoints[endpoint].reasons.some(r => r.role === 'reachability'));
    assert.equal(row(result, endpoint, 'check', f.checkKey('protected')).status, 'confirmed-violation');
  }
});

test('G original-ineligible and baseline unresolved masks retain every required row, never synthetic pass', async t => {
  const excluded = await persisted(t, { baseline: { unrelated: 'broken' } });
  assert.equal(excluded.result.independentEvaluation.outcomes.R.binding.classification, 'S');
  assert.equal(excluded.result.independentEvaluation.outcomes.G.binding.classification, null);
  assert.ok(excluded.result.G.every(r => r.status === 'notMeasured'));
  const unresolved = await persisted(t, { notMeasured: { baseline: ['protected'] } });
  for (const endpoint of ['R', 'G']) {
    assert.equal(unresolved.f.baselineBundle.endpoints[endpoint].eligibility, 'unresolved');
    assert.deepEqual(unresolved.result[endpoint].map(r => r.key), unresolved.f.expectedKeysBefore[endpoint]);
    assert.ok(unresolved.result[endpoint].every(r => r.status === 'notMeasured'));
  }
});

test('external slot anchor is snapshotted before asynchronous audit boundary', async t => {
  const { f, receiptPath, descriptor } = await persisted(t), expectedSlotBinding = { ...f.slotBinding };
  const pending = normalizeEvaluationReceiptR3({ receiptPath, expectedSha256: descriptor.sha256, expectedSlotBinding });
  expectedSlotBinding.slotId = 'mutation-after-invocation';
  assert.equal((await pending).independentEvaluation.receipt.slotBinding.slotId, f.slotBinding.slotId);
});
 test('legacy compact whitespace remains readable under its original exact-byte anchor without any rewrite', async t => {
  const { receiptPath, descriptor } = await persisted(t);
  const prettyBytes = readFileSync(receiptPath);
  // A newly created hand-written compatibility fixture, never a rewritten historical receipt.
  const legacyPath = path.join(path.dirname(receiptPath), 'legacy-compact.json');
  const legacyBytes = Buffer.from(JSON.stringify(JSON.parse(prettyBytes)), 'utf8');
  writeFileSync(legacyPath, legacyBytes, { flag: 'wx' });
  const result = await normalizeEvaluationReceiptR3({ receiptPath: legacyPath, expectedSha256: hash(legacyBytes), expectedBytes: legacyBytes.length });
  assert.equal(result.independentEvaluation.receipt.sha256, hash(legacyBytes));
  assert.equal(result.independentEvaluation.receipt.bytes, legacyBytes.length);
  assert.equal(result.independentEvaluation.outcomes.R.binding.evidenceHash, hash(legacyBytes));
  assert.deepEqual(readFileSync(legacyPath), legacyBytes, 'normalization never rewrites old encoding');
  assert.deepEqual(readFileSync(receiptPath), prettyBytes, 'new encoding receipt also remains untouched');
  assert.equal(hash(prettyBytes), descriptor.sha256);
});
test('missing runtime scopes or journal/lifecycle fields fail closed instead of summary-only downgrade', async () => {
  const mutations = [run => delete run.runtimeEvidence,
    run => delete run.runtimeEvidence.scenarios,
    run => run.runtimeEvidence.scenarios.pop(),
    run => run.runtimeEvidence.scenarios.push(run.runtimeEvidence.scenarios[0]),
    run => { for (const scope of run.runtimeEvidence.scenarios) delete scope.nativeJournal; },
    run => delete run.runtimeEvidence.scenarios[0].lifecycleComplete];
  for (const selectedMode of ['baseline', 'accepted']) for (const mutate of mutations) {
    await assert.rejects(fixture({ mutate(run, { mode }) { if (mode === selectedMode) mutate(run); } }), /R3_NATIVE_RUNTIME_(SCOPES|JOURNALS)_REQUIRED/);
  }
});

test('explicit null journals with false lifecycle retain unknown and independent measurement W', async t => {
  const unavailable = (run, { mode }) => {
    if (mode !== 'accepted') return;
    for (const scope of run.runtimeEvidence.scenarios) { scope.nativeJournal = null; scope.lifecycleComplete = false; }
    refreshRuntime(run);
  };
  const mixed = await persisted(t, { accepted: { target: 'wrong' }, mutate: unavailable });
  for (const endpoint of ['R', 'G']) {
    assert.equal(mixed.result.independentEvaluation.outcomes[endpoint].binding.classification, 'W');
    assert.equal(mixed.result.independentEvaluation.outcomes[endpoint].unknown, true);
    assert.ok(mixed.result[endpoint].filter(r => JSON.parse(r.key)[0] === 'runtime').every(r => r.status === 'unknown'));
  }
  const originalMissing = await persisted(t, { mutate(run, { mode }) {
    if (mode !== 'baseline') return;
    for (const scope of run.runtimeEvidence.scenarios) { scope.nativeJournal = null; scope.lifecycleComplete = false; }
    refreshRuntime(run);
  } });
  assert.equal(originalMissing.f.calls(), 1, 'unresolved original journal cannot trigger candidate acquisition');
  for (const endpoint of ['R', 'G']) {
    assert.equal(originalMissing.f.baselineBundle.endpoints[endpoint].eligibility, 'unresolved');
    assert.equal(originalMissing.result.independentEvaluation.outcomes[endpoint].binding.classification, null);
    assert.ok(originalMissing.result[endpoint].every(r => r.status === 'notMeasured'));
  }
});

test('A03 typed native-shaped runtime W cannot be erased by stripping journals and forging summary S', async t => {
  const f = await fixture({ mutate(run, { mode, plan }) {
    if (mode === 'accepted') addError(run, plan.checkpoints.find(c => c.scenarioId === 'target').runKey);
  } });
  assert.equal(f.evaluation.endpoints.R.classification, 'W');
  const forged = structuredClone(f.evaluation);
  for (const scope of forged.runtimeEvidence.scenarios) delete scope.nativeJournal;
  forged.runtimeEvidence.events = [];
  for (const endpoint of ['R', 'G']) { forged.endpoints[endpoint].reasons = []; forged.endpoints[endpoint].classification = 'S'; }
  const receiptPath = path.join(temp(t), 'downgrade.json');
  await assert.rejects(persistEvaluationReceiptR3({ ...f, evaluation: forged, receiptPath }), /R3_NATIVE_RUNTIME_JOURNALS_REQUIRED/);
  assert.equal(existsSync(receiptPath), false, 'rejected before minting a fresh receipt/hash');
});

test('journal replay rejects event-summary erasure and false completeness even with newly anchored input', async t => {
  const f = await fixture({ mutate(run, { mode, plan }) {
    if (mode === 'accepted') addError(run, plan.checkpoints.find(c => c.scenarioId === 'target').runKey);
  } });
  const mutations = [e => { e.runtimeEvidence.events = []; },
    e => { e.runtimeEvidence.scenarios[0].nativeJournal = null; },
    e => { e.runtimeEvidence.scenarios[0].lifecycleComplete = false; }];
  const dir = temp(t);
  for (const [index, mutate] of mutations.entries()) {
    const evaluation = structuredClone(f.evaluation); mutate(evaluation);
    const receiptPath = path.join(dir, `forged-runtime-${index}.json`);
    await assert.rejects(persistEvaluationReceiptR3({ ...f, evaluation, receiptPath }), /R3_NATIVE_RUNTIME_(EVENTS|COMPLETENESS)_MISMATCH/);
    assert.equal(existsSync(receiptPath), false);
  }
});