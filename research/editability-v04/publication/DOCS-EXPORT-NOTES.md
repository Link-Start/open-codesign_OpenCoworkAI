# Public documentation export notes

**WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** This is a publication-adapted source-document selection, not an original F0 snapshot or a research-readiness signature. [Current STATUS](../STATUS.md) overrides historical claims. The coordinator owns the final per-file source/export SHA256 manifest and acceptance; this note is the documentation owner's include list and transformation rationale only.

## Source, destination and preservation

- Source label: `codesign-editability-research-v04`, the stopped, original research WIP tree. It was read only; no source file was modified.
- Publication staging label: `codesign-editability-research-publication-stage`.
- Final destination: `<repo>/research/editability-v04/` on the main-baseline research publication branch.
- Every source file listed below was read as text before explicit allowlist copying. No linked private, results, freeze, external clone, credential/profile or original-natural-sample target was read or copied. Link availability/target contents were not certified.
- No recursive source-tree copy or link-closure packaging was used. Documentation work did not alter implementation-owner `src/`, `scripts/`, `tests/`, `fixtures/`, package files or `publication/paths.mjs`.

## Transformations and why

**All 27 copied Markdown files:** inserted a first-paragraph WIP/historical banner with relative links to current status and these notes. This prevents stale “ready”, “implemented”, “current policy” and passing-control language from certifying newer bytes. The body remains historical context except the three path adaptations below. These exports therefore have different hashes from original Markdown files; old hash labels in their text retain their original historical meaning.

**Three additional path adaptations:**

1. `plans/methods-v1.md`: replaced the old named adjacent-product-worktree path with `<product-repo>/apps/desktop/src/main/source-edit-engine.ts` and explicitly labelled its examined SHA historical.
2. `plans/methods-v1-engine-adaptation.md`: same generic product-source path and external-historical qualification; original examined SHA unchanged. Historical dependency-loader and Node 24 statements are not promises about current portable helpers.
3. `plans/study-public-prepare-v1.md`: converted the old outer-workspace-prefixed test path to `tests/study-public-prepare-v1.test.mjs`, relative to the research root. The command remains historical pending the coordinator's current-command receipt.

**All seven copied JSON files:** byte-preserved. The checklist/structural audit/plan seal/source-pool record are scoped historical public receipts, not fresh independent signatures. Their references do not cause target inclusion. Hash commitments, aggregate counts and abstract schemas are allowed; no private bodies, operational profile presence or author-event logs are included. Schema URLs are identifiers, not instructions to fetch remote dependencies.

**New public entry documentation:** `README.md`, `STATUS.md`, `CONTRIBUTING.md` and this note are publication-authored, with no original-source-file identity to claim. At documentation handoff, README recorded inspected Node/pnpm pins and a command placeholder. The coordinator subsequently replaced that placeholder with the actual default-checkout command and bounded implementation-only verification; no native pass receipt is asserted.

Portable code/runtime paths are owned by the implementation/portability owner. The read-only reviewed helper supports validated `CODESIGN_REPO_ROOT`/`CODESIGN_PRODUCT_ROOT` or discovery from the intended repository layout. Documentation does not bind a new product/compiler/runtime hash or authorize a native run.

## Exact original include list (34 files)

Each path is relative to the source root and maps to the **same relative path** in the export. Unless listed among the three adaptations above, Markdown changes are banner-only; JSON bytes are unchanged.

### Historical design and implementation context — 24 Markdown files

```text
plans/protocol-v04.md
plans/F0-preparation-protocol-v1.md
plans/readiness-v04.md
plans/external-baseline-feasibility.md
plans/v1.1/README.md
plans/v1.1/protocol-amendment-01.md
plans/v1.1/F1-governance-and-pilot-admission.md
plans/v1.1/sampling-frame-feasibility.md
plans/v1.2/public-integration-delta.md
plans/methods-v1.md
plans/methods-v1-engine-adaptation.md
plans/methods-v1-analysis-bridge-v1.md
plans/study-public-prepare-v1.md
plans/study-execution-bridge-v1.md
plans/study-visual-intent-v1.md
plans/measurement-r2.md
plans/evaluate-adapter-r2.md
plans/evaluate-adapter-r3.md
plans/browser-domain-r3-api.md
plans/browser-r3-admission-receipt-contract.md
plans/statistical-analysis-v1.md
plans/statistical-audit-v1.md
plans/statistical-analysis-v2.md
plans/statistical-audit-v2.md
```

### Public abstract contracts — three Markdown files

```text
public-contracts/research-requirements.md
public-contracts/sampling-framework.md
public-contracts/v1.1/pilot-interface-contract.md
```

### Abstract schemas and approved aggregate commitments — seven JSON files

```text
public-contracts/denominator-schema.json
public-contracts/cost-event-schema.json
public-contracts/v1.1/domain-operation-query-check.schema.json
public-contracts/v1.1/plan-structural-audit.json
public-contracts/v1.1/pilot-plan-seal-receipt.json
public-contracts/v1.1/pilot-admission-checklist.json
public-contracts/v1.2/source-pool-feasibility-evidence.json
```

## Exclusions and historical-reference interpretation

Not included: coordination/parent chat reports; author-event/cost ledgers; private-access sign-off; live profile/credential-presence or post-presence admission progress; executor onboarding preflight; sampling-source-evidence register; raw runs/results, screenshots, local policies, private plans/oracles, original samples, binaries/caches and external clones. The cost-event **schema** is retained only as an abstract contract, not a cost log.

References to excluded files are **historical external pointers**. Some are plain root-relative identifiers rather than usable Markdown links. They do not imply availability in a public checkout, verification by this export, a permission to read them, or a requirement to publish their dependency closure. Statistical plans/audits can describe prior simulation results without bundling historical results. Private-manifest/hash commitments authenticate neither exported docs nor a new environment. The v1.1 commitment's historical governance SHA still refers to original bytes, not the banner-adapted export.

Earlier F0 readiness documents predate methods, statistics and current WIP revisions. Older full-chain/persistence wording does not implement the throw-only raw sealer or the missing final-journal producer. Old 27-native/35-unit reports do not sign the latest observer, and new fake-journal or portability unit fixes are not a native calibration run. The latest G 121-facet aggregate is coverage, not a sample count.

## Validation handoff, not a readiness signature

Documentation checks are limited to explicit selection, text review, staging paths, Markdown status links, JSON parsing and copy/hash preservation. No browser, model, API, external fetching, product build, native calibration, statistical reanalysis or scientific collection was performed for this documentation export. Source targets behind historical links were deliberately not read. Final implementation test commands/counts, main-checkout dependency pins, source/export manifest, disclosure acceptance and branch publication remain the coordinator's responsibility.

Original project code follows the existing repository MIT license. Existing vendor/runtime notices remain where supplied by the repository; external-baseline/dataset license discussions are historical findings, not newly invented redistribution permissions.
