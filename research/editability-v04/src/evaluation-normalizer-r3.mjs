// Node-only persistence/normalization. Never executes source, callbacks, or a browser.
import { createHash } from 'node:crypto';
import { constants, lstatSync, openSync, closeSync, fstatSync, readFileSync, writeFileSync, fsyncSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { classifyMeasurementR3 } from './measurement-records-r3.mjs';

export const EVALUATION_RECEIPT_SCHEMA_R3 = 'v04-independent-evaluation-receipt-r3-1';
export const EVALUATION_NORMALIZER_VERSION_R3 = 'v04-evaluation-normalizer-r3-1';
export const EVALUATION_BINDING_R3 = Object.freeze({
  evaluationSchema: 'v04-accepted-evaluation-r3-1', normalizerVersion: EVALUATION_NORMALIZER_VERSION_R3,
});
const endpoints = ['R', 'G'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const key = (...parts) => JSON.stringify(parts);
function freeze(value) {
  if (value && typeof value === 'object') { for (const part of Object.values(value)) freeze(part); Object.freeze(value); }
  return value;
}
// Reject anything JSON would silently omit/coerce or invoke (getters/toJSON).
// Shared data is legal; cycles, sparse arrays, symbols and non-data prototypes are not.
function jsonData(value, stack = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return;
  if (!value || typeof value !== 'object' || stack.has(value)) fail('R3_EXPLICIT_JSON_DATA_REQUIRED');
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) fail('R3_EXPLICIT_JSON_DATA_REQUIRED');
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (array && keys.length !== value.length + 1) fail('R3_EXPLICIT_JSON_DATA_REQUIRED');
  stack.add(value);
  for (const name of keys) {
    if (array && name === 'length') continue;
    const d = descriptors[name];
    if (typeof name !== 'string' || !d.enumerable || !Object.hasOwn(d, 'value')
        || (array && !/^(0|[1-9][0-9]*)$/.test(name))) fail('R3_EXPLICIT_JSON_DATA_REQUIRED');
    jsonData(d.value, stack);
  }
  stack.delete(value);
}
function snapshot(value) { jsonData(value); return JSON.parse(JSON.stringify(value)); }
function uniqueKeys(values) {
  if (!Array.isArray(values) || values.some(v => !nonempty(v)) || new Set(values).size !== values.length) fail('R3_EXPECTED_KEYS_REQUIRED_UNIQUE');
}
/** Plan before candidate evaluation; original private checkpoint keys remain opaque. */
export function endpointExpectedKeysR3(baselineBundle) {
  jsonData(baselineBundle);
  uniqueKeys(baselineBundle?.expectedKeys);
  const result = {};
  for (const endpoint of endpoints) {
    const req = baselineBundle?.endpointRequirements?.[endpoint];
    if (!req || req.qualificationRequired !== true) fail('R3_ENDPOINT_REQUIREMENTS_REQUIRED');
    uniqueKeys(req.checkKeys); uniqueKeys(req.runtimeRunKeys);
    if (req.checkKeys.some(k => !baselineBundle.expectedKeys.includes(k))) fail('R3_ENDPOINT_KEYS_MISMATCH');
    result[endpoint] = [key('qualification', endpoint), ...req.checkKeys.map(k => key('check', k)),
      ...req.runtimeRunKeys.map(k => key('runtime', endpoint, k)), key('audit', endpoint)];
  }
  return freeze(result);
}
const slotFields = ['sourceId', 'taskId', 'method', 'slotId', 'originalSourceSha256', 'candidateSourceSha256', 'acceptanceLockId'];
function sourceBinding(evaluation) {
  return { originalSourceSha256: evaluation.originalSourceSha256, candidateSourceSha256: evaluation.candidateSourceSha256,
    acceptanceLockId: evaluation.acceptanceLockId };
}
function validateSlot(slot, sources) {
  if (slot === null) return;
  if (!slot || !isDeepStrictEqual(Object.keys(slot).sort(), [...slotFields].sort())
      || slotFields.some(field => !nonempty(slot[field]))
      || !sha(slot.originalSourceSha256) || !sha(slot.candidateSourceSha256)) fail('R3_SLOT_BINDING_REQUIRED');
  for (const field of Object.keys(sources)) if (slot[field] !== sources[field]) fail('R3_SLOT_SOURCE_OR_LOCK_MISMATCH');
}
async function audit(data) {
  // Dynamic import keeps this module independent of evaluator execution and fails closed if the auditor is unavailable.
  const { auditEvaluationReceiptR3 } = await import('./baseline-r3.mjs');
  if (typeof auditEvaluationReceiptR3 !== 'function') fail('R3_RECEIPT_AUDITOR_UNAVAILABLE');
  return auditEvaluationReceiptR3(data);
}
// Executor supplies an existing, privately controlled directory; this is not an archiver.
// Reject lexical traversal, links/junctions in every ancestor, ADS/device/UNC paths,
// and nonregular destinations. No mkdir, realpath-following, or overwrite fallback.
// Synchronous checks and descriptor identity checks narrow TOCTOU windows; parent directory
// ownership must still prevent hostile concurrent OS-level renames (Node has no portable openat).
function checkedPath(input, existing) {
  if (!nonempty(input) || input.includes('\0') || !path.isAbsolute(input)
      || input.split(/[\\/]/).some(part => part === '.' || part === '..')
      || (process.platform === 'win32' && (/^[\\/]{2}/.test(input) || input.slice(2).includes(':')
        || input.split(/[\\/]/).slice(1).some(part => /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))))) fail('R3_UNSAFE_RECEIPT_PATH');
  const full = path.normalize(input), root = path.parse(full).root;
  let current = root;
  const dirs = [root];
  for (const part of path.relative(root, path.dirname(full)).split(path.sep).filter(Boolean)) { current = path.join(current, part); dirs.push(current); }
  const ancestry = dirs.map(dir => {
    const stat = lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('R3_UNSAFE_RECEIPT_ANCESTRY');
    return { path: dir, dev: stat.dev, ino: stat.ino };
  });
  let stat;
  try { stat = lstatSync(full); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (stat && (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1)) fail('R3_UNSAFE_RECEIPT_DESTINATION');
  if (existing && !stat) fail('R3_RECEIPT_NOT_FOUND');
  return { full, ancestry, stat };
}
function verifyPath(checked, fd) {
  const actual = checkedPath(checked.full, true), opened = fstatSync(fd);
  if (!opened.isFile() || opened.nlink !== 1 || actual.stat.dev !== opened.dev || actual.stat.ino !== opened.ino
      || !isDeepStrictEqual(checked.ancestry, actual.ancestry)
      || (checked.stat && (checked.stat.dev !== opened.dev || checked.stat.ino !== opened.ino))) fail('R3_RECEIPT_PATH_CHANGED');
}
function descriptor(full, bytes, data) {
  return freeze({ schemaVersion: EVALUATION_RECEIPT_SCHEMA_R3, path: full, sha256: hash(bytes), bytes: bytes.length,
    ...EVALUATION_BINDING_R3, sourceBinding: snapshot(data.sourceBinding), slotBinding: snapshot(data.slotBinding) });
}
/** Audit full evidence, then exclusively persist exact UTF-8 JSON bytes. No costs are invented. */
export async function persistEvaluationReceiptR3({ receiptPath, baselineBundle, evaluation, plan, calibration, environment, policy, slotBinding = null } = {}) {
  const data = snapshot({ schemaVersion: EVALUATION_RECEIPT_SCHEMA_R3, baselineBundle, evaluation, plan, calibration, environment, policy, slotBinding });
  await audit(data);
  endpointExpectedKeysR3(data.baselineBundle);
  data.sourceBinding = sourceBinding(data.evaluation);
  validateSlot(data.slotBinding, data.sourceBinding);
  // Frozen receipt encoding: two-space JSON indentation, exactly one final LF, UTF-8 without BOM.
  const bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
  const checked = checkedPath(receiptPath, false);
  const fd = openSync(checked.full, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { verifyPath(checked, fd); writeFileSync(fd, bytes); fsyncSync(fd); verifyPath(checked, fd); }
  finally { closeSync(fd); }
  return descriptor(checked.full, bytes, data);
}
function foldedStatus(confirmed, unknown, missing = false) {
  return confirmed ? 'confirmed-violation' : unknown ? (missing ? 'notMeasured' : 'unknown') : 'pass';
}
function runtimeReason(reason) { return reason.reason?.startsWith('runtime-') || reason.reason === 'new-or-increased-confirmed-runtime-error'; }
function appliesToRun(reason, runKey) {
  if (nonempty(reason.runKey)) return reason.runKey === runKey;
  if (Array.isArray(reason.runKeys)) return reason.runKeys.includes(runKey);
  if (nonempty(reason.event?.runKey)) return reason.event.runKey === runKey;
  return true; // an unscoped audit gap affects every relevant runtime row
}
function rowsFor(endpoint, data, audited, expected) {
  const req = data.baselineBundle.endpointRequirements[endpoint], verdict = audited.endpoints[endpoint];
  if (verdict.eligibility !== 'eligible') return expected.map(k => ({ key: k, status: 'notMeasured' }));
  const rows = [{ key: key('qualification', endpoint), status: 'pass' }];
  for (const originalKey of req.checkKeys) {
    const check = audited.checks.find(c => c.key === originalKey);
    const ids = endpoint === 'R' ? ['R'] : ['G', 'GProtection'];
    const reach = data.plan.requirements.reachability.find(item => item.key === originalKey);
    if (reach?.mode === 'predicate') ids.push('reachability');
    const results = ids.filter(id => check?.measurements?.[id]).map(id => classifyMeasurementR3(check.measurements[id]));
    // The auditor owns reachability availability semantics and all endpoint reasons.
    const confirmed = results.some(r => r.confirmed.length) || verdict.reasons.some(r => r.key === originalKey);
    const unknown = !check || !!check.notMeasured || results.some(r => r.unresolved.length)
      || verdict.uncertainty.some(r => r.key === originalKey);
    rows.push({ key: key('check', originalKey), status: foldedStatus(confirmed, unknown, !check || !!check.notMeasured) });
  }
  for (const runKey of req.runtimeRunKeys) {
    const confirmed = verdict.reasons.some(r => runtimeReason(r) && appliesToRun(r, runKey));
    const unknown = verdict.uncertainty.some(r => runtimeReason(r) && appliesToRun(r, runKey));
    rows.push({ key: key('runtime', endpoint, runKey), status: foldedStatus(confirmed, unknown) });
  }
  const unattributedW = verdict.reasons.some(r => !req.checkKeys.includes(r.key) && !runtimeReason(r));
  // A W row cannot encode its own simultaneous unknown. Fixed audit row retains that
  // uncertainty (also all unkeyed audit gaps), rather than rewriting W to U_A.
  rows.push({ key: key('audit', endpoint), status: foldedStatus(unattributedW, verdict.uncertainty.length > 0) });
  const classification = rows.some(r => r.status === 'confirmed-violation') ? 'W'
    : rows.some(r => ['unknown', 'notMeasured'].includes(r.status)) ? 'U_A' : 'S';
  const unknown = rows.some(r => ['unknown', 'notMeasured'].includes(r.status));
  if (classification !== verdict.classification || unknown !== (verdict.uncertainty.length > 0)
      || !isDeepStrictEqual(rows.map(r => r.key), expected)) fail('R3_NORMALIZER_AUDIT_DISAGREEMENT');
  return rows;
}
/** Re-read actual bytes, require an external hash anchor, replay the independent audit. */
export async function normalizeEvaluationReceiptR3({ receiptPath, expectedSha256, expectedBytes, expectedSlotBinding, expectedAcceptanceLockId } = {}) {
  if (!sha(expectedSha256)) fail('R3_EXTERNAL_RECEIPT_HASH_REQUIRED');
  if (expectedBytes !== undefined && (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1)) fail('R3_INVALID_EXPECTED_BYTES');
  if (expectedAcceptanceLockId !== undefined && !nonempty(expectedAcceptanceLockId)) fail('R3_INVALID_EXPECTED_LOCK');
  const expectedSlot = expectedSlotBinding === undefined ? undefined : snapshot(expectedSlotBinding);
  const checked = checkedPath(receiptPath, true);
  const fd = openSync(checked.full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let bytes;
  try { verifyPath(checked, fd); bytes = readFileSync(fd); verifyPath(checked, fd); }
  finally { closeSync(fd); }
  if (hash(bytes) !== expectedSha256) fail('R3_RECEIPT_HASH_MISMATCH');
  if (expectedBytes !== undefined && bytes.length !== expectedBytes) fail('R3_RECEIPT_BYTES_MISMATCH');
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  jsonData(data);
  const fields = ['schemaVersion', 'baselineBundle', 'evaluation', 'plan', 'calibration', 'environment', 'policy', 'slotBinding', 'sourceBinding'];
  if (data.schemaVersion !== EVALUATION_RECEIPT_SCHEMA_R3 || !isDeepStrictEqual(Object.keys(data).sort(), fields.sort())) fail('R3_RECEIPT_SCHEMA_MISMATCH');
  const audited = await audit(data);
  if (!isDeepStrictEqual(data.sourceBinding, sourceBinding(data.evaluation))) fail('R3_RECEIPT_SOURCE_BINDING_MISMATCH');
  validateSlot(data.slotBinding, data.sourceBinding);
  if (expectedSlot !== undefined) {
    validateSlot(expectedSlot, data.sourceBinding);
    if (!isDeepStrictEqual(expectedSlot, data.slotBinding)) fail('R3_EXTERNAL_SLOT_BINDING_MISMATCH');
  }
  if (expectedAcceptanceLockId !== undefined && expectedAcceptanceLockId !== data.sourceBinding.acceptanceLockId) fail('R3_EXTERNAL_LOCK_MISMATCH');
  const expectedKeys = endpointExpectedKeysR3(data.baselineBundle), result = {}, outcomes = {};
  for (const endpoint of endpoints) {
    const verdict = audited.endpoints[endpoint], eligible = verdict.eligibility === 'eligible';
    result[endpoint] = rowsFor(endpoint, data, audited, expectedKeys[endpoint]);
    outcomes[endpoint] = { confirmedViolation: eligible && verdict.reasons.length > 0,
      unknown: eligible && verdict.uncertainty.length > 0, allRequiredPassed: eligible && verdict.classification === 'S',
      binding: { ...EVALUATION_BINDING_R3, evidenceHash: expectedSha256, classification: eligible ? verdict.classification : null } };
  }
  result.independentEvaluation = { evaluationBinding: { ...EVALUATION_BINDING_R3 }, outcomes,
    receipt: descriptor(checked.full, bytes, data) };
  return freeze(result);
}