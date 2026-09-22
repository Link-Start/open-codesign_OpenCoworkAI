# 独立统计审计 v1：有条件数学界可成立，当前 F1-STATS 不予无修订签收

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

审计对象：`statistical-analysis-v1`，production bootstrap B=9999、base seed=67379238，simulation seed=1374772973、8模型×600。结论日期以审计收据 UTC 为准。本报告只评审公开统计实现/测试/模拟/协议；不是产品效果、独立抽样可行性或真实原始证据审计。

## 0. 判定与范围

**结论：REQUEST CHANGES；F1-STATS 当前不能闭合为正式总体推断已就绪。** 可闭合的是指定公开记录的计数/权重/配对算法的有限实现核查、已有确定性收据的一致性、Hoeffding 公式在明确假设下的数学推导；不是所有未来输入或 95% bootstrap coverage 的认证。推荐结果前新 revision：主区间使用预先冻结的有限样本界，bootstrap 仅探索性；在抽样假设尚未成立时只允许固定语料描述和明确的反事实敏感性，不给总体 coverage 承诺。

本次未读取产品实现、private-test/private-results/private-pilot/private-governance 内容、未来逐例；未执行真实模型、浏览器、网络、实验采集。初次只列出 root 目录名以及 plans/public-contracts/freeze/results 名称；不存在 root `sampling-framework/` 的目录查找报错后，改读明确公开的 `public-contracts/sampling-framework.md`。未探查私有目录。

只读输入：
- `plans/statistical-analysis-v1.md`
- `src/analysis-v04.mjs`
- `tests/analysis-v04.test.mjs`
- `results/analysis-v04-simulation-v1-productionB.json`
- `results/analysis-v04-final-verification-v1.json`
- `public-contracts/sampling-framework.md`
- `plans/protocol-v04.md`

以上输入 SHA256 在 `results/statistical-audit-v1-controls-r2.json` 固定；源码、测试、production 模拟三个 hash 均与作者 final-verification 一致。没有重跑作者全量 600×8 模拟来冒充独立数学验证，也没有把 28 tests 当统计结论。

## 1. 独立审计控制与可复算结果

最终有效控制：`tests/statistical-audit-v1-controls-r2.mjs`，收据 `results/statistical-audit-v1-controls-r2.json`，**12 checks passed**。脚本仅 import 指定统计模块和 Node 内建库；自己构造 ledger，不调用作者 syntheticLedger 生成器。

### 1.1 独立于 28 tests 的核对

1. 6252 个 (K,A,W) 整数状态核对 candidate Hoeffding 输出与独立公式相等。
2. K∈{1,8,20,48,96}、接受概率 q∈{.005,.05,.2,1}、条件错误率 r∈{0,.2,1} 共 **60 个预先固定三状态独立 cluster 模型**，精确枚举 A 和 W，非随机重复。人口风险有定义时，包括样本 A=0 返回 [0,1] 的完整区间程序，网格最小覆盖 **.99876864**。网格是有限模型数值核对，普遍保证来自第4节证明，不来自选中网格。
3. 独立展开 slot 的重采样实现对 24 个不等大小 cluster，**同一抽样索引同步取两方法**，B=9999、seed=67379238，逐位重现配对区间 `[-.1325301204819277, .2696797752808987]`、点差 .08333333333333337。相同配对数据的差为0且原bootstrap不产生虚假的精确风险保证。
4. 独立 ledger 的 1-brief 小家族全错、6-brief 大家族全成功：ratio S/P 与 equal-brief 都是 6/7，不是 family等权1/2；最高 cluster 数是2，不是7。
5. 独立 UA 变更保留 A=56、W=7、UA=1，观测识别区间 [7/56,8/56]；删除一个记录即 audit-failed/endpoints=null，未选择性删分母。空成本 inputTokens.total=null。
6. 完全跨cluster共享 Bernoulli(.2) latent 的96个标签反例：当前 nominal Hoeffding interval 的真实覆盖**为0**。这不反驳独立性定理；直接反驳“96不同ID足以证明独立”。

### 1.2 不是调 seed 的独立 bootstrap 数学控制

对于 K=48、每个cluster内8个完全一致且全部接受的任务，独立 cluster 的 W 概率为 p。给定观测错误cluster数 k，理想无限次 percentile bootstrap 的错误数分布就是 Binomial(48,k/48)。按该分布 .025/.975 分位数精确求区间，再按真实 Binomial(48,p) 全枚举 k；k=0或48按作者退化政策不报CI：

| p | 理想B→∞ unconditional coverage | 有CI条件下 coverage | 零事件概率 |
|---|---:|---:|---:|
| .2 | .916843691 | .916864137 | .000022301 |
| .15 | .933779182 | .934161593 | .000409363 |
| .005 | .213743536 | .999522945 | .786154448 |
| .7 | .958212939 | .958212974 | 约7.98e-26 |

这里的二项是**独立合成 cluster 数**，绝不是拿768个研究tasks做二项CI。这是理想无限B离散分位程序，不声称等于 B9999有限 Monte Carlo加线性插值的精确 coverage；后者另有展开重采样实现核对。结果足以说明增加B只能降低计算随机误差，不能把percentile方法修成普遍95%保证；罕见事件的条件coverage几乎1尤其误导。

### 1.3 审计自己的错误保留

首版控制 `tests/statistical-audit-v1-controls.mjs` / `results/statistical-audit-v1-controls.json` 从 P(X=0) 起递推 Binomial(600,.95)，发生浮点下溢，给出错误的 MC prediction band [600,600]；当轮脚本检查显示 passed 并不能证明审计无误。**该首轮收据不签收、被 r2 supersede，但原件保留。** r2 仅改为从众数向两侧递推并归一化，新增概率和、均值、p↔1-p反射控制；固定模型/参数/seed未变，也未删除不利结果。修正的99%预测范围为[555,583]。其余精确模型结果在数值精度内一致。

## 2. Estimands 与权重：主要正确，但必须限定总体

### 2.1 点量

- P是计划槽，S/P是完整计划策略的有限检查成功覆盖；E保留 preparation failure、proposal notExecuted、methodError等，S/E不是“成功执行者”的成功率。资格分区、共享E与准备、A=S+W+UA的设计合理。
- ΣS/ΣE、ΣW/ΣA分别是机会加权ratio-of-sums；非同分布独立cluster时总体目标应明确为 ΣE(N_c)/ΣE(D_c)，而不是条件于观测分母的率，更不是 E(N_c/D_c)。
- equal-brief S/E 是 eligible brief 的比例等权目标。跨family随机大小时，由每family的 eligible-brief比例和及eligible-brief个数取ratio，目标是抽样机制诱导、按brief质量加权的分布；不是先求每family均值再等family平均。作者当前实现正确保留这一差别。
- paired equal-brief contrast 在相同eligible brief先差后平均；ratio-of-sums contrast则是两个总体比率之差。由于两方法共享E，前者仍与总体E加权差一般不同，不能互换。
- W/A两方法一般接受集合不同，差是两套策略各自选择集合上的操作风险之差，**不是共同人群因果风险差**。FULL−PROVENANCE_OFF候选可改变，也不是same-candidate scope效果。
- 两config固定、task嵌套、R/G共享patch的处理正确；R、G不能合并分母或独立性计数。

### 2.2 抽样与外推的实质缺口

当前公开 sampling-framework 仍为 draft-not-frozen。仅“先建候选框、seed抽取”并没有提供所有目标总体成员的纳入概率、抽样设计、独立来源证据。至少须冻结：目标是固定有限框、框抽取重复机制还是超总体；均匀/分层/不等概率/无放回设计；最高依赖cluster和连通规则；生成共享上下文、时间漂移、模板祖先如何处理；纳入/排除与cluster支持上界的事前保证。

- 若独立cluster按同一机制独立取得，unweighted family resampling针对该机制合理；若不等概率选择family后声称原总体均值，需预定设计权重并重新推导有界支持。不能临时拿家族大小/可观测任务数当纳入概率。
- 独立但非同分布的固定cluster，Hoeffding仍针对平均期望成立；普通iid cluster bootstrap却没有普遍适用性保证。分层/有限框无放回的设计需要相应抽样定理，不能把“无放回也有时候更保守”当未经证明的独立性。
- 固定目的性语料可完整描述其实现结果；不可因为通过independence.status布尔或给每brief唯一ID就拥有超总体95%覆盖。若只有模型条件假设，输出须为assumption-conditional sensitivity，不是已验证主总体CI。
- 本次所读v1合同与实现要求96 brief且96个verified highest clusters，因此该候选的fail-closed是按自身版本合同执行；这不是数学定理要求96个不同功能类型。需求功能相似的functional family、来源克隆/模板派生关系、真正最高依赖cluster必须分开。功能family少于96本身不是拒绝设计的理由；如果新的结果前公开amendment允许96 brief属于更少最高独立clusters，应如实用真正C及事前L分析，不拿96计算精度，不删familyId或硬改为唯一ID。本次未读取该新amendment，不能替它预签；其目标与独立来源可行性需协议owner和统计v2共同冻结。

**因此：没有适用于所声明estimand的足够随机机制与独立证据时，正式总体推断gate只能defer；固定语料描述可完成，但必须正式变更研究范围而非悄悄把描述性报告称原F1已通过。** 非概率选择brief不禁止一切有限样本推断：若结果前锁定这组brief，并证实最高cluster间随机生成/执行机制独立，则可对“这组固定brief在同一预定重复执行机制下的平均期望/期望之比”应用Hoeffding，而不宣称代表需求总体。需明确随机性来自哪里、对何种模型/环境条件化、为何不存在共享未条件化latent；独立性不是由方法调用次数或ID推得。若固定语料及执行全确定，仅报告实现值，无需给其添加假想抽样误差。

## 3. Dependent / censored / missing / 零风险

- cluster内任意相关可由整簇重采样与有限界容纳；跨最高cluster仍有依赖则两类方法均无保证。多个输出使用不同PRNG stream不使其独立；同一contrast内部共享索引是必须的，当前已实现。
- 完整slot未执行是可记录的策略结果；缺记录是完整性失败。现有 missing synthetic 控制是结构检测，不是对MNAR统计推断的验证。未来不完整ledger不应发布率/CI；若协议要中断后的描述，须单独冻结partial-run方案，不能补写成功或默默丢行。
- confirmed W与UA的优先关系正确；W伴随其它unknown不再把同一接受项累加UA。
- `[W/A,(W+UA)/A]` 是观测的有限检查结果识别区间，不是confidence interval。它要求S/W分类相对冻结检查是可信的；不能涵盖S中的oracle false-negative或未检查的任意真实缺陷。不得写“全部一般正确性风险已partial identified”。
- 无MAR假设时不能从UA删除/插补恢复真实错率；更保守地报告 confirmed-risk 与 possible-risk 各自目标。若要对整个总体识别集合给95%外包，两个端点须用联合分配alpha的界，而不是将两个各95% CI随意拼成95%集合。
- W=0只说明未观察到确认错误。K96、L8、所有cluster A=8，Hoeffding给 `[0,.177957605]`；它很宽但诚实，不能依据零事件把upper改成0。
- **重要revision项：实测A=0并不意味着总体ΣE(A_c)=0。** 若q=.005、K48、且W=A，总体W/A目标=1，但A总=0概率`.995^48=.786154448`；现有函数A=0直接null使完整程序覆盖最多`.213845552`。观测率继续null是正确的，人口风险CI若要有无条件覆盖则在这个样本分支应返回 `[0,1]` 并标no-information/observed-point-null。若有结构性证明总体分母确为0，才标target undefined；单次零分母不能证明该事实。

## 4. ratioHoeffding / clusterRatioSensitivity 的独立推导

设固定K≥1，cluster向量独立但无需同分布，0≤N_c≤D_c≤L，L是生成/选择/纳入前固定有效上界，不是观测max。令 X_c=N_c/L、Y_c=D_c/L，x=平均X、y=平均Y，μx=平均E(X)、μy=平均E(Y)，目标 θ=μx/μy（定义域μy>0）。

对任意独立有界[0,1]变量，双侧Hoeffding给

`P(|x-μx|>ε) ≤ 2 exp(-2K ε²)`，Y同理。

取 `ε=sqrt(log(4/α)/(2K))`，每个失败概率≤α/2，无需X与Y独立；union bound得到两个均值同时在截断区间的概率≥1−α。因 θ∈[0,1] 且分子非负，在该事件上

```
lo = max(0,x-ε) / min(1,y+ε)
hi = min(1,(x+ε)/(y-ε))  若 y>ε
     1                    否则
```

所以公式正确、保守、有限样本、pointwise；`log(4/α)`是两个双侧界而非错误的task二项近似。要求0<α<1。K=0无可适用抽样定理；样本D总=0但μy>0时公式自然为[0,1]，不应在宣称完整覆盖的程序中删掉。

### 4.1 L、K及停止条件

- 每method两config×四tasks，L=8×事前最多纳入brief数。变量支持必须在所有允许重复抽样结果上成立。观察到family size≤L/8只是必要条件，不足以证明未来支持上界。
- 上界应来自设计机制/预定纳入cap，不能观察大/小家族或结果后选择最有利L。纳入cap若改变brief选择分布，也必须改变estimand说明；不是统计器自行截断。
- 固定K、非结果选择、固定停止规则；若按eligible量/接受量继续招募或随时挑终止点，当前固定样本Hoeffding不是time-uniform confidence sequence。
- K96时ε=.1510730134，K48时ε=.2136495045；不能把K换成384或768个tasks制造窄界。
- 本函数导出的alpha未校验：alpha<0/NaN可返回含NaN区间。固定生产.05未受影响，但新revision必须校验finite 0<alpha<1、K/有界数值、L与可安全计算的乘积。

## 5. 建议 v2 主CI方案与最小接口（必须在真实数据前冻结）

这是一套保守、易审计而非最优宽度的方案，不保证能获得有用的低风险/优效结论。不能因为未来区间过宽改用更漂亮的方法。

### 5.1 主estimand至少全覆盖

1. **S/P**：formal确为K96、每cluster一个brief且P=8时，S_c/8∈[0,1]。直接双侧Hoeffding半宽 `sqrt(log(2/α)/(2K))`，95%半宽 .138610656。确定分母无需再给分母分配误差；不平衡或随机cluster总P则用第4节ratio界。
2. **FULL−SCOPE_OFF S/P**：同brief差 `(S_full−S_off)/8 ∈[-1,1]`，直接Hoeffding半宽 `sqrt(2 log(2/α)/K)`，95%半宽 .277221311，截[-1,1]。保留配对定义；无需方法独立。
3. **S/E及其它非负ratio**：第4节，覆盖Q/E、A/E、W/A、UA/A、rejection/Q和scope decomposition在P/E上的率。计数N≤D的条件必须逐项核对。分母样本0时观测率null与人口CI信息状态分开。
4. **同分母ratio差**：可取 `Z_c=(N1_c−N0_c+D_c)/(2L)`、`Y_c=D_c/L`。0≤Z≤Y≤1，目标ρ=E(Z)/E(Y)，所需差δ=2ρ−1；先给ρ保守ratio CI再作线性变换。适用于共享E、共享P，避免错误地对两方法作独立推断。
5. **两不同分母ratio差**：各自用alpha/2的ratio界，union bound后差区间 `[lo1−hi0, hi1−lo0]` 截[-1,1]。只要求cluster向量独立，不要求两方法/配置独立。通常较宽，但有效。样本分母0应传播全范围而非删掉报告。
6. **equal-brief S/E**：每family N_c=Σ_{b:E_b>0}S_b/E_b，D_c=#eligible briefs，L为事前family brief上界（不是task-slot L）；第4节同样适用，保留D_c=0 family。配对差可使用第4项变换。equal-brief S/P与ratio S/P在当前平衡设计相同，但标签不混用。
7. **未知最坏情况**：W+UA可作N；若要整体population identified-set外包，对confirmed下端和possible上端分别分alpha/2，或另证共用分母的联合界。不能只把两个pointwise95端点拼合后标同时95。

这些是在固定estimand上的pointwise95%界。若想一张表所有方法/端点/contrast共同95%，须结果前冻结family与α_j、Σα_j≤.05；可用Bonferroni，不要求端点独立。若不授权joint claims，明确pointwise、不作多项挑选胜者/等效/非劣的确认性结论。bootstrap B9999和原seed可保留为探索分布，不再处于primary interval字段。

### 5.2 最小可审计输出字段

- `targetId`, `targetDefinition`, `populationMode`（fixed-corpus / specified-random-design / assumption-conditional），`weighting`、fixed sampling design/strata/inclusion evidence references；不要只有一个verified布尔。
- K、L及其事前冻结证据/版本、最高family划分证据、alpha、pointwise/simultaneous family及alpha分配、方法版本。
- `observedPoint`（分母0为null）、`populationInterval`、`targetDomain`（期望分母>0）、`informationStatus`、`assumptionsSatisfied`与failure理由；结构性分母0和观测分母0分开。
- 假设未验证/非概率外推时 `primaryPopulationInterval=null`、状态descriptive-only/defer；若保留数学敏感性，独立字段明确“若假设成立”的反事实条件，不能给自动汇总器误认主CI。
- bootstrap应独立为`exploratoryBootstrap`，保留reported/undefined/degenerate/seed/B，不用退化筛选后的coverage承诺完整方法表现。
- diagnostics继续保留全部cluster及A=0簇、计数closure、成本unknown与绑定；真实明细仍归private边界，公开只输出获授权去标识汇总。

## 6. Monte Carlo误差、容忍规则与禁止追gate

### 6.1 既有模拟不应机械要求每项经验coverage≥.95

独立重算已有600次结果的MC Wilson95区间（仅针对独立synthetic dataset，不用于研究tasks）：

| 端点 | covered/n | 经验coverage | MC95区间 |
|---|---:|---:|---|
| null配对 | 587/600 | .978333 | [.963286,.987295] |
| 正依赖 | 559/600 | .931667 | [.908609,.949232] |
| 不等family | 565/600 | .941667 | [.919953,.957761] |
| censored confirmed W | 562/600 | .936667 | [.914265,.953513] |
| dual R | 571/600 | .951667 | [.931447,.966139] |
| dual G | 568/600 | .946667 | [.925679,.961971] |
| rare（仅有CI者） | 113/114 | .991228 | [.951980,.998450] |

最后一项不是完整程序coverage，仍须报告113/600=.188333和486无CI。dual joint 543/600=.905没有同时95保证；即使两个真实pointwise都95，union bound也仅保证joint≥90%，与此表现不冲突。

假设真实coverage恰.95、600次独立dataset，Binomial(600,.95) 的中央99%预测计数范围为 **[555,583]（比例[.925,.971667]）**。因此559、565、562不是“只因低于.95就判实现失败”；587过高则体现离散保守性，不是安全失败。正依赖MC95区间略低于.95加上独立精确枚举构成实质欠覆盖证据，但不把一次MC检验当普遍定理。多项同时检查需预分配诊断误差预算，不能用若干未调整p值挑有利说法。

Hoeffding600/600不代表coverage恰1或无误差：若600次是独立同模型试验，单侧95% exact lower为 `.05^(1/600)=.995019557`；plug-in MCSE=0只因样本全成功。覆盖保证仍由数学假设与实现导出。

### 6.2 结果前冻结的后续治理建议

这是**在看过v1模拟之后提出的revision规则，不冒充v1预注册**：

- 主有限界gate采用定理、支持/独立/设计证据、全状态边界控制及反例测试，而不是“所有有限经验coverage≥.95”。既有v1收据不可通过改解释追认为旧gate通过。
- 若v2仍作600次模拟诊断，先冻结全部H个合法目标/模型（不把undefined truth模型混入coverage）、seed、B、一次run预算。对有定义总体参数要求完整主CI程序返回区间（可以[0,1]），不可条件筛选报CI者。
- MC数值容忍采用预先冻结单侧总误报预算η=.01：每项lower报警阈值是 Binomial(600,.95) 的η/H下尾（计算离散tail保证总报警概率≤.01）。保守界上覆盖偏高不失败，区间宽度如实报告。不报警只是未检出缺陷，**不是证明95%**。有限近似算法若拟允许覆盖低于.95，应另明确容忍δ与MC不确定性、并改标签；本审计不批准用δ事后救v1主95声明。
- 报警时先查实现/推导。只允许明确bug修复新编号，保留旧收据和失败原因；同冻结模型/seed复跑是修复验证，不是选优。禁止为过gate不断挑新seed、调DGP、修改小分母门槛或从多个CI里挑最好覆盖的版本。
- 未来真实数据不得用于选择estimand、L、cluster、方法、alpha、区间或主/次端点。假设无法证实、CI无信息或效果不明显均按冻结方案原样报告/defer，不扩N或换题。

## 7. Gate结论及整改验收清单

| Gate | 本次可否闭合 | 精确范围/待办 |
|---|---|---|
| 公共计数分区、缺/重key fail-closed、UA保留 | 可有限签收实现控制 | 不是未来raw正确性；绑定hash形状不验真值 |
| estimand区分、family保留、paired resampling | 可有限签收 | 独立展开B9999核对；不证明抽样代表性 |
| seed/B/作者三工件hash对应 | 可签收当前版本一致性 | 不把deterministic reproduction等同coverage |
| ratioHoeffding公式 | 数学有条件通过 | 固定K/事前L/独立cluster/μD>0/0<α<1；程序A=0与alpha需修订 |
| 主95%总体区间方案 | **不能闭合** | v2全主estimand有限界、零分母完整程序、正确alpha分配、bootstrap探索性 |
| population/family独立、fixedL、抽样总体/权重 | **不能闭合** | 协议与抽样owner在结果前补证；非概率/未验证仅描述或conditional sensitivity；formal defer |
| censored一般真实风险 | **不能闭合为一般正确性** | 限冻结检查，识别集合需联合界；normalizer/raw证据另审 |
| 真实accept锁、候选同一性、资格与raw真值 | **未审，不能闭合** | 独立raw重建、时间序与normalizer审核 |
| 成本unknown纪律 | 可签收统计层所检范围 | root inclusive与归属真伪另审；无成本优势结论 |
| F1总freeze / pilot / formal readiness | **不能闭合** | 本审计不授权真实运行；完整owner签收与新manifest必要 |

最小整改验证：新revision frozen协议+代码+tests+synthetic收据；population A=0仍输出无信息界而point=null；alpha异常拒绝；independence-unverified primary=null；所有主ratio/配对/配置/等brief主界可重算；同/异分母contrast的alpha分配与边界控制；完整population过程MC统计；作者与审计工件互相hash且不自指。新revision通过独立复核后只关闭其实际满足的统计实现gate，不预签抽样与整个F1。

## 8. 成本与交付

新增本报告及审计自身控制/收据，没有改作者文件。有效收据的UTC为 `2026-09-20T10:11:39.628Z` 至 `.700Z`，仅该Node控制进程测得wall约 .0716973s；不代表整个审稿elapsed、人工工时、CPU或总项目成本。首轮执行wall另保留在旧收据。active human、Harness作者模型attempts/tokens、金额均unknown/null；本审计实验模型API调用0、浏览器运行0，这不意味着作者工程免费。

有效工件：
- `plans/statistical-audit-v1.md`
- `tests/statistical-audit-v1-controls-r2.mjs`
- `results/statistical-audit-v1-controls-r2.json`

保留但不签收的首轮：`tests/statistical-audit-v1-controls.mjs`、`results/statistical-audit-v1-controls.json`，仅为审计错误可追溯。脚本输出采用create-new (`wx`)，重跑前须指定新的收据文件名，不覆盖历史。最终manifest为另一个新文件，不自指hash。