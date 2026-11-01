# TPX 工作台应用

工作台与聊天并排，使用聊天右上角“添加窗格”旁的侧栏图标显示或隐藏工作区。左侧导航不再单独放置“工作台”按钮。“应用”继续管理 Agent 的 CLI、MCP 和插件。实验处理、活化能 Ea、文件与 OSS 都是独立工作台应用；它们共用当前聊天项目，没有第二个可编辑项目路径。每个会话、规范项目路径与访问模式分别保存逻辑标签和协作草稿。隐藏侧栏保留标签及协作状态，未保存内容触发离页保护。

## 发现与前端合同

`tpxtpxtpx/apps/workbench.py` 定义独立 registry，`GET /api/workbench/apps?workspace=...` 返回服务器解析的 `workspace` 和 `agent-app.v1` 应用描述。聊天服务确定规范项目路径，标签、组件注册和操作都核对该会话的当前范围。发现不加载科学 catalog 或执行引擎。

| id / frontend.entry | 名称 | 科学或存储接口 |
| --- | --- | --- |
| `workflow` | 实验处理 | 原 TPX catalog → describe → prepare → 审阅冻结计划 → run → status/logs/artifacts |
| `calculate-ea` | 活化能 Ea | 原 TPX Ea service；保留 SHA256 输入核对、审阅窗口与全部数据点 |
| `storage` | 文件与 OSS | `/api/storage/*` 及认证 WebSocket `storage.call` |

内置 renderer 位于 `webui/src/components/tpx/apps/`，由 `workbench/AppRenderer.tsx` 根据 `frontend` 选择。通用交互合同与 TAP、TAK 对齐；本仓 `WorkbenchAppProps` 字段为：`workspace`、`sessionKey`、`restricted`、`active`、`input`、`onAttach`、`onOpenApp`、`onDirtyChange`、`hasUnsavedChanges`、`revision`、`onFilesChanged`、可选 `onSelectWorkspace`。三个仓库保存独立实现，不互相 import 或共享凭据。

`onAttach` 仅加入聊天草稿。检出 OSS 工作副本后，用户点击“设为聊天项目”才调用 `onSelectWorkspace`，通过聊天既有项目权限和忙碌状态处理。文件浏览路径可以在本地或 OSS 中导航，浏览不会更改聊天项目。原 `/api/tpx/storage/*`、`tpx.storage.call` 保留为兼容入口。

页面内部通过 `openWorkbenchApp("storage")` 打开应用，传递一次性请求，不改变当前聊天与项目。不要构造未支持的 `#/workbench` 路径。

## 自带 HTML 的插件

插件安装在 TPX 默认安装工作区的 `plugins/<name>/`，不是任意聊天子项目的 plugins。`plugin.json` 使用 Agent Plugin schema，并声明统一扩展：

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "research-note",
  "description": "当前项目的研究笔记",
  "extensions": {
    "dev.nanobot": {
      "displayName": "研究笔记",
      "frontend": {"kind": "html", "entry": "./frontend/index.html"}
    }
  }
}
```

在“应用”中启用后，工作台显示 `plugin:research-note`。`GET /api/workbench/apps/plugin%3Aresearch-note/document?workspace=...` 每次重新验证启用状态与整个包的 fingerprint，返回同一次校验读取的 HTML。改动包内容会撤销旧授权，须重新启用。

HTML 为 UTF-8，最多 4 MiB；入口必须是包内 `./...html`，不接受 `..`、绝对路径、反斜线或符号链接。文档自包含，资源采用内联或 data URL。容器使用 `sandbox="allow-scripts"` 与 CSP，禁止父页面、认证 token、同源存储与 fetch/XHR/WebSocket。CSP 不是完整的导航网络隔离，插件不应导航到外部页面。

注入 helper `window.tpxWorkbench.send(type, values)` 自动完成 nonce 与 MessagePort 双重握手。应用通过 `message` 监听 `channel: "tpx.workbench.v1"`、`type: "context"` 获取 `{workspace, active, appId}`，并可调用：

```js
window.tpxWorkbench.send("dirty", {dirty: true});
window.tpxWorkbench.send("attach", {text: "请审阅这些结果"});
```

仅已验证且当前可见的应用能提交草稿或 dirty 状态。不接受任意路径、RPC 或命令，也不向 HTML 暴露 `onSelectWorkspace`。科学计算继续由 TPX 已授权服务与明确用户动作完成；技术成功不等于科学接受。


## 自动 Agent 模式与共享草稿

没有打开的逻辑标签时为 `general`；打开任意工作台应用标签后为 `workbench`。两种模式使用同一对话和完整通用工具集，不生成第二个聊天，也没有手动模式选择器。隐藏侧栏、返回应用列表或切换焦点不会退出协作，关闭最后一个标签才恢复通用模式。关闭标签不会取消既有科学任务。

标签由 Agent 所有的 `WorkbenchRuntime` 保存在 TPX 会话数据目录 `.workbench/workbench.sqlite3`。HTTP 与 Agent 工具使用同一个实例。布局变更使用版本 CAS 和幂等请求 ID；浏览器重连读取服务器布局，发送聊天前等待排队的布局变更完成。组件状态、动作请求、恢复事件也写入此数据库，身份包括会话、规范项目路径和访问模式。

实验处理应用提供两个结构化组件：命令/配置选择器，以及按表单上下文摘要区分的参数草稿。用户和 Agent 修改同一版本化草稿，冲突保留本地编辑并要求重新读取。Agent 可使用 `workbench_interaction` 的 `catalog/open/list/get/patch/invoke`，但只可写组件声明的字段并调用声明的动作。实验表单只公开 `prepare`；准备冻结计划后，实际 `run` 仍需人点击确认。参数变化使旧计划失效。原始采样点、科学 CLI 和处理实现未改变。

当前 Ea 插件与文件应用保留各自原有服务合同；有逻辑标签不表示它们自动获得全部结构化编辑能力。Agent 根据已注册组件能力操作，不能假称修改没有适配的页面。

用户修改和动作结果以原生系统事件进入 Agent，每轮及工具边界使用当前状态快照，历史只保存事件身份，不把旧草稿当作新授权。来自旧项目或旧访问模式的事件不会进入当前对话轮次；切换焦点不唤醒空闲模型。Agent 自身的草稿写入不循环唤醒自身。断线动作保持等待客户端；已领取但未确认完成的动作在重启后标为中断，不会自动重跑。

## HTML 组件协作协议

已适配 HTML 可以通过 `window.tpxWorkbench.registerComponent(component)` 声明 `id`、`title`、`state`、`state_schema`、`writable_fields`、`actions`，通过 `patchComponent(componentId, patch)` 发布用户编辑。主机发送 `component_state` 和 `component_action`，应用完成后调用 `resolveAction(requestId, result, error)`。状态写入需当前版本，动作只能被一个客户端领取。未注册组件的 HTML 只保持普通展示能力。

MessagePort 绑定实际 iframe 和 nonce。项目、会话或访问模式改变后重新握手，旧页面不能继续写入新范围。HTML 不持有认证凭据，不能借通用动作绕过 TPX 的冻结计划和人工运行确认。

## 实现来源与验证

本次于 2026-10-26 选择性适配 TAP 自定义工作台合同，参考提交为 `020066703bdeccb6bc7a82ed7f7086e6421db18b`，不是新一轮 nanobot 上游合入，原 nanobot pin 保持不变。TPX 保存独立 runtime、配置、数据库、工作区与端口，没有跨仓 import；未迁入 TAP 的 DAG、command-operation 或科学工具。

验证包括逻辑标签 CAS/恢复、组件 schema/范围/动作领取、Agent 模式切换与原生事件、浏览器布局与发送边界，以及实验表单冻结计划回归。具体执行结果随本次提交说明记录；自动测试不代表科学结果已获接受。
