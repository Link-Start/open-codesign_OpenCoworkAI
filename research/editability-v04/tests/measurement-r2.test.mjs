import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MEASUREMENT_POLICY, MEASUREMENT_SCHEMA_VERSION, BASELINE_SCHEMA_VERSION,
  measureUntilDeadline, stableWindow, validateMeasurementPolicy, compareMeasurementActual } from '../src/measurement-r2.mjs';
import { classifyMeasurementR2, classifySuiteR2, validateMeasurementR2, SUITE_SCHEMA_VERSION } from '../src/measurement-records-r2.mjs';

// No browser, Node timers, vendor compiler, generated source, or API calls in these tests.
class FakeClock {
  constructor() { this.time = 0; this.timers = []; }
  now = () => this.time;
  sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(Object.assign(new Error('aborted'), { code: 'ABORTED' })); return; }
    const timer = { at: this.time + ms, active: true, resolve, reject };
    const onAbort = () => { if (!timer.active) return; timer.active = false; reject(Object.assign(new Error('aborted'), { code: 'ABORTED' })); };
    timer.finish = () => { if (!timer.active) return; timer.active = false; signal?.removeEventListener('abort', onAbort); resolve(); };
    signal?.addEventListener('abort', onAbort, { once: true });
    this.timers.push(timer);
  });
  async run(promise) {
    let done = false, value, error;
    promise.then(v => { done = true; value = v; }, e => { done = true; error = e; });
    for (let turn = 0; turn < 10000 && !done; turn++) {
      // Drain the known Promise layers before advancing virtual time.
      for (let i = 0; i < 30; i++) await Promise.resolve();
      if (done) break;
      const pending = this.timers.filter(timer => timer.active);
      assert.ok(pending.length, 'Pending operation has no clock wakeup');
      this.time = Math.max(this.time, Math.min(...pending.map(timer => timer.at)));
      for (const timer of this.timers.filter(t => t.active && t.at <= this.time)) timer.finish();
    }
    assert.ok(done, 'Virtual clock iteration cap');
    if (error) throw error;
    return value;
  }
}
const eq = value => ({ cmp: 'eq', value });
const ok = (actual, extra = {}) => ({ state: 'ok', actual, ...extra });
async function run(collect, options = {}) {
  const clock = options.clock ?? new FakeClock();
  const record = await clock.run(measureUntilDeadline({ collect: args => collect(args, clock), expect: eq('ready'), clock, ...options }));
  validateMeasurementR2(record);
  return { record, clock, classification: classifyMeasurementR2(record) };
}
const short = { timeoutMs: 300, pollIntervalMs: 50, stableSamples: 3, geometryDeltaPx: 0.5 };

test('public initial policy is 5000ms/50ms/3 samples/0.5px; new schema only', () => {
  assert.deepEqual(Object.fromEntries(['timeoutMs', 'pollIntervalMs', 'stableSamples', 'geometryDeltaPx'].map(k => [k, DEFAULT_MEASUREMENT_POLICY[k]])),
    { timeoutMs: 5000, pollIntervalMs: 50, stableSamples: 3, geometryDeltaPx: 0.5 });
  assert.equal(DEFAULT_MEASUREMENT_POLICY.temporalMode, 'eventually-stable');
  assert.throws(() => validateMeasurementPolicy({ timeoutMs: 0 }), /INVALID_MEASUREMENT_POLICY/);
  assert.throws(() => validateMeasurementPolicy({ timeoutMs: 60001 }), /TOO_LARGE/);
  assert.throws(() => validateMeasurementPolicy({ hiddenExpected: 'x' }), /INVALID_MEASUREMENT_POLICY/);
  assert.throws(() => validateMeasurementPolicy({ temporalMode: 'first-stable-fail' }), /INVALID_TEMPORAL_MODE/);
});
test('eventually-stable success returns only after complete stable satisfying window', async () => {
  const { record, clock, classification } = await run(() => ok('ready'));
  assert.equal(record.schemaVersion, MEASUREMENT_SCHEMA_VERSION);
  assert.equal(record.outcome, 'observed-satisfied'); assert.equal(classification.partition, 'S');
  assert.equal(clock.time, 100); assert.equal(record.samples.length, 3);
  assert.equal(record.termination.deadlineReached, false); assert.equal(record.coverage.continuousTimeCoverageClaimed, false);
});
test('stable violation cannot fail early and clean deadline confirms only bounded contract', async () => {
  const { record, clock, classification } = await run(() => ok('waiting'));
  assert.equal(clock.time, 5000); assert.equal(record.samples.length, 100);
  assert.equal(record.outcome, 'not-observed-by-deadline'); assert.equal(classification.partition, 'W');
  assert.equal(record.evidence.lastStableViolating.actual, 'waiting');
  assert.equal(record.coverage.terminalGapMs, 50);
  assert.match(classification.confirmed[0].claim, /not a continuous-time claim/);
  assert.equal(classification.predecessorLabelsModified, false);
});
test('long stable wrong prefix followed by sufficient predeadline correct samples passes', async () => {
  const { record, classification } = await run((_, clock) => ok(clock.time < 150 ? 'waiting' : 'ready'), { policy: short });
  assert.equal(record.outcome, 'observed-satisfied'); assert.equal(classification.partition, 'S');
  assert.equal(record.samples.length, 6); assert.equal(record.evidence.lastStableViolating.endMs, 100);
  assert.equal(record.evidence.lastStableSatisfying.endMs, 250);
});
test('one or two transient correct samples cannot establish success', async () => {
  const { record, classification } = await run(({ sequence }) => ok([2, 3].includes(sequence) ? 'ready' : 'waiting'), { policy: short });
  assert.equal(record.outcome, 'not-observed-by-deadline'); assert.equal(record.evidence.lastStableSatisfying, null);
  assert.equal(classification.partition, 'W'); assert.equal(record.termination.observationElapsedMs, 300);
});
test('terminal timeout preserves full stable counterevidence but classification is U_A', async () => {
  let aborted = 0;
  const { record, clock, classification } = await run(({ sequence }) => sequence <= 3 ? ok(91) : new Promise(() => {}), {
    expect: { cmp: 'between', min: 20, max: 40 }, geometry: true, policy: short, abort: async () => { aborted++; },
  });
  assert.equal(clock.time, 300); assert.equal(aborted, 1);
  assert.equal(record.outcome, 'not-observed-by-deadline'); assert.equal(classification.partition, 'U_A');
  assert.equal(record.samples.length, 4); assert.equal(record.samples[3].error.code, 'OBSERVATION_TIMEOUT');
  assert.equal(record.evidence.lastStableViolating.actual, 91); assert.equal(record.evidence.lastValid.actual, 91);
  assert.equal(record.evidence.terminalStableWindow, null); assert.equal(record.health.sessionUsable, false);
  assert.equal(record.health.cleanup.status, 'completed');
  assert.equal(classification.confirmed.length, 0); assert.equal(classification.retainedEvidence.lastStableViolating.actual, 91);
});
test('transient errors reset current window without deleting prior windows', async () => {
  const { record, classification } = await run(({ sequence }) => sequence === 4
    ? { state: 'unknown', error: { code: 'VALUE_UNAVAILABLE', message: 'missing browser value' } }
    : ok('waiting'), { policy: { ...short, timeoutMs: 400 } });
  assert.equal(record.evidence.stableWindows.length, 3);
  assert.deepEqual(record.evidence.stableWindows.map(w => w.sampleSequences), [[1, 2, 3], [5, 6, 7], [6, 7, 8]]);
  assert.equal(record.outcome, 'not-observed-by-deadline'); assert.equal(classification.partition, 'U_A');
  assert.equal(record.coverage.unknownSamples, 1);
});
test('all unknown input values remain unknown, never empty or nonempty observations', async () => {
  const { record, classification } = await run(() => ({ state: 'unknown', error: { code: 'VALUE_UNAVAILABLE' } }), { expect: eq(''), policy: short });
  assert.equal(record.outcome, 'measurement-unknown'); assert.equal(classification.partition, 'U_A');
  assert.equal(record.evidence.lastValid, null); assert.equal(record.evidence.lastStable, null);
  assert.ok(record.samples.every(sample => !Object.hasOwn(sample, 'actual')));
});
test('empty available values pass, unavailable values cannot be laundered as empty', async () => {
  const good = await run(() => ok('', { evidence: { valueState: { status: 'available', source: 'explicit-native-string' } } }), { expect: eq(''), policy: short });
  assert.equal(good.classification.partition, 'S');
  for (const actual of ['', null]) {
    const bad = await run(() => ok(actual, { evidence: { valueState: { status: 'unavailable' } } }), { expect: eq(''), policy: short });
    assert.equal(bad.classification.partition, 'U_A'); assert.equal(bad.record.samples[0].error.code, 'VALUE_UNAVAILABLE');
    assert.ok(!Object.hasOwn(bad.record.samples[0], 'actual'));
  }
});
test('value observations preserve whitespace and newlines rather than text normalization', async () => {
  for (const value of [' ', 'alpha\nbeta', '']) {
    const { record, classification } = await run(() => ok(value), { expect: eq(value), policy: short });
    assert.equal(classification.partition, 'S'); assert.equal(record.evidence.lastValid.actual, value);
  }
  const notEmpty = await run(() => ok(' '), { expect: eq(''), policy: short });
  assert.equal(notEmpty.classification.partition, 'W');
});
test('stable window uses aggregate range, not adjacent-delta drift', async () => {
  assert.equal(stableWindow([0, 0.4, 0.8], { geometry: true, delta: 0.5 }), false);
  assert.equal(stableWindow([[0, 2], [0.1, 2.1], [0.2, 2.4]], { geometry: true, delta: 0.5 }), true);
  const { record, classification } = await run(({ sequence }) => ok(sequence * 0.4), {
    expect: { cmp: 'between', min: 0, max: 100 }, geometry: true, policy: short,
  });
  assert.equal(record.evidence.lastStable, null); assert.equal(classification.partition, 'U_A');
});
test('threshold-side jitter is not a satisfying window even within geometry tolerance', async () => {
  const { record, classification } = await run(({ sequence }) => ok(sequence % 2 ? 9.9 : 10.1), {
    expect: { cmp: 'between', min: 10, max: 20 }, geometry: true, policy: short,
  });
  assert.equal(record.evidence.lastStableSatisfying, null); assert.equal(classification.partition, 'U_A');
});
test('render/context/node identity changes require a new complete stable window', async () => {
  const { record, classification } = await run(({ sequence }) => ok('ready', { identity: { renderId: 'r', context: 'visible', backendNodeId: sequence < 3 ? 1 : 2 } }), { policy: short });
  assert.equal(classification.partition, 'S'); assert.equal(record.samples.length, 5);
  assert.deepEqual(record.evidence.firstStableSatisfying.sampleSequences, [3, 4, 5]);
});
test('completion strictly before deadline can pass; exact and later completion never pass', async () => {
  for (const delay of [99, 100, 101]) {
    const clock = new FakeClock();
    const { record, classification } = await run(async () => { await clock.sleep(delay); return ok('ready'); }, {
      clock, policy: { ...short, timeoutMs: 100, stableSamples: 1 },
    });
    assert.equal(classification.partition, delay < 100 ? 'S' : 'U_A');
    assert.equal(record.evidence.lastStableSatisfying !== null, delay < 100);
    if (delay >= 100) assert.equal(record.samples[0].eligibleBeforeDeadline, false);
  }
});
test('deadline-minus-one update is not enough for a three-sample window', async () => {
  const { record, classification } = await run((_, clock) => ok(clock.time >= 249 ? 'ready' : 'waiting'), { policy: short });
  assert.equal(record.samples.at(-1).actual, 'ready'); assert.equal(record.evidence.lastStableSatisfying, null);
  assert.equal(record.outcome, 'not-observed-by-deadline'); assert.equal(classification.partition, 'U_A');
});
test('response completing beyond cutoff is retained as late, never evaluated', async () => {
  const clock = new FakeClock();
  const { record, classification } = await run(() => { clock.time = 301; return ok('ready'); }, { clock, policy: short });
  assert.equal(record.samples[0].state, 'late'); assert.equal(record.samples[0].lateObservation.actual, 'ready');
  assert.ok(!Object.hasOwn(record.samples[0], 'predicate')); assert.equal(classification.partition, 'U_A');
});
test('late settling operation cannot mutate a finalized result', async () => {
  let resolve;
  const { record, classification } = await run(() => new Promise(r => { resolve = r; }), { policy: short });
  const before = JSON.stringify(record); resolve(ok('ready'));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(JSON.stringify(record), before); assert.equal(classification.partition, 'U_A');
});
test('hold-through-deadline does not stop at first success', async () => {
  const { record, clock, classification } = await run(() => ok('ready'), { policy: { ...short, temporalMode: 'hold-through-deadline' } });
  assert.equal(clock.time, 300); assert.equal(record.samples.length, 6); assert.equal(classification.partition, 'S');
  assert.equal(record.termination.deadlineReached, true);
});
test('hold violation is remembered even if the terminal window recovers', async () => {
  const { record, classification } = await run(({ sequence }) => ok(sequence === 4 ? 'regressed' : 'ready'), {
    policy: { ...short, timeoutMs: 400, temporalMode: 'hold-through-deadline' },
  });
  assert.equal(record.outcome, 'not-observed-by-deadline'); assert.equal(record.evidence.terminalStableWindow.predicate, true);
  assert.deepEqual(record.evidence.holdViolations.map(v => v.sequence), [4]); assert.equal(classification.partition, 'W');
  assert.equal(classification.confirmed[0].reason, 'observed-post-window-hold-counterexample');
});
test('hold unknown after success stays uncertain even after valid recovery', async () => {
  const { record, classification } = await run(({ sequence }) => sequence === 4 ? { state: 'unknown' } : ok('ready'), {
    policy: { ...short, timeoutMs: 400, temporalMode: 'hold-through-deadline' },
  });
  assert.equal(record.outcome, 'measurement-unknown'); assert.equal(record.evidence.holdUncertain, true);
  assert.equal(classification.partition, 'U_A');
});
test('unknown prefix can recover to witnessed eventual or hold success', async () => {
  for (const temporalMode of ['eventually-stable', 'hold-through-deadline']) {
    const { record, classification } = await run(({ sequence }) => sequence === 1 ? { state: 'unknown' } : ok('ready'), { policy: { ...short, temporalMode } });
    assert.equal(classification.partition, 'S'); assert.equal(record.coverage.gaps.length, 1);
    assert.equal(record.evidence.holdUncertain, false);
  }
});
test('fatal early collection error is interrupted, with prior negative evidence preserved', async () => {
  const { record, classification } = await run(({ sequence }) => {
    if (sequence > 3) throw Object.assign(new Error('session gone'), { code: 'SESSION_CLOSED' });
    return ok('waiting');
  }, { policy: short });
  assert.equal(record.outcome, 'interrupted'); assert.equal(record.termination.deadlineReached, false);
  assert.equal(record.evidence.lastStableViolating.actual, 'waiting'); assert.equal(classification.partition, 'U_A');
});
test('cleanup has a separate bound and never changes the observation deadline', async () => {
  const { record, clock } = await run(() => new Promise(() => {}), {
    policy: { ...short, cleanupTimeoutMs: 70 }, abort: () => new Promise(() => {}),
  });
  assert.equal(record.termination.observationElapsedMs, 300); assert.equal(clock.time, 370);
  assert.equal(record.health.cleanup.status, 'timeout'); assert.equal(record.health.cleanup.elapsedMs, 70);
});
test('cleanup failure is reported independently, not erased or promoted to semantic W', async () => {
  const { record, classification } = await run(() => new Promise(() => {}), {
    policy: short, abort: async () => { throw Object.assign(new Error('cleanup unavailable'), { code: 'CLEANUP_FAILED' }); },
  });
  assert.equal(record.health.cleanup.status, 'failed'); assert.equal(record.health.cleanup.error.code, 'CLEANUP_FAILED');
  assert.equal(record.health.terminalError.code, 'OBSERVATION_TIMEOUT'); assert.equal(classification.partition, 'U_A');
});
test('external abort interrupts pending collection and propagates cancellation', async () => {
  const clock = new FakeClock(), controller = new AbortController(); let operationSignal;
  const interruption = clock.sleep(75).then(() => controller.abort());
  const { record, classification } = await run(({ signal }) => { operationSignal = signal; return new Promise(() => {}); }, { clock, signal: controller.signal, policy: short });
  await interruption;
  assert.equal(record.outcome, 'interrupted'); assert.equal(record.termination.observationElapsedMs, 75);
  assert.equal(operationSignal.aborted, true); assert.equal(classification.partition, 'U_A');
});
test('resource cap preserves every attempted sample and reports unknown without truncation', async () => {
  const { record, classification } = await run(({ sequence }) => ok(sequence), {
    expect: { cmp: 'between', min: 100, max: 200 }, policy: { ...short, pollIntervalMs: 0, maxSamples: 5 },
  });
  assert.equal(record.samples.length, 5); assert.equal(record.termination.reason, 'resource-limit');
  assert.equal(record.coverage.completeAttemptHistory, true); assert.equal(classification.partition, 'U_A');
});
test('private expectations and baseline never reach collection or cleanup payloads', async () => {
  const sentinel = 'PRIVATE_EXPECTATION_R2_NEVER_TRANSMIT', calls = [];
  const { classification } = await run(args => { calls.push(args); return ok('public'); }, { expect: eq(sentinel), policy: short });
  assert.equal(classification.partition, 'W'); assert.ok(!JSON.stringify(calls).includes(sentinel));
  assert.ok(calls.every(args => Object.keys(args).sort().join(',') === 'remainingMs,sequence,signal'));
  assert.equal(compareMeasurementActual(3, { cmp: 'sameAsBaseline', tolerance: 0 }, { schemaVersion: BASELINE_SCHEMA_VERSION, actual: 3 }), true);
  assert.throws(() => compareMeasurementActual(3, { cmp: 'sameAsBaseline', tolerance: 0 }, { schemaVersion: 'v03-external-scenarios-1', actual: 3 }), /R2_BASELINE_REQUIRED/);
});
test('comparator type errors remain measurement errors, not assertions on fabricated actuals', async () => {
  const { record, classification } = await run(() => ok('12'), { expect: { cmp: 'between', min: 10, max: 20 }, policy: short });
  assert.equal(record.samples[0].error.code, 'OBSERVATION_TYPE_MISMATCH'); assert.equal(classification.partition, 'U_A');
  assert.ok(record.samples.every(s => !Object.hasOwn(s, 'actual')));
});
test('records reject old schema, dangling evidence, and unknown actual laundering', async () => {
  assert.throws(() => classifyMeasurementR2({ schemaVersion: 'v03-external-scenarios-1', passed: true }), /R2_MEASUREMENT_SCHEMA_REQUIRED/);
  const { record } = await run(() => ok('ready'), { policy: short });
  const missing = structuredClone(record); missing.evidence.lastStableSatisfying = { id: 'made-up' };
  assert.throws(() => classifyMeasurementR2(missing), /DANGLING/);
  const bad = structuredClone(record); bad.samples[0].state = 'unknown';
  assert.throws(() => classifyMeasurementR2(bad), /UNKNOWN_HAS_ACTUAL/);
  const broken = structuredClone(record); broken.evidence.stableWindows[0].sampleSequences = [1, 1, 3];
  assert.throws(() => classifyMeasurementR2(broken), /STABLE_WINDOW/);
});
test('suite S needs complete r2 evidence, exact expected checks, and completed actions', async () => {
  const { record } = await run(() => ok('ready'), { policy: short });
  const suite = { schemaVersion: SUITE_SCHEMA_VERSION, checks: [{ key: 'a', measurement: record }], actions: [{ status: 'performed' }], errors: [] };
  assert.equal(classifySuiteR2(suite, { expectedKeys: ['a'] }).partition, 'S');
  assert.equal(classifySuiteR2(suite, { expectedKeys: ['a', 'missing'] }).partition, 'U_A');
  assert.equal(classifySuiteR2({ ...suite, actions: [{ status: 'skipped' }] }).partition, 'U_A');
  assert.equal(classifySuiteR2({ ...suite, checks: [] }).partition, 'U_A');
  assert.throws(() => classifySuiteR2({ ...suite, schemaVersion: 'v03-external-scenarios-1' }), /R2_SUITE_SCHEMA_REQUIRED/);
  assert.throws(() => classifySuiteR2({ ...suite, checks: [{ key: 'a', measurement: record, passed: true }] }), /INVALID_R2_CHECK_WRAPPER/);
});
test('suite W precedence requires an independent confirmed violation and retains unknown reasons', async () => {
  const bad = (await run(() => ok('waiting'), { policy: short })).record;
  const gap = (await run(() => ({ state: 'unknown' }), { policy: short })).record;
  const suite = { schemaVersion: SUITE_SCHEMA_VERSION, checks: [{ key: 'bad', measurement: bad }, { key: 'gap', measurement: gap }], actions: [], errors: [] };
  const result = classifySuiteR2(suite, { expectedKeys: ['bad', 'gap'] });
  assert.equal(result.partition, 'W'); assert.equal(result.confirmed.length, 1);
  assert.ok(result.confirmed.every(c => c.key === 'bad')); assert.ok(result.unresolved.some(c => c.key === 'gap'));
  const onlyGap = classifySuiteR2({ ...suite, checks: [{ key: 'gap', measurement: gap }], errors: [{ code: 'PAGE_RUNTIME_ERROR' }] });
  assert.equal(onlyGap.partition, 'U_A'); assert.equal(onlyGap.confirmed.length, 0);
});
test('declared downstream skipped check is explicit U_A rather than a missing row', () => {
  const result = classifySuiteR2({ schemaVersion: SUITE_SCHEMA_VERSION, checks: [{ key: 'next', notMeasured: { reason: 'session-invalidated', previousKey: 'timeout' } }], actions: [], errors: [] }, { expectedKeys: ['next'] });
  assert.equal(result.partition, 'U_A'); assert.equal(result.checks.length, 1);
  assert.equal(result.unresolved[0].reason, 'declared-check-not-measured');
});

test('oversleep cannot masquerade as covered deadline and measurement time excludes cleanup', async () => {
  for (const temporalMode of ['eventually-stable', 'hold-through-deadline']) {
    const clock = new FakeClock(), sleep = clock.sleep;
    clock.sleep = (ms, signal) => sleep(ms === 50 && clock.time === 100 ? 250 : ms, signal);
    const { record, classification } = await run(() => ok(temporalMode === 'eventually-stable' ? 'waiting' : 'ready'), { clock, policy: { ...short, temporalMode } });
    assert.equal(clock.time, 350); assert.equal(record.coverage.deadlineTailMs, 200);
    assert.equal(record.coverage.terminalGapMs, 250); assert.equal(record.coverage.deadlineTailWithinPoll, false);
    assert.equal(classification.partition, 'U_A'); assert.ok(classification.unresolved.some(r => r.reason === 'deadline-tail-not-covered'));
    if (temporalMode === 'hold-through-deadline') assert.equal(record.outcome, 'measurement-unknown');
  }
});
test('comparator error retains received raw actual only as non-assertion diagnostic evidence', async () => {
  const { record, classification } = await run(() => ok('not-a-number'), { expect: { cmp: 'between', min: 1, max: 2 }, policy: short });
  assert.equal(record.samples[0].observedActual, 'not-a-number'); assert.equal(record.samples[0].state, 'error');
  assert.ok(!Object.hasOwn(record.samples[0], 'actual')); assert.equal(classification.partition, 'U_A');
});
test('record validator detects forged deadline coverage and late predicate eligibility', async () => {
  const { record } = await run(() => ok('waiting'), { policy: short });
  const coverage = structuredClone(record); coverage.coverage.deadlineTailMs = 0;
  assert.throws(() => classifyMeasurementR2(coverage), /COVERAGE_HISTORY_MISMATCH/);
  const late = structuredClone(record); late.samples.at(-1).completedMs = 300;
  assert.throws(() => classifyMeasurementR2(late), /LATE_SAMPLE_USED/);
});
test('transient ambiguous context can recover without changing the public locator contract', async () => {
  const { record, classification } = await run(({ sequence }) => sequence <= 2
    ? { state: 'error', error: { code: 'AMBIGUOUS_LOCATOR_CONTEXT', message: 'two active groups' } }
    : ok('ready', { identity: { renderId: 'r', contextBackendNodeId: 20, backendNodeId: 21 } }), { policy: short });
  assert.equal(classification.partition, 'S'); assert.equal(record.samples.length, 5);
  assert.equal(record.coverage.errorSamples, 2); assert.deepEqual(record.evidence.firstStableSatisfying.sampleSequences, [3, 4, 5]);
});
test('missing actual and unknown carrying actual are protocol errors, never empty strings', async () => {
  for (const value of [{ state: 'ok' }, { state: 'unknown', actual: '' }]) {
    const { record, classification } = await run(() => value, { expect: eq(''), policy: short });
    assert.equal(classification.partition, 'U_A'); assert.equal(record.evidence.lastValid, null);
    assert.ok(record.samples.every(sample => sample.state === 'error' && !Object.hasOwn(sample, 'actual')));
  }
});
test('monotonic clock enforcement rejects clock reversal instead of inventing durations', async () => {
  let reads = 0;
  await assert.rejects(measureUntilDeadline({ collect: () => ok('ready'), expect: eq('ready'), clock: { now: () => reads++ ? 5 : 10, sleep: async () => {} } }), /NON_MONOTONIC_CLOCK/);
});

test('persisted predicates are recomputed in Node instead of trusted as flags', async () => {
  const { record } = await run(() => ok('waiting'), { policy: short });
  const forged = structuredClone(record); forged.samples[0].predicate = true;
  assert.throws(() => classifyMeasurementR2(forged), /R2_PREDICATE_MISMATCH/);
  const baseline = await run(() => ok(7), { expect: { cmp: 'sameAsBaseline', tolerance: 0 }, baseline: { schemaVersion: BASELINE_SCHEMA_VERSION, actual: 7 }, policy: short });
  assert.equal(baseline.classification.partition, 'S'); assert.equal(baseline.record.baselineEvidence.actual, 7);
  const changed = structuredClone(baseline.record); changed.baselineEvidence.actual = 8;
  assert.throws(() => classifyMeasurementR2(changed), /R2_PREDICATE_MISMATCH/);
});
