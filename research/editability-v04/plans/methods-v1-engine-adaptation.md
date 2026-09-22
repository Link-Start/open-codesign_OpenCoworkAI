# methods-v1 research engine adaptation

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

## Source examined and boundary

Read the actual public product file, all 1,010 lines:

`<product-repo>/apps/desktop/src/main/source-edit-engine.ts` (historical external worktree; no adjacent checkout required)

SHA-256 of its file bytes at inspection:

`76d7043215b025430fbdbb6e27666a8807c3ca922aca0b273770f1490eedb56e`

The product worktree remains read-only. This research adapter does not replace, patch, copy wholesale, or loosen the product engine. No product write or product safety bypass is performed. It computes in-memory research candidates only. These tests are not a product-readiness assessment or a general JavaScript safety proof.

Only new owned outputs:

- `src/methods-v1-engine.mjs`
- `tests/methods-v1-engine.test.mjs`
- `plans/methods-v1-engine-adaptation.md`

## Injection and request/response contract

```js
const { candidate, fallback, guard } = createEngineV1({ parse, stockEngine });
// stockEngine = { analyzeSourceEdit, planSourceEdit }; loaded by the caller.
```

All three functions are synchronous. The engine has no filesystem, import-loader, network, source-mapping, fixture-identity, or DOM access. `parse` is Babel's parse function. Original source is parsed statically, never executed. A fixed synthetic `App.jsx` path selects JSX-only parsing because the protocol admits JSX, not TSX. Type-annotated TypeScript source is rejected.

```js
{
  source, sourceHash, // original text and its SHA-256
  scope: 'source-definition',
  operation: { kind: 'set-text', value },
  // alternatively set-attribute with name, or set-style with property
  locator: { tagName, id?, text? },
  provenance: { sourceHash, targetId: 'start:end' } // required by candidate; omitted for fallback
}
```

A candidate is `{status:'candidate', patches:[{start,end,expectedText,replacement}], content, sourceHash, candidateHash, targetId, evidence}`. Both output `sourceHash` and `candidateHash` are SHA-256 of candidate **content**, not the original source or a serialized object. Evidence includes `originalSourceHash`, exact original host span, selection mode, field kind, and shared-safety mechanism. Rejections are `{status:'rejected',reason}`. Guard returns `{pass,reason}`. It does not mutate the candidate.

## Actual separation

1. Validate source hash, scope, and basic locator shape. Run stock `analyzeSourceEdit` against the **unchanged original source**. Every whole-source rejection is retained, including unsafe-source, unsupported-module/entry, reused-entry, and cross-file-source. An early stock structural entry rejection is never reinterpreted as a guard-only exclusion.
2. Run stock `planSourceEdit` on a small **fixed** known-direct validation source containing all allowlisted field types. This validates the requested operation/schema, payload bounds, CSS policy, reserved runtime controls, escaping, and literal representation without depending on the original target's scope. Its patch replacement is reused, not reimplemented. This fixed fixture never contains rewritten original source and does not replace the original-source safety analysis.
3. Independently scan the raw AST for a JSX host matching the locator. The candidate path requires provenance and an exact current `start:end` host span and matching hash; missing provenance is rejected rather than silently falling back. No stock target list or provided mapping selects the target. Multiple matches without exact provenance reject.
4. Independently extract only existing, statically owned text, attribute, or inline-style literals. Text folding/string-expression boundaries and style ambiguity checks mirror the inspected product contract. Check the target and host ancestors for disallowed hosts, spread/namespaced/duplicate attributes, reserved provenance attributes, children props, and mutable/customized hosts. These checks are needed because stock analysis deliberately omits field/opening information for map/custom scope-excluded descendants. Custom-component ancestry itself is not rejected here.
5. Build one raw-source patch using the independent span and stock-validated replacement; reparse the resulting content. Old-literal size bounds are retained. Compare the independently located target to stock analysis only after extraction. Any nonstructural target failure rejects. For direct supported targets, stock original-source planning must return the identical patch/content/hash **before emission**, preventing adapter drift from becoming a SCOPE_OFF benefit.
6. The later `guard(request,candidate)` verifies the supplied patch bounds, expected text, rebuilt content and hashes, source/provenance and stock value validation, consults stock original-source analysis/plan, and checks exact patch/content/hash equality for supported targets. It does not call the candidate builder or independent extractor again, so the paired pre-guard candidate is never replaced. Only stock target reasons `non-direct-source` and `custom-component-ancestor`, paired with stock planning's `unsupported-field`, become `scope-unsupported`. The guard fails for maps, expression-owned hosts, and custom-component descendants, while their independently safe static candidates already exist.

The special scope reasons never waive safety checks or manufacture missing fields. Dynamic text, dynamic attributes/styles, missing properties, unsafe originals, reserved replacement values, and unsupported operations have **no candidate**. `guard` on a rejected result returns `no-candidate`, not scope-unsupported. The parent wrapper owns experimental SCOPE_OFF behavior; this engine exposes no product-apply capability or switch that disables safety.

## Unprivileged fallback

`fallback(request)` calls exactly the same builder with provenance use disabled. It does not read `request.provenance`, `request.mapping`, any mapping-like field, or external mapping, even if getters are injected. It uses only original source plus public locator fields for static selection. Tag names are exact; IDs require a direct static string attribute; text requires the same direct static text/string-expression field used for extraction. JSX text uses line folding rather than generic HTML trim. Ambiguity rejects even when an injected mapping could disambiguate it.

PROVENANCE_OFF request projection and mapping removal belong to the parent. Its later guard request must also be that projected request. No provenance/mapping hints are injected into fallback. Stock analysis does of course produce internal target spans for safety/guard verification; those are not used to locate the raw-source fallback target.

## Deliberate differences and limits

- This is a small independent extraction adapter with injected stock safety/planning, not a fork of the 1,010-line engine.
- Product stock analysis remains the authority on global safety and its existing limitations; this does not claim arbitrary JavaScript safety.
- The stock engine combines structure and extraction. The adapter separates independent extraction from structural guard, permitting **research candidates** for static map/custom spans that stock will not apply.
- Only the two named target-scope reasons are separable. Unsupported entry shapes, imports/exports, all global safety failures, unsupported fields, and opening hazards remain shared rejections.
- The adapter requires a public locator even when provenance exists, verifies locator agreement with the exact span, and does not infer rendered dynamic text or IDs. This is deliberately narrower than arbitrary DOM-to-source mapping.
- Fixed JSX-only parsing preserves the JSX protocol subset of the stock engine; TSX is intentionally not admitted. No external file is inferred.
- Stock validation fixture and direct-target patch comparison reduce safety/serialization duplication. A few small static extraction/opening checks duplicate stock semantics because stock withholds those field details under structural exclusions. Future product policy changes require review against the recorded SHA, not silent equivalence claims.
- Candidate hashes are content hashes, not authentication tokens. Guard patch reconstruction and stock equality checks verify integrity without regenerating a candidate. Neither API writes files, applies product changes, or executes the source.

## Dependency and validation record

Public product `apps/desktop/package.json` declares `@babel/parser` 7.29.2. Its installed package is available through the product desktop's `node_modules` resolution; the product root has no direct `node_modules/@babel/parser` entry. Tests use `createRequire` based on that **public package path**, require Babel there, and use the already installed `tsx/cjs/api` to load the unchanged TypeScript stock engine. No installs, network, private research, credentials, or v03 artifacts were used.

Run from this research root:

```sh
node --test tests/methods-v1-engine.test.mjs
```

Observed on Node v24.19.0: **20 tests passed, 0 failed**, using the actual stock engine. Hand-written cases cover direct exact patch equality; map/custom same candidate before/after guard; custom definitions; unsupported dynamic text; escaped attributes and numeric styles; invalid CSS/runtime controls/schema; unsafe source under maps; all-stock rejection retention; opening/ancestor hazards; shared/computed/spread/duplicate/dynamic styles; fallback no-mapping/no-provenance getters; fallback ambiguity despite injected mapping; stale/non-exact provenance; tampered candidates; direct stock-patch drift rejected before candidate emission; mandatory FULL provenance; JSX-only rejection of TypeScript; and instrumented verification that guard does not rerun independent extraction.

This local adapter test result is not an experiment result, general compatibility claim, or release/readiness claim. The independently owned wrapper and runner also require their own broader tests and interpretation.

### Actual adapter/wrapper/runner integration controls

Two additional hand-written tests use the actual injected product engine through `createMethodsV1`, and through `runExperimentV1`. Public AX/text locator evidence is projected from `publicDom` into the static engine locator. They verify map FULL rejection and SCOPE_OFF proposal/acceptance with the exact same pre-guard candidate/hash, reconstruction of output from original raw source and patches, and a mapping-/provenance-free PROVENANCE_OFF fallback request. A direct fallback remains supported; a map fallback is still structurally rejected by FULL guard policy.

The runner control performs real Babel JSX parsing, actual stock analysis for entry/global-source validity, and exact public patch reconstruction/hash checks. Its preparation is a hand-authored fixture receipt, **not measured DOM provenance**. Its executor is expressly a synthetic no-browser control and its evaluator returns `unknown`: the accepted map SCOPE_OFF row is `U_A`, and paired scope interpretation is `uncertain`, not success or prevented harm. The report remains `dependency-injected-controls-only` and `formalReady:false`. No runtime/F1 readiness, browser execution, or measurement success is claimed by these tests.
