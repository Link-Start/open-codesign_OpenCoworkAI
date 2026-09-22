# v1.1：96独立需求单元采样框与家族依赖审计

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**procedure-prepared / formal-96-feasibility-not-established**。这是F0之后的新文档，不修改原snapshot。当前只有8份pilot的预源计划，没有生成自然source，也没有创建96个future formal briefs。本文件不以“已写出96个题名”伪造独立性。

## 1. 当前可证与不可证

已做：在8份source-free pilot需求卡上实际应用来源、共享scaffold、任务模板和业务不变量审查；独立第二review发现实现表征假设及重叠业务家族，修订后保留依赖与unknown。它证明审计流程能发现问题，不证明8或96个独立统计抽样。

当前不能证：可用独立候选池>=96、独立统计抽取机制已签收、有效样本数96、真实source结构多样性、任何编辑成功率。`independentStatisticalDrawCount=null`、`effectiveSampleSize=null`。共享作者本身不数学上证明依赖，结构不同也不证明独立；需要来源/生成过程证据。

pilot只是描述性工程与测量可行性练习。它的8个brief、32个任务、16未来source、256方法槽、多个viewport/replay全部不可换算成更多独立需求单元。

## 2. 抽样总体与estimand边界

拟研究总体是：满足公开离线单文件React runtime/有限交互规格的需求单元所诱导的自然生成程序，而非所有生产React仓库、所有行业网站或所有人类需求。生成配置是固定条件，不把同brief两配置当两个独立brief。

正式目标仍96独立brief×2配置×1source×4任务。候选来源框与概率/配额设计需在F1中由独立研究owner和统计owner共同签收；方法/observer/stats先freeze，之后才形成具体formal briefs。当前只确定可审计字段、来源渠道规则和停止条件，不创建future题库。

## 3. 候选来源渠道（尚未采集，不声称现成数量）

| 候选渠道 | 每单元需要的独立来源证据 | 主要风险 | 当前可用数 |
|---|---|---|---|
| 新的人类需求描述 | 来源人/组织、采集日期、授权、是否看过本产品/已有题、共享模板关系 | 同组织复制、按工具能力定制、公开后污染 | unknown |
| 有许可的既存非代码规格 | 原始URI/版本/hash/许可、作者/组织、首次形成日期、项目族 | 同模板家族、重复转述、训练语料污染不等于严格未见 | unknown |
| 独立上下文新撰规格 | 单独作者上下文/seed/提示版本与无前题接触记录、祖先模板 | 相同生成器/提示制造表面变体、共同骨架依赖 | unknown |
| 用户提供但未向方法作者公开的需求池 | 完整入池清单、访问日志、来源权利、采样前锁库 | 人为筛选适配产品、作者已见、缺失来源 | unknown |

这些是允许调查的渠道，不是宣称已经取得的数据集，也不以费用不限代替招募/许可/来源证据。任何来源若无法保持未见或合法使用，不能秘密补进formal。

## 4. 候选注册字段

每个未来候选必须有opaque candidateId、sourceChannel、originAuthorGroup、originOrganization(可私有化)、originTimestamp/证据、sourceArtifactHash、license/permission、acquisitionMethod、generationContext/seed(如适用)、templateAncestorIds、parentCandidateIds、publicExposure/seenBy、domainFeatureCard、familyMemberships及reviewDisposition。

featureCard区分实体关系、状态更新/持久性、业务不变量、操作前后条件、可见投影、错误路径和响应布局。表面行业词汇、颜色、数字系数、命名不是独立性证据。**Replay trace不叫完整state graph**；不能用线性检查步骤换标签就算不同图。

家族为允许重叠的超图，不强制每题只有一个familyId。共同测量契约/任务模板单列，不自动宣称全样本一个cluster；是否造成需要聚类的依赖由来源过程、实质模板复用和统计目标共同决定。避免既把所有共享名词强行独立，也把共享仪器误当必然统计依赖。

## 5. 三层去重与人工独立复核

1. 来源/血缘：明确派生、翻译、同模板变体或同项目版本进入同 lineage；v03/DEV/pilot及其派生不能作为formal未见。
2. 文本归一：忽略名称、色值、编号、格式后查完全重复；相似度只flag，不自动证明不同。
3. 语义/生成过程：比较真实业务操作、依赖结构、不变量和来源上下文。仅替换线性系数/行业标签的不获新独立性信用；结构差异仍需来源核验。
4. 第二reviewer盲于产品实现、源生成结果与方法分数。分歧保留为unresolved，不用多数投票或反复找reviewer挑过关答案。
5. 输出eligible-family pool、重叠关系、未解决来源/许可/污染和具体排除原因；正式抽取前冻结框hash、规则与统计seed。

当前pilot已实际完成一轮独立审查及一次预源澄清复核，原始版本和审查保留。后者解决公开query/行为歧义，不依据source或方法结果，既不是best-of也不产生新的独立样本。具体审查内容不交产品作者。

## 6. 流程能力审计的固定挑战项

| 挑战 | 正确处理 | 能证明什么 |
|---|---|---|
| 只改行业名/编号/常数的同一需求 | flag同模板/同家族，不增加独立单位 | 反表面去重能力 |
| 一个brief四task/两配置/多viewport | 归同brief repeated measures | 分母/聚类识别 |
| 不同图但同祖先模板批量派生 | 保留血缘与可能cluster | 图差异不等于独立 |
| 不同来源但共享通用测量接口 | 不直接判同族，进一步查实质来源 | 不过度把仪器共同性当依赖 |
| 一个候选属于多个业务家族 | 保留重叠超图、交统计owner | 不以单标签抹掉依赖 |
| 缺作者/许可/祖先信息 | unknown，不自动eligible | 来源完整性 |
| 仅短replay链相同/不同 | 不能当完整状态图相同/独立证据 | 表征谦抑 |
| 已见pilot改名 | DEV/seen，不可formal | 污染边界 |

这张表是审计验收标准，不冒称全自动语义去重器已实现。独立pilot审查提供部分实际流程证据；未来来源池审计仍是gate。

## 7. 96可行性门槛与停止

正式source采集前，需要支持96 distinct independently sourced/selected briefs的真实来源池与访问/血缘审计。功能family数不必为96；实质模板/lineage依赖仍须记录并按可信cluster推断。不能仅因功能family<96自动延期，也不能以96文件证明独立性。若可支持的独立cluster为C，必须真实报告C并由统计owner在source前评估精度/区间是否支持预定推断。不能用task/config补数。以protocol-amendment-01.md第B节为权威澄清。

若采用先抽独立family再抽brief的分层设计，必须冻结family抽样概率、每family取样数和权重；不能采样后因编辑难而重分类family。未解决依赖不得填零ICC或effectiveN=96。

候选需求阶段的预定来源/去重排除允许，但必须发生在任何source生成/方法结果之前、有完整账。一旦正式96槽选定并生成source，失败/截断/不合格/方法不支持都保留，不能换题或补健康source。停止规则不看显著性或成功率。

## 8. 当前签收结论

- `auditProcedureUsableOnPilot=true`：独立审查确实揭示了契约与依赖风险；不是从无反馈自称通过。
- `formalCandidatePoolAcquired=false`；`formalBriefsCreated=0`。
- `formal96IndependenceCertified=false`；`effectiveSampleSize=null`。
- `userPilotAuthorization=conditional-authorized`：父已转达用户16单次生成/最多64单次LLM、无retry/no-replacement范围；`executionAllowed=false`直到完整trusted chain+独立admission+父确认。正式96仍未授权。

下一项不是现在编96题，而是完成pilot-admission和统计owner的来源/抽取设计签收；future正式题仅在方法/observer/stats冻结后由独立owner形成并封存。
