# React editability research v0.4

**WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** This is a public, publication-adapted working snapshot for building and discussing a React editability study. It is **not** the original F0 byte freeze, an admitted pilot, a native-calibrated release, or an empirical performance result. Read [STATUS.md](STATUS.md) before interpreting historical plans or test counts.

The research studies source provenance and source-definition scope in local React edits: coverage, confirmed errors, accepted unknowns and adaptation costs. FULL, SCOPE_OFF, PROVENANCE_OFF and an injected one-shot LLM interface are implemented, but natural generations and real LLM edits remain **0**. Browser/network/model execution is **not started by default**. Refusal is not success, and software controls are not scientific samples.

## Start here

- [Current status and remaining gates](STATUS.md): authoritative publication status, including the unimplemented native raw sealer and final-journal producer.
- [Contributor guide](CONTRIBUTING.md): code/document paths, ownership boundaries and prioritized work.
- [Export notes and exact source-document includes](publication/DOCS-EXPORT-NOTES.md): what changed, what is excluded and how to interpret historical hashes/links.
- [Protocol](plans/protocol-v04.md), [sampling framework](public-contracts/sampling-framework.md) and [pre-source amendment](plans/v1.1/protocol-amendment-01.md): study design and denominator/governance rules, not collection authorization.
- [Method interfaces](plans/methods-v1.md), [visual-intent fairness](plans/study-visual-intent-v1.md), [evaluation API](plans/evaluate-adapter-r3.md), [native admission/journal contract](plans/browser-r3-admission-receipt-contract.md), and [statistics v2 audit](plans/statistical-audit-v2.md): bounded implementation contracts and historical evidence context.

## Which version governs?

Use these explicit priorities; historical files are retained for traceability, not interchangeable execution choices.

| Topic | Current authority | Historical only / not endorsed |
| --- | --- | --- |
| Statistics | `src/analysis-v04-v2.mjs`, [v2 plan](plans/statistical-analysis-v2.md) and [conditional v2 audit](plans/statistical-audit-v2.md) | `src/analysis-v04.mjs` and v1 interval claims were rejected by independent audit for the intended inferential use. V1 mechanism code/tests remain historical; passing pure tests cannot restore its statistical qualification. V2 is the only current **conditional method**, not authorization for real study inference. |
| Eligibility and sample design | [protocol-amendment-01](plans/v1.1/protocol-amendment-01.md) takes precedence over older protocol/readiness wording | R retains non-noop; **G is original-health eligibility without an additional non-noop gate**. The formal target is 96 independently sourced/selected **briefs**, not a quota of 96 functional families. Real lineage dependence and highest clusters still need evidence; neither file counts nor family labels prove independence. |
| Measurement and admission | Current r3 WIP contracts plus [STATUS](STATUS.md); full latest-byte calibration remains missing | r2/F0 are legacy/preparation context only. The old `MDiU66` r3 policy/report cannot certify the latest r3 or exported bytes and must not be reused for admission. |
| Execution | Publication entry-point guards remain blocked; default test/check-only paths are non-native | A historical native command, old manifest, passing unit suite or check-only success does not enable native study execution, calibration, a pilot or model calls. |

## Checkout and prerequisites

Intended repository layout:

```text
<repo>/
  apps/desktop/                 # existing product engine and dependencies
  packages/runtime/vendor/      # existing licensed runtime/compiler assets
  research/editability-v04/      # this research export
```

Use **Node 22 LTS** and **pnpm 10.33.4**. The inspected product checkout has `.nvmrc` = `22`, root `package.json` engines = `>=22` and `packageManager` = `pnpm@10.33.4`; these pins were reconfirmed at main baseline `5f6036ba526b9dd4e89aa27f6afb4d1210de486f`. Historical Node 24 receipts are not a Node 22/current-export test certificate. Existing root workspace globs cover `apps/*`, `packages/*`, and `website`, not this research directory; do not assume the repository-wide test command runs these research tests.

Product-backed compile/engine controls require the repository's installed Babel/parser and `tsx` dependencies plus existing vendor files. A normal repository dependency installation is a separate explicit, potentially networked operation; it is **not** silently performed by research tests. No browser binary, model, external clone or duplicate vendor bundle is supplied here.

At the intended `research/editability-v04` location, `publication/paths.mjs` discovers the containing repository. For a standalone staging/export directory, set **`CODESIGN_REPO_ROOT`** to an absolute existing checkout root (or `CODESIGN_PRODUCT_ROOT`, its supported alias). If both are set they must resolve to the same checkout. There is no fallback to the original author's adjacent local worktree. Do not set historical-artifact options for ordinary tests.

## What can be tested without a browser or model?

- Pure Node deterministic measurement/classification, ledger/funnel/analysis, projection and synthetic-session unit controls.
- Product-backed parser/stock-engine and trusted JSX compilation controls, with local dependencies available; they compile handwritten fixtures and do not execute generated application code in Node.
- Browser-free check-only/preflight identity inspection. `executed:false`, a blocked native guard, or a hash listing is **not native execution success**.

Run from the repository root with Node 22 and no root-path override:

```sh
# Explicit dependency setup; may use the network. No lifecycle scripts run.
pnpm install --frozen-lockfile --ignore-scripts
pnpm -C research/editability-v04 check
pnpm -C research/editability-v04 test
node research/editability-v04/scripts/run-study-controls-v1.mjs --check-only
```

Verified on Node **22.23.2** / pnpm **10.33.4** in this actual main-based checkout, with both root override variables unset: **23 files, 462 tests, 461 passed, 0 failed, 1 skipped**. The skip is explicitly the historical pre-`allow-forms` whole-envelope equality comparison, not a current native pass. All 66 JavaScript modules passed syntax checks; seven script check-only entries reported no execution. These are pure/synthetic implementation and publication-safety controls, not natural samples or a browser calibration certificate. See [verification scope](publication/verification.json) and [source/export inventory](publication/manifest.json).

`pnpm -C research/editability-v04 test:historical` is optional and currently has a known failing old whole-envelope equality assertion; it is not the publication passing suite. Artifact-dependent historical audits deliberately refuse to run because their private/local evidence is not bundled. Do not use broad `node --test` discovery as a substitute for these explicitly separated scopes. Root product lint/build/packaging are not certified by this research-only check.

### Native execution is hard-blocked, not merely opt-in

The published `scripts/run-study-controls-v1.mjs`, `scripts/run-trusted-calibration-r2.mjs` and `scripts/run-trusted-calibration-r3.mjs` use `scripts/publication-safety.mjs`: only the single `--check-only` argument prints a non-evidence safety report (`executed:false`, `nativeExecutionAllowed:false`). Actual execution rejects with **`PUBLICATION_NATIVE_EXECUTION_BLOCKED`**; `createStudyRuntimeV1` also rejects an otherwise shaped admission manifest with **`PUBLICATION_NATIVE_ADMISSION_BLOCKED`**. Supplying `--execute-trusted`, an old policy or a manifest does not unlock this snapshot. The package's check-only test launcher separately inspects local implementation dependencies; neither kind of check launches a browser or certifies calibration.

**P0 unlock work, requiring a reviewed new implementation revision rather than deleting the guard:** implement the raw native sealer and fixed independent verifier; implement the actual pre-close/post-close final-journal producer and consume sealed evidence in persistence/normalization; complete container-policy wiring and unprevented fragment/HTTPS form negative controls; validate keyboard/style/raw identity, journal cutoffs/prefixes and teardown. The retained calibration runner bodies must also have their portable input/output paths and exact input closure reviewed before any controlled calibration entry can be enabled. Then, under separate authorization, perform a full exact-current-byte calibration and independent review before enabling the real study bridge. Native study admission and natural pilot/model dispatch remain later, separately gated decisions. See [STATUS.md](STATUS.md).

Historical artifact audits are not default unit tests; their artifacts are not supplied. A hardblock, check-only success or skipped historical control is not a passed native calibration. The implementation-only counts above do not change the blocked native status.

## What is deliberately not published

No local calibrated policy, original runtime logs, screenshots, private questions/oracles, private access/profile/credential-presence records, original natural samples, author-event/cost logs, binaries, caches, external clones or F0 freeze directory are bundled. An abstract cost schema is not an author cost ledger. Public hash commitments and aggregate governance receipts do not disclose their private target bytes or grant access to them.

Historical `results/...`, private and freeze references are **external historical pointers**, not a promise that files exist in this checkout or permission to fetch/package them. Do not auto-follow them to complete a dependency closure. New environments require new local calibration and approved pins; do not paste old SHA labels onto new files. Source/export changes are separately recorded, preserving original source bytes and historical SHA labels. The local `.gitattributes` preserves exact snapshot bytes (including existing CRLF/mixed line endings) in Git so historical byte-identical source commitments survive checkout; it does not disable real trailing-space checks. Deliberate future normalization requires a new revision/map rather than reusing old hashes.

Product #430 is already in upstream `main` through an upstream merge, not a merge performed by this research agent. The publication branch is research-only; no product change, PR or merge is bundled here. Existing original project code follows the repository's **MIT license**. Existing runtime/vendor and third-party notices remain in their repository locations under their own original terms; this research snapshot invents no new third-party license or blanket dataset-reuse permission.
