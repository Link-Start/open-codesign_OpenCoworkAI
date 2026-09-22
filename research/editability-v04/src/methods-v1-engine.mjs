import { createHash } from 'node:crypto';

const hash = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const reject = (reason) => ({ status: 'rejected', reason });
const path = 'App.jsx';
const scopeReasons = new Set(['non-direct-source', 'custom-component-ancestor']);
const attributes = new Set(['title', 'placeholder', 'alt']);
const styles = new Set(['color', 'backgroundColor', 'fontSize', 'gap', 'padding', 'borderRadius', 'maxWidth']);
const validationSource = 'function App(){return <div title="x" placeholder="x" alt="x" style={{color:"red",backgroundColor:"red",fontSize:1,gap:1,padding:1,borderRadius:1,maxWidth:1}}>x</div>}';
const name = (node) => ['Identifier', 'JSXIdentifier'].includes(node?.type) ? node.name : node?.type === 'StringLiteral' ? node.value : undefined;
const string = (node) => node?.type === 'StringLiteral' ? node.value : undefined;
const attributeValue = (node) => string(node?.type === 'JSXExpressionContainer' ? node.expression : node);
const host = (node) => node?.type === 'JSXElement' && /^[a-z]/.test(name(node.openingElement.name) ?? '');
const targetId = (node) => `${node.start}:${node.end}`;
const equalPatch = (a, b) => a && b && ['start', 'end', 'expectedText', 'replacement'].every((key) => a[key] === b[key]);

function walk(node, ancestors, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, ancestors);
  const next = node.type === 'JSXElement' ? [...ancestors, node] : ancestors;
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'extra', 'tokens', 'comments'].includes(key) || key.endsWith('Comments')) continue;
    if (Array.isArray(value)) for (const child of value) walk(child, next, visit);
    else if (value && typeof value === 'object') walk(value, next, visit);
  }
}

function foldText(value) {
  const lines = value.split(/\r\n|\n|\r/);
  let last = 0;
  lines.forEach((line, i) => { if (/[^ \t]/.test(line)) last = i; });
  return lines.map((line, i) => {
    let part = line.replace(/\t/g, ' ');
    if (i > 0) part = part.replace(/^ +/, '');
    if (i < lines.length - 1) part = part.replace(/ +$/, '');
    return part ? part + (i !== last ? ' ' : '') : '';
  }).join('');
}

function textField(element) {
  const meaningful = element.children.filter((child) => child.type === 'JSXText'
    ? foldText(child.value).length > 0
    : !(child.type === 'JSXExpressionContainer' && child.expression.type === 'JSXEmptyExpression'));
  if (meaningful.length !== 1) return undefined;
  const node = meaningful[0];
  const value = node.type === 'JSXText' ? foldText(node.value)
    : node.type === 'JSXExpressionContainer' ? string(node.expression) : undefined;
  return value === undefined ? undefined : { node, value };
}

// Stock scope exclusions hide field details: independently retain opening safety there.
function openingFailure(element) {
  const opening = element.openingElement;
  const tag = name(opening.name);
  if (tag.includes('-') || ['script', 'style', 'iframe', 'object', 'embed', 'base', 'link', 'meta'].includes(tag)) return 'unsupported-host';
  const seen = new Set();
  for (const attribute of opening.attributes) {
    const key = name(attribute.name);
    if (attribute.type !== 'JSXAttribute' || !key) return 'spread-attributes';
    if (seen.has(key)) return 'duplicate-attributes';
    seen.add(key);
    if (/^data-(?:codesign|ocd)(?:-|$)/i.test(key)) return 'reserved-provenance';
    if (key === 'children') return 'children-prop';
    if (key === 'is' || key === 'contentEditable') return 'mutable-host';
  }
  return undefined;
}

function extractField(element, operation) {
  if (operation.kind === 'set-text') return textField(element);
  if (operation.kind === 'set-attribute') {
    if (!attributes.has(operation.name)) return undefined;
    const attribute = element.openingElement.attributes.find((item) => name(item.name) === operation.name);
    const value = attributeValue(attribute?.value);
    return value === undefined ? undefined : { node: attribute.value, value: attribute.value.type === 'StringLiteral' ? value.replace(/\n\s+/g, ' ') : value };
  }
  if (operation.kind !== 'set-style' || !styles.has(operation.property)) return undefined;
  const attribute = element.openingElement.attributes.find((item) => name(item.name) === 'style');
  const object = attribute?.value?.type === 'JSXExpressionContainer' ? attribute.value.expression : undefined;
  if (object?.type !== 'ObjectExpression') return undefined;
  const seen = new Set();
  for (const item of object.properties) {
    const key = name(item.key);
    if (item.type !== 'ObjectProperty' || item.computed || item.shorthand || key === undefined || seen.has(key)) return undefined;
    seen.add(key);
  }
  const node = object.properties.find((item) => name(item.key) === operation.property)?.value;
  const value = node?.type === 'NumericLiteral' && Number.isFinite(node.value) ? String(node.value) : string(node);
  return value === undefined ? undefined : { node, value };
}

function matches(element, locator) {
  if (name(element.openingElement.name) !== locator.tagName) return false;
  if (locator.id !== undefined) {
    const id = element.openingElement.attributes.find((item) => name(item.name) === 'id');
    if (attributeValue(id?.value) !== locator.id) return false;
  }
  return locator.text === undefined || textField(element)?.value === locator.text;
}

/** Research-only, synchronous and in-memory. No filesystem, mappings or execution. */
export function createEngineV1({ parse, stockEngine }) {
  if (typeof parse !== 'function' || typeof stockEngine?.analyzeSourceEdit !== 'function' || typeof stockEngine?.planSourceEdit !== 'function') {
    throw new TypeError('Inject Babel parse and stock analyzeSourceEdit/planSourceEdit functions.');
  }
  const analyze = (source) => stockEngine.analyzeSourceEdit({ path, source });
  const plan = (source, id, operation) => stockEngine.planSourceEdit({ path, source, expectedSourceHash: hash(source), targetId: id, operation, scope: 'source-definition' });
  const validation = analyze(validationSource);
  if (validation.status !== 'ready' || validation.targets.length !== 1) throw new Error('Stock validation fixture is not supported.');
  const validateOperation = (operation) => plan(validationSource, validation.targets[0].id, operation);
  const parseSource = (source) => parse(source, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false });

  function build(request, useProvenance) {
    if (!request || typeof request.source !== 'string') return reject('invalid-source');
    if (request.scope !== 'source-definition') return reject('invalid-scope');
    if (request.sourceHash !== hash(request.source)) return reject('stale-source');
    const locator = request.locator;
    if (!locator || typeof locator.tagName !== 'string' || !/^[a-z]/.test(locator.tagName)
      || (locator.id !== undefined && typeof locator.id !== 'string')
      || (locator.text !== undefined && typeof locator.text !== 'string')) return reject('invalid-locator');
    // Always run original stock safety before considering a structural exclusion.
    const analysis = analyze(request.source);
    if (analysis.status !== 'ready') return reject(analysis.reason ?? 'stock-analysis-failed');
    if (analysis.sourceHash !== request.sourceHash) return reject('stock-source-mismatch');
    const checked = validateOperation(request.operation);
    if (checked.status !== 'applied') return reject(checked.reason ?? 'invalid-operation');
    let ast;
    try { ast = parseSource(request.source); } catch { return reject('parse-error'); }
    const provenance = useProvenance ? request.provenance : undefined;
    if (useProvenance && !provenance) return reject('provenance-required');
    if (provenance && (provenance.sourceHash !== request.sourceHash || !/^\d+:\d+$/.test(provenance.targetId))) return reject('stale-provenance');
    const found = [];
    walk(ast, [], (element, ancestors) => {
      if (host(element) && matches(element, locator) && (!provenance || targetId(element) === provenance.targetId)) found.push({ element, ancestors });
    });
    if (found.length !== 1) return reject(found.length ? 'ambiguous-target' : 'target-not-found');
    const { element, ancestors } = found[0];
    for (const boundary of [...ancestors.filter(host), element]) {
      const reason = openingFailure(boundary);
      if (reason) return reject(reason);
    }
    const field = extractField(element, request.operation);
    if (!field) return reject('unsupported-field');
    if (field.value.length > (request.operation.kind === 'set-style' ? 1000 : 100000)) return reject('literal-too-large');
    const patch = { start: field.node.start, end: field.node.end, expectedText: request.source.slice(field.node.start, field.node.end), replacement: checked.patch.replacement };
    const content = request.source.slice(0, patch.start) + patch.replacement + request.source.slice(patch.end);
    try { parseSource(content); } catch { return reject('reparse-failed'); }
    const id = targetId(element);
    const stockTarget = analysis.targets.find((target) => target.id === id);
    if (!stockTarget) return reject('stock-target-missing');
    const structural = stockTarget.unsupported.some((item) => item.field === 'target' && scopeReasons.has(item.reason));
    const otherTargetFailure = stockTarget.unsupported.find((item) => item.field === 'target' && !scopeReasons.has(item.reason));
    if (otherTargetFailure) return reject(otherTargetFailure.reason);
    // Direct-target drift is not a scope benefit and must not survive SCOPE_OFF.
    if (!structural) {
      const planned = plan(request.source, id, request.operation);
      if (planned.status !== 'applied') return reject(planned.reason ?? 'stock-plan-failed');
      if (!equalPatch(patch, planned.patch) || content !== planned.content || hash(content) !== planned.sourceHash) return reject('stock-patch-mismatch');
    }
    return {
      status: 'candidate', patches: [patch], content, sourceHash: hash(content), candidateHash: hash(content), targetId: id,
      evidence: { originalSourceHash: request.sourceHash, selection: provenance ? 'exact-provenance-span' : 'unprivileged-static-locator', fieldKind: request.operation.kind, safety: 'stock-original-analysis-and-stock-value-plan', originalSpan: { start: element.start, end: element.end } },
    };
  }

  const candidate = (request) => build(request, true);
  // Do not even read provenance or mapping getters on this path.
  const fallback = (request) => build(request, false);
  function guard(request, supplied) {
    if (supplied?.status !== 'candidate') return { pass: false, reason: 'no-candidate' };
    if (typeof request?.source !== 'string' || request.sourceHash !== hash(request.source)) return { pass: false, reason: 'stale-source' };
    if (request.scope !== 'source-definition') return { pass: false, reason: 'invalid-scope' };
    const patch = supplied.patches?.[0];
    if (supplied.patches?.length !== 1 || !Number.isInteger(patch?.start) || !Number.isInteger(patch?.end)
      || patch.start < 0 || patch.end <= patch.start || patch.end > request.source.length || typeof patch.replacement !== 'string'
      || request.source.slice(patch.start, patch.end) !== patch.expectedText || typeof supplied.content !== 'string'
      || request.source.slice(0, patch.start) + patch.replacement + request.source.slice(patch.end) !== supplied.content
      || hash(supplied.content) !== supplied.sourceHash || supplied.sourceHash !== supplied.candidateHash) return { pass: false, reason: 'candidate-mismatch' };
    if (supplied.evidence?.selection !== 'unprivileged-static-locator') {
      if (!request.provenance) return { pass: false, reason: 'provenance-required' };
      if (request.provenance.sourceHash !== request.sourceHash || request.provenance.targetId !== supplied.targetId) return { pass: false, reason: 'stale-provenance' };
    }
    const checked = validateOperation(request.operation);
    if (checked.status !== 'applied') return { pass: false, reason: checked.reason ?? 'invalid-operation' };
    if (patch.replacement !== checked.patch.replacement) return { pass: false, reason: 'candidate-mismatch' };
    const analysis = analyze(request.source);
    if (analysis.status !== 'ready') return { pass: false, reason: analysis.reason ?? 'stock-analysis-failed' };
    const target = analysis.targets.find((item) => item.id === supplied.targetId);
    if (!target) return { pass: false, reason: 'stock-target-missing' };
    if (patch.start < target.start || patch.end > target.end) return { pass: false, reason: 'candidate-mismatch' };
    const planned = plan(request.source, supplied.targetId, request.operation);
    const structural = target.unsupported.some((item) => item.field === 'target' && scopeReasons.has(item.reason));
    if (planned.status !== 'applied') return { pass: false, reason: structural && planned.reason === 'unsupported-field' ? 'scope-unsupported' : planned.reason ?? 'stock-plan-failed' };
    if (structural) return { pass: false, reason: 'stock-scope-inconsistency' };
    if (!equalPatch(planned.patch, supplied.patches[0]) || planned.content !== supplied.content || planned.sourceHash !== supplied.sourceHash) return { pass: false, reason: 'stock-patch-mismatch' };
    return { pass: true, reason: 'stock-supported-patch-equal' };
  }
  return Object.freeze({ candidate, fallback, guard });
}
