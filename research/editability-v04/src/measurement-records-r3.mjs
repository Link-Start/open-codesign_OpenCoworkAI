// Independent r3 record protocol; deliberately incompatible with v03 classifySuite.
import { isDeepStrictEqual } from 'node:util';
import { MEASUREMENT_SCHEMA_VERSION_R3, validateMeasurementPolicyR3, validateMeasurementExpectationR3, compareFactR3, stableWindowR3, validateFactR3 } from './measurement-r3.mjs';
export const PROJECTION_SCHEMA_VERSION_R3 = 'v04-measurement-projection-r3-1';
export const SUITE_SCHEMA_VERSION_R3 = 'v04-measurement-suite-r3-1';
export const CLASSIFICATION_SCHEMA_VERSION_R3 = 'v04-measurement-classification-r3-1';
export const CLASSIFICATION_POLICY_ID_R3 = 'v04-r3-conservative-partition-1';
export const CLASSIFICATION_POLICY_STATUS_R3 = 'development-only-pending-independent-calibration';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const copy = value => structuredClone(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
/** Validate evidence references before assigning a partition; r1 flags never suffice. */
export function validateMeasurementR3(record) {
  if (record?.schemaVersion !== MEASUREMENT_SCHEMA_VERSION_R3) fail('R3_MEASUREMENT_SCHEMA_REQUIRED');
  if (own(record, 'projection')) validateProjectionR3(record);
  validateMeasurementExpectationR3(record.expectation);
  const validatedPolicy = validateMeasurementPolicyR3(record.policy);
  if (!isDeepStrictEqual(record.policy, validatedPolicy) || typeof record.geometry !== 'boolean') fail('INVALID_R3_POLICY_RECORD');
  if (!['observed-satisfied', 'not-observed-by-deadline', 'measurement-unknown', 'interrupted'].includes(record.outcome)
      || !Array.isArray(record.samples) || !record.evidence || !record.coverage || !record.health || !record.termination) fail('INVALID_R3_MEASUREMENT_RECORD');
  if (record.coverage.continuousTimeCoverageClaimed !== false || record.coverage.completeAttemptHistory !== true
      || record.termination.boundary !== 'completion-strictly-before-deadline'
      || record.termination.deadlineMs !== record.policy.timeoutMs
      || !finite(record.termination.observationElapsedMs) || record.termination.observationElapsedMs < 0
      || record.termination.deadlineReached !== (record.termination.observationElapsedMs >= record.policy.timeoutMs)) fail('INVALID_R3_COVERAGE');
  if (record.samples.length > record.policy.maxSamples) fail('R3_SAMPLE_LIMIT_EXCEEDED');
  let previousTime = 0;
  for (const [index, sample] of record.samples.entries()) {
    if (sample.sequence !== index + 1 || !finite(sample.requestStartedMs) || !finite(sample.completedMs)
        || sample.requestStartedMs < previousTime || sample.completedMs < sample.requestStartedMs
        || sample.requestStartedMs >= record.policy.timeoutMs
        || sample.completedMs > record.termination.observationElapsedMs
        || !['ok', 'unknown', 'error', 'late'].includes(sample.state)) fail('INVALID_R3_SAMPLE');
    if (sample.eligibleBeforeDeadline && sample.completedMs >= record.policy.timeoutMs) fail('R3_LATE_SAMPLE_USED');
    if (sample.state === 'ok' && (!sample.eligibleBeforeDeadline || !own(sample, 'actual') || sample.actual === undefined || typeof sample.predicate !== 'boolean')) fail('INVALID_R3_VALID_SAMPLE');
    if (sample.state !== 'ok' && own(sample, 'actual')) fail('R3_UNKNOWN_HAS_ACTUAL');
    if (sample.state === 'ok' && sample.predicate !== compareFactR3(sample.actual, record.expectation, record.baselineEvidence)) fail('R3_PREDICATE_MISMATCH');
    previousTime = sample.completedMs;
  }
  const e = record.evidence;
  if (!Array.isArray(e.stableWindows) || !Array.isArray(e.holdViolations) || typeof e.holdUncertain !== 'boolean') fail('INVALID_R3_EVIDENCE');
  const windowIds = new Set();
  for (const window of e.stableWindows) {
    if (typeof window.id !== 'string' || windowIds.has(window.id) || !Array.isArray(window.sampleSequences)
        || window.sampleSequences.length !== record.policy.stableSamples) fail('INVALID_R3_STABLE_WINDOW');
    windowIds.add(window.id);
    const samples = window.sampleSequences.map(sequence => record.samples[sequence - 1]);
    if (samples.some((sample, i) => !sample || sample.sequence !== window.sampleSequences[i] || sample.state !== 'ok' || !sample.eligibleBeforeDeadline
        || sample.predicate !== window.predicate || (i && sample.sequence !== samples[i - 1].sequence + 1)
        || !isDeepStrictEqual(sample.identity, samples[0].identity))
        || !stableWindowR3(samples.map(s => s.actual), { geometry: record.geometry, delta: record.policy.geometryDeltaPx })
        || !isDeepStrictEqual(window.actual, samples.at(-1).actual)
        || window.startMs !== samples[0].completedMs || window.endMs !== samples.at(-1).completedMs) fail('INVALID_R3_STABLE_WINDOW');
  }
  for (const key of ['lastStable', 'lastStableSatisfying', 'firstStableSatisfying', 'lastStableViolating', 'terminalStableWindow']) {
    if (e[key] !== null && !e.stableWindows.some(window => isDeepStrictEqual(window, e[key]))) fail('R3_DANGLING_WINDOW_REFERENCE');
  }
  const satisfying = e.stableWindows.filter(window => window.predicate === true), violating = e.stableWindows.filter(window => window.predicate === false);
  if (!isDeepStrictEqual(e.lastStable, e.stableWindows.at(-1) ?? null)
      || !isDeepStrictEqual(e.lastStableSatisfying, satisfying.at(-1) ?? null)
      || !isDeepStrictEqual(e.firstStableSatisfying, satisfying[0] ?? null)
      || !isDeepStrictEqual(e.lastStableViolating, violating.at(-1) ?? null)) fail('R3_WINDOW_HISTORY_MISMATCH');
  const lastValid = record.samples.filter(sample => sample.state === 'ok' && sample.eligibleBeforeDeadline).at(-1) ?? null;
  if (!isDeepStrictEqual(e.lastValid, lastValid)) fail('R3_LAST_VALID_MISMATCH');
  const terminal = record.samples.at(-1), terminalWindow = terminal?.state === 'ok' && e.lastStable?.sampleSequences.at(-1) === terminal.sequence ? e.lastStable : null;
  if (!isDeepStrictEqual(e.terminalStableWindow, terminalWindow)) fail('R3_TERMINAL_WINDOW_MISMATCH');
  const expectedGaps = record.samples.filter(sample => sample.state !== 'ok' || !sample.eligibleBeforeDeadline);
  if (!Array.isArray(record.coverage.gaps) || record.coverage.gaps.length !== expectedGaps.length
      || record.coverage.attemptedSamples !== record.samples.length
      || record.coverage.validSamples !== record.samples.filter(s => s.state === 'ok' && s.eligibleBeforeDeadline).length) fail('R3_COVERAGE_HISTORY_MISMATCH');
  const afterFirst = e.firstStableSatisfying ? record.samples.filter(s => s.sequence > e.firstStableSatisfying.sampleSequences.at(-1)) : [];
  const violatingAfter = afterFirst.filter(s => s.state === 'ok' && s.eligibleBeforeDeadline && s.predicate === false);
  if (e.holdViolations.length !== violatingAfter.length || e.holdViolations.some((v, i) => v.sequence !== violatingAfter[i].sequence || !isDeepStrictEqual(v.actual, violatingAfter[i].actual))) fail('R3_HOLD_HISTORY_MISMATCH');
  if (e.holdUncertain !== afterFirst.some(s => s.state !== 'ok' || !s.eligibleBeforeDeadline)) fail('R3_HOLD_COVERAGE_MISMATCH');
  const expectedTail = record.termination.deadlineReached ? (lastValid ? Math.max(0, record.policy.timeoutMs - lastValid.completedMs) : record.policy.timeoutMs) : null;
  const expectedTailCovered = record.termination.deadlineReached && !!lastValid && expectedTail <= record.policy.pollIntervalMs;
  if (record.coverage.deadlineTailMs !== expectedTail || record.coverage.deadlineTailWithinPoll !== expectedTailCovered
      || record.coverage.unknownSamples !== record.samples.filter(s => s.state === 'unknown').length
      || record.coverage.errorSamples !== record.samples.filter(s => s.state === 'error').length
      || record.coverage.lateSamples !== record.samples.filter(s => s.state === 'late').length
      || record.coverage.gaps.some((gap, i) => gap.sequence !== expectedGaps[i].sequence || gap.state !== expectedGaps[i].state
        || gap.startedMs !== expectedGaps[i].requestStartedMs || gap.endedMs !== expectedGaps[i].completedMs)) fail('R3_COVERAGE_HISTORY_MISMATCH');
  if (typeof record.health.sessionUsable !== 'boolean' || !record.health.cleanup
      || typeof record.health.cleanup.attempted !== 'boolean' || !finite(record.health.cleanup.elapsedMs)
      || record.health.cleanup.elapsedMs < 0) fail('INVALID_R3_HEALTH');
  validateReplayR3(record);
  return record;
}
export function classifyMeasurementR3(input) {
  const record = validateMeasurementR3(input), { evidence: e, coverage, health, termination, policy } = record;
  const confirmed = [], unresolved = [], satisfied = [];
  const completeDeadline = termination.deadlineReached && termination.reason === 'observation-deadline';
  const cleanTrajectory = coverage.gaps.length === 0 && coverage.deadlineTailWithinPoll && !health.terminalError && health.sessionUsable === true;
  const sourceCaptureSatisfied = !record.projection || classifyMeasurementR3(record.projection.acquisition).partition === 'S';
  const witnessed = !!e.firstStableSatisfying;
  const holdSatisfied = completeDeadline && coverage.deadlineTailWithinPoll && !e.holdUncertain && e.holdViolations.length === 0;
  if (record.outcome === 'observed-satisfied' && witnessed && health.sessionUsable === true && !health.terminalError
      && (policy.temporalMode === 'eventually-stable' || holdSatisfied)) {
    satisfied.push({ reason: policy.temporalMode === 'eventually-stable' ? 'stable-satisfying-window-observed' : 'satisfying-window-followed-by-only-satisfying-observations-until-deadline', windowId: e.firstStableSatisfying.id });
  } else if (sourceCaptureSatisfied && completeDeadline && cleanTrajectory && record.outcome === 'not-observed-by-deadline'
      && (!witnessed || policy.temporalMode === 'hold-through-deadline')
      && ((e.terminalStableWindow?.predicate === false) || (policy.temporalMode === 'hold-through-deadline' && e.holdViolations.length))) {
    confirmed.push({ reason: policy.temporalMode === 'hold-through-deadline' && e.holdViolations.length ? 'observed-post-window-hold-counterexample' : 'bounded-observation-contract-not-met',
      basis: { deadlineMs: termination.deadlineMs, terminalWindowId: e.terminalStableWindow?.id ?? null,
        lastStableViolatingWindowId: e.lastStableViolating?.id ?? null, holdCounterexampleSequences: e.holdViolations.map(v => v.sequence),
        cleanAttemptHistory: true },
      claim: 'Frozen bounded sampling contract was not met; this is not a continuous-time claim.',
      notClaimed: ['UI-was-wrong-at-every-instant', 'all-business-logic-is-invalid', 'v03-label-should-change'] });
  } else {
    if (!sourceCaptureSatisfied) unresolved.push({ reason: 'source-capture-not-satisfied' });
    if (health.terminalError) unresolved.push({ reason: 'terminal-measurement-error', error: copy(health.terminalError) });
    if (!health.sessionUsable) unresolved.push({ reason: 'session-not-usable' });
    if (termination.deadlineReached && !coverage.deadlineTailWithinPoll) unresolved.push({ reason: 'deadline-tail-not-covered', deadlineTailMs: coverage.deadlineTailMs, allowedTailMs: policy.pollIntervalMs });
    if (coverage.gaps.length) unresolved.push({ reason: 'sampling-coverage-gaps', sampleSequences: coverage.gaps.map(g => g.sequence) });
    if (record.outcome === 'interrupted') unresolved.push({ reason: 'observation-interrupted' });
    if (!e.lastStable) unresolved.push({ reason: 'no-stable-evidence' });
    unresolved.push({ reason: 'insufficient-evidence-for-conservative-partition', operationalOutcome: record.outcome });
  }
  return { schemaVersion: CLASSIFICATION_SCHEMA_VERSION_R3, classificationPolicyId: CLASSIFICATION_POLICY_ID_R3,
    policyStatus: CLASSIFICATION_POLICY_STATUS_R3, partition: satisfied.length ? 'S' : confirmed.length ? 'W' : 'U_A',
    operationalOutcome: record.outcome, satisfied, confirmed, unresolved,
    coverage: copy(coverage), termination: copy(termination), health: copy(health),
    retainedEvidence: { lastStable: copy(e.lastStable), lastStableViolating: copy(e.lastStableViolating), lastStableSatisfying: copy(e.lastStableSatisfying) },
    predecessorLabelsModified: false };
}
export function classifySuiteR3(suite, { expectedKeys } = {}) {
  if (suite?.schemaVersion !== SUITE_SCHEMA_VERSION_R3) fail('R3_SUITE_SCHEMA_REQUIRED');
  if (!Array.isArray(suite.checks) || !Array.isArray(suite.actions) || !Array.isArray(suite.errors)) fail('INVALID_R3_SUITE');
  if ((!Array.isArray(expectedKeys) || expectedKeys.some(k => typeof k !== 'string' || !k) || new Set(expectedKeys).size !== expectedKeys.length)) fail('INVALID_R3_EXPECTED_KEYS');
  const checkResults = [], confirmed = [], unresolved = [], keys = [];
  for (const check of suite.checks) {
    if (typeof check.key !== 'string' || !check.key || own(check, 'passed') || own(check, 'status') || own(check, 'error')) fail('INVALID_R3_CHECK_WRAPPER');
    keys.push(check.key);
    if (check.notMeasured) {
      if (check.measurement || typeof check.notMeasured.reason !== 'string') fail('INVALID_R3_NOT_MEASURED');
      unresolved.push({ key: check.key, reason: 'declared-check-not-measured', detail: copy(check.notMeasured) });
      checkResults.push({ key: check.key, partition: 'U_A', notMeasured: copy(check.notMeasured) });
      continue;
    }
    const result = classifyMeasurementR3(check.measurement); checkResults.push({ key: check.key, ...result });
    confirmed.push(...result.confirmed.map(reason => ({ key: check.key, ...reason })));
    unresolved.push(...result.unresolved.map(reason => ({ key: check.key, ...reason })));
  }
  if (!keys.length) unresolved.push({ reason: 'no-checks' });
  if (new Set(keys).size !== keys.length) unresolved.push({ reason: 'duplicate-checks' });
  if (expectedKeys && (keys.length !== expectedKeys.length || expectedKeys.some(key => !keys.includes(key)))) unresolved.push({ reason: 'missing-or-extra-checks', expectedKeys: [...expectedKeys], actualKeys: keys });
  for (const action of suite.actions) {
    if (!['performed', 'error', 'skipped'].includes(action.status)) fail('INVALID_R3_ACTION');
    if (action.status !== 'performed') unresolved.push({ reason: 'action-incomplete', action: copy(action) });
  }
  // No blanket promotion of locator/runtime/driver error codes to semantic W.
  for (const error of suite.errors) unresolved.push({ reason: 'suite-error', error: copy(error) });
  return { schemaVersion: CLASSIFICATION_SCHEMA_VERSION_R3, classificationPolicyId: CLASSIFICATION_POLICY_ID_R3, policyStatus: CLASSIFICATION_POLICY_STATUS_R3,
    partition: confirmed.length ? 'W' : unresolved.length ? 'U_A' : 'S', confirmed, unresolved, checks: checkResults,
    aggregation: 'confirmed-W-precedence-with-all-unresolved-reasons-retained', predecessorLabelsModified: false };
}

// Replay from typed facts/rules, not persisted predicate/window/outcome flags. This also
// rejects omitted windows, forged identity/span references, and incomplete coverage summaries.
function validateReplayR3(record, build = false) {
  const { policy, samples, termination: t, health: h } = record;
  if (!isDeepStrictEqual(record.baselineEvidence, record.expectation.rule.baseline ?? null)) fail('R3_BASELINE_EVIDENCE_MISMATCH');
  let rolling = [], lastValid = null, first = null, holdUncertain = false;
  const windows = [], holdViolations = [], gaps = [];
  for (const sample of samples) {
    if (typeof sample.eligibleBeforeDeadline !== 'boolean') fail('INVALID_R3_ELIGIBILITY');
    if (sample.state === 'ok') {
      validateFactR3(sample.actual);
      if (own(sample, 'error') || sample.evidence?.valueState && sample.evidence.valueState.status !== 'available') fail('INVALID_R3_VALID_SAMPLE');
    } else {
      if (own(sample, 'predicate')) fail('R3_UNKNOWN_HAS_PREDICATE');
      if (sample.state === 'late' && sample.eligibleBeforeDeadline) fail('R3_LATE_SAMPLE_USED');
      if (sample.lateObservation) {
        const late = sample.lateObservation;
        if (!['ok', 'unknown', 'error'].includes(late.state)) fail('INVALID_R3_LATE_OBSERVATION');
        if (late.state === 'ok') {
          validateFactR3(late.actual);
          if (own(late, 'error') || late.evidence?.valueState && late.evidence.valueState.status !== 'available') fail('INVALID_R3_LATE_OBSERVATION');
        } else if (own(late, 'actual')) fail('R3_UNKNOWN_HAS_ACTUAL');
      }
    }
    if (sample.state !== 'ok' || !sample.eligibleBeforeDeadline) {
      rolling = [];
      gaps.push({ sequence: sample.sequence, startedMs: sample.requestStartedMs, endedMs: sample.completedMs, state: sample.state, error: sample.error ?? null });
      if (first) holdUncertain = true;
      continue;
    }
    lastValid = sample;
    const predicate = compareFactR3(sample.actual, record.expectation);
    if (first && !predicate) holdViolations.push({ sequence: sample.sequence, actual: copy(sample.actual), elapsedMs: sample.completedMs, afterWindowId: first.id });
    if (rolling.length && (!isDeepStrictEqual(rolling.at(-1).identity, sample.identity) || rolling.at(-1).predicate !== predicate)) rolling = [];
    rolling.push(sample);
    if (rolling.length > policy.stableSamples) rolling.shift();
    if (rolling.length !== policy.stableSamples || !stableWindowR3(rolling.map(s => s.actual), { geometry: record.geometry, delta: policy.geometryDeltaPx })) continue;
    const window = { id: `window-${windows.length + 1}`, sampleSequences: rolling.map(s => s.sequence),
      startMs: rolling[0].completedMs, endMs: sample.completedMs, predicate, actual: copy(sample.actual),
      identity: copy(sample.identity ?? null), spanMs: sample.completedMs - rolling[0].completedMs };
    windows.push(window);
    if (predicate) first ??= window;
  }
  const last = windows.at(-1) ?? null;
  const satisfying = windows.filter(w => w.predicate), violating = windows.filter(w => !w.predicate);
  const terminal = samples.at(-1);
  const terminalWindow = terminal?.state === 'ok' && terminal.eligibleBeforeDeadline && last?.sampleSequences.at(-1) === terminal.sequence ? last : null;
  const evidence = { lastValid, lastStable: last, lastStableSatisfying: satisfying.at(-1) ?? null, firstStableSatisfying: first,
    lastStableViolating: violating.at(-1) ?? null, terminalStableWindow: terminalWindow, stableWindows: windows, holdViolations, holdUncertain };
  if (!build && !isDeepStrictEqual(record.evidence, evidence)) fail('R3_REPLAY_EVIDENCE_MISMATCH');
  const valid = samples.filter(s => s.state === 'ok' && s.eligibleBeforeDeadline);
  const validGaps = valid.slice(1).map((s, i) => s.completedMs - valid[i].completedMs);
  const tail = t.deadlineReached ? (lastValid ? Math.max(0, policy.timeoutMs - lastValid.completedMs) : policy.timeoutMs) : null;
  const tailCovered = t.deadlineReached && !!lastValid && tail <= policy.pollIntervalMs;
  const coverage = { attemptedSamples: samples.length, validSamples: valid.length,
    unknownSamples: samples.filter(s => s.state === 'unknown').length, errorSamples: samples.filter(s => s.state === 'error').length,
    lateSamples: samples.filter(s => s.state === 'late').length, gaps, lastValidAtMs: lastValid?.completedMs ?? null,
    terminalGapMs: lastValid ? Math.max(0, t.observationElapsedMs - lastValid.completedMs) : t.observationElapsedMs,
    deadlineTailMs: tail, deadlineTailWithinPoll: tailCovered, maximumValidSampleGapMs: validGaps.length ? Math.max(...validGaps) : null,
    continuousTimeCoverageClaimed: false, completeAttemptHistory: true };
  if (!build && !isDeepStrictEqual(record.coverage, coverage)) fail('R3_REPLAY_COVERAGE_MISMATCH');
  const fatal = new Set(['SESSION_CLOSED', 'NO_RENDER', 'CONTAINMENT_CONTROL_FAILED', 'SNAPSHOT_NODE_LIMIT', 'CDP_CLOSED', 'CDP_SOCKET_ERROR', 'PAGE_RUNTIME_ERROR',
    'VIEWPORT_CHANGED', 'VIEWPORT_TRANSITION_PENDING', 'R3_OBSERVATION_PROVENANCE_MISMATCH',
    'BROWSER_CLEANUP_FAILED', 'RENDER_LIFECYCLE_BUSY']);
  const reasons = ['satisfied', 'observation-deadline', 'resource-limit', 'external-abort', 'late-response', 'collection-timeout', 'fatal-collection-error'];
  if (!reasons.includes(t.reason)) fail('INVALID_R3_TERMINATION');
  const interrupted = ['external-abort', 'collection-timeout', 'fatal-collection-error'].includes(t.reason);
  if (h.sessionUsable !== !interrupted) fail('R3_HEALTH_TERMINATION_MISMATCH');
  if (t.reason === 'satisfied' && (policy.temporalMode !== 'eventually-stable' || !first || first.sampleSequences.at(-1) !== terminal?.sequence)) fail('INVALID_R3_TERMINATION');
  if (t.reason === 'observation-deadline' && !t.deadlineReached) fail('INVALID_R3_TERMINATION');
  if (['satisfied', 'observation-deadline'].includes(t.reason) && h.terminalError !== null) fail('R3_HEALTH_TERMINATION_MISMATCH');
  if (t.reason === 'resource-limit' && (samples.length !== policy.maxSamples || h.terminalError?.code !== 'MEASUREMENT_SAMPLE_LIMIT')) fail('INVALID_R3_TERMINATION');
  if (t.reason === 'late-response' && (terminal?.state !== 'late' || !t.deadlineReached || h.terminalError?.code !== 'OBSERVATION_COMPLETED_AFTER_CUTOFF')) fail('INVALID_R3_TERMINATION');
  if (t.reason === 'collection-timeout' && (terminal?.state !== 'error' || terminal.eligibleBeforeDeadline || !t.deadlineReached || !isDeepStrictEqual(terminal.error, h.terminalError))) fail('INVALID_R3_TERMINATION');
  if (t.reason === 'fatal-collection-error' && (!fatal.has(terminal?.error?.code) || !isDeepStrictEqual(terminal.error, h.terminalError))) fail('INVALID_R3_TERMINATION');
  if (t.reason === 'external-abort' && !h.terminalError) fail('INVALID_R3_TERMINATION');
  if (samples.some(s => s.eligibleBeforeDeadline && fatal.has(s.error?.code) && (s !== terminal || t.reason !== 'fatal-collection-error'))) fail('INVALID_R3_FATAL_HISTORY');
  if (!record.projection && policy.temporalMode === 'eventually-stable' && first && t.reason !== 'satisfied') fail('INVALID_R3_TERMINATION');
  if (!interrupted && !isDeepStrictEqual(h.cleanup, { attempted: false, status: 'not-needed', elapsedMs: 0, error: null })) fail('INVALID_R3_CLEANUP');
  if (interrupted) {
    const c = h.cleanup;
    if (!['unavailable', 'completed', 'failed', 'timeout'].includes(c.status) || c.attempted !== (c.status !== 'unavailable')
        || (c.status === 'unavailable' && (c.elapsedMs !== 0 || c.error !== null))
        || (c.status === 'completed' && c.error !== null)
        || (['failed', 'timeout'].includes(c.status) && !c.error)
        || (c.status === 'timeout' && (c.elapsedMs < policy.cleanupTimeoutMs || c.error.code !== 'CLEANUP_TIMEOUT'))) fail('INVALID_R3_CLEANUP');
  }
  let outcome;
  if (record.projection && policy.temporalMode === 'eventually-stable' && first && h.sessionUsable && !h.terminalError) outcome = 'observed-satisfied';
  else if (t.reason === 'satisfied') outcome = 'observed-satisfied';
  else if (!t.deadlineReached) outcome = t.reason === 'resource-limit' ? 'measurement-unknown' : 'interrupted';
  else if (policy.temporalMode === 'hold-through-deadline' && first && !holdViolations.length && !holdUncertain && !h.terminalError && tailCovered) outcome = 'observed-satisfied';
  else if (policy.temporalMode === 'hold-through-deadline' && first && (holdUncertain || !tailCovered)) outcome = 'measurement-unknown';
  else if (violating.length || holdViolations.length) outcome = 'not-observed-by-deadline';
  else outcome = 'measurement-unknown';
  if (!build && record.outcome !== outcome) fail('R3_OUTCOME_MISMATCH');
  return { evidence, coverage, outcome };
}
function validateAcquisitionR3(acquisition) {
  if (!acquisition || own(acquisition, 'projection') || acquisition.expectation?.cmp !== 'r3'
      || acquisition.expectation?.rule?.kind !== 'capture' || acquisition.policy?.temporalMode !== 'hold-through-deadline') fail('R3_SHARED_CAPTURE_REQUIRED');
  validateMeasurementR3(acquisition);
}
function projectUncheckedR3(acquisition, expectation, policy) {
  const result = {
    schemaVersion: MEASUREMENT_SCHEMA_VERSION_R3, policy: { ...policy }, geometry: acquisition.geometry,
    expectation: copy(expectation), baselineEvidence: copy(expectation.rule.baseline ?? null),
    termination: copy(acquisition.termination), samples: copy(acquisition.samples), health: copy(acquisition.health),
    projection: { schemaVersion: PROJECTION_SCHEMA_VERSION_R3, acquisitionPolicy: copy(acquisition.policy), rulePolicy: { ...policy },
      acquisition: copy(acquisition), acquisitionStrategy: 'single-full-deadline-capture-then-offline-rules' },
  };
  for (const sample of result.samples) {
    if (sample.state !== 'ok') continue;
    try { sample.predicate = compareFactR3(sample.actual, expectation); }
    catch (error) {
      sample.observedActual = copy(sample.actual); delete sample.actual; delete sample.predicate;
      sample.state = 'error'; sample.error = { code: error?.code ?? error?.name ?? 'COLLECTION_ERROR', message: String(error?.message ?? error) };
    }
  }
  Object.assign(result, validateReplayR3(result, true));
  return result;
}
/** Offline only. Keeps all source facts/times in projection.acquisition; no collection or clock. */
export function projectMeasurementR3(acquisition, expectation, { policy: inputPolicy = acquisition?.policy } = {}) {
  validateAcquisitionR3(acquisition); validateMeasurementExpectationR3(expectation);
  const policy = validateMeasurementPolicyR3(inputPolicy);
  if (!isDeepStrictEqual({ ...policy, temporalMode: 'hold-through-deadline' }, acquisition.policy)) fail('R3_PROJECTION_POLICY_MISMATCH');
  const result = projectUncheckedR3(acquisition, expectation, policy);
  validateMeasurementR3(result);
  return result;
}
function validateProjectionR3(record) {
  const p = record.projection;
  if (p?.schemaVersion !== PROJECTION_SCHEMA_VERSION_R3) fail('R3_PROJECTION_SCHEMA_REQUIRED');
  validateAcquisitionR3(p.acquisition); validateMeasurementExpectationR3(record.expectation);
  const policy = validateMeasurementPolicyR3(record.policy);
  if (!isDeepStrictEqual({ ...policy, temporalMode: 'hold-through-deadline' }, p.acquisition.policy)) fail('R3_PROJECTION_POLICY_MISMATCH');
  const expected = projectUncheckedR3(p.acquisition, record.expectation, policy);
  if (!isDeepStrictEqual(record, expected)) fail('R3_PROJECTION_REPLAY_MISMATCH');
}