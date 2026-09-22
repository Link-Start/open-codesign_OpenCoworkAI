# v0.4 外部编辑 baseline 有界适用性调查：Onlook Web 与 Desktop

> **WIP / NOT NATIVE READY / NOT PILOT ADMITTED.** Publication-adapted historical/contextual document. [Current STATUS](../STATUS.md) overrides older readiness, implementation and test claims below. Historical results, local calibration policies and referenced private artifacts are not bundled; historical source hashes and retained public commitments are not re-certified by this export. Commands below describe the historical workspace, not the signed publication test list; see [export notes](../publication/DOCS-EXPORT-NOTES.md). Do not follow excluded links to assemble a dependency closure.

- 状态：**source-backed-not-executed**；协议状态仍为 **draft-not-frozen**。
- 调查日期：2026-09-20 UTC。仅公开网络资料与固定commit源码静态阅读；未安装、构建、启动或执行候选产品/代码，没有模型编辑调用、没有browser试验。
- 未读取本研究产品实现、private题目/源码/oracle；本文件没有TEST题。
- 结论适用于下面两个开源快照，不自动适用于Onlook现有托管服务、其它版本或React生态总体。

## 1. 决策摘要

**当前没有建立“严格自然 single-file App/_App、无imports、无持久marker”条件下开箱即用的Onlook baseline。** 这是源码契约不匹配和待验证适配，不是性能失败、不能把它记成768个W，更不能据此宣称本产品胜过成熟工具。

1. **Web快照不建议进入本轮直接安装主比较。** 实际importer要求Next项目；编辑文件系统会将data-oid和格式化写回源码；样式操作走Tailwind；local import实际上传CodeSandbox。Next wrapper、Tailwind改造、source ID策略和云环境不是免费适配。[W1]、[W2]、[W4]、[W5]
2. **Desktop 0.2.31更适合作有界DEV适配诊断，但也不是现成合格baseline。** 本地目录/运行命令/IPC有利自动化，然而stock RunManager启动就写源码ID，停止时AST去ID并格式化再写回。不能因仓库留有旧Babel插件就称当前stock是纯编译期注入。[D1]、[D2]、[D3]、[D4]、[D5]
3. 可建议两个里程碑的独立DEV试验，先检验无编辑round-trip、临时shadow边界及真实持久输出，再决定是否值得做adapter；不能为了让工具参赛去清理自然source，不能把重写后的外部派生系统称未改装成熟产品。
4. 外部工具适用性调查本身已经有实质反例与工程约束；尚未完成外部编辑成功率比较，也不满足formal readiness的执行证明。

## 2. 固定身份与证据等级

| 候选 | 固定身份 | 已确认事实 | 限制 |
|---|---|---|---|
| Onlook Web开源编辑器 | `onlook-dev/onlook@423e2e924366419e418ee049093872d535eea41a`，commit日期2026-07-22 | README区分既有Next+Tailwind开源编辑器与后续托管early-access产品 | 不用滚动main作可重现身份，不将开源快照等同新托管产品 |
| Onlook Desktop | `onlook-dev/desktop@a3685a49bdb9ace3708ee38464874b097e2485d3`，commit日期2025-07-17；studio package版本`0.2.31` | Electron36.0.1、React18.3.1相关构建依赖和Bun工作区 | `releases/latest`请求404；没有声称找到可下载签名release或tag，仅commit+package身份 |

证据分层：A=固定源码明确路径/分支；B=固定README/文档声明；C=据A提出的工程推论；D=未执行待验证。不把“声明可用”“内部函数存在”升级成实测通过。

本轮公开网页raw/docs域名部分DNS/fetch失败，改读GitHub公开contents API的固定ref、解码base64得到源文件。失败是资料获取错误，不是候选产品运行失败。源文件来自网络，未执行其中脚本；其中任何安装/清理命令仅作为被调查数据。

## 3. 本研究公共比较契约

父提供的当前抽象操作域（未formal冻结）：文字；静态属性`title/placeholder/alt`；existing-inline-style的`color/backgroundColor/fontSize/gap/padding/borderRadius/maxWidth`。范围仅唯一自动挂载App/_App的直接host/fragment的source-definition。动态/复用/map/custom来源保守拒绝，不称任意instance编辑。

纯事件handler的存在本身不等于编辑目标动态或不明scope，保留handler行为应作为DEV正向控制；本条只来源公开能力声明，未查看实现或据此制作TEST。

基线适用必须分别满足：原始输入契约、操作/范围语义、公共定位输入、真实source输出、相同验证门槛与可计量适配。视觉预览改对但source没改不算持久编辑。对方支持面更广不等于能满足“修改既有inline-style”；本系统范围更窄也不代表更安全。

## 4. Web：集成与真实写回链

### 4.1 裸App文件不能直接过importer（A）

`apps/web/client/src/app/projects/import/local/_context/index.tsx`的`validateNextJsProject`检查：package.json是文本；dependencies/devDependencies包含next与react；有app/src/app的layout，或pages/src/pages路径。没有package.json的单App.jsx无法按该入口原样导入。[W2]

UI写“NextJS + React + Tailwind”；具体validator没有在所读分支检查Tailwind依赖。因此应分开写“代码强制Next/React/router结构”和“UI/README宣称Tailwind支持要求”，不能把文案当额外validator事实。[W1]、[W2]

同文件finalizeProject不是只连接本地目录：fork blank CodeSandbox，createCodeProviderClient(CodeSandbox)，逐文件uploadToSandbox，provider.setup，再创建项目。自然源码进入远端服务的隐私/成本/网络适配需明示。[W2]

可能补一个Next项目shell并包住App，但仅提供词法App/_App、未提供Next页面导出的源，与Next页/client边界不自动兼容（本研究精确exports规则尚未冻结）；添加export、use-client、imports、改函数名或内联到page都改变source契约。仅增加独立运行shell而保持原source不变属于待验证adapter；本轮未证明其能在stock编辑器中正确索引、加载和导出。因此不能把“理论能包一层”写成已适用。

### 4.2 文档的build-time描述不覆盖真实持久行为（A/B）

架构文档称build-time属性类似sourcemap。[W3] 但当前`packages/file-system/src/code-fs.ts`实际：

`writeFile(path, content)` → `processJsxFile` → parser AST → `addOidsToAst` → `getContentFromAst` → `formatContent` → `super.writeFile`。

`packages/parser/src/ids.ts`为JSXOpeningElement新增/去冲突`data-oid`，跳过React Fragment；root layout还会injectPreloadScript。[W4]、[W5] 因而常规JSX写回不是仅DOM/编译临时产物，而是会持久改变项目源码及格式。这与本研究“不持久marker、不预整理自然source”的严格主轨不匹配。

不能靠编辑结束统一删属性就宣称零适配：AST格式化、映射重定位、组件props传播及导出等价性仍要验证。若在完全隔离shadow项目中允许这些变换，必须将shadow instrumentation和向原source投影作为独立adapter，计成本并验证无编辑identity；不能修改原始archive。

### 4.3 持久编辑和操作匹配（A/D）

`CodeManager.write/writeRequest`处理actions，生成CodeDiff并写`diff.generated`；输出是文件内容，并不天然提供相对归档原字节的局部span补丁。可从before/after构造diff收据，但不能把工具生成的`original`字段当原始归档字节，必须独立hash原文件。[W6]

`getStyleRequests`调用`addTailwindToRequest`，parser style helper写`className`；这是明确Tailwind样式路径，不是“更新现有JSX inline style对象”的同能力实现。[W7] 有inline style时，仅加class也不自动覆盖相同属性；没有运行证据，不能报成功或把迁移inline→Tailwind当合法免费支持。

`updateNodeTextContent`修改JSXText；多行情况会清空children再插文本/br。`updateNodeProp`能构造静态字符串属性，但这些helper不能独自证明UI可定位并完成title/placeholder/alt全部任务，也不能证明状态保留或instance scope。[W8] 无需调用AI的这些静态代码路径存在，不等于整应用无需云服务。

## 5. Desktop：为何较可控但仍有关键门槛

### 5.1 build-time插件与stock运行路径不能混淆（A）

仓库`plugins/babel/src/index.ts`确实在Babel AST中附加压缩位置元数据，含filename、start/end tag、component stack；README描述安装Babel插件及Webpack/CRA接入。[D2] 这为“编译副本instrumentation可能可做”提供技术线索，不是当前desktop运行链已经这样工作的证据。

0.2.31 stock `RunManager.start`调用`addIdsToDirectoryAndCreateMapping`；`processFileForMapping`从`getFileWithIds`取得加ID+format后的源码，调用`writeFile(filePath, content)`并建立mapping；watcher对后续变更继续重写。`stop/stopAll`调用cleanup，去ID、去特定move key、generate+format+write。[D3]、[D4]

`getCodeDiffs`依赖runManager的OID→TemplateNode映射；`transformAst`通过JSX源码OID匹配请求。这说明直接改用旧位置插件会涉及resolver/映射契约适配，不能假装只装一个现成plugin就得到相同系统。[D5]

因此不能让RunManager接触v03、原始DEV唯一副本或未来原始TEST。正常退出cleanup也不证明byte-for-byte还原，更不覆盖异常退出残留marker。可能的shadow副本策略仍须无编辑round-trip与导出projection控制，且当前严格主轨尚未接受此实现。

### 5.2 自动化存在内部入口，不是成熟公开benchmark API（A/D）

`electron/main/events/code.ts`注册`GET_AND_WRITE_CODE_DIFFS({requests,write})`、`WRITE_CODE_DIFFS`、`GET_FILE_CONTENT({stripIds})`、文本可编辑性等IPC。[D6] 这比只有鼠标操作更可自动化：可获取完整diff、单次提交、导出source；但需要真实Electron上下文、selection/OID映射和运行项目。仅调用parser/helper绕过产品集成不能称完整成熟产品baseline。

`writeCode`会format生成内容再写文件。[D7] 验收必须从真实输出文件取得bytes，在原v04 runner重新加载测试，不以DOM预览或布尔返回true为成功。

仓库有Playwright配置和npm e2e脚本，但`e2e/example.spec.ts`在此commit为空；配置CI retries=2。不能据此声称已有可用端到端脚本；研究自动化必须另写且retries=0，失败留证，不运行到成功。[D8]

### 5.3 操作与scope匹配尚未完整成立（A/D）

| 公共操作/约束 | 源码支持线索 | 当前结论 |
|---|---|---|
| 静态文字 | transformAst调用updateNodeTextContent | 持久写回路径有证据；完整UI/状态保留未执行 |
| title/placeholder/alt | transformAst对attributes调用updateNodeProp，字符串可写literal | 内部属性能力存在；三个UI端到端能力分别待测，不报全支持 |
| 既有inline style七属性 | 所读style helper主要为className/Tailwind与通用prop；尚无已验证专用inline AST路径 | 不等同本研究existing-inline-style支持；不能静默迁移到Tailwind |
| source-definition唯一host | OID/TemplateNode可定位源码节点 | 定位不证明复用/传播范围正确 |
| instance模式 | StyleManager有Root/Instance并选择oid/instanceId | 枚举/分支存在不证明任意instance安全；本研究不扩大范围 |
| 纯事件handler | 修改text/attr不应必然修改handler | 必须以公开DEV保留控制验证，不以存在事件函数直接拒绝所有例 |
| 自然源、无持久ID | stock运行会写ID并cleanup再格式化 | 开箱即用不满足；adapter尚未证实 |

Desktop源码的本地文件、终端和内部IPC使其比Web云导入更适合先做DEV诊断，**不意味着其离线或inline能力已经通过**。

## 6. 网络、依赖、许可证与成本

### Web

README列Next/Tailwind/tRPC、Supabase/Drizzle、Bun/Docker、CodeSandbox、AI服务和Freestyle。实际local importer硬编码CodeSandbox provider；self-hosting文档承认fully local sandbox仍为未来能力，并提到E2B，与当前导入代码有年代/路径差异。应以固定源码实际路径为准，不能从self-host文案断言全离线。[W1]、[W2]、[W9]

无需AI的手动编辑不等于无需Auth/DB/sandbox网络。必须在DEV测清哪些服务是启动必需、哪些仅AI/发布可关闭；本轮未提供凭据、未调用付费sandbox或模型、未安装服务。报价/整机资源/完整金额未知，不用“Apache=免费运行”推算。

### Desktop

本地Electron/Bun构建仍需依赖下载、native模块、Chromium/Electron运行成本。package有@parcel/watcher、node-pty、Supabase、analytics等；AuthManager探测supabase/auth，但仅此不能证明整个应用无登录可运行。[D1]、[D9] 应离线阻断测试实际UI路径，记录analytics/auth失败是否影响编辑。

`create/setup.ts`的reinstall会删node_modules及若干lock文件后重装。它只是公开工具源码，不是本研究执行指令；任何后续安装只能在可丢弃baseline DEV目录，不能指向原研究或产品checkout。固定commit还不保证锁文件/平台依赖位级相同，安装要另记lock hash、解析版本和实际二进制。[D10]

### 许可证

两个固定仓库根LICENSE.md均为Apache License 2.0，blob均`295f5e1b5c342a1382ca2b54f7a911fdc466149d`。[L1]、[L2] 开源修改/分发须按许可证保留必要文本、变更说明与适用NOTICE等；不擅自将所有依赖或托管服务条款归为同一许可。只确认根许可证，不声称完成传递依赖/商用服务法律审计。

### 前瞻成本分类

独立记录：首次checkout/build，平台依赖，项目shell，source/OID映射适配，仪器化与剥离/投影，UI/IPC自动化，认证/sandbox部署，运行CPU/内存，网络/云/API支出，以及维护重跑。工具现成代码为继承成本，adapter新代码为适配成本；二者均不免费。active人时、Harness tokens与金额无凭据为null。网络检索次数与编辑API次数不同，不能用“实验编辑API=0”隐藏研究网络活动。

## 7. 后续独立DEV安装实测建议（尚未执行）

只建议优先Desktop固定commit；Web当前结构不匹配先停止主轨安装。以下是诊断方案，不是formal资格放行，也不包含heldout题。

### 里程碑A：固定安装、零编辑纯度和运行边界

1. 在独立可丢弃DEV目录checkout精确commit，核验源码hash；锁定Bun/Node/Electron/依赖lock与平台。先审查安装脚本再依赖安装，不运行clean/reinstall到共享研究目录。
2. 只用公开手写微例/已见DEV副本；原bytes/hash另存只读。可信外部shell提供React globals及App/_App自动mount，source不补imports/export、不改名；若stock loader必须改变source，则记录adapter不可用，不悄悄修改题源。
3. 记录启动前、RunManager插ID后、正常stop后、异常终止后的所有文件diff；没有任何编辑时，严格导出应还原原bytes，或者明确证明预先批准的纯临时仪器化边界。仅去marker但格式化漂移不算字节identity。
4. 检查origin runtime与baseline宿主的行为/布局/输入值/事件handler等价；记录Electron/浏览器差异。暂不能等价则不进入成效对比。
5. 阻断外网并记录本地手动编辑是否可用、认证/analytics/依赖下载的实际必要性；已缓存资源和首次安装区别报告。

### 里程碑B：仅当A成立才测单次持久编辑

1. 在公开操作矩阵上设置固定DEV控制单元：文字、三个属性、七个existing-inline-style属性、正常handler保留及预定拒绝结构；这是公开能力控制，不是正式TEST出题。
2. 固定选取方式/UI或IPC入口；仅公共定位证据，不人工读源码给隐藏oracle位置。每控制一次提案/提交、零重试；用真实before/after bytes重建diff和hash。
3. 导出后由共同v04 observer在原runtime重载、重放与判定；DOM预览成功而源码未持久计失败。完整记录不支持、拒绝、adapter错误，不混为W。
4. 如果必须修改Onlook实现以更换OID为临时映射/增加inline writer，保留补丁与成本，命名`ONLOOK_DESKTOP_ADAPTED`；这不是原版stock，也不是只改变scope因素。若适配量演化为重做编辑器，则停止，不借成熟产品名字包装自研parser。
5. 两里程碑结束即给适用/部分适用/不适用/未建立结论；不因已有费用投入而无限重试，不扩大支持集救分。没有合格外部baseline时论文如实报告适用性边界，不伪造排行榜。

### 保密与安全

后续也只用DEV；不得上传private source到CodeSandbox/托管服务。临时项目与云资源隔离，禁接触凭据目录/归档源；签收后再定独立执行owner。给父只报告公开适用性和控制汇总，不发heldout内容。

## 8. 可用于论文的表述与禁用表述

可写：“在两个固定Onlook开源快照中，导入项目结构、源码ID写入和样式序列化与本研究的单文件自然JSX及既有inline-style契约存在差异；我们进行了源码支持的适用性审查，尚未完成运行适配或编辑性能测量。”

不可写：“Onlook不支持React”“成熟工具都不行”“Babel就是成熟编辑baseline”“旧Babel plugin证明当前Onlook零源码改造”“清理marker即可保证等价”“本产品已胜过Onlook”“看见IPC/API就已自动化”“开源许可意味着零适配成本”。

## 9. 固定来源索引

下列链接均指向本轮实际读取的公开源码/文档；固定commit优先于滚动官网。本文没有采纳第三方摘要作为实现事实。

[W1]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/README.md
[W2]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/apps/web/client/src/app/projects/import/local/_context/index.tsx
[W3]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/docs/content/docs/developers/architecture.mdx
[W4]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/packages/file-system/src/code-fs.ts
[W5]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/packages/parser/src/ids.ts
[W6]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/apps/web/client/src/components/store/editor/code/index.ts
[W7]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/apps/web/client/src/components/store/editor/code/requests.ts
[W8]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/packages/parser/src/code-edit/text.ts
[W9]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/docs/content/docs/self-hosting/external-services.mdx
[D1]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/package.json
[D2]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/plugins/babel/src/index.ts
[D3]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/run/index.ts
[D4]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/run/cleanup.ts
[D5]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/code/diff/index.ts
[D6]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/events/code.ts
[D7]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/code/index.ts
[D8]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/playwright.config.ts
[D9]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/src/lib/auth/index.ts
[D10]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/create/setup.ts
[L1]: https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/LICENSE.md
[L2]: https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/LICENSE.md

补充实际已读实现：[Web属性/style helper](https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/packages/parser/src/code-edit/style.ts)、[Web验证UI](https://github.com/onlook-dev/onlook/blob/423e2e924366419e418ee049093872d535eea41a/apps/web/client/src/app/projects/import/local/_components/verify-project.tsx)、[Desktop插ID和mapping](https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/run/setup.ts)、[Desktop transform](https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/code/diff/transform.ts)、[Desktop style helper](https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/electron/main/code/diff/style.ts)、[Desktop StyleManager](https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/src/lib/editor/engine/style/index.ts)、[空e2e示例](https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/apps/studio/e2e/example.spec.ts)、[Desktop Babel接入说明](https://github.com/onlook-dev/desktop/blob/a3685a49bdb9ace3708ee38464874b097e2485d3/plugins/babel/README.md)。

代表性Git blob收据：Web importer `0edb36354dae3137b25cd548a1965c62775b1985`；Web code-fs `026393d42f739f54ebe599b1b1a4be9130cf3520`；Web ids `422c8a3f8b30bd8d638726265f949ffb7fb5f31d`；Desktop RunManager `e76af949786196cbdef2eaef8b0282cf440eb66f`；Desktop cleanup `c8c250b3ef9a84ac4c0126951c87028564f72097`；Desktop旧Babel plugin `d7d520f41758f91b86d535159a925d05854853a7`。这些是API返回的Git blob身份，不冒充本地SHA256或执行收据。

## 10. F0公平性澄清（2026-09-20追加；源码事实不变）

本节澄清前文“严格自然源/no-persistent-marker”与“适用性”的关系；不得把第1节或第7节的source-purity诊断解读成永久淘汰Onlook。

1. **自然输入不可人为改造成定制schema，不等于所有方法中间态/最终非目标字节必须原样。** 原始采集archive仍不可改；Onlook stock自动插ID、格式化、清理，以及LLM较大source patch，均首先作为被测系统行为记录。
2. stock自动准备应实测无编辑round-trip的字节/AST/行为变化、导出marker、实际collateral和成本。仅格式化或ID字节变化不自动构成主R/G失败，也不能不实测便声称无法编辑。前文A3的byte-identity要求仅适用于另行预声明的严格source-purity诊断，不是所有方法参赛的先验必要条件。
3. 若用户最终要求marker-free导出，作为独立source-purity端点或跨方法共同导出约束提前冻结；对LLM、大patch与native/外部方法同样适用。不得允许LLM广泛重写同时以Onlook非目标字节变化拒其参与。主R/G仍以目标、scope语义和冻结保留要求为准。
4. 已核实singleApp→Next项目及inline-vs-Tailwind等域差异不因此消失；但通用wrapper/自动instrumentation若能保持原输入身份、暴露真实输出并通过原runtime等价/保留，应允许作为透明计成本的适配路径实测，不能为优待窄MVP预先排除。人工按题修复源、改成Puck式定制schema仍不属于本自然同域。
5. 后续决定保持**DEV applicability待实测**。优先Desktop的建议是有界工程优先级，不是Web或Desktop永久不合格，更不是baseline性能结果。若确实不能满足某冻结域，应精确报告该域限制、原计划漏斗与可比较共同域，不泛称整个产品无法编辑。

因此前文所有固定commit/ID写入/IPC/Tailwind/许可事实继续成立；“开箱即用适用性尚未建立”不应扩写为“无须实测已证明不适用”。本次追加不执行候选、不生成TEST、不改任何原始source。
