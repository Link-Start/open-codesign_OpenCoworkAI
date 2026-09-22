# v0.4 公开研究接口与验收需求

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**F0 preparation candidate；formal draft-not-frozen**。本文只含公开契约，无正式题目。完整协议见 ../plans/protocol-v04.md；两阶段冻结见 ../plans/F0-preparation-protocol-v1.md，执行阻断见 ../plans/readiness-v04.md。实现者可读本文；研究owner未读产品具体实现。

## 1. Owner与输入输出边界

父目前是产品作者，兄弟owner之间接口问题由父中转。pure r2 owner提供类型化时序判断；browser owner提供真实采样和可信控制；独立研究owner定义R/G与oracle，隔离test。任何方法都不得接收private oracle/逐例验收反馈。

方法输入：原始source bytes/hash、公共编辑请求（操作、值、目标定位、公开范围契约）、固定公共DOM/运行证据、环境版本。各方法获得相同公共语义，若信息访问接口不同须逐项披露，不冒称完全相同输入。不得根据private答案补提示。

方法输出：accept/reject/error、稳定reason code、candidateId/hash、source前后hash、patch列表及可重建顺序、公开检查收据、scope/provenance证据（若方法使用）、耗时及成本。accept必须在private oracle执行前锁定；accepted后失败不改拒绝。

FULL/SCOPE_OFF的候选在guard前固定且相同；没有候选的mapping拒绝不进入“guard阻止错误”分母。PROVENANCE_OFF必须真正剥离该信息，否则不称消融。LLM只有一次提案，不修输出、不反馈重试。

## 2. F0公开MVP矩阵（父的能力声明，非F1全域证明）

| 维度 | 当前公开范围 | 未声明或拒绝边界 |
|---|---|---|
| ABI | App.jsx/JSX，Program层function/const/let App或_App，App优先只mount一个入口 | imports/dynamic imports/exports/self-mount拒绝；不回退default export；TSX不自动纳入 |
| scope | 唯一实际挂载入口定义的直接host/fragment、source-definition局部 | 不称任意instance；map/复用/custom/动态/不明owner拒绝 |
| text | 已有静态文字 | 动态权威数据/插值不假支持 |
| attribute | 已有静态title、placeholder、alt | 其它属性/动态值/未声明新增属性拒绝或unknown |
| existing-inline-style | color/backgroundColor/fontSize/gap/padding/borderRadius/maxWidth | 不称grid/order/外部CSS/Tailwind；未声明单位/表达式不猜支持 |
| state/handler | 已公开pure useState及纯setter handler | effects/timers/ref及未声明副作用拒绝；handler存在不是通用拒绝理由 |
| instrumentation/自动准备 | 原始archive不变；通用wrapper、自动ID/格式化作为方法行为 | 记录中间态/导出/round-trip与成本；source-purity/marker-free如要求须独立且跨方法一致 |
| output/determinism | 固定输入/版本的局部source补丁或明确拒绝 | 四方法共同后检/runner与真消融仍未完成 |

完整解释见主协议第3节。方法拒绝effects/map等不自动使原始程序不eligible；明确ABI/safety/行为gate单独判定。不得要求自然生成只采用容易编辑结构，也不得因observer缺layout而删掉正式四任务或布局保护要求。未知精确值/单位、patch边界等需F1前补公共定义，不以推测补全。

## 3. 共同公共准备与后检

Q是公共定位/证据成功，不是“某方法已经会编辑”。产品unsupported不得从E/Q剔除；Q后拒绝保留。核心方法共用准备与source解析/入口/补丁安全后检；变换能力不同单独披露。instrumentation或adapter无法准备属于明确技术失败，不冒充原始业务缺陷。

所有任务独立从原source起步。所有预期观察key在执行前冻结，缺失/重复为审计错误或unknown，不默认为pass。完整矩阵预置；未执行也有原因。

## 4. 当前pure r2 → 研究分类映射（有限控制已过，F1全域未ready）

| 原始现象 | 需要的时间语义/覆盖 | 研究分类 |
|---|---|---|
| 空字符串实际可读 | value确为observed('') | 正常值，按expected判断 |
| missing/unavailable/timeout | 无可用证据 | unresolved，不替代0/空值 |
| 早期稳定wrong，后期合法稳定转真 | eventually-stable；完整有效稳定窗口在deadline前 | 不能早期fail；存在性S不保证后续保持 |
| not-observed-by-deadline | normal deadline、无unknown/error/late、可用session、tail<=pollInterval、终端稳定负窗且无eventual正见证 | 满足全部条件才可为有限检查W |
| 稳定wrong后terminal gap | 最终窗coverage不足 | unresolved，历史wrong保留，不称持续错误 |
| 窗口曾达到目标 | 存在性性质且正证据满足规则 | pass；不是全窗稳定保证 |
| sampled hold的post-window反例 | 还须clean normal deadline及tail覆盖 | 当前r2才可W；同检查含gap则UA，反例历史保留 |
| 动作失败的依赖检查 | 无法执行 | blocked/unresolved；独立场景继续 |

纯r2标签不得直接无条件映射W。当前公共默认5000ms/50ms/3样本/geometryDelta0.5px、cleanup1000ms、maxSamples10000；正式前全任务域仍须校准和F1冻结。研究mapper需消费temporalContract、identity与coverage；较早stable wrong和terminal gap不能拼成持续错误。accepted后任一独立确认违约→W且保留uncertainty tags；无确认违约但任一必要unknown→U_A；所有必要检查满足且无契约违规→S。非accepted永远不计S/W/U_A。

## 5. 资格与统计接口

主R：baseline-relative local footprint全部必要baseline可观测，目标非no-op且可达，允许footprint外缺陷。敏感性G：原始完整规格与场景全部通过。两者独立预定义，不见结果放宽；执行并集、同补丁双mask、分别统计不相加。

P/E/Q/A/S/W/U_A及互斥未进入原因见denominator-schema.json。schema不能替代代数检查。P=768/核心方法/正式endpoint（计划恒定，资格不同）；pilot必须单独datasetId，不回收正式。暂不formal execution。

## 6. 发布与保密

产品作者只能看公共DEV、操作矩阵、公开控制和最终获准汇总。不能看private briefs/source/oracle/逐例结果；文件夹名称不是技术隔离。private不默认打包、日志不泄露题名。96独立brief不可达到或测量/方法门槛不足则defer formal。

## 7. 当前状态

F0已有公开矩阵、entry ABI、pure r2及8+3真实browser控制、Onlook源码适用性证据；证据指针在readiness-v04.md。当前adapter仅value/text/count/enabled/attribute/rect/withinViewport及click/fill/key，缺gap/grid/order/document-overflow/reload/setViewport等。FULL/SCOPE_OFF/PROVENANCE_OFF/LLM_ONESHOT统一runner、独立baseline捕获、8pilot与96独立性、统计seed/实现、完整task-domain控制及F1签收仍阻断。F0hash不等于正式预注册，不能宣布采集就绪。

## 8. 外部方法公平性

自然输入要求禁止人为schema化/清理来迎合某工具，不等于所有method自动准备或最终非目标字节必须不变。R/G不自动惩罚纯格式化；自动准备的语义旁损/持久性失败需真实测量与归因。Onlook的域差异需要DEV验证，插ID本身不构成永久不适用判定。任何最终marker-free/source-purity约束同样施加于LLM等方法；调查不是性能结果。
