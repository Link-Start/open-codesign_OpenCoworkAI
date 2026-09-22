// Node-only measurement protocol. Never send expectations or comparators to a page/model.
import { isDeepStrictEqual } from 'node:util';
import { performance } from 'node:perf_hooks';

export const MEASUREMENT_SCHEMA_VERSION = 'v04-measurement-r2-1';
export const BASELINE_SCHEMA_VERSION = 'v04-measurement-baseline-r2-1';
export const DEFAULT_MEASUREMENT_POLICY = Object.freeze({
  timeoutMs: 5000, pollIntervalMs: 50, stableSamples: 3, geometryDeltaPx: 0.5,
  temporalMode: 'eventually-stable', cleanupTimeoutMs: 1000, maxSamples: 10000,
});
const FATAL = new Set(['SESSION_CLOSED', 'NO_RENDER', 'CONTAINMENT_CONTROL_FAILED',
  'SNAPSHOT_NODE_LIMIT', 'CDP_CLOSED', 'CDP_SOCKET_ERROR', 'PAGE_RUNTIME_ERROR']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const copy = value => structuredClone(value);
const fail = (code, detail = '') => { throw Object.assign(new Error(code + (detail ? ': ' + detail : '')), { code }); };
const errorRecord = error => ({ code: error?.code ?? error?.name ?? 'COLLECTION_ERROR', message: String(error?.message ?? error) });
function fields(value, allowed, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  if (Object.keys(value).some(key => !allowed.includes(key))) fail(code, 'Unknown field');
}
export function validateMeasurementPolicy(input = {}) {
  fields(input, Object.keys(DEFAULT_MEASUREMENT_POLICY), 'INVALID_MEASUREMENT_POLICY');
  const p = { ...DEFAULT_MEASUREMENT_POLICY, ...input };
  for (const key of ['timeoutMs', 'stableSamples', 'cleanupTimeoutMs', 'maxSamples']) {
    if (!Number.isInteger(p[key]) || p[key] < 1) fail('INVALID_MEASUREMENT_POLICY', key);
  }
  if (!Number.isInteger(p.pollIntervalMs) || p.pollIntervalMs < 0 || !finite(p.geometryDeltaPx) || p.geometryDeltaPx < 0) fail('INVALID_MEASUREMENT_POLICY');
  if (p.timeoutMs > 60000 || p.pollIntervalMs > 1000 || p.stableSamples > 20 || p.cleanupTimeoutMs > 10000 || p.maxSamples > 100000) fail('MEASUREMENT_POLICY_TOO_LARGE');
  if (!['eventually-stable', 'hold-through-deadline'].includes(p.temporalMode)) fail('INVALID_TEMPORAL_MODE');
  return Object.freeze(p);
}
export function validateMeasurementExpectation(expect, baseline) {
  const keys = { eq: ['cmp', 'value'], includes: ['cmp', 'value'], notIncludes: ['cmp', 'value'], between: ['cmp', 'min', 'max'], sameAsBaseline: ['cmp', 'tolerance'] }[expect?.cmp];
  if (!keys) fail('INVALID_MEASUREMENT_EXPECTATION');
  fields(expect, keys, 'INVALID_MEASUREMENT_EXPECTATION');
  if (['eq', 'includes', 'notIncludes'].includes(expect.cmp) && !own(expect, 'value')) fail('EXPECTED_VALUE_REQUIRED');
  if (['includes', 'notIncludes'].includes(expect.cmp) && typeof expect.value !== 'string') fail('EXPECTED_STRING_REQUIRED');
  if (expect.cmp === 'between' && (!finite(expect.min) || !finite(expect.max) || expect.min > expect.max)) fail('INVALID_EXPECTED_RANGE');
  if (expect.cmp === 'sameAsBaseline') {
    if (!finite(expect.tolerance) || expect.tolerance < 0) fail('INVALID_BASELINE_TOLERANCE');
    if (baseline?.schemaVersion !== BASELINE_SCHEMA_VERSION || !own(baseline, 'actual') || baseline.actual === undefined || baseline.error) fail('R2_BASELINE_REQUIRED');
  }
}
export function compareMeasurementActual(actual, expect, baseline) {
  validateMeasurementExpectation(expect, baseline);
  if (expect.cmp === 'eq') return isDeepStrictEqual(actual, expect.value);
  if (['includes', 'notIncludes'].includes(expect.cmp)) {
    if (typeof actual !== 'string') fail('OBSERVATION_TYPE_MISMATCH');
    return expect.cmp === 'includes' ? actual.includes(expect.value) : !actual.includes(expect.value);
  }
  if (expect.cmp === 'between') {
    if (!finite(actual)) fail('OBSERVATION_TYPE_MISMATCH');
    return actual >= expect.min && actual <= expect.max;
  }
  return finite(actual) && finite(baseline.actual)
    ? Math.abs(actual - baseline.actual) <= expect.tolerance
    : isDeepStrictEqual(actual, baseline.actual);
}
// Whole-window range, NOT a chain of adjacent deltas. Predicate agreement is separate.
export function stableWindow(values, { geometry = false, delta = 0.5 } = {}) {
  if (!values.length) return false;
  if (geometry && values.every(finite)) return Math.max(...values) - Math.min(...values) <= delta;
  if (geometry && values.every(Array.isArray) && values.every(v => v.length === values[0].length)) {
    return values[0].every((_, i) => stableWindow(values.map(v => v[i]), { geometry, delta }));
  }
  return values.every(value => isDeepStrictEqual(value, values[0]));
}
function abortError() { return Object.assign(new Error('Operation aborted'), { code: 'ABORTED' }); }
export const realMeasurementClock = Object.freeze({
  now: () => performance.now(),
  sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(abortError()); return; }
      let timer;
      const onAbort = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(abortError()); };
      timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, Math.max(0, ms));
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  },
});
function observation(value) {
  fields(value, ['state', 'actual', 'identity', 'evidence', 'error'], 'INVALID_COLLECTION_RESULT');
  if (!['ok', 'unknown', 'error'].includes(value.state)) fail('INVALID_COLLECTION_STATE');
  if (value.state === 'ok') {
    if (!own(value, 'actual') || value.actual === undefined) fail('OBSERVATION_VALUE_MISSING');
    // Explicit absence never becomes the empty string. Null remains valid for attribute observations.
    if (value.evidence?.valueState && value.evidence.valueState.status !== 'available') fail('VALUE_UNAVAILABLE');
    if (own(value, 'error')) fail('INVALID_COLLECTION_RESULT', 'Successful sample contains error');
  } else if (own(value, 'actual')) fail('INVALID_COLLECTION_RESULT', 'Unknown/error sample contains an actual');
  return copy(value);
}
/**
 * collect({signal, remainingMs, sequence}) returns {state:'ok',actual,identity?,evidence?}
 * or {state:'unknown'|'error',error?,evidence?}. It NEVER receives expect/baseline.
 * Times are relative to a monotonic observation start. Eligibility is [start, deadline):
 * completion exactly at the deadline is excluded, making timer ordering immaterial.
 * An external signal interrupts; abort() is separate bounded session cleanup, not a measurement.
 */
export async function measureUntilDeadline({ collect, expect, baseline, policy: inputPolicy = {}, geometry = false,
  clock = realMeasurementClock, abort, signal } = {}) {
  if (typeof collect !== 'function' || typeof clock?.now !== 'function' || typeof clock?.sleep !== 'function') fail('INVALID_MEASUREMENT_DEPENDENCY');
  if (abort !== undefined && typeof abort !== 'function') fail('INVALID_CLEANUP');
  validateMeasurementExpectation(expect, baseline);
  const policy = validateMeasurementPolicy(inputPolicy);
  let previousClock = -Infinity;
  const now = () => { const value = clock.now(); if (!finite(value) || value < previousClock) fail('NON_MONOTONIC_CLOCK'); previousClock = value; return value; };
  const started = now(), deadline = started + policy.timeoutMs;
  const samples = [], stableWindows = [], coverageGaps = [], holdViolations = [];
  let lastValid = null, lastStable = null, lastStableSatisfying = null, lastStableViolating = null;
  let firstStableSatisfying = null, terminalError = null, reason = null, sessionUsable = true;
  let window = [], holdUncertain = false, cleanupNeeded = false, stoppingAt = started;
  const elapsed = value => value - started;
  function recordGap(sample) {
    coverageGaps.push({ sequence: sample.sequence, startedMs: sample.requestStartedMs, endedMs: sample.completedMs, state: sample.state, error: sample.error ?? null });
    if (firstStableSatisfying) holdUncertain = true;
  }
  function processSample(sample) {
    samples.push(sample);
    if (sample.state !== 'ok' || !sample.eligibleBeforeDeadline) { window = []; recordGap(sample); return; }
    lastValid = sample;
    if (firstStableSatisfying && sample.predicate === false) holdViolations.push({ sequence: sample.sequence, actual: copy(sample.actual), elapsedMs: sample.completedMs, afterWindowId: firstStableSatisfying.id });
    if (window.length && (!isDeepStrictEqual(window.at(-1).identity, sample.identity) || window.at(-1).predicate !== sample.predicate)) window = [];
    window.push(sample);
    if (window.length > policy.stableSamples) window.shift();
    if (window.length !== policy.stableSamples || !stableWindow(window.map(s => s.actual), { geometry, delta: policy.geometryDeltaPx })) return;
    const stable = { id: `window-${stableWindows.length + 1}`, sampleSequences: window.map(s => s.sequence),
      startMs: window[0].completedMs, endMs: sample.completedMs, predicate: sample.predicate,
      actual: copy(sample.actual), identity: copy(sample.identity ?? null), spanMs: sample.completedMs - window[0].completedMs };
    stableWindows.push(stable); lastStable = stable;
    if (sample.predicate) { lastStableSatisfying = stable; firstStableSatisfying ??= stable; }
    else lastStableViolating = stable;
  }
  while (!reason) {
    if (signal?.aborted) { reason = 'external-abort'; terminalError = errorRecord(abortError()); cleanupNeeded = true; sessionUsable = false; break; }
    if (now() >= deadline) { reason = 'observation-deadline'; break; }
    if (samples.length >= policy.maxSamples) { reason = 'resource-limit'; terminalError = { code: 'MEASUREMENT_SAMPLE_LIMIT', message: 'Explicit sample limit reached; no history was truncated' }; break; }
    const sequence = samples.length + 1, requestStarted = now();
    const operationController = new AbortController(), timerController = new AbortController();
    let externalAbort;
    const external = new Promise(resolve => { externalAbort = () => resolve({ kind: 'external-abort', completedAt: now() }); signal?.addEventListener('abort', externalAbort, { once: true }); });
    const operation = Promise.resolve().then(() => collect({ signal: operationController.signal, remainingMs: Math.max(0, deadline - now()), sequence }))
      .then(value => ({ kind: 'response', value, completedAt: now() }), error => ({ kind: 'failure', error, completedAt: now() }));
    // Late operation fulfillment/rejection is handled but never mutates the returned evidence.
    const timer = Promise.resolve().then(() => clock.sleep(Math.max(0, deadline - now()), timerController.signal))
      .then(() => ({ kind: 'deadline', completedAt: now() }), error => ({ kind: 'timer-cancelled', error }));
    const result = await Promise.race([operation, timer, external]);
    timerController.abort(); signal?.removeEventListener('abort', externalAbort);
    const completed = result.completedAt ?? now();
    const sample = { sequence, requestStartedMs: elapsed(requestStarted), completedMs: elapsed(completed),
      eligibleBeforeDeadline: completed < deadline, state: 'error' };
    if (result.kind === 'external-abort') {
      operationController.abort(); sample.error = errorRecord(abortError()); sample.eligibleBeforeDeadline = false;
      reason = 'external-abort'; terminalError = sample.error; cleanupNeeded = true; sessionUsable = false;
    } else if (result.kind === 'deadline' || completed >= deadline) {
      operationController.abort(); sample.eligibleBeforeDeadline = false;
      if (result.kind === 'response') {
        sample.state = 'late';
        try { sample.lateObservation = observation(result.value); } catch (error) { sample.error = errorRecord(error); }
        reason = 'late-response';
        terminalError = { code: 'OBSERVATION_COMPLETED_AFTER_CUTOFF', message: 'Completion at/after deadline excluded from all predicates and windows' };
      } else {
        sample.error = result.kind === 'failure' ? errorRecord(result.error) : { code: 'OBSERVATION_TIMEOUT', message: 'Pending collection exhausted observation budget' };
        reason = 'collection-timeout'; terminalError = sample.error; cleanupNeeded = true; sessionUsable = false;
      }
    } else {
      try {
        if (result.kind !== 'response') throw result.error ?? new Error('Collection failed');
        Object.assign(sample, observation(result.value));
        if (sample.state === 'ok') sample.predicate = compareMeasurementActual(sample.actual, expect, baseline);
        else sample.error = errorRecord(sample.error ?? { code: 'OBSERVATION_UNAVAILABLE', message: 'Collector did not obtain a value' });
      } catch (error) {
        if (own(sample, 'actual')) sample.observedActual = copy(sample.actual);
        delete sample.actual; delete sample.predicate; sample.state = 'error'; sample.error = errorRecord(error);
      }
      if (sample.error && FATAL.has(sample.error.code)) {
        reason = 'fatal-collection-error'; terminalError = sample.error; sessionUsable = false; cleanupNeeded = true;
      }
    }
    processSample(sample);
    if (!reason && policy.temporalMode === 'eventually-stable' && lastStableSatisfying) reason = 'satisfied';
    if (!reason) {
      const remaining = deadline - now();
      if (remaining <= 0) reason = 'observation-deadline';
      else {
        try { await clock.sleep(Math.min(policy.pollIntervalMs, remaining), signal); }
        catch (error) { reason = 'external-abort'; terminalError = errorRecord(error); sessionUsable = false; cleanupNeeded = true; }
      }
    }
  }
  stoppingAt = now();
  const deadlineReached = stoppingAt >= deadline;
  const terminalSample = samples.at(-1) ?? null;
  const terminalStableWindow = terminalSample?.state === 'ok' && terminalSample.eligibleBeforeDeadline
    && lastStable?.sampleSequences.at(-1) === terminalSample.sequence ? lastStable : null;
  const deadlineTailMs = deadlineReached ? (lastValid ? Math.max(0, policy.timeoutMs - lastValid.completedMs) : policy.timeoutMs) : null;
  const deadlineTailWithinPoll = deadlineReached && !!lastValid && deadlineTailMs <= policy.pollIntervalMs;
  let outcome;
  if (reason === 'satisfied') outcome = 'observed-satisfied';
  else if (!deadlineReached) outcome = reason === 'resource-limit' ? 'measurement-unknown' : 'interrupted';
  else if (policy.temporalMode === 'hold-through-deadline' && firstStableSatisfying && !holdViolations.length && !holdUncertain && !terminalError && deadlineTailWithinPoll) outcome = 'observed-satisfied';
  else if (policy.temporalMode === 'hold-through-deadline' && firstStableSatisfying && (holdUncertain || !deadlineTailWithinPoll)) outcome = 'measurement-unknown';
  else if (lastStableViolating || holdViolations.length) outcome = 'not-observed-by-deadline';
  else outcome = 'measurement-unknown';
  let cleanup = { attempted: false, status: 'not-needed', elapsedMs: 0, error: null };
  if (cleanupNeeded) {
    cleanup = { attempted: typeof abort === 'function', status: abort ? 'pending' : 'unavailable', elapsedMs: 0, error: null };
    if (abort) {
      const cleanupStarted = now(), controller = new AbortController(), budget = new AbortController();
      const result = await Promise.race([
        Promise.resolve().then(() => abort({ reason, signal: controller.signal })).then(() => ({ status: 'completed' }), error => ({ status: 'failed', error: errorRecord(error) })),
        Promise.resolve().then(() => clock.sleep(policy.cleanupTimeoutMs, budget.signal)).then(() => ({ status: 'timeout', error: { code: 'CLEANUP_TIMEOUT', message: 'Separate cleanup budget exhausted' } }), () => ({ status: 'cancelled-timer' })),
      ]);
      budget.abort(); controller.abort(); cleanup = { attempted: true, ...result, elapsedMs: now() - cleanupStarted, error: result.error ?? null };
    }
  }
  const validSamples = samples.filter(s => s.state === 'ok' && s.eligibleBeforeDeadline);
  const gaps = validSamples.slice(1).map((s, i) => s.completedMs - validSamples[i].completedMs);
  return {
    schemaVersion: MEASUREMENT_SCHEMA_VERSION, policy: { ...policy }, geometry, expectation: copy(expect), baselineEvidence: baseline ? copy(baseline) : null, outcome,
    termination: { reason, deadlineReached, observationElapsedMs: elapsed(stoppingAt), deadlineMs: policy.timeoutMs, boundary: 'completion-strictly-before-deadline' },
    samples, evidence: { lastValid, lastStable, lastStableSatisfying, firstStableSatisfying, lastStableViolating, terminalStableWindow, stableWindows, holdViolations, holdUncertain },
    coverage: { attemptedSamples: samples.length, validSamples: validSamples.length, unknownSamples: samples.filter(s => s.state === 'unknown').length,
      errorSamples: samples.filter(s => s.state === 'error').length, lateSamples: samples.filter(s => s.state === 'late').length,
      gaps: coverageGaps, lastValidAtMs: lastValid?.completedMs ?? null,
      terminalGapMs: lastValid ? Math.max(0, elapsed(stoppingAt) - lastValid.completedMs) : elapsed(stoppingAt),
      deadlineTailMs,
      deadlineTailWithinPoll,
      maximumValidSampleGapMs: gaps.length ? Math.max(...gaps) : null,
      continuousTimeCoverageClaimed: false, completeAttemptHistory: true },
    health: { sessionUsable, terminalError, cleanup },
  };
}
