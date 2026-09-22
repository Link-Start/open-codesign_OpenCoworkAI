# Browser r3 admission and final-native-journal contract — WIP snapshot

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

## Status and stop boundary

Publication-priority WIP, not F1 admission. Source/docs/fixtures stop changing after this document and the accompanying WIP hash manifest. **Do not run a new matrix merely to publish.** F0 r2 and entry-helper bytes remain untouched. Natural sources, future-private/private-pilot data and model/API calls were not used.

The historical full run `results/browser-calibration-r3-MDiU66/` genuinely passed 8 value + 8 number + 8 domain + 3 ABI cases, 23 pre/post/current hashes, and 43 independently absent owned browser PID/profile pairs. Its policy/report do **not** cover current r3 source. The current revision additionally changes keyboard packets, cascade fields, raw bindings, local-form sandbox semantics and journal cutoff/teardown accounting. None of those last containment/journal changes has completed a new calibration.

Historical policy ID: `r3-calibration-560418c3593e35f7f647ef319a53a705fa8e42ec7311911e2a98d2d8746548fe`.
Historical policy-file SHA256: `777c9de73cc618aac891b5730fd2104663386cb48a2d12c2838e4857ad6a3f54`.
Historical report-file SHA256: `5c8b41a0d7d5a958c6443db15202da7d89ed3d75c1a1d49fbc35ffe30bd7ac9e`.
These are historical evidence pins, **not current-study authorization**.

## Exact full-report structure (public controls, no private IDs)

- `report.schema === 'browser-calibration-r3-report-1'`.
- `report.runKind === 'trusted-control-calibration-not-scientific-sampling'`.
- Top-level observerRevision/observerSha256/runnerSha256/entryHelperSha256/layoutHelperSha256/measurementSha256/nodeVersion describe the producer; records hash is in inputIntegrity, not a top-level recordsSha256.
- `report.policy` is the **measurement timing policy**, NOT the calibration policy.
- `report.calibrationPolicy` equals the parsed separate `policy.json`; its `.policyId`, `.browserVersion`, `.runtimeHashes`, `.compilerHashes`, `.dependencyHashes` and `.rules` are the policy fields.
- Every case `.receipt` contains sourceSha256, entryContract, actual browserVersion, observer/helper/layout hashes, runtimeHashes/compilerHashes, renderId/epochs/viewport and calibrationPolicyId. Discovery receipts have null policy ID; validation and ABI receipts have the exact new ID. HTML compilerHashes is empty; JSX carries `babel.standalone.js`.
- `inputIntegrity.paths` maps 23 named inputs to original paths. `before` and `after` must have the exact same key set and hashes, `stable===true`; a separate current-source-verification record is only a point-in-time check. Admission MUST independently rehash current files, not trust that record's passed flag. The current code intentionally cannot reuse the historical successful matrix.

Required exact sets (reject missing, duplicate, extra or false-passed records):

| Array | ID field | Required IDs |
|---|---|---|
| cases | caseId | discovery-html-desktop, discovery-html-mobile, discovery-jsx-desktop, discovery-jsx-mobile, validation-html-desktop, validation-html-mobile, validation-jsx-desktop, validation-jsx-mobile |
| numberCases | caseId | number-discovery-html-desktop, number-discovery-html-mobile, number-discovery-jsx-desktop, number-discovery-jsx-mobile, number-validation-html-desktop, number-validation-html-mobile, number-validation-jsx-desktop, number-validation-jsx-mobile |
| domainCases | caseId | domain-discovery-html-desktop, domain-discovery-html-mobile, domain-discovery-jsx-desktop, domain-discovery-jsx-mobile, domain-validation-html-desktop, domain-validation-html-mobile, domain-validation-jsx-desktop, domain-validation-jsx-mobile |
| abiCases | name | entry-underscore, entry-both, value-matrix-legacy |

Require all 27 records to exist and pass, exact receipt/browser/runtime/source/ABI bindings, all closure receipts, raw references and an independently trusted policy/report file pin. Discovery-only evidence, a probe, an empty subset, or a patched old policy is not admission. Formats are HTML and formal App-script JSX; desktop 1280×900 and mobile 390×844. The three ABI records include separately labelled underscore/App selection and explicitly requested legacy compatibility; they are not permission for silent ABI fallback.

Current additional control requirements before a *future* final signoff:

- `domainCases[].keyboardControls`: all nine keys Enter, Tab, Escape, Backspace, ArrowLeft, ArrowUp, ArrowRight, ArrowDown and literal U+0020 space, with native event echo key/code/keyCode/isTrusted. Space's public key is `' '`, code `Space`; aliases such as `Space`, `Esc`, `Return`, prototype names or arbitrary letters are rejected.
- `keyboardDefaults`: Backspace deletion, left/right caret followed by deletion, Escape value preservation, Space text insertion, Tab native focus advance, Enter native default submit and Space button submit. `numberKeyboardDefaults`: native ArrowUp/ArrowDown step behavior.
- Cascade: native computed color/background-color/font-size from inheritance and CSS custom properties, with stylesheet-important values deliberately defeating contradictory inline attributes. `computed` and camelCase `computedStyle` are derived from the same native layout snapshot. The fixed list also includes font-weight/font-family/border-radius. Do not substitute inline style declarations.
- Approved r3-only container revision allows local form events via `allow-scripts allow-forms`; never same-origin/popups/top-navigation. CSP form-action none, Fetch/Network blocking and navigation blocking remain. `CONTAINER_POLICY`/`CONTAINER_POLICY_ID` identify this separate container; unchanged entryHelperSha256 does NOT imply unchanged envelope. `envelopeSha256` remains per-render actual bytes. This latest change is syntax-checked only.
- Pending, NOT performed: trusted unprevented fragment and external-HTTPS form negative controls proving no navigation/application outbound request while retaining native rejection diagnostics. No authorization to release full-key support before these pass.

## Actual captureFacts raw bindings in current source

`captureFacts(...).evidence.rawSamplePath` points to a wx-written JSON raw-layout file. There is no caller-supplied raw body. Top-level fields are:

- `schemaVersion`, `captureId`, `rawSampleId` (captureId equals rawSampleId; neither is a stable-identity dimension);
- `sourceSha256`, `entryContract`, `observerRevision`, `observerSha256`, `entryHelperSha256`, `layoutHelperSha256`, `containerPolicyId`, `runtimeHashes`, `compilerHashes`, `browserVersion`, `calibrationPolicyId`;
- `renderId`, `renderEpoch`, `viewportEpoch`, `requestedViewport`;
- `viewport:{width,height,pageX,pageY}` from native Page metrics; `frameId`, `frameIdAfter`; unknown acquisitions can have null/missing native fields and must not be promoted to assertions;
- `identity` equals a successful returned capture.identity, including actual viewport/frame, all target backend IDs, context chains and locator digests;
- `computedProperties` is the exact native snapshot style-column list;
- `request.targets` contains public alias+locator only; `request.includeDocument`;
- `metricsBefore`, `axBefore`, `snapshot`, `axAfter`, `metricsAfter`, `captureSpan`, `acquisitionState` and full `runtimeJournal`.

Actual native arrays are `.snapshot` and `.axBefore/.axAfter` (not rawSnapshot/rawAX, which belong to the older primitive inspect path). A late epoch change can invalidate publication after a native acquisition: acquisitionState is not a substitute for the returned state/outer cutoff. Use successful raw.identity and raw source/epoch/viewport/frame plus native arrays to verify a claimed fact; preserve unknown raw evidence without asserting it valid.

`evidence.captureId`, `.rawSampleId`, `.captureSpan`, `.geometryVector` and `.receipt` bind the returned projection. `.receipt` includes source/ABI/runtime/compiler/browser/policy/observer/layout/container identities. It is not a native-data substitute. The 923-owned `src/study-native-evidence-seal-v1.mjs` must read actual raw bytes, hash them, parse and compare all bindings; 508 must revalidate actual persisted evidence rather than accept caller summaries. Seal all planned scopes; missing scope/journal is not an empty-log success.

## Final native journal: chosen producer is the real 508 adapter

This is the explicitly chosen alternative to observer-owned final files. **Current r3 does not itself write a final journal file.** The real 508 adapter must implement and test this producer; a fake caller-supplied journal is not acceptable.

For every unique planned observation scope, the real adapter:

1. Retains actual render/reload receipts and successful capture identities from the real r3 session. Immediately before its normal close/abort, reads and structuredClones **that same session's actual diagnostics** as `beforeTeardown`; records monotonic `plannedObservationCutoff` with requestedAtMs, throughEventSequence, renderEpoch and viewportEpoch. No later observation is admitted into this scope.
2. Calls the already-existing single-flight close/abort. It does not create another observation deadline, replay actions, rerender, or poll for an expected value. Records cleanup error independently if any; normal teardown is not a program error and cannot erase a prior confirmed W.
3. Immediately after lifecycle settlement, reads and structuredClones **the same actual diagnostics getter** as `afterTeardown`, preserving complete raw native history and availability/completeness metadata. It must not derive an empty replacement from pageErrors/summary, nor drop an inconvenient planned scope.
4. wx-writes `scope-final-native-journal.json` under that scope's unique owned evidence directory. Proposed payload schema `v04-scope-final-native-journal-r3-1` contains `producer` (adapter module hash plus actual observerProvenance), opaque public scope ID, actual `renderReceipts`, `plannedObservationCutoff`, full `beforeTeardown`, full `afterTeardown`, and lifecycle outcome. Emits `{path,sha256,byteLength,schema,scopeId}` computed from actual written bytes for the 923 sealer. This adapter producer is a required remaining implementation/integration test, not an already-passed artifact.

Current r3 diagnostics exposes `observerProvenance`, complete cumulative `runtimeJournal`, `pageErrors`, `networkJournal`, current/epochs/pending/cleanupFailure/ownedProcesses. `runtimeJournal.journals[]` preserves each render's sourceSha256, entryContract, renderId/renderEpoch, target setup and native events. No successful-render receipt is reconstructed from caller text.

### Observation vs research teardown

Current event fields additionally include `phase: planned-observation|research-teardown`, monotonic `observedAtMs`, sourceSha256, actual owning renderId/renderEpoch and viewportEpochAtReceipt. `replayStage` is observed host stage, not a claim of causal attribution. Per-render `observationCutoff` is set before close/abort/new-render invalidation and includes reason, observedAtMs, throughEventSequence and epoch/stage metadata.

Late native errors received on an old transport are retained in its owning old render journal as research-teardown; they must not be attached to a new renderer or synthesized into business errors. Raw native params remain intact. Events after transport closure cannot be observed, so completeness is bounded to the declared observation interval/received native stream, not a post-process omniscience claim. Intentional closure does not turn a previously complete journal incomplete; a real transport loss/drop remains explicit. The four declared native filters are exceptionThrown, exceptionRevoked, consoleAPICalled(type=error), Log.entryAdded(level=error).

The final producer/sealer must verify each capture's event prefix by sequence and unchanged native payload against the final cumulative journal, including source/render ownership. Retain the full final journal, but business comparison selects planned-observation events within the preregistered scope cutoff. Keep research-teardown events as audit evidence, not programError. Missing/incomplete planned error journal is unknown, never success; do not overwrite established business counterexamples merely because normal cleanup occurred.

`networkJournal` is external-scheme CDP target telemetry, NOT OS packet monitoring. Its new implementation has not yet passed the required form negative controls. No OS/network-isolation claim is made.

## Concrete remaining work at WIP handoff

1. Wire containerPolicyId into full-run policy derivation and unit fake-policy bodies; adjust the F0-envelope comparison to permit only the documented r3 allow-forms delta. Current last source edit postdates the 35-test pass.
2. Implement the two approved unprevented-form negative controls and verify the safe preventDefault positive native submit control. The prior probe correctly failed because the old sandbox blocked submission before the handler.
3. Validate all latest journal phase/cutoff/network/raw bindings and the actual 508 final-journal producer against 923 sealing, including capture-prefix/final consistency.
4. Update API documentation to the final accepted contract, freeze new dependency hashes and rerun the **entire** 27-case real Edge matrix plus current unit tests. No signing/reusing MDiU66 for changed source.
5. Independently verify final current-file hashes and all owned browser cleanup, then and only then consider public study-control admission. Natural pilot and model/API calls remain separately gated.
