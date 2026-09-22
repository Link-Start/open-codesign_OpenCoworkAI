# v1.1 F1治理恢复与独立pilot-admission

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**source-free planning / sealed pilot specification candidate / admission NOT granted**。这是新版本文档，不覆盖F0-v1或原绑定证据。F0完成收据manifest SHA256为`23d01f821a7b374b2ce520478e657205c43bbc055dca7647bf451c030291fc80`，phase=F0-preparation-only，formalReadiness=false。

新用户授权取代F0当轮“本轮不做sample”的时间限定，允许继续补研究门槛与产品PR；父又明确转达条件授权：admission全过后16单次生成/最多64单次LLM，无retry/no-replacement，不含formal96。**它不取代pilot-admission，不构成即刻模型/自然source/browser执行放行**。范围与no-op/family仲裁见protocol-amendment-01.md。本owner仍不读产品/方法实现，只读公共接口与独立持有的pilot计划/oracle。

## 1. 固定设计不变

React单主线；R baseline-relative主endpoint、G整体健康敏感性；96独立brief×2配置×1source×4tasks；四methods FULL/SCOPE_OFF/PROVENANCE_OFF/LLM_ONESHOT，核心正式每method768计划。8pilot永不回收formal，不把任务/viewport/配置当独立brief。布局/状态/viewport/reload任务域不能按MVP窄支持裁掉。

自然采集archive不可变；禁止人工清理/修复/定制schema化迎合工具。方法自己的自动wrapper/ID/格式化是计成本的系统行为，no-edit round-trip与semantic collateral先实测；source-purity如设则独立且跨方法一致，不能只排外部工具。

## 2. 新目录与访问角色

- `plans/v1.1/`、`public-contracts/v1.1/`：新公开治理、抽象schema、签收与hash。父/产品/各接口owner可读。
- `private-pilot/v1.1/`：8个pilot public-facing requirements、任务、结构卡、private oracle、独立review及封存manifest。public-facing指将来可进入生成/编辑prompt的字段，不代表当前发送给方法作者。
- `private-governance/v1.1/access-events.jsonl`：独立owner和明确授权reviewer的scope/读取/写入/披露日志。日志是治理记录，不冒称OS级访问隔离或能检测所有外部读文件行为。
- `private-test/`与`private-results/`：future正式内容当前保持空；本次不生成96具体题。不将pilot塞进formal目录。

父兼产品作者，只接收抽象接口、总体review状态、计划计数/hash及admission blockers，不接收private expected、未来TEST或逐例结果。pilot日后若给DEV反馈，逐次记录recipient、时间、公开字段及seen=true；永久DEV，不回收formal。

## 3. 已准备的pilot计划与预源审查

8份新需求、32个预定任务已在任何source出现前形成。两配置槽C01/C02当前只是配置槽标识，不冒称网关配置/模型身份已冻结；未来需要用户授权的精确generation/edit配置、提示、输出窗口、超时/并发和usage记录。

pilot计划将产生16个source槽与256核心方法任务槽，每method64；R/G不重复生成。四任务保持content/attribute与两项layout/响应式变化，并在业务状态、viewport改变、reload后验证持久性。需求没有要求静态字面量、inline CSS、无map或特定组件组织。

独立reviewer仅获授权阅读pilot计划（随后另授独立oracle审查），未接触方法实现或source。初审发现公开查询对合法表征的错误假设及行为歧义；预源澄清修订保留原字节，不是依据方法结果救分。复核为conditional descriptive-pilot planning acceptance；剩余独立性/运行语义gate不隐藏。具体题和expected不发上游。

私有oracle规定target、有限replay/checkpoint、完整keys、G原始规范与R独立baseline/非恶化要求；**这是预源规范，不等于可执行adapter已就绪**。语义结果提取、原生form-control表征、复合geometry与条件交互必须先用独立可信控制签收。

## 4. admission必须同时成立的证据

### A. 公共接口与全部任务域

browser owner提供完整query/probe/action实现和新可信校准：form-control-label合法native roles、typed value/empty、gap/grid/order/documentOverflow、coherent capture、reload/setViewport、identity/cancellation/lifecycle。只支持text/value/rect不能放行。

输入方式必须适配公开允许的原生控件；不能将合法spinbutton偷判textbox缺失，也不能给native number强塞其不支持的任意字符串后把driver失败当业务坏。invalid-submit或disabled-control路径须预先定义、控制验证，不能见source后随意改oracle。

### B. 独立baseline/非恶化及oracle绑定

evaluation owner提供独立original capture；绑定source/replay/query catalog/viewport/observer/policy/checkpoint/entryABI，R需要可观测baseline且no-op预定义。原先成功不得退化，原先失败不得更差，明确no-change范围按baseline保持；missing→missing不是成功。G与R masks分别计算，接受补丁共享，不再提案。

私有semantic metric extraction只能使用公共可见标签/语义，不依赖source位置或private expected指导collector。确切parser/比较器、条件分支、必要keys及完整finite coverage须在source生成前最终封存，当前任何pending項继续阻断。

### C. 四方法与runner

methods owner提供四真实method adapters、相同public投影、同候选scope消融、真provenance-off、single-shot LLM协议、共同后检和先accept后private评价锁定。原始source每task独立，公共协议拒绝/主动拒绝/methodError分开。原始资格不以方法支持筛除。

完整P/E/Q/A和A=S+W+UA闭合，所有缺失/未执行/失败槽终结；四方法名称占位或产品UI可用不是runner完成。

### D. 统计、成本、安全及授权

统计owner签收pilot仅描述性、brief/family repeated-measure结构、未来96采样框和F1 statistical seed/区间实现路径。有效独立数未知保持null，不强行给pilot独立CI。成本active/token/money未知null；API每attempt与失败保留，无hidden retry。

独立执行身份、网络/凭据/资源/进程清理、源码不在Node执行、private期待不进模型/browser日志的sentinel控制完成；父确认完整可信链，并取得用户特定pilot执行授权。两者证据字段未填不能运行。

机器门槛见 `public-contracts/v1.1/pilot-admission-checklist.json`。每个pass必须具体receipt+hash+owner+时间+scope，不能只填true；blocked不会因本计划已hash而自动清除。

## 5. 放行后的固定pilot顺序（当前不执行）

1. 签收精确计划/oracle/public schema/配置/方法/observer/比较器hash；任何预源修订另version保留。
2. 16生成槽各一次，raw transport/源码/usage全部保存；截断/失败不repair、不重采、不补健康程序。
3. 先original G/R和独立baseline，再四method任务并集派发；每任务一次proposal，不向方法反馈private结果。
4. 共同after评价，跨状态/viewport/reload完整keyledger；不支持的测量不是程序failure，若基础设施坏则按停止规则中止保留，不删task。
5. 独立审计256槽、patch/hash/分母/成本；pilot反馈如给产品则标seen并永远DEV。
6. 输出pilot可行性、测量/适配缺口、family依赖与下一阶段决策，不给效果/成本优势排名。修runner须新revision完整可信控制，旧结果不改、不择优；source始终同一原始采集，不重生成救分。

## 6. F1与future TEST的顺序

F1不是本计划的manifest。先完成pilot及全部方法/observer域与统计实现冻结；之后独立test owner按已经冻结的来源/去重/家族规则形成96候选抽样与oracle，封存private bundle并审计。具体formal题只能在方法/observer/stats freeze后形成，当前没有形成。

若可信来源池不能支持96独立抽取单位，透明defer正式目标，不能捏出独立性、换皮扩样或把task乘数当N。任何future执行还须独立签收与特定授权。F0、pilot-plan seal、pilot-admission、F1正式freeze四个记录必须分开；前两个不等于后两个。
