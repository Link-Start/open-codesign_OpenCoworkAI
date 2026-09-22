# Contributing to the research snapshot

**WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Contributions improve a research implementation and its evidence chain; they do not grant study readiness. [STATUS.md](STATUS.md) is authoritative over historical plans. Keep source archives and old seals immutable, and make publication/research revisions explicit.

## Paths and responsibilities

All paths below are relative to `research/editability-v04/` in the final repository.

| Area | Starting paths | Responsible role and boundary |
| --- | --- | --- |
| Method implementation | `src/methods-v1*.mjs`, `src/experiment-runner-v1.mjs`; corresponding `tests/` | Method owner: common public projection/checks, same preguard candidate, real provenance removal, unsupported fairness. Never consume private expectations or feedback. |
| Native raw evidence | `src/study-native-evidence-seal-v1.mjs`, `src/native-evidence-bindings-r3.mjs`, `src/evaluation-normalizer-r3.mjs` | Evidence owner plus independent verifier/evaluation owner: raw files, source/epoch/frame/capture identity, exact bytes and mandatory journals. Sealer is currently throw-only, not completed. |
| Observer and calibration | `src/browser-session-r3.mjs`, browser/layout helpers and calibration scripts/tests | Browser owner: native acquisition, containment and complete current policy/control matrix; no old-hash recertification. Confirm actual filenames in the current tree before editing helper/runner files. |
| Evaluation and final journals | `src/evaluate-adapter-r3.mjs`, `src/baseline-r3.mjs`, `src/runtime-evidence-r3.mjs` | Independent evaluation owner: G/R qualification, baseline/nonworsening, actual before/after-close diagnostics producer, cutoffs and teardown. Do not manufacture empty journals or summaries. |
| Real composition | `src/study-execution-bridge-v1.mjs`, `src/study-runtime-v1.mjs`, `src/study-public-prepare-v1.mjs`, `scripts/run-study-controls-v1.mjs` | Integration owner: real public preparation/lock/receipt path, no double replay, fail-closed admission. Synthetic callbacks are not native evidence. |
| Statistical inference | `src/analysis-v04-v2.mjs`, statistics tests, `plans/statistical-*.md` | Statistics owner plus independent auditor: preserve conditional method-audit scope; do not self-sign real cluster/source-pool assumptions. |
| Governance and coverage | `plans/v1.1/`, `plans/v1.2/public-integration-delta.md`, `public-contracts/` | Independent protocol/coverage owner: abstract contracts, aggregate gaps, new pre-source revisions. Private plans/oracles stay independently held, not requested through a public issue. |
| Portability and entry docs | `publication/paths.mjs`, local package/test entry points; `README.md`, `STATUS.md`, this file | Portability owner owns code/dependency discovery and verified commands; documentation owner maintains public meaning. Coordinator alone integrates final manifest and release scope. |

Historical agent labels in copied plans identify previous roles, not currently available maintainers or permission grants. During publication, coordinate non-overlapping ownership before edits: documentation work must not rewrite another owner's `src/`, `scripts/`, `tests/`, `fixtures/`, package or portability-helper files. Do not add unrelated product changes.

## Prioritized work

1. **P0: implement rawseal + fixed independent verifier + real final-native-journal producer.** Bind every planned scope and actual leaf bytes to source/render/viewport/frame/capture identities; enforce immutable paths, byte lengths/hashes, observation cutoffs, capture-prefix/final consistency and missing/tampered negative controls. Integrate actual persistence/normalization; do not replace the pending throw with a permissive stub.
2. **Native negative controls and full calibration.** Wire `containerPolicyId` into actual runner/fake policies; test unprevented fragment/HTTPS forms, safe submit, keyboard defaults, cascade and journal/teardown/raw bindings. Then rerun the entire exact-current-byte matrix, not only changed cases. Browser/network execution requires separate explicit permission and reviewed containment.
3. **Real bridge.** Run admitted public handwritten controls with genuine native acquisitions, independent original baseline, public-only preparation, pre-evaluation persisted acceptance, single candidate replay, and independently reread raw receipts. Retain failures and cleanup evidence; do not label synthetic acquisition native.
4. **G coverage and private governance.** Close the aggregate 121-facet coverage gaps in an independently reviewed new pre-source revision. Action replay without assertion of its distinct effect is not coverage. Do not lower G, tailor natural prompts to the editor, or disclose private expected values.
5. **Source pool and assumptions.** Verify rights, origin/lineage, duplicates, actual dependence/cluster capacities, execution mechanism and external approval/time anchors. Ninety-six briefs do not require ninety-six functional categories, but ninety-six file names do not prove independence. Do not create formal cases before the required freezes or infer source-pool clearance from metadata counts.

## Development and evidence rules

- Use Node 22 LTS and repository-pinned pnpm 10.33.4; see README for the verified current command and its bounded verification scope. Default checks do not launch browser/model/network work. Dependency installation is separate and explicit.
- Restrict ordinary tests to handwritten/synthetic fixtures. Compile trusted JSX when needed, but never execute natural/generated application JavaScript in Node. Real native, model and historical-artifact runs are separate opt-in work.
- For every change, report exact files, command/environment, dependency pins and pass/fail/skip counts. A skip is not pass; syntax checks are not unit coverage; unit controls are not samples. Preserve failed attempts rather than overwriting them or selecting best results.
- Keep original source bytes, old SHA labels and old evidence immutable. Export adaptations get new hashes in a separate source-to-export manifest; never call changed exports the original F0 frozen bytes.
- Retain complete planned slots, unknowns, refusal/error distinctions, same-candidate evidence, no-retry behavior and independent public/private boundaries. Never infer native truth from a typed `pass` flag or an unkeyed hash alone.
- Do not read, search, copy, link-resolve or package private directories, credentials/profiles, raw runs, original samples, freeze archives or external clones while doing public-document work. Public commitments/aggregates may remain; their targets do not come along automatically.
- Use generic repository-relative paths or validated explicit environment roots. No developer-machine paths, secret discovery, automatic downloads, new telemetry or bundled browser/model binaries.
- Follow the root MIT license for original project code and retain existing third-party notices. Do not invent licenses or assume publicly accessible candidate datasets are cleared for reuse.

## Review handoff

Submit a scoped patch and bounded validation notes for coordinator review. Distinguish implementation, synthetic controls, native controls, calibration, independent audit and admission. The coordinator must reconcile the exact final test list, source/export manifest and disclosure review before publication. No contributor may self-declare native ready, pilot admitted or formal authorized, and no public documentation task authorizes a push, PR or merge.
