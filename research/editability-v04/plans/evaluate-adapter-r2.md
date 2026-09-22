# v04 App-script ABI and minimal evaluate-adapter-r2

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

## Status: draft, not formal readiness

These are new v04 files. The implementation author modified no v03 file, browser-owner file, product checkout, prior measurement implementation, or prior result. No future private-test source was read. Tests use handwritten fake sessions and clocks; entry compilation executes only the already trusted Babel vendor, never generated JavaScript. No browser or model API was started in this phase.

This delivers an ABI helper and a **minimal primitive observation loop**. It does not implement the full four-task layout domain, gap/grid/order checks, automatic overflow checkpoints, source generation, or formal study runner. **Do not mark formalReadiness complete** based on these tests. Browser-owner revision-3 containment/epoch/cleanup controls and App-source execution must be independently calibrated; policy hashes must correspond to that exact revision. Old calibrated policy bytes must not be edited to appear compatible.

Owned files:

- `src/entry-contract-r2.mjs`
- `tests/entry-contract-r2.test.mjs`
- `src/evaluate-adapter-r2.mjs`
- `tests/evaluate-adapter-r2.test.mjs`
- this plan, new TAP attempts, and `results/evaluate-adapter-authoring-events.jsonl`

## 1. Formal JSX entry ABI

```js
import {compileAppScriptR2, APP_SCRIPT_ENTRY_CONTRACT} from './entry-contract-r2.mjs';
const {code, entryName, entryContract, selectionRule, declaredEntries} =
  compileAppScriptR2({source, Babel});
```

`APP_SCRIPT_ENTRY_CONTRACT = 'v04-jsx-app-script-react-1'`.

The caller supplies the trusted Babel object. The helper parses source to an AST and compiles JSX with the React preset. It never evaluates source or compiled code, instantiates a component, mounts React, loads Babel itself, or modifies raw source bytes. The browser owner places returned code and its mount glue into the **same browser execution scope**. Source/runtime/compiler/envelope costs and hashes remain distinct.

Formal source must have an actual Program-level `function`, `const`, or `let` binding named `App` or `_App`. `App` wins if both exist; exactly one entry is selected and mounted. Both declarations are allowed. `var`, class-only bindings, nested declarations, comments, and string literals do not satisfy this declared ABI. This tracks the product runtime's public declaration kinds and App-before-_App auto-mount preference (`packages/runtime/src/index.ts` declaration scan and `autoMountJsxIfNeeded`), but uses AST structure instead of accidentally matching comments or nested text.

Imports, dynamic imports, exports, and self-mount forms are rejected. The helper does not silently accept default exports. Browser routing must use:

- formal JSX: `renderRequest.entryContract = APP_SCRIPT_ENTRY_CONTRACT`;
- explicit old public calibration only: `jsx-export-default-commonjs-react-1`;
- no default-export fallback when formal App entry is missing.

Self-mount checks are a restricted ABI/static guard, not a complete JavaScript capability proof. Existing browser risk-reduction controls remain necessary. Complex state, hooks, maps, child components, event handlers, and helper declarations are not rejected merely because a native editing method cannot transform them. **Editor support limits are not original-program validity gates.** Actual component runtime errors are measured separately in the browser.

## 2. Calibrated policy binding

```js
const calibration = await loadCalibratedPolicyR2({
  policyPath,
  expectedFileSha256,          // independently pinned by parent freeze
  expectedObserverSha256,
  expectedObserverRevision,
  expectedRuntimeHashes       // optional extra exact pin
});
// calibration.policy is the original verified policy body; supply it to browser start().
```

The loader verifies exact file bytes, the policy's own body digest, observer SHA, browser version fingerprint, runtime/fixture/runner hash shapes, unique supported rule types, exact minus-one encodings, and positive/negative witness-count thresholds. It deep-freezes the returned binding and policy. A constructed or JSON-deserialized binding is not accepted by collector factories; reload from the separately approved pins. The observer revision pin is enforced against the actual render receipt together with observer SHA, browser fingerprint, and runtime hashes.

Only the calibrated `input:text` and `textarea` empty encodings are admitted. A booleans-only `validated:true` rule or a double-omission rule cannot authorize emptiness. A mismatched old policy fails closed; do not refresh its observer hash without new approved provenance.

The loader is not a substitute for a parent critical-file freeze: helper, adapter, measurement, classification, runtime and compiler dependencies also need version/hash binding in the final study manifest. The caller's pinned hashes must come from independent approved provenance, not be computed from an unreviewed candidate-selected path and declared trusted by the candidate.

## 3. Fact-only collector

```js
const lifecycle = createScenarioLifecycleR2({session, calibration, receipt});
const collect = createObservationCollectorR2({
  session, observation, catalog, viewport, calibration, lifecycle
});
// collect({signal, remainingMs, sequence}) -> measurement-r2 envelope
```

The factory rejects any extra field, including `expect`, `conditionExpected`, comparator or baseline. Public locators are copied recursively with exact-match allowlists:

- role: `by`, `role`, `name?`, `exact:true`, `within?`;
- text: `by`, `text`, `exact:true`, `within?`.

Unknown nested keys, non-plain objects, inexact locators and arbitrary selectors are rejected. The adapter resolves a `targetRef` in Node and sends **only `{locator}`** to `session.inspect`. It does not spread private check objects into browser requests. The complete measurement result, which intentionally retains private expectations/baselines for audit, must never be sent to a page or edit model.

Supported observation kinds:

| Kind | Returned fact | Important eligibility |
|---|---|---|
| value | Exact native string, including empty/space/newline | Explicit available state; visible target; snapshot/AX/layout presence; no ignored AX |
| text | Browser-observed string | Unique visible target; no input-value fallback |
| count | Native locator match count, including zero | Zero is a count, not an empty value |
| enabled | Boolean state | Unique visible target and actual Boolean |
| attribute | Explicit attribute value, or null when absent | Attribute map must exist; null is not reused as missing input value |
| rect | x/y/width/height/right/bottom | Unique visible target, finite positive-size native rectangle |
| withinViewport | Horizontal containment Boolean | Explicit viewport width and numeric tolerance |

`gap`, `grid`, `order`, arbitrary-script observations, and document-overflow observation are **not implemented**. They raise `R2_OBSERVATION_UNSUPPORTED` before formal rendering. This records a capability gap, not a generated program defect.

The bridge normalizes browser `valueState:'available'` (or a status envelope) to `evidence.valueState:{status:'available',type,source,calibrationRuleId}` and retains raw presence. It never infers a string from null/undefined. Error strings are converted to `{code,message}` without losing known fatal codes. Fatal collection errors invalidate the lifecycle and reach measurement-r2 as structured errors; recoverable missing values stay unknown without `actual`.

Identity includes render ID, render epoch, viewport digest, locator digest, sorted target backend IDs and the ordered named-context backend chain. Context depth and integer IDs are validated. Changing context or target resets the stable window. Raw sample IDs/paths are evidence only, not identity; otherwise each sample would spuriously reset stability.

The evidence retains native capture intervals supplied by revision-3 `inspect`, raw artifact references, browser fingerprint and policy hash/ID. The adapter does not pretend that several snapshots are atomic. Compound geometry remains unavailable until a separately specified coherent acquisition mechanism is implemented and calibrated.

## 4. Deadline and lifecycle ownership

Only `measurement-r2` owns the observation deadline and completion eligibility. The bridge does not create another value-collection timer and does not call the old nested `valueCollector` implementation. It checks the AbortSignal before and after inspect and forwards `abort()` to a single-flight per-scenario lifecycle hook. Underlying CDP commands do not individually receive remainingMs; evidence explicitly says `remainingBudgetPropagatedToCDP:false`. Deadline enforcement relies on aborting the browser render, as honestly documented.

Browser revision-3 must supply per-render epoch guards and single-flight cleanup. The bridge additionally:

- invalidates on changed epochs, protocol failure, pending/failed cleanup, runtime errors or fatal collection errors;
- never lets a late old inspect result enter a new render's measurement;
- waits only the separate cleanup budget;
- refuses a new render while browser cleanup is pending/failed;
- retains unknown measurement results and emits downstream `notMeasured` rows rather than silently retrying the same failed replay;
- keeps independent confirmed W evidence separate from other unknown checks;
- does not remove historical stable evidence after failure.

Render and action stages have their own finite budgets, completion-time cutoffs and external cancellation. Completing after the deadline cannot win merely because its timeout callback was delayed. These lifecycle budgets are not extra observation time. A maximum step count bounds total scenario work; this is not represented as one shared whole-scenario timeout.

## 5. Check and scenario entry points

```js
const checkResult = await evaluateCheckR2({
  session, check, catalog, viewport, calibration, lifecycle,
  policy, baseline, baselineProvenance, clock, signal
});
// {measurement} or {notMeasured}

const suite = await runScenarioR2({
  session,
  renderRequest: {
    sourceBytes, format, trustLevel:'restricted-generated', staticGate,
    artifactId, viewport,
    ...(format === 'jsx' ? {entryContract:APP_SCRIPT_ENTRY_CONTRACT} : {})
  },
  scenario: {
    suiteId, id, freshReload:true, assertNoHorizontalOverflow:false,
    steps: [
      {op:'fill', targetRef:'field', value:'public action text'},
      {op:'observe', id:'value', observation:{kind:'value',targetRef:'field'},
       expect:{cmp:'eq',value:'private Node-side expectation'}}
    ]
  },
  catalog, calibration, policy,
  expectedKeys,                 // mandatory independent complete expected list
  baselineEvidence, baselineSourceSha256,
  viewportName:'desktop',
  renderTimeoutMs:15000, actionTimeoutMs:5000, maxSteps:200,
  clock, signal
});
```

This is one fresh scenario and one viewport. Call separately for each declared scenario/viewport; do not mutate the viewport inside an active observation. Supported actions are `click`, `fill`, and `key`. Reload, setViewport, and automatic overflow checkpoints are deliberately rejected as unsupported rather than silently skipped. `scenarioCheckKeyR2(scenario,viewportName,index,id)` is available to form keys, but formal callers should derive and freeze their expected key list independently from the declared plan. Missing, duplicate or mismatched expected keys fail before rendering.

The source-bound static gate must be accepted. The real browser session still performs its own full gate validation and execution authorization; this bridge is not a replacement security gate. Formal JSX request and returned receipt must both advertise the App-script entry contract. Old default-export source is allowed only through the browser owner's separate explicit legacy-calibration path, not through this formal scenario runner.

Private expectation syntax and public observation/action schemas are checked before rendering. `check.expect` is passed only to Node `measureUntilDeadline`; no expected value is part of collect's signature or any browser query. Source/render/action payloads are deliberately allowlisted.

Suite output uses `v04-measurement-suite-r2-1` and `classifySuiteR2`, never r1 `classifySuite`. It preserves every declared observation as a measured result or explicit notMeasured row, performed/error/skipped actions, lifecycle errors, receipt, and source/observer/policy provenance. Known runtime errors stay explicit invalidating evidence; the bridge does not promote every runtime/locator/transport code to semantic W. Final invalid session state is also recorded as an unresolved suite error rather than allowing a stale S summary.

## 6. New bound baseline envelope

```js
{
  schemaVersion:'v04-bound-baseline-r2-1',
  actual,
  provenance: {
    sourceSha256, replayDigest, catalogDigest, viewportDigest,
    observerSha256, observerRevision, calibrationPolicyId,
    measurementPolicyDigest, checkpointKey, entryContract
  }
}
```

All fields are mandatory and match the expected provenance exactly. Old r1/r2-unbound records do not pass this adapter. After validation, the bridge supplies measurement-r2's own baseline value envelope plus the source provenance. For edited candidates, explicitly pin `baselineSourceSha256` to the original baseline source; candidate bytes have their own source hash. If no distinct original pin is supplied, the expected baseline source is the current source, conservatively rejecting cross-source records.

Replay digest is over the exact performed public action prefix. Catalog digest is over validated public locators. Policy digest is over the complete normalized measurement policy, not just the four common constants. Checkpoint and entry ABI are part of the binding. This adapter validates already captured baselines; it does **not** claim to implement independent baseline capture or prove that an externally forged baseline actual was genuinely observed. The baseline capture owner must supply stable, source-bound independent evidence and immutable artifacts.

## 7. Tests and remaining integration gates

Entry tests exercise real trusted Babel parse/compile with handwritten source sentinels. Top-level throws and component throws remain text in returned compiled code and never execute in Node. Stateful complex App is accepted, nested/comment/string impostors rejected, and both App/_App ordering and forbidden modules/self-mount are tested.

Fake-session adapter tests cover exact calibration bindings and tampering; empty/nonempty/unknown values; uniform hidden eligibility; supported primitive observations; unsupported compound geometry; fatal-code preservation; one-abort timeout; cleanup-pending rejection; old late work versus new render; nested private-field rejection and expectation sentinel nonleak; context identity; expectedKeys completeness; App receipt ABI; observer/runtime mismatches; late render/action budgets; runtime-error propagation; and end-to-end bound baseline provenance.

Run this author's tests only:

```text
node --test --test-reporter=tap tests/entry-contract-r2.test.mjs tests/evaluate-adapter-r2.test.mjs tests/measurement-r2.test.mjs
```

New TAP attempts and phase-specific authoring events are append-only. Wall duration is recorded separately from unknown active authoring time and unavailable token counts. No zero-cost inference follows from zero browser/model API calls in this phase.

Still required before formal readiness:

1. Browser owner validates App ABI rendering, revised cancellation/epoch/lifecycle behavior and exact revised sparse-value policy using new public controls.
2. Parent freezes the exact observer, helper, adapter, measurement, classifier, compiler/runtime and approved calibration artifacts; old observer-policy hashes remain historical.
3. Implement and calibrate the missing task-layout observation domain and automatic overflow/replay features, or explicitly scope the study away from them before collecting data. Do not silently reduce an existing formal suite.
4. Supply independently captured bound baselines where required.
5. Audit actual formal public payloads and expected-key coverage; no private expectation or future private-test source crosses the Node boundary.
6. Preserve all v03 labels and source bytes unchanged. No historical failure sample or label is used to tune acceptance thresholds or rescue scores.
