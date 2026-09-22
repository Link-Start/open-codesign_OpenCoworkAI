# v1.1 公开治理索引与阶段签收

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

本阶段产物：F1/pilot治理、抽样框审计规则、8个预源pilot需求/任务/oracle规范及独立审查。**没有自然source、LLM编辑或browser自然程序执行，没有96正式题。** 产品PR与四方法/测量实现由其它owner负责，本owner未读取这些实现。

## 公开入口

- `F1-governance-and-pilot-admission.md`：完整责任/边界/执行顺序。
- `protocol-amendment-01.md`：保留R non-noop、G原健康分母；96 brief不是96功能family配额；新用户条件授权。
- `sampling-frame-feasibility.md`：来源渠道、血缘/文本/语义审计及仍未建立的正式96可行性。
- `../../public-contracts/v1.1/pilot-interface-contract.md` 与 `domain-operation-query-check.schema.json`：只给公共query/action/probe抽象，不含具体题或expected。
- `../../public-contracts/v1.1/pilot-admission-checklist.json`：14项需具体receipt/hash/owner的门槛；executionAllowed=false。
- `../../public-contracts/v1.1/pilot-plan-seal-receipt.json`：私有计划字节封存的公开hash、计数及总体review状态。
- `../../public-contracts/v1.1/plan-structural-audit.json`：11项本地结构/投影/F0完整性检查；不是实际runner/browser认证。

## 封存与review准确范围

8个新brief、每brief4个任务，在任何source出现前形成；两配置计划16source、四methods计划256槽，LLM编辑至多64单次。private plan manifest SHA256：`5a7fae6b7d45a1fef54820efb7b249388ca44c6d2be3733db02eecd6fd2068c1`。

独立public-requirements复核：3 pass/0 fail/2 needs-review；独立oracle修订复核：4 pass/0 fail/1 needs-review。单位是审查维度，不是实验任务。初版缺陷及修订字节均保留；修改发生在source不存在且未看方法结果时，不是best-of。具体问题/期待不向产品作者披露。

这个seal仅固定条件性接受的预源规范与历史审查。source-independent metric normalization、合法native控件/条件操作映射、实际private projection、baseline/comparator、完整observer/actions、四methods runner等门槛未因此通过。之后的可执行绑定必须新revision、在任何source前独立签收，不能直接改已封存字节。

已检查F0 manifest hash与COMPLETE一致，本owner原先六份F0绑定公开文件hash不变。v03/ZIP未修改。future private-test/private-results仍空。private-pilot与正式TEST分离，pilot永不回收formal。

## 访问治理与限制

私有access log记录owner及窄授权独立reviewer访问、预源修订、总体披露和封存。父当前兼产品作者，未获具体pilot/oracle或future TEST访问授权；只能接收上述抽象接口/总体状态。路径分目录和日志不等于OS隔离，也不声称检测了所有系统读取。

pilot未来若向产品做DEV反馈，必须记录seen及接收者，永不formal。具体formal briefs只能在方法/observer/stats freeze后按审计后的来源框形成；目前来源池/独立性仍未获证实。

## 下一次放行所需输入

请接口owner给出新的**公开**payload schema、normalization/比较器接口、query/action/probe能力声明与完整可信控制receipt路径（不要让本owner读方法实现）。独立owner据此做私有计划→执行契约绑定及新revision签收；父核验完整trusted chain后才可启用用户已授权的16单次生成/最多64单次LLM范围。无retry、无replacement、无formal96授权。

## 完整G gate仍需单独覆盖签收

当前私有预源catalog明确区分已断言的有限检查与只重放、尚未断言其独特效果的公开行为。独立review的specification pass不授权把这个有限子集直接改称协议所要求的完整G健康。必须在source前补齐公开需求→assertion覆盖映射、按新revision独立审查；不能因为源难测而删要求或把缺项当已通过。该项已明确写入R-G-NONWORSENING admission gate，旧F0/已封存计划字节不改。
