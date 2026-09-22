import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MEASUREMENT_POLICY_R3, MEASUREMENT_SCHEMA_VERSION_R3, FACT_SCHEMA_VERSION_R3,
  validateFactR3, validateMeasurementExpectationR3, validateMeasurementPolicyR3, compareFactR3, nonWorseningFactR3,
  predicateErrorVectorR3, stableWindowR3, measureUntilDeadlineR3, measureRulesUntilDeadlineR3 } from '../src/measurement-r3.mjs';
import { classifyMeasurementR3, classifySuiteR3, validateMeasurementR3, projectMeasurementR3, SUITE_SCHEMA_VERSION_R3 } from '../src/measurement-records-r3.mjs';
// Trusted hand-written pure Node tests only. No browser/API/generated candidate execution.
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
const absolute = expect => ({ cmp: 'r3', rule: { kind: 'absolute', expect } });
const capture = { cmp: 'r3', rule: { kind: 'capture' } };
const fact = (value, extra = {}) => ({ schemaVersion: FACT_SCHEMA_VERSION_R3, value, geometry: null, errors: [], ...extra });
const error = (extra = {}) => ({ category: 'layout', location: 'target', code: 'OVERFLOW', ...extra });
const ok = (value, extra = {}) => ({ state: 'ok', actual: fact(value), ...extra });
const preserve = (baseline, tolerance = 0) => ({ cmp: 'r3', rule: { kind: 'preserve', baseline, tolerance } });
const short = { timeoutMs: 300, pollIntervalMs: 50, stableSamples: 3, geometryDeltaPx: 0.5 };
async function run(collect, options = {}) {
  const clock = options.clock ?? new FakeClock();
  const record = await clock.run(measureUntilDeadlineR3({ collect: args => collect(args, clock), expect: absolute(eq('ready')), policy: short, clock, ...options }));
  validateMeasurementR3(record);
  const persisted = JSON.parse(JSON.stringify(record));
  assert.equal(classifyMeasurementR3(persisted).partition, classifyMeasurementR3(record).partition);
  return { record, clock, classification: classifyMeasurementR3(record) };
}
async function shared(collect, rules, options = {}) {
  const clock = options.clock ?? new FakeClock();
  const output = await clock.run(measureRulesUntilDeadlineR3({ collect: args => collect(args, clock), rules, policy: short, clock, ...options }));
  validateMeasurementR3(output.acquisition);
  for (const m of Object.values(output.measurements)) validateMeasurementR3(JSON.parse(JSON.stringify(m)));
  return { ...output, clock };
}

test('r3 defaults retain r2 deadline/poll/sample/delta/cleanup policy', () => {
  assert.deepEqual(DEFAULT_MEASUREMENT_POLICY_R3, { timeoutMs: 5000, pollIntervalMs: 50, stableSamples: 3, geometryDeltaPx: 0.5,
    temporalMode: 'eventually-stable', cleanupTimeoutMs: 1000, maxSamples: 10000 });
  assert.throws(() => validateMeasurementPolicyR3({ timeoutMs: 0 }));
  assert.throws(() => validateMeasurementPolicyR3({ timeoutMs: 60001 }));
  assert.throws(() => validateMeasurementPolicyR3({ temporalMode: 'first-stable-fail' }));
});
test('typed facts validate exact schema, JSON value, finite full geometry and error magnitudes', () => {
  for (const value of ['', null, false, 0, ['x', 1], { x: [2] }]) assert.deepEqual(validateFactR3(fact(value)), fact(value));
  for (const bad of [fact(undefined), fact(NaN), fact(() => true), fact(new Date()), fact(0, { geometry: [Infinity] }),
    fact(0, { geometry: [[1]] }), fact(0, { errors: [error({ magnitude: -1 })] }), fact(0, { errors: [error({ magnitude: null })] }),
    fact(0, { errors: [error({ magnitude: undefined })] }), fact(0, { errors: [{ category: 'x', code: 'x' }] }),
    { schemaVersion: FACT_SCHEMA_VERSION_R3, value: 0, errors: [] }, fact(0, { schemaVersion: 'v04-measurement-r2-1' }),
    fact(0, { extra: true }), fact(0, { stability: { x: undefined } })]) assert.throws(() => validateFactR3(bad));
  const cyclic = fact(0); cyclic.value = cyclic; assert.throws(() => validateFactR3(cyclic));
  const getter = fact(0); Object.defineProperty(getter, 'value', { enumerable: true, get() { throw new Error('must not execute'); } });
  assert.throws(() => validateFactR3(getter), /R3_JSON_REQUIRED/);
});
test('serializable rules reject unknown comparators, missing baseline/tolerance and custom functions', () => {
  for (const bad of [eq(1), { cmp: 'r3', rule: { kind: 'unknown' } }, { cmp: 'r3', rule: { kind: 'capture', fn: () => true } },
    { cmp: 'r3', rule: { kind: 'absolute', expect: { cmp: 'sameAsBaseline', tolerance: 0 } } },
    preserve({ state: 'unknown' }), preserve(fact(0), -1), { cmp: 'r3', rule: { kind: 'preserve', baseline: fact(0) } }]) {
    assert.throws(() => validateMeasurementExpectationR3(bad));
  }
});
test('capture independently stabilizes a semantically failing fact', async () => {
  const raw = fact('wrong', { errors: [error()], geometry: [1, 2, 100, 200, 1000, 800], stability: { context: 'target' } });
  const captured = await run(() => ({ state: 'ok', actual: raw }), { expect: capture });
  assert.equal(captured.classification.partition, 'S'); assert.equal(captured.clock.time, 100);
  assert.deepEqual(captured.record.evidence.lastStable.actual, raw);
  const absoluteResult = await run(() => ({ state: 'ok', actual: raw }), { expect: absolute(eq('wrong')) });
  assert.equal(absoluteResult.classification.partition, 'W');
});
test('absolute requires original predicate and no semantic errors', () => {
  assert.equal(compareFactR3(fact('a b'), absolute({ cmp: 'includes', value: 'b' })), true);
  assert.equal(compareFactR3(fact('a b'), absolute({ cmp: 'notIncludes', value: 'c' })), true);
  assert.equal(compareFactR3(fact('a b', { errors: [error()] }), absolute(eq('a b'))), false);
  assert.equal(compareFactR3(fact('wrong'), absolute(eq('right'))), false);
  assert.throws(() => compareFactR3(fact(null), absolute({ cmp: 'between', min: 1, max: 2 })), /TYPE_MISMATCH/);
});
test('preserve permits only numeric tolerance and exact nonnumeric equality', () => {
  assert.equal(compareFactR3(fact([1.2, 3]), preserve(fact([1, 3]), 0.3)), true);
  assert.equal(compareFactR3(fact([[1.2], 3]), preserve(fact([[1], 3]), 0.3)), true);
  assert.equal(compareFactR3(fact([1.4, 3]), preserve(fact([1, 3]), 0.3)), false);
  assert.equal(compareFactR3(fact([1]), preserve(fact([1, 3]), 10)), false);
  assert.equal(compareFactR3(fact('1.1'), preserve(fact('1'), 10)), false);
  assert.equal(compareFactR3(fact({ x: 1.1 }), preserve(fact({ x: 1 }), 10)), false);
  assert.equal(compareFactR3(fact(['x', 1.1]), preserve(fact(['x', 1]), 10)), false);
});
test('directional nonworsening rejects equal failure counts and opposite-side errors', () => {
  const expect = { cmp: 'between', min: 10, max: 20 };
  assert.deepEqual(predicateErrorVectorR3(8, expect), { kind: 'numeric', passed: false, vector: [2, 0] });
  assert.equal(nonWorseningFactR3(fact(9), expect, fact(8)), true);
  assert.equal(nonWorseningFactR3(fact(7), expect, fact(8)), false);
  assert.equal(nonWorseningFactR3(fact(22), expect, fact(8)), false);
  assert.equal(nonWorseningFactR3(fact(22), expect, fact(8), 2), true);
  assert.equal(nonWorseningFactR3(fact(7.9), expect, fact(8), 0.2), true);
  assert.equal(nonWorseningFactR3(fact(15), expect, fact(8)), true);
});
test('previously passing original predicate may never fail within a permissive tolerance', () => {
  assert.equal(nonWorseningFactR3(fact(9.9), { cmp: 'between', min: 10, max: 20 }, fact(10), 100), false);
  assert.equal(nonWorseningFactR3(fact(10.01), eq(10), fact(10), 100), false);
  assert.equal(nonWorseningFactR3(fact([1, 2.01]), eq([1, 2]), fact([1, 2]), 100), false);
});
test('numeric eq arrays compare directional components and exact shape-failure identity', () => {
  assert.equal(nonWorseningFactR3(fact([0.5, 1.5]), eq([1, 2]), fact([0, 1])), true);
  assert.equal(nonWorseningFactR3(fact([1, 0]), eq([1, 2]), fact([0, 1])), false);
  assert.equal(nonWorseningFactR3(fact([2, 3]), eq([1, 2]), fact([0, 1])), false);
  assert.equal(nonWorseningFactR3(fact([0]), eq([1, 2]), fact([0])), true);
  assert.equal(nonWorseningFactR3(fact([1]), eq([1, 2]), fact([0])), false);
  assert.equal(nonWorseningFactR3(fact([1, 2]), eq([1, 2]), fact([0])), true);
});
test('discrete wrong outcomes retain exact actual identity or correct to passing', () => {
  for (const [expected, wrong, other] of [['right', 'wrong', 'different'], [true, false, null], [{ x: 1 }, { x: 2 }, { x: 3 }]]) {
    assert.equal(nonWorseningFactR3(fact(wrong), eq(expected), fact(wrong), 100), true);
    assert.equal(nonWorseningFactR3(fact(other), eq(expected), fact(wrong), 100), false);
    assert.equal(nonWorseningFactR3(fact(expected), eq(expected), fact(wrong)), true);
  }
  assert.equal(nonWorseningFactR3(fact('wrong2'), { cmp: 'includes', value: 'yes' }, fact('wrong1')), false);
  assert.equal(nonWorseningFactR3(fact('yes'), { cmp: 'includes', value: 'yes' }, fact('wrong1')), true);
});
test('error signature multisets reject code/location/category changes and new duplicates but permit removals', () => {
  const baseline = fact(1, { errors: [error(), error({ code: 'OTHER' })] });
  for (const changed of [error({ code: 'NEW' }), error({ location: 'elsewhere' }), error({ category: 'runtime' })]) {
    assert.equal(compareFactR3(fact(1, { errors: [changed] }), preserve(baseline)), false);
  }
  assert.equal(compareFactR3(fact(1, { errors: [error(), error()] }), preserve(baseline)), false);
  assert.equal(compareFactR3(fact(1, { errors: [error()] }), preserve(baseline)), true);
  assert.equal(compareFactR3(fact(1), preserve(baseline)), true);
  assert.equal(compareFactR3(fact(1, { errors: [...baseline.errors].reverse() }), preserve(baseline)), true);
});
test('matching magnitude is bounded, multiset occurrence matching allows removal, and one-sided absence is unknown', async () => {
  const baseline = fact(1, { errors: [error({ magnitude: 1 }), error({ magnitude: 5 })] });
  assert.equal(compareFactR3(fact(1, { errors: [error({ magnitude: 5.1 })] }), preserve(baseline, 0.2)), true);
  assert.equal(compareFactR3(fact(1, { errors: [error({ magnitude: 5.3 })] }), preserve(baseline, 0.2)), false);
  assert.throws(() => compareFactR3(fact(1, { errors: [error()] }), preserve(baseline)), /MAGNITUDE_ENCODING_MISMATCH/);
  assert.throws(() => compareFactR3(fact(1, { errors: [error({ magnitude: 0 })] }), preserve(fact(1, { errors: [error()] }))), /MAGNITUDE_ENCODING_MISMATCH/);
  const result = await run(() => ({ state: 'ok', actual: fact(1, { errors: [error()] }) }), { expect: preserve(baseline) });
  assert.equal(result.classification.partition, 'U_A');
  assert.ok(result.record.samples.every(s => s.state === 'error' && !Object.hasOwn(s, 'actual') && s.observedActual));
});
test('whole-window value ranges reject cumulative drift; numeric jitter requires geometry mode', () => {
  assert.equal(stableWindowR3([0, 0.4, 0.8].map(v => fact(v)), { geometry: true, delta: 0.5 }), false);
  assert.equal(stableWindowR3([1, 1.1, 1.2].map(v => fact(v)), { geometry: true, delta: 0.5 }), true);
  assert.equal(stableWindowR3([1, 1.1, 1.2].map(v => fact(v)), { geometry: false, delta: 0.5 }), false);
  assert.equal(stableWindowR3([fact('a'), fact('b'), fact('a')], { geometry: true }), false);
});
test('compound facts stabilize full target/document geometry even when predicate boolean is constant', async () => {
  const result = await run(({ sequence }) => ({ state: 'ok', actual: fact(true, { geometry: [0, 0, 100, 100, 800, sequence * 0.4] }) }), { expect: absolute(eq(true)) });
  assert.equal(result.classification.partition, 'U_A'); assert.equal(result.record.evidence.lastStable, null);
  assert.equal(stableWindowR3([fact(true, { geometry: null }), fact(true, { geometry: [] })]), false);
  assert.equal(stableWindowR3([fact(true, { geometry: [1, 2] }), fact(true, { geometry: [1.1, 2.1] })]), true);
});
test('semantic identity and stability metadata are discrete; error magnitude range uses delta', () => {
  assert.equal(stableWindowR3([0, 0.4, 0.8].map(magnitude => fact(true, { errors: [error({ magnitude })] }))), false);
  assert.equal(stableWindowR3([0, 0.1, 0.2].map(magnitude => fact(true, { errors: [error({ magnitude })] }))), true);
  assert.equal(stableWindowR3([fact(1, { errors: [error()] }), fact(1, { errors: [error({ code: 'OTHER' })] })]), false);
  assert.equal(stableWindowR3([fact(1, { stability: { mode: 1 } }), fact(1, { stability: { mode: 2 } })]), false);
  assert.equal(stableWindowR3([fact(1), fact(1, { stability: null })]), false);
});
test('eventual success waits for a complete satisfying window and wrong never fails early', async () => {
  const success = await run(() => ok('ready')); assert.equal(success.clock.time, 100); assert.equal(success.classification.partition, 'S');
  assert.equal(success.record.schemaVersion, MEASUREMENT_SCHEMA_VERSION_R3);
  const wrong = await run(() => ok('waiting')); assert.equal(wrong.clock.time, 300); assert.equal(wrong.classification.partition, 'W');
  const eventual = await run((_, clock) => ok(clock.time < 150 ? 'waiting' : 'ready'));
  assert.equal(eventual.classification.partition, 'S'); assert.equal(eventual.clock.time, 250);
});
test('predicate disagreement prevents threshold jitter from becoming stable within geometry delta', async () => {
  const result = await run(({ sequence }) => ok(sequence % 2 ? 9.9 : 10.1), { geometry: true, expect: absolute({ cmp: 'between', min: 10, max: 20 }) });
  assert.equal(result.classification.partition, 'U_A'); assert.equal(result.record.evidence.lastStable, null);
});
test('identity drift restarts the complete stable window', async () => {
  const result = await run(({ sequence }) => ok('ready', { identity: { render: 'r', node: sequence < 3 ? 1 : 2 } }));
  assert.equal(result.record.samples.length, 5); assert.deepEqual(result.record.evidence.firstStableSatisfying.sampleSequences, [3, 4, 5]);
});
test('terminal timeout retains stable wrong but never rescues it to W', async () => {
  let cleaned = 0;
  const result = await run(({ sequence }) => sequence <= 3 ? ok('wrong') : new Promise(() => {}), { abort: async () => { cleaned++; } });
  assert.equal(result.classification.partition, 'U_A'); assert.equal(result.record.outcome, 'not-observed-by-deadline');
  assert.equal(result.record.evidence.lastStableViolating.actual.value, 'wrong'); assert.equal(result.record.evidence.terminalStableWindow, null);
  assert.equal(cleaned, 1); assert.equal(result.record.health.sessionUsable, false);
});
test('an interior gap followed by stable wrong remains UA and all attempts survive', async () => {
  const result = await run(({ sequence }) => sequence === 4 ? { state: 'unknown' } : ok('wrong'), { policy: { ...short, timeoutMs: 400 } });
  assert.equal(result.classification.partition, 'U_A'); assert.equal(result.record.evidence.stableWindows.length, 3);
  assert.equal(result.record.coverage.gaps.length, 1); assert.equal(result.record.samples.length, 8);
});
test('unknown/error actuals and malformed facts are never assertion values', async () => {
  for (const raw of [{ state: 'unknown', actual: fact('') }, { state: 'error', actual: fact('') }, { state: 'ok', actual: '' },
    { state: 'ok', actual: fact('', { schemaVersion: 'unknown' }) }, { state: 'unknown' }, { state: 'ok', actual: fact(''), evidence: { valueState: { status: 'unavailable' } } }]) {
    const result = await run(() => raw, { expect: absolute(eq('')) });
    assert.equal(result.classification.partition, 'U_A'); assert.ok(result.record.samples.every(s => !Object.hasOwn(s, 'actual')));
  }
});
test('whitespace/empty/false/zero/null remain raw observed values', async () => {
  for (const value of ['', ' ', 'a\nb', false, 0, null]) {
    const result = await run(() => ok(value), { expect: absolute(eq(value)) });
    assert.equal(result.classification.partition, 'S'); assert.equal(result.record.evidence.lastValid.actual.value, value);
  }
});
test('completion is eligible strictly before deadline, excluding equal/late and stale async settlement', async () => {
  for (const delay of [99, 100, 101]) {
    const clock = new FakeClock();
    const result = await run(async () => { await clock.sleep(delay); return ok('ready'); }, { clock, policy: { ...short, timeoutMs: 100, stableSamples: 1 } });
    assert.equal(result.classification.partition, delay < 100 ? 'S' : 'U_A');
  }
  let resolve;
  const result = await run(() => new Promise(r => { resolve = r; }));
  const before = JSON.stringify(result.record); resolve(ok('ready'));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(JSON.stringify(result.record), before);
  const clock = new FakeClock();
  const late = await run(() => { clock.time = 301; return ok('ready'); }, { clock });
  assert.equal(late.record.samples[0].state, 'late'); assert.equal(late.record.samples[0].lateObservation.actual.value, 'ready');
  assert.equal(late.classification.partition, 'U_A');
});
test('hold checks continue to deadline and retain post-window counterexamples', async () => {
  const policy = { ...short, timeoutMs: 400, temporalMode: 'hold-through-deadline' };
  const good = await run(() => ok('ready'), { policy }); assert.equal(good.classification.partition, 'S'); assert.equal(good.clock.time, 400);
  const wrong = await run(({ sequence }) => ok(sequence === 4 ? 'wrong' : 'ready'), { policy });
  assert.equal(wrong.classification.partition, 'W'); assert.deepEqual(wrong.record.evidence.holdViolations.map(v => v.sequence), [4]);
  const gap = await run(({ sequence }) => sequence === 4 ? { state: 'unknown' } : ok('ready'), { policy });
  assert.equal(gap.classification.partition, 'U_A'); assert.equal(gap.record.evidence.holdUncertain, true);
});
test('unknown prefix can recover to an independently witnessed satisfying window', async () => {
  for (const temporalMode of ['eventually-stable', 'hold-through-deadline']) {
    const result = await run(({ sequence }) => sequence === 1 ? { state: 'unknown' } : ok('ready'), { policy: { ...short, temporalMode } });
    assert.equal(result.classification.partition, 'S'); assert.equal(result.record.coverage.gaps.length, 1);
  }
});
test('fatal cleanup and separate cleanup budget preserve unusable session and observation cutoff', async () => {
  const fatal = await run(({ sequence }) => {
    if (sequence > 3) throw Object.assign(new Error('gone'), { code: 'SESSION_CLOSED' });
    return ok('wrong');
  });
  assert.equal(fatal.classification.partition, 'U_A'); assert.equal(fatal.record.outcome, 'interrupted');
  const timeout = await run(() => new Promise(() => {}), { policy: { ...short, cleanupTimeoutMs: 70 }, abort: () => new Promise(() => {}) });
  assert.equal(timeout.record.termination.observationElapsedMs, 300); assert.equal(timeout.clock.time, 370); assert.equal(timeout.record.health.cleanup.status, 'timeout');
  const failed = await run(() => new Promise(() => {}), { abort: async () => { throw new Error('cleanup failed'); } });
  assert.equal(failed.record.health.cleanup.status, 'failed'); assert.equal(failed.classification.partition, 'U_A');
});
test('external abort cancels operation and remains unresolved', async () => {
  const clock = new FakeClock(), controller = new AbortController(); let operationSignal;
  const interrupt = clock.sleep(75).then(() => controller.abort());
  const result = await run(({ signal }) => { operationSignal = signal; return new Promise(() => {}); }, { clock, signal: controller.signal });
  await interrupt; assert.equal(operationSignal.aborted, true); assert.equal(result.classification.partition, 'U_A'); assert.equal(result.clock.time, 75);
});
test('resource cap retains all history and monotonic clock rejects reversal', async () => {
  const result = await run(({ sequence }) => ok(sequence), { expect: absolute(eq(-1)), policy: { ...short, pollIntervalMs: 0, maxSamples: 5 } });
  assert.equal(result.classification.partition, 'U_A'); assert.equal(result.record.samples.length, 5); assert.equal(result.record.termination.reason, 'resource-limit');
  let reads = 0;
  await assert.rejects(measureUntilDeadlineR3({ collect: () => ok('ready'), expect: capture, clock: { now: () => reads++ ? 5 : 10, sleep: async () => {} } }), /NON_MONOTONIC_CLOCK/);
});
test('oversleep cannot claim covered deadline tail', async () => {
  for (const temporalMode of ['eventually-stable', 'hold-through-deadline']) {
    const clock = new FakeClock(), sleep = clock.sleep;
    clock.sleep = (ms, signal) => sleep(ms === 50 && clock.time === 100 ? 250 : ms, signal);
    const result = await run(() => ok(temporalMode === 'eventually-stable' ? 'wrong' : 'ready'), { clock, policy: { ...short, temporalMode } });
    assert.equal(result.classification.partition, 'U_A'); assert.equal(result.record.coverage.deadlineTailMs, 200);
  }
});
test('private rule/baseline never reaches collector or cleanup; serialized full rule is retained privately', async () => {
  const calls = [], baseline = fact('PRIVATE_BASELINE_SENTINEL');
  const result = await run(args => { calls.push(args); return ok('wrong'); }, { expect: preserve(baseline) });
  assert.ok(calls.every(args => Object.keys(args).sort().join(',') === 'remainingMs,sequence,signal'));
  assert.ok(!JSON.stringify(calls).includes('PRIVATE_BASELINE_SENTINEL'));
  assert.deepEqual(result.record.expectation, preserve(baseline)); assert.deepEqual(result.record.baselineEvidence, baseline);
});
test('record replay rejects forged predicates/windows/identity/span/outcome and full coverage fields', async () => {
  const { record } = await run(() => ok('wrong'));
  const mutations = [r => { r.schemaVersion = 'v04-measurement-r2-1'; }, r => { r.samples[0].predicate = true; },
    r => { r.samples[0].actual.schemaVersion = 'unknown'; }, r => { r.evidence.stableWindows[0].identity = { fake: 1 }; },
    r => { r.evidence.stableWindows[0].spanMs = 0; }, r => { r.evidence.stableWindows[0].sampleSequences = [1, 1, 3]; },
    r => { r.coverage.deadlineTailMs = 0; }, r => { r.coverage.lastValidAtMs = 0; }, r => { r.coverage.maximumValidSampleGapMs = 0; },
    r => { r.coverage.terminalGapMs = 0; }, r => { r.outcome = 'observed-satisfied'; }, r => { r.termination.reason = 'satisfied'; },
    r => { r.health.sessionUsable = false; }, r => { r.expectation.rule.kind = 'unknown'; }, r => { r.samples[0].state = 'unknown'; }];
  for (const mutate of mutations) { const forged = structuredClone(record); mutate(forged); assert.throws(() => classifyMeasurementR3(forged)); }
  const omitted = structuredClone(record); omitted.evidence.stableWindows.splice(0, 1);
  assert.throws(() => classifyMeasurementR3(omitted));
});
test('suites require exact expected keys and preserve independent W precedence without upgrading gaps', async () => {
  const bad = (await run(() => ok('wrong'))).record;
  const gap = (await run(() => ({ state: 'unknown' }))).record;
  const good = (await run(() => ok('ready'))).record;
  const suite = { schemaVersion: SUITE_SCHEMA_VERSION_R3, checks: [{ key: 'bad', measurement: bad }, { key: 'gap', measurement: gap }], actions: [], errors: [] };
  assert.throws(() => classifySuiteR3(suite), /EXPECTED_KEYS/);
  const result = classifySuiteR3(suite, { expectedKeys: ['bad', 'gap'] });
  assert.equal(result.partition, 'W'); assert.ok(result.confirmed.every(c => c.key === 'bad')); assert.ok(result.unresolved.some(c => c.key === 'gap'));
  const s = { ...suite, checks: [{ key: 'good', measurement: good }] };
  assert.equal(classifySuiteR3(s, { expectedKeys: ['good'] }).partition, 'S');
  assert.equal(classifySuiteR3(s, { expectedKeys: ['good', 'missing'] }).partition, 'U_A');
  assert.equal(classifySuiteR3({ ...s, checks: [...s.checks, ...s.checks] }, { expectedKeys: ['good'] }).partition, 'U_A');
  assert.equal(classifySuiteR3({ ...s, actions: [{ status: 'error' }] }, { expectedKeys: ['good'] }).partition, 'U_A');
  assert.equal(classifySuiteR3({ ...s, checks: [{ key: 'gap', notMeasured: { reason: 'dependency-failed' } }] }, { expectedKeys: ['gap'] }).partition, 'U_A');
});
test('shared R/G use one full trajectory and one timing authority despite different rule outcomes', async () => {
  let calls = 0;
  const baseline = fact(8), expect = { cmp: 'between', min: 10, max: 20 };
  const rules = { R: { cmp: 'r3', rule: { kind: 'nonWorsening', expect, baseline, tolerance: 0 } }, G: absolute(expect), baseline: capture };
  const output = await shared(() => { calls++; return ok(9); }, rules);
  assert.equal(calls, 6); assert.equal(output.clock.time, 300);
  assert.equal(classifyMeasurementR3(output.acquisition).partition, 'S');
  assert.equal(classifyMeasurementR3(output.measurements.R).partition, 'S');
  assert.equal(classifyMeasurementR3(output.measurements.G).partition, 'W');
  assert.equal(classifyMeasurementR3(output.measurements.baseline).partition, 'S');
  for (const measurement of Object.values(output.measurements)) {
    assert.equal(measurement.policy.temporalMode, 'eventually-stable');
    assert.equal(measurement.projection.acquisitionPolicy.temporalMode, 'hold-through-deadline');
    assert.deepEqual(measurement.projection.rulePolicy, measurement.policy);
    assert.deepEqual(measurement.samples.map(({ actual, completedMs, identity }) => ({ actual, completedMs, identity })), output.acquisition.samples.map(({ actual, completedMs, identity }) => ({ actual, completedMs, identity })));
    assert.deepEqual(measurement.projection.acquisition, output.acquisition);
  }
});
test('shared eventual positive survives subsequent nonfatal unknown but never fatal invalid session', async () => {
  const rules = { event: absolute(eq('ready')) };
  const recovered = await shared(({ sequence }) => sequence === 4 ? { state: 'unknown' } : ok('ready'), rules);
  assert.equal(classifyMeasurementR3(recovered.acquisition).partition, 'U_A');
  assert.equal(classifyMeasurementR3(recovered.measurements.event).partition, 'S');
  const fatal = await shared(({ sequence }) => sequence > 3 ? { state: 'error', error: { code: 'SESSION_CLOSED' } } : ok('ready'), rules);
  assert.equal(classifyMeasurementR3(fatal.measurements.event).partition, 'U_A');
});
test('shared projections cannot promote capture gaps, timeout, instability or resource limit to W', async () => {
  const rules = { bad: absolute(eq('right')) };
  for (const collect of [({ sequence }) => sequence === 4 ? { state: 'unknown' } : ok('wrong'),
    ({ sequence }) => sequence > 3 ? new Promise(() => {}) : ok('wrong'),
    ({ sequence }) => ({ state: 'ok', actual: fact('wrong', { geometry: [sequence * 0.4] }) })]) {
    const output = await shared(collect, rules);
    assert.equal(classifyMeasurementR3(output.measurements.bad).partition, 'U_A');
  }
  const limited = await shared(() => ok('wrong'), rules, { policy: { ...short, maxSamples: 3 } });
  assert.equal(classifyMeasurementR3(limited.measurements.bad).partition, 'U_A');
});
test('shared rule-specific type error stays unknown with raw fact retained in acquisition', async () => {
  const output = await shared(() => ok('not-numeric'), { captured: capture, numeric: absolute({ cmp: 'between', min: 1, max: 2 }) });
  assert.equal(classifyMeasurementR3(output.measurements.captured).partition, 'S');
  assert.equal(classifyMeasurementR3(output.measurements.numeric).partition, 'U_A');
  assert.equal(output.measurements.numeric.samples[0].observedActual.value, 'not-numeric');
  assert.equal(output.measurements.numeric.projection.acquisition.samples[0].actual.value, 'not-numeric');
});
test('offline projection is timer-free, verifies provenance policies and rejects forged projected records', async () => {
  const output = await shared(() => ok('wrong'), { original: absolute(eq('right')) });
  const projected = projectMeasurementR3(output.acquisition, absolute(eq('wrong')), { policy: short });
  assert.equal(classifyMeasurementR3(projected).partition, 'S');
  assert.equal(output.clock.time, 300);
  assert.throws(() => projectMeasurementR3(output.acquisition, capture, { policy: { ...short, timeoutMs: 400 } }), /POLICY_MISMATCH/);
  assert.throws(() => projectMeasurementR3(projected, capture), /SHARED_CAPTURE_REQUIRED/);
  for (const mutate of [r => { r.projection.acquisitionPolicy.temporalMode = 'eventually-stable'; },
    r => { r.projection.acquisition.samples[0].actual.value = 'tampered'; }, r => { r.samples[0].completedMs = 1; },
    r => { r.projection.rulePolicy.timeoutMs++; }, r => { r.projection.schemaVersion = 'unknown'; }, r => { r.outcome = 'measurement-unknown'; }]) {
    const forged = structuredClone(projected); mutate(forged); assert.throws(() => classifyMeasurementR3(forged));
  }
});
test('shared hold projection retains original hold counterexample even after recovery', async () => {
  const output = await shared(({ sequence }) => ok(sequence === 4 ? 'wrong' : 'ready'), { hold: absolute(eq('ready')) }, { policy: { ...short, timeoutMs: 400, temporalMode: 'hold-through-deadline' } });
  assert.equal(classifyMeasurementR3(output.acquisition).partition, 'S');
  assert.equal(classifyMeasurementR3(output.measurements.hold).partition, 'W');
  assert.deepEqual(output.measurements.hold.evidence.holdViolations.map(v => v.sequence), [4]);
});
test('a strictly predeadline satisfying completion is valid even if final bookkeeping crosses cutoff', async () => {
  const clock = new FakeClock(); let reads = 0;
  clock.now = () => reads++;
  const result = await run(() => ok('ready'), { clock, policy: { ...short, timeoutMs: 6, pollIntervalMs: 0, stableSamples: 1 } });
  assert.equal(result.record.samples[0].completedMs, 5);
  assert.equal(result.record.termination.deadlineReached, true);
  assert.equal(result.record.termination.reason, 'satisfied');
  assert.equal(result.classification.partition, 'S');
});
test('unrepresentable directional errors remain unknown instead of serializing Infinity as null', async () => {
  assert.throws(() => predicateErrorVectorR3(Number.MAX_VALUE, eq(-Number.MAX_VALUE)), /ERROR_VECTOR_OVERFLOW/);
  const expect = { cmp: 'r3', rule: { kind: 'nonWorsening', expect: eq(-Number.MAX_VALUE), baseline: fact(Number.MAX_VALUE), tolerance: 0 } };
  const result = await run(() => ok(Number.MAX_VALUE), { expect });
  assert.equal(result.classification.partition, 'U_A');
  assert.equal(result.record.samples[0].error.code, 'R3_ERROR_VECTOR_OVERFLOW');
});
for (const code of ['VIEWPORT_CHANGED', 'VIEWPORT_TRANSITION_PENDING', 'R3_OBSERVATION_PROVENANCE_MISMATCH', 'BROWSER_CLEANUP_FAILED', 'RENDER_LIFECYCLE_BUSY']) {
  test(`shared lifecycle ${code} invalidates early stable witnesses, cleans up once, and excludes old late responses`, async () => {
    const clock = new FakeClock(); let lateResolve, calls = 0, cleanupCalls = 0, cleanupActive = 0, maximumCleanupActive = 0;
    const oldResponse = new Promise(resolve => { lateResolve = resolve; });
    const output = await shared(({ sequence }) => {
      calls++;
      if (sequence <= 3) return ok('ready', { identity: { render: 'original', viewport: 'before' } });
      // Trusted fake lifecycle invalidation wins against an old native query still in flight.
      const invalidation = clock.sleep(10).then(() => { throw Object.assign(new Error(`invalidated: ${code}`), { code }); });
      return Promise.race([oldResponse, invalidation]);
    }, { R: absolute(eq('ready')), G: absolute(eq('ready')), baseline: capture }, {
      clock,
      abort: async ({ reason, signal }) => {
        assert.equal(reason, 'fatal-collection-error'); assert.equal(signal.aborted, false);
        cleanupCalls++; cleanupActive++; maximumCleanupActive = Math.max(maximumCleanupActive, cleanupActive);
        await clock.sleep(5, signal); cleanupActive--;
      },
    });
    assert.equal(calls, 4); assert.equal(cleanupCalls, 1); assert.equal(maximumCleanupActive, 1); assert.equal(cleanupActive, 0);
    assert.equal(clock.time, 165); assert.equal(output.acquisition.termination.observationElapsedMs, 160);
    assert.equal(output.acquisition.termination.reason, 'fatal-collection-error');
    assert.ok(output.acquisition.evidence.firstStableSatisfying);
    assert.equal(output.acquisition.health.sessionUsable, false);
    assert.equal(output.acquisition.health.cleanup.status, 'completed');
    assert.equal(output.acquisition.health.cleanup.elapsedMs, 5);
    assert.equal(output.acquisition.samples.at(-1).error.code, code);
    assert.equal(output.acquisition.health.terminalError.code, code);
    assert.equal(classifyMeasurementR3(output.acquisition).partition, 'U_A');
    for (const measurement of Object.values(output.measurements)) {
      assert.ok(measurement.evidence.firstStableSatisfying);
      assert.equal(measurement.health.sessionUsable, false);
      assert.equal(measurement.samples.at(-1).error.code, code);
      assert.equal(classifyMeasurementR3(measurement).partition, 'U_A');
    }
    const before = JSON.stringify({ acquisition: output.acquisition, measurements: output.measurements });
    lateResolve(ok('ready', { identity: { render: 'stale-original', viewport: 'before' } }));
    for (let i = 0; i < 30; i++) await Promise.resolve();
    assert.equal(JSON.stringify({ acquisition: output.acquisition, measurements: output.measurements }), before);
    assert.equal(calls, 4); assert.equal(cleanupCalls, 1);
  });
}
test('nonfatal native-query and encoding errors remain unknown without invalidating shared session', async () => {
  for (const code of ['NATIVE_QUERY_ERROR', 'R3_ERROR_MAGNITUDE_ENCODING_MISMATCH']) {
    let cleanupCalls = 0;
    const output = await shared(({ sequence }) => {
      if (sequence === 4) throw Object.assign(new Error('nonfatal unavailable observation'), { code });
      return ok('ready');
    }, { event: absolute(eq('ready')) }, { abort: async () => { cleanupCalls++; } });
    assert.equal(output.acquisition.samples.length, 6);
    assert.equal(output.acquisition.samples[3].error.code, code);
    assert.equal(output.acquisition.health.sessionUsable, true);
    assert.equal(output.acquisition.health.terminalError, null);
    assert.equal(cleanupCalls, 0);
    assert.equal(classifyMeasurementR3(output.acquisition).partition, 'U_A');
    assert.equal(classifyMeasurementR3(output.measurements.event).partition, 'S');
  }
});