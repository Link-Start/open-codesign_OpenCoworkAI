// Private Node-only evaluation boundary. No method callbacks, page predicates, or persistence.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const runEvaluationR3 = async options => (await import('./evaluate-adapter-r3.mjs')).runEvaluationR3(options);
import { validateEvaluationPlanR3, evaluationProvenanceR3, digestR3 } from './evaluation-plan-r3.mjs';
import { validateFactR3, validateJsonR3, validateMeasurementPolicyR3 } from './measurement-r3.mjs';
import { classifyMeasurementR3 } from './measurement-records-r3.mjs';
import { normalizeRuntimeJournalR3 } from './runtime-evidence-r3.mjs';

export const BASELINE_SCHEMA_VERSION_R3 = 'v04-baseline-bundle-r3-1';
export const ACCEPTED_EVALUATION_SCHEMA_VERSION_R3 = 'v04-accepted-evaluation-r3-1';
const brands = new WeakMap();
const copy = value => structuredClone(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const capture = () => ({ cmp: 'r3', rule: { kind: 'capture' } });
const absolute = expect => ({ cmp: 'r3', rule: { kind: 'absolute', expect: copy(expect) } });
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const part of Object.values(value)) freeze(part);
    Object.freeze(value);
  }
  return value;
}
function frozen(value) {
  return !value || typeof value !== 'object' || Object.isFrozen(value) && Object.values(value).every(frozen);
}
function source(request, expected) {
  if (!(request?.sourceBytes instanceof Uint8Array)) fail('R3_SOURCE_BYTES_REQUIRED');
  const actual = hash(request.sourceBytes);
  if (expected !== undefined && (!validHash(expected) || actual !== expected)) fail('R3_SOURCE_HASH_MISMATCH');
  if (request.staticGate?.accepted !== true || request.staticGate.sourceSha256 !== actual) fail('R3_SOURCE_BOUND_STATIC_GATE_REQUIRED');
  return actual;
}
function planRequired(input) {
  const plan = validateEvaluationPlanR3(input);
  if (typeof plan.requirements.excludeNoopFromG !== 'boolean') fail('R3_EXPLICIT_G_NOOP_POLICY_REQUIRED');
  if (plan.requirements.excludeNoopFromG !== false) fail('PRIMARY_G_NOOP_EXCLUSION_FORBIDDEN');
  return plan;
}
// Fixed before either run; masks never dynamically remove declared endpoint keys.
function endpointRequirements(plan) {
  return Object.fromEntries(['R', 'G'].map(endpoint => {
    const lists = endpoint === 'G' ? ['originals', 'targets', 'protections', 'reachability'] : ['targets', 'protections', 'reachability'];
    const required = new Set(lists.flatMap(list => plan.requirements[list].map(item => item.key)));
    const checkKeys = plan.expectedKeys.filter(key => required.has(key));
    const selectedRuns = new Set((endpoint === 'G' ? plan.checkpoints : plan.checkpoints.filter(c => required.has(c.key))).map(c => c.runKey));
    const runtimeRunKeys = plan.runs.map(run => run.runKey).filter(key => selectedRuns.has(key));
    return [endpoint, { checkKeys, runtimeRunKeys, qualificationRequired: true }];
  }));
}
function baselineRules(plan) {
  const rules = Object.fromEntries(plan.expectedKeys.map(key => [key, { capture: capture() }]));
  for (const [list, id] of [['originals', 'original'], ['targets', 'target']]) {
    for (const item of plan.requirements[list]) rules[item.key][id] = absolute(item.expect);
  }
  for (const item of plan.requirements.reachability) rules[item.key].reachability = item.mode === 'available' ? capture() : absolute(item.expect);
  return freeze(rules);
}
const PROVENANCE_FIELDS = ['sourceSha256', 'runId', 'planDigest', 'replayDigest', 'catalogDigest', 'observationDigest',
  'viewportDigest', 'observerSha256', 'observerRevision', 'calibrationPolicyId', 'calibrationBindingDigest',
  'measurementPolicyDigest', 'checkpointKey', 'entryContract', 'environmentDigest'];
const PHYSICAL_FIELDS = new Set(['sourceSha256', 'runId', 'renderId', 'renderEpoch', 'sessionId', 'backendNodeIds', 'contextBackendNodeIds']);
function semantic(provenance) {
  return Object.fromEntries(Object.entries(provenance).filter(([key]) => !PHYSICAL_FIELDS.has(key)));
}
function validateProvenance(provenance, key, run, original) {
  if (!provenance || PROVENANCE_FIELDS.some(field => typeof provenance[field] !== 'string' || !provenance[field])) fail('R3_CHECK_PROVENANCE_REQUIRED');
  for (const field of PROVENANCE_FIELDS.filter(field => field.endsWith('Digest') || field.endsWith('Sha256'))) {
    if (!validHash(provenance[field])) fail('R3_CHECK_PROVENANCE_REQUIRED');
  }
  if (provenance.checkpointKey !== key || ['sourceSha256', 'runId', 'planDigest', 'environmentDigest', 'calibrationBindingDigest'].some(field => provenance[field] !== run[field])) fail('R3_CHECK_PROVENANCE_MISMATCH');
  if (original && !isDeepStrictEqual(semantic(provenance), semantic(original))) fail('R3_BASELINE_CANDIDATE_PROVENANCE_MISMATCH');
}
function auditRun(run, { plan, sourceSha256, policy, rules, baseline, calibration, environment }) {
  if (run?.schemaVersion !== 'v04-evaluation-run-r3-1' || typeof run.runId !== 'string' || !run.runId
      || run.sourceSha256 !== sourceSha256 || run.planDigest !== plan.planDigest
      || run.environmentDigest !== digestR3(environment) || run.calibrationBindingDigest !== digestR3(calibration)
      || !isDeepStrictEqual(run.measurementPolicy, policy)) fail('R3_RUN_BINDING_MISMATCH');
  if (!Array.isArray(run.checks) || !Array.isArray(run.errors) || !Array.isArray(run.actions)) fail('R3_INVALID_EVALUATION_RUN');
  const keys = run.checks.map(check => check.key);
  if (keys.length !== plan.expectedKeys.length || new Set(keys).size !== keys.length
      || keys.some(key => !plan.expectedKeys.includes(key))) fail('R3_EXPECTED_KEYS_AUDIT_ERROR');
  if (baseline && (run.environmentDigest !== baseline.run.environmentDigest || run.calibrationBindingDigest !== baseline.run.calibrationBindingDigest
      || run.runId === baseline.run.runId)) fail('R3_BASELINE_CANDIDATE_RUN_BINDING_MISMATCH');
  const scopes = run.runtimeEvidence?.scenarios;
  if (!Array.isArray(scopes) || scopes.length !== plan.runs.length
      || new Set(scopes.map(scope => scope?.runKey)).size !== scopes.length
      || scopes.some(scope => !scope || !plan.runs.some(run => run.runKey === scope.runKey))) fail('R3_NATIVE_RUNTIME_SCOPES_REQUIRED');
  {
    if (scopes.some(scope => !scope || !own(scope, 'nativeJournal') || typeof scope.lifecycleComplete !== 'boolean')) fail('R3_NATIVE_RUNTIME_JOURNALS_REQUIRED');
    const replayedEvents = [];
    for (const scope of scopes) {
      const replayed = normalizeRuntimeJournalR3(scope.nativeJournal, { runKey: scope.runKey, sourceSha256, runId: run.runId });
      if (scope.complete !== (replayed.complete && scope.lifecycleComplete)) fail('R3_NATIVE_RUNTIME_COMPLETENESS_MISMATCH');
      replayedEvents.push(...replayed.events);
    }
    if (!isDeepStrictEqual(run.runtimeEvidence.events, replayedEvents)) fail('R3_NATIVE_RUNTIME_EVENTS_MISMATCH');
  }
  const checks = new Map();
  for (const check of run.checks) {
    if (check.provenance) {
      const expected = evaluationProvenanceR3({ plan, checkpoint: plan.checkpoints.find(c => c.key === check.key),
        sourceSha256, runId: run.runId, calibration, environment, policy });
      if (!isDeepStrictEqual(check.provenance, expected)) fail('R3_EXPECTED_PROVENANCE_MISMATCH');
    }
    if (check.provenance) validateProvenance(check.provenance, check.key, run, baseline?.checks.get(check.key)?.provenance);
    if (check.notMeasured) {
      if (check.measurements || check.acquisition || typeof check.notMeasured.reason !== 'string' || !check.notMeasured.reason) fail('R3_INVALID_NOT_MEASURED');
    } else {
      validateProvenance(check.provenance, check.key, run, baseline?.checks.get(check.key)?.provenance);
      if (!check.measurements || !check.acquisition || check.acquisition.projection
          || !isDeepStrictEqual(check.acquisition.expectation, capture())
          || !isDeepStrictEqual(check.acquisition.policy, { ...policy, temporalMode: 'hold-through-deadline' })) fail('R3_SHARED_ACQUISITION_REQUIRED');
      classifyMeasurementR3(check.acquisition);
      if (!isDeepStrictEqual(Object.keys(check.measurements).sort(), Object.keys(rules[check.key]).sort())) fail('R3_RULE_KEYS_AUDIT_ERROR');
      for (const [id, expect] of Object.entries(rules[check.key])) {
        const record = check.measurements[id];
        if (!isDeepStrictEqual(record.expectation, expect) || !isDeepStrictEqual(record.policy, policy)
            || !isDeepStrictEqual(record.projection?.acquisition, check.acquisition)) fail('R3_RULE_BINDING_MISMATCH');
        classifyMeasurementR3(record);
      }
    }
    checks.set(check.key, check);
  }
  return checks;
}
function verdict(check, id) {
  if (!check || check.notMeasured || !check.measurements?.[id]) return {
    partition: 'U_A', confirmed: [], unresolved: [{ reason: 'required-measurement-unavailable', detail: copy(check?.notMeasured ?? null) }],
  };
  return classifyMeasurementR3(check.measurements[id]);
}
function available(check) {
  if (!check?.acquisition) return { status: 'unknown', reason: 'capture-not-measured' };
  const m = check.acquisition;
  const classified = classifyMeasurementR3(m);
  // Early existential capture success cannot freeze a baseline after any coverage gap.
  if (classified.partition !== 'S' || m.coverage.gaps.length || !m.coverage.completeAttemptHistory
      || !m.coverage.deadlineTailWithinPoll || !m.termination.deadlineReached || m.termination.reason !== 'observation-deadline'
      || !m.health.sessionUsable || m.health.terminalError || !m.evidence.terminalStableWindow) {
    return { status: 'unknown', reason: 'capture-health-or-coverage-incomplete', uncertainty: classified.unresolved };
  }
  const fact = copy(m.evidence.terminalStableWindow.actual);
  validateFactR3(fact);
  return { status: 'available', fact, windowId: m.evidence.terminalStableWindow.id };
}
function addVerdict(output, check, id, key, role) {
  const result = verdict(check, id);
  output.reasons.push(...result.confirmed.map(detail => ({ key, role, ...detail })));
  output.uncertainty.push(...result.unresolved.map(detail => ({ key, role, ...detail })));
  return result.partition;
}
// Native runtime events are a separate evidence channel, never transport-code aliases.
// Absence of this channel is unknown rather than proof of a clean page.
function runtimeState(run, plan, endpoint) {
  const selected = endpoint === 'G' ? plan.checkpoints : plan.checkpoints.filter(checkpoint =>
    ['targets', 'protections', 'reachability'].some(list => plan.requirements[list].some(item => item.key === checkpoint.key)));
  const runKeys = new Set(selected.map(checkpoint => checkpoint.runKey));
  const allRunKeys = new Set(plan.checkpoints.map(checkpoint => checkpoint.runKey));
  const evidence = run.runtimeEvidence;
  const uncertainty = [], confirmed = [];
  if (!evidence || !Array.isArray(evidence.events)) uncertainty.push({ reason: 'runtime-evidence-incomplete' });
  if (evidence && own(evidence, 'scenarios')) {
    const scopes = evidence.scenarios;
    const valid = Array.isArray(scopes) && scopes.length === allRunKeys.size
      && new Set(scopes.map(scope => scope?.runKey)).size === scopes.length
      && scopes.every(scope => scope && allRunKeys.has(scope.runKey) && typeof scope.complete === 'boolean')
      && evidence.complete === scopes.every(scope => scope.complete);
    if (!valid) uncertainty.push({ reason: 'runtime-coverage-scope-audit-error' });
    else {
      const incomplete = scopes.filter(scope => runKeys.has(scope.runKey) && !scope.complete).map(scope => scope.runKey);
      if (incomplete.length) uncertainty.push({ reason: 'runtime-evidence-incomplete', runKeys: incomplete });
    }
  } else uncertainty.push({ reason: 'runtime-coverage-scopes-required' });
  for (const event of Array.isArray(evidence?.events) ? evidence.events : []) {
    if (!event || !allRunKeys.has(event.runKey)) { uncertainty.push({ reason: 'runtime-event-scope-unresolved' }); continue; }
    if (!runKeys.has(event.runKey)) continue;
    const signature = event.signature;
    const identified = signature && ['category', 'location', 'code'].every(key => typeof signature[key] === 'string' && signature[key]);
    const bound = event.evidence?.sourceSha256 === run.sourceSha256 && event.evidence?.runId === run.runId;
    if (event.kind !== 'runtime-error' || event.confirmed !== true || !identified || !bound) {
      uncertainty.push({ reason: 'runtime-event-unconfirmed-or-unbound', event: copy(event) });
      continue;
    }
    confirmed.push({ runKey: event.runKey, signature: copy(signature), evidence: copy(event.evidence),
      identity: JSON.stringify([event.runKey, signature.category, signature.location, signature.code]) });
  }
  return { confirmed, uncertainty };
}
function runtimeDelta(actual, original) {
  const remaining = new Map();
  for (const event of original.confirmed) remaining.set(event.identity, (remaining.get(event.identity) ?? 0) + 1);
  const added = [];
  for (const event of actual.confirmed) {
    const before = remaining.get(event.identity) ?? 0;
    if (before > 0) remaining.set(event.identity, before - 1);
    else added.push({ reason: 'new-or-increased-confirmed-runtime-error', runKey: event.runKey, signature: event.signature, evidence: event.evidence });
  }
  return added;
}
function eligibility(plan, checks, facts, run) {
  const req = plan.requirements;
  const goalStates = req.targets.map(item => verdict(checks.get(item.key), 'target').partition);
  const noop = goalStates.every(state => state === 'S') ? 'confirmed-noop'
    : goalStates.includes('W') ? 'confirmed-nonnoop' : 'unresolved';
  const endpoints = {};
  for (const endpoint of ['R', 'G']) {
    const out = { eligibility: null, classification: null, reasons: [], uncertainty: [] };
    const lists = endpoint === 'G' ? ['originals', 'targets', 'protections', 'reachability'] : ['targets', 'protections', 'reachability'];
    const required = new Set(lists.flatMap(list => req[list].map(item => item.key)));
    for (const key of required) if (facts[key].status !== 'available') out.uncertainty.push({ key, reason: 'required-baseline-unavailable', detail: facts[key].reason });
    if (endpoint === 'G') for (const item of req.originals) addVerdict(out, checks.get(item.key), 'original', item.key, 'original');
    for (const item of req.reachability) {
      if (item.mode === 'predicate') addVerdict(out, checks.get(item.key), 'reachability', item.key, 'reachability');
    }
    // Primary G preserves F0 original-health eligibility; no-op is reported separately.
    if (endpoint === 'R') {
      if (noop === 'confirmed-noop') out.reasons.push({ reason: 'original-already-satisfies-all-targets' });
      else if (noop === 'unresolved') out.uncertainty.push({ reason: 'target-noop-unresolved' });
    }
    const runtime = runtimeState(run, plan, endpoint);
    out.uncertainty.push(...runtime.uncertainty);
    if (endpoint === 'G') out.reasons.push(...runtime.confirmed.map(event => ({ reason: 'confirmed-original-runtime-error', ...event })));
    out.eligibility = out.reasons.length ? 'ineligible' : out.uncertainty.length ? 'unresolved' : 'eligible';
    endpoints[endpoint] = out;
  }
  return { endpoints, noop };
}
/** Capture ORIGINAL bytes exactly once independently of the accepted candidate. */
export async function captureBaselineR3({ originalRenderRequest, originalSourceSha256, plan: inputPlan, sessionFactory,
  calibration, environment, policy: inputPolicy = {}, clock, signal, runEvaluation = runEvaluationR3 } = {}) {
  source(originalRenderRequest, originalSourceSha256);
  if (!validHash(originalSourceSha256)) fail('R3_EXPLICIT_ORIGINAL_HASH_REQUIRED');
  const plan = planRequired(inputPlan), policy = validateMeasurementPolicyR3(inputPolicy), rules = baselineRules(plan);
  // Snapshots prevent caller mutation during the awaited acquisition from changing the binding.
  const inputBinding = freeze(copy({ plan, calibration, environment, policy }));
  const request = copy(originalRenderRequest);
  const run = await runEvaluation({ renderRequest: request, plan, sessionFactory, calibration, environment,
    policy, ruleSets: rules, mode: 'baseline', clock, signal });
  const checks = auditRun(run, { plan, sourceSha256: originalSourceSha256, policy, rules, calibration, environment });
  if (!isDeepStrictEqual(inputBinding, { plan, calibration, environment, policy }) || source(request) !== originalSourceSha256) fail('R3_INPUT_MUTATED_DURING_RUN');
  const facts = Object.fromEntries(plan.expectedKeys.map(key => [key, available(checks.get(key))]));
  const screened = eligibility(plan, checks, facts, run);
  const bundle = freeze(copy({ schemaVersion: BASELINE_SCHEMA_VERSION_R3, originalSourceSha256,
    originalRunId: run.runId, planDigest: plan.planDigest, expectedKeys: plan.expectedKeys,
    facts, ...screened, endpointRequirements: endpointRequirements(plan), run, provenance: { environmentDigest: run.environmentDigest, calibrationBindingDigest: run.calibrationBindingDigest,
      measurementPolicy: policy, sourceSha256: originalSourceSha256, runId: run.runId } }));
  brands.set(bundle, { binding: inputBinding, run: bundle.run, checks: new Map(bundle.run.checks.map(check => [check.key, check])) });
  return bundle;
}
function afterRules(plan, bundle) {
  const rules = Object.fromEntries(plan.expectedKeys.map(key => [key, { capture: capture() }]));
  const req = plan.requirements;
  const active = endpoint => bundle.endpoints[endpoint].eligibility === 'eligible';
  if (active('G')) for (const item of req.originals) rules[item.key].G = absolute(item.expect);
  for (const endpoint of ['R', 'G']) {
    if (!active(endpoint)) continue;
    for (const item of req.targets) rules[item.key][endpoint] = absolute(item.expect);
    for (const item of req.protections) {
      const id = endpoint === 'R' ? 'R' : 'GProtection';
      const baseline = copy(bundle.facts[item.key].fact);
      // G keeps the absolute original requirement in addition to preservation.
      rules[item.key][id] = { cmp: 'r3', rule: { kind: item.mode, baseline, tolerance: item.tolerance,
        ...(item.mode === 'nonWorsening' ? { expect: copy(item.expect) } : {}) } };
    }
  }
  for (const item of req.reachability) rules[item.key].reachability = item.mode === 'available' ? capture() : absolute(item.expect);
  return freeze(rules);
}
function classifyEndpoint(endpoint, plan, checks, rules, run, baselineRun) {
  const output = { eligibility: 'eligible', classification: null, reasons: [], uncertainty: [] };
  const ids = endpoint === 'R' ? ['R'] : ['G', 'GProtection'];
  for (const key of plan.expectedKeys) for (const id of ids) if (own(rules[key], id)) addVerdict(output, checks.get(key), id, key, id);
  for (const item of plan.requirements.reachability) {
    if (item.mode === 'predicate') addVerdict(output, checks.get(item.key), 'reachability', item.key, 'reachability');
    else if (available(checks.get(item.key)).status !== 'available') output.uncertainty.push({ key: item.key, reason: 'required-after-reachability-unavailable' });
  }
  const runtime = runtimeState(run, plan, endpoint);
  output.uncertainty.push(...runtime.uncertainty);
  output.reasons.push(...runtimeDelta(runtime, endpoint === 'R' ? runtimeState(baselineRun, plan, endpoint) : { confirmed: [] }));
  output.classification = output.reasons.length ? 'W' : output.uncertainty.length ? 'U_A' : 'S';
  return output;
}
/** One private candidate run for the union of precomputed R/G eligibility masks. */
export async function evaluateAcceptedR3({ candidateRenderRequest, originalSourceSha256, baselineBundle, acceptanceLock,
  plan: inputPlan, sessionFactory, calibration, environment, policy: inputPolicy = {}, clock, signal,
  runEvaluation = runEvaluationR3 } = {}) {
  const candidateSourceSha256 = source(candidateRenderRequest);
  validateJsonR3(acceptanceLock);
  if (!acceptanceLock || !frozen(acceptanceLock) || typeof acceptanceLock.id !== 'string' || !acceptanceLock.id
      || acceptanceLock.status !== 'accepted' || acceptanceLock.lockedBeforePrivateEvaluation !== true
      || acceptanceLock.candidateSourceSha256 !== candidateSourceSha256 || acceptanceLock.originalSourceSha256 !== originalSourceSha256) fail('R3_VALID_IMMUTABLE_ACCEPTANCE_LOCK_REQUIRED');
  const baseline = brands.get(baselineBundle);
  if (!baseline || !frozen(baselineBundle)) fail('R3_OPAQUE_BASELINE_REQUIRED');
  if (!validHash(originalSourceSha256) || baselineBundle.originalSourceSha256 !== originalSourceSha256) fail('R3_BASELINE_ORIGINAL_SOURCE_MISMATCH');
  const plan = planRequired(inputPlan), policy = validateMeasurementPolicyR3(inputPolicy);
  const inputBinding = { plan, calibration, environment, policy };
  if (!isDeepStrictEqual(baseline.binding, inputBinding)) fail('R3_BASELINE_INPUT_BINDING_MISMATCH');
  const sameSource = candidateSourceSha256 === originalSourceSha256;
  const common = { schemaVersion: ACCEPTED_EVALUATION_SCHEMA_VERSION_R3, originalSourceSha256, candidateSourceSha256,
    acceptanceLockId: acceptanceLock.id, acceptanceLock: copy(acceptanceLock), sameSource, noop: baselineBundle.noop,
    sourceChange: sameSource ? 'no-source-change' : 'source-changed', expectedKeys: copy(plan.expectedKeys),
    endpointRequirements: copy(baselineBundle.endpointRequirements),
    provenance: { baselineRunId: baseline.run.runId, planDigest: plan.planDigest,
      environmentDigest: baseline.run.environmentDigest, calibrationBindingDigest: baseline.run.calibrationBindingDigest,
      measurementPolicy: policy }, privateEvaluation: true, methodFeedback: false };
  if (!Object.values(baselineBundle.endpoints).some(endpoint => endpoint.eligibility === 'eligible')) {
    return freeze({ ...common, endpoints: copy(baselineBundle.endpoints), afterExecution: 'not-executed-no-eligible-endpoint',
      checks: plan.expectedKeys.map(key => ({ key, notMeasured: { reason: 'no-eligible-endpoint' } })), actions: [], errors: [] });
  }
  const rules = afterRules(plan, baselineBundle), request = copy(candidateRenderRequest);
  const run = await runEvaluation({ renderRequest: request, plan, sessionFactory, calibration, environment,
    policy, ruleSets: rules, mode: 'accepted', clock, signal });
  const checks = auditRun(run, { plan, sourceSha256: candidateSourceSha256, policy, rules, baseline, calibration, environment });
  if (!isDeepStrictEqual(baseline.binding, inputBinding) || source(request) !== candidateSourceSha256) fail('R3_INPUT_MUTATED_DURING_RUN');
  const endpoints = Object.fromEntries(['R', 'G'].map(endpoint => [endpoint, baselineBundle.endpoints[endpoint].eligibility === 'eligible'
    ? classifyEndpoint(endpoint, plan, checks, rules, run, baseline.run) : copy(baselineBundle.endpoints[endpoint])]));
  return freeze(copy({ ...common, endpoints, afterExecution: 'executed-once-shared-endpoints', checks: run.checks,
    actions: run.actions, errors: run.errors, scenarios: run.scenarios, receipts: run.receipts, runtimeEvidence: run.runtimeEvidence ?? null,
    provenance: { ...common.provenance, candidateRunId: run.runId } }));
}

/**
 * Pure replay audit for externally hash-anchored persisted JSON receipts.
 * This neither authenticates file/source bytes nor creates an executable baseline brand.
 * The caller MUST verify independent expected file hashes before using the returned rows.
 */
export function auditEvaluationReceiptR3({ baselineBundle, evaluation, plan: inputPlan, calibration,
  environment, policy: inputPolicy = {} } = {}) {
  validateJsonR3(baselineBundle);
  validateJsonR3(evaluation);
  const plan = planRequired(inputPlan), policy = validateMeasurementPolicyR3(inputPolicy);
  if (baselineBundle?.schemaVersion !== BASELINE_SCHEMA_VERSION_R3
      || !validHash(baselineBundle.originalSourceSha256)) fail('R3_BASELINE_RECEIPT_REQUIRED');
  const originalSourceSha256 = baselineBundle.originalSourceSha256;
  const originalRun = baselineBundle.run;
  const originalChecks = auditRun(originalRun, { plan, sourceSha256: originalSourceSha256,
    policy, rules: baselineRules(plan), calibration, environment });
  const facts = Object.fromEntries(plan.expectedKeys.map(key => [key, available(originalChecks.get(key))]));
  const screened = eligibility(plan, originalChecks, facts, originalRun);
  const expectedBaseline = {
    schemaVersion: BASELINE_SCHEMA_VERSION_R3, originalSourceSha256, originalRunId: originalRun.runId,
    planDigest: plan.planDigest, expectedKeys: copy(plan.expectedKeys), facts, ...screened,
    endpointRequirements: endpointRequirements(plan), run: originalRun,
    provenance: { environmentDigest: originalRun.environmentDigest, calibrationBindingDigest: originalRun.calibrationBindingDigest,
      measurementPolicy: policy, sourceSha256: originalSourceSha256, runId: originalRun.runId },
  };
  if (!isDeepStrictEqual(baselineBundle, expectedBaseline)) fail('R3_BASELINE_RECEIPT_REPLAY_MISMATCH');
  if (evaluation?.schemaVersion !== ACCEPTED_EVALUATION_SCHEMA_VERSION_R3
      || evaluation.originalSourceSha256 !== originalSourceSha256 || !validHash(evaluation.candidateSourceSha256)) fail('R3_ACCEPTED_RECEIPT_SOURCE_MISMATCH');
  const candidateSourceSha256 = evaluation.candidateSourceSha256, acceptanceLock = evaluation.acceptanceLock;
  // Serialization cannot preserve Object.freeze; the independently anchored lock assertion is checked,
  // while the live entry point remains strictly immutable-lock-only.
  if (!acceptanceLock || typeof acceptanceLock.id !== 'string' || !acceptanceLock.id
      || acceptanceLock.status !== 'accepted' || acceptanceLock.lockedBeforePrivateEvaluation !== true
      || acceptanceLock.candidateSourceSha256 !== candidateSourceSha256 || acceptanceLock.originalSourceSha256 !== originalSourceSha256) fail('R3_ACCEPTANCE_RECEIPT_LOCK_MISMATCH');
  const sameSource = candidateSourceSha256 === originalSourceSha256;
  const common = { schemaVersion: ACCEPTED_EVALUATION_SCHEMA_VERSION_R3, originalSourceSha256, candidateSourceSha256,
    acceptanceLockId: acceptanceLock.id, acceptanceLock: copy(acceptanceLock), sameSource, noop: screened.noop,
    sourceChange: sameSource ? 'no-source-change' : 'source-changed', expectedKeys: copy(plan.expectedKeys),
    endpointRequirements: copy(expectedBaseline.endpointRequirements),
    provenance: { baselineRunId: originalRun.runId, planDigest: plan.planDigest,
      environmentDigest: originalRun.environmentDigest, calibrationBindingDigest: originalRun.calibrationBindingDigest,
      measurementPolicy: policy }, privateEvaluation: true, methodFeedback: false };
  let reconstructed;
  if (!Object.values(screened.endpoints).some(endpoint => endpoint.eligibility === 'eligible')) {
    reconstructed = { ...common, endpoints: copy(screened.endpoints), afterExecution: 'not-executed-no-eligible-endpoint',
      checks: plan.expectedKeys.map(key => ({ key, notMeasured: { reason: 'no-eligible-endpoint' } })), actions: [], errors: [] };
  } else {
    const run = { schemaVersion: 'v04-evaluation-run-r3-1', runId: evaluation.provenance?.candidateRunId,
      sourceSha256: candidateSourceSha256, planDigest: evaluation.provenance?.planDigest,
      environmentDigest: evaluation.provenance?.environmentDigest, calibrationBindingDigest: evaluation.provenance?.calibrationBindingDigest,
      measurementPolicy: evaluation.provenance?.measurementPolicy, checks: evaluation.checks,
      actions: evaluation.actions, errors: evaluation.errors, scenarios: evaluation.scenarios,
      receipts: evaluation.receipts, runtimeEvidence: evaluation.runtimeEvidence };
    const rules = afterRules(plan, expectedBaseline);
    const checks = auditRun(run, { plan, sourceSha256: candidateSourceSha256, policy, rules,
      baseline: { run: originalRun, checks: originalChecks }, calibration, environment });
    const endpoints = Object.fromEntries(['R', 'G'].map(endpoint => [endpoint, screened.endpoints[endpoint].eligibility === 'eligible'
      ? classifyEndpoint(endpoint, plan, checks, rules, run, originalRun) : copy(screened.endpoints[endpoint])]));
    reconstructed = { ...common, endpoints, afterExecution: 'executed-once-shared-endpoints', checks: run.checks,
      actions: run.actions, errors: run.errors, scenarios: run.scenarios, receipts: run.receipts,
      runtimeEvidence: run.runtimeEvidence ?? null, provenance: { ...common.provenance, candidateRunId: run.runId } };
  }
  if (!isDeepStrictEqual(evaluation, reconstructed)) fail('R3_ACCEPTED_RECEIPT_REPLAY_MISMATCH');
  return freeze(copy({ ...reconstructed, schemaVersion: 'v04-evaluation-receipt-audit-r3-1',
    baselineEndpoints: screened.endpoints, audited: true, externalHashAnchorRequired: true }));
}
