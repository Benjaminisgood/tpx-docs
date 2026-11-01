# TPX 对齐 TAP 通用架构，2026-11-01

## 来源和范围

参考 TAP `3cc5386071f01c7e9c4306c74ac38074b1f07954` 中的工作台权限、草稿兼容与 HTML 桥接实现。TPX 本轮基于 `fcbef84` 后的 cursor 继续适配，保留并行完成的桌面客户端和文档部署改动。只迁入 TAP 自定义通用能力，没有重新合入 HKUDS/nanobot 或 Benjaminisgood/nanobot，因此不改变 VENDORED.md 的 nanobot pin 与 2026-10-29 上游审计。

## 本次纳入

- 设置 → 工作提供当前 TPX 实例全局的逐次确认/自主执行，默认逐次确认。授权带版本，持久化到 TPX 自己的工作台数据库；冲突、撤销、旧队列及重启恢复都在服务端检查。
- Agent 页面动作在应用旁显示当前参数和待执行草稿，用户批准或拒绝。客户端领取动作时再次检查权限和输入指纹，双客户端不能重复领取。运行中的动作仍由应用取消，不把撤销解释为已停止。
- 原生科学运行保持 TPX frozen-plan 检查与明确确认；工作台授权不会绕过 CLI/control 和输入指纹检查。
- 工作台 schema 新增字段时只初始化新字段，保留已有保存值，包括空字符串和 false；兼容失败拒绝更新，不重置草稿。
- HTML 应用通过独立 MessagePort 接收主题、语言和 fallbackLanguage。切换外观/语言不重载 iframe，不丢失草稿。保留 TPX 原有 scope 身份和注册参数验证，比直接复制 TAP 文件更严格。
- 工作台文字以独立 namespace 懒加载，保留 TPX 浏览器存储命名空间及科学应用入口。
- 空闲 UI 编辑、权限事件与重启恢复不会单独启动模型；下一次用户对话读取可见应用草稿，活动对话保留原有事件更新。
- 适配 TAP `storage/local.py` 的系统挂载发现，保留 TPX 自己的文件边界；统一工作区、挂载和 OSS 位置，独立浏览目的地，拒绝只读写入和同名覆盖。
- 科学产物可定位到文件应用，定位请求只消费一次并在传输完成后处理。本地完整复制和原有 OSS 传输仍需用户操作。
- 新增 TPX 专用产物绑定：已成功运行的单文件/文件列表产物作为 catalog 参数，准备与启动均验证同项目、来源回执、数量和 SHA-256；来源写入冻结计划和运行回执。未复制 TAP 的科学命令或可视化 DAG 执行器。

## 保留的领域合同

`tpx` 的科学算法、`tpxtpx` 的 catalog/control、`tpxtpxtpx/apps/workflow` 的冻结计划和 Calculate Ea 不由 TAP 算法替代。原始采样点、不同校正步骤、结果独立目录与人工科学验收保留。TAP 仪器、端口、账号、工作区和凭据不进入 TPX。

## 验证

工作台后端回归覆盖授权、撤销、重启、跨 scope、双客户端、schema 升级、原有应用/布局/Agent 行为。前端覆盖工作设置、逐次批准、HTML nonce/scope/注册验证、主题/语言切换、原有工作台和多语言资源。生产构建执行 TypeScript 与 Vite 检查。

- P1 后端：`tests/test_workbench_permissions.py tests/test_workbench_interactions.py tests/test_workbench_layout.py tests/test_workbench_agent.py tests/test_workbench_apps.py` 共 63 项通过。
- P2/P3 后端：`tests/test_storage_service.py tests/test_tpx_storage_routes.py tests/science/test_workflow_dataflow.py` 共 57 项通过。
- 前端合并回归：Work 设置、审批、HTML 桥接、工作台、i18n、存储、科学工作流和目标目录选择器共 8 个测试文件、79 项通过。
- Ruff、TypeScript no-emit 检查与 Vite 生产构建通过。
- 原有 `tests/science/test_workflow_service.py -k chain` 的完整冻结计划科学链通过（1 项，13 项未选择）。首轮在 Matplotlib 首次生成字体缓存时超过单步 30 秒等待；随后通过临时 pytest fixture 在测试计时前初始化同一临时目录的字体缓存。原测试、30 秒单步超时和全部科学/来源断言未修改，通过用时 63.95 秒。字体预热不改变科学参数或结果。

这些测试留在 TPX 仓库，作为后续对齐的合同保护，不读取 TAP 工作区或跨仓运行配置。真实 NAS/OSS 服务器与真实实验没有在本轮操作。

## 并发复查修复

工作台状态事件和布局事件在等待 scope 检查时，活动对话可能已经结束或换成新的队列。事件现在捕获原队列身份，在 await 后复核并直接写入同一个仍在活动的队列，不经过可能创建模型任务的通用入队方法。新增 4 项回归覆盖两类事件在等待期间队列消失或被替换，确保不会启动或进入另一轮对话。
