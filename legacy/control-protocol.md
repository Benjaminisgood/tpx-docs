# Python 控制层协议 v1

控制层位于 `tpxtpx/control.py`。它接收一次 JSON 请求，从当前 Python 安装的真实
argparse 解析器取得 manifest，再生成并核验命令参数。控制层本身不执行科学命令、不写实验文件，
也不维护另一套科研流程状态。nanobot 工作流插件负责计划存储、一次执行、取消、日志与结果记录。

## 前后端调用链

```text
nanobot Agent 或用户打开实验处理页面
  → 当前 catalog/describe → 明确项目、TOML 和 typed values
  → workflow prepare → Python control.prepare → 展示参数卡和完整 argv

研究者审阅并点击运行
  → 宿主验证用户触发、确认状态与计划未消费
  → Python control.revalidate → 工作流核对输入文件哈希
  → 固定 Python module + argv 启动一次真实 CLI
  → CLI / SDK 计算及受控写入 → 运行记录 / ProcessingRecord
```

浏览器卡片由 `webui/src/components/tpx/` 实现；运行服务位于
`tpxtpxtpx/apps/workflow/`。Agent 工具可以读目录、准备卡片、查状态、日志和工件；它不能
自行发起科学运行。写入或接受步骤还要求用户明确确认。调用参数中的 `user_confirmed`
不是身份凭证，不能绕过宿主的用户操作检查。计划执行后不能再次复用，重复运行必须重新准备。

## 请求与响应

直接入口是 `python -m tpxtpx.control`：从 stdin 读取一个完整 JSON 对象，stdout 只输出一个
响应对象。没有交互、后台服务、自动重试或隐式执行。请求和响应都有 `protocol_version: 1`；
成功响应包含 `operation` 和 `result`，失败返回退出码 2 及 `error.code`、`error.message`。

最小协议发现请求：

```json
{"protocol_version":1,"operation":"describe"}
```

其余请求显式指定 `tool`（如 `tpdtpd`）、`python_executable`、`working_directory`、
`config_path`（实验配置绝对路径；workspace init 为 null）。参数值用
`{"kind":"value","value":"…"}`、`values`、`boolean` 或 `occurrences` 表示。
未知字段、重复 JSON 字段、非有限数值和不支持的版本都会拒绝。

| operation | 输入要点 | result |
|---|---|---|
| `describe` | 仅版本与操作名 | 支持的操作及 `executes_commands: false` |
| `snapshot` | 明确的运行环境与可选配置 | 实时 manifest、配置哈希、运行时身份 |
| `build` | `command_id`、`values`、可选 `allow_incomplete` | 经类型、数量、选项和互斥校验的参数；不构成执行计划 |
| `prepare` | `command_id`、`values`；实验动作需要 `expected_config_sha256` | 冻结计划 |
| `revalidate` | 原始 `plan`、`current_values` | 仅当前状态与原计划一致时返回计划 |
| `validate_drafts` | 原 `drafts`、整批 `updates`、界面排除的命令 ID、配置预期哈希 | 通过校验的参数草稿；允许未完成表单 |

`expected_manifest` 可绑定客户端已经展示的协议。构建和校验始终使用运行时自己的解析器，
不会执行请求提供的任意命令定义。草稿更新不能替换选定配置或绕过排除的命令。工作流 init
拒绝 `--force`；直接 CLI 的既有显式覆盖合同不变。

## 计划身份与执行边界

计划绑定完整参数、argv、配置路径及 SHA-256、manifest 及其 SHA-256、解释器真实身份、
后端版本及源码摘要。`plan_sha256` 标识计划内容，**不是授权令牌**；复制计划或知道哈希不会
获得执行资格。工作流另外绑定输入文件字节并防止同一配置同时运行多个步骤。确认后配置、参数、
输入或运行时变化都要重新准备和审查。

摘要按排序后的 JSON 字段计算，并统一数学值相同的整数/浮点表示（如 `10` 与 `10.0`），
以支持不同客户端的 JSON 往返；布尔值与数字仍严格区分。argv 中的字符串保持原样。

控制层只读验证与进程启动之间不承诺全文件系统事务。CLI 继续核验被冻结的配置字节，
用既有 CAS / no-clobber 合同发布工件。输入数据的科学适用性、审核状态、校正规则和结果接受
由领域 SDK、CLI 与研究者负责。原始输入及既有结果不会因为计划成功就获得科学认可。

## 状态与记录

工作流状态默认位于实例配置旁的 `tpx-workflow/`：`plans/` 保存准备内容，`runs/` 保存
`receipt.json`、stdout/stderr 和事件日志。结果仍写在明确选定的实验目录。页面可恢复查看运行状态，
取消会收束服务拥有的进程；服务关闭也会处理其活动运行。

`receipt.json` 记录一次执行事实，experiment TOML 中的 ProcessingRecord 记录科学工件身份与父链，
两者不能互相替代。目录发现的旧工件和本次运行生成/修改的工件分开记录，预览及下载核对当前哈希。
技术检查应覆盖参数、互斥、冻结身份变化、用户执行门禁、取消及真实 CLI 接线；检查成功不是科学接受。
