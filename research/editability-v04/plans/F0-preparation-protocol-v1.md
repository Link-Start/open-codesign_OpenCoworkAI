# v0.4 pre-pilot preparation protocol — F0 v1

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

**范围状态：preparation-ready-for-parent-manifest。** 本文可作为F0治理/设计准备冻结基线；父统一外部hash清单并签收前，不自称F0已经frozen。**Formal experimental protocol / F1：not-frozen、not-ready。**

本轮目标是有界产品MVP、后续论文执行协议及独立证据准备，绝不是已经执行96个brief的正式实证。F0完成是一项具体治理交付，不能循环定义为“把草案hash所以论文完成”。当前没有自然测试效果/风险/费用排名。

## 1. F0固定什么

1. 研究范围：React source provenance + source-definition scope的覆盖、风险、适配成本；React产品选型不是格式优越性。暂不开HTML格式优劣模块。
2. 主endpoint R=baseline-relative局部保护域；G=原始程序整体健康的严格敏感性。资格在编辑前决定；同一source/task/method一个补丁、R/G两个mask，不为R再试，不合并两个分母。
3. 正式设计保留96独立brief×2配置×每格1source×每source4任务=192source、每method768计划槽；四methods共3072计划方法槽。不能因当前缺layout而减少任务或改成仅text/value研究。配置标签不认证上游模型身份。
4. v03及ZIP永冻，全部v03永久DEV，不重标/不回收heldout。下一阶段pilot固定8个新brief，永不回收formal。
5. 原始自然source不人为清理/修复/转成定制schema或预注marker后替代采集输入；archive原bytes不变。方法自己的通用wrapper、自动instrumentation/ID/格式化允许作为待测系统行为，计适配及无编辑round-trip/旁损，不仅因字节变化排除。若设最终marker-free/source-purity端点或导出约束，必须提前定义且同施于LLM与外部方法；主R/G不是默认最小diff竞赛。每生成槽一次、每方法一次提案，无best-of、修JSON、feedback retry或补健康样本。
6. FULL、SCOPE_OFF、PROVENANCE_OFF、LLM_ONESHOT四方法保持。scope消融必须同guard前候选，provenance消融必须真关证据；未实现不以名称占位假装完成。
7. P/E/Q/A及A=S+W+U_A，拒绝不是S、零分母NA、原始资格不等于方法支持；拒绝收益/成功覆盖损失同报；以brief/依赖家族聚类，不用task独立二项CI。
8. 独立private owner与最小权限，父当前兼产品作者仅读public；未知actual active time/tokens/费用为null，不从LOC或并行wall推人力。

详细定义仍见 `protocol-v04.md`、`../public-contracts/research-requirements.md`、`sampling-framework.md`、两份schema。本F0只锁定上述治理不变量、公开MVP能力声明、准备证据与明确剩余工作，不将MVP窄支持域伪装为正式任务域已经覆盖。

## 2. F0准备包与签收

建议父manifest逐文件hash并记录用途：

- 本F0文档、protocol-v04.md、readiness-v04.md；
- public-contracts/research-requirements.md、sampling-framework.md、denominator-schema.json、cost-event-schema.json；
- measurement-r2.md、evaluate-adapter-r2.md及其明确指向的公开测试/校准收据；
- external-baseline-feasibility.md（source-backed-not-executed）；
- 当前成本账快照、公开MVP声明和父持有的产品/构建证据指针；研究owner不为此读取产品实现。

Manifest由父另建，记录F0标识、UTC、签收owner、文件hash、范围、排除项和`formalReadiness:false`。不要自指hash；不要把future private打包；不要把F0文件hash称正式预注册完成。

当前校准唯一绑定是 `results/browser-calibration-r2-U5AyYj/policy.json`。其final helper为 `5da3141a47fb5d769201d0345a9ddf67a550762c443ab7d388cdb55c606aa1b0`，不是更改旧policy里的hash来补签。父统一清单应从当前批准证据取精确文件hash，不能让被测方法自行提供“可信hash”。

F0签收之后若修改文档/准备实现，另出revision及理由/差分；不能静默覆盖已经被manifest固定的字节。当前作者事件账可继续追加，但已冻结快照与后续活动需分开引用，不把动态账本旧hash说成一直不变。

## 3. 当前已经准备好的独立证据

- pure r2保存历史反例但不以terminal gap证明持续错误；eventually与hold分开，W采用clean deadline/tail保守规则。已有39/39单测收据，联合entry/evaluate/measurement为76/76，覆盖重叠不累加。
- `v04-jsx-app-script-react-1`入口：Program层function/const/let App或_App，App优先单mount，无imports/exports/self-mount；旧default-export仅显式legacy校准。ABI helper仅编译不在Node执行生成source。
- 最新真实browser calibration为8/8 discovery+validation与3/3入口控制，report.passed=true，13输入pre/post稳定且另有时点核验；19/19 browser/helper单测收据。不是11个自然程序编辑成功，不是完整layout/scenario runner认证。
- Onlook Web/Desktop固定commit公开源码适用性报告已完成；它发现Next/项目结构、source ID写入和style路径差异，尚未执行候选，不构成性能排名。

完整证据、限制、历史版本隔离见readiness-v04.md。

## 4. F0之后先补可信控制，不立即抽样

在任何pilot生成调用前，独立owner必须完成一次**pilot-admission**检查（不是第三个正式freeze阶段，只是F0→F1之间的执行许可）：

1. 补gap/grid/order/document-overflow及reload/setViewport/自动overflow checkpoint等既定任务所需观察与重放能力，定义coherent compound acquisition、identity、capture span和时间语义；缺项明确阻断，不能拿rect/withinViewport冒充全部布局。
2. 实现四方法端到端runner、统一公共准备/后检/accept锁定、完整P/E/Q/A记录；DEV证明scope同候选和provenance真消融。单独parser或命名stub不算方法完成。
3. 实现独立baseline capture及source/replay/catalog/viewport/observer/policy/checkpoint/ABI绑定；目前只有envelope校验不够。G/R资格、no-op、必要keys、unknown与非恶化偏序机器化。
4. 用公开可信手写控制验证完整链、无private期待泄漏、source hash与patch重建、失效后notMeasured、独立场景继续、成本日志和无retry。
5. 外部适用性若继续DEV，最多两个预定adapter里程碑；区分stock自动准备与自研adapter，允许通用wrapper/仪器化实测，记录成本、round-trip差分与行为保留。不能人为按题改写成定制schema凑同域；不能仅因自动ID/格式化或no-edit非目标字节变化先验排stock永久不适用。source-purity与R/G分别结论。
6. 绑定最新真实校准与完整依赖。helper/observer/宿主等实质漂移需要新的完整可信控制run与新policy版本，不用只改单hash。保存旧失败/旧成功。
7. 独立执行owner、网络/凭据/安全授权、资源/时间上限、日志隔离签收。F0文件存在不构成sample/API/browser自动授权。

本次治理收尾不做这些执行，不启动任何sample/API/browser，不写private内容。

## 5. 下一阶段固定8-brief pilot：具体执行顺序

### P1 — 封存pilot计划，不含formal题

独立研究owner依sampling-framework形成8个新需求单元；记录来源/家族/结构去重，排除v03派生换皮。两个固定生成配置、每格一次、每source4任务，理论16 source、每method64计划槽，四methods共256；R/G不重复生成。具体任务在看生成source之前固定，保留既定布局与保留要求。8是计划brief数，不是8个健康程序。

由独立执行者给pilot计划单独datasetId和pre-pilot manifest，锁定prompts、参数、超时、并发、source抽取、任务keys、临时方法/测量版本。该pilot freeze只固定一次开发试验，不是F1 formal freeze。TEST目录不放pilot，pilot与DEV记录独立标注并永不转formal。

### P2 — 获明确执行授权后一次采集

每brief×配置恰一次；保存原始request/response/source bytes/hash/transport/usage。截断、错误、缺source均终结原槽，禁止repair/retry、人工清理、补样、换brief或直到合格。原source不暴露给未来正式测试作者以外的未授权角色；pilot若向产品反馈，永久视为已见开发资料。

### P3 — 编辑前资格与独立baseline

按预定G/R筛查，source坏/方法不支持/测量缺项分型；若基础设施还不具备layout，停止pilot，不将所有对应程序标original_failure。冻结每任务baseline vector、保护域、允许变化及来源链；必要baseline unknown按协议保留资格unresolved。no-op不临时换目标。

### P4 — 四方法单次提案与共同后检

每任务从原source开始，无连锁补丁。使用相同公共语义/证据投影；方法不接收私有expected/baseline/验收反馈。guard前候选hash、拒绝reason、公共协议拒绝、methodError分别保存。接受在private评价前锁定，之后不回写拒绝。R/G资格并集只产生一个补丁。

### P5 — 完整任务域评价与分母闭合

原runtime重新加载、重放、跨预定viewport检查，保存全部expected keys为measured/notMeasured，不能只跑支持的那部分。S/W/UA使用绑定r2记录，W必须有独立确认违约，不把terminal gap/empty unavailable当失败或成功。前后source/patch/环境hash可重建；FULL拒绝与SCOPE_OFF同候选接受用于prevented-W/foregone-S/unknown，mapping无候选不伪造收益。

### P6 — 独立审计与可行性结论

检查16生成槽、256核心计划方法槽完整唯一，P/E/Q/A闭合，R/G不池化、时间窗口完整、private字段不泄漏、成本unknown诚实。按brief/家族描述资格率/缺测/覆盖/成本与实际独立性，不将64任务当64独立试验。目的为修测量与工程可行性，不以pilot漂亮分数证明研究假设。

### P7 — 有界反馈与退出

最多沿既定两个DEV里程碑修订。pilot发现runner/测量缺陷，可在新revision完整复验可信控制、必要时对同一批已见source做完整且明确标注的开发复测；不得新生成择优source、删除旧失败、把多次中最好的一次记原pilot或补进formal。后续复测只算DEV，不增加独立样本。任何安全/测量/独立性阻断未解决则defer formal。

最终产物：pilot全部原始槽与收据、资格/漏斗审计、独立性评估、适配成本、修订清单、明确进入F1或延期的签收。不是“pilot一跑完就自动F1”。

## 6. F1：正式实验冻结与执行许可

仅当readiness全部F1 gates满足，才冻结：

- 真正四方法、统一runner与所有既定任务域observer/动作/比较器；确切public请求、支持/拒绝矩阵、版本/依赖/编译/runtime/browser/policy；
- G/R资格、baseline capture、时间语义/容差、keys、分母、accept状态机、无retry/停止规则；
- 8pilot审计及96独立brief可行性（不是96个同模板表面变体）；
- 统计estimand、最高依赖cluster、区间方法、bootstrap次数/seed、分析器与模拟控制；
- 生成配置、采集完整矩阵、成本/transport、私有owner/独立executor与安全授权。

F1内部先固定方法/公开接口，随后独立test owner按冻结抽样规则形成并封存正式brief/oracle/key清单，不给父或产品作者。最终私有bundle hash、公开设计/统计seed与方法manifest全部固定后，才可开始任何正式source生成/编辑。当前不创建这些future私有内容。

F1 manifest另编号，明确引用F0及所有修订，不把F0 hash抄作“正式预注册完成”。F1后不可按结果改N/gate/任务/阈值，不能因布局不支持缩四任务。无法建立96独立性则透明延期，不调成漂亮数据。

## 7. 可交付结论与禁止结论

本轮可交付：有限MVP公开支持契约、两阶段治理、部分已校准测量基础设施、源代码支持的外部适用性调查、下一阶段可执行pilot步骤及具体阻断证据。

本轮不可交付：正式96数据已完成、四方法已执行、全任务域ready、零风险证明、React格式优越、外部baseline排名、低成本/经济性优势或已完成正式预注册。未知actual costs仍null；本人的治理wall只代表观测工作窗口，不是净人时。

## 8. 本F0的对称适配规则

外部方法的自动准备首先是被测系统行为，不是免费优势，也不是自动淘汰理由。凡源码变换自由度/marker-free/source-purity/补丁预算有额外限制，须在相应评价轨共同约束FULL/消融/LLM/外部候选，或明确标为不同系统契约并另报共同能力集。Onlook现有源码证据保留，DEV applicability尚待执行，不将调查变成永久不合格或编辑性能结论。
