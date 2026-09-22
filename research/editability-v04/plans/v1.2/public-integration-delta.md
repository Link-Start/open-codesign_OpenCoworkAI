# v1.2 独立侧公开接口衔接与admission差分

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**source-free / executionAllowed=false**。只读公开`plans/browser-domain-r3-api.md`与`plans/statistical-analysis-v2.md`，没有阅读browser/方法/产品/统计实现源码。此文不表示独立代码或运行认证，F0和v1.1封存字节不改。

## 1. r3现有公开承诺与未签收

r3公开API文档自标implementation draft、not calibrated/frozen。`captureFacts({targets,includeDocument})`从单次DOMSnapshot取得geometry/CSS等事实，AX和Page metrics前后括住identity/viewport；不宣称AX+layout同时原子。最多100targets，空targets可作document checkpoint，私有期待不入payload。旧r2 policy不适用于r3；需完整新hash/controls/policy，不能改单hash追认。

`setViewport({width,height,state:'preserve'})`保留当前文档业务状态；`reload({state:'reset-to-source'})`由同一修改后source建立新上下文并重置状态，保持当前viewport。新render/viewport epochs必须进入baseline/after binding。当前公开仍`remainingBudgetPropagatedToCDP:false`；独立Node绝对deadline/late与cleanup规则不能由此放松。

## 2. 关键语义映射：不能以CSS实现限制冒充用户目标

| 抽象用户/研究意图 | 需要的公开fact projection | 不允许的偷换 |
|---|---|---|
| 可见两box沿轴间距 | 同一capture的border-box signed distance，边界与margins另保留 | 把box distance叫computed CSS gap，或要求源必须flex/grid |
| 视觉列/行安排 | 明确定义的visual columns/rows，按box证据与冻结聚类/重叠规则 | 把视觉列数冒充CSS grid track数；因合法flex/其它layout拒绝符合意图的原source |
| CSS gap本身 | computed row/column gap +真实layout context | 把margin/space-between当CSS gap |
| CSS grid tracks | 原生resolved tracks与placements、支持边界 | 把flex矩形聚类叫原生CSS grid；猜测unsupported subgrid |
| 视觉顺序 | 指定query身份的实际box位置与writing mode/direction口径 | 将请求数组顺序当观测；将DOM/CSS order直接当visual |
| DOM/CSS顺序 | 各自显式事实/可比较前提 | 对不满足直接子节点前提的合法wrapper结构做假断言 |
| document overflow | 原生内容尺寸与实际layout viewport | 用单元素withinViewport替代document事实 |

r3现有deriveGap/deriveGrid/deriveOrder严格区分CSS事实是正确的。桥接/eval若要满足实现无关的visual意图，应另给`borderBoxDistance`/`visualColumns`等明确projection及可信positive/negative controls，不能要求生成器改用特定CSS/DOM结构来救测量。容差是版本固定的测量/任务参数，不是按source结果调优。

form-control-label的唯一解析必须覆盖公共需求允许的合法原生表征；当前r3 API文档没有明示该locator是否完整支持，因此保持unknown，不能推定textbox涵盖所有form controls。需要精确公开schema和校准收据。

## 3. 私有计划到执行接口仍需新revision

v1.1已封存8份预源需求/32任务/私有oracle规范。后续只能由独立owner读取必要私有数据，把抽象queries/probes与真实公开bridge绑定；父和methods只收到抽象schema与能力缺项，不收到具体期待。

必须完成：

1. 核对允许payload字段并fresh-object序列化；私有full key、phasePolicies、expected、baseline不得进入collector或methods。
2. 原始G检查与After目标/独立baseline保护分别dispatch，不能把示意常量当R实际baseline。G不加共同nonnoop；R保留nonnoop，unknown不算noop。
3. 公共需求→assertion覆盖映射必须独立补全；仅重放某action不证明其独特效果。当前有限catalog的规范review通过不等于完整G健康gate已完成，不得降低旧协议门槛。
4. source-independent语义normalizer、native validation/disabled控件分支、publicqueryrefs/identity与coherent geometry需可信控制。没有接口/证据则pending，而非把自然程序记坏。
5. 任何必要语义/重放修订必须发生在source前、另版本封存并复审，不改v1.1既有hash、不看方法结果修改任务。

## 4. 统计v2只按公开文档登记，不代替独立审计

已读v2文档明确：observed零分母为null；总体已定义比例可给无信息[0,1]，不能把observed A0当risk0；主有限样本界以有证据的独立有界clusters为条件，bootstrap只探索。96需求brief不强制96个功能family，真实C/l_c与依赖据实，不能捏造±0.10精度。

其主目标是锁定设计条件下cluster结果期望总和的比例，不是所有React需求总体的随机代表性推断。source-family、execution-independence、frame-bound、pre-outcome-lock及外部独立trust anchors/双签都仍需真实证据；签名不能制造独立性或正确normalizer。本owner不凭公开文档给统计代码/coverage或真实assumptions签通过。

Pilot保持描述性、永不formal。尚无正式来源池/真实独立性并不允许假签population区间；也不能把formal来源池尚未形成错误解释成必须现在创建96题。pilot的统计软件审计/数据结构门槛与formal推断assumptions分别签收。

## 5. 独立executor接入与profile预检

新独立executor agent只获sealed manifest和3份必要current planning文件的hash/必要读取权限，以及公开治理/接口；不读history/reviews/scratch、future TEST/results、产品/方法实现。onboarding已核验3/3文件及manifest一致，未解析私有案例内容。

精确两生成profile/config与凭据引用尚未提供时，状态是`unresolved-reference`，不是凭据失效。后续只检查指定位置presence/nonempty，不显示值/长度/hash、不广搜秘密、不换模型、不请求API；presence不证明凭据有效或模型身份。正式执行仍须完整r3/bridge/normalizer/stats/coverage及父可信链确认。

## 6. 外部baseline最新公开状态（仅父转述）

父转述Onlook build成功，stock启动遭OS拒绝访问；尚无no-edit round-trip或真实编辑结果。本owner未检查运行日志，故只作未独立核验的进展登记。OS访问阻断属于当前执行环境/适用性证据限制，不代表编辑能力失败、无法编辑或绩效排名；自动ID/格式化亦不先验永久排除。等待外部owner公开收据，不绕过OS权限。

## 7. 当前公开methods-analysis seam（仍不是完成的r3 bridge）

另只读`plans/methods-v1-analysis-bridge-v1.md`：其状态仍为analysis seam implemented、实际r3 runtime bridge pending。公开协议已保留label语义及R/G no-op分母差别，接口63/63是手写工程控制而非自然任务。

独立适配层须显式将抽象`query.kind`映射到wire `locator.by`，解析finite/unique公共query-ref并拒绝循环/未知引用；不能偷偷改role/查私有期待定位。私有expected/baseline留独立closure，只向trusted runner交受控资格与opaque key IDs。

统计projection应复制独立normalizer提供的完整binding/evidenceHash，不自己拼一个摘要hash冒称raw receipt。分类固定S/W/U_A，accepted+unknown也要独立notMeasured receipt；缺normalizer不能为了闭合报表凭空补booleans。

实际acceptance lock必须在private evaluation前独立持久化，绑定original/candidate/patch与精确lockId；内存boolean不等于这种证据。一次proposal只对应一次候选replay，r3自身若执行replay，外层executor不能另跑一次。raw evidence的canonical bytes、存储位置、hash身份、expected-key masks及normalizer版本还需精确公开签收。

本文只汇总公开契约要求，并未读其实现/私有日志；后续r3/bridge新版receipt应另版本登记，不用历史63/63替新实现背书。
