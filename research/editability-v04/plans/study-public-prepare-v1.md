# Public prepare v1: raw-JSX preview provenance bridge

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

## Scope and current evidence

Implemented only `src/study-public-prepare-v1.mjs`, `tests/study-public-prepare-v1.test.mjs`, and this plan. The product engine is not copied, modified, or used for instrumentation. Frozen v03/F0/r2 and private material are untouched. Parser resolution in tests uses the existing product Babel parser dependency read-only.

**Current validation is deterministic in-memory control only. No real browser has been launched by this implementation task. Full current-r3 runtime calibration is unresolved here and must be supplied and approved by the parent.** Control successes are `control-ready`, never `ready`, and explicitly say that their native-shaped captures are fake. Real use remains blocked by default.

## Exact API

```js
export function createPublicPrepareV1({
  parse,
  sessionFactory,
  makeRenderRequest,
  runtimeBinding,
  calibrationPolicy,
  browserPolicyReady = false,
  mode = 'native', // alternative: 'deterministic-control'
} = {}) // returns async function prepare(publicRequest)
```

`parse(source, {sourceType:'module', plugins:['jsx'], errorRecovery:false})` is the injected Babel-compatible parser. No stock engine target mapping is accepted.

`publicRequest` is the already projected public methods request: `source`, `sourceHash`, `userGoal`, `scope`, `operation`, exact AX `locator`, optional public `environment`/`publicDom`. Unknown top-level fields, including provenance, baseline, or private expectations, are rejected without reading their values. The allowlist methods projector is reapplied; supplied `publicDom` is discarded and recaptured. Developer/static locators are not accepted. Role, text, form-control-label, and recursive `within` AX locators use the existing methods/r3 contract.

```js
await makeRenderRequest({
  publicRequest,         // public projection, no baseline or expectation
  sourceBytes,           // fresh Uint8Array of this stage's exact UTF-8 source
  sourceHash,
  stage,                 // 'original' | 'instrumented'
  artifactId,            // suggested per-invocation/stage id; callback may replace
});

await sessionFactory({
  stage,
  publicRequest,
  runtimeBinding,
}); // -> fresh r3-compatible session: render, captureFacts, close
```

The callback must construct the real common-safety r3 request, not a source-string shorthand:

```js
{
  sourceBytes: Uint8Array,
  format: 'jsx',
  trustLevel: 'trusted-microfixture' | 'restricted-generated',
  entryContract,
  staticGate, // exact accepted staticGate(request), incl. sourceSha256/digest
  artifactId,
  fixturePath, // mandatory here for trusted-microfixture requests
  // other real r3-supported configuration, e.g. viewport
}
```

`runtimeBinding` is a trusted constructor dependency, not user-provided authority. Required fields:

- `entryContract`, `trustLevel`, `staticPolicyId` (r3 `POLICY_ID`), `calibrationPolicyId`;
- SHA-256 `observerSha256`, `entryHelperSha256`, `layoutHelperSha256`;
- nonempty `runtimeHashes` and `compilerHashes` maps of SHA-256 hashes;
- native `browserVersion` with `protocolVersion`, `product`, `revision`, `userAgent`, `jsVersion`;
- optional pinned `viewport: {width,height}` and `observerRevision` (when supplied, the render receipt must match it).

Real mode requires explicit `browserPolicyReady:true`, a policy accepted by r3 `verifyCalibrationPolicy`, and exact policy/binding equality for browser version, observer, entry helper, layout helper, runtime hashes, and calibration id. Constructor cloning prevents later mutation of these bound objects. No control fake is promoted into calibration. Parent must authorize/verify the **new r3 full policy**, not merely supply a historical policy that happens to satisfy the structural validator. Session options must independently enforce real trust, paths, authorizations, runtime directory, viewport, and calibration.

### Trusted fixture adaptation

Prepare itself does not read/write source or preview files. Parent owns archive paths and any fixture-copy creation. For trusted requests, if r3 recognizes `fixturePath` in `trustedFixturePaths`, its bytes must equal this stage's bytes. Do **not** pass a whitelisted original-file path with transformed bytes: r3 rejects it as `FIXTURE_BYTES_MISMATCH`. Supply the appropriate separately archived/approved preview fixture, without touching original bytes. Suggested artifact ids are unique within one prepare instance; parent should namespace them across independently constructed instances to prevent archive collisions.

## Real source-to-native-target chain

1. Reproject/validate only the public request and check browser/calibration readiness.
2. Before instrumentation or instrumentation parsing, in a fresh original session render the exact **uninstrumented** bytes, then call exactly:
   `session.captureFacts({targets:[{key:'public-target',locator:AX}],includeDocument:true})`.
   Require one visible native target, validated receipt, native backend id/locator digest, stable bracketed snapshot, journal availability/completeness, and no runtime errors. Close in `finally`. This establishes shared public-locate eligibility Q independently from method provenance support.
3. Parse raw original JSX, walking all host `JSXElement` definitions generically. No source text/locator match chooses the target. Preserve map, function, custom-component descendant, spread, and otherwise unsupported method scopes for the method guard to decide later. Non-host JSX, fragments, and unknown host namespaces do not receive guessed mappings.
4. Reject provenance instrumentation for any existing case-insensitive reserved prefix `data-ocd-public-prepare-` in original source, including comments/literals, or in original native target attributes. Choose a source-hash-qualified attribute name. Append one literal attribute after original attributes to every raw host opening element, carrying that **original element's** `start:end` in Babel UTF-16 offsets. Only insertion patches are permitted.
5. Reparse the preview and reverse the insertions; require exact original text and SHA-256 recovery. Retain patches, patch hash, both source hashes, original spans, byte delta, and node count. Original source is never overwritten or sent as preview to methods.
6. In a different fresh instrumented session, use the same bound compiler/runtime/entry/safety pipeline, render the preview, and make the same capture call. Close in `finally`.
7. Read the reserved marker **only from the captured target's native `attributes`**. Require exactly one reserved marker, matching an inserted raw-original span and native host tag. A source hash, public locator, or AST candidate alone is never enough. Missing/ambiguous/mismatched native markers make provenance unavailable, never guessed.
8. Compare exact original/preview target semantic facts and document metrics, excluding only the preview marker and session-local identities. Target comparison includes all other native attributes, normalized rendered text, AX role/name/properties, enabled/value state, computed layout facts, visibility and bounds. This detects observed no-edit perturbation; it is not a proof of arbitrary dynamic-program equivalence or whole-document behavioral equality.
9. Return original public DOM facts once Q is established. Add the native-bound raw-source provenance only after every instrumentation/marker/roundtrip gate passes. Mapping failure preserves original public facts and Q, but emits no provenance.

r3 normalizes locator key insertion order. Therefore validate `identity.targets[].locatorDigest` against the capture's own locator serialization, **after** semantic equality with the public request, not against the request's potentially different JSON property order.

## Result, evidence, and method isolation

Shared public-locate success in real mode (provenance is optional):

```js
{
  status: 'ready',
  publicDom: {tagName, id?, text?, attributes: {/* allowlist */}},
  provenance: {sourceHash, targetId}, // present only if evidence.provenanceStatus === 'available'
  evidence: {/* archive only */},
}
```

Allowed public attributes are exactly `title`, `placeholder`, `alt`, `role`, `aria-label`, `data-testid`. `id` is its own field. No outerHTML, arbitrary attributes, reserved markers, source transform, or raw receipts enter `publicDom`.

- `status:'blocked', reason:'BROWSER_POLICY_NOT_READY'`: no parser, request builder or session is called.
- `status:'rejected', reason`: shared original-locate/input/calibration failure or fatal cleanup failure; retain evidence already obtained, omit `publicDom` and provenance. Original failures include missing/ambiguous targets, stale hashes, runtime-binding mismatch, native identity mismatch, and missing raw receipts.
- `status:'ready'` with `evidence.provenanceStatus:'available'`: valid original public locate and full native marker/roundtrip provenance; `provenance` is present.
- `status:'ready'` with `evidence.provenanceStatus:'unavailable'` and `evidence.provenanceReason`: original locate succeeded, but instrumentation, preview rendering/capture, marker mapping, or no-edit comparison failed. `publicDom` is exclusively from ORIGINAL and provenance is absent. FULL/SCOPE_OFF's existing engine must reject absent provenance equally; PROVENANCE_OFF/LLM remain eligible. This is not full-chain mapping success and must not be counted as a scope gain.
- `status:'control-ready'`: only explicitly injected deterministic-control mode. Parent production runner must accept **only** `ready`.

Evidence contains both real render receipts and captures (including their native attributes), canonical SHA-256 receipt/capture hashes, raw archive paths, runtime/calibration binding, transform patches/hash, source hashes, captured target/document facts, no-edit comparison hashes, native marker/backend/frame/render binding, and adaptation costs (source/preview bytes, added bytes, host count, sessions/renders/captures/transforms, instrumentation/stage/total milliseconds). It also explicitly states that no independent evaluation baseline is collected here.

**Evidence is parent archive data, not a public method request.** Parent must merge only `publicDom` and `provenance` into the original public source request and call existing `projectPublicRequest`/methods projection. FULL and SCOPE_OFF receive provenance; PROVENANCE_OFF and LLM_ONESHOT receive neither provenance nor marker/transform/evidence data. Tests exercise the current allowlist projection. Never call fallback on preview source. The parent separately owns the independently captured uninstrumented evaluation baseline and must not replace it with this prepare capture.

Dependency injection is a trusted runner boundary: arbitrary hostile `sessionFactory`/`makeRenderRequest` functions can invent data. This module validates native-shaped identities and pinned receipts; it does not cryptographically authenticate an injected implementation. Only parent-approved real r3 sessions and policy artifacts establish genuine runtime evidence.

### Native preparer identity guard

`export function isNativePublicPrepareV1(fn)` checks a module-private WeakSet, not a spoofable function property. A factory-created preparer is branded only in native mode with explicit policy readiness and constructor-time valid matching runtime/calibration bindings. Invalid/unready functions stay unbranded and still return structured rejections when invoked. Control preparers, arbitrary stubs, wrappers and bound-function copies are never branded. Parent native runners should require this check before invocation and still require a `ready` result afterward. The brand establishes factory identity/configuration, not authenticity of arbitrary injected I/O; retain the trusted-dependency boundary above.

Shared Q and method provenance availability are separate: original locating success is retained as public-ready even when instrumentation/mapping fails. `evidence.publicLocateStatus` records original availability; `evidence.provenanceStatus`/`provenanceReason` record mapping availability. The original capture must have fully validated and closed before this fallback is permitted. Cleanup failures remain fatal/rejected. Parent must not equate a public-ready result without provenance with FULL mapping readiness.

## Validation

Run without a browser:

```powershell
node --test tests/study-public-prepare-v1.test.mjs
```

The 17 named deterministic controls cover source preservation/reversible insertion, runtime-only target binding, no fake calibration readiness, public-only input boundary, reserved markers, missing/ambiguous target/marker, original-before-preview ordering, raw custom/map/spread scopes, exact no-edit comparison, source/gate/receipt/native identity mismatches, fresh sessions, finally cleanup, and PROVENANCE_OFF/LLM projection isolation. They use hand-authored fixtures and explicitly fake CDP-shaped captures; they do not validate real browser behavior or claim full-chain acceptance. Parent performs real browser integration only after current full-policy calibration approval.
