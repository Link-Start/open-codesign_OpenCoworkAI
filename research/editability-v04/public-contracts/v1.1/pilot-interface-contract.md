# v1.1 pilot 抽象公共接口：不含具体题目或oracle

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

状态：**planning-only / admission-blocked**。本文件新增于F0之后，不修改F0-v1 snapshot或被绑定原位文件。新授权允许pilot治理/封存计划，不授权立即调用模型、采集自然source或运行browser。

## 1. 数据边界

- 生成器未来只接收该brief的public-facing requirements和固定runtime契约，不接收编辑任务、私有oracle、expected、baseline或审计意见。
- 编辑方法未来只接收原始source、该任务的公共request/scope、规定公共证据，不接收其它任务、生成器对话、private expected/baseline/检查结果。
- browser/collector只接收当前公开action/query/primitive probe，不能收到private comparator/expected/baseline、oracle键或整个测量记录。私有全key与public probeRef在Node映射。
- evaluator在独立Node侧持有冻结oracle与独立baseline。父目前兼产品作者不读future TEST或逐例结果；pilot内容若作为DEV反馈发给作者，access log必须标seen，永远不能回收正式。
- 8份public-facing requirements意为其将来可进入生成prompt的字段，并不意味着本次把完整题目发给方法作者；当前完整计划封存在private-pilot/v1.1/，公开只发布抽象schemas、计数、hash与签收。

## 2. 固定pilot矩阵

8新brief×2固定配置×1source=16生成槽；每source4预定任务；FULL/SCOPE_OFF/PROVENANCE_OFF/LLM_ONESHOT四方法=256计划方法槽，每方法64。R/G复用一次补丁，不能再乘2。布局/状态/跨viewport/重新加载域必须保留，不因MVP或测量缺项缩减。

四任务类别为content/text、static attribute intent、spacing/gap intent、responsive arrangement intent。它们描述用户可见结果，不要求源码使用字面量、inline-style、无map、单组件或编辑marker。原始程序可以自然使用组件/数据绑定/状态/样式抽象；方法不支持应拒绝并入漏斗，不能替换题或剔除E。

## 3. Runtime与场景

App.jsx/JSX；entryContract=v04-jsx-app-script-react-1；Program function/const/let App/_App，App优先单mount；无imports/dynamic imports/exports/self-mount；离线行为。允许自然组件、状态、派生数据、辅助函数和CSS组织。原始bytes/hash不被人为清理。

viewports固定desktop 1280×900、mobile 390×844。基础动作含click、fill、key、reload、setViewport；reset是普通UI业务动作，不等于reload。场景内setViewport必须保留业务状态；reload重新执行修改后source并重放，不能仅测live DOM临时编辑。

## 4. Query与probe抽象域

语义query允许role/name+within、form-control accessible label+within，以及有限显式queryRef列表；不可用源码位置/marker或private expected作唯一目标定义。必须区分unique/ambiguous/not-found/unsupported；不靠测试人员读source修定位。

form-control label可能映射textbox、spinbutton等合法原生表征。未公开要求特定HTML input type时，不能把单一role写成隐藏资格门槛。对应input type的empty/value采集需要真实控制；现有input:text/textarea policy不能自动推广。

probe kinds最少为value/text/count/enabled/attribute/rect/withinViewport/gap/grid/order/documentOverflow。复合geometry必须记录共同capture provenance、身份与span；gap/grid/order/overflow不能只改名调用不等价primitive。

- gap：预定两个可见box沿指定轴的边缘间距，单位CSS px；别把computed CSS gap与margin造成的实际间距混算。
- grid：指定有序card/queryRefs的视觉列数/行数与box证据；固定聚类容差，不能按结果调阈值。
- order：给出queryRefs对应的实际视觉/DOM顺序及口径，不把期待顺序发给collector。
- documentOverflow：实测scroll/layout viewport与整document水平溢出，不是单元素withinViewport。

精确机器字段以JSON schema与各owner签收adapter映射为准；schema存在不等于实现接受该payload。任何kind/query/action未被支持和校准，pilot-admission继续blocked，不能删任务。

## 5. Node-private检查接口

私有检查包含expected/comparator/temporalMode、完整key、target/protection/G-original标签、baseline-relative规则；这些字段绝不能出现在publicProbe/action请求。公开仅声明所需检查类型：绝对目标、原始G规格、独立baseline相对保留、数值/分类非恶化、未新增异常、完整expectedKeys。

R：必要baseline可观测、目标非已满足no-op，允许原程序不完美；原先passed相关检查不退化，失败数值不恶化，明确no-change范围按baseline保持，missing→missing不算成功。G：原始完整公开规格/场景通过。二者不得根据结果放宽。

r2保守分类沿已公开规则：early stable wrong不提前fail；gap/timeout历史保留但不冒充持续错误；clean deadline/tail条件成立才可能确认W；有独立W可在suite优先，其它unknown仍保留。所有needed keys缺失显式notMeasured，不能默认为pass。

## 6. Owner签收要求

browser50fa需签收所有query/probe/actions及对应可信控制；eval508需签收独立baseline capture、非恶化规则/完整keys；methods92301555需签收四方法wrapper、公共投影、accept锁定和计划槽ledger。统计owner需签收brief/family聚类及计划统计，不用task独立二项CI。外部baseline只通过父中转公共需求，不获取private expected。

此文件不发布具体pilot业务名称、数据、任务目标值或私有检查顺序。父只收到抽象接口和总体缺口；任何计划修订均在未见source前另记version，不以编辑结果救分。
