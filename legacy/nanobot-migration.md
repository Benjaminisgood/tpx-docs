# TPX nanobot 迁移

TPX 的科学计算继续由原 Python 实现承担，默认交互层迁移为独立 nanobot Agent 与 WebUI。

| 位置 | 职责 |
| --- | --- |
| `tpx/` | 科学 SDK：读写、数值计算、全量数据与科学约束 |
| `tpxtpx/` | 科学 CLI、实时命令目录、control v1 冻结计划 |
| `tpxtpxtpx/` | nanobot Agent、会话、Provider、通道、工具与 app |
| `tpxtpxtpx/apps/workflow/` | 逐步处理服务、运行记录与专用 skill |
| `tpxtpxtpx/apps/calculate_ea/` | Ea 独立页面、CLI、skill |
| `webui/`、`tui/` | 独立浏览器和终端客户端 |
| `labcode/` | 可直接检查、使用的实验室脚本；不是实验结果目录 |
| `labview/` | 以后接入的 TPX 实验室程序，目前预留 |
| `script/` | 本地启动、Docker 初始化与维护脚本 |
| `apps/calculate Ea/` | 保留的原始 Ea 数据、notebook 与历史结果；当前插件在 `tpxtpxtpx/apps/calculate_ea/` |

## 来源与升级

通用 Agent、WebUI、TUI、客户端事件库来自用户指定的
`https://github.com/Benjaminisgood/nanobot.git`，固定版本
`7f2377cb23e899cfc4d36efc3f1e4cfdbe5d2146`（获取日期 2026-10-22）。
MIT 许可证与 THIRD_PARTY_NOTICES 原样保留。项目包、环境变量、状态目录、浏览器存储、
服务端口独立命名。TAP `bb9069eb1e0c5328a7223165349817b89fc0e4e6` 的
catalog-first、聊天参数卡、独立 app 的 `mount(element, host)` 模式提供设计参考。
运行时不导入 TAP/TAK，不使用它们的环境、凭证、配置或数据目录。

后续升级先比较上述固定版本与新 nanobot，然后适配 TPX 工具、插件、卡片、配置及科学合同；
不要用通用 nanobot 包覆盖此项目。升级使用私有 [Benjaminisgood/TPX Git 源](https://github.com/Benjaminisgood/TPX)，
按[源码更新流程](../tpxtpxtpx/skills/tpxtpxtpx-document/references/quick-start.md#updating)审阅差异、保留配置及结果后更新；
没有配置 PyPI 自动替换路径，未明确要求不得给已有定时器添加后台升级。

网页资源先在 `webui` 中运行 `npm ci`、`npm run build`；根 setuptools 构建不会自动编译前端。
原生 TUI 使用匹配的源码与 Bun，或显式 `TPXTPXTPX_TUI_BIN`；默认不下载上游发布二进制，
也没有在这里声明 TPX 平台 wheel 已发布。

## 交互与证据

Agent 从当前 catalog 读取命令，展示 `tpxform` 卡片。用户修改参数、准备冻结计划并点击运行；
执行前重新核对配置、命令合同和运行时。任务通过固定 Python module、独立 argv 执行，不用 shell。
运行状态、日志和 artifacts 可以恢复查看；输出仍留在明确选定的实验目录。

新实例默认 `~/.tpxtpxtpx/config.json`，工作区 `~/.tpxtpxtpx/workspace`；WebUI 8766，
gateway health 18791。`tpxApps.enabled` 控制 `workflow`、`calculate-ea`，禁用后不加载其技能、
工具和路由。默认启动器使用常驻 Docker，状态与工作区通过独立实例挂载；
`--local` 为本机后台进程。OSS 在设置中配置，完整导入本机副本后进入科学工作流。
Provider 首次在设置中配置；未配置时确定性处理工具仍可使用，模型对话不能执行。

TPD 继承现有完整科学步骤；TPR/TPO 保留原占位命令，不宣称有新算法。
Ea 默认采用显式 leading-edge 假设，输出表观脱附活化能。原 notebook 的多峰拟合留给研究者
核对，不把隐含基线、时间单位或回退值自动当成科学事实。

## 迁移阶段验证（2026-10-22，旧层清理之前）

以下为迁移阶段的历史验证，包含当时尚未删除的旧 helper 测试，不能当作清理后重新运行的测试数量。

- 当时 Python 科学与项目集成：890 项通过；聊天 WebSocket：505 项通过；TUI：265 项通过。
- WebUI 完整测试：164 文件、2847 项通过；最后追加的工作流回归 8 项通过；前端构建与导入边界检查通过。
- 独立 wheel 在仓库外安装后验证 SDK、CLI、离线文档、网页、Ea UI 与技能资源；macOS 启动及 Linux Docker 健康检查、网页、命令目录已验证。
- 浏览器实测新建实验、准备与执行、完整原始信号图、收据恢复、Ea 检查/计算/导出/历史与手机布局。Ea 合成曲线保留全部 701 点；原两套数据库 107 峰可拟合，原文件未修改。
- Codex/Copilot 登录由当前实例的 `auth/` 保存；不自动读取其他工具的登录信息。工作区限制和插件禁用后撤权均有回归测试。

## 旧层清理后的验证（2026-10-22）

- 科学测试：843 项通过；gateway / Ea / OAuth 相关测试：32 项通过。
- Linear：36 项通过；TUI 相关回归：27 项通过；前端构建通过。
- App 技能与访问：14 项通过；8 个命令入口、35 条 TPD catalog、33 项文档资源及原 Ea 31 个文件的哈希核验通过。

未配置真实模型账号，因此没有执行远端模型对话；Windows 启动入口已提供但未在 Windows 上实测。
基础 Linux 镜像不含 Times New Roman，需只读挂载自己的字体目录以保留指定绘图字体。
这些检查证明技术链路与约定，不代表对任一实验结果或物理模型的科学接受。
原 notebook 的样品特定多峰 Polanyi–Wigner/FWHM 分析保留在 `labcode/calculate-ea/`，没有将其隐含假设通用化。

## 2026-10-25 选择性上游升级

本轮审阅官方 [HKUDS/nanobot](https://github.com/HKUDS/nanobot) 的
`74942bd1..b048cf44f77eac021af91d1904d76a583d05f108`，保留上述最初来源作为历史基线。
TPX 本地 `main` 已先与自己的 `origin/main` 同步至 `ddef2c88`。以下记录表示已经核对的
上游版本与本轮采用范围，不表示 TPX 直接合并了全部上游提交或与其完整功能等价。

| 范围 | 本轮采用与上游依据 |
| --- | --- |
| 工具参数合同 | `9fe061a53` 接受 JSON 的整数值 `3.0` 并转为整数；`23bf1b87c` 的枚举比较不再把 `true` 当成 `1`；`6b930432c` 仅在 schema 明确要求容器时解码嵌套 JSON 字符串，保留可合法接收字符串的联合类型 |
| MCP 能力发现 | `a377a8e0d` 支持不声明 tools 的服务；`6670dd72d` 读取完整 resources/prompts 分页并检测重复游标；`68e9b1cc3` 发现失败日志只记录异常类型，避免把 URL 中的令牌写出。保留原 `enabledTools` 能力限制 |
| API 会话 | `0e0df327c` 让 JSON 与 SSE 请求的 `chat_id` 跟随 `session_id`，工具上下文不再全部落入默认路由。历史键与默认会话保持兼容；会话 ID 不是用户认证或文件权限边界 |
| 模型兼容 | `5fd79c25f` 保留带 UTF-8 BOM 的第一个 SSE 事件；`a88c33346` 使用 DeepSeek 的 `reasoning_text` 重放推理；`03e9b5430` 对齐 Kimi K3.1 Pro 及 highspeed 的请求参数与模型设置选项 |
| 自动化恢复 | `6dd3788e0` 重启时保留仍有效的待执行间隔任务时间；`a3ead6158` 旧任务完成时不覆盖执行期间新编辑的日程 |
| 空闲压缩 | `9650f4fd5` 取得会话锁后重查活动时间，避免刚完成的新对话被先前排队的空闲压缩立即归档 |
| 搜索依赖 | `3bd67254b` 将 DDGS 最低版本提高到 `9.16.1`，更新本机环境或 Docker 镜像时安装该修复版本 |

已存在并保留的行为：完整 PDF 页续读与单页截断提示（`5f6e8a6ba`）、跳过 XLSX 图表页
（`a2f9fae8f`）、单元格内制表符的准确 grep 坐标（`af353fae7`）、UTF-8 上传文件名字节上限
（`b4f381ca5`）、大小写不敏感的图片 MIME 类型（`8adab28ae`）。这些逻辑在本轮升级前的
TPX 源码已经存在，不重复套补丁，也不把它们计为本轮新实现。

以下上游变更需按 TPX 自己的合同整组评估，本轮没有引入：统一模型/显示会话存储
（`b32b1327c`）、集中代理设置（`084b6bb39`）、托管安装和应用内更新（`fbb61a373`）、
视频附件（`254f94b06`）、goal/最大迭代/压缩续接生命周期组、通用 cron 工具新操作与前端交互重构。
原因是这些变更联动持久化迁移、客户端协议或执行所有权，不能用单文件替换绕过 TPX 的冻结计划
与用户审查。TPX 的上游升级仍需通过本仓库，不下载通用 nanobot 二进制覆盖本程序。

本轮没有改科学 SDK、科学 CLI、冻结计划、基线区分或数据采样；配置、模型登录、工作区、
8766/18791 默认端口与 TAP、TAK 继续独立。未跟踪的历史 `apps/` 和
`.understand-anything/` 不属于本轮提交。

验证：离线回归与 TPX gateway、workflow/skill 权限、OAuth 隔离、CLI catalog、control 冻结计划、
文档资源共 **242 项通过**；新增回归位于 `tests/runtime_upgrade/`，其中工具、MCP、API、cron
和 Kimi 用例按对应上游测试适配。三个根包导入与 `git diff --check` 通过。修改范围的原有
Ruff 配置检查前后均为 79 项旧诊断，本轮没有增加诊断；新增测试通过 Ruff。没有调用真实模型、
真实 MCP、仪器或云对象存储，这些证据不代表实验结果的科学接受。部署的镜像与健康状态另行核对。

### 同日追加：网关不可用时的本地外观设置

后续审阅到官方 `44a7ef53ce23476f0037e500976fd298e6cbaa67`。本轮只适配其中本地
Appearance 的可用性修复：`/api/settings` 仍在等待或加载失败时，主题、语言及浏览器本地
显示偏好仍可编辑并保存；切换到依赖网关的设置页仍显示加载错误。已有设置快照时，明确的
原生引擎重启失败继续显示。此修复不改变 TPX 的运行时配置、工作区或科学处理。

该提交前的 `ef8271b2` 引入 system/light/dark、自定义字号及新的外观模块结构，仍列为待评估；
本轮没有声称引入这些新功能。浏览器存储继续使用 TPX 自己的命名空间。

验证：overview/sidebar 共 **27 项通过**，含先失败后通过的网关等待/失败回归及原生重启失败
回归；生产构建、浏览器 TypeScript 与修改文件 ESLint 通过。受控浏览器用例在 1280×800 与
390×844 验证等待及 HTTP 503 后的本地偏好保存、Models 错误提示，并检查截图、页面异常与
非预期控制台错误；两项通过。Browser 插件不可用，因此使用仓库现有 Playwright 与本机 Chromium。
浏览器验证使用模拟网关响应，未调用真实模型或仪器。
