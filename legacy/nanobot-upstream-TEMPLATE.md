# TPX 上游同步记录：YYYY-MM-DD

与 TAK/TAP 同结构模板。复制本文件为 `nanobot-upstream-YYYY-MM-DD.md`，填实后再改 [VENDORED.md](../VENDORED.md) 的 pin 摘要与指向。TPX 仍是独立的 `tpxtpxtpx` 应用；本次不是用上游目录覆盖 TPX，也不表示与官方全部功能相同。

## 来源和范围

- TPX 同步前：`<full SHA>`，`main` 与 `origin/main` 是否一致。
- 原始导入记录：Benjaminisgood/nanobot `7f2377cb23e899cfc4d36efc3f1e4cfdbe5d2146`（2026-10-22），见 [VENDORED.md](../VENDORED.md) 与 [nanobot-migration.md](nanobot-migration.md)。此前已合入、仍保留的修复在「已存在并保留」列出。
- 本次官方参考：[HKUDS/nanobot `<reviewed tip SHA>`](https://github.com/HKUDS/nanobot/tree/<SHA>)。写明审查区间及同日追加提交。
- 本地 / fork nanobot 对照提交（如有）：`<SHA>`。TPX 仍按自身合同选择性适配。
- 只改通用 Agent 层、依赖下限、浏览器本地设置、回归测试和同步说明；`tpx/`、`tpxtpx/`、冻结计划、基线区分与实验数据边界保持各自所有权。

## 本次纳入

| 上游提交 | TPX 中的行为变化 |
| --- | --- |
| `<short SHA>` | <一句话行为变化与边界> |

上述修改使用 TPX 命名空间和现有入口。没有将另一项目的凭据、工作区、科学配置或端口带入 TPX。

## 已存在并保留的修复

| 上游提交 | 当前源码检查 |
| --- | --- |
| `<short SHA>` | <为何认定已在树中、本次是否补回归> |

文档或文件读取预算不改变科学计算的数据：本次没有向 TPD/Ea 流程引入抽点、截断或默认平均。

## 暂不整体迁入的部分

| 上游变化组 | 处理理由与后续边界 |
| --- | --- |
| `<commits or theme>` | <为何推迟；不能把「已参考最新版」解释为「已全部合入」> |

## 验证

列出实际跑过的命令、通过数、环境（临时实例 / 离线模型 / 无仪器 / 无真实 OSS）。区分软件合同证据与科学结果验收。

```bash
# 例
.venv/bin/python -m pytest tests -q
```

YYYY-MM-DD：<结果摘要>。修改范围 Ruff / 差异空白 / 前端构建（如有）如实记录；未跑的检查不要写成通过。
