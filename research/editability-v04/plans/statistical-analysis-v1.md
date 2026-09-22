# v0.4 Statistical analysis v1 — independent record-only implementation

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**F1-STATS candidate；未获独立统计审计签收，不等于F1 frozen / formal ready。** 本文与新建 `src/analysis-v04.mjs`、`tests/analysis-v04.test.mjs` 是F0后新增revision，不覆盖任何F0原文、snapshot、r2实现或被pin证据。本owner只读题定六份公开协议/契约，未读产品方法实现、private-test/private-results、未来逐例资料、credential/API，未运行自然source或模型调用。所有数据控制是手造/概率模型synthetic，不能推出任何自然编辑效果结论。

## 1. 冻结前明确的分析对象与独立性约束

- 研究总体仍限抽样框所述单文件React离线交互需求。没有概率抽样框/独立来源证据时，统计输出只能描述所观察固定清单，不能外推全部React仓库。
- 最小cluster是brief。两个生成配置、四任务、四方法以及同patch的R/G全部嵌套保留；两个配置绝不是两个独立brief。来源/模板祖先/作者上下文/结构家族有共同依赖证据时，用其最高依赖层的连通家族作为cluster，不能拆家族或删familyId。
- `design.briefs[].clusterId` 由独立抽样owner在看结果前固定；分析器不从名称推独立性。`independence.status`及证据basis也是外部审计声明，不是本代码已经证明独立。
- 当前sampling-framework要求**96个独立需求单元**；并未授权用96个dependent brief当另一个48-family正式设计。本实现对formal同时要求brief=96、highest clusters=96且verified；达不到即audit-failed/defer，不能凭“提升cluster后照跑”擅自更改招募门槛。DEV/pilot或保留的受限轮可显式按family描述，正式推断须新协议/独立签收，不扩N、不换题。
- `maxBriefsPerCluster`是抽样框/抽取规则在生成前保证的最大纳入家族大小，不能用事后观测max冒充总体支持上限。每方法每endpoint每cluster上限为 L=该上限×2×4。若未来框无法给此上限，不能使用下述Hoeffding敏感界；当前输入fail closed，交独立审计决定新的协议。
- 不使用96字面数推精度，不使用任务独立二项CI，不task bootstrap；8pilot永久不并入formal。DEV/PILOT/FORMAL一次输入只有一种，R/G从不相加或合并分母。

## 2. 纯记录接口（由父中转给runner owner92301555）

公开实现仅消费如下allowlisted信息，不读取任何source、patch、oracle或私有文件；未来数据的真实读取/调用 `analyze` 由独立执行owner承担。原始source/patch锁、分类器语义与hash重建属于独立raw evidence审计，不能由产品方法自报通过。

```js
{
  schemaVersion: 'analysis-v04-input-1', datasetId: 'opaque-id',
  datasetKind: 'dev' | 'pilot' | 'formal',
  design: {
    briefs: [{ briefId: 'opaque', clusterId: 'highest-dependency-family' }],
    configs: ['fixed-config-1', 'fixed-config-2'],
    tasks: ['fixed-task-1','fixed-task-2','fixed-task-3','fixed-task-4'],
    methods: ['FULL','SCOPE_OFF','PROVENANCE_OFF','LLM_ONESHOT'],
    maxBriefsPerCluster: 1,
    independence: { status: 'verified' | 'unverified', basis: 'pre-outcome evidence reference' }
  },
  evaluationBinding: { evaluationSchema: 'frozen raw schema', normalizerVersion: 'independent revision' },
  records: [{
    briefId, configId, taskId, method,
    eligibility: { R: 'eligible', G: 'originalIneligible' },
    preparation: 'ready' | 'failure' | 'notExecuted',
    proposal: {
      status: 'accepted' | 'methodRejection' | 'publicProtocolRejection' | 'methodError' | 'notExecuted',
      candidateHash: 'guard-before SHA256' | null,
      scopeGuardRejected: false, invoked: true, acceptanceLocked: true
    },
    outcomes: {
      R: {
        confirmedViolation: false, unknown: false, allRequiredPassed: true,
        binding: { evaluationSchema, normalizerVersion, evidenceHash: 'raw receipt SHA256', classification: 'S' }
      },
      G: null
    },
    costEventIds: []
  }],
  costEvents: [] // existing public cost-event-schema records, independent ledger
}
```

`eligibility`可取eligible/originalIneligible/eligibilityUnresolved/upstreamMissing/notScreened。任务标识是每brief的四个固定任务位置而非跨brief相同语义。每brief×config恰一原source，原source provenance由raw层固定；不依未来结果增减design列表。每个笛卡儿积slot恰一记录。R/G资格共享同提案；一端不合格可null而另一端照常评价。公共准备是在R/G资格并集上一次完成，四方法eligibility和preparation必须相同，方法不能删自己的E。

**归一化不是用三个布尔改写r2：** only独立eval owner可从绑定raw schema转出三布尔，并保留原evidenceHash、明确normalizerVersion及S/W/U_A；分析器核对版本/哈希形状/分类一致性。confirmedViolation必须原raw存在可确认违约，terminal gap/早期stable wrong/hold语义失败不能被归一化成W。未知仅在有另一个独立确认违约时被W优先覆盖分类，但`acceptedWithUnknown`、`confirmedWrongWithUnknown`另报。哈希与布尔一致**不是**校验证据真伪/observer语义的充分证明，未来独立审计必须从raw重建并审核normalizer。分析器不接受没binding的裸booleans。

accepted必须invoked=true、acceptanceLocked=true、有candidate SHA256；其它status必须acceptanceLocked=false；notExecuted必须invoked=false。accepted只有在该endpoint eligible时有outcome；其余outcome显式null。接受锁必须在private评价前产生且append-only，时间顺序/patch身份在底层runner receipt独立核验；布尔声明不自证锁有效。

输入/输出都可能包含私有opaque IDs；该API返回按cluster审计明细，未来应留在private owner边界。公开release需锁库后单独去标识及授权，不能把完整JSON直接发给产品作者。

## 3. 完整性审计与漏斗

先由design生成全部expected keys，再核对received records。分别输出missing、duplicates、unexpected、notInvoked以及计划/接收/unique计数。任何缺slot、重复、越界、候选不一致、绑定缺失、字段矛盾、成本引用缺失都会使`audit.valid=false, endpoints=null`。不选latest/best，不把缺记录自动生成notExecuted；完整notExecuted收据与丢失记录是不同事实。运行中/中断数据可审计但没有完整可信ledger不发布率/CI。

每endpoint×method严格派生且校验：

```
P = E + originalIneligible + eligibilityUnresolved + upstreamMissing + notScreened
E = Q + preparationFailure + preparationNotExecuted
Q = A + rejection + methodError + proposalNotExecuted
A = S + W + U_A
rejection = methodRejection + publicProtocolRejection
```

资格原因优先级仍由公开schema/独立eval固定：never screened→notScreened；attempted upstream但无source→upstreamMissing；否则confirmed ineligible优先于unresolved；无以上才eligible。记录已是此互斥枚举，不允许本统计器另按方法支持重判。original eligibility failure不能偷偷当方法失败，方法unsupported不能退出E/Q。

接受后 `confirmedViolation`→W；否则unknown→U_A；否则allRequiredPassed→S；三者全false拒绝、不把它当S；allRequiredPassed与wrong/unknown共存矛盾拒绝。未知不为0，确认W可伴随unknown诊断。所有比率零分母null；**A=0时W/A=null，绝不是0%风险**。

## 4. 预指定estimands与权重

令b为brief，c为最高cluster，m为方法，e为R或G，P_b=8。S/E/Q/A/W/U_A均按上述漏斗定义，是有限检查成功/已确认错误，而非一般正确性。

### 4.1 主R与严格G

主描述/估计量：R每方法的 `S/P = ΣS_b/ΣP_b`、`S/E = ΣS_b/ΣE_b`。主scope比较为同brief FULL−SCOPE_OFF 的S/P差；R FULL−SCOPE_OFF等权eligible-brief S/E差作为资格条件化补充。四方法完整表都报S/P、S/E、Q/E、A/E、W/A、U_A/A、rejection/Q计数与率。G重复同套报告作为严格敏感性，不把R或G较好者临时改主结果。

- **ratio-of-sums**：Σ numerator / Σ denominator；对合格/接受机会按其实际数量权重。其总体解释是抽样机制下独立cluster总数期望之比 `E[X_c]/E[D_c]`（非同分布时是固定抽样设计平均期望之比）。W/A方法间差异是各自选择接受集合的操作风险对比，**不是**共同人群因果风险差。
- **equal-brief**：S/P为 `mean_b(S_b/P_b)`，当前平衡设计与ratio-of-sums相等。S/E为 `mean_{b:E_b>0}(S_b/E_b)`，目标“至少一项eligible的brief条件下的平均成功比例”；E_b=0明确不进入此conditional mean，但仍留在P、审计和其他估计量，不能给它随意填0。
- **equal-brief paired difference**：在相同b（eligibility跨方法共享）先算两个比例差再等权平均；family bootstrap复制整组brief，不把family平均误当brief平均。代码同时给ratio-of-sums差与equalBriefContrasts，标签不同，不混称同一estimand。imbalanced family时每brief目标不同于每family等权成功率。
- **配置对比**：每method同brief、同highest cluster内 config[0]−config[1] 的S/P、S/E差。每次bootstrap两配置同步重采样；不分别造独立抽样分布再相减。配置是固定标识，不认证上游模型身份。
- 除scope外，FULL−PROVENANCE_OFF与FULL−LLM_ONESHOT报告同一覆盖/拒绝/风险率差及成本明细；PROVENANCE_OFF候选可能改变，只称组件/系统对比，绝不解释为same-candidate scope guard效果。

### 4.2 Scope guard paired decomposition

先核对FULL与SCOPE_OFF非空guard-before candidateHash相同；不相同即audit失败，不算净效益。在endpoint eligible的同候选槽：

- FULL显式scopeGuardRejected、SCOPE_OFF accepted且W → preventedW；
- 同条件但S → foregoneS；
- 同条件但U_A → unknownAccepted；
- FULL scope拒绝、同候选SCOPE_OFF未接受 → unevaluable，计入unknown但不算preventedW；
- 任一缺candidate → noCandidate，单列，**从不记收益或可评价unknown**；
- 没有FULL scope拒绝 → notGuardDiscordant；原不合格单列ineligible。

unknown=unknownAccepted+unevaluable。P=ineligible+noCandidate+notGuardDiscordant+preventedW+foregoneS+unknown。全部在原P/E分母报率和cluster区间，不只在discordant subset内挑case。不存在candidate不是阻止错误；全拒绝不证明实用安全；preventedW是操作意义阻挡，不证明FULL修复或普遍安全。

## 5. Confidence算法、seed与小分母政策（真实数据之前固定）

- 生产B=**9999**，two-sided nominal **95% pointwise percentile cluster bootstrap**；经验quantile用排序后索引 `(B−1)*p` 线性插值（p=.025/.975）。不使用正态/task二项/Wilson/Clopper–Pearson任务界。
- 确定性PRNG为代码中的32-bit Mulberry32；基seed **67379238**。每个endpoint/method/estimand使用固定label从base seed经 `Math.imul(h ^ charCode,16777619) >>> 0` 派生stream。报告每项seed与B，保证固定输入可逐位复跑。每个contrast内部同一draw同时取两方法/配置；不同报告项stream可不同，不能据此假设端点独立。
- 每次从K个最高cluster有放回取K个，保留cluster内全部brief、配置、任务、方法、R/G结构。实现先化简为各cluster充分计数/brief比例总和再重采样，与复制整簇重新汇总完全等价。不把family大小固定成平均值，不按tasks数抽样clusters。
- 所有CI需要抽样机制具有合适的独立cluster与代表性/可交换性近似；非概率便利框仅有限样本描述。independence unverified则bootstrap interval=null。family间潜在依赖、非交换性/强异质性/有放回近似有限框偏差均需独立审计，本文没有替代抽样设计证明。
- K<20：interval=null、small-effective-denominator。risk=W/A或U_A/A还要求A>=20且至少10个有接受的clusters；两方法risk差两侧都满足。阈值是预声明保守报告门槛，不是充分coverage定理，不把20当有效样本量保证。
- 任一bootstrap draw分母=0：记录undefinedReplicates并把整个CI置null，不丢掉坏draw后称95%；原分母=0直接no-information。bootstrap样本分布完全相同（包括W=0、W=A、全部相同比例或paired delta恒0）：interval=null，degenerate-bootstrap-no-risk-guarantee。点估计和计数仍留存。
- 稀有事件W只有1或2个也可能产生不可靠percentile区间；上述阈值不能消除此问题，因此每张风险表必联报cluster A/W/U_A分布与下一节敏感界，不能靠窄bootstrap宣称低风险、等效或非劣。
- 全部为pointwise区间；多个方法/率、两个endpoint以及配置对比**不**有同时95%覆盖保证。无预指定显著性发现决策、不报多重挑选的p值/胜者。若论文要familywise confirmatory hypothesis testing，需结果前另协议（当前没有该授权），不能把pointwise排除0变成全家族结论。

## 6. 零事件/稀疏接受的cluster敏感界

对每个最高独立cluster c，X_c=W_c/L、Y_c=A_c/L，均在[0,1]，L取事前抽样框上界。包括A_c=0的cluster，不能只选接受过的clusters。定义x=mean(X_c)、y=mean(Y_c)，epsilon=sqrt(log(4/alpha)/(2K))，alpha=.05。

独立clusters、固定有界支持、固定抽样设计下，用两个双侧Hoeffding与union bound保证两个总体平均期望同时落于截断区间至少1-alpha。因此报告目标theta=平均E(W_c)/平均E(A_c)的敏感界：

```
lower = max(0, x-epsilon) / min(1, y+epsilon)
upper = min(1, (x+epsilon)/(y-epsilon))  if y>epsilon
        1                              otherwise
```

这允许cluster内任意正相关与不等大小，不要求task独立；非同分布的独立clusters也适用于平均期望目标。它**不是**条件于实测A的有限样本错误率CI，更不是task零事件二项上界。y的下界不正时标注weak-denominator-upper-uninformative，可能只能给[0,1]。A总=0时根本未定义接受风险，返回null而不是一个可声称安全的界。

该敏感界总是显式标注独立cluster/固定L假设；若真实跨family依赖未知，此界只是反事实假设下的敏感性，不能把它当已获独立性证据。cluster上界不真实则界失效。W=0时bootstrap退化、此敏感界通常仍宽且上界>0，不能写“0风险CI”。

censored accepted另给observed partial-identification区间 `[W/A, (W+U_A)/A]`，标签明确**不是CI**。对W+U_A同样给cluster-Hoeffding敏感界作为所有未知都错的保守极端。W中的共存unknown不再次累加U_A。没有MAR假设，不插补/删UA，不把unknown→unknown解释为保留成功。

## 7. 成本、不免费与未知量

输入既有cost-event schema，统计层检查数值/时间窗、ID唯一、引用、parent存在/无环、cached<=input以及human time必须direct-active-timer。完整原schema结构/证据真实性仍由独立原ledger validator审计，不声称这里替代JSON Schema全部约束。

- 共享工程/仪器化/作者和实验调用保持原phase/allocation/origin；方法costEventIds给可追踪归属，PROVENANCE_OFF/oneshot不假定免费。父层inclusive事件汇总，child仅解释分解、不重复加；有归属歧义则mixed-unallocated，不分摊成漂亮方法成本。
- wallSeconds必须与已知UTC起止一致；observedWindowUnionSeconds取所选事件时间窗并集，重叠不相加。不把wall并集叫project完整elapsed、active human或CPU时间。未知窗口明确保留unknownEvents。
- root additive tokens/attempts/human总量任何未知即total=null，knownSubtotal仅已知部分，并附unknownEvents；无events也不是total=0。缓存已包含于inputTokens，不另加。金额未知null，货币不一致不求总和。
- 同一共享事件可出现在多method summary，但不可把这些method summary相加。独立raw ledger必须核实root为inclusive汇总，不能parent-child混合语义双计。
- 本owner实际人工量/author-model tokens/金额未知null；只记录确实测得的本地tests/simulation进程UTC及wall。无credential/API访问、无自然采样调用。

## 8. 确定性控制与Monte Carlo覆盖误差

不是只跑几个toy单测就宣称推断校准：`runSimulationControls`有独立生成的数据集重复，并存每模型seed、真参数、报告区间比例、conditional coverage、相对.95的signed error、MC标准误、平均宽度、未报原因及unconditionalCoveredFraction。后者把未报CI的replicate不算作覆盖，避免只选择非零W数据集报“优秀覆盖”。MCSE的二项计算只针对**独立合成数据集重复**，绝不施加于研究tasks。

固定总simulation seed **1374772973**，**600 datasets/model**；最终simulation B与production一致为**9999**。每模型48个最高clusters，只是模型参数，不假装真实sampling-frame可提供48或96独立来源。先保留一次B=1999的实现控制收据 `results/analysis-v04-simulation-v1.json`；在读取自然数据前为与生产算法完全同B新增完整 `results/analysis-v04-simulation-v1-productionB.json`，不覆盖旧run，不按coverage选择seed/参数。

| 模型 | 生成规律/已知target | 检查范围 |
|---|---|---|
| null | 两方法各p=.5；75%同latent，其余独立latent；每簇8任务全相关；真paired差0 | 同簇配对差覆盖，不把384tasks独立 |
| positiveDependence | cluster级W Bernoulli(.2)，8tasks全同 | W/A真.2，簇内相关为1的极端 |
| imbalancedCluster | family大小1/6等概率；S概率.2/.8；每brief8tasks全同 | informative cluster size；ratio真5/7，不能错用family均值.5 |
| censored | 每簇S=.55/W=.15/U_A=.30，全accepted | 已确认W/A真.15，不声称未知总wrong真.15；敏感界另报 |
| zeroAcceptance | 所有簇拒绝 | W/A无定义、reported=0，无假[0,0] |
| rareZeroEvents | 每簇W概率.005，8tasks全同 | 大量zero-event退化；揭示选报偏差、upper sensitivity |
| dualEndpoint | 同latent U：R S iff U<.7，G E iff U<.8、S iff U<.4 | R S/P=.7与G S/E=.5分别覆盖；joint覆盖不能自称95% |
| missing | 每replicate随机删除slot、复制slot或显式notExecuted | 600次每种结构审计；此模型coverage不适用，不冒充推断模拟 |

适用范围：这是有限几种iid cluster DGP的数值检验，绝非任意依赖、抽样框偏倚、真实observer错标、生成模型漂移或publication selection的覆盖证明。48clusters、完美簇内相关及1/6大小仅是stress controls；没有宣称同时涵盖所有真实机制。signed error不接近0时应原样披露，不通过调seed/retry“校准到通过”。稀有事件预期发生退化，是需要展示的失败边界，不是实现自动达标证据。

## 9. 独立复跑与移交

```powershell
node --test tests/analysis-v04.test.mjs
node --input-type=module -e "import {runSimulationControls} from './src/analysis-v04.mjs'; console.log(JSON.stringify(runSimulationControls(),null,2));"
```

纯Node内置功能，无依赖安装/网络/产品源码导入。真实ledger的未来调用是 `import { analyze } ...; const report=analyze(independentlyLoadedLedger)`；本任务没有加载任何真实ledger。

F1统计审计应至少核对：(1) sampling-frame冻结cluster和L的真实性；(2) raw→normalized outcome、no-op/eligibility/accepted锁跨owner provenance；(3)计划笛卡儿积完整、notInvoked与missing不同；(4)W/A小分母/退化；(5)配对method/config与R/G不同target；(6)synthetic seed完整可复跑与coverage误差不是自然效果；(7)成本分账/unknown；(8)最终分析代码/测试/计划/receipt外部hash并签署F1 manifest。

本交付只补统计/审计实现候选，不授权pilot或正式采样，不解除其他F1 gates，不把future独立统计审计提前写成通过。

## 10. 本次控制结果（synthetic，不是自然实验）

完整production-B收据：`results/analysis-v04-simulation-v1-productionB.json`。每个概率模型600个独立合成dataset，B=9999。结果原样保留，**不把它命名为“95%推断已经校准通过”**：

| 模型/端点 | bootstrap reported | coverage（有CI者） | 相对.95误差 | MC SE |
|---|---:|---:|---:|---:|
| null paired差 | 600/600 | .978333 | +.028333 | .005944 |
| positiveDependence | 600/600 | .931667 | −.018333 | .010301 |
| imbalancedCluster | 600/600 | .941667 | −.008333 | .009568 |
| censored confirmed W | 600/600 | .936667 | −.013333 | .009943 |
| zeroAcceptance | 0/600 | null | null | null |
| rareZeroEvents | 114/600 | .991228 | +.041228 | .008733 |
| dual R | 600/600 | .951667 | +.001667 | .008756 |
| dual G | 600/600 | .946667 | −.003333 | .009173 |

rareZeroEvents有486/600份zero-event bootstrap退化；选出的114份CI看起来coverage=.991228，但全部dataset的covered fraction只有113/600=.188333，**绝不能引用前者当整套稀有风险推断已达95%覆盖**。独立cluster Hoeffding敏感界在此有限模型600/600覆盖、平均宽约.27757；这只是保守数值表现和假设条件下界，不证明真实样本安全。Hoeffding其他已定义比例模型也600/600覆盖；plug-in MCSE=0只是有限模拟全覆盖，不代表true coverage无不确定性。

dual两端同时覆盖543/600=.905，直接说明两个pointwise 95%区间不等于joint 95%。missing模型三种审计分别600/600检出/保留，coverage不适用。正依赖/删失等模型的轻度欠覆盖如上披露，未来独立统计审计可据此要求更保守主区间或在F1前另revision；本owner不调整seed凑通过。

单测历史：初始24/24通过；扩充到28项时 `results/analysis-v04-tests-v1.tap` 为27/28，新增unevaluable scope拒绝控制发现缺一个status分支导致对null outcome分类。已修复并保留失败收据；最终 `results/analysis-v04-tests-v1-attempt02.tap` 为**28/28**。此修复不改统计抽样算法。risk差在任一边际风险为0或1时也显式不报bootstrap CI，避免把某方法零事件当已知零风险后推虚假精确差。

最终源码重新完整生成600×8控制并与已保存production-B JSON逐字段比较，收据 `results/analysis-v04-final-verification-v1.json` 绑定实现/测试/TAP/simulation hash；外部manifest另列本计划等全部新增工件，不自指hash。运行wall仅收录在新增成本记录，不当人工工时。
