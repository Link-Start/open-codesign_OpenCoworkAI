import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { captureBaselineR3, evaluateAcceptedR3, auditEvaluationReceiptR3 } from '../src/baseline-r3.mjs';
import { deriveExpectedKeysR3, evaluationProvenanceR3, digestR3 } from '../src/evaluation-plan-r3.mjs';
import { FACT_SCHEMA_VERSION_R3, measureRulesUntilDeadlineR3 } from '../src/measurement-r3.mjs';
import { normalizeRuntimeJournalR3 } from '../src/runtime-evidence-r3.mjs';

// Handwritten fixtures and fake clocks ONLY. Source bytes are hashed, never executed.
class FakeClock {
  time = 0;
  timers = [];
  now = () => this.time;
  sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('aborted')); return; }
    const timer = { at: this.time + ms, active: true };
    const abort = () => { if (timer.active) { timer.active = false; reject(new Error('aborted')); } };
    timer.finish = () => { if (timer.active) { timer.active = false; signal?.removeEventListener('abort', abort); resolve(); } };
    signal?.addEventListener('abort', abort, { once: true });
    this.timers.push(timer);
  });
  async run(promise) {
    let done = false, value, error;
    promise.then(v => { done = true; value = v; }, e => { done = true; error = e; });
    for (let turn = 0; turn < 10000 && !done; turn++) {
      for (let i = 0; i < 30; i++) await Promise.resolve();
      if (done) break;
      const pending = this.timers.filter(t => t.active);
      assert.ok(pending.length, 'fake acquisition has clock wakeup');
      this.time = Math.max(this.time, Math.min(...pending.map(t => t.at)));
      for (const timer of this.timers.filter(t => t.active && t.at <= this.time)) timer.finish();
    }
    assert.ok(done, 'fake clock completion');
    if (error) throw error;
    return value;
  }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fact = (value, errors = []) => ({ schemaVersion: FACT_SCHEMA_VERSION_R3, value, geometry: null, errors });
const eq = value => ({ cmp: 'eq', value });
const policy = { timeoutMs: 200, pollIntervalMs: 50, stableSamples: 2, geometryDeltaPx: 0.5 };
const calibration = { policyId: 'trusted-fake-control', observerSha256: '1'.repeat(64), observerRevision: 'r3-fake', policyFileSha256: '2'.repeat(64) };
const environment = { entryContract: 'v04-jsx-app-script-react-1', browser: 'fake-node-only' };
function request(text) {
  const sourceBytes = new TextEncoder().encode(text);
  return { sourceBytes, format: 'jsx', trustLevel: 'restricted-generated', entryContract: environment.entryContract,
    viewport: { width: 800, height: 600 }, staticGate: { accepted: true, sourceSha256: hash(sourceBytes) } };
}
function fixture({ overflow = false, excludeNoopFromG = false, extraTarget = false } = {}) {
  const names = ['target', 'protected', 'unrelated', ...(extraTarget ? ['target2'] : [])];
  const plan = { schemaVersion: 'v04-evaluation-plan-r3-1', id: 'public-handwritten-baseline-control',
    catalog: Object.fromEntries(names.map(name => [name, { by: 'role', role: 'textbox', name, exact: true }])),
    viewports: { desktop: { width: 800, height: 600 } }, defaults: { documentOverflowTolerancePx: 0 },
    scenarios: names.map(name => ({ id: name, viewport: 'desktop', freshReload: true, assertNoHorizontalOverflow: overflow,
      steps: [{ op: 'observe', id: name, observation: { kind: 'value', targetRef: name } }] })),
    requirements: { targets: [], originals: [], protections: [], reachability: [], excludeNoopFromG } };
  plan.expectedKeys = deriveExpectedKeysR3(plan);
  const key = name => plan.expectedKeys.find(k => JSON.parse(k)[1] === name && JSON.parse(k)[4] === name);
  plan.requirements.targets = [{ key: key('target'), expect: eq('new') }, ...(extraTarget ? [{ key: key('target2'), expect: eq('new') }] : [])];
  plan.requirements.originals = [{ key: key('target'), expect: eq('old') }, { key: key('protected'), expect: eq(10) }, { key: key('unrelated'), expect: eq('healthy') },
    ...(extraTarget ? [{ key: key('target2'), expect: eq('old') }] : [])];
  plan.requirements.protections = [{ key: key('protected'), mode: 'nonWorsening', expect: eq(10), tolerance: 0 }];
  plan.requirements.reachability = [{ key: key('target'), mode: 'available' }];
  const original = request('ORIGINAL inert bytes'), candidate = request('CANDIDATE inert bytes');
  return { plan, key, original, candidate, originalSourceSha256: hash(original.sourceBytes) };
}
function fakeRunner({ baseline = {}, accepted = {}, mutate, notMeasured = {} } = {}) {
  const calls = [];
  const run = async options => {
    calls.push(options);
    const { plan, policy, ruleSets, mode, calibration, environment } = options;
    const sourceSha256 = hash(options.renderRequest.sourceBytes), runId = `fake-run-${calls.length}`;
    const checks = [];
    for (const checkpoint of plan.checkpoints) {
      const { key, scenarioId } = checkpoint;
      const provenance = evaluationProvenanceR3({ plan, checkpoint, sourceSha256, runId, calibration, environment, policy });
      if (notMeasured[mode]?.includes(scenarioId)) { checks.push({ key, provenance, notMeasured: { reason: 'observer-capability-unavailable', error: { code: 'UNSUPPORTED_OBSERVER' } } }); continue; }
      const values = mode === 'baseline' ? baseline : accepted;
      const value = Object.hasOwn(values, scenarioId) ? values[scenarioId] : checkpoint.autoOverflow ? 0 : scenarioId === 'protected' ? 10 : scenarioId === 'unrelated' ? 'healthy' : mode === 'baseline' ? 'old' : 'new';
      const clock = new FakeClock();
      const output = await clock.run(measureRulesUntilDeadlineR3({ clock, policy, rules: ruleSets[key],
        collect: async ({ sequence }) => {
          const selected = typeof value === 'function' ? value(sequence) : value;
          if (selected?.state) return selected;
          return { state: 'ok', actual: selected?.schemaVersion ? selected : fact(selected), identity: { node: key, runId } };
        } }));
      checks.push({ key, provenance, ...output });
    }
    const output = { schemaVersion: 'v04-evaluation-run-r3-1', runId, sourceSha256, planDigest: plan.planDigest,
      environmentDigest: digestR3(environment), calibrationBindingDigest: digestR3(calibration), measurementPolicy: policy,
      checks, actions: [], errors: [], scenarios: [], receipts: [], runtimeEvidence: { complete: true, events: [], scenarios: plan.runs.map(run => ({ runKey: run.runKey, complete: true })) } };
    attachNativeRuntime(output, options);
    mutate?.(output, options);
    return output;
  };
  return { calls, run };
}
async function capture(f, fake, extra = {}) {
  return captureBaselineR3({ originalRenderRequest: f.original, originalSourceSha256: f.originalSourceSha256,
    plan: f.plan, calibration, environment, policy, runEvaluation: fake.run, ...extra });
}
function lock(f, candidate = f.candidate) {
  return Object.freeze({ id: 'accepted-before-private-evaluation', status: 'accepted', candidateSourceSha256: hash(candidate.sourceBytes),
    originalSourceSha256: f.originalSourceSha256, lockedBeforePrivateEvaluation: true });
}
async function evaluate(f, fake, baselineBundle, extra = {}) {
  return evaluateAcceptedR3({ candidateRenderRequest: f.candidate, originalSourceSha256: f.originalSourceSha256,
    baselineBundle, acceptanceLock: lock(f), plan: f.plan, calibration, environment, policy, runEvaluation: fake.run, ...extra });
}

test('independent ORIGINAL capture, then one candidate acquisition shared by R/G; immutable results', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].mode, 'baseline');
  assert.equal(hash(fake.calls[0].renderRequest.sourceBytes), f.originalSourceSha256);
  assert.equal(baseline.endpoints.R.eligibility, 'eligible');
  assert.equal(baseline.endpoints.G.eligibility, 'eligible');
  assert.ok(Object.isFrozen(baseline.facts[f.key('target')].fact));
  const result = await evaluate(f, fake, baseline);
  assert.equal(fake.calls.length, 2);
  assert.equal(fake.calls[1].mode, 'accepted');
  assert.equal(result.endpoints.R.classification, 'S');
  assert.equal(result.endpoints.G.classification, 'S');
  assert.equal(result.sameSource, false);
  assert.equal(result.methodFeedback, false);
  assert.ok(Object.isFrozen(result.checks));
  assert.deepEqual(Object.keys(fake.calls[1].ruleSets[f.key('target')]).sort(), ['G', 'R', 'capture', 'reachability']);
  assert.equal(fake.calls[1].ruleSets[f.key('target')].G.rule.expect.value, 'new', 'G target overrides original requirement');
});
test('unrelated original defect disqualifies G but leaves R eligible', async () => {
  const f = fixture(), fake = fakeRunner({ baseline: { unrelated: 'broken' } });
  const baseline = await capture(f, fake);
  assert.equal(baseline.endpoints.G.eligibility, 'ineligible');
  assert.equal(baseline.endpoints.R.eligibility, 'eligible');
  const result = await evaluate(f, fake, baseline);
  assert.equal(result.endpoints.R.classification, 'S');
  assert.equal(result.endpoints.G.classification, null);
  assert.ok(!Object.hasOwn(fake.calls[1].ruleSets[f.key('unrelated')], 'G'));
});
test('stable semantic defect can be frozen and protected without equal-failure-count substitution', async () => {
  const f = fixture();
  const semantic = [{ category: 'layout', location: 'panel', code: 'overflow', magnitude: 3 }];
  const fake = fakeRunner({ baseline: { protected: fact(12, semantic) }, accepted: { protected: fact(11, semantic) } });
  const baseline = await capture(f, fake);
  assert.equal(baseline.facts[f.key('protected')].status, 'available');
  assert.deepEqual(baseline.facts[f.key('protected')].fact.errors, semantic);
  assert.equal(baseline.endpoints.R.eligibility, 'eligible');
  assert.equal(baseline.endpoints.G.eligibility, 'ineligible');
  assert.equal((await evaluate(f, fake, baseline)).endpoints.R.classification, 'S');
  const bad = fakeRunner({ baseline: { protected: fact(12, semantic) }, accepted: { protected: fact(11, [{ ...semantic[0], location: 'different-panel' }]) } });
  assert.equal((await evaluate(f, bad, await capture(f, bad))).endpoints.R.classification, 'W');
});
test('original verdict uses full projected temporal policy, not first wrong stable capture', async () => {
  const f = fixture(), fake = fakeRunner({ baseline: { unrelated: seq => seq < 3 ? 'broken' : 'healthy' } });
  const baseline = await capture(f, fake);
  assert.equal(baseline.endpoints.G.eligibility, 'eligible');
  assert.equal(baseline.facts[f.key('unrelated')].fact.value, 'healthy');
});
test('any acquisition gap keeps baseline unknown even after eventual capture satisfaction', async () => {
  const f = fixture(), fake = fakeRunner({ baseline: { protected: seq => seq === 1 ? { state: 'unknown', error: { code: 'UNAVAILABLE' } } : 10 } });
  const baseline = await capture(f, fake);
  assert.equal(baseline.facts[f.key('protected')].status, 'unknown');
  assert.ok(!Object.hasOwn(baseline.facts[f.key('protected')], 'fact'));
  assert.equal(baseline.endpoints.R.eligibility, 'unresolved');
  assert.equal(baseline.endpoints.G.eligibility, 'unresolved');
});
test('confirmed original disqualification dominates unrelated uncertainty without erasing it', async () => {
  const f = fixture(), fake = fakeRunner({ baseline: { unrelated: 'broken' }, notMeasured: { baseline: ['protected'] } });
  const baseline = await capture(f, fake);
  assert.equal(baseline.endpoints.G.eligibility, 'ineligible');
  assert.ok(baseline.endpoints.G.reasons.length);
  assert.ok(baseline.endpoints.G.uncertainty.length);
  assert.equal(baseline.endpoints.R.eligibility, 'unresolved');
});
test('observer unsupported is unresolved infrastructure, never original ineligible or method support gate', async () => {
  const f = fixture(), fake = fakeRunner({ notMeasured: { baseline: ['target'] } });
  const baseline = await capture(f, fake, { methodSupported: false });
  assert.equal(baseline.endpoints.R.eligibility, 'unresolved');
  assert.equal(baseline.endpoints.G.eligibility, 'unresolved');
  const healthy = fakeRunner();
  const healthyBaseline = await capture(f, healthy, { methodSupported: false });
  assert.equal(healthyBaseline.endpoints.R.eligibility, 'eligible');
  assert.equal(healthyBaseline.endpoints.G.eligibility, 'eligible');
});
test('confirmed noop excludes R but leaves healthy primary G eligible; G result still requires candidate evidence', async () => {
  const f = fixture(), fake = fakeRunner({ baseline: { target: 'new' }, accepted: { target: 'wrong' } });
  f.plan.requirements.originals[0].expect = eq('new');
  const baseline = await capture(f, fake);
  assert.equal(baseline.noop, 'confirmed-noop');
  assert.equal(baseline.endpoints.R.eligibility, 'ineligible');
  assert.equal(baseline.endpoints.G.eligibility, 'eligible');
  assert.equal(baseline.endpoints.G.classification, null, 'No-op is not automatic success');
  const result = await evaluate(f, fake, baseline);
  assert.equal(result.afterExecution, 'executed-once-shared-endpoints');
  assert.equal(fake.calls.length, 2);
  assert.equal(result.endpoints.G.classification, 'W');
  assert.equal(result.endpoints.R.classification, null);
});
test('no eligible endpoint skips candidate without deleting any planned keys', async () => {
  const f = fixture(), fake = fakeRunner({ baseline: { target: 'new', unrelated: 'broken' } });
  f.plan.requirements.originals[0].expect = eq('new');
  const baseline = await capture(f, fake);
  assert.equal(baseline.endpoints.R.eligibility, 'ineligible');
  assert.equal(baseline.endpoints.G.eligibility, 'ineligible');
  const result = await evaluate(f, fake, baseline);
  assert.equal(result.afterExecution, 'not-executed-no-eligible-endpoint');
  assert.equal(fake.calls.length, 1);
  assert.equal(result.checks.length, f.plan.expectedKeys.length);
});
test('primary G cannot be silently replaced by a nonnoop sensitivity mask', async () => {
  const f = fixture({ excludeNoopFromG: true }), fake = fakeRunner();
  await assert.rejects(capture(f, fake), /PRIMARY_G_NOOP_EXCLUSION_FORBIDDEN/);
  assert.equal(fake.calls.length, 0);
});
test('noop unresolved with S/unknown; W establishes nonnoop despite unknown but baseline remains unresolved', async () => {
  const f = fixture({ extraTarget: true });
  const unknown = { state: 'unknown', error: { code: 'UNAVAILABLE' } };
  for (const [target, expected] of [['new', 'unresolved'], ['old', 'confirmed-nonnoop']]) {
    const fake = fakeRunner({ baseline: { target, target2: unknown } }), baseline = await capture(f, fake);
    assert.equal(baseline.noop, expected);
    assert.equal(baseline.endpoints.R.eligibility, 'unresolved');
  }
});
test('same-source accepted patch is explicit no-source-change and W only from actual target evidence', async () => {
  const f = fixture(), fake = fakeRunner({ accepted: { target: 'old' } }), baseline = await capture(f, fake);
  const result = await evaluate(f, fake, baseline, { candidateRenderRequest: f.original, acceptanceLock: lock(f, f.original) });
  assert.equal(result.sameSource, true);
  assert.equal(result.sourceChange, 'no-source-change');
  assert.equal(result.endpoints.R.classification, 'W');
  const unknown = fakeRunner({ notMeasured: { accepted: ['target'] } }), other = await capture(f, unknown);
  const unresolved = await evaluate(f, unknown, other, { candidateRenderRequest: f.original, acceptanceLock: lock(f, f.original) });
  assert.equal(unresolved.endpoints.R.classification, 'U_A');
});
test('independent confirmed W dominates required candidate unknown and keeps both diagnostics', async () => {
  const f = fixture(), fake = fakeRunner({ accepted: { target: 'wrong' }, notMeasured: { accepted: ['protected'] } });
  const result = await evaluate(f, fake, await capture(f, fake));
  for (const endpoint of ['R', 'G']) {
    assert.equal(result.endpoints[endpoint].classification, 'W');
    assert.ok(result.endpoints[endpoint].reasons.length);
    assert.ok(result.endpoints[endpoint].uncertainty.length);
  }
});
test('missing, mutable, nonaccepted, late, or wrong-source acceptance lock never triggers candidate run', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake);
  const invalid = [undefined, { ...lock(f) }, Object.freeze({ ...lock(f), status: 'rejected' }),
    Object.freeze({ ...lock(f), lockedBeforePrivateEvaluation: false }),
    Object.freeze({ ...lock(f), candidateSourceSha256: f.originalSourceSha256 }),
    Object.freeze({ ...lock(f), originalSourceSha256: 'f'.repeat(64) })];
  for (const acceptanceLock of invalid) await assert.rejects(evaluate(f, fake, baseline, { acceptanceLock }));
  assert.equal(fake.calls.length, 1);
});
test('opaque baseline rejects copied/fabricated bundles and cross-original input', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake);
  await assert.rejects(evaluate(f, fake, structuredClone(baseline)), /R3_OPAQUE_BASELINE_REQUIRED/);
  const otherHash = 'f'.repeat(64);
  await assert.rejects(evaluate(f, fake, baseline, { originalSourceSha256: otherHash,
    acceptanceLock: Object.freeze({ ...lock(f), originalSourceSha256: otherHash }) }), /R3_BASELINE_ORIGINAL_SOURCE_MISMATCH/);
  assert.equal(fake.calls.length, 1);
});
test('explicit original hash and original/candidate static gate bytes are checked before execution', async () => {
  const f = fixture(), fake = fakeRunner();
  await assert.rejects(capture(f, fake, { originalSourceSha256: 'f'.repeat(64) }), /R3_SOURCE_HASH_MISMATCH/);
  await assert.rejects(capture(f, fake, { originalSourceSha256: undefined }), /R3_EXPLICIT_ORIGINAL_HASH_REQUIRED/);
  const bad = { ...f.original, staticGate: { accepted: true, sourceSha256: 'f'.repeat(64) } };
  await assert.rejects(capture(f, fake, { originalRenderRequest: bad }), /R3_SOURCE_BOUND_STATIC_GATE_REQUIRED/);
  assert.equal(fake.calls.length, 0);
});
test('all keys exact: missing/duplicate/extra run keys are audit errors', async () => {
  const f = fixture();
  for (const kind of ['missing', 'duplicate', 'extra']) {
    const fake = fakeRunner({ mutate: output => {
      if (kind === 'missing') output.checks.pop();
      if (kind === 'duplicate') output.checks[1] = output.checks[0];
      if (kind === 'extra') output.checks.push({ key: 'unexpected', notMeasured: { reason: 'extra' } });
    } });
    await assert.rejects(capture(f, fake), /R3_EXPECTED_KEYS_AUDIT_ERROR/);
  }
});
test('source, catalog, replay, observation and policy provenance tampering rejected', async () => {
  const f = fixture();
  for (const field of ['sourceSha256', 'catalogDigest', 'replayDigest', 'observationDigest', 'measurementPolicyDigest']) {
    const fake = fakeRunner({ mutate: output => { output.checks[0].provenance[field] = 'f'.repeat(64); } });
    await assert.rejects(capture(f, fake), /R3_EXPECTED_PROVENANCE_MISMATCH/);
  }
  const fake = fakeRunner({ mutate: (output, options) => { if (options.mode === 'accepted') output.checks[0].provenance.sourceSha256 = f.originalSourceSha256; } });
  await assert.rejects(evaluate(f, fake, await capture(f, fake)), /R3_EXPECTED_PROVENANCE_MISMATCH/);
});
test('plan/environment/calibration/policy drift rejected before candidate run', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake);
  for (const extra of [{ environment: { ...environment, browser: 'changed' } }, { calibration: { ...calibration, policyId: 'changed' } },
    { policy: { ...policy, timeoutMs: 300 } }, { plan: { ...f.plan, id: 'changed' } }]) {
    await assert.rejects(evaluate(f, fake, baseline, extra), /R3_BASELINE_INPUT_BINDING_MISMATCH/);
  }
  assert.equal(fake.calls.length, 1);
});
test('shared rule projection cannot substitute another expectation, policy, or acquisition', async () => {
  const f = fixture(), fake = fakeRunner({ mutate: output => { output.checks[0].measurements.target = output.checks[0].measurements.capture; } });
  await assert.rejects(capture(f, fake), /R3_RULE_BINDING_MISMATCH/);
});
test('method callbacks are neither invoked nor forwarded to private runner', async () => {
  const f = fixture(), fake = fakeRunner();
  const method = () => assert.fail('private feedback reached method');
  const baseline = await capture(f, fake, { method, onFeedback: method });
  const result = await evaluate(f, fake, baseline, { method, onFeedback: method });
  assert.equal(result.methodFeedback, false);
  for (const call of fake.calls) { assert.ok(!Object.hasOwn(call, 'method')); assert.ok(!Object.hasOwn(call, 'onFeedback')); }
});
test('auto-overflow keys preserved and protected in relevant R footprint only', async () => {
  const f = fixture({ overflow: true }), fake = fakeRunner(), baseline = await capture(f, fake);
  assert.equal(baseline.expectedKeys.length, 9);
  assert.equal(Object.keys(baseline.facts).length, 9);
  const result = await evaluate(f, fake, baseline);
  assert.equal(result.checks.length, 9);
  for (const [key, rules] of Object.entries(fake.calls[1].ruleSets)) {
    const [, scenario, , , id] = JSON.parse(key);
    if (!id.startsWith('$overflow')) continue;
    assert.equal(Object.hasOwn(rules, 'R'), scenario !== 'unrelated');
    assert.equal(Object.hasOwn(rules, 'G'), true);
  }
});

function refreshNativeRuntime(output) {
  output.runtimeEvidence.events = output.runtimeEvidence.scenarios.flatMap(scope => {
    const replayed = normalizeRuntimeJournalR3(scope.nativeJournal, { runKey: scope.runKey, sourceSha256: output.sourceSha256, runId: output.runId });
    scope.complete = replayed.complete && scope.lifecycleComplete;
    return replayed.events;
  });
  output.runtimeEvidence.complete = output.runtimeEvidence.scenarios.every(scope => scope.complete);
}
function appendNativeError(output, options, { scenario = 'target', stageSequence = 0 } = {}) {
  const runKey = options.plan.runs.find(run => run.scenarioId === scenario).runKey;
  const journal = output.runtimeEvidence.scenarios.find(scope => scope.runKey === runKey).nativeJournal;
  journal.events.push({ eventSequence: journal.events.length + 1, renderEpoch: 1, category: 'runtime-exception',
    name: 'TypeError', message: 'trusted handwritten control', native: { method: 'Runtime.exceptionThrown' },
    replayStage: { kind: 'observe', sequence: stageSequence } });
  journal.throughEventSequence = journal.events.length;
  journal.journals[0].events = structuredClone(journal.events);
  refreshNativeRuntime(output);
}
test('missing runtime fields reject, explicit null journals remain unknown without invented clean evidence', async () => {
  const f = fixture(), missing = fakeRunner({ mutate: output => { delete output.runtimeEvidence; } });
  await assert.rejects(capture(f, missing), /R3_NATIVE_RUNTIME_SCOPES_REQUIRED/);
  for (const mode of ['baseline', 'accepted']) {
    const fake = fakeRunner({ mutate: (output, options) => {
      if (options.mode !== mode) return;
      for (const scope of output.runtimeEvidence.scenarios) scope.nativeJournal = null;
      refreshNativeRuntime(output);
    } });
    const baseline = await capture(f, fake);
    if (mode === 'baseline') {
      assert.equal(baseline.endpoints.R.eligibility, 'unresolved');
      assert.equal(baseline.endpoints.G.eligibility, 'unresolved');
    } else {
      const result = await evaluate(f, fake, baseline);
      assert.equal(result.endpoints.R.classification, 'U_A');
      assert.equal(result.endpoints.G.classification, 'U_A');
    }
  }
});
test('confirmed runtime original defect disqualifies G; R accepts unchanged identity multiset', async () => {
  const f = fixture(), fake = fakeRunner({ mutate: (output, options) => { appendNativeError(output, options); } });
  const baseline = await capture(f, fake);
  assert.equal(baseline.endpoints.R.eligibility, 'eligible');
  assert.equal(baseline.endpoints.G.eligibility, 'ineligible');
  assert.equal((await evaluate(f, fake, baseline)).endpoints.R.classification, 'S');
});
test('new runtime identity or greater multiplicity independently confirms W plus required unknown', async () => {
  const f = fixture();
  for (const change of ['identity', 'count']) {
    const fake = fakeRunner({ notMeasured: { accepted: ['protected'] }, mutate: (output, options) => {
      appendNativeError(output, options, { stageSequence: options.mode === 'accepted' && change === 'identity' ? 1 : 0 });
      if (options.mode === 'accepted' && change === 'count') appendNativeError(output, options);
    } });
    const result = await evaluate(f, fake, await capture(f, fake));
    assert.equal(result.endpoints.R.classification, 'W');
    assert.ok(result.endpoints.R.reasons.some(reason => reason.reason === 'new-or-increased-confirmed-runtime-error'));
    assert.ok(result.endpoints.R.uncertainty.length);
  }
});
test('unrelated native runtime errors are outside R but inside G; forged summaries are rejected', async () => {
  const f = fixture(), fake = fakeRunner({ mutate: (output, options) => {
    if (options.mode === 'accepted') appendNativeError(output, options, { scenario: 'unrelated' });
  } });
  const result = await evaluate(f, fake, await capture(f, fake));
  assert.equal(result.endpoints.R.classification, 'S');
  assert.equal(result.endpoints.G.classification, 'W');
  for (const invalid of ['unconfirmed', 'location', 'source']) {
    const other = fakeRunner({ mutate: (output, options) => {
      appendNativeError(output, options);
      const event = output.runtimeEvidence.events[0];
      if (invalid === 'unconfirmed') event.confirmed = false;
      if (invalid === 'location') event.signature.location = '';
      if (invalid === 'source') event.evidence.sourceSha256 = 'f'.repeat(64);
    } });
    await assert.rejects(capture(f, other), /R3_NATIVE_RUNTIME_EVENTS_MISMATCH/);
  }
});
test('preserve protections and explicit reachability predicates are enforced', async () => {
  const f = fixture();
  f.plan.requirements.protections = [{ key: f.key('protected'), mode: 'preserve', tolerance: 0 }];
  f.plan.requirements.reachability = [{ key: f.key('target'), mode: 'available' }, { key: f.key('protected'), mode: 'predicate', expect: eq(10) }];
  const fake = fakeRunner({ accepted: { protected: 11 } });
  assert.equal((await evaluate(f, fake, await capture(f, fake))).endpoints.R.classification, 'W');
  const unreachable = fakeRunner({ baseline: { protected: 11 } });
  const baseline = await capture(f, unreachable);
  assert.equal(baseline.endpoints.R.eligibility, 'ineligible');
  assert.equal(baseline.endpoints.G.eligibility, 'ineligible');
});

test('same-source does not mechanically force W for explicitly noop-eligible G', async () => {
  const f = fixture({ excludeNoopFromG: false }), fake = fakeRunner({ baseline: { target: 'new' } });
  f.plan.requirements.originals[0].expect = eq('new');
  const baseline = await capture(f, fake);
  const result = await evaluate(f, fake, baseline, { candidateRenderRequest: f.original, acceptanceLock: lock(f, f.original) });
  assert.equal(result.sameSource, true);
  assert.equal(result.endpoints.R.classification, null);
  assert.equal(result.endpoints.G.classification, 'S');
});
test('undeclared G noop policy and incomplete independent expected keys are rejected before capture', async () => {
  for (const invalid of ['noop', 'keys']) {
    const f = fixture(), fake = fakeRunner();
    if (invalid === 'noop') delete f.plan.requirements.excludeNoopFromG;
    else f.plan.expectedKeys.pop();
    await assert.rejects(capture(f, fake));
    assert.equal(fake.calls.length, 0);
  }
});

test('stable negative then terminal gap never establishes original failure or available baseline', async () => {
  const f = fixture(), fake = fakeRunner({ baseline: { unrelated: seq => seq < 4 ? 'broken' : { state: 'unknown', error: { code: 'TERMINAL_GAP' } } } });
  const baseline = await capture(f, fake);
  assert.equal(baseline.facts[f.key('unrelated')].status, 'unknown');
  assert.equal(baseline.endpoints.G.eligibility, 'unresolved');
  assert.equal(baseline.endpoints.G.reasons.length, 0);
  assert.equal(baseline.endpoints.R.eligibility, 'eligible');
});
test('unbound runtime event scope cannot be injected into native-derived summaries', async () => {
  const f = fixture(), fake = fakeRunner({ mutate: (output, options) => {
    appendNativeError(output, options);
    output.runtimeEvidence.events[0].runKey = 'not-in-plan';
  } });
  await assert.rejects(capture(f, fake), /R3_NATIVE_RUNTIME_EVENTS_MISMATCH/);
});
test('scoped native journal gaps outside R footprint do not poison independent R baseline or candidate', async () => {
  const f = fixture();
  for (const mode of ['baseline', 'accepted']) {
    const fake = fakeRunner({ mutate: (output, options) => {
      if (options.mode === mode) {
        const runKey = options.plan.runs.find(run => run.scenarioId === 'unrelated').runKey;
        output.runtimeEvidence.scenarios.find(scope => scope.runKey === runKey).nativeJournal = null;
        refreshNativeRuntime(output);
      }
    } });
    const baseline = await capture(f, fake);
    assert.equal(baseline.endpoints.R.eligibility, 'eligible');
    assert.equal(baseline.endpoints.G.eligibility, mode === 'baseline' ? 'unresolved' : 'eligible');
    const result = await evaluate(f, fake, baseline);
    assert.equal(result.endpoints.R.classification, 'S');
    assert.equal(result.endpoints.G.classification, mode === 'baseline' ? null : 'U_A');
  }
});
test('scoped runtime coverage cannot omit or duplicate planned native journals', async () => {
  const f = fixture();
  for (const defect of ['omit', 'duplicate']) {
    const fake = fakeRunner({ mutate: output => {
      const scopes = output.runtimeEvidence.scenarios;
      if (defect === 'omit') scopes.pop();
      if (defect === 'duplicate') scopes[1] = scopes[0];
    } });
    await assert.rejects(capture(f, fake), /R3_NATIVE_RUNTIME_SCOPES_REQUIRED/);
  }
});
test('endpoint requirement key lists stay fixed even when an endpoint is disqualified', async () => {
  const f = fixture(), fake = fakeRunner({ baseline: { unrelated: 'broken' } }), baseline = await capture(f, fake);
  assert.deepEqual(baseline.endpointRequirements.R.checkKeys, [f.key('target'), f.key('protected')]);
  assert.deepEqual(baseline.endpointRequirements.G.checkKeys, f.plan.expectedKeys);
  assert.equal(baseline.endpointRequirements.R.runtimeRunKeys.length, 2);
  assert.equal(baseline.endpointRequirements.G.runtimeRunKeys.length, 3);
  assert.equal(baseline.endpointRequirements.G.qualificationRequired, true);
  assert.ok(Object.isFrozen(baseline.endpointRequirements.G.checkKeys));
  const result = await evaluate(f, fake, baseline);
  assert.deepEqual(result.endpointRequirements, baseline.endpointRequirements);
  assert.deepEqual(result.expectedKeys, f.plan.expectedKeys);
});

const serialized = value => JSON.parse(JSON.stringify(value));
function audit(f, baselineBundle, evaluation, extra = {}) {
  return auditEvaluationReceiptR3({ baselineBundle, evaluation, plan: f.plan, calibration, environment, policy, ...extra });
}
test('pure persisted receipt audit replays serialized baseline and evaluation without execution or brand', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  const b = serialized(baseline), e = serialized(evaluation);
  const result = audit(f, b, e, { runEvaluation: () => assert.fail('audit must not execute runner') });
  assert.equal(result.audited, true);
  assert.equal(result.externalHashAnchorRequired, true);
  assert.deepEqual(result.endpoints, evaluation.endpoints);
  assert.deepEqual(result.endpointRequirements, evaluation.endpointRequirements);
  assert.deepEqual(result.baselineEndpoints, baseline.endpoints);
  assert.ok(Object.isFrozen(result.endpoints.R));
  assert.equal(fake.calls.length, 2);
  await assert.rejects(evaluate(f, fake, b), /R3_OPAQUE_BASELINE_REQUIRED/, 'auditing does not grant execution brand');
});
test('persisted audit preserves W with uncertainty and no-eligible skip receipts', async () => {
  const f = fixture();
  for (const options of [{ accepted: { target: 'wrong' }, notMeasured: { accepted: ['protected'] } },
    { baseline: { target: 'new', unrelated: 'broken' } }]) {
    const fake = fakeRunner(options), baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
    const result = audit(f, serialized(baseline), serialized(evaluation));
    assert.deepEqual(result.endpoints, evaluation.endpoints);
    assert.equal(result.afterExecution, evaluation.afterExecution);
  }
});
test('persisted audit rejects forged endpoint labels, reasons, expected endpoint keys and no-op reports', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  const mutations = [e => { e.endpoints.R.classification = 'W'; }, e => { e.endpoints.G.eligibility = 'ineligible'; },
    e => { e.endpoints.R.uncertainty.push({ reason: 'fabricated' }); }, e => { e.endpointRequirements.G.checkKeys.pop(); },
    e => { e.noop = 'confirmed-noop'; }, e => { e.afterExecution = 'not-executed-no-eligible-endpoint'; },
    e => { e.sameSource = true; }];
  for (const mutate of mutations) {
    const e = serialized(evaluation); mutate(e);
    assert.throws(() => audit(f, serialized(baseline), e), /R3_(ACCEPTED_RECEIPT_REPLAY_MISMATCH|NATIVE_RUNTIME_)/);
  }
});
test('persisted audit recomputes baseline qualification, fact availability, noop and provenance', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  const mutations = [b => { b.endpoints.R.eligibility = 'ineligible'; }, b => { b.noop = 'confirmed-noop'; },
    b => { b.facts[f.key('target')].fact.value = 'new'; }, b => { b.facts[f.key('target')].status = 'unknown'; },
    b => { b.endpointRequirements.R.runtimeRunKeys.pop(); }, b => { b.originalRunId = 'fabricated'; },
    b => { b.provenance.measurementPolicy.timeoutMs = 999; }];
  for (const mutate of mutations) {
    const b = serialized(baseline); mutate(b);
    assert.throws(() => audit(f, b, serialized(evaluation)), /R3_BASELINE_RECEIPT_REPLAY_MISMATCH/);
  }
});
test('persisted audit rejects forged runtime completeness, event confirmation and bound identity flags', async () => {
  const f = fixture(), fake = fakeRunner({ mutate: (output, options) => {
    if (options.mode === 'accepted') appendNativeError(output, options);
  } }), baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  const mutations = [e => { e.runtimeEvidence.complete = false; }, e => { e.runtimeEvidence.events[0].confirmed = false; },
    e => { e.runtimeEvidence.events[0].evidence.sourceSha256 = f.originalSourceSha256; },
    e => { e.runtimeEvidence.scenarios = []; }];
  for (const mutate of mutations) {
    const e = serialized(evaluation); mutate(e);
    assert.throws(() => audit(f, serialized(baseline), e), /R3_(ACCEPTED_RECEIPT_REPLAY_MISMATCH|NATIVE_RUNTIME_)/);
  }
  const b = serialized(baseline); b.run.runtimeEvidence.complete = false;
  assert.throws(() => audit(f, b, serialized(evaluation)), /R3_BASELINE_RECEIPT_REPLAY_MISMATCH/);
});
test('persisted audit rejects forged projection predicates and missing, duplicate or mixed-source keys', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  const mutations = [e => { e.checks[0].measurements.R.samples[0].predicate = false; },
    e => { e.checks.pop(); }, e => { e.checks[1] = e.checks[0]; },
    e => { e.checks[0].provenance.sourceSha256 = f.originalSourceSha256; },
    e => { e.provenance.environmentDigest = 'f'.repeat(64); }, e => { e.provenance.candidateRunId = baseline.originalRunId; }];
  for (const mutate of mutations) {
    const e = serialized(evaluation); mutate(e);
    assert.throws(() => audit(f, serialized(baseline), e));
  }
  const b = serialized(baseline); b.run.checks[0].measurements.original.samples[0].predicate = false;
  assert.throws(() => audit(f, b, serialized(evaluation)));
});
test('persisted audit rejects source/lock/hash mixing, provenance drift and false skip receipt', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  const mutations = [e => { e.originalSourceSha256 = 'f'.repeat(64); }, e => { e.candidateSourceSha256 = 'f'.repeat(64); },
    e => { e.acceptanceLock.status = 'rejected'; }, e => { e.acceptanceLock.lockedBeforePrivateEvaluation = false; },
    e => { e.acceptanceLock.originalSourceSha256 = e.candidateSourceSha256; }, e => { e.acceptanceLockId = 'other'; },
    e => { e.provenance.planDigest = 'f'.repeat(64); }];
  for (const mutate of mutations) {
    const e = serialized(evaluation); mutate(e);
    assert.throws(() => audit(f, serialized(baseline), e));
  }
  for (const extra of [{ environment: { ...environment, browser: 'other' } }, { calibration: { ...calibration, policyId: 'other' } },
    { policy: { ...policy, timeoutMs: 300 } }, { plan: { ...f.plan, id: 'other' } }]) {
    assert.throws(() => audit(f, serialized(baseline), serialized(evaluation), extra));
  }
  const none = fakeRunner({ baseline: { target: 'new', unrelated: 'broken' } }), b = await capture(f, none), e = serialized(await evaluate(f, none, b));
  e.endpoints.R.classification = 'S';
  assert.throws(() => audit(f, serialized(b), e), /R3_ACCEPTED_RECEIPT_REPLAY_MISMATCH/);
});

test('runtime scopes are mandatory even under global complete true, with exact native all-run coverage', async () => {
  const f = fixture();
  for (const defect of ['omitted', 'empty', 'duplicate', 'extra']) {
    for (const mode of ['baseline', 'accepted']) {
      const fake = fakeRunner({ mutate: (output, options) => {
        if (options.mode !== mode) return;
        const evidence = output.runtimeEvidence;
        if (defect === 'omitted') delete evidence.scenarios;
        if (defect === 'empty') evidence.scenarios = [];
        if (defect === 'duplicate') evidence.scenarios[1] = evidence.scenarios[0];
        if (defect === 'extra') evidence.scenarios.push({ runKey: 'undeclared-run', complete: true });
      } });
      if (mode === 'baseline') await assert.rejects(capture(f, fake), /R3_NATIVE_RUNTIME_SCOPES_REQUIRED/);
      else await assert.rejects(evaluate(f, fake, await capture(f, fake)), /R3_NATIVE_RUNTIME_SCOPES_REQUIRED/);
    }
  }
});
test('persisted audit cannot accept omitted scopes as complete runtime evidence', async () => {
  const f = fixture(), fake = fakeRunner(), baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  const b = serialized(baseline); delete b.run.runtimeEvidence.scenarios;
  assert.throws(() => audit(f, b, serialized(evaluation)), /R3_NATIVE_RUNTIME_SCOPES_REQUIRED/);
  const e = serialized(evaluation); delete e.runtimeEvidence.scenarios;
  assert.throws(() => audit(f, serialized(baseline), e), /R3_NATIVE_RUNTIME_SCOPES_REQUIRED/);
});
function attachNativeRuntime(output, options, { error = false, journalComplete = true, lifecycleComplete = true } = {}) {
  const events = [];
  output.runtimeEvidence.scenarios = options.plan.runs.map(run => {
    const nativeEvents = error && run.scenarioId === 'target' ? [{ eventSequence: 1, renderEpoch: 1,
      category: 'runtime-exception', name: 'TypeError', message: 'trusted handwritten control',
      native: { method: 'Runtime.exceptionThrown' }, replayStage: { kind: 'observe', sequence: 0 } }] : [];
    const nativeJournal = { available: true, complete: journalComplete, throughEventSequence: nativeEvents.length,
      journals: [{ sourceSha256: output.sourceSha256, renderEpoch: 1, available: true, complete: journalComplete,
        droppedEvents: 0, events: structuredClone(nativeEvents) }], events: nativeEvents };
    const replayed = normalizeRuntimeJournalR3(nativeJournal, { runKey: run.runKey, sourceSha256: output.sourceSha256, runId: output.runId });
    events.push(...replayed.events);
    return { runKey: run.runKey, nativeJournal, lifecycleComplete, complete: replayed.complete && lifecycleComplete };
  });
  output.runtimeEvidence.events = events;
  output.runtimeEvidence.complete = output.runtimeEvidence.scenarios.every(scope => scope.complete);
}
test('native journals replay independently for capture, candidate, and persisted receipt audit', async () => {
  const f = fixture(), fake = fakeRunner({ mutate: (output, options) => attachNativeRuntime(output, options, { error: options.mode === 'accepted' }) });
  const baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  assert.equal(baseline.endpoints.R.eligibility, 'eligible');
  assert.equal(evaluation.endpoints.R.classification, 'W');
  assert.equal(evaluation.endpoints.G.classification, 'W');
  assert.deepEqual(audit(f, serialized(baseline), serialized(evaluation)).endpoints, evaluation.endpoints);
});
test('incomplete journal or lifecycle retains independently confirmed native W plus uncertainty', async () => {
  const f = fixture();
  for (const incomplete of ['journal', 'lifecycle']) {
    const fake = fakeRunner({ mutate: (output, options) => attachNativeRuntime(output, options,
      options.mode === 'accepted' ? { error: true, journalComplete: incomplete !== 'journal', lifecycleComplete: incomplete !== 'lifecycle' } : {}) });
    const baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
    assert.equal(evaluation.endpoints.R.classification, 'W');
    assert.ok(evaluation.endpoints.R.uncertainty.length);
    assert.deepEqual(audit(f, serialized(baseline), serialized(evaluation)).endpoints, evaluation.endpoints);
  }
});
test('native journal projection tampering and partial journaling are rejected by pure receipt audit', async () => {
  const f = fixture(), fake = fakeRunner({ mutate: (output, options) => attachNativeRuntime(output, options, { error: options.mode === 'accepted' }) });
  const baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  const mutations = [e => { e.runtimeEvidence.events[0].signature.code = 'forged'; },
    e => { e.runtimeEvidence.events[0].confirmed = false; }, e => { e.runtimeEvidence.events = []; },
    e => { e.runtimeEvidence.scenarios[0].complete = false; }, e => { delete e.runtimeEvidence.scenarios[1].nativeJournal; },
    e => { delete e.runtimeEvidence.scenarios[1].lifecycleComplete; }, e => { e.runtimeEvidence.scenarios[0].lifecycleComplete = false; },
    e => { e.runtimeEvidence.scenarios[0].nativeJournal.journals[0].sourceSha256 = baseline.originalSourceSha256; },
    e => { e.runtimeEvidence.scenarios[0].nativeJournal.events[0].replayStage.sequence = 999; }];
  for (const mutate of mutations) {
    const e = serialized(evaluation); mutate(e);
    assert.throws(() => audit(f, serialized(baseline), e), /R3_NATIVE_RUNTIME_/);
  }
});

test('A03 downgrade attack cannot erase all native journals and relabel confirmed runtime W as S', async () => {
  const f = fixture(), fake = fakeRunner({ mutate: (output, options) => {
    if (options.mode === 'accepted') appendNativeError(output, options);
  } });
  const baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  assert.equal(evaluation.endpoints.R.classification, 'W');
  for (const synthetic of [false, true]) {
    const e = serialized(evaluation);
    for (const scope of e.runtimeEvidence.scenarios) {
      delete scope.nativeJournal;
      if (synthetic) scope.synthetic = true;
    }
    if (synthetic) e.runtimeEvidence.synthetic = true;
    e.runtimeEvidence.events = [];
    for (const endpoint of Object.values(e.endpoints)) { endpoint.classification = 'S'; endpoint.reasons = []; endpoint.uncertainty = []; }
    assert.throws(() => audit(f, serialized(baseline), e), /R3_NATIVE_RUNTIME_JOURNALS_REQUIRED/);
  }
});
test('explicit null candidate journals cannot prove clean but preserve independently measured W', async () => {
  const f = fixture(), fake = fakeRunner({ accepted: { target: 'wrong' }, mutate: (output, options) => {
    if (options.mode !== 'accepted') return;
    for (const scope of output.runtimeEvidence.scenarios) scope.nativeJournal = null;
    refreshNativeRuntime(output);
  } });
  const baseline = await capture(f, fake), evaluation = await evaluate(f, fake, baseline);
  for (const endpoint of Object.values(evaluation.endpoints)) {
    assert.equal(endpoint.classification, 'W');
    assert.ok(endpoint.uncertainty.some(reason => reason.reason === 'runtime-evidence-incomplete'));
  }
  assert.deepEqual(audit(f, serialized(baseline), serialized(evaluation)).endpoints, evaluation.endpoints);
});
