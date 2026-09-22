# Four methods + proposal runner v1 — public implementation contract

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

Status: **research adaptation / DEV control implementation, not F1 frozen, not pilot admission, not scientific execution ready**. Adds new files only; F0 snapshot and all r2 sources remain unchanged. Product worktree is read-only. No v03 input was used; no future private material or credential file was read. No real model/API or browser/pilot collection was invoked.

## 1. Files and product identity

- `src/methods-v1-engine.mjs`: compact research adapter around injected, unmodified product `analyzeSourceEdit` / `planSourceEdit` and Babel parser.
- `src/methods-v1.mjs`: four method wrapper, allowlisted public projection, immutable shared candidate, one injected oneshot call, original-offset patch reconstruction.
- `src/experiment-runner-v1.mjs`: planned slots, common preparation/postchecks, acceptance lock, independent execution/evaluation, endpoint funnels and paired-scope audit.
- `src/methods-v1-public-checks.mjs`: common parse + existing r2 entry compiler + injected independent common safety policy; no source execution in Node.
- `src/methods-v1-analysis.mjs`: exact Cartesian-matrix checked projection to `analysis-v04-input-1`.

Historical product source (external worktree, not a required adjacent checkout): `<product-repo>/apps/desktop/src/main/source-edit-engine.ts`; examined historical SHA256 `76d7043215b025430fbdbb6e27666a8807c3ca922aca0b273770f1490eedb56e`. Exact adapter differences and dependency loader control are in `methods-v1-engine-adaptation.md`. This is **NOT stock FULL**: a research-only preguard field extractor exposes structural candidates that stock hides. No 1000-line engine copy and no product safety switch. Executor must bind the exact stock/parser/adapter hashes, not assume the worktree never changes while a product PR proceeds.

## 2. Public method request (v1)

```js
{
  source, sourceHash, userGoal, scope: 'source-definition',
  operation: {kind:'set-text', value}, // or set-attribute/name; set-style/property
  locator: {by:'role', role, name, exact:true, within:/*recursive AX locator*/},
  // alternatively {by:'text',text,exact:true,within} or {by:'form-control-label',label,exact:true,within}; legacy tagName/id/text is DEV-only
  publicDom: {tagName, id, text, attributes:{title,placeholder,alt,role,'aria-label','data-testid'}},
  environment: {runtimeId,entryContract,compilerVersion,observerVersion,policyId},
  provenance: {sourceHash,targetId:'originalStart:originalEnd'} // FULL/SCOPE_OFF ONLY
}
```

Unknown fields are never copied. No expected, private baseline, acceptance feedback, evaluation token or task/check catalog enters a method or oneshot transport. AX `within` is recursively projected (max depth 8). DOM facts are shared semantic evidence; `outerHTML`, arbitrary nested objects, `data-codesign-*`, `data-ocd-*`, source offsets/marker attributes are not in the public DOM allowlist. All four receive the same projected source/goal/AX/publicDOM/environment; FULL/SCOPE_OFF additionally receive explicitly disclosed provenance. Public strings must originate from public task semantics/facts, not privately derived answers. Allowlisting is not an information-flow proof if an upstream trusted owner puts secrets into an allowed field.

For the deterministic engine only, publicDom tag/id/text becomes its static source locator; the full semantic AX/form-control-label locator is retained as semanticLocator internally and remains locator for LLM. Label queries never imply a textbox role or an input:type gate. Source AST offsets inferred independently from original raw source are allowed in PROVENANCE_OFF; **renderer-supplied mapping, provenance IDs and instrumented HTML are not**. Source is not rewritten/cleaned/instrumented to manufacture eligibility. Original archive bytes remain the common source. Legacy raw-source marker content, if any, must be assessed by the original-source protocol and safety owner, not silently stripped to change the source.

## 3. Methods and candidate/guard boundary

`createMethodsV1({engine,oneshot}).propose(method, publicInput)` returns:

```js
{status:'proposed'|'rejected'|'error'|'public-protocol-rejection', reason,
 candidate:null|{status:'candidate',patches,content,sourceHash,candidateHash,targetId,evidence},
 guard:null|{pass,reason}, apiAttempts, usage}
```

- FULL requires original-hash-bound provenance. The engine retains original product safety analysis, operation/value validation and independent static-field checks. It emits one preguard candidate, then stock structural scope can reject it.
- SCOPE_OFF uses the **same immutable candidate object/hash and same generator** from the pair cache. Only structural scope is disabled. Non-scope unsafety/unsupported fields/missing mapping yield no candidate in both. It cannot turn a stock global safety failure into an edit.
- PROVENANCE_OFF receives no provenance field, even if the incoming caller supplied it. It uses independently parsed raw source + public tag/id/text to resolve a unique static target. Ambiguity is a rejection, not broken by a hidden mapping. The same stock safety and scope checks remain. This changes candidate availability and is a component contribution contrast, not the pure scope contrast.
- LLM_ONESHOT calls injected `oneshot({schemaVersion:'v04-oneshot-1',request,responseContract})` once. Transport returns `{proposal:{patches:[...]}}` or a strict raw JSON string at `proposal`, with optional usage. No markdown extraction, repair, second parse strategy, retry, tool loop or feedback. Malformed output is public protocol rejection; thrown transport failure is methodError. Credentials/network transport are absent from this implementation. Execution owner freezes legal transport/config and verifies its internal retry setting; one JS callback invocation alone cannot certify a third-party client does not retry internally.

Patch offsets are JavaScript UTF-16 source offsets; SHA256 is of exact UTF-8 encoding of source string. Patches are in ascending, nonoverlapping original-source order with mandatory exact expectedText. Output hash and candidate hash both bind reconstructed content. No-op qualification belongs to independent pre-edit evaluation; this runner does not infer private no-op state. R requires non-no-op under the protocol, G does not acquire that extra gate. A method no-op rejection leaves supplied G eligibility unchanged and is not success.

## 4. Runner dependency contract

```js
await runExperimentV1({
  plan:{datasetId,datasetKind:'dev'|'pilot'|'formal',tasks:[{
    sourceId,taskId,briefId,configId,originalSource,originalSourceHash,
    eligibility:{R:'eligible'/*or originalIneligible,eligibilityUnresolved,upstreamMissing,notScreened*/,G:...},
    publicRequest:{userGoal,locator,operation,scope,publicDom?,environment?},
    expectedKeys:{R:[/*private owner identifiers*/],G:[...]}, evaluationRef:/*opaque trusted-owner handle*/,
    prepare:true, propose:true // false leaves planned uncalled records, not deletions
  }]},
  methods, prepare, publicCheck, executor, evaluator, evaluationBinding
});
```

- `prepare(publicProjection)` called once per task with an eligible R/G union; returns `{status:'ready',publicDom?,provenance?}`. Public preparation is shared, independent of method support; failure is E→preparationFailure, not originalIneligible. No evaluationRef/expectedKeys reaches prepare.
- `publicCheck({source,content,patches,candidateHash,...publicProjection})`: identical callback for every proposed candidate. Exactly one passing receipt for each `parse`, `entry`, `patch-safety` required. Missing/duplicate/failing checks reject publicly **before** execution. `createPublicCheckV1({Babel,safetyCheck})` offers real parser/ABI/rebuild checks. Common `safetyCheck` must be bound by executor owner; it must not reuse stock scope/edit-support rejection to erase the scope ablation.
- Acceptance decision is locked before independent executor/evaluator. `executor(lockedCandidate)` receives original source, candidate source/hashes/patches, accepted=true, opaque evaluationRef, method/slot identifiers. It must reload the same original runtime and replay the frozen complete scenarios/viewports, not an easier runtime. No rejected candidate reaches it. Runner itself performs no filesystem writes.
- `evaluator({candidate:lockedCandidate,execution})` is independently injected, private expected values held in its closure/storage. Return `{R:[{key,status}],G:[...]}`, status `pass|confirmed-violation|unknown|notMeasured`. This is an integration boundary for r3 evaluation owner, not a replacement for their temporal/baseline policy. Unknown, absent/duplicate/unexpected keys are audit failures/UA; independent confirmed violation dominates unknown while retaining uncertainty. No private evaluation feedback is ever sent to a method.
- Missing executor/evaluator or thrown error **does not rewrite accepted to rejection**; checks become notMeasured/U_A. In-memory accepted objects are frozen and immutable to callbacks. JS DI is not an OS/process security sandbox; a malicious callback in the same Node process is not a blinded executor. Independent process/access/log governance remains mandatory.

Each source/task/method is unique and always starts from original; R/G masks use one proposal and one replay, not duplicate methods. Duplicate task slots and duplicate/empty required-key lists fail before calls. All planned records remain, including missing source/not screened, failed/not-executed preparation, method rejection/error/public-protocol rejection and proposal planned uncalled. The runner always declares `formalReady:false`; passing synthetic callbacks cannot manufacture readiness. Independent integration evidence is preserved but not certified by this code.

## 5. Records, analysis and scope attribution

Each slot records original/output/candidate hashes, exact patches, guard, rejection/methodError/publicProtocolFailure, preparation/proposal/execution status, acceptance lock, endpoint evaluation and observed cost fields. Rejected candidates retain candidate hashes/patches for audit but are not applied; no private outcome is assigned to rejection. Complete P/E/Q/A and A=S+W+U_A algebra is enforced; zero-denominator rates are null.

`pairedScopeAuditV1(records, endpoint)` requires FULL rejection by guard plus SCOPE_OFF accepted with identical non-null candidate hash. Mapping/no-candidate rejection is never a scope opportunity. Report prevented-W, foregone-S and uncertain, not rejection as success. Classification only uses independently evaluated OFF candidate. `toAnalysisInputV1({experiment,design,evaluationBinding?,costEvents})` emits the agreed analysis contract with brief/config/task/method Cartesian closure. The interface revision requires independent root/endpoint bindings, raw receipt-preserving independentEvaluation, and an externally frozen maxBriefsPerCluster; it refuses bare runner outcomes. See `methods-v1-analysis-bridge-v1.md` for exact fields and remaining r3 bridge requirements. Fill briefId/configId on all planned tasks; missing original source still gets its own planned row. Statistical owner, not this code, chooses cluster inference and signs design independence.

## 6. Costs and current validation limits

Public author cost event is separate at `public-contracts/methods-v1-cost-events.json`. Historical active author time, tokens/money/CPU/memory remain null. No experimental API/browser was called. Per-proposal wall milliseconds measure callback/precheck duration, not total browser/evaluation time or active human labor; transport invocation counts do not independently verify provider billing/network retries. Method response `apiAttempts` is the legacy callback invocation field; runner renames it `transportInvocations` and records actual `experimentApiAttempts:null` after injected LLM calls because no network receipt is verified. Deterministic methods and uncalled transports have actual experimentApiAttempts=0. Injected controls are engineering tests, not natural-program effect estimates or private/pilot samples.

Tests use hand-written sources, actual read-only stock engine integration where labelled, and explicit synthetic independent executor/evaluator controls elsewhere. They cover same candidate, true no-mapping fallback, one call, no write on reject, locked accept, missing/duplicate slots/checks, no-private sentinel, raw-source/patch reconstruction, funnel closure and analysis matrix completeness. Browser r3 calibration, real executor/evaluator bridge, common frozen safety policy, private isolation, transport execution signoff, pilot and F1 manifest are still separate gates. Do not promote this package to full F1 merely because these tests pass.

### Historical v1 public control receipt

`results/methods-v1-tests-attempt-02.tap`: **48/48 passed**, 0 failures, 0 skipped. Final run window 2026-09-20T09:59:18.7002149Z–09:59:19.2052278Z (observed command wall 0.5050129 seconds; TAP process duration 453.6834 ms). Attempt-01 is retained as historical evidence before the final null/undefined rejection regression. These overlapping test families are not independent scientific samples.

Focused independent code review found and prompted regressions for (1) proposal mutation during awaited public postcheck, fixed by immediate deep-cloned immutable proposal snapshot; (2) mapping getter failures coupling provenance-free methods, fixed by one sanitized mapping capture whose failure does not erase public Q, plus conditional method projection; (3) JavaScript null/undefined rejection reasons aborting the ledger, fixed by null-safe error classification. All are included in the final 48 tests. Preparation evidence is also snapshotted; neither methods nor later evaluator mutations can revise its public facts.

Interface revision: final statistics binding and form-control-label support are documented in `methods-v1-analysis-bridge-v1.md`. `decisionLocked` is separated from `acceptanceLocked`; only accepted candidates have the latter true. The prior 48-test receipt is retained and does not bind revised source bytes.
