# v0.4 Statistical analysis v2 — audited target separation and finite-sample primary bounds

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**v2 implementation for independent F1 statistical review；尚无真实抽样/独立执行assumptions签收，不授权自然样本分析或采集，不替代全部F1门槛。** 这是父明确授权、独立审计提出实质缺陷之后的全新revision。v1源码、测试、计划、模拟和manifest原字节全部保留，不把本次修复倒签入v1。无产品实现、private-test/private-results、未来逐例、credential/API访问。

## 1. 审计触发的明确更正

1. **v1零观察分母错误：**把实测A=0时风险敏感界返回null，若又称对总体risk无条件95%覆盖，就混淆了实测A与总体期望A。反例：K=48独立cluster，各以q=.005接受、接受必错(W=A)。总体风险为1；实测A=0概率=.995^48≈.786。只在观察A>0时报告总体界会严重丢失覆盖。v2保留observed W/A=null，同时对已定义的总体risk返回[0,1] no-information，不把这些dataset排除覆盖统计。
2. **v1 bootstrap不是主置信保证：**父转独立审计发现，K48的理想B→∞ cluster percentile bootstrap在p=.2/.15时覆盖约.91684/.93378，增加B不能修复方法的离散/边界欠覆盖。v2 bootstrap仅探索性；正式主区间改为独立有界clusters下有证明的有限样本Hoeffding界。
3. **v1 formal family>=96判定撤销：**依父转协议owner的事前澄清，96是需求brief数，不强求96个最高功能/依赖族。独立来源brief可共享功能family并最高族聚类；真正模板/血缘依赖仍需证据。v2 formal要求96个计划brief，但最高cluster数C可以低于96。C如实公开，不能以96字面数宣称±.10精度，不能更改标签凑独立数。source pool尚未证实；C<96本身不触发defer，未证明合法独立cluster机制则主推断blocked。

## 2. 观察比例与总体参数彻底分离

### 2.1 Observed（描述）

每endpoint R/G、每method分别给P/E/Q/A/S/W/U_A及全部漏斗分区；S/P、S/E、Q/E、A/E、W/A、U_A/A、rejection/Q按原计数计算。零分母始终null。W/A=0只是观察到零确认错误，不是总体风险已知0。R/G共享同patch、不同资格mask，不能池化。

同时保留equal-brief S/P、conditional-on-E_b>0的equal-brief S/E及FULL−各对照的equal-brief差。它们是描述性补充，不把它们冒充下面ratio-of-expected-cluster-totals主参数。每brief P_b=8，当前平衡设计下observed S/P等于equal-brief平均。

Scope描述表保持同guard-before候选SHA256：FULL显式scope拒绝、SCOPE_OFF接受W→preventedW，S→foregoneS，UA→unknownAccepted；同候选SCOPE_OFF未接受→unevaluable；unknown=后两项。任何无candidate→noCandidate，永不记收益。候选不一致审计失败。所有收益/损失用原P/E，notGuardDiscordant/ineligible分别列。此分解是操作归因，不是FULL修复证据。

### 2.2 Population（唯一允许的主机制参数）

`target = locked-design-cluster-expectations`；`weight = ratio-of-expected-cluster-totals`。

**以事前锁定的需求brief清单、配置、任务、最高依赖分区为条件**，设c=1…C，随机向量含该cluster全部source/配置/任务/方法的生成与执行结果。cluster内部依赖任意；仅当独立sampling/execution owner及独立auditor共同批准机制满足cluster间独立，才推断此机制反复执行意义下的参数。

```
θ_m,e(X/D) = [Σ_c E(X_m,e,c | locked design)] / [Σ_c E(D_m,e,c | locked design)]
```

必须总体期望分母>0才有定义。X与D在同cluster可任意相关。方法、两个config、R/G在cluster内不拆开。不同clusters允许不同分布，**不需要iid同分布假设**；但不同cluster之间共享prompt祖先、执行上下文、模型运行状态等残余依赖必须由实际证据排除或提升cluster。一个签名不能改变这个科学条件。

这不是“从需求总体随机抽brief”的代表性结论，不要求把原无放回去重框偷偷改成iid有放回框；也不声称评价所有React需求。对固定已抽需求集合的独立执行机制参数推断，与全部需求总体外推是两回事。若实际生成/执行存在无法排除的跨族依赖，主界null/blocked，不能改贴conditional标签后照称primary。若论文要无放回有限框设计型推断或需求超总体推断，必须另冻结真实概率抽样设计及目标，本版本未实现这种变更。

## 3. 三个事前主量及多重性预算

固定且不根据未来结果改：

1. R FULL S/P；
2. R FULL S/E；
3. R FULL−SCOPE_OFF 的paired S/P差。

总family alpha=.05，三者分别alpha=.05/3（单项置信水平.983333…），用Bonferroni使三个已定义参数同时覆盖至少.95。R S/E还要求独立签名payload明确批准`positiveDenominators`包含`R:eligible`，并由独立审阅验证正总体资格分母的机制依据。缺该签收，第二主量interval=null；代码`primaryFamily.complete=false`、`nominalFamilyCoverage=null`，不能声称三量family已就绪。剩下两项仍沿原预算，不重新分配alpha。

G、PROVENANCE_OFF/LLM_ONESHOT、各风险/拒绝/准备/覆盖比较、两配置差、UA最坏情形均明确pointwise .05敏感性，不是同一个确认性family。不能从这些额外表挑最好结果改主结论。risk contrast的两个接受集合通常不同，只是两个系统各自选择集合的风险差，不是共同人群因果效应。

## 4. 实际cluster容量及有限样本证明

锁定设计中cluster c含b_c个brief，每brief两配置×四任务，固定容量 `l_c=8*b_c`；冻结总体上界 `L=8*maxBriefsPerCluster` 必须满足l_c≤L。代码与双签payload同时绑定C、L及完整clusterLayout，不能结果后改变大小。对单配置比较使用l_c/2。全部original failure、未调用、拒绝保留在原容量，不能只用接受过的clusters。

以下界从实际l_c推导，不按task独立。令 `V=Σ_c l_c²`。对独立 `X_c∈[0,l_c]`，Hoeffding给：

```
P(|ΣX_c − ΣE[X_c]| > r(δ)) ≤ δ
r(δ) = sqrt(V * log(2/δ) / 2)
```

该式允许任意簇内相关、不等大小、不同分布，前提是事前固定范围及cluster间独立。l_c不能来自方法输出或事后观察到的最大成功量。C少或一家族很大，界自然变宽；不存在“达到20cluster就近似有效”的主界阈值。

### 4.1 固定P的S/P主界

P_total=Σl_c固定为正。令s=ΣS_c，使用δ=alpha：

```
[max(0,(s−r(alpha))/P_total), min(1,(s+r(alpha))/P_total)]
```

不额外给已知固定P制造随机分母；96brief但有48families时使用真实48个cluster和各l_c，不能当96次独立。

### 4.2 随机E/A/Q分母的ratio界

设观察n=ΣX_c、d=ΣD_c，X_c≤D_c≤l_c，给两个均值各delta=alpha/2，union bound总alpha；r=sqrt(V*log(4/alpha)/2)。分子区间[max(0,n−r), n+r]，分母区间[max(0,d−r), d+r]。

若d−r>0，用矩形上的最坏比值并截断[0,1]：

```
lower=max(0,n-r)/(d+r)
upper=min(1,(n+r)/(d-r))
```

否则直接**[0,1]**，状态population-no-information。这包括observed d=0。区间目标域明确为ΣE[D_c]>0，不条件于观察d>0、不删除d=0的数据集。

- observed A=0、真实机制E[A]>0：观察risk=null；population risk已定义但无信息，[0,1]。
- 真实机制E[A]=0：population risk本身无定义；不能为不存在参数宣称coverage。单次观察A=0不能区分这两个世界。实际输出pointwise风险界附正期望分母domain；若不接受该domain，只能记目标未定义/未建立，不能写风险保证。
- R S/E的primary已额外要求独立批准正期望资格分母，不能由作者自行断言。

### 4.3 共享P/E/Q分母的paired差

同cluster `Z_c=X_FULL,c−X_OTHER,c∈[−l_c,l_c]`，无需假定两个方法独立。

固定P：`r_Z=sqrt(2*V*log(2/alpha))`，以观察z/P_total为中心加减r_Z/P_total，截断[−1,1]。

随机共享分母：给Z和D各alpha/2，`r_Z=sqrt(2*V*log(4/alpha))`、`r_D=sqrt(V*log(4/alpha)/2)`。若d≤r_D返回[−1,1]；否则取`(z±r_Z)/(d±r_D)`四端点min/max再截断[−1,1]。signed numerator必须四端点，不能照抄非负ratio端点方向。

### 4.4 不同接受分母的risk contrast

用same-cluster四元组 `(W_FULL,A_FULL,W_OTHER,A_OTHER)`。四个独立cluster-sum均值的边际失败预算各alpha/4，总alpha；等价于每方法ratio函数调用alpha/2，所以半径含log(8/alpha)。双方得到[l_F,u_F]、[l_O,u_O]后，差界为 `[max(-1,l_F-u_O), min(1,u_F-l_O)]`。

此处不假定四均值或两方法独立，union bound允许它们相关，独立性仅施于最高clusters。任一观察A0不当已知risk0，仍以[0,1]参与差界。此界保守，不利用协方差缩窄，但有限样本覆盖逻辑明确。两配置S/E因eligibility可能不同，也使用四均值ratio-difference界；同brief/config pair关系仍完整保留。

## 5. Assumption evidence与不可自签门槛

ledger仍为`analysis-v04-input-1`结构，保持v1所有计划槽、evaluationBinding、独立raw normalizer绑定、共同eligibility/preparation、costEventIds。新增根字段：

```
collectionStartedAt: 原始source采集开始的可核验UTC
assumptionEvidence: {
  payload: assumptionPayload(input, {...}),
  signatures: [
    {role:'independent-owner', authorityId, signatureBase64},
    {role:'independent-audit', authorityId, signatureBase64}
  ]
}
```

payload固定内容：analysis版本、dataset身份/kind、designSha256、trustDomain、lockedAt、preOutcomeCommitment、target、weight、independenceModel、K、L、clusterLayout、familyAlpha/primaryAlpha/pointwiseAlpha、三个primary名字、positiveDenominators及evidenceRefs。

至少四种证据purpose：`source-family-dependence`、`execution-independence`、`frame-bound`、`pre-outcome-lock`；每项有引用及SHA256。功能family名称不由本程序猜成独立/依赖，最高cluster划分由独立owner事前审核并签收；真实模板/血缘祖先不能靠换名字去掉。source pool可行性仍待独立审计，本实现不为它虚构证据。

调用者由**独立执行环境**注入第二参数，而不是从ledger读可信公钥：

```js
analyze(independentlyLoadedLedger, {
  trustDomain: 'study',
  analysisAuthorIds: ['known-product-or-analysis-author-id'],
  trustedAuthorities: [
    {role:'independent-owner', authorityId, publicKeyPem},
    {role:'independent-audit', authorityId, publicKeyPem}
  ]
})
```

纯Node内置crypto对canonical JSON验证Ed25519 detached签名。公钥DER身份必须不同，不因同一公钥PEM换行/格式不同当两把钥匙；角色/身份不同；已知分析作者不能做批准者。没有外部trust anchors、只有作者`verified:true`、缺一签、signature或target/K/L/alpha/design修改、签收不在采集前，全部blocked。synthetic-control trust domain不能授权formal。

**签名边界：**签名认证批准内容，不能用密码学证明真实独立性、正确归一化或真实时间。真实公钥anchor注册、owner角色独立、append-only预结果commit时间、来源/执行证据必须外部审计；分析作者不能把自己的公钥注入真实执行环境。测试里的临时内存key仅验证软件拒绝/接受路径，不是研究证据、没有写出private key，也不读取任何credential。`assumptionPayload`只是构造待签内容，绝不自行批准。

缺assumption evidence时：仍可给完整observed描述和审计；**所有population primary与pointwise interval=null**，并给blocked原因。连“假设条件下敏感界”也不在高层report偷偷填入冒充已验证推断。低层数学函数用于独立控制/证明，本身不能授权真实study。

R/G evaluation booleans仍必须绑定冻结raw schema、normalizer version、SHA256与一致分类；W优先于unknown但诊断保留。raw→booleans的语义正确性、accepted先于private评价、原source/patch hash重建属于独立eval/runner证据审计，签名不替代它们。

## 6. 完整性、成本与探索性bootstrap

- 设计笛卡儿积唯一全槽审计保持；missing/duplicate/unexpected→audit-failed且无observed/population推断；notExecuted有明确receipt，仍进入P与相应漏斗分区。
- P=E+4原始分区；E=Q+准备失败/未执行；Q=A+拒绝/方法错/未调用；A=S+W+U_A；拒绝=方法拒绝+公共协议拒绝，严格代数检查。
- observed成本沿独立cost ledger：未知tokens/money/human=null；wall按UTC窗并集，不当active人时，不嵌套/并行双计。PROVENANCE_OFF/oneshot有同样coverage/rejection/cost，不视为免费。
- bootstrap B=9999，base seed67379238、Mulberry32、label-derived streams不变，v2 label前缀区别；全部最高cluster重采样，配对关系不拆；仍保留小分母/零事件/退化/undefined resample拒报。**只在exploratory命名空间，不是主CI**，不因B大自称校准。
- independence gate失败时连探索性interval也不输出正式数字，只留point及blocked状态。即使gate通过，固定不等分布cluster的pairs bootstrap并非本条件目标的有保证近似，必须解释为探索诊断；主界的有效性来自独立有界和Hoefdding证明，不来自bootstrap。

## 7. 事前seed、模拟模型、精确枚举与复跑

simulation seed1374772973，最终每模型600个独立合成dataset、B9999。每模型K48只是stress model设置，不证明现实有48独立族。所有输出存seed、真target、报告率、observedUndefined、population-no-information数量、coverage与相应nominal error、MC SE/mean width、unconditionalCoveredFraction；原分母零不自动丢弃。primary单项nominal=.983333…，三量joint目标=.95，不能混写coverage error。

| 模型 | 真值/目的 |
|---|---|
| null | paired S/P真差0，75%共latent，簇内8任务全同 |
| positiveDependence | W/A=.2，簇内相关为1 |
| imbalancedCluster | 事前抽cluster大小1/6brief，然后锁定；成功率.2/.8；每replicate真target依实际锁定容量加权，非旧超总体5/7 |
| censored | confirmed W=.15、UA=.30，单独验证W+UA极端.45，不假设MAR |
| zeroAcceptance | 机制q=0，population ratio未定义，coverage=null而非零或1 |
| rareZeroEvents | W=.005，A固定；零W不推零风险 |
| sparseAcceptanceAllWrong | q=.005、W=A、population risk=1；大量observed A0但population[0,1]仍覆盖 |
| riskContrast | 同latent，FULL A<.05/W<.025→risk .5；OFF A<.8/W<.24→risk .3；真差.2 |
| dualEndpoint | R S/P=.7；G E iff U<.8、S iff U<.4→S/E=.5，同patch不同mask |
| primaryFamily | E=.8、FULL S=.5、OFF S=.6，主真值.5/.625/−.1；检验Bonferroni三量joint |
| missing | 每replicate随机删slot、复制slot、显式未调用；完整结构审计，不冒充coverage模拟 |

另60格穷举：C∈{24,48,96}×p∈{.005,.01,.05,.15,.2,.4,.6,.8,.95,.995}×{A全有/W~Bernoulli(p), A~Bernoulli(p)/W=A}。枚举**独立合成cluster**事件总数的二项概率，绝非给真实任务套二项CI。输出每格概率质量、coverage、误差与zeroObservedInterval；浮点质量归一化消除约1e−15数值越1。这里“精确”指全部可能cluster事件数枚举，仍是双精度数值，不是符号有理数证明。60格通过不能证明任意真实依赖结构，真正理论保证仍需上述合法条件。

`results/analysis-v04-v2-simulation-attempt01.json`保留初步10模型输出；后补风险contrast模型、primary nominal error标签修正及浮点质量归一化后完整重跑到`results/analysis-v04-v2-simulation-final.json`。不因coverage不好换seed，不触碰自然数据。

复跑：

```powershell
node --test tests/analysis-v04-v2.test.mjs
node --input-type=module -e "import {runSimulationControls} from './src/analysis-v04-v2.mjs'; console.log(JSON.stringify(runSimulationControls(),null,2));"
```

真实数据执行仅独立owner调用API；本任务只运行合成控制，没有公钥注册/真实assumption签收、任何真实source生成或结果分析。

## 8. 独立复审清单

必须审查：(1)代码界与上述证明一致，随机/固定分母不混；(2)observedA0 vs populationE[A]>0正好覆盖审计反例；(3)主预算三量固定；(4)真实cluster归属、来源池、执行独立性及l_c/L上界签收，不因C<96自动拒绝也不伪造独立性；(5)外部trust anchor不由作者注册、双签真实且pre-outcome时间证据有效；(6)R/G原始资格和raw normalizer绑定；(7)所有失败/未调用/成本unknown；(8)11模型600重复与60格全量证据；(9)v1完整保留hash、不重写历史；(10)所有其它F1 gates独立满足后才能签formal freeze。

本revision修复实际统计门槛，不能以“candidate”标签绕过任何未通过的科学或执行条件。有限样本界通常很宽，这是诚实信息限制，不授权补样、删难题、改N或结果后换目标。

## 9. 本次实际控制结果与限制

最终收据`results/analysis-v04-v2-simulation-final.json`，11模型各600次；bootstrap B9999，seed1374772973。独立簇有限样本bound在imbalanced模型599/600覆盖（.998333），其它有定义的所测单量均600/600；三主量joint600/600。这些高coverage来自保守宽界，**不是接近精确95%的效率保证**，更不是现实独立性验证。

关键反例：sparseAcceptanceAllWrong出现**463/600观察A0**，observed risk未定义；600份population界全为[0,1]，包含真实risk1，报告率与coverage均1。这个结果表达“无风险信息”，不能称系统安全。该模型bootstrap只给463份zero-denominator及137份small-effective-denominator，全部无CI。

风险contrast模型真差.2，有59份FULL观察A0；有限界600/600覆盖，平均宽约**1.796738**，不能称精密方法排序。对应bootstrap全部因零/小接受分母不报。censored另对W+UA=.45验证，未把unknown当已知正确或确认错误。

三主模型单项nominal=.983333…，实际三量均600/600，joint600/600；pointwise与family预算明确分栏。dual端点本次有限界joint600/600只是模型表现，不给它额外的joint .95声明。

bootstrap欠覆盖仍如实保留：positiveDependence约.938333、censored约.936667；rareZeroEvents有474/600退化，剩余126份CI条件覆盖1，但整体covered fraction仅.21。null配对模型有一份退化，conditional coverage约.946578，overall covered fraction=.945。这些不是靠增B能够抹掉的结构限制。

60格独立cluster事件数穷举全部通过.95门槛，最小约**.9999406902**；其高保守性和适用模型边界均见记录。source-family/execution independence不从这60格推断。MC SE为有限重复的plug-in数值，全部覆盖时0并不证明真实coverage无不确定性。

新单测26/26；初步23项也通过。测试临时approval key不写盘，不是未来独立签收；真正assumption证据缺失时，主界/pointwise仍全null。最终执行收据绑定本revision源码与测试/计划/hash，v1九个已manifest工件另逐项验证未变。
