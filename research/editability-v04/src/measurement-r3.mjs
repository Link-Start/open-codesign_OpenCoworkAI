// Node-only r3 typed-fact measurement protocol; r2 timing state machine retained. Never send expectations or comparators to a page/model.
import { isDeepStrictEqual } from 'node:util';
import { performance } from 'node:perf_hooks';
import { projectMeasurementR3 } from './measurement-records-r3.mjs';

export const MEASUREMENT_SCHEMA_VERSION_R3 = 'v04-measurement-r3-1';
export const FACT_SCHEMA_VERSION_R3 = 'v04-observation-fact-r3-1';
export const DEFAULT_MEASUREMENT_POLICY_R3 = Object.freeze({
  timeoutMs: 5000, pollIntervalMs: 50, stableSamples: 3, geometryDeltaPx: 0.5,
  temporalMode: 'eventually-stable', cleanupTimeoutMs: 1000, maxSamples: 10000,
});
const FATAL = new Set(['SESSION_CLOSED', 'NO_RENDER', 'CONTAINMENT_CONTROL_FAILED',
  'SNAPSHOT_NODE_LIMIT', 'CDP_CLOSED', 'CDP_SOCKET_ERROR', 'PAGE_RUNTIME_ERROR',
    'VIEWPORT_CHANGED', 'VIEWPORT_TRANSITION_PENDING', 'R3_OBSERVATION_PROVENANCE_MISMATCH',
    'BROWSER_CLEANUP_FAILED', 'RENDER_LIFECYCLE_BUSY']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const copy = value => structuredClone(value);
const fail = (code, detail = '') => { throw Object.assign(new Error(code + (detail ? ': ' + detail : '')), { code }); };
const errorRecord = error => ({ code: error?.code ?? error?.name ?? 'COLLECTION_ERROR', message: String(error?.message ?? error) });
function fields(value, allowed, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  if (Object.keys(value).some(key => !allowed.includes(key))) fail(code, 'Unknown field');
}
export function validateMeasurementPolicyR3(input = {}) {
  fields(input, Object.keys(DEFAULT_MEASUREMENT_POLICY_R3), 'INVALID_MEASUREMENT_POLICY');
  const p = { ...DEFAULT_MEASUREMENT_POLICY_R3, ...input };
  for (const key of ['timeoutMs', 'stableSamples', 'cleanupTimeoutMs', 'maxSamples']) {
    if (!Number.isInteger(p[key]) || p[key] < 1) fail('INVALID_MEASUREMENT_POLICY', key);
  }
  if (!Number.isInteger(p.pollIntervalMs) || p.pollIntervalMs < 0 || !finite(p.geometryDeltaPx) || p.geometryDeltaPx < 0) fail('INVALID_MEASUREMENT_POLICY');
  if (p.timeoutMs > 60000 || p.pollIntervalMs > 1000 || p.stableSamples > 20 || p.cleanupTimeoutMs > 10000 || p.maxSamples > 100000) fail('MEASUREMENT_POLICY_TOO_LARGE');
  if (!['eventually-stable', 'hold-through-deadline'].includes(p.temporalMode)) fail('INVALID_TEMPORAL_MODE');
  return Object.freeze(p);
}
// Facts and rules are JSON-only Node data, never executable candidate predicates.
export function validateJsonR3(value) {
  const ancestors = new Set();
  function visit(v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || finite(v)) return;
    if (!v || typeof v !== 'object' || ancestors.has(v)) fail('R3_JSON_REQUIRED');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (!array && proto !== Object.prototype && proto !== null) fail('R3_JSON_REQUIRED');
    const keys = Reflect.ownKeys(v);
    if (keys.some(k => typeof k !== 'string')) fail('R3_JSON_REQUIRED');
    if (array && (Object.keys(v).length !== v.length || keys.some(k => k !== 'length' && !/^(0|[1-9][0-9]*)$/.test(k)))) fail('R3_JSON_REQUIRED');
    ancestors.add(v);
    for (const key of keys) {
      if (array && key === 'length') continue;
      const d = Object.getOwnPropertyDescriptor(v, key);
      if (!d.enumerable || !own(d, 'value')) fail('R3_JSON_REQUIRED');
      visit(d.value);
    }
    ancestors.delete(v);
  }
  visit(value); return value;
}
export function validateFactR3(fact) {
  validateJsonR3(fact);
  fields(fact, ['schemaVersion', 'value', 'geometry', 'errors', 'stability'], 'INVALID_R3_FACT');
  if (fact.schemaVersion !== FACT_SCHEMA_VERSION_R3) fail('R3_FACT_SCHEMA_REQUIRED');
  if (!own(fact, 'value') || !own(fact, 'geometry') || !Array.isArray(fact.errors)) fail('INVALID_R3_FACT');
  if (fact.geometry !== null && (!Array.isArray(fact.geometry) || !fact.geometry.every(finite))) fail('INVALID_R3_GEOMETRY');
  for (const error of fact.errors) {
    fields(error, ['category', 'location', 'code', 'magnitude'], 'INVALID_R3_SEMANTIC_ERROR');
    if (['category', 'location', 'code'].some(k => typeof error[k] !== 'string')) fail('INVALID_R3_SEMANTIC_ERROR');
    if (own(error, 'magnitude') && (!finite(error.magnitude) || error.magnitude < 0)) fail('INVALID_R3_ERROR_MAGNITUDE');
  }
  return fact;
}
function validateAbsolute(expect) {
  const keys = { eq: ['cmp', 'value'], includes: ['cmp', 'value'], notIncludes: ['cmp', 'value'], between: ['cmp', 'min', 'max'] }[expect?.cmp];
  if (!Array.isArray(keys)) fail('INVALID_R3_ABSOLUTE_EXPECTATION');
  fields(expect, keys, 'INVALID_R3_ABSOLUTE_EXPECTATION');
  if (['eq', 'includes', 'notIncludes'].includes(expect.cmp) && !own(expect, 'value')) fail('EXPECTED_VALUE_REQUIRED');
  if (['includes', 'notIncludes'].includes(expect.cmp) && typeof expect.value !== 'string') fail('EXPECTED_STRING_REQUIRED');
  if (expect.cmp === 'between' && (!finite(expect.min) || !finite(expect.max) || expect.min > expect.max)) fail('INVALID_EXPECTED_RANGE');
}
export function validateMeasurementExpectationR3(expect) {
  validateJsonR3(expect);
  fields(expect, ['cmp', 'rule'], 'INVALID_R3_EXPECTATION');
  if (expect.cmp !== 'r3') fail('INVALID_R3_EXPECTATION');
  const rule = expect.rule;
  const keys = { capture: ['kind'], absolute: ['kind', 'expect'], preserve: ['kind', 'baseline', 'tolerance'], nonWorsening: ['kind', 'expect', 'baseline', 'tolerance'] }[rule?.kind];
  if (!Array.isArray(keys)) fail('INVALID_R3_RULE');
  fields(rule, keys, 'INVALID_R3_RULE');
  if (keys.some(k => !own(rule, k))) fail('INVALID_R3_RULE');
  if (own(rule, 'expect')) validateAbsolute(rule.expect);
  if (own(rule, 'baseline')) {
    validateFactR3(rule.baseline);
    if (!finite(rule.tolerance) || rule.tolerance < 0) fail('INVALID_BASELINE_TOLERANCE');
  }
  return expect;
}
function predicate(actual, expect) {
  if (expect.cmp === 'eq') return isDeepStrictEqual(actual, expect.value);
  if (['includes', 'notIncludes'].includes(expect.cmp)) {
    if (typeof actual !== 'string') fail('OBSERVATION_TYPE_MISMATCH');
    return expect.cmp === 'includes' ? actual.includes(expect.value) : !actual.includes(expect.value);
  }
  if (!finite(actual)) fail('OBSERVATION_TYPE_MISMATCH');
  return actual >= expect.min && actual <= expect.max;
}
const numericTree = value => finite(value) || (Array.isArray(value) && value.every(numericTree));
const sameNumericShape = (a, b) => finite(a) && finite(b) || Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameNumericShape(v, b[i]));
const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : [value];
// Direction is retained: improvement on one side never offsets worsening on another.
// Return shape: {kind:'numeric'|'discrete'|'shape-mismatch', passed, vector? ,actual?}.
export function predicateErrorVectorR3(actual, expect) {
  validateJsonR3(actual); validateJsonR3(expect); validateAbsolute(expect);
  const passed = predicate(actual, expect);
  const numeric = vector => {
    if (!vector.every(finite)) fail('R3_ERROR_VECTOR_OVERFLOW');
    return { kind: 'numeric', passed, vector };
  };
  if (expect.cmp === 'between') return numeric([Math.max(0, expect.min - actual), Math.max(0, actual - expect.max)]);
  if (expect.cmp === 'eq' && numericTree(expect.value)) {
    if (sameNumericShape(actual, expect.value)) {
      const expected = flatten(expect.value);
      return numeric(flatten(actual).flatMap((v, i) => [Math.max(0, expected[i] - v), Math.max(0, v - expected[i])]));
    }
    return { kind: 'shape-mismatch', passed, actual: copy(actual) };
  }
  return { kind: 'discrete', passed, actual: copy(actual) };
}
function errorGroups(errors) {
  const groups = new Map();
  for (const error of errors) {
    const key = JSON.stringify([error.category, error.location, error.code]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(error);
  }
  return groups;
}
function errorsNonWorsening(actual, baseline, tolerance) {
  const a = errorGroups(actual), b = errorGroups(baseline);
  for (const [key, errors] of a) {
    const original = b.get(key);
    if (!original || errors.length > original.length) return false;
    const magnitudes = errors.filter(e => own(e, 'magnitude')).map(e => e.magnitude).sort((x, y) => x - y);
    const before = original.filter(e => own(e, 'magnitude')).map(e => e.magnitude).sort((x, y) => x - y);
    // Absent on both sides means discrete, NOT magnitude zero. A type change is unknown.
    if (magnitudes.length > before.length || errors.length - magnitudes.length > original.length - before.length) fail('R3_ERROR_MAGNITUDE_ENCODING_MISMATCH');
    const available = before.slice(before.length - magnitudes.length);
    if (magnitudes.some((v, i) => v - available[i] > tolerance)) return false;
  }
  return true;
}
export function nonWorseningFactR3(actual, expect, baseline, tolerance = 0) {
  validateMeasurementExpectationR3({ cmp: 'r3', rule: { kind: 'nonWorsening', expect, baseline, tolerance } });
  validateFactR3(actual);
  const before = predicateErrorVectorR3(baseline.value, expect), after = predicateErrorVectorR3(actual.value, expect);
  // A passing original predicate cannot become wrong, however generous the error tolerance.
  const valueOkay = before.passed ? after.passed : after.passed || (before.kind === 'numeric' && after.kind === 'numeric'
    ? before.vector.length === after.vector.length && after.vector.every((v, i) => v - before.vector[i] <= tolerance)
    : before.kind === after.kind && isDeepStrictEqual(actual.value, baseline.value));
  const errorsOkay = errorsNonWorsening(actual.errors, baseline.errors, tolerance);
  return valueOkay && errorsOkay;
}
export function compareFactR3(actual, expect) {
  validateMeasurementExpectationR3(expect); validateFactR3(actual);
  const rule = expect.rule;
  if (rule.kind === 'capture') return true;
  if (rule.kind === 'absolute') return predicate(actual.value, rule.expect) && actual.errors.length === 0;
  if (rule.kind === 'nonWorsening') return nonWorseningFactR3(actual, rule.expect, rule.baseline, rule.tolerance);
  const valueOkay = sameNumericShape(actual.value, rule.baseline.value)
    ? flatten(actual.value).every((v, i) => Math.abs(v - flatten(rule.baseline.value)[i]) <= rule.tolerance)
    : isDeepStrictEqual(actual.value, rule.baseline.value);
  const errorsOkay = errorsNonWorsening(actual.errors, rule.baseline.errors, rule.tolerance);
  return valueOkay && errorsOkay;
}
function stableValues(values, { geometry = false, delta = 0.5 } = {}) {
  if (geometry && values.every(finite)) return Math.max(...values) - Math.min(...values) <= delta;
  if (geometry && values.every(Array.isArray) && values.every(v => v.length === values[0].length)) {
    return values[0].every((_, i) => stableValues(values.map(v => v[i]), { geometry, delta }));
  }
  return values.every(value => isDeepStrictEqual(value, values[0]));
}
function sortedErrors(errors) {
  return [...errors].sort((a, b) => {
    const ka = JSON.stringify([a.category, a.location, a.code, own(a, 'magnitude')]);
    const kb = JSON.stringify([b.category, b.location, b.code, own(b, 'magnitude')]);
    return ka < kb ? -1 : ka > kb ? 1 : own(a, 'magnitude') ? a.magnitude - b.magnitude : 0;
  });
}
// Whole-window value AND full geometry vector AND error identities/metadata stabilize.
export function stableWindowR3(facts, { geometry = false, delta = 0.5 } = {}) {
  if (!Array.isArray(facts) || !facts.length) return false;
  if (typeof geometry !== 'boolean' || !finite(delta) || delta < 0) fail('INVALID_R3_STABILITY_OPTIONS');
  facts.forEach(validateFactR3);
  if (!stableValues(facts.map(f => f.value), { geometry, delta })
      || !stableValues(facts.map(f => f.geometry), { geometry: true, delta })
      || !facts.every(f => own(f, 'stability') === own(facts[0], 'stability') && isDeepStrictEqual(f.stability, facts[0].stability))) return false;
  const errors = facts.map(f => sortedErrors(f.errors));
  if (!errors.every(e => e.length === errors[0].length)) return false;
  return errors[0].every((error, i) => {
    const signature = ({ category, location, code }) => [category, location, code];
    if (!errors.every(e => isDeepStrictEqual(signature(e[i]), signature(error)) && own(e[i], 'magnitude') === own(error, 'magnitude'))) return false;
    return !own(error, 'magnitude') || stableValues(errors.map(e => e[i].magnitude), { geometry: true, delta });
  });
}
function abortError() { return Object.assign(new Error('Operation aborted'), { code: 'ABORTED' }); }
export const realMeasurementClockR3 = Object.freeze({
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
    validateFactR3(value.actual);
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
export async function measureUntilDeadlineR3({ collect, expect, policy: inputPolicy = {}, geometry = false,
  clock = realMeasurementClockR3, abort, signal } = {}) {
  if (typeof collect !== 'function' || typeof clock?.now !== 'function' || typeof clock?.sleep !== 'function') fail('INVALID_MEASUREMENT_DEPENDENCY');
  if (abort !== undefined && typeof abort !== 'function') fail('INVALID_CLEANUP');
  if (typeof geometry !== 'boolean') fail('INVALID_R3_GEOMETRY_MODE');
  validateMeasurementExpectationR3(expect);
  expect = copy(expect); // Freeze the private rule logically before observation starts.
  const policy = validateMeasurementPolicyR3(inputPolicy);
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
    if (window.length !== policy.stableSamples || !stableWindowR3(window.map(s => s.actual), { geometry, delta: policy.geometryDeltaPx })) return;
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
        if (sample.state === 'ok') sample.predicate = compareFactR3(sample.actual, expect);
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
    schemaVersion: MEASUREMENT_SCHEMA_VERSION_R3, policy: { ...policy }, geometry, expectation: copy(expect), baselineEvidence: expect.rule.baseline ? copy(expect.rule.baseline) : null, outcome,
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

/** One shared full-deadline acquisition, then pure Node projections. No per-rule collect. */
export async function measureRulesUntilDeadlineR3({ rules, policy: inputPolicy = {}, ...options } = {}) {
  validateJsonR3(rules);
  if (!rules || typeof rules !== 'object' || Array.isArray(rules) || !Object.keys(rules).length || Object.keys(rules).some(k => !k)) fail('INVALID_R3_RULE_MAP');
  for (const rule of Object.values(rules)) validateMeasurementExpectationR3(rule);
  const frozenRules = copy(rules), rulePolicy = validateMeasurementPolicyR3(inputPolicy);
  const acquisitionPolicy = { ...rulePolicy, temporalMode: 'hold-through-deadline' };
  const acquisition = await measureUntilDeadlineR3({ ...options, policy: acquisitionPolicy, expect: { cmp: 'r3', rule: { kind: 'capture' } } });
  const measurements = Object.fromEntries(Object.entries(frozenRules).map(([id, expectation]) => [id, projectMeasurementR3(acquisition, expectation, { policy: rulePolicy })]));
  return { acquisition, measurements };
}