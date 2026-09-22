# v0.4 React 来源与范围约束局部编辑研究协议

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**F0 preparation candidate / formal experimental protocol draft-not-frozen**；版本：0.4-pre-pilot-preparation-v1。Owner：独立研究协议代理。父当前兼产品作者，只读公开资料。本文件没有具体 heldout brief、source、oracle 或逐例结果。F0准备冻结范围与下一阶段步骤见 `F0-preparation-protocol-v1.md`；F1阻断证据见 `readiness-v04.md`。父统一hash清单并签收前，本文不自称已冻结。

本轮交付是有界产品MVP的公开研究契约、后续论文执行协议与独立证据准备，不是已做96-brief正式数据。已形成公开MVP矩阵、pure测量/入口ABI/8+3真实browser控制及外部适用性源码证据；但完整layout/replay测量域、四方法runner、独立baseline捕获、8-brief pilot、96独立brief可行性、统计seed/实现与F1 freeze均未完成。96 brief仍是达标后固定目标，不是当前采集授权。

## 1. 历史不可变与研究范围

v03与ZIP永远冻结。已只读REPORT-v03.zh-CN.md、ARTIFACT-README.md、analysis/posthoc-validity-audit.md、analysis/final-integrity-audit.md；未重跑或重新校验全部hash。

v03为24源中3 eligible、19 gate failure、2 unresolved；双方健康格式pair=0；RULE/GUARDED各0S/12；oneshot 11S+1协议拒绝/12。该拒绝与native唯一W同case，不能说模型修复该例。gate failure不等于业务逻辑坏程序。v03永远DEV，新observer不得重标旧数据；回归结果不充当未见test、不合并成效、不挑更好复跑。

主线仅React；产品选型不是格式优势。暂不启HTML/JSX优劣模块，只保留历史、文献和适用性背景。

## 2. 研究问题

- RQ1：自然React源上，source provenance与source-definition局部scope契约覆盖多少计划/可准备机会？源定位、权威来源、复用和状态写入如何限制覆盖？
- RQ2：同候选生成器下scope guard阻止多少确认错误，同时损失多少成功覆盖？目标未达、范围越界、保留失败、运行回归和不确定分开。
- RQ3：达到该支持域需要多少首次适配、继承依赖、instrumentation、运行及可观察维护成本？

S只表示冻结有限检查通过，不证明一般正确、全部可达状态。source-definition局部编辑不是任意instance编辑；LOC不代替工时，零编辑API不等于免费。

## 3. 源与支持契约

核心单文件App.jsx/JSX使用 `v04-jsx-app-script-react-1`：Program层function/const/let声明App或_App；同时存在时App优先，只选择并挂载一个入口。var/class-only/nested/comment/string伪入口不满足ABI；imports、dynamic imports、exports及self-mount拒绝。旧default-export只用于显式legacy可信校准，不作为正式fallback。与v03任意default-export契约不同，必须披露。TSX不自动纳入核心，不得采样后改名/补export/改source使之合格。以上依据公开entry计划与校准收据，研究owner未阅读产品实现。

### F0最终公开MVP支持矩阵（不是F1全任务域能力证明）

以下依据父提供的公开能力声明，不是研究owner对产品源码的独立审计；具体未声明表达式、值类型或单位保持unknown/保守拒绝，不猜成支持。

| 维度 | 已公开MVP范围 | 不作出的承诺 |
|---|---|---|
| 入口与owner | 唯一实际自动挂载的App/_App所对应定义；按公开ABI选择入口 | 不支持任意入口、跨文件、多mount或未知owner |
| source-definition scope | 该入口定义中的可唯一定位直接host/fragment结构 | 不称任意instance或跨自定义组件传播 |
| 文字 | 已有静态文字目标的局部source编辑 | 动态插值、数据驱动权威来源不推定支持 |
| 属性 | 已有静态title、placeholder、alt | 其它属性、动态属性、新建属性语义不假支持 |
| inline CSS | 已有inline style上的color、backgroundColor、fontSize、gap、padding、borderRadius、maxWidth | 不称grid/order/外部CSS/Tailwind或任意CSS支持；具体未声明值/单位拒绝 |
| 状态与handler | 公开已允许的pure useState及纯setter handler；静态目标与行为保留分开 | 事件handler存在不自动拒绝；不推定任意函数、副作用或表达式支持 |
| 保守拒绝 | effects、timers、ref、动态/复用/map/custom来源、不明owner及未知表达式 | 拒绝不是成功，不代表原始程序无效 |
| 模块边界 | 无imports/exports/self-mount的明确ABI | 不自动转换旧default export或TSX |

**MVP支持限制与原始资格分开：**effects/timers/ref、map、动态值、子组件等“方法不支持”不自动成为E_R/E_G原始程序排除条件；ABI、实际安全gate或行为门槛的独立失败另记。不得在自然生成prompt要求删除这些结构来救覆盖。所有方法unsupported留在覆盖漏斗，既定四任务和布局/保留域不因MVP或observer缺项而缩减。

原始采集source原字节/hash永久保全，禁止人为先清理、修复、转成定制schema或加marker后伪装自然输入。方法自身的通用wrapper、自动instrumentation、ID插入、格式化与源码重写则是被测系统行为，不仅因非目标字节变化先验排除；保留其全部中间态/最终diff、适配成本和无编辑round-trip/行为影响证据。R/G主要评价冻结目标、scope语义及保留，而非默认逐字节最小diff。若另要求marker-free导出或source-purity，须作为独立预声明端点/所有方法一致的导出约束，对LLM大patch与外部工具同样执行，不能临时只卡Onlook。自动准备导致实际回归可在相应阶段记录方法失败/旁损，但不是原始程序坏。定位不自动证明权威来源或scope。

## 4. 独立分割与访问

公开plans/、public-contracts/、公共脚本、可信手写控制与校准汇总。private-test/和private-results/归独立研究owner；父兼产品作者不得读具体brief/source/oracle/定位器/截图/逐例错误及成本。公开只有计划、方法freeze、private bundle hash及锁库后获准汇总。方法freeze不自动解除保密。

目录名称不是OS隔离。正式前落实独立executor、访问责任、private默认排除于glob/打包、日志防泄露；无法保证则defer formal，不称技术盲法。接口问题由父中转给兄弟owner。

DEV含全部v03与公开微例；PILOT固定8新brief，用于可行性/测量/适配/抽样校验，永不回收正式。TEST按冻结规则独立形成去重封存，方法/公共接口冻结后采集source。泄露样本记录污染保留，不静默换题；不可识别则延期，不补漂亮样本。

## 5. 样本与停止规模

正式目标96独立brief×2配置×每格1source×每源4tasks=192source，每method768计划槽；四核心方法3072计划方法槽。R/G是同一补丁双端点，不能重复算独立试验。

抽样框见public-contracts/sampling-framework.md。8-brief pilot先检验独立性和可执行性。96不是同模板换皮的96个题；存在共享模板家族则提升cluster并披露独立数，不足则defer当前formal。不能看test结果再改N。

96独立[0,1] brief级比例的最坏方差正态规划半宽约0.10，仅规划量级，不是实际CI/稀有风险/等效性保证。固定生成参数、窗口、并发、超时、source抽取与配置标签（不认证上游身份）。每格仅一次生成；失败/截断/协议错误均保留，无retry、修JSON、反馈再试、best-of或补健康样本。固定规模不是费用上限。

## 6. observer-r2先行门槛

观测须区分observed(value)/missing/unavailable/timeout/blocked/not-executed，空字符串/0/false不是missing。保存带时间戳采样及历史证据，缺失不改成0或pass。

pure r2与browser控制至少覆盖input/textarea空非空、受控/非受控React、hidden/不可访问、定位歧义、动态挂载、稳定真错、异步最终转真、振荡、稳定反例后terminal timeout、滚动坐标/hit-test/遮挡/layout width与滚动条。至少一套真值独立于生产observer路径；模拟缺key/重复key/级联blocked测试汇总器。

当前pure r2公开策略为5000ms/50ms/3稳定样本/geometryDelta0.5px，cleanup1000ms、maxSamples10000；completion须严格早于deadline。eventually-stable以有效稳定满足窗口为存在性正证据，可提前成功；hold-through-deadline建立满足窗口后继续覆盖到deadline，不能互换。第一个stable wrong不提前fail异步UI；早期wrong不证明持续错误。

当前eventually-stable的保守W需要normal deadline、无unknown/error/late采样、可用session、deadline-tail<=pollInterval及终端稳定负窗口且无eventual正见证；hold W还需有效post-window反例及同样clean覆盖。即使中途gap后来恢复，负轨迹也不升级W；terminal gap与旧stable wrong并存保持UA。not-observed-by-deadline是操作轨迹标签，不自动语义fail，不宣称连续时间覆盖。

accepted后必要项unknown且没有其它独立、符合上述契约的确认违约为UA；另一个检查有confirmed W时suite仍W，同时保留unknown，不把gap所在检查伪装为W。当前有限browser控制通过不等于所有任务域策略已冻结；F1前完整任务域、对应时序和geometry acquisition仍须实现校准。fresh reset；动作失败仅阻断后代，独立场景继续。新r2不重标v03。

## 7. R主端点与G敏感性

E_R：原源可加载、目标实体/状态可达、不是已满足no-op、冻结target+protection footprint内必要baseline可观测。允许footprint外原缺陷，记录可观测率。方法支持不是资格gate。

编辑前独立冻结baseline vector/允许变化/保护域；私有细节不回传，但公开目标scope须可理解。S_R需绝对新目标成立；保护对象保持；原先通过相关检查不退化；原先失败数值按预定方向/容差不恶化；离散错误按类别/位置预定规则不新增扩大；无新相关运行异常、不可达或source契约违规。不能以前后失败数相等证明无回归，不以missing→missing算保持。footprint内baseline unknown使资格unresolved，after unknown按UA/W。footprint外缺测不保证全局无回归；只称冻结局部保护域成功。

E_G：原源通过全部冻结公开程序要求及场景/观测门槛。S_G：新目标、全部原始及保留要求通过，回答本来整体健康的程序能否编辑。

G/R提前分别冻结、分表，可重叠不可相加。资格在编辑前判定；执行集合取预定并集，同source×task×method一个补丁、两个eligibility mask、共用after证据，不为R再试。

## 8. 漏斗与接受

P计划；E原始合格（含准备失败）；Q公共定位/证据准备成功；A方法接受且公共协议有效，private oracle前锁定。A=S+W+UA。

P=E+originalIneligible+eligibilityUnresolved+upstreamMissing+notScreened。
E=Q+preparationFailure+preparationNotExecuted。
Q=A+rejection+methodError+proposalNotExecuted。

分区原因互斥优先级先定，非互斥诊断另表。方法不支持不能移出E；Q后不支持为rejection，方法崩溃为methodError。核心方法共享公共准备/解析/入口/补丁/安全后检。无有效提案记public rejection，与主动拒绝分开。accepted后运行/契约失败仍W，不能回写拒绝。确认违约优先于unknown，同时保留缺测标签。

报告S/P、S/E、Q/E、A/E、W/A、UA/A、拒绝率和计数；零分母null/NA，A=0不是0%风险。schema只管结构，代数由runner/审计器另检。

## 9. 方法与基线

FULL=provenance+scope；SCOPE_OFF同guard前候选/hash仅关scope，公共后检保留；PROVENANCE_OFF固定公开静态/DOM回退且无provenance特权，可能改变候选可得性，是组件贡献不是纯scope；LLM_ONESHOT同原source及公共请求/证据投影、一次提案、同公共后检，无private反馈/输出修复/重试。变换能力不同是系统对比。

真消融无法实现则defer，不用名义开关凑组。每任务从原source开始不累计补丁；确定性重复只用于预定控制，不best-of。

FULL拒绝而SCOPE_OFF接受的同候选独立评价prevented-W、foregone-S、uncertain/不可评价，按P/E报告收益和损失。mapping无候选不等于阻止错误，全拒绝不能证明实用安全。

至少一个外部成熟工具候选的适用性调查已形成 `external-baseline-feasibility.md`，状态source-backed-not-executed：固定Onlook Web 423e2e924366419e418ee049093872d535eea41a与Desktop a3685a49bdb9ace3708ee38464874b097e2485d3/0.2.31的集成/写ID/真实输出路径有源码证据，尚未安装或建立严格自然源适配。若独立DEV推进，最多两轮adapter里程碑，分别记录适用/部分/不适用/未建立及成本；不能假称性能比较已完成。不可偷偷整理原source。Puck式schema重构若必需则本契约不适用，另轨另协议。Babel/Recast是依赖不是成熟编辑产品baseline。适用工具正式比较需预定全计划和共同支持子集，保留adapter失败漏斗；不支持全算错不自动公平。

暂不完整agent轨迹，原因可控范围而非费用限制。适用性不能写成已完成性能排行。

## 10. 统计与终止

主estimand为R的S/P、S/E及FULL对SCOPE_OFF的配对brief级差，G严格敏感性；risk/coverage联报。cluster重采样单位brief，保留配置/任务/方法；共享家族提升cluster。formal前锁定等权brief与ratio-of-sums口径、bootstrap次数/seed/区间方法。禁止普通task二项CI、task bootstrap或任务级零事件上界。罕见W/小A/零事件报计数和cluster分布，不用退化零宽CI证明零风险；无power不称等效/非劣。

固定N，全部槽terminal即结束，不按显著性、eligible量、成功率加样。安全/环境漂移/控制失效可暂停保留部分结果。测量修订另编号披露，不挑case重跑；test暴露后实质修订保留受限原轮，确认研究另协议。预定polling不是提案retry；重复测量次数先定且全保留，不重复到过。

## 11. 有界阶段

A当前公开协议/owner/schema，无正式题；B两个预定DEV里程碑与pure/browser控制，全通过后进入；C固定8-brief pilot、成熟工具最多两轮adapter，审查独立性可行性，不回收pilot；D一次readiness review，协议/方法/runtime/observer/分析/生成/抽样/oracle validator全部hash；E固定正式矩阵全terminal，无私有结果反馈产品；F独立只读重建patch/hash、分母、缺key、拒绝、成本后写论文。

里程碑不代替安全/测量门槛；不达标defer。不计费用不是无限范围或best-of授权。论文可先写方法，锁库前不编结果摘要；formal不可达就交付原型/控制/适用性并明确延期。

## 12. 成本

见public-contracts/cost-event-schema.json和research-author-events.json。记录可观测UTC、owner/phase、归属/继承、artifact/version/hash、active工时、wall、CPU/内存、API尝试、input/output/cached、金额与evidence。未知active/Harness作者tokens/金额=null不是0；cached已在input内；并行elapsed不当整体elapsed，嵌套不双计。实验API与作者工程调用分账；instrumentation/adapter/运行开销单列。LOC仅足迹；无预定维护扰动不称生命周期成本优势。公开账本不泄露test题名/路径/错误，逐例记录私有，锁库后审查汇总。

## 13. F1正式实验freeze阻断清单（F0不替代）

- [x] F0公开入口ABI、核心JSX与MVP矩阵已明确；不是四方法完整执行证明。
- [ ] R/G/保护域/no-op/原因优先级/时间阈值机器化。
- [x] 当前pure r2及U5AyYj有限空值/入口/lifecycle控制有通过收据。
- [ ] 缺少gap/grid/order/overflow/reload/setViewport等完整任务域实现和校准；不得删任务替代。
- [ ] pilot完成，96独立brief可行性审查通过。
- [ ] FULL/SCOPE_OFF/PROVENANCE_OFF/LLM_ONESHOT统一runner及真消融未成形。
- [x] 外部Onlook固定源码适用性调查完成；不是安装/运行成效。
- [ ] 统一公共准备/后检、无retry及失败收据确认。
- [ ] 分母代数、accept锁定、unknown与完整key测试通过。
- [ ] cluster统计、seed及分析实现冻结。
- [ ] 私有访问/executor/日志与打包排除确认。
- [ ] 成本unknown规则和hash链可审计。
- [ ] F1 readiness签收后才可正式实验冻结；独立保存F1 manifest，不混用F0准备hash。

文件存在/产品单测通过/v03回归通过均不等于formal freeze。

## 14. F0已完成证据与F1阻断指针

- 公开pure状态机/保守分类：plans/measurement-r2.md；results/measurement-r2-tests-attempt-03.tap记39/39，entry-evaluate-r2-tests-attempt-03.tap记76/76（有覆盖重叠，不相加为独立测试数）。
- 公开entry ABI与最小adapter：plans/evaluate-adapter-r2.md。仅value/text/count/enabled/attribute/rect/withinViewport及click/fill/key，缺gap/grid/order/document-overflow、reload/setViewport及自动overflow checkpoints；rect不能冒充完整布局验收。baseline envelope校验不等于独立baseline capture已实现。
- 最新唯一校准指针：results/browser-calibration-r2-U5AyYj/policy.json；report.json为trusted-control-calibration-not-scientific-sampling、passed:true。8/8 discovery+validation与3/3入口控制通过；完整重跑覆盖最终helper，绝非只替换旧policy中的hash。
- final helper SHA256：5da3141a47fb5d769201d0345a9ddf67a550762c443ab7d388cdb55c606aa1b0；observer：75189d74d8c75c073b79db883b6e2648f72049be2ac4b31adfc06e1ec6ba498c。当前13输入hash核验见同目录current-source-verification.json，核验时点07:42:57Z，不宣称无限期无漂移。
- 本文件只读公开报告/policy/签收证据，未读产品实现、未自行复跑browser；细项、证据等级和下一步见readiness-v04.md。
- F0为治理/设计准备冻结；F1需全任务域方法+observer、8pilot、独立性、统计seed/分析、runner与私有治理等门槛。F0可交付不等于论文实证完成；当前没有效果、风险或成本优势排名。

### 外部方法公平性补充（F0治理）

Onlook stock自动准备首先视为系统成本和无编辑差分/行为保留待测，不因插ID或格式化就宣布永久不适用、无法编辑或较差。singleApp→Next项目、inline→Tailwind等已知域差异保留；可行通用wrapper/自动instrumentation允许进入公开DEV适用性验证，须记录成本/输入输出域/原runtime等价，不能为优待MVP排除对手。当前source-backed调查不是baseline性能结果。
