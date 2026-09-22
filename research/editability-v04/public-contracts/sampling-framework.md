# v0.4 独立抽样框与去重规则

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**draft-not-frozen**。只定义抽象规则，不创建/公开具体TEST题。主协议固定96独立brief、2配置、每格1source、每source4tasks；先做8-brief pilot并永久排除于formal。

## 1. 总体与抽取单位

总体限符合单文件React runtime契约的有限离线交互界面需求，不代表所有生产React仓库。需求brief是最小候选cluster；配置、source及tasks是其嵌套观测，不是额外独立样本。独立性指按冻结抽样过程独立取得需求单元，不能靠数量或命名证明。

抽样框只按产品外的需求维度描述：实体关系拓扑、操作与状态转移结构、可见/隐藏状态、跨状态保留义务、布局响应方式和交互深度。词汇/颜色/行业外观不是独立性维度。抽样不查看编辑器表现、生成代码健康率或oracle成绩。

需求框包含自然代码可能的共享/动态/重复结构，但不指示生成器采用哪种内部实现；不得提示“避免map/复用”“使用可编辑字面量”或植入marker来迎合产品。不得强制96源都用同一代码骨架。

## 2. 三层去重

A. 来源去重：记录候选brief的独立来源/作者上下文/模板祖先。v03、DEV、pilot派生题与共享模板换皮题标已见或同家族；不要把无文件名交集当无泄露。

B. 文本去重：归一化空白、表面名称、色值和标号后hash；完全相同为重复。token相似只作flag，不作独立性证明。

C. 语义去重：私有结构卡记录实体关系图、状态转移图、操作前后置条件、保留义务与任务依赖。若仅名称替换且这些结构同构，视为同家族而非新独立brief。相似性高/难判断由独立第二审阅者盲于产品/结果审核；未解决先不宣称独立。

图结构也不能单独证明统计独立；共同生成模板或上下文仍可能导致依赖。保留familyId与reason，分析按最高有依赖证据层级cluster。不能删掉familyId去凑96。

## 3. 候选框、抽取与替换限制

先建立需求候选框并完成去重/来源审核，再锁定框hash、抽取seed、顺序、纳入条件和96个需求槽。框内排除只能依据预定非结果条件，记录排除原因；这发生在任何source生成或方法测试之前，不是best-of代码。

框不足96独立单元时defer formal，不能对同模板换皮填槽。框规则若在pilot发现问题，只能在formal冻结前修订并记录；正式source生成后不因难题、健康率、产品不支持或观测失败替换任何brief。两个配置每格一次调用，全保留。

具体框内容、种子所索引的候选、私有结构卡均不公开给产品作者。公开只给规则、候选计数/去重家族计数和freeze hash。当前尚未生成这些私有工件。

## 4. 四任务形成规则

每brief预定4任务，在source生成前随需求语义形成，不从生成source挑容易字面量。建议内容/属性与布局各2的配比，最终操作白名单/单位需公共支持矩阵确认并在formal前冻结；不会依据产品具体失败选操作。

任务必须有清楚公共目标及scope、非平凡保留要求和事先可定义的观察状态。brief指定目标实体和行为语义但不指定source字面位置/组件结构/marker。生成source里目标不存在、不符合要求或不可定位不能换任务：按G/R资格、准备失败或拒绝进入原计划漏斗。

baseline偶然已满足新目标视no-op按预定资格规则记录，不临时换一个更难/更易目标。oracle的必要key、时序性质、保护域、定量容差及baseline-relative偏序在看方法输出前固定。

## 5. Pilot验证点与停止

8-brief pilot用于检验上述来源与语义审核是否可执行、是否实际上仅产生一个模板家族、公开契约是否清楚、四任务和G/R可观测性、完整漏斗及成本。pilot结果可以修DEV/测量/公开协议，不进入formal。pilot不得成为直到8个健康source的采集循环。

独立性不够、工具适用性无法建立或测量门槛失败均透明defer；不查看formal结果后扩N或改变聚类。formal方案96是真目标不是当前可行性已获证实的承诺。

## 6. 独立oracle审查与污染

未来private test owner负责oracle，另独立审阅者仅验证公开需求→oracle一致性、不接触产品实现或方法输出。禁止oracle凭空增加公开任务未表达的正确性要求；有限保护检查与总体正确性声明分离。样本、原始/修改source、逐例结果在锁库前不向父/产品泄露。

泄露记录保留，正式样本不静默替换；必要时研究延期/新协议。公开抽象维度不是私有题库，当前不生成正式具体brief。
