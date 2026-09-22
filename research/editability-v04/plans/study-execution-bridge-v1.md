# Study execution bridge v1 — real r3 composition, native execution admission pending

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

**Implemented API, not a completed native full-chain run.** Parent confirmed the current full r3 calibration report/policy has not yet been generated. No browser, model, natural generation, pilot data or future-private files were accessed in this round. The default script preflight is browser-free. Native execution is intentionally blocked until the complete calibration/admission manifest exists; synthetic controls never close that gate.

## 1. Actual production dependencies, not boolean evaluator stubs

- `src/study-execution-bridge-v1.mjs` imports independent `captureBaselineR3`, `evaluateAcceptedR3`, `persistEvaluationReceiptR3`, `normalizeEvaluationReceiptR3` and `endpointExpectedKeysR3` as its default path.
- `src/study-runtime-v1.mjs` uses actual r3 `staticGate`, `buildEnvelope`, native browser `start`, and branded `loadCalibratedPolicyR3`. Common postchecks compile the candidate with the same Babel/React vendor bytes and entry ABI as baseline/candidate browser rendering; stock method scope restrictions are **not** reused as the public safety gate.
- `src/study-public-prepare-v1.mjs` obtains original public target facts from an actual uninstrumented browser capture, transforms only a preview copy with generic raw-AST host markers, then obtains target provenance from native captured attributes. It never guesses FULL's targetId from static locator matching. Its plan documents native identity/capture/hash checks, original-only public facts, transform costs and no-edit roundtrip comparisons.
- `scripts/run-study-controls-v1.mjs` contains two new public handwritten direct/mapped controls; it does not read a private or pilot dataset. Its LLM transport is explicitly a sentinel patch provider, not a real model baseline. The native pathway is implemented and can be executed after independent admission; it has not been executed yet.

The trusted runtime uses `browser-session-r3.buildEnvelope`, named-App ABI, pinned Babel compiler and shared React vendor files. It is the **same research runtime** for uninstrumented baseline, public preview-copy preparation and candidate evaluation. This does not certify byte/behavior equivalence to the product desktop preview wrapper; the returned runtimeSemantics states this limitation explicitly. Product engine is read-only and pinned separately, never modified or copied wholesale.

## 2. Exact lock and independent receipt lifecycle

For every accepted candidate:

1. The method runner has already reconstructed patch/hash and applied the same common public postchecks, then locked accept in memory.
2. The bridge reserves the unique source/task/method slot and creates `accept-<randomUUID>.json` with **exclusive `wx`**, mode 0600, write/fsync/readback. It contains exactly the approved lock fields:
   `{id,status:'accepted',candidateSourceSha256,originalSourceSha256,lockedBeforePrivateEvaluation:true}`.
3. Lock descriptor path/hash/byte count is retained. The lock is deep-frozen and its actual bytes rechecked before invoking the independent evaluator and after it returns. Existing paths are never overwritten or retried with a second proposal/lock.
4. `evaluateAcceptedR3` receives the original opaque branded baseline, actual candidate source/hash, persisted frozen lock, and independent plan/calibration/environment/policy. It owns the **single candidate replay** shared by R/G; the runner executor only persists/hands over the lock and does not replay a second time.
5. Independent `persistEvaluationReceiptR3` audits and writes its own complete evidence bytes, now exactly `JSON.stringify(data,null,2)+'\n'` UTF-8. The bridge never assembles a substitute summary hash.
6. `normalizeEvaluationReceiptR3({receiptPath,expectedSha256,expectedBytes,expectedSlotBinding,expectedAcceptanceLockId})` reopens actual bytes and re-audits them. Its R/G rows plus complete `independentEvaluation` envelope are retained by runner.

The actual bindings are `evaluationSchema:'v04-accepted-evaluation-r3-1'`, `normalizerVersion:'v04-evaluation-normalizer-r3-1'`, raw receipt schema `'v04-independent-evaluation-receipt-r3-1'`. Slot binding is exactly sourceId/taskId/method/slotId/originalSourceSha256/candidateSourceSha256/acceptanceLockId.

Rejection produces no acceptance file and no candidate evaluation. An evaluator failure after accept leaves the persisted lock and A/U_A record, not rejection or success. Missing authentic normalized receipts prevent downstream scientific conversion; the bridge does not invent an unavailable receipt on behalf of the independent evaluator. Any partial raw receipt already persisted remains on disk.

Receipt directories must already exist and be independently owned, not hostile shared directories. The helper rejects linked ancestry/traversal and uses exclusive creation, but is not an OS sandbox or portable openat security boundary. Future real private evidence remains within the independent execution owner's storage/log access boundary. Only this task's public handwritten output is suitable for public release.

## 3. Baseline, preparation, missing generation and masking

Baseline capture occurs once per original task before method proposals and always uses **uninstrumented original UTF-8 bytes**, not a marker-enriched source. Full baseline evidence is preserved separately while its live opaque brand stays in the bridge closure. Only eligibility masks and endpoint-required opaque key IDs enter the trusted runner; none enters methods, oneshot or public browser query payloads.

Original public browser location is shared Q. If it succeeds but preview instrumentation/marker/roundtrip mapping fails, preparation retains original publicDom and Q, omits provenance, and records why. FULL/SCOPE_OFF then both lack a preguard candidate; PROVENANCE_OFF/LLM do not lose Q solely because provenance instrumentation failed. Original ambiguity/missing/unavailable capture remains a shared preparation failure. Marker attrs and preview source never enter provenance-free methods.

`originalSource:null` represents a missing generation source. It remains null with sourceHash:null across all four method slots; no fake empty source/hash is created. A 16-source × four-task failed-generation control preserves **256 planned uncalled method slots**, P=64 per method per endpoint. No baseline/method/model callback runs for these entries. Explicit unscreened slots retain notScreened. Duplicate tasks are rejected before any baseline effects.

R3 noneligible raw endpoints deliberately retain all-false booleans and a valid independent binding with `classification:null`, plus full raw notMeasured rows. `methods-v1-analysis.mjs` now validates that bound object and outputs statistical `outcomes[endpoint]:null` under the unchanged eligibility mask. It neither changes ineligible to U_A nor changes E. G-only (R no-op exclusion) and R-only (G original-health failure) controls pass the actual analysis-v2 audit after persisted normalization.

## 4. Native admission and exact invocation

Browser-free preflight:

```powershell
node scripts/run-study-controls-v1.mjs --check-only
```

It prints `executed:false`, zero browser/model calls, source identities of the two handwritten controls and **current** fixed public dependency hashes. A source hash listing is not an admission signature.

Once parent/independent owner supplies the complete passing r3 calibration report, exact policy and signed public manifest:

```powershell
node scripts/run-study-controls-v1.mjs --execute-trusted --manifest <public-admission.json> --out <new-control-output-directory>
```

Manifest fields:

```js
{
 schemaVersion:'v04-study-controls-admission-1', id,
 authorizedTrustedControls:true, calibrationReady:true, evaluatorContractReady:true, authorizedNaturalExecution:false,
 browserPath, runtimeDir, productPackagePath,
 productEngineSha256:'76d7043215b025430fbdbb6e27666a8807c3ca922aca0b273770f1490eedb56e',
 sourcePins:/*exact inspectStudySourcePinsV1() dictionary at freeze*/,
 calibrationReport:{path:/*full passing public report*/,sha256:/*external approved hash*/},
 calibrationCaseCoverage:{value:[/*predeclared passed native validation case IDs*/],numberValue:[...],formControlLabel:[...],gap:[...],grid:[...],order:[...],documentOverflow:[...],reload:[...],setViewport:[...]},
 calibration:{policyPath,expectedFileSha256,expectedObserverSha256,expectedObserverRevision,
   expectedEntryHelperSha256,expectedLayoutHelperSha256,expectedRunnerSha256,
   expectedRuntimeHashes,expectedCompilerHashes},
 measurementPolicy:/*frozen measurement policy*/, viewport:{width:1280,height:900}
}
```

Manifest signer must substantiate full-domain report↔policy↔environment association, not merely supply any JSON with passed=true. The runtime additionally requires browser-calibration-r3-report-N schema, trusted-control runKind, stable equal inputIntegrity before/after, observer/helper/runner pins associated with the loaded policy, and every predeclared coverage case to be uniquely present/passed with policy/runtime/compiler/browser-bound render receipt. It refuses passed:true-only reports, missing coverage, unrelated policy receipts and pin drift. Final browser-owner report shape must satisfy this contract or receive a reviewed explicit adapter revision; no fabricated report conversion is allowed. It checks report bytes/hash/pass, all fixed source pins, the independent calibrated loader, browser/helper/runtime/compiler identity, and source-bound static gate. Every original/preview/candidate source is independently archived once by content hash, never in the product tree. Fresh session source copies have their own trusted fixture paths. Native runtime and prepare factories use private WeakSet branding: arbitrary passing callbacks, control-mode preparations or plain manifest-shaped objects cannot masquerade as native dependencies.

The current entry point deliberately admits **DEV handwritten controls only**, not natural pilot/formal execution. The separate `invokeGenerationSlotV1` is an injected single-call public-requirements/runtime-contract transport boundary tested with private sentinels; it is not a provider SDK/client and makes no API call unless an authorized execution owner supplies one. It forwards neither edits nor private expected/baseline and does no repair/retry.

## 5. Current evidence level and remaining gate

New tests exercise real read-only stock engine, real r3 measurement/baseline/evaluator/auditor, actual disk lock and receipt persistence, and real independent normalizer; acquisition is explicitly synthetic in those controls. The public preparation suite uses fake native-wire captures to prove projection/instrumentation/binding failures and **labels those results control-ready, never native-ready**. This is stronger wiring evidence than mocked S booleans, but still not a real browser full-chain receipt.

Initial development integration caught an undefined event slot identifier after successful normalization (accepted rows became U_A rather than S). Corrected to the locked execution.slotId and retained regression coverage. No historical native success was manufactured to hide that development failure.

Remaining concrete blocker: complete current-r3 native calibration/report/policy and independent admission were not available at execution time. Therefore native full-chain control execution, instrumentation/runtime roundtrip witness, actual risk/coverage outcomes, and pilot readiness remain unproven. The script is ready for that explicitly authorized next step; no natural calls or private data access have occurred.


A focused read-only review also found null/undefined instrumentation errors could bypass the Q-preserving fallback; optional chaining plus regressions now retain original public location with no fabricated provenance. The report gate was strengthened from a mere passed boolean to the explicit full-report/policy/case bindings above. All native report requirements remain pending actual browser-owner evidence, not satisfied by the synthetic validator controls.

### Independent raw-native boundary remains open

Parent's independent review found an evaluator/browser reload semantics mismatch (candidate must reload candidate bytes) and deeper raw-native audit gaps: current independent receipt replay validates typed measurement records, not a fresh decode of externally hashed raw native snapshots; raw sample path references are not yet complete content-hash bindings; source/epoch/native identity and mandatory native-journal coverage require owner fixes and signoff. Hashing/preserving the typed receipt does **not** close those gaps. The new native manifest therefore additionally requires explicit `evaluatorContractReady:true` only after the independent contract review signs off; absent it native construction is blocked. This is an external authorization condition, not a proof synthesized by this module. Results explicitly retain `nativeRawEvidenceIndependentlyReverified:false` in this revision. Do not claim native raw independence or pilot readiness from these tests or saved hashes.

The first combined saved test attempt (90/94) caught concurrent independent-r3 strengthening: the synthetic fixture lacked explicit per-run runtime scopes, correctly causing baseline unresolved and uncalled methods. The fixture now explicitly lists its synthetic complete run scopes; it does not fabricate native journals, does not weaken owner code, and does not certify native evidence. The failed TAP is preserved next to the final rerun.
## 6. Final local receipt

`results/study-bridge-v1-tests-attempt-02.tap`: **94/94 passing**, zero failures/skips. It combines the earlier method/runner tests with 31 new bridge/prepare/runtime controls; it is not 94 independent scientific tasks. Final command window 2026-09-20T15:56:17.9779134Z–15:56:20.2408943Z, wall 2.2629809 s, TAP duration 2213.0211 ms. Failed `attempt-01.tap` remains available. `results/study-bridge-v1-preflight.json` records only current public dependency pins and `executed:false`, browserCalls=0/modelCalls=0, not signed admission or an executed native experiment. Concurrent owner dependency snapshots are point-in-time and need freezing before actual native use.

Per-revision author/test costs and hashes are in `public-contracts/study-bridge-v1-cost-events.json`; unknown author labor, model authoring usage, CPU/memory and money remain null. No natural source or experimental model call occurred.