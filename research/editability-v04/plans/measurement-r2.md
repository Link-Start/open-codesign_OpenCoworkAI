# v04 measurement-r2: independent design and calibration protocol

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

## Status and scope

This is new v04 infrastructure, informed by a **non-blind, post-hoc audit** of v03 measurement limitations. It is not a retroactive correction of v03 labels and does not claim blind design. No v03 file or byte is modified. No future private-test artifact is read. The author ran only dependency-free Node 24 tests over trusted, handwritten fake observations; **no browser, generated JavaScript, model API, or browser calibration was run by this author**.

The parent approved a conservative separation of operational measurement outcomes, historical evidence, coverage, and S/W/U_A classification. Real-browser semantics and the production browser adapter remain a separate owner's responsibility. The design remains **pending independent trusted-browser calibration and pre-run freeze**. Passing fake-clock tests is not evidence that Chrome/Edge represents empty input values correctly.

Owned implementation:

- `src/measurement-r2.mjs`: pure Node-side state machine and fixed comparator enums.
- `src/measurement-records-r2.mjs`: independent r2 record validation and conservative classification.
- `tests/measurement-r2.test.mjs`: pure fake-clock positive/negative controls covering both modules.
- `results/measurement-r2-tests-attempt-*.tap`: append-only test-attempt outputs.
- `results/measurement-authoring-events.jsonl`: this author's events only.

## 1. Interfaces and trust boundary

```js
import {
  measureUntilDeadline, MEASUREMENT_SCHEMA_VERSION,
  DEFAULT_MEASUREMENT_POLICY, BASELINE_SCHEMA_VERSION
} from './measurement-r2.mjs';

const result = await measureUntilDeadline({
  collect: async ({signal, remainingMs, sequence}) => ({
    state: 'ok', actual: '',
    identity: {renderId: 'r', contextBackendNodeId: 10, backendNodeId: 11},
    evidence: {valueState: {status: 'available', source: 'native-explicit-string'}}
  }),
  expect: {cmp: 'eq', value: ''}, // PRIVATE Node side, never passed to collect
  policy: {temporalMode: 'eventually-stable'},
  geometry: false,
  clock: {now, sleep},             // optional; production default is monotonic performance.now
  abort: async ({reason, signal}) => {}, // optional, separately bounded session cleanup
  signal                          // optional external cancellation
});
```

`collect` returns exactly one of:

- `{state:'ok', actual, identity?, evidence?}`;
- `{state:'unknown'|'error', error?:{code,message}, evidence?}`.

A missing `actual` or undefined value is not a successful observation. Unknown/error records cannot carry `actual`. Null is allowed only as a generic primitive, e.g. absent attributes; **a value adapter must never supply null as an observed input value**. When `evidence.valueState` is supplied, its status must be `available` or the sample becomes `VALUE_UNAVAILABLE`. The adapter must convert unavailable value states to unknown, not empty. No string trimming occurs in the state machine. A comparator type error retains the received value as `observedActual` diagnostic data, never as an assertion-bearing `actual`.

Private `expect`, baseline values, comparator information and private identifiers are not arguments of `collect`, cleanup, browser payloads, or editing-model requests. The Node caller must continue enforcing that separation. These modules do not import a browser launcher, runtime compiler, or generated-source executor. They never evaluate candidate code in Node. Fixed comparison enums are `eq`, `includes`, `notIncludes`, `between`, `sameAsBaseline`; custom source strings/functions are not comparator inputs.

`sameAsBaseline` requires schema `v04-measurement-baseline-r2-1`, an explicit `actual`, and no baseline error. **This pure comparator only checks the baseline value envelope**. The integration owner must additionally validate source/checkpoint/replay/catalog/viewport/observer/policy provenance before calling it; schema tags alone are not provenance. Old r1 baseline schemas are rejected.

## 2. Public initial policy

| Setting | Initial value | Meaning |
|---|---:|---|
| timeoutMs | 5000 | Absolute observation-phase budget |
| pollIntervalMs | 50 | Sleep after each completed attempt, capped at remaining budget |
| stableSamples | 3 | Consecutive eligible samples in a stable window |
| geometryDeltaPx | 0.5 | Maximum whole-window range per numeric geometry coordinate |
| temporalMode | eventually-stable | Defined below; no implicit switching |
| cleanupTimeoutMs | 1000 | Separate cleanup budget; never extends observation eligibility |
| maxSamples | 10000 | Explicit memory/resource cap; reaching it yields unknown, never truncates history |

No case-specific tolerance, deadline extension, retry-to-pass, or known-failure-derived parameter is permitted. Default 5000/50/3/0.5 values are preserved as requested. Reduced budgets in unit tests are deterministic test fixtures, not alternative study policies. Resource bounds are explicit and independent of expected values.

Deadline coverage has one derived rule, not a new tuned constant: `deadlineTailMs = deadline - lastValid.completedMs` must be at most `pollIntervalMs` for a normal deadline to support W or hold success. This prevents an overslept final poll from being treated as observed coverage. `terminalGapMs`, measured to actual termination, is recorded separately; scheduling delay after cutoff must not fabricate an observation at cutoff.

There is **no claim of continuous-time coverage**. Successful attempts may themselves take time. Request start/completion and identity/provenance are retained; the browser adapter should attach native capture start/end times and raw evidence references for compound observations. No uncalibrated maximum collection-duration threshold is added. If a study needs a stronger maximum-gap or minimum-window-duration guarantee, it must preregister a separate policy revision before measurement rather than infer one from convenient outcomes.

## 3. State machine

1. Validate policy and expectation; initialize monotonic observation start and absolute deadline.
2. Never start a new collection at or after the deadline.
3. Run the attempt against its remaining absolute budget. Each attempt gets an AbortSignal and public remaining budget; subcommands must honor the same budget.
4. Eligibility is the half-open interval **completion strictly before deadline**. Completion exactly at deadline is excluded along with later completion. This avoids timer-queue ordering changing an exact-boundary pass. A completed late response can be retained as `lateObservation`, but receives no predicate and enters no stable window.
5. For eligible successful observations, compare only in Node. A stable window requires three consecutive samples, unchanged semantic/native identity, all predicates identical, and stable values across the **entire window**. Geometry uses max-minus-min, recursively for arrays, not adjacent-difference chaining. Nongeometry values require exact structural equality.
6. Unknown/error/late samples reset only the current window. Previously established windows and last valid facts remain immutable history.
7. Stable negative evidence never causes early failure. Continue observing asynchronous UI until deadline unless the session fails, cancellation occurs, or a declared resource bound is hit.
8. A collection timeout aborts the attempt and invalidates its render/session. The adapter's `abort` hook performs separately bounded cleanup. Later steps should be explicitly marked not measured or rerendered under a declared replay policy; do not silently continue on an invalid render.
9. Store every attempt and stable window. Pending operations that settle after finalization are handled without mutating the returned evidence. No background late success can rescue a completed record.

### Temporal contracts

**eventually-stable:** success means at least one eligible complete stable satisfying window was observed before the deadline. Return immediately at that witness. This says nothing about subsequent unobserved behavior.

**hold-through-deadline:** first establish a complete stable satisfying window; continue sampling to the deadline. Every subsequent eligible observation must satisfy the predicate, and no unknown/error/late gap after that first window is allowed. A later counterexample stays recorded even if the UI recovers. Unknown before the initial satisfying window may recover; unknown after it permanently makes this hold claim uncertain. Deadline-tail coverage is required. This is a **sampled hold contract**, not proof of continuous real-time persistence. It does not replace the eventually contract without explicit policy selection.

## 4. Result axes

Schema: `v04-measurement-r2-1`.

- `expectation` and `baselineEvidence`: Node-private comparison inputs retained so persisted sample predicates can be recomputed; never transmit the measurement record to a generated page or editing model.
- `outcome`: `observed-satisfied`, `not-observed-by-deadline`, `measurement-unknown`, or `interrupted`.
- `termination`: reason, observation elapsed time, deadline, deadlineReached, and strict boundary policy.
- `samples`: complete ordered attempts with request/completion time, eligibility, status, observed values or errors, predicate when valid, optional identity/native provenance.
- `evidence`: lastValid, lastStable, first/lastStableSatisfying, lastStableViolating, terminalStableWindow, full stableWindows, holdViolations, holdUncertain.
- `coverage`: attempt/valid/unknown/error/late counts, full gap list, last-valid time, terminal gap, deadline tail, deadline-tail coverage, maximum observed valid-sample gap, `continuousTimeCoverageClaimed:false`.
- `health`: session usability, terminal error, independent cleanup status/duration/error.

`not-observed-by-deadline` is an **operational trajectory description**, not an automatic semantic fail. A timeout after a stable negative window can retain that outcome and evidence while receiving U_A because the terminal coverage is insufficient. No field claims that the UI stayed wrong during an unobserved gap. All-unknown and no-stable-evidence traces are measurement-unknown. Fatal early interruption is interrupted, even with prior negative evidence.

## 5. Conservative S/W/U_A protocol

Schema: `v04-measurement-classification-r2-1`; policy: `v04-r2-conservative-partition-1`.

| Partition | Required evidence | Explicit limitation |
|---|---|---|
| S | Eligible satisfying window; eventually contract, or valid hold contract through covered deadline; usable session and no terminal error | Initial recoverable gaps remain visible; existential witness does not certify all business logic |
| W | Normal deadline termination, no unknown/error/late attempts, usable session, covered deadline tail, and terminal stable negative window with no eventually-success witness | Confirms only unmet frozen bounded sampling contract; not wrong at every instant |
| W for hold | Same clean normal-deadline coverage, plus a valid post-initial-window counterexample | Counterexample is explicit; later recovery cannot erase the breached sampled hold contract |
| U_A | All other cases, including terminal timeout, oversleep, gap-bearing negative trajectory, unstable end, missing values, interruption, skipped step, incomplete baseline | Stable negative evidence remains available but is not upgraded to whole-interval failure |

Even an intermediate recovered error prevents a negative trace from receiving W in this conservative revision. That rule is deliberately stricter than required for an existential positive witness: S can be justified by a directly observed satisfying window despite earlier gaps; the negative claim requires the stated coverage contract.

`classifyMeasurementR2(record)` validates schema and evidence references and recomputes every valid sample predicate in Node from recorded actual/expectation/baseline before assigning a partition. It rejects r1 records, late samples used as valid evidence, missing history, dangling windows, nonconsecutive or inconsistent stable windows, and forged deadline coverage.

```js
classifySuiteR2({
  schemaVersion: 'v04-measurement-suite-r2-1',
  checks: [
    {key: 'suite/scenario/view/check', measurement: result},
    {key: 'next', notMeasured: {reason: 'session-invalidated', previousKey: 'prior'}}
  ],
  actions: [{status:'performed'}], // or error/skipped
  errors: []
}, {expectedKeys: ['suite/scenario/view/check', 'next']});
```

`expectedKeys` should always be supplied by formal integration. Empty suites, missing/extra/duplicate checks, incomplete actions and explicit not-measured rows remain unresolved. Unknown locator/runtime/driver error codes are **not** promoted wholesale into semantic W. A suite can have W precedence only because some independent check has confirmed W under this protocol; all other unresolved reasons are retained. This module deliberately does not import or wrap v03 `classifySuite`.

v03 official labels remain frozen. No predecessor result is rewritten, pooled into v04, or made comparable by changing only a schema tag. Any later observer comparison must report differing policies and denominators rather than silently rescue scores.

## 6. Independent calibration matrix

### A. Pure deterministic controls (implemented)

| ID | Positive/negative pair | Required result |
|---|---|---|
| T1 | Always correct / always wrong | Complete window S / wait full deadline, clean bounded W |
| T2 | Long stable wrong prefix, enough correct samples before deadline | S; no early negative termination |
| T3 | One/two correct samples then wrong | No satisfying window |
| T4 | Stable wrong then transient error / terminal timeout | Preserve earlier window; conservative U_A |
| T5 | All unknown / alternating values / fatal early error | Unknown / unknown / interrupted |
| T6 | Completion deadline-1 / exactly deadline / deadline+1 | Eligible only before deadline |
| T7 | Update too late to form complete window | Not S, preserve earlier negative evidence |
| T8 | Adjacent-small but cumulative-large drift / threshold-side jitter | No false stable satisfying window |
| T9 | Stable identity / context or backend-node replacement | Reset window on replacement |
| T10 | Eventual success / later hold counterexample / post-window unknown | S / hold W only under clean covered protocol / U_A |
| T11 | Clean final poll / final-poll oversleep | Covered decision / U_A; distinguish deadline tail from termination delay |
| T12 | Stuck collection / stuck cleanup / rejected cleanup | Budget-bounded attempt; separately bounded and visible cleanup |
| T13 | Late completion after finalization | No mutation or retroactive pass |
| T14 | Explicit available empty / unavailable labeled empty / missing actual | S / unknown / protocol error, never inferred emptiness |
| T15 | Private expectation sentinel / public collector payload | No sentinel in collect or cleanup arguments |
| T16 | Mixed r1 schema or forged evidence / independent r2 records | Reject / classify using r2 only |
| T17 | Independent confirmed violation plus unknown check | W precedence with unknown reasons retained, not gap-derived W |

### B. Required trusted-browser controls (NOT run here)

Core value/context controls must cross HTML and JSX, desktop and mobile, with fresh handwritten fixtures. They must not be adapted from previously failed generated applications.

| ID | Control | Positive expectation | Negative control / discrimination |
|---|---|---|---|
| V1 | Input initially absent value, explicit empty, nonempty, spaces | Distinguish `''`, `seed`, and `' '` without trimming | Missing AX/snapshot node or unsupported channel stays unavailable |
| V2 | Input fill nonempty, then clear, repeated clear | Current live value becomes empty | Readonly/disabled or clear-rejecting handler retains old value; action receipt is not evidence of clearing |
| V3 | Textarea initially empty/nonempty/multiline, fill and clear | Preserve live newline string; clear to empty | Initial textContent or value attribute remains nonempty and must not be used as live value |
| V4 | React controlled input and textarea | onChange accepting clear yields empty | Handler retaining/restoring old state is genuinely nonempty, not observer unknown |
| V5 | Number empty, zero, valid numeric string | Correct supported-type value states | Password/file/contenteditable outside support table are unsupported, not blanket empty |
| C1 | Same names in one visible group versus two active groups | Unique active context versus ambiguity | Hidden duplicate must not create ambiguity if excluded under calibrated semantics |
| C2 | hidden, display:none, visibility:hidden, aria-hidden, opacity:0 | Measure each declared AX/layout contract separately | Author CSS overriding hidden may make content truly visible; no attribute-only suppression |
| C3 | Missing context appears, modes switch, temporary duplicate, backend replacement | Recover to a new full stable window | Persistent dual contexts stay unresolved/contract-specific, never guessed absent content |
| B1 | Delayed update well before versus after deadline | Before-budget complete window / no late rescue | Near-boundary runs record actual timings; do not tune policy to OS scheduling jitter |
| B2 | Stable bad UI versus injected transport timeout | Distinct negative fact and unknown collection | Driver fault injection stays in observer harness, not generated page |
| B3 | Compound grid/context observation during DOM update | Explicit capture-span and identity consistency | Torn snapshots cannot count as one coherent stable observation |
| S1 | Hidden expectation sentinel; Node execution sentinel | No expected-value disclosure; no generated JS execution in Node | Only trusted Babel compilation, never candidate execution, is allowed on Node side |
| S2 | Existing renderer sandbox, opaque iframe, CSP and network blocks | Preserve approved browser containment controls | Never add no-sandbox/disable-web-security or claim OS-level isolation |

### C. Empty-value decoder activation gate

The production adapter should expose value status/provenance including native field presence, tag/input type, backend node identity, snapshot identity, browser version, and calibration-policy version. Raw sparse snapshot omission defaults to unavailable. Only an independently demonstrated browser-version/tag/type-specific empty-omission rule may map omission to `''`; missing snapshot nodes, command failures, unsupported types, or entire missing fields are not proof of empty values.

For calibration only, a separate trusted-fixture witness may read the live native `.value` in the browser using a fixed browser-side getter. It must not use the production decoder as its sole reference, accept hidden expectations, execute source in Node, or become an arbitrary Runtime.evaluate endpoint for restricted-generated programs. Cross-check the independent witness with raw AX and DOMSnapshot payloads. Native-channel disagreements may reflect cross-capture timing and must trigger recapture/unknown, not selection of whichever value passes.

Record browser/CDP/runtime versions, fixture/adapter/policy/vendor hashes, raw samples, identity and capture timing, action receipts, rejection/cleanup evidence, and all positive/negative controls. Failed calibration means repair the measurement and rerun the complete control set before freezing; it never authorizes changing old oracle expectations or v03 partitions.

## 7. Execution, costs, and remaining gates

Run only this author's pure tests with:

```text
node --test --test-reporter=tap tests/measurement-r2.test.mjs
```

Save each TAP output at a new path. These tests use trusted handwritten observations and a fake monotonic clock; no production browser session or generated application is loaded. This implementation phase records wall time separately from unknown active work time and unavailable authoring token counts. Browser/model API calls by this author are zero; that does not mean total project cost or authoring cost is zero.

Before a formal run, the parent/integration owner must: approve and hash the exact measurement/classification policy; complete independent browser controls; bind baseline and native observation provenance; preserve explicit skipped checks after invalidation; verify v03 freeze hashes without changing them; and keep original private expectations on Node only. Until those gates are completed, these artifacts establish unit-tested protocol behavior, not calibrated browser truth or a validated study result.
