# TPX 上游同步记录：2026-10-29

## 来源和范围

- TPX 同步前：`53f7e8673f8c1c5f3e6f11c5d636f9bea898c38b`，已 `git fetch origin` 确认 `main` 与 `origin/main` 一致。
- 原始导入 Benjaminisgood/nanobot `7f2377cb23e899cfc4d36efc3f1e4cfdbe5d2146` 与 TPX 0.9.0 分发身份保留；上次审查到 `44a7ef53ce23476f0037e500976fd298e6cbaa67`。
- 本次官方参考：[HKUDS/nanobot `cb3ba4531761b49f61568754eb3d3ce84db4b75d`](https://github.com/HKUDS/nanobot/tree/cb3ba4531761b49f61568754eb3d3ce84db4b75d)。审查 `44a7ef53..cb3ba4531` 共67个官方提交，其中 `83b611284362b240eaa4d0e180693be445c91500..cb3ba4531` 是本次提及的64个新增提交；另3个是此前fork已同步而TPX尚未审查的界面提交。
- fork对照：Benjaminisgood/nanobot `97edeca06bf0fe357900ac539490da4fb2c73a45`。逐提交适配而非对fork做双点覆盖，未导入TAP scaffold等fork专用实现。另补此前 `28f6c26946ebb7fa5dd69b64b172a1033f9a840f` 的明确认证错误分类、`76da55994b55bf0e8c0bb634dbd674a990417964` 的托管工具流段结束、`f57018aa7fa45b5ac4001dcfae223562fc5a61b3` 的代码高亮 context 前置依赖。
- 仅改TPX通用Agent/网络/文件媒体处理、WebUI对应边界、测试和审计；`tpx/`、`tpxtpx/`、TPD/Ea算法、冻结计划control v1、四类基线、全量采样和实验数据不改。保留 `.understand-anything/` 与 `apps/calculate Ea/归档.zip` 未跟踪状态。

## 本次纳入

| 上游提交 | TPX 中的行为变化 |
| --- | --- |
| `acae3e6a6` | 纳入：分隔符解析 data URL，支持大写 BASE64，避免畸形参数的正则回溯。 |
| `c4dac649d` | 纳入：现有 helpers.atomic_write_text 使用 newline=""，按输入保留 UTF-8 换行字节。 |
| `927eba89e` | 纳入：同步 process_response 阻断已断开连接的 HTTP 握手，保留 TCP/Unix listener 可用。 |
| `c758ce8f4` | 纳入：缓存 Windows FILETIME 类型与 kernel32 签名，保留每次实时查询和 CloseHandle。 |
| `4e77d9c3f` | 纳入：MCP 请求重试与渲染/重连错误隔离；provider 抖动退避及单次图片兼容修复；ASR 退避前关闭流；Bedrock 禁用SDK叠加重试；通道退避释放许可，Telegram 不整段重发已发送前缀。 |
| `2853287ed` | 纳入：lease snapshot 只读；monitor 仅在客户记录变化时持久化，保留最后客户退出的原子停机判断。 |
| `1c28b20c7` | 纳入：局部引入标准库 atomic_file 快照读取与 Windows 原子替换，用于 lease I/O，不迁移会话数据库。 |
| `69d2fd87b` | 纳入：显式 Markdown 文件链接和推断路径使用同一个预览可用性检查，失败或未完成时不可点开。 |
| `4a14faa47` | 纳入：SessionState 写事务内验证已保存目录，scope锁序列化草稿编辑/消息准入；服务端和客户端均锁定空历史的已有会话，同目录权限调整继续受可信来源限制。 |
| `e981e97f1` | 纳入：编号代码的多个高亮token共享一个换行容器，保留 ViewportCodeRows 优先级和完整复制内容。 |
| `219c8bb2b` | 纳入运行时部分：provider 不把错误文本当正文 delta；runner 在终止错误时保留去除推理后的真实流段，下一请求携带已输出答复且不重放完成工具；reply_preserved 事件/恢复UI联动暂缓，保留TPX现有显示历史合同。 |
| `76da55994` 的托管工具流段部分 | 工具开始时先结束正文流并重置think提取器；流中断回归覆盖跨工具/恢复片段，保留TPX工作台metadata分支。 |
| `f57018aa7` 的context前置部分 | 通过React context把highlight状态穿过Streamdown 2.5的块缓存，流完成后更新代码高亮而不重挂载历史；不引入Mermaid依赖/渲染器。 |
| `28f6c2694` 的分类部分 | 只有401或明确authentication/OAuth证据分类为认证错误，普通403保持unknown；账单错误不删除图像再请求。 |

上述修改使用TPX自己的命名空间和入口。配置仍为 `~/.tpxtpxtpx`，8766/18791端口、独立模型登录、工作区及凭据保持TPX所有权。没有启动或重启已有运行实例。

## 已存在并保留的修复

| 上游提交或TPX合同 | 当前源码检查 |
| --- | --- |
| `9fe061a53`、`23bf1b87c`、`6b930432c` | 工具schema的整数规范化、布尔枚举区分、明确容器的JSON字符串解码已在runtime_upgrade回归中保留。 |
| `a377a8e0d`、`6670dd72d`、`68e9b1cc3` | MCP无tools能力、resources/prompts分页、日志隐藏敏感错误内容和enabledTools限制继续保留；本轮只改变请求恢复边界。 |
| `0e0df327c`、`5fd79c25f`、`a88c33346`、`03e9b5430` | API会话路由、BOM SSE、DeepSeek推理和Kimi参数适配保留。 |
| `6dd3788e0`、`a3ead6158`、`9650f4fd5` | 定时任务恢复/编辑和空闲压缩锁后复查保留。 |
| `5f6e8a6ba`、`a2f9fae8f`、`af353fae7`、`b4f381ca5`、`8adab28ae` | PDF续读提示、XLSX图表页处理、单元格grep坐标、UTF-8文件名限制及MIME大小写保留。 |
| `32ee2810a` 对照 | TPX已有独立源码升级skill，保留其禁止通用包覆盖、跨仓配置和擅自定时升级的约束。 |
| TPX专属合同 | tpxform、TPD/Ea app、catalog准备/审核/冻结执行、工作台同步、OSS访问及OAuth实例隔离未被上游代码替换。 |

文档/媒体显示预算不改变科学数据。本轮没有抽点、截断实验数组、默认平均或重算并覆盖实验结果。

## 暂不整体迁入的部分

以下逐提交表覆盖67个官方提交；“延期”不表示已经合入，也不表示TPX与官方0.4.0功能等价。`219c8bb2b` 的provider和runner分段留存已适配并测试；reply_preserved客户端事件、恢复提示及独立显示历史升级仍需成组验收，未宣称已迁入。

| 上游提交 | 主题 | 处理决定与边界 |
| --- | --- | --- |
| `eed7b4775` | feat(webui): refine attachment galleries and file cards (#6457) | 延期：附件画廊/卡片重构属于新界面组，需与TPX工作流卡片和文件引用一起验收；本次只修预览可用性。 |
| `470121871` | fix(webui): place permission hover hint below its control (NAN-359) (#6458) | 延期：上游system-theme/阅读设置/权限提示布局依赖新版Appearance组件；保留TPX已修复的离线外观编辑和当前权限控制。 |
| `83b611284` | fix(webui): crossfade theme changes as one page (#6459) | 延期：上游system-theme/阅读设置/权限提示布局依赖新版Appearance组件；保留TPX已修复的离线外观编辑和当前权限控制。 |
| `01a1ef537` | chore(webui): remove live preview badge from reading settings | 延期：上游system-theme/阅读设置/权限提示布局依赖新版Appearance组件；保留TPX已修复的离线外观编辑和当前权限控制。 |
| `9270137d6` | fix(webui): move appearance help to hints and smooth theme preview | 延期：上游system-theme/阅读设置/权限提示布局依赖新版Appearance组件；保留TPX已修复的离线外观编辑和当前权限控制。 |
| `9b3af7b66` | feat(webui): keep delegated work within reach (#6443) | 延期：子任务消息入口/状态展示依赖上游新thread模型；保留TPX现有子任务与多应用工作台，不覆盖显示历史。 |
| `acae3e6a6` | fix(media): accept data URLs that capitalize the base64 token (#6464) | 纳入：分隔符解析 data URL，支持大写 BASE64，避免畸形参数的正则回溯。 |
| `2b7d68611` | chore(webui): remove subtask message status | 延期：子任务消息入口/状态展示依赖上游新thread模型；保留TPX现有子任务与多应用工作台，不覆盖显示历史。 |
| `0bd845607` | fix(webui): keep permission hints outside locked-thread drafts | 延期：上游system-theme/阅读设置/权限提示布局依赖新版Appearance组件；保留TPX已修复的离线外观编辑和当前权限控制。 |
| `0c7dbc6aa` | fix(webui): simplify selected theme indicator | 延期：上游system-theme/阅读设置/权限提示布局依赖新版Appearance组件；保留TPX已修复的离线外观编辑和当前权限控制。 |
| `dfb3843b4` | docs: align runtime references with current behavior | 不覆盖：上游产品/发布/贡献说明不替代TPX科学SOP；本次来源与验证统一记在本审计和VENDORED。 |
| `323001396` | fix(webui): match slash command highlighting to skills | 延期：命令高亮样式需对齐TPX command catalog 与 tpxform 语法，未调整现有命令解析。 |
| `f23a6d148` | refactor: remove verified unused internals (#6460) | 延期：上游“未使用”结论不能用于TPX定制调用图；保留工具、通道和科学卡片依赖的现有内部入口。 |
| `7e5dcb79e` | feat(webui): complete bang commands and literal output (NAN-291) (#6173) | 延期：bang命令包含shell执行和literal输出合同，须另外验证TPX审批、取消及冻结计划边界，不能当作界面补丁导入。 |
| `23c4acc21` | fix(webui): keep subtask details reachable in long results | 延期：子任务消息入口/状态展示依赖上游新thread模型；保留TPX现有子任务与多应用工作台，不覆盖显示历史。 |
| `d1451e30e` | feat(webui): add compact batch archive actions | 延期：批量归档需验证TPX会话关联实验/工作台恢复，避免以通用批处理改变项目状态。 |
| `69d2fd87b` | fix(webui): check explicit file links before enabling previews (#6483) | 纳入：显式 Markdown 文件链接和推断路径使用同一个预览可用性检查，失败或未完成时不可点开。 |
| `8857d4f9c` | feat(webui): unify mention candidate display | 延期：统一mention展示涉及catalog、MCP和应用引用，保留TPX当前应用/工作流入口。 |
| `960bfa9a8` | test(webui): trim redundant browser coverage | 不机械删除：只保留本次真实行为回归，TPX现有浏览器测试覆盖独立工作台与外观合同。 |
| `164ddadd8` | fix(webui): align chat links with edit filename colors (#6484) | 延期：文件链接色彩是UI样式组，本次维持TPX主题并修复可用性语义。 |
| `4cd277f65` | fix(webui): simplify retry status copy | 延期：重试提示文案联动各语言资源，本次先同步重试执行合同，不宣称新增上游恢复UI。 |
| `40ee25f88` | fix(webui): show context and reasoning for all presets | 延期：模型预设设置布局需按TPX当前settings结构改造，不影响本次provider重试合同。 |
| `0978ccd50` | fix(webui): open subtask details from task content | 延期：子任务消息入口/状态展示依赖上游新thread模型；保留TPX现有子任务与多应用工作台，不覆盖显示历史。 |
| `c4dac649d` | fix(utils): preserve exact newlines in atomic text writes (#6475) | 纳入：现有 helpers.atomic_write_text 使用 newline=""，按输入保留 UTF-8 换行字节。 |
| `8aa0deaca` | fix(webui): stabilize interaction tests and tooltip dismissal | 延期：上游tooltip与交互测试对应新版界面结构；本次新增路径预览和代码换行实测。 |
| `b6536bfc5` | fix(webui): remove ellipses from sending labels | 延期：发送提示文案属于界面翻译组，保留现有TPX翻译资源。 |
| `219c8bb2b` | fix(agent): preserve streamed replies after model failures (#6494) | 纳入运行时部分：provider 不把错误文本当正文 delta；runner 在终止错误时保留去除推理后的真实流段，下一请求携带已输出答复且不重放完成工具；reply_preserved 事件/恢复UI联动暂缓，保留TPX现有显示历史合同。 |
| `e981e97f1` | fix(webui): keep numbered code tokens in one wrapping flow | 纳入：编号代码的多个高亮token共享一个换行容器，保留 ViewportCodeRows 优先级和完整复制内容。 |
| `02c364428` | fix(webui): keep Dock taps working after touch drags | 延期：Dock触摸拖动基于上游当前交互状态机，TPX多应用工作台需要另做拖动/点击验收。 |
| `aacc78008` | docs: clarify contribution policy and issue author credit | 不覆盖：上游产品/发布/贡献说明不替代TPX科学SOP；本次来源与验证统一记在本审计和VENDORED。 |
| `927eba89e` | fix(websocket): abort disconnected HTTP handshakes before sending (#6348) | 纳入：同步 process_response 阻断已断开连接的 HTTP 握手，保留 TCP/Unix listener 可用。 |
| `b07b3eac2` | fix(webui): retain history touch gestures across message replacement | 延期：历史触摸手势依赖上游thread滚动/弹簧状态重构，TPX当前ThreadShell和工作台滚动所有权不同。 |
| `c758ce8f4` | fix(runtime): stop Windows identity polling memory leak | 纳入：缓存 Windows FILETIME 类型与 kernel32 签名，保留每次实时查询和 CloseHandle。 |
| `32ee2810a` | chore(skills): remove obsolete update-setup skill | 保留已有定制：TPX update-setup 已改为本仓源码升级指导，禁止通用nanobot包覆盖、自动计时升级和越仓配置，非上游已废弃安装向导，不能删除。 |
| `f93e92618` | chore(release): prepare 0.4.0 | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `4574a9b85` | fix(release): support zero-patch candidates in upgrade acceptance | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `19c18aaaf` | fix(release): verify final candidates and refresh SVG parser | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `b2dd9053a` | test: seed disposable environments on Homebrew Python | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `428b5fb61` | chore(release): refresh PDF image and Git runtime dependencies | 延期：Pillow 13、pypdf 6、dulwich 1 是大版本升级，TPX仍声明Pillow<13/pypdf<6/dulwich<1；需独立验证PDF/图像/文档及Git更新工具，不能凭Agent回归放宽依赖。 |
| `30c66c171` | test(release): make native macOS acceptance reproducible | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `897c8b013` | ci(release): verify exact candidate wheels on all five native targets | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `89d35863d` | fix(webui): reinstall locked dependencies when rebuilding source upgrades | 延期：托管源码更新重建逻辑不在TPX启用路径；TPX source-update skill已要求npm ci与构建，未启用上游自动更新器。 |
| `91972b0e4` | fix(release): preserve candidate source across artifact transport | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `656f124fe` | test(release): resolve real historical baseline dependencies | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `2cfb2b6d2` | test(release): verify retained-volume upgrades from the real Docker release | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `8ee81cc78` | test(release): exercise exact native terminal packages across platforms | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `e9532d410` | test(release): preserve PTY exit output and await durable admission | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `d6ca89908` | fix(tui): identify unavailable native font faces | 不适用当前实现：TPX没有上游native Mermaid字体路径，保留现有TUI，不伪造相应字体回退支持。 |
| `4a6ed1a67` | test: await busy-session batch completion instead of polling | 延期：此提交仅改上游忙会话批处理测试同步，TPX本次用现有科学隔离及准入回归验证。 |
| `3f5ca7e89` | fix(tui): resolve readable macOS CJK fonts for native diagrams | 不适用当前实现：TPX没有该native Mermaid排版管线；CJK字体适配须随TUI图形渲染整体引入验证。 |
| `76cb13c8c` | test(release): provision CJK fonts for native Linux acceptance | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `2165173e1` | test(release): cover Windows polling on Python 3.12 | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `8268910a4` | ci: bound Windows persistence test contention | 不整体迁入：上游0.4.0 wheel/原生TUI/托管升级与平台验收脚本不代表TPX 0.9.0发行；本次单独验证已适配runtime，Windows原生测试保留但本机跳过。 |
| `18ffa6555` | docs: reconcile 0.4.0 with obsolete upgrade wizard removal | 不覆盖：上游产品/发布/贡献说明不替代TPX科学SOP；本次来源与验证统一记在本审计和VENDORED。 |
| `8f7a7d175` | fix(build): fetch locked WebUI packages from npm registry | 延期：上游发布构建指定npm registry，TPX未启用相同托管构建发行流程，保留其锁文件与私有源更新策略。 |
| `4a14faa47` | fix(webui): keep saved topics bound to their project (#6509) | 纳入：SessionState 写事务内验证已保存目录，scope锁序列化草稿编辑/消息准入；服务端和客户端均锁定空历史的已有会话，同目录权限调整继续受可信来源限制。 |
| `2a3d29ce7` | refactor(webui): centralize outbound delivery (NAN-365) | 延期：集中出站delivery涉及WebSocket投影、独立显示历史和持久化迁移，不能覆盖TPX会话/科学工作台同步。 |
| `55210eb9f` | docs: refresh README news and WebUI gallery | 不覆盖：上游产品/发布/贡献说明不替代TPX科学SOP；本次来源与验证统一记在本审计和VENDORED。 |
| `b1cc89e92` | feat(matrix): add "listen" group policy (observe room, reply on mention) (#6289) | 延期：Matrix listen组策略属于可选通道配置/翻译整组功能，未以实验Agent升级改变消息响应范围。 |
| `acc3750c2` | refactor(channels): move tool hint rendering out of core (#6498) | 延期：工具提示渲染所有权迁移影响多个通道及TPX工作流工具展示，需全通道交互回归后整组适配。 |
| `b6d9009bb` | refactor(sessions): discover target handles through search (#6315) | 延期：会话工具以search替换list涉及现有skills/用户提示合同；保留当前工具参数和句柄接口。 |
| `4e77d9c3f` | fix(retry): prevent replay amplification and isolate backoff (NAN-313) | 纳入：MCP 请求重试与渲染/重连错误隔离；provider 抖动退避及单次图片兼容修复；ASR 退避前关闭流；Bedrock 禁用SDK叠加重试；通道退避释放许可，Telegram 不整段重发已发送前缀。 |
| `c5cee9f20` | feat(matrix): make non-threaded reply quoting optional | 延期：Matrix非线程引用开关属于同一可选通道策略组，需配置兼容及真实通道验证。 |
| `8a989d5ad` | feat(matrix): per-room group policy overrides (groupPolicyOverrides) (#6287) | 延期：Matrix逐房间覆盖涉及新增配置授权语义，保留现有通道配置，不推测用户响应策略。 |
| `2853287ed` | perf(gateway): avoid unchanged client lease writes | 纳入：lease snapshot 只读；monitor 仅在客户记录变化时持久化，保留最后客户退出的原子停机判断。 |
| `1c28b20c7` | fix(gateway): reuse Windows-safe atomic lease I/O | 纳入：局部引入标准库 atomic_file 快照读取与 Windows 原子替换，用于 lease I/O，不迁移会话数据库。 |
| `cb3ba4531` | refactor: remove legacy history and proxy migrations (#6518) | 延期：删除旧历史/代理迁移只在上游新存储/集中代理已落地时安全，TPX此前明确保留旧数据和代理兼容。 |

## 验证

验证在macOS、TPX本地Python 3.13环境执行，测试均使用临时目录、离线模型/传输替身；真实TCP/Unix listener仅绑定临时本机地址。未调用真实模型、仪器、远程MCP、Telegram、Bedrock或OSS服务。可选Telegram/Bedrock SDK仅安装到TPX `.venv` 以运行mock回归，不更改依赖声明或用户配置。

- 运行时升级与完整WebSocket单测：669通过、1跳过（`.venv/bin/python -m pytest tests/runtime_upgrade tpxtpxtpx/channels/websocket/tests/test_websocket_channel.py -q`）。唯一跳过为Windows原生进程身份轮询测试，本机未实测Windows内核路径。
- 前端相关Vitest：359通过，覆盖 `thread-shell`、`api`、`markdown-text-renderer`、`useSessions`、`code-block`；包括空历史项目锁定、明确草稿选目录、文件链接可用性/API映射及完整大代码块复制。
- Playwright真实Chromium：3通过，文件预览1280×800及390×844、流式编号代码1280/390宽度换行与完整复制；使用现有Playwright与本机缓存Chromium。校验页面身份、非空内容、无错误覆盖层、控制台、等待/失败引用不可打开、成功引用可打开。已检查窄屏截图，代码CJK/token连续流动且容器无横向溢出；截图在仓库外 `/tmp/tpx-upstream-browser-final-20261029`。
- 基线确认：原HEAD的WebSocket测试有3个断言允许不可信来源开启full access，与当前TPX权限策略冲突。通过在独立pytest进程载入 `git show HEAD:` 的原模块复现3失败/1通过，未改源文件验证基线；本次修正断言保留现有可信来源限制，没有放宽产品权限。
- 科学/Ea/隔离回归最终完整运行：966通过（92.12秒）。命令为 `.venv/bin/python -m pytest tests/science tests/ea tests/test_tpx_gateway.py tests/test_tpx_workflow_access.py tests/test_app_skill_access.py tests/test_oauth_instance_isolation.py tests/test_workbench_apps.py tests/test_workbench_interactions.py tests/test_oss_file_tools.py tests/test_oss_search_privacy.py -q`；覆盖四类基线、全量科学链、冻结host计划、应用访问、OAuth及OSS边界。此前与前端构建并发的一次运行有965通过、1个科学子进程30秒超时；该项独立复测通过，最终整组也通过，没有修改科学实现或超时值。
- `npm run build`（TypeScript + Vite）、修改文件ESLint、`tsc -p tsconfig.browser.json --noEmit`、修改Python文件与runtime_upgrade测试Ruff、`git diff --check` 均通过。构建保留现有大chunk提示，未更改依赖锁或打包分块策略。
- 来源核对脚本验证逐提交表恰好覆盖67个官方SHA，无遗漏或重复；差异检查确认 `tpx/`、`tpxtpx/`、`apps/`、`labcode/` 无改动。

软件回归成功是实现合同证据，不代表任何真实实验拟合或物理假设获得科学接受。
