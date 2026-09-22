# 独立统计审计 v2：有限样本方法/实现有条件通过，真实推断适用性仍待外部证据

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

## 0. 精确判定

**PASS—METHOD/IMPLEMENTATION UNDER STATED ASSUMPTIONS；NOT STUDY-INFERENCE AUTHORIZATION / NOT F1-FORMAL APPROVAL。**

相对v1，v2已经实质解决主区间依赖未校准bootstrap、观测零分母导致人口CI选择性缺报、三主量多重性预算不明、96 brief与最高依赖cluster混同这四项统计方法阻断。对本次hash固定的实现，可以签收“条件于锁定brief集合、独立固定容量cluster执行机制下的有限样本主区间计算和软件fail-closed路径”。不需要再找seed或反复改模拟把每个经验coverage凑到.95。

**本审计没有批准真实source-family独立性、执行随机机制、R资格期望正性、外部信任锚身份/时间锁、raw分类正确性，亦不批准任何真实模型调用、pilot admission或formal执行。** 签名与hash认证对象，不把科学假设变成事实。无实际证据时，v2继续只报完整描述，人口区间null；这正是预期安全行为，不是统计实现gate必须无限等待新模拟的理由。

v1审计及其所有收据原件保留，不改判或倒签。新增v2审计独立控制及报告，未改作者文件。

## 1. 只读范围与独立验证

本次读取：
- `src/analysis-v04-v2.mjs`
- `tests/analysis-v04-v2.test.mjs`
- `plans/statistical-analysis-v2.md`
- `results/analysis-v04-v2-tests-final.tap`
- `results/analysis-v04-v2-simulation-final.json`
- `plans/v1.1/protocol-amendment-01.md`
- 自有v1 manifest（用于历史保全核验）。

未读产品实现、private-test/private-results/private-pilot内容、未来逐例、自然source或credential；未运行浏览器/网络/真实模型。授权公开统计模块之外仅用Node内建功能。作者26/26 TAP只是输入证据，不是本次数学签收依据。

独立新增：`tests/statistical-audit-v2-controls.mjs`；收据：`results/statistical-audit-v2-controls.json`。**15项控制通过**，独立固定seed为20260921，仅用于有界公式对照数据；无随机搜索、无更换seed、无挑选有利模拟。下述“精确”指全状态双精度概率枚举，不是符号有理数证明；普遍coverage来自第2节定理而非模拟。

### 1.1 真正独立的数学/实现控制

1. **1200组公式对照**：K∈{1,4,24,96}，alpha∈{.05,.05/3,.001}，不等容量，非负ratio、固定P比例、signed共享分母差、固定P差、不同分母risk差。参考实现用独立分支表达，signed随机分母参考按符号选极值，而非复制作者四角写法。
2. **聚类/尺度控制**：合并cluster后Σl²增大，不能改善固定P精度；计数与容量同比例放大不改变区间；交换配对方法只改变差的符号。单独检验整个signed矩形为负时的端点方向。
3. **6个非iid、不等容量模型精确卷积**：K∈{12,24,48}、l_c循环{1,2,3}，接受概率及错误概率跨cluster不同，另含q=.005稀疏接受。完整枚举总D、N；最小coverage约 **.999999999824**。保留D=0分支；这是新的非同分布控制，不是只重跑作者iid Bernoulli tests。
4. **三主量联合精确枚举**：同cluster四状态共同决定资格、FULL成功和SCOPE_OFF成功；不等l且两类cluster分布不同。K12：2925状态、joint coverage **.999511718750**；K24：20825状态、joint coverage **.998895764351**。三量相关，仍使用固定alpha=.05/3；不是把三个边际经验覆盖率相乘。
5. **独立重算作者60格exact-grid**：使用从众数双向递推并归一化的二项质量，避免v1审计曾出现的起点下溢。每格coverage与最终收据在2e−12误差内一致。二项单位是合成独立cluster，不是研究task。
6. **独立重建10个概率机制模型×600份数据的有限界部分**：独立PRNG/label派生、DGP分支和参考区间公式，不调用作者`runSimulationControls`，逐项复现reported/covered/no-information/observedUndefined/width及joint。包含一个结构性总体分母为0、参数未定义的模型，不为它宣称coverage。没有重复运行作者B9999探索性bootstrap；该部分原收据不因此被本审计冒称全量重现。
7. **独立手造高层ledger**：1/2/3/1 brief四个依赖cluster、共享功能标签，不同R/G eligibility、拒绝、S/W/UA。同slot四方法共享资格和准备，自己重算P/E/Q/A/S/W/UA；与`analyze`一致，主alpha与实际容量逐项一致，成本unknown保持null。
8. **高层零E/A和缺假设**：观测S/E、W/A=null；在正期望分母目标域及有效synthetic approval下，主S/E与risk人口界[0,1]，不删样本；无证据时所有主/pointwise/探索interval均null；缺R:eligible签收时S/E主界null，primaryFamily不完整，不重新分配另两项alpha。
9. **签名拒绝路径与科学反例**：无外部锚、设计篡改、分析作者角色、同一公钥异格式、synthetic domain用于formal均拒绝。另构造密码学合法但只有synthetic占位引用的双签，证明verify=true并不读取或验证引用事实。96行共享一个Bernoulli(.4) latent时，主fixed-P界真实coverage **0**；科学独立性错误无法被双签修复。
10. **完整性**：含UA记录不移除接受分母；删除一条记录立刻audit-failed，observed和population都null，不进行有利插补。

## 2. 重新推导有限样本保证

### 2.1 条件目标、权重与真正的独立单位

给定事前锁定brief/config/task清单及最高依赖分区，cluster c包含b_c个brief，固定槽容量l_c=8b_c。重复生成/执行机制中的完整向量为V_c，其中包含全部方法/配置/任务/R/G结果。假设V_1,…,V_C相互独立；允许每个V_c内部任意相关，也允许不同cluster不同分布。

目标为 `θ = Σ E(N_c | locked design) / Σ E(D_c | locked design)`，要求ΣE(D_c)>0。它不是实测随机分母条件下的均值、不是E(N_c/D_c)，也不是全部React需求总体的代表性均值。

以期望总数加权是正确的机制机会加权；不等family不能改成family等权均值。v2描述性equal-brief S/E仍另列；它和主ratio-of-expected-totals不同，故不拥有主三量的同时保证。该缩限已在v2计划明确，不再把equal-brief补充默默写成主参数。

**冻结这组brief使l_c固定**，因而使用逐cluster实际容量比一个共同粗L更有效。这里的实际容量来自结果前清单，不是接受/成功/可观测数量的事后最大值。全局L=8×maxBriefsPerCluster仍须与锁定清单一致；在本条件于固定清单的目标下，未来重复的是执行机制，不是重新抽一个随机大小家族。

### 2.2 有界cluster-sum

令 `V=Σ l_c²`。独立X_c∈[0,l_c]时，Hoeffding给

`P(|Σ(X_c−E X_c)| > r) ≤ 2 exp(−2r²/V)`。

令失败预算δ，`r(δ)=sqrt(V log(2/δ)/2)`。这不要求tasks独立、同分布或正态，也不需要“至少20簇才有定理”。C=1也可计算，通常只是无信息。

### 2.3 固定P和随机分母

- S/P：D=P_total=Σl_c为已知固定正值。令alpha为该estimand的预算，区间 `[(s−r(alpha))/P, (s+r(alpha))/P] ∩ [0,1]`。v2只在高层d=P时用fixedDenominator=true，未把观测E/A假装已知固定总体分母。
- 随机E/A/Q：对分子sum和分母sum各给alpha/2，半径 `r=sqrt(V log(4/alpha)/2)`。联合事件概率≥1−alpha，无需分子分母相互独立。若d>r，取 `[max(0,n−r)/(d+r), min(1,(n+r)/(d−r))]`；否则[0,1]。
- v2没有把分母上端截为Σl_c，仍是合法但更宽的矩形；d≤r时直接返回[0,1]可能放弃可得正下界，也只是保守，不是欠覆盖。
- 样本d=0时点量null，人口[0,1]。结构性ΣE(D)=0时不存在ratio参数；v2风险输出的positive-expected-denominator parameterDomain不能被解释成已经证明风险可定义。主S/E额外要求独立签收正期望资格分母，合理。

### 2.4 配对差与符号

共享分母时，Z_c=N1_c−N0_c∈[−l_c,l_c]，范围长度为2l_c。

- 固定P：`r_Z=sqrt(2 V log(2/alpha))`，对z/P加减r_Z/P，截[-1,1]。
- 随机共享分母：Z与D各分alpha/2，`r_Z=sqrt(2 V log(4/alpha))`、`r_D=sqrt(V log(4/alpha)/2)`。若d≤r_D则[-1,1]；否则对 `(z±r_Z)/(d±r_D)` 的四角求极值再截范围。负分子时分母方向反转，v2已正确处理。
- 四方法E和Q由共同资格与准备决定，故S/E、A/E、Q/E、rejection/Q等对比采用shared-denominator分支有依据；接受A则方法可不同，走不同分母分支。
- 不同A的risk差：两个ratio各给alpha/2，各ratio内部两个sum再各给alpha/4，半径含log(8/alpha)。差界 `[lo1−hi0, hi1−lo0]∩[−1,1]`。不要求两方法独立，不把各自接受集合差当因果风险差。
- 配置的E可能不同，四均值界合法；单配置容量l_c/2正确。S/P配置差也使用这个更保守的通用界，是效率损失，不是有效性错误。

### 2.5 三主量与多重性

主family固定为：R FULL S/P、R FULL S/E、R FULL−SCOPE_OFF S/P。每项alpha=.05/3，单项coverage至少.983333…；union bound使三个有定义参数同时覆盖至少.95，不要求三者独立。主S/E因缺positivity签收不输出时，family complete=false且nominalFamilyCoverage=null；另两项仍用原alpha，不回收预算。

G、risk、配置及其它比较仍是pointwise .05敏感性。它们既不属于这三量family，也不能按“主family已95%”获得同时保护；不得从这些表挑新主结论。W与W+UA两个人口界未标成共同95%的总体识别集合，正确；若日后需要那种联合外包须另预分配alpha，不根据真实结果再改。

## 3. 精度及不可被签名掩盖的假设

同为96 brief、768计划槽，主S/P未截断半宽为 `sqrt(log(120)/(2 C_eff))`，其中`C_eff=(Σl_c)²/Σl_c²`仅是**容量集中度指标**，不是观测ICC估出的有效样本量：

| 锁定分区 | C | C_eff | 主S/P半宽 | 主S/P差半宽 |
|---|---:|---:|---:|---:|
| 96 singleton brief | 96 | 96 | .157907735 | .315815470 |
| 48簇、每簇2 brief | 48 | 48 | .223315261 | .446630521 |
| 一个48-brief大簇+48 singleton | 49 | 3.918367 | .781603412 | 1.563206825 |

最后一行差界经[-1,1]截断，通常完全无信息。宽界是本设计诚实的信息限制，不得因此换seed、扩N、删大簇、将簇拆成唯一ID或切回bootstrap主界。原±.10是不同近似规划量，不能当本保守三量同时界的精度保证。

协议amendment第B节已明确功能family不等于统计依赖cluster：C<96不是自动延期理由；但96底稿派生/标签不证明满足独立需求来源要求。v2允许96brief和较少真实cluster，符合澄清；最终是否存在合格来源池、最高分区是否有效依旧是外部科学证据gate。

尤其要审核：共享生成上下文、动态上游服务状态、统一有随机性的模型/环境latent、时间漂移、联动重试/筛选、共用执行状态是否让各cluster随机向量相关。相同固定算法或模型名称本身不证明相关，也不证明独立；必须说明条件化哪些已固定环境、剩下的随机机制是什么。若跨簇残余依赖无法排除，必须提升簇或blocked，不能靠crypto approval免除。

## 4. 签名/冻结接口：软件职责与真实门槛

v2签名设计的已验证范围：
- detached Ed25519签名绑定canonical payload；设计fingerprint含dataset/kind、design、evaluation binding和collectionStartedAt；payload绑定K/L/clusterLayout、target/weight/independenceModel、主量列表与alpha。
- 外部context而非ledger注入两把不同公钥，DER identity防同钥异格式；两角色/authorityId不能相同，已知作者ID不得批准。
- synthetic-control domain不授权formal；无锚/缺签/篡改/错误角色和字段拒绝；日期数值需lockedAt早于collectionStartedAt。
- 未通过gate仍可描述完整ledger，但不给population/探索interval。

**尚未且不能由本代码证明的事实：**
1. 两个authorityId/两把钥匙由真正独立人或owner控制；一个人可以生成两把不同钥匙，不能靠distinct key定义独立审阅。
2. `analysisAuthorIds`的完整性、真实信任锚注册与执行环境不可由作者注入。它是外部executor责任，不是ledger内可自证属性。
3. evidenceRefs的hash是否指向真实且足够的来源/机制证据。统计器不加载引用文件，synthetic占位refs也能经有效双签通过——测试此事不是研究授权。
4. `lockedAt < collectionStartedAt`字符串日期排序是否对应真实append-only历史。代码没有可信时间戳/日志；倒签日期不能凭密码学被发现。
5. `analysisVersion`不代替实际源码SHA256；执行方还须用独立freeze manifest绑定本审计hash、runtime、normalizer、schema、生成/采样规则和真实trust anchors。独立签署的科学内容和运行字节都要可追溯。

因此`independent-evidence-verified-bounded-inference`是机器完成认证检查的状态，不能在论文里翻译为“软件验证了独立性真相”。真实外部审核未完，study inference gate仍blocked。本次生成的临时密钥只存在审计进程内，未写盘、未注册真实anchor，也未签任何研究假设。

## 5. Unknown、missing、风险与成本

- S只表冻结有限检查通过，不是一般程序正确性。`[W/A,(W+UA)/A]`是观测有限检查分类的识别区间，不是CI，不涵盖未检测缺陷或oracle false negative。W与UA不能重复加；UA不删除、不视正确，不附加MAR假设。
- 完整未执行记录保留于P和相关失败分区；缺slot/duplicate/unexpected则不发布observed/population。该完整性gate不等于证明未来raw来源真实。
- 正期望接受但观察A=0的反例已正确修复；作者sparse模型463/600份A0、600/600份人口界[0,1]。这里的coverage=1代表无风险信息，不代表风险低。
- FULL与SCOPE_OFF同候选hash形状/一致性可核对，actual guard-before身份、接受发生在私有评价前的时间序、raw→normalized布尔语义仍须独立重建。签名不替代raw审核。
- v2 equal-brief、scope preventedW/foregoneS/unknown是描述性补充；本审计没有把其无区间状态升级成确认性效应。若论文要对应总体推断，必须另在source前固定方法/预算；不能事后借三主量的保证。
- 未知成本仍null；method共享event不能简单相加，root inclusive账含义须账本owner另审。不从零实验模型调用推断工程成本0，也不签成本优势。

## 6. Monte Carlo：诊断不是定理，也不是必须每次经验≥.95

本次对作者finite-only结果独立重建：不等容量模型599/600覆盖，其它有定义的所测边际600/600；三主量joint600/600。此结果与保守定理相容，但不能证明独立性、代表性或得到窄区间的能力。

600次全覆盖的plug-in MCSE=0并不表示真实coverage无不确定性；在同一模型独立重复假设下，单侧95% exact lower是`.05^(1/600)=.995019557`。599/600也不应因为不是600/600而判定理论失效。更不能把对nominal≥.95的数学保证解释成每个有限模拟的观测coverage都必须≥.95。

v2探索bootstrap仍保留结构欠覆盖与条件筛选问题：正依赖563/600=.938333、censored562/600=.936667；rare有474/600无CI、126/600有CI全部覆盖，整体covered fraction仅.21；null有1份退化，整体.945。主界通过不等于这些探索区间被“校准成95%”。v2变更label stream有版本记录，不据高低结果换seed；本审计不要求继续跑新seed。

**后续控制治理（不倒签为v2既有预注册）：**若冻结后要新的600次诊断，先固定模型/目标总数H、seed、一次run预算，以nominal p0（主单项59/60、主joint.95、pointwise.95分别）计算Binomial(600,p0)下尾，并用η=.01、各项η/H的总误报警预算。只对定义明确且全部dataset都返回主界的目标统计；[0,1]属于报告，不得删除。过低经验值触发调查，保守偏高/宽度大如实披露而非调参。v1报告中央99% [555,583]只是p0=.95的示例，不适用于所有主单项，也不是本次事后pass线。修复明确实现bug可新编号保留旧收据；不能无限试seed、CI或DGP直到通过。

当前method/implementation签收依据是独立推导、软件连接及反例控制，而非选择某个MC容忍阈值来追认通过。无需为完成gate增跑随机模拟。

## 7. Gate矩阵与移交建议

| Gate | 本次判定 | 可签收范围 / 未完成责任 |
|---|---|---|
| 有界容量主CI推导与计算 | **PASS under assumptions** | 独立非iid簇、固定容量、正确参数域；计算和高层调用一致 |
| 三主量Bonferroni及零分母处理 | **PASS** | .05/3固定；缺positivity无完整family；不选报A>0 |
| 不等family权重/配置/paired/分母类型 | **PASS tested scope** | 机会加权目标；same/different denominator正确；描述性equal-brief另列 |
| 认证/设计绑定与无证据fail-closed | **PASS software scope** | Ed25519双签、外部锚、设计字段拒绝路径；不证明独立人/事实/时间 |
| Monte Carlo/精确控制收据 | **PASS finite-bound verification** | 10×600有限部分独立复现，60格重算、新非iid及joint精确控制；未重跑B9999探索全量 |
| 协议96brief/family澄清兼容 | **PASS interpretation** | 真C/l_c决定区间；C<96非自动否决；源池不足仍可能defer |
| 真实来源池/lineage/cluster execution independence | **OPEN/BLOCKED pending evidence** | owner+independent auditor，不能从测试和签名数量推出 |
| 正总体R资格分母、外部身份与pre-outcome锁 | **OPEN/BLOCKED pending evidence** | 缺失时相应主量不能声明就绪 |
| 真实raw分母、候选、接受锁和normalizer语义 | **NOT AUDITED** | 由独立raw证据重建；统计代码不能自证 |
| 成本来源/归属/真实unknown | **NOT AUDITED beyond summaries** | 不发明人时、tokens、金额，也不宣称免费 |
| pilot-admission / F1总冻结 / formal采集 | **NOT AUTHORIZED** | 各gate独立满足，amendment的条件授权不等于本审计放行 |

建议父协调把本结果录为 **统计方法及实现审计通过（条件应用）**，并将真实assumption签收与完整F1/admission分别列为未闭合，不必把方法实现继续降为“只待更多模拟”的无限任务。若任何源码/主量/容量规则/执行机制实质改变，应新增revision和针对性复核，不把本hash的签收外推到未来文件。

## 8. 新工件、保全与成本

- `plans/statistical-audit-v2.md`：本审计报告。
- `tests/statistical-audit-v2-controls.mjs`：独立参考公式、精确卷积、模拟有限部分重建、高层ledger和签名反例。
- `results/statistical-audit-v2-controls.json`：15项控制、六份输入hash、精确与重建结果、UTC与单进程wall。
- `results/statistical-audit-v2-manifest.json`：新工件SHA256、输入未漂移、v1审计原件保全核验；不自指hash。

实测本次Node控制进程wall约 **.1491997s**，不是整个审阅elapsed、CPU或人工工时。activeHumanSeconds、作者模型tokens、金额unknown/null；审计实验模型调用0、浏览器0。本次没有改任何作者文件，也没有覆盖v1工件。脚本收据采用create-new（wx），未来复跑需新收据名，不覆盖原结果。