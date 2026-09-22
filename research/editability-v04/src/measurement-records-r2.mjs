// Independent r2 record protocol; deliberately incompatible with v03 classifySuite.
import { isDeepStrictEqual } from 'node:util';
import { MEASUREMENT_SCHEMA_VERSION, validateMeasurementPolicy, validateMeasurementExpectation, compareMeasurementActual, stableWindow } from './measurement-r2.mjs';
export const SUITE_SCHEMA_VERSION = 'v04-measurement-suite-r2-1';
export const CLASSIFICATION_SCHEMA_VERSION = 'v04-measurement-classification-r2-1';
export const CLASSIFICATION_POLICY_ID = 'v04-r2-conservative-partition-1';
export const CLASSIFICATION_POLICY_STATUS = 'design-approved-pending-browser-calibration';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const copy = value => structuredClone(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
/** Validate evidence references before assigning a partition; r1 flags never suffice. */
export function validateMeasurementR2(record) {
  if (record?.schemaVersion !== MEASUREMENT_SCHEMA_VERSION) fail('R2_MEASUREMENT_SCHEMA_REQUIRED');
  validateMeasurementExpectation(record.expectation, record.baselineEvidence);
  const validatedPolicy = validateMeasurementPolicy(record.policy);
  if (!isDeepStrictEqual(record.policy, validatedPolicy) || typeof record.geometry !== 'boolean') fail('INVALID_R2_POLICY_RECORD');
  if (!['observed-satisfied', 'not-observed-by-deadline', 'measurement-unknown', 'interrupted'].includes(record.outcome)
      || !Array.isArray(record.samples) || !record.evidence || !record.coverage || !record.health || !record.termination) fail('INVALID_R2_MEASUREMENT_RECORD');
  if (record.coverage.continuousTimeCoverageClaimed !== false || record.coverage.completeAttemptHistory !== true
      || record.termination.boundary !== 'completion-strictly-before-deadline'
      || record.termination.deadlineMs !== record.policy.timeoutMs
      || !finite(record.termination.observationElapsedMs) || record.termination.observationElapsedMs < 0
      || record.termination.deadlineReached !== (record.termination.observationElapsedMs >= record.policy.timeoutMs)) fail('INVALID_R2_COVERAGE');
  let previousTime = 0;
  for (const [index, sample] of record.samples.entries()) {
    if (sample.sequence !== index + 1 || !finite(sample.requestStartedMs) || !finite(sample.completedMs)
        || sample.requestStartedMs < previousTime || sample.completedMs < sample.requestStartedMs
        || sample.requestStartedMs >= record.policy.timeoutMs
        || sample.completedMs > record.termination.observationElapsedMs
        || !['ok', 'unknown', 'error', 'late'].includes(sample.state)) fail('INVALID_R2_SAMPLE');
    if (sample.eligibleBeforeDeadline && sample.completedMs >= record.policy.timeoutMs) fail('R2_LATE_SAMPLE_USED');
    if (sample.state === 'ok' && (!sample.eligibleBeforeDeadline || !own(sample, 'actual') || sample.actual === undefined || typeof sample.predicate !== 'boolean')) fail('INVALID_R2_VALID_SAMPLE');
    if (sample.state !== 'ok' && own(sample, 'actual')) fail('R2_UNKNOWN_HAS_ACTUAL');
    if (sample.state === 'ok' && sample.predicate !== compareMeasurementActual(sample.actual, record.expectation, record.baselineEvidence)) fail('R2_PREDICATE_MISMATCH');
    previousTime = sample.completedMs;
  }
  const e = record.evidence;
  if (!Array.isArray(e.stableWindows) || !Array.isArray(e.holdViolations) || typeof e.holdUncertain !== 'boolean') fail('INVALID_R2_EVIDENCE');
  const windowIds = new Set();
  for (const window of e.stableWindows) {
    if (typeof window.id !== 'string' || windowIds.has(window.id) || !Array.isArray(window.sampleSequences)
        || window.sampleSequences.length !== record.policy.stableSamples) fail('INVALID_R2_STABLE_WINDOW');
    windowIds.add(window.id);
    const samples = window.sampleSequences.map(sequence => record.samples[sequence - 1]);
    if (samples.some((sample, i) => !sample || sample.sequence !== window.sampleSequences[i] || sample.state !== 'ok' || !sample.eligibleBeforeDeadline
        || sample.predicate !== window.predicate || (i && sample.sequence !== samples[i - 1].sequence + 1)
        || !isDeepStrictEqual(sample.identity, samples[0].identity))
        || !stableWindow(samples.map(s => s.actual), { geometry: record.geometry, delta: record.policy.geometryDeltaPx })
        || !isDeepStrictEqual(window.actual, samples.at(-1).actual)
        || window.startMs !== samples[0].completedMs || window.endMs !== samples.at(-1).completedMs) fail('INVALID_R2_STABLE_WINDOW');
  }
  for (const key of ['lastStable', 'lastStableSatisfying', 'firstStableSatisfying', 'lastStableViolating', 'terminalStableWindow']) {
    if (e[key] !== null && !e.stableWindows.some(window => isDeepStrictEqual(window, e[key]))) fail('R2_DANGLING_WINDOW_REFERENCE');
  }
  const satisfying = e.stableWindows.filter(window => window.predicate === true), violating = e.stableWindows.filter(window => window.predicate === false);
  if (!isDeepStrictEqual(e.lastStable, e.stableWindows.at(-1) ?? null)
      || !isDeepStrictEqual(e.lastStableSatisfying, satisfying.at(-1) ?? null)
      || !isDeepStrictEqual(e.firstStableSatisfying, satisfying[0] ?? null)
      || !isDeepStrictEqual(e.lastStableViolating, violating.at(-1) ?? null)) fail('R2_WINDOW_HISTORY_MISMATCH');
  const lastValid = record.samples.filter(sample => sample.state === 'ok' && sample.eligibleBeforeDeadline).at(-1) ?? null;
  if (!isDeepStrictEqual(e.lastValid, lastValid)) fail('R2_LAST_VALID_MISMATCH');
  const terminal = record.samples.at(-1), terminalWindow = terminal?.state === 'ok' && e.lastStable?.sampleSequences.at(-1) === terminal.sequence ? e.lastStable : null;
  if (!isDeepStrictEqual(e.terminalStableWindow, terminalWindow)) fail('R2_TERMINAL_WINDOW_MISMATCH');
  const expectedGaps = record.samples.filter(sample => sample.state !== 'ok' || !sample.eligibleBeforeDeadline);
  if (!Array.isArray(record.coverage.gaps) || record.coverage.gaps.length !== expectedGaps.length
      || record.coverage.attemptedSamples !== record.samples.length
      || record.coverage.validSamples !== record.samples.filter(s => s.state === 'ok' && s.eligibleBeforeDeadline).length) fail('R2_COVERAGE_HISTORY_MISMATCH');
  const afterFirst = e.firstStableSatisfying ? record.samples.filter(s => s.sequence > e.firstStableSatisfying.sampleSequences.at(-1)) : [];
  const violatingAfter = afterFirst.filter(s => s.state === 'ok' && s.eligibleBeforeDeadline && s.predicate === false);
  if (e.holdViolations.length !== violatingAfter.length || e.holdViolations.some((v, i) => v.sequence !== violatingAfter[i].sequence || !isDeepStrictEqual(v.actual, violatingAfter[i].actual))) fail('R2_HOLD_HISTORY_MISMATCH');
  if (e.holdUncertain !== afterFirst.some(s => s.state !== 'ok' || !s.eligibleBeforeDeadline)) fail('R2_HOLD_COVERAGE_MISMATCH');
  const expectedTail = record.termination.deadlineReached ? (lastValid ? Math.max(0, record.policy.timeoutMs - lastValid.completedMs) : record.policy.timeoutMs) : null;
  const expectedTailCovered = record.termination.deadlineReached && !!lastValid && expectedTail <= record.policy.pollIntervalMs;
  if (record.coverage.deadlineTailMs !== expectedTail || record.coverage.deadlineTailWithinPoll !== expectedTailCovered
      || record.coverage.unknownSamples !== record.samples.filter(s => s.state === 'unknown').length
      || record.coverage.errorSamples !== record.samples.filter(s => s.state === 'error').length
      || record.coverage.lateSamples !== record.samples.filter(s => s.state === 'late').length
      || record.coverage.gaps.some((gap, i) => gap.sequence !== expectedGaps[i].sequence || gap.state !== expectedGaps[i].state
        || gap.startedMs !== expectedGaps[i].requestStartedMs || gap.endedMs !== expectedGaps[i].completedMs)) fail('R2_COVERAGE_HISTORY_MISMATCH');
  if (typeof record.health.sessionUsable !== 'boolean' || !record.health.cleanup
      || typeof record.health.cleanup.attempted !== 'boolean' || !finite(record.health.cleanup.elapsedMs)
      || record.health.cleanup.elapsedMs < 0) fail('INVALID_R2_HEALTH');
  return record;
}
export function classifyMeasurementR2(input) {
  const record = validateMeasurementR2(input), { evidence: e, coverage, health, termination, policy } = record;
  const confirmed = [], unresolved = [], satisfied = [];
  const completeDeadline = termination.deadlineReached && termination.reason === 'observation-deadline';
  const cleanTrajectory = coverage.gaps.length === 0 && coverage.deadlineTailWithinPoll && !health.terminalError && health.sessionUsable === true;
  const witnessed = !!e.firstStableSatisfying;
  const holdSatisfied = completeDeadline && coverage.deadlineTailWithinPoll && !e.holdUncertain && e.holdViolations.length === 0;
  if (record.outcome === 'observed-satisfied' && witnessed && health.sessionUsable === true && !health.terminalError
      && (policy.temporalMode === 'eventually-stable' || holdSatisfied)) {
    satisfied.push({ reason: policy.temporalMode === 'eventually-stable' ? 'stable-satisfying-window-observed' : 'satisfying-window-followed-by-only-satisfying-observations-until-deadline', windowId: e.firstStableSatisfying.id });
  } else if (completeDeadline && cleanTrajectory && record.outcome === 'not-observed-by-deadline'
      && (!witnessed || policy.temporalMode === 'hold-through-deadline')
      && ((e.terminalStableWindow?.predicate === false) || (policy.temporalMode === 'hold-through-deadline' && e.holdViolations.length))) {
    confirmed.push({ reason: policy.temporalMode === 'hold-through-deadline' && e.holdViolations.length ? 'observed-post-window-hold-counterexample' : 'bounded-observation-contract-not-met',
      basis: { deadlineMs: termination.deadlineMs, terminalWindowId: e.terminalStableWindow?.id ?? null,
        lastStableViolatingWindowId: e.lastStableViolating?.id ?? null, holdCounterexampleSequences: e.holdViolations.map(v => v.sequence),
        cleanAttemptHistory: true },
      claim: 'Frozen bounded sampling contract was not met; this is not a continuous-time claim.',
      notClaimed: ['UI-was-wrong-at-every-instant', 'all-business-logic-is-invalid', 'v03-label-should-change'] });
  } else {
    if (health.terminalError) unresolved.push({ reason: 'terminal-measurement-error', error: copy(health.terminalError) });
    if (!health.sessionUsable) unresolved.push({ reason: 'session-not-usable' });
    if (termination.deadlineReached && !coverage.deadlineTailWithinPoll) unresolved.push({ reason: 'deadline-tail-not-covered', deadlineTailMs: coverage.deadlineTailMs, allowedTailMs: policy.pollIntervalMs });
    if (coverage.gaps.length) unresolved.push({ reason: 'sampling-coverage-gaps', sampleSequences: coverage.gaps.map(g => g.sequence) });
    if (record.outcome === 'interrupted') unresolved.push({ reason: 'observation-interrupted' });
    if (!e.lastStable) unresolved.push({ reason: 'no-stable-evidence' });
    unresolved.push({ reason: 'insufficient-evidence-for-conservative-partition', operationalOutcome: record.outcome });
  }
  return { schemaVersion: CLASSIFICATION_SCHEMA_VERSION, classificationPolicyId: CLASSIFICATION_POLICY_ID,
    policyStatus: CLASSIFICATION_POLICY_STATUS, partition: satisfied.length ? 'S' : confirmed.length ? 'W' : 'U_A',
    operationalOutcome: record.outcome, satisfied, confirmed, unresolved,
    coverage: copy(coverage), termination: copy(termination), health: copy(health),
    retainedEvidence: { lastStable: copy(e.lastStable), lastStableViolating: copy(e.lastStableViolating), lastStableSatisfying: copy(e.lastStableSatisfying) },
    predecessorLabelsModified: false };
}
export function classifySuiteR2(suite, { expectedKeys } = {}) {
  if (suite?.schemaVersion !== SUITE_SCHEMA_VERSION) fail('R2_SUITE_SCHEMA_REQUIRED');
  if (!Array.isArray(suite.checks) || !Array.isArray(suite.actions) || !Array.isArray(suite.errors)) fail('INVALID_R2_SUITE');
  if (expectedKeys !== undefined && (!Array.isArray(expectedKeys) || expectedKeys.some(k => typeof k !== 'string') || new Set(expectedKeys).size !== expectedKeys.length)) fail('INVALID_R2_EXPECTED_KEYS');
  const checkResults = [], confirmed = [], unresolved = [], keys = [];
  for (const check of suite.checks) {
    if (typeof check.key !== 'string' || !check.key || own(check, 'passed') || own(check, 'status') || own(check, 'error')) fail('INVALID_R2_CHECK_WRAPPER');
    keys.push(check.key);
    if (check.notMeasured) {
      if (check.measurement || typeof check.notMeasured.reason !== 'string') fail('INVALID_R2_NOT_MEASURED');
      unresolved.push({ key: check.key, reason: 'declared-check-not-measured', detail: copy(check.notMeasured) });
      checkResults.push({ key: check.key, partition: 'U_A', notMeasured: copy(check.notMeasured) });
      continue;
    }
    const result = classifyMeasurementR2(check.measurement); checkResults.push({ key: check.key, ...result });
    confirmed.push(...result.confirmed.map(reason => ({ key: check.key, ...reason })));
    unresolved.push(...result.unresolved.map(reason => ({ key: check.key, ...reason })));
  }
  if (!keys.length) unresolved.push({ reason: 'no-checks' });
  if (new Set(keys).size !== keys.length) unresolved.push({ reason: 'duplicate-checks' });
  if (expectedKeys && (keys.length !== expectedKeys.length || expectedKeys.some(key => !keys.includes(key)))) unresolved.push({ reason: 'missing-or-extra-checks', expectedKeys: [...expectedKeys], actualKeys: keys });
  for (const action of suite.actions) {
    if (!['performed', 'error', 'skipped'].includes(action.status)) fail('INVALID_R2_ACTION');
    if (action.status !== 'performed') unresolved.push({ reason: 'action-incomplete', action: copy(action) });
  }
  // No blanket promotion of locator/runtime/driver error codes to semantic W.
  for (const error of suite.errors) unresolved.push({ reason: 'suite-error', error: copy(error) });
  return { schemaVersion: CLASSIFICATION_SCHEMA_VERSION, classificationPolicyId: CLASSIFICATION_POLICY_ID, policyStatus: CLASSIFICATION_POLICY_STATUS,
    partition: confirmed.length ? 'W' : unresolved.length ? 'U_A' : 'S', confirmed, unresolved, checks: checkResults,
    aggregation: 'confirmed-W-precedence-with-all-unresolved-reasons-retained', predecessorLabelsModified: false };
}
