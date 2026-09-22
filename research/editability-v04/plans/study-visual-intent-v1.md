# Study visual-intent public projection v1

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

Status: implemented bounded method/projection and genuine source-compile controls; **not native full-chain readiness, pilot admission, or natural execution authorization**.

## Public request shape

The existing request remains `{source, userGoal, scope, locator, operation}` (or the existing `originalSource` / `publicRequest` wrapper). The only added operation is:

```js
{
  kind: 'set-visual-intent',
  intent: 'borderBoxDistance' | 'visualColumns',
  value: string | finite_number,
  unit?: 'css-px',
  axis?: 'horizontal' | 'vertical',
  itemLocators?: public_AX_locator_array
}
```

`finite_number` describes the JavaScript numeric type, not a literal wire keyword. Values retain type and spelling: `24`, `-2.5`, `'24.0'`, and `'2'` are not coerced. No positivity/integer restriction or intent-dependent requirement is invented. Optional fields remain absent when absent. Unknown nested fields are projected away through allowlists; unsupported intent aliases, nonfinite/nonstring values, malformed optional fields, and malformed item locators remain invalid public protocol, not method capability rejection.

Item locators use the existing public `by: 'role' | 'text' | 'form-control-label'` forms, `exact: true`, and recursively public `within`; legacy source/DEV locators and unresolved query references are not accepted inside this newly defined AX array. Existing top-level locator compatibility is unchanged. Projection is cloned/frozen and does not mutate input. Unknown expected/baseline/oracle/source-range fields are not forwarded. Public request text/source/value remain legitimate public content, not a keyword-based secret filter.

Ordinary `set-style` still accepts any string property at the public projection boundary; there is no MVP7 property allowlist. Deterministic engine capabilities are separate from what can be expressed publicly.

## Semantics and method behavior

- `borderBoxDistance` means the visible border-box separation along the requested physical axis, not computed CSS `gap`. Margins or another safe source implementation may realize the public intent.
- `visualColumns` means the visible column arrangement of the specified items, not a CSS grid declaration. Flex is a legitimate implementation.
- Neither operation is translated to `set-style`, `gap`, `gridTemplateColumns`, or any other CSS property. No existing style property, inline-style object, or CSS grid is a public eligibility condition.
- FULL, SCOPE_OFF, and PROVENANCE_OFF return `{status:'rejected', reason:'UNSUPPORTED_VISUAL_INTENT', candidate:null, guard:null, apiAttempts:0}`. Candidate extraction, fallback, and guard do not run. FULL/OFF have no candidate pair for this unsupported operation; this is **not** a scope opportunity.
- In the runner, valid shared preparation Q precedes those method rejections. Eligible E and prepared Q slots stay in the funnel for all methods; unsupported visual operations cannot silently delete E/Q.
- LLM_ONESHOT receives the full projected public visual request and may propose arbitrary exact source-span patches. It has no deterministic CSS-property/implementation precondition. Patch reconstruction and the shared public safety/compilation check still govern acceptance; visual correctness is a separate independent evaluation.
- Existing supported FULL/OFF candidate pairing is unchanged.

## Controls and exact claims

`tests/methods-v1.test.mjs` adds typed semantic preservation, optional fields, recursive allowlisting/freezing, invalid values/aliases, no-candidate rejection, one-call synthetic proposal stripping, and unrestricted public normal set-style properties.

`tests/study-visual-intent-v1.test.mjs` uses the actual read-only product engine and actual research `browser-session-r3.staticGate` plus `buildEnvelope`. Runtime bytes are read from product `packages/runtime/vendor`; the real Babel compiler compiles original and patched JSX under `v04-jsx-app-script-react-1`. Runtime/compiler hashes are derived from the original real envelope and compared to candidate-envelope hashes, together with ABI, source/compiled hashes, exact patch reconstruction, and receipt keys `parse`, `entry`, `patch-safety`. Unsafe source, malformed JSX, invalid App ABI, and mismatched patch are negative controls.

The two public handwritten visual controls start without an existing style attribute. A deterministic injected one-shot response supplies a valid source-span patch adding flex layout (visualColumns) or a margin (borderBoxDistance), never a CSS gap/grid rewrite. Both preserve the exact operation kind/value, are accepted by the real common source gate/compiler, and retain FULL/OFF/PROVENANCE_OFF Q with explicit method rejection. Real-engine direct/map text controls retain exact same-candidate behavior and common compilation for every proposed method.

Preparation receipts in these tests are explicitly handwritten/synthetic, and the independent evaluator returns **unknown** for R/G. Therefore accepted controls are U_A, not visual success. No browser is launched, no generated source is executed in Node, no model/API is called, and no native AX/geometry/calibration/readiness claim is made. The actual runtime safety implementation is not replaced or modified by this test-local source checker.

## Verification

```text
node --test tests/methods-v1.test.mjs tests/study-visual-intent-v1.test.mjs tests/methods-v1-engine.test.mjs tests/experiment-runner-v1.test.mjs
```

Final expanded scoped run: 59 tests passed, 0 failed (initial three-file run: 39/39). Git diff/status verification is unavailable because the research directory is not a Git repository. Product worktree is read-only. Only the two owned existing method files and these two new test/plan paths are changed; study-runtime/execution/analysis/sealer, F0/r2, credentials, private-pilot, TEST and private-results/v03 are not modified.
