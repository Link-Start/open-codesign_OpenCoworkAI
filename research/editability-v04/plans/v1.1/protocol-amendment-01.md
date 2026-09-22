# v1.1 事前公开amendment 01：no-op、96 brief与family、条件执行授权

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**pre-source governance decision；admission仍blocked**。本文件是在任何自然source、方法提案或结果出现之前新增的公开决策，不改F0原位文档或snapshot。理由来自接口owner的明确歧义请求与用户新授权，不来自观察到的成效。

## A. No-op：保持F0主分母，不偷偷把G也改non-noop

- `E_R = 原始R可测/可达条件 AND nonNoop`，保留F0显式定义。no-op必须由独立original完整目标证据判定；unknown不是no-op；不能由方法自己宣称no-op来移出分母。
- `E_G = 原始完整冻结公开规格/场景通过`，**不增加共同non-noop条件**。G是全原健康敏感性endpoint，不在adapter内部悄改为G-health AND nonNoop。
- 统一记录`noOpStatus = true / false / unresolved`及其原始证据。G-qualified no-op如果实际发生仍在E_G；它不自动算S，也不自动改拒绝。按该方法真实决定、同一公共后检和private评价分类。不能凭空为未调用方法补S。
- 可预声明报告`G ∩ nonNoop`的辅助表与no-op计数，**必须另标分母，不替代主G、不可与R相加**。本轮不据观察结果决定是否开辅助表。
- 若后续研究要把两endpoint都定义成“需实质编辑的机会”，必须新amendment、明确estimand与分母字段变更并在任何source之前签收；本amendment没有作该改变。

方法runner执行R/G资格并集，只提案一次；G-only机会也遵循单次调用和公开协议。原始G与目标本来不相容时出现no-op可能意味着source不健康或观测矛盾，但不能在通用代码中先验把该字段删掉或吞进notEligible。

## B. 96需求brief不等于必须96种功能family

**N仍96 distinct independently sourced/selected requirement briefs；四任务、两配置和最高有依据的family/lineage聚类不变。** 这里解释独立来源/抽取、功能分类与统计依赖的不同。原sampling-framework.md第7行以需求brief为最小候选cluster，第21行要求按最高有依赖证据层级cluster，第27行要求不足96独立单元则defer；它并未明文要求96种功能family。本文澄清这些语句可能引出的过强解读，并撤回初版v1.1将“最高family少于96”直接作为自动延期条件的过强句子。

1. 功能family是题材/业务机制分类，多个真正独立来源/抽取的需求可共享同一family。无需为满足数字96人为拆成96个family名称。共享measurement scaffold也不自动证明整个研究只有一个独立单位。
2. 模板血缘、同一需求改名/换常数、重复项目版本等实质依赖不能被功能标签掩盖；来源审计必须揭示其lineage/family并交统计owner。若所谓96只是少数底稿衍生，不能宣称满足96独立需求。
3. 独立需求的操作化证据至少包括原始来源/作者上下文、祖先模板、采样前入池账、重复/结构审查、独立复核、抽取机制与seed。文本/图不同本身不证明统计独立，单作者本身也不数学上证明必然依赖。
4. 报告真实brief数N及可信cluster数C/重叠家族结构；不得把C硬填96、把task/配置当额外独立单位或把unknown ICC设0。若只支持C个近似独立cluster，则推断按C对应层级进行，精度/区间受其限制。
5. 原96的约±0.10只是独立[0,1] brief级最坏方差规划近似。存在实质依赖时不得沿用为保证；由统计owner在source前评估cluster分布、权重、区间/小样本处理与精度可行性，并签收或建议明确修订/延期。
6. 因此，**不能仅因功能family数<96自动defer，也不能仅因brief文件数=96就宣布独立性达标**。真实来源池不存在、重复派生冒充新需求、依赖信息不足或统计推断目标不可支持，仍构成具体blocker。当前formal来源池尚未取得，独立性未获证实。

本澄清不把统计问题换个词就算解决，也没有制造96题或修改样本数。future具体formal briefs仍只能在方法/observer/stats freeze后由独立owner形成；F1采样规则冻结须包含本说明与统计owner签收。

## C. 用户新增条件授权

父代理转达的当前用户授权为：**独立pilot-admission全部通过后，沿既有两生成配置，固定8brief：16单次生成、最多64单次LLM编辑，失败不重试、不补样，费用据实。** 不包括正式96采集。

这是有条件执行授权，不是即时放行。独立owner仍须取得完整trusted-chain收据、全部admission gates通过和父明确确认；具体配置/提示/timeout/output窗口/usage记录要绑定，不以C01/C02占位或网关别名假装已pin模型身份。

配置/系统问题、截断、空输出、协议错误或错误结果都保留原槽，不用用户“不限费用”推导重试/补样。LLM上限64指64个source×task机会各至多一次实际编辑调用；R/G合并派发，不再乘2。Native/消融不因为LLM上限而增加source或任务。

机器checklist将授权标为conditional-authorized而executionAllowed=false；admission未全部通过时不允许调用模型或运行自然source。原F0“当轮禁止sample”时限由本新授权取代，原F0事实与hash仍保持不变。
