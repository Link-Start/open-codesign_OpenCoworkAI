# R3 evaluator, independent baseline and receipt bridge — development interface

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

Status: **development only; NOT pilot admission, NOT native-chain readiness**. This document and all listed r3 files are new. R2, the entry helper, v03 and F0 snapshot are unchanged. Natural model calls and candidate/UI-source execution were not performed by this implementation agent.

## Modules and authority

- `src/evaluation-plan-r3.mjs`: frozen explicit replay/checkpoint plan, public query/action/probe conversion, complete expected keys and provenance.
- `src/evaluation-facts-r3.mjs`: Node-side projections of coherent native facts, never a browser oracle.
- `src/evaluate-adapter-r3.mjs`: pinned calibration, fresh-scenario sessions, one-clock acquisitions and bounded replay lifecycle.
- `src/measurement-r3.mjs` / `src/measurement-records-r3.mjs`: shared full-window acquisition and independently replayed per-rule classifications.
- `src/baseline-r3.mjs`: independent original capture, pre-method eligibility/no-op, accepted shared evaluation and serialized pure audit.
- `src/runtime-evidence-r3.mjs`: finite structured native-journal replay; no source execution.
- `src/evaluation-normalizer-r3.mjs`: exact-byte receipt persistence and independent typed replay/row normalization. **Native leaf sealing integration is in progress; current typed replay is not independent native decoding.**
- `src/native-evidence-bindings-r3.mjs`: extract source/run-bound native artifact requests; successful typed facts without physical references cannot qualify as sealed evidence.

The methods owner owns `study-execution-bridge-v1` and the outer native evidence sealer. This evaluator does not implement another method runner and does not return private feedback to methods.

## Core API

```js
loadCalibratedPolicyR3({
  policyPath, expectedFileSha256, expectedObserverSha256,
  expectedObserverRevision, expectedEntryHelperSha256,
  expectedLayoutHelperSha256, expectedRunnerSha256,
  expectedRuntimeHashes, expectedCompilerHashes,
  readBytes // test-only dependency injection; default actual filesystem
})

runEvaluationR3({
  renderRequest, plan, sessionFactory, calibration, environment,
  policy, ruleSets, mode: 'baseline' | 'accepted', clock, signal,
  renderTimeoutMs: 15000, actionTimeoutMs: 5000
})

captureBaselineR3({
  originalRenderRequest, originalSourceSha256, plan, sessionFactory,
  calibration, environment, policy, clock, signal
})

evaluateAcceptedR3({
  candidateRenderRequest, originalSourceSha256, baselineBundle,
  acceptanceLock, plan, sessionFactory, calibration, environment,
  policy, clock, signal
})

auditEvaluationReceiptR3({
  baselineBundle, evaluation, plan, calibration, environment, policy
}) // synchronous pure replay; no execution brand and no file-authenticity claim
```

Calibration schema is `r3-layout-value-native-witness-v1`; policy ID prefix is `r3-calibration-`. File bytes, observer/revision, entry/layout helpers, calibration runner, browser version and React/compiler hashes are explicitly bound. R2 policy is not a substitute. A structured clone of the loaded calibration is not an execution authority. Environment contains `entryContract`, `observerSha256`, `observerRevision`, `entryHelperSha256`, `layoutHelperSha256`, `calibrationPolicyFileSha256`, `browserVersion`, `runtimeHashes`, `compilerHashes` and independently approved `dependencyHashes`.

Each planned scenario/initial viewport uses a fresh session returned by `sessionFactory({artifactId,viewport,sourceSha256})`. The factory must return a cold, owned session rather than starting detached browser work. Initial and reload artifact IDs include the full UUID, run index and replay step. A shared artifact root therefore does not collide at each session's default `r3-reload-0001`.

Render requests carry exact source bytes, format, trust level, source-bound accepted public gate, entry ABI and optional trusted fixture path. JSX requires `v04-jsx-app-script-react-1`; no default export, import or self-mount is introduced. Source bytes are copied and independently pinned before rendering; mutating both a request and its receipt does not rebind the original/candidate hash.

## Plan and public interface

Plan schema: `v04-evaluation-plan-r3-1`. Inputs declare public catalog, named viewports, scenarios, complete `expectedKeys`, explicit document-overflow tolerance and Node-private requirements `{targets,originals,protections,reachability,excludeNoopFromG:false}`. Keys are JSON arrays `[suiteId,scenarioId,initialViewport,stepIndex,observationId]`. Auto horizontal-overflow checks occur after each explicit observation and at scenario end; they enter G originals and footprint R non-worsening protections. Failed/skipped checks retain their keys.

`publicLocatorR3` supports role, text and form-control-label locators and finite query-ref resolution. Exactness is retained; query references cannot cycle, exceed depth limits, or silently discard contextual scopes. A form-control label is not rewritten to textbox. Unknown/unavailable input value encodings remain unknown.

`compilePublicProbeR3(probe,{catalog,projection,namespace})` returns `{catalog,observation}`. All eleven public probe kinds are represented. Rect requires an explicit scalar `projection.field`; grid requires explicit `field` and `geometryTolerance`; withinViewport requires explicit `tolerance`. These specify the measured quantity, never infer it from a hidden expected value. `compilePublicActionR3` handles click/fill/key/reload/setViewport with explicit reset/preserve semantics.

- **Gap:** symmetric signed visible border-box clearance along the declared physical axis, independent of query order. Positive is empty interval; negative is interval overlap. It is not computed CSS gap. CSS gap is available only under an explicitly different projection.
- **Grid:** visual top-left complete-link x/y clusters with the declared cluster tolerance. Column count means distinct x clusters, not maximum cards in one row. Flex/block/grid are all legitimate. Actual box intersections require overlap in both dimensions; intersecting row envelopes alone do not prohibit masonry. Optional CSS tracks/placement diagnostics do not impose CSS grid on visual queries.
- **Order:** DOM order and physical visual order are separate. Public visual order is top-to-bottom/left-to-right with fixed 0.5 CSS-pixel row tolerance; tied boxes are unknown. Physical box identity aliases are not invented into two distinct cards.
- **Document overflow:** native content dimensions and bracketed actual CSS layout viewport. Missing metrics never become zero.
- **Reload:** `reset-to-rendered-source-bytes-new-document-new-React-state-new-profile`; an accepted candidate reloads candidate bytes, not baseline bytes.
- **setViewport:** `preserve-live-document-and-React-state-no-remount`; viewport epoch advances without a new render epoch. No hidden source reset.

Browser requests contain only generic `t0,t1,...` keys, public locators and public actions. Predicates, baseline facts, oracle keys, expected values, endpoint labels and statistics bindings remain in Node.

## Measurement and lifecycle

Default timing remains 5000 ms / 50 ms / three stable samples / 0.5 CSS px. Completion must be strictly before the observation deadline. Geometry checks stabilize the entire numeric coordinate vector, not only a predicate boolean. Identity continuity and whole-window range remain required.

Each checkpoint acquires one full hold-through-deadline trajectory, then projects all R/G/original/target/reachability rules offline. There are no independent R/G collectors or duplicated semantic deadlines. Native CDP transport timeout is not represented as remaining semantic budget; this limitation is explicitly recorded. Negative W needs the clean full deadline/tail contract. Earlier positive evidence cannot override fatal lifecycle invalidation.

Render/action/cleanup bounds are separate lifecycle stages, not second observation windows. Abort is single-flight per owned session. Late callbacks cannot update completed records. Newly invalidated dependencies are latched before skipped actions/checks. A live usability/action-completion check precedes intentional close, so a watchdog-aborted session cannot be labeled complete merely because its native journal still says complete. Subsequent independent scenarios may still run.

## Eligibility and partial order

Per pre-source amendment 01, primary R requires original measurability/reachability **and non-noop**; primary G is original complete-spec health and **does not add non-noop**. No-op is separately recorded. A G-qualified no-op still undergoes the actual method/acceptance/evaluation flow and is never automatic S. Unsupported/missing infrastructure is unresolved coverage, not original business failure.

Non-worsening uses componentwise lower-deficit/upper-excess and category/location/code error multisets, including non-increasing numeric magnitudes when present. Different wrong discrete values are not treated as the same failure. New errors cannot be traded against fixes elsewhere. Missing one-sided magnitude is unknown, not zero.

Runtime scopes must exactly cover planned runs and include `nativeJournal` plus boolean `lifecycleComplete`. There is no summary-only or `synthetic:true` bypass. Explicit null journal with false completeness represents unavailable evidence; it cannot support S. Pure audit replays every journal and exactly compares derived events/completeness. Already confirmed independent measurement W can coexist with runtime uncertainty.

Runtime identity is finite: category + scenario/logical reload ordinal/public replay stage + digest of native exception name/message. Source URL/line/column are evidence, not cross-source identity. Native console Error-object stack lines are not message identity. Distinct callsites with identical name/message at the same replay stage can collide: this is a disclosed limitation, not proof of every JavaScript throw site. Incomplete journals retain independently confirmed events rather than erase W.

## Acceptance lock and exact-byte receipts

The trusted execution bridge, not the method, generates and durably creates one lock before candidate private evaluation:

```js
Object.freeze({
  id: 'accept-' + randomUUID(), status: 'accepted',
  originalSourceSha256, candidateSourceSha256,
  lockedBeforePrivateEvaluation: true
})
```

Both hashes mean exact UTF-8 source bytes. Lock persistence uses exclusive create; later execution/evaluation failure never rewrites the method's accepted decision into rejection.

Current receipt writer bytes are exactly:

```js
Buffer.from(JSON.stringify(body, null, 2) + '\n', 'utf8')
```

Two-space indentation, one terminal LF, no BOM/CRLF translation. SHA256 and byte length cover the actual full bytes. Existing receipts are never rewritten/reencoded. Compatible whitespace is read only under its original exact external hash anchor.

```js
persistEvaluationReceiptR3({
  receiptPath, baselineBundle, evaluation, plan,
  calibration, environment, policy, slotBinding
})
normalizeEvaluationReceiptR3({
  receiptPath, expectedSha256, expectedBytes,
  expectedSlotBinding, expectedAcceptanceLockId
})
endpointExpectedKeysR3(baselineBundle)
```

Slot binding, when supplied, has exactly sourceId/taskId/method/slotId/originalSourceSha256/candidateSourceSha256/acceptanceLockId. External expectations are copied before async work. Existing trusted directories, exclusive file creation and no-link guards are required; portable Node cannot guarantee against an adversarial OS actor renaming ancestor directories.

Constants: receipt schema `v04-independent-evaluation-receipt-r3-1`; evaluation schema `v04-accepted-evaluation-r3-1`; normalizer version `v04-evaluation-normalizer-r3-1`.

Normalizer output is `{R:rows,G:rows,independentEvaluation:{evaluationBinding,outcomes,receipt}}`. Row status is pass/confirmed-violation/unknown/notMeasured. Expected keys are fixed before candidate execution: qualification, each namespaced checkpoint, each scoped runtime key, and a fixed audit key preserving W+UA. Noneligible outcomes retain a bound null classification and false/false/false booleans; raw evidence remains present. Statistics may project these masked outcomes to null only after validation.

## Native raw sealing — required work in progress

A typed replay and outer receipt hash do **not** seal referenced native files or independently decode them. Independent audit A04 exposed that gap; A03 exposed an optional-journal downgrade and is fixed. No admission can rely on the current typed-only normalizer while raw-seal integration is pending.

`nativeEvidenceRequestsR3({baselineBundle,evaluation,plan})` extracts baseline/candidate `{runId,sourceSha256,captures,runtimeScopes,references,unavailableAttempts}`. Each usable sample needs an absolute raw path and capture/render/viewport/frame identity; same-path conflicting identities reject. Candidate is null only for the explicitly unexecuted no-eligible case. Trusted bridge supplies artifactRoot, never infers authorization from a capture path.

The methods-owner `sealNativeEvidenceV1` and its independent verifier will seal and reread exact native bytes/hash/length, bind source/render/viewport/frame/capture IDs and mandatory journals, and reject changed/missing leaves. Fixed API/schema integration is pending owner coordination. Replaying a frozen native decoder, if subsequently added, must be described as replay of that decoder—not an independent decoder implementation or arbitrary-JavaScript correctness proof.

## Evidence and remaining gates

- Measurement controls: 46 new + 39 unchanged R2 = 85 passed after lifecycle fatal-code alignment.
- Baseline controls: 48 passed after mandatory native-journal replay and A03 stripping rejection.
- Normalizer typed controls: 28 passed after mandatory journal fixtures; raw sealing not yet claimed.
- Adapter native-shaped fake-session controls: 27 passed, including the default evaluator/baseline/accepted/typed-persistence path, direct producer reload literal, watchdog skipped action and visual masonry counterexample.
- Earlier failed fixture/TAP attempts remain immutable. Author-active time, tokens and money are unknown rather than fabricated zero.

Remaining: integrate and independently challenge native raw seals, reconfirm final browser policy/keyboard/style revisions, run public real-browser full-chain controls via the browser owner, freeze/hash the complete closure, and obtain independent admission sign-off. Pure tests and handwritten native-shaped data do not satisfy those gates.
