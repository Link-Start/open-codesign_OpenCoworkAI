# v0.4 readiness：F0准备证据与F1正式执行阻断

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**F0 preparation candidate ready for parent manifest；F1 formal not-frozen / not-ready**。本文件只汇总公开文档、可信控制收据和父的MVP能力声明；研究owner没有读取产品实现、没有执行source/browser、没有读取或生成future private题。

本轮目标是有界MVP+后续论文执行协议/独立证据准备，不是正式96-brief实验。本表的“通过”均限对应范围，不能相加成自然编辑成功数或推出一般正确性。

## 1. 已完成的公开准备证据

| 项目 | 公开工件 | 当前能证明什么 | 不能证明什么 |
|---|---|---|---|
| R/G、漏斗、分割与固定规模 | plans/protocol-v04.md；public-contracts/denominator-schema.json、sampling-framework.md | 治理设计已明确，R主/G敏感性，96×2×4/四methods，8pilot永不回收 | 正式样本/方法/分析器已完成 |
| MVP支持矩阵 | protocol-v04.md第3节；research-requirements.md | 父公开声明的静态source-def text/3attr/7inlineCSS及pure useState setter范围 | 研究owner已源码审计或任意instance支持 |
| pure r2状态机/分类 | plans/measurement-r2.md；results/measurement-r2-tests-attempt-03.tap | fake-clock公开控制39/39；不早期fail异步wrong、gap留历史且保守unknown、typed empty | 真实所有浏览器语义或全任务布局校准 |
| entry ABI与最小adapter | plans/evaluate-adapter-r2.md；results/entry-evaluate-r2-tests-attempt-03.tap | 公开入口/collector allowlist/独立expectedKeys/bound baseline envelope等联合76/76 | 完整四任务runner/独立baseline capture；76与39有重叠不累加 |
| 真实browser最终helper重校准 | results/browser-calibration-r2-summary-final-helper.md；U5AyYj/report.json、policy.json | 8/8主矩阵+3/3入口控制；report.passed=true；runKind明确trusted-control | 11份自然程序成功或所有layout/domain已支持 |
| 当次输入完整性 | U5AyYj/input-hashes.json；current-source-verification.json | 13输入pre/post相等；07:42:57Z时点13项matches=true | 后续源码无漂移的永久保证；父仍需统一manifest |
| 最终browser/helper单测 | results/browser-calibration-r2-unit-tests-final-helper.tap | 19/19该测试集合通过 | 额外19个自然编辑机会或正式统计样本 |
| 外部适用性 | plans/external-baseline-feasibility.md | 固定Onlook Web/Desktop源码集成约束、持久ID/输出路径、许可/成本边界已调查 | 安装实测、等能力baseline或工具排行榜 |
| 作者成本 | public-contracts/research-author-events.json及各owner公开事件账 | 有证据的wall/版本/工件及未知量记录 | 完整项目总费用/净人时/成本优势 |

以上TAP数字为读取公开收据，不是本治理作者重新跑测试；browser报告的386 raw文件、464独立getter checks、24空非空测量等是控制观测，不能当独立任务样本。该轮browser记录wall 65367.2837ms，不能与重叠作者窗口直接相加。

## 2. 唯一当前校准绑定与历史隔离

- 当前policy：`results/browser-calibration-r2-U5AyYj/policy.json`。
- policyId：`r2-sparse-4ff5291483cc19c10a9f6d042efb21622026b8a6d6d4eaa4af55b1dd62840b10`。
- final helper SHA256：`5da3141a47fb5d769201d0345a9ddf67a550762c443ab7d388cdb55c606aa1b0`。
- observer SHA256：`75189d74d8c75c073b79db883b6e2648f72049be2ac4b31adfc06e1ec6ba498c`。
- runner SHA256：`20dcc62b91a437615d54a045c385567e9f1605ffb00410dfed7f51198c038d3f`。
- measurement SHA256：`29a26bbf554fd00c7a71b81b27986b5790063060a50c19561538ad99dde0d977`。
- records SHA256：`613730ed050fbe0462d4f5f0edf5a993b1248b2b1b4876df006382b5e9bb1434`。
- Browser：`Edg/153.0.4234.32`；observerRevision：`v04-observer-r2-calibrated-sparse-values-3`。
- 完整可信重跑窗口：2026-09-20 07:39:41.815Z–07:40:47.177Z；current-source-verification记录时点07:42:57.2804601Z。

旧qWnJvq及更早report/policy全部保留，只证明其时版本。U5AyYj是final helper漂移之后的新完整控制run，不是把新hash签进旧证据。任何未来实质版本漂移仍需独立的新完整控制证据；父统一清单不能用单hash改写替代重校准。

empty推断仅限此精确browser/type/可见layout/nonignored AX存在范围：input:text native inputValue=-1、textarea native textValue=-1，对侧entry缺省且AX.value缺省，并满足原policy全字段条件。double omission、missing字段/节点、未校准版本或其它type仍unknown。不是所有缺值都能当空字符串。

## 3. entry ABI与方法支持必须分开

`v04-jsx-app-script-react-1`要求Program层function/const/let App/_App，App优先且只mount选定入口。var/class-only/nested/comment/string不满足；imports/dynamic imports/exports/self-mount拒绝。旧default-export只显式legacy控制使用。helper只编译，不在Node执行生成code；browser才运行。

入口ABI可以接受含复杂状态/hooks/map/子组件/事件handler的原始程序；是否能编辑是另一个方法问题。MVP对effects/timers/ref/动态/复用/custom不支持，不能被协议偷换为original eligibility失败来美化S/E。安全或真实行为gate若独立失败则按其自身证据分型。公开pure useState setter支持不意味着任意副作用或任意函数都支持。

## 4. 当前adapter准确能力与明确缺项

已公开primitive kinds：`value/text/count/enabled/attribute/rect/withinViewport`。动作：`click/fill/key`；一个fresh scenario一个viewport，依赖失效显式notMeasured，私有expected/baseline只在Node。

**缺少：**`gap/grid/order`、document-level `overflow`、自动overflow checkpoints、场景内`reload/setViewport`及相关coherent acquisition/replay。`rect`不是gap/grid/order；单元素withinViewport不是文档overflow；分别新render一个viewport不能声称已实现所有跨viewport状态保留动作。

当前bound-baseline adapter只验证已给envelope与source/replay/catalog/viewport/observer/policy/checkpoint/entry绑定；没有独立baseline capture的完成证明。R的“原来失败不得恶化”数值偏序/错误签名比较还需按既定任务域落地，不能只用sameAsBaseline或失败计数相等替代。

**FULL/SCOPE_OFF/PROVENANCE_OFF/LLM_ONESHOT end-to-end runner尚未成形。** 产品MVP可用与四方法统一实验可执行是不同事实；不得从产品按钮或单测数推断runner ready。

## 5. F1 blockers（任何一项未过均不能正式采集）

| Gate | 必须新增或核验的工件 | 当前状态/责任 |
|---|---|---|
| F1-METHODS | 四方法真实runner、同候选scope消融、真provenance-off、oneshot固定公共投影、共同后检/accept锁定 | blocked；独立集成与方法owner |
| F1-DOMAIN | 保留四任务与既定layout/状态/viewport要求的全观察/动作域，gap/grid/order/overflow/reload/setViewport等控制 | blocked；measurement/browser owner，不删任务救就绪 |
| F1-BASELINE | 独立original捕获、完整provenance、G/R资格/no-op/非恶化规则/unknown机器化 | blocked；独立evaluation owner |
| F1-RECORDS | 全计划唯一槽、完整keys、P/E/Q/A闭合、所有notMeasured/失败与public/private边界 | blocked；runner+独立审计，schema存在不够 |
| F1-PILOT | 固定8新brief×2×4的一次生成/提案pilot及审计，永不回收formal | not-started；本轮禁止sample/API |
| F1-INDEPENDENCE | 96独立需求单元可行性；来源/语义去重与family cluster证据 | blocked；不能拿同模板换皮/任务数顶替 |
| F1-STATS | estimand、cluster层级、区间、bootstrap次数/seed、模拟验证及分析实现 | blocked；不做task二项CI/零事件安全证明 |
| F1-EXTERNAL | stock自动准备与通用wrapper/adapter的有界DEV适用性、round-trip/旁损/成本；若纳入共同域须实际控制，任何source-purity约束跨方法一致 | source-review-done、DEV-applicability-pending；不因ID/格式化先验永久排除，不伪造性能结果 |
| F1-PRIVATE | 独立test owner/executor、目录/日志/打包/期待不泄漏审核，方法先freeze后私有封存 | 未执行；当前private保持空 |
| F1-FREEZE | 方法、所有任务域observer/runtime/compiler、校准、pilot、分析、采集/成本、私有bundle的独立F1 manifest | blocked；父F0统一hash不能替代 |

源码不支持编辑可以在正式固定漏斗里合理拒绝；**评价器尚不能测指定任务**则是研究未ready，不是生成程序失败。两个概念不能互换。

## 6. F0 vs F1与下一步

F0可在父签收后冻结治理/设计准备、MVP公开矩阵和当前有限证据；此后修改按revision留迹。F1必须等待全任务域测量、四methods、完整8pilot、独立性、统计seed与全部gates。正式96目标不缩减、G/R不松gate、8pilot不回收，费用不限不授权best-of。

具体8pilot的P1–P7步骤、admission、失败保留和退出方式见 `F0-preparation-protocol-v1.md`。本轮只准备文件，不运行pilot/正式API，不创建私有题目，不产生效果或成本排名。成本未知值为null；本表的证据通过不证明经济性。

## 7. 本治理作者独立核对的policy文件身份

上述policy文件在本次只读核对时的SHA256：a439498dc6ebb5641c82192cef8d255a86ef525aa786309a5c58ca8d11145f65。其它实现hash为所读公开收据记录；本作者未阅读产品实现，也未自行运行browser。父随后统一manifest仍须核验其精确范围与时点。

## 8. 适用性公平性修订

原始archive不可变与禁止人工schema化，不等于所有方法的中间态或最终非目标字节绝对不变。Onlook自动ID/格式化应先记系统行为、适配成本与无编辑round-trip/语义旁损；已有Next项目/inline-vs-Tailwind域差异保留，但通用wrapper/自动instrumentation可透明验证。若最终需no-persistent-marker，应独立source-purity端点或共同导出约束，LLM大patch同样遵守。未执行的源码调查既不能证明可编辑，也不能只因marker证明无法编辑。
