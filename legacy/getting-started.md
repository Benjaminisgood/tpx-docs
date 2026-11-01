# 第一次检查 TPD 实验：从原始文件到只读概况

这页只完成一个目标：建立一份 schema 4 实验配置，并确认它引用的 RGA 与温控原始文件能够被当前版本读取。它不会拟合温程、扣除真空本底、校正碎片、定量、积分或自动选择下一步。

## 准备两份原始文件

从 TPX 仓库根目录安装当前 Python 包；`tpx/`、`tpxtpx/` 和 `tpxtpxtpx/` 均位于该目录。
项目要求 Python 3.11 或更高版本；浏览器启动与 Node.js 构建步骤见[项目总览](../README.md)：

```bash
python3 --version
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .

python -m pip show tpxtpxtpx
tpdtpd --version
tpdtpd --list --plain
```

前四条分别检查 Python 版本、创建虚拟环境、激活环境，并以 editable 方式安装当前 checkout；这种安装
适合继续开发这份源码。只运行已固定的
checkout 时也可以用 `python -m pip install .`。`pip show` 的 Location（editable 安装还会显示
Editable project location）应指向预期环境/源码；若 `tpdtpd` 找不到，先确认虚拟环境已激活，
再用 `python -m pip show tpxtpxtpx` 检查是否装进了同一个 Python，不要只凭版本号判断运行的是哪份代码。

一个实验至少需要：

- HAL RGA CSV：必须有大小写精确的 `Date` / `Time` 采集元数据，数据表头以大小写精确的
  `Time`、`ms` 开始，并至少含一个可识别质量通道。只有质量列名识别大小写不敏感：它可以包含
  `mass <数值>`（例如 `Current - Mass 28` 或真实 HAL 文件中的 `Scan 1 : mass 28.00`），
  也可以使用 `<AMU>_amu`。`ms` 是仪器经过时间，单位为毫秒；质量通道是离子电流，单位为 A。
  读取后，通道按表头中的真实 AMU 识别为 `m{AMU}_raw`，不按列位置猜测。
- 四列、无表头的温控日志：以制表符分隔的 `clock`、`elapsed_s`、`temperature_set`、
  `temperature_real`。`clock` 必须是带 AM/PM 的 12 小时制 `HH:MM:SS AM/PM`；经过时间单位为 s，
  设定温度和实测温度单位为 °C。

最小形状如下；数值只是格式示意，不是实验默认值：

```csv
Date,08/04/2026,Time,04:00:00 PM
Time,ms,Current - Mass 28,Current - Mass 40
00:00:00,0,1.2e-10,8.0e-10
```

```text
04:00:00 PM\t0\t-190.0\t-189.8
04:00:01 PM\t1\t-190.0\t-189.7
```

第二段中的 `\t` 表示真实 tab 字符，不是文件里的反斜杠和字母 `t`。

把相对路径写入配置时，它们以 `experiment.toml` 所在目录为基准，而不是以后运行命令时的工作目录。下面假设目录结构是：

```text
my-experiment/
├── experiment.toml
└── raw/
    ├── rga.csv
    └── temperature.txt
```

## 1. 创建 schema 4 配置

在 `my-experiment/` 中运行：

```bash
tpdtpd init experiment.toml \
  --name "样品编号与实验日期" \
  --rga-csv raw/rga.csv \
  --temperature-log raw/temperature.txt
```

只有确有测量记录时才增加样品属性：

```bash
tpdtpd init experiment.toml \
  --name "样品编号与实验日期" \
  --rga-csv raw/rga.csv \
  --temperature-log raw/temperature.txt \
  --mass-mg 35 \
  --bet-m2-g 596
```

`mass-mg` 是本次称量的样品质量，单位 mg；`bet-m2-g` 是独立测得的 BET 比表面积，单位 m² g⁻¹。未知时应省略，配置会保留缺失状态，不应写成 `0`。

`init` 只创建配置，不读取两份原始文件，也不猜测 CO、NH₃ 等目标物种。它会拒绝覆盖已有 TOML；`--force` 是明确覆盖配置的选项，不会覆盖原始数据。fresh reference 标为 `inherited-unreviewed`，后续通过 `reference show/set/accept` 审核；vacuum 从当前 AMU→常数电流初值开始，但也支持按 AMU 保存 raw-bound 纯指数。新的 `vacuum show` 需要显式 HAL CSV、无默认值的 `--baseline-model constant|exponential` 和每个 AMU 各自的 `--signal-window`，只生成模型、审核 JSON/图片而不改 TOML；人工检查后用 `vacuum set --current AMU:A` 写常数，或用互斥的 `vacuum set --review-record JSON` 校验来源并接受整份记录，再由 `vacuum subtract` 消费。共享窗口直接替换整张真空电流表的旧入口已经删除。默认 fragmentation 是 2/18/28/40/44 五通道中性单位阵，其物种标签是中性的 `m2/m18/m28/m40/m44`，不会自动把 m/z 28、40 认定为 CO、Ar；未测 m/z 14 保持缺失，不写成 `0 A`。MS 通道只保存 AMU 和标签，物种响应因子只会由后续 reviewed calibration 创建。

## 2. 检查配置和原始数据

先执行最小的真实数据检查：

```bash
tpdtpd config inspect experiment.toml
```

如果下一步明确需要某些质量通道，可以在这里把约束写出来；`--require-mass` 可重复：

```bash
tpdtpd config inspect experiment.toml \
  --require-mass 28 \
  --require-mass 40
```

时钟与 `elapsed_s` 的分段容差默认是 `1 s`；通常无需填写。只有已复核的仪器日志特征要求
另一阈值时，才显式覆盖 `--clock-elapsed-tolerance-s`。命令会检查 schema、文件格式、时间单调性
和要求的 AMU；它不会证明通道指认、本底、碎片矩阵或实验选区已经正确。

成功时默认输出包含配置事实与两份数据概况的人类报告。脚本消费时必须显式请求 JSON：

```bash
tpdtpd config inspect experiment.toml --json
```

## 3. 人工复核只读实验概况

成功的 `config inspect` 已经同时完成严格读取和概况汇总，无需再运行另一条检查命令。
接下来复核同一份报告：

重点人工检查：

- 实验名称与方法是否属于这一次 TPD；
- 样品质量和 BET 是真实值还是 `null`；
- 内标气种类、m/z、流量和标准状态是否符合实验记录；
- RGA 实际测得的 AMU 列表是否包含后续需要的通道；
- RGA 起始时间、时长、点数与温控日志的点数和温度范围是否合理；
- 当前校准、真空电流和碎片矩阵是否符合本次实验。

`config inspect` 会先严格加载 schema 4 配置，再各读取一次 RGA CSV 和温控日志；它只读，
不写 TOML 或阶段产物。`--clock-elapsed-tolerance-s` 默认是 `1 s`，只有需要覆盖温控时钟/elapsed
重建阈值时才传入。没有 `--require-mass` 时只是不施加额外通道约束；实际测得的 AMU 仍会列在概况中。

默认报告和 `--json` 是两种显式接口，不根据是否重定向 stdout 自动切换。

如果下一步要重新审核真空模型，不应把 `vacuum show` 当成读取 TOML 当前值的别名。应从完整标气
HAL RGA CSV 明确选择模型和窗口。常数模型每个 AMU 恰好一个窗口：

```bash
tpdtpd vacuum show experiment.toml \
  --input raw/rga.csv \
  --baseline-model constant \
  --signal-window 28 24.0 25.5 \
  --signal-window 40 26.0 27.5 \
  --estimator median
```

默认生成 `records/vacuum_baseline_review.json` 和输入旁的 `vacuum_baseline_review.png`，TOML
保持不变。指数模型则把同一 AMU 的首窗、尾窗按顺序各传一次，要求严格分离、`I1 > I2 > 0`，
并拟合最终趋近 0 的纯指数。检查完整信号、各自窗口、模型和扣除后曲线后，再运行一个或多个
`vacuum set --current AMU:A`，或用 `vacuum set --review-record records/vacuum_baseline_review.json`
接受完整记录。两种 set 入口互斥；设置某 AMU 会替换该 AMU 的旧模型，未点名 AMU 保持不变。

## 常见错误怎么判断

| 现象 | 当前含义 | 处理 |
|---|---|---|
| `Unsupported schema_version ...; expected 4.` | 输入不是当前 schema 4 配置 | 不要把旧 schema 当成当前接口；按原始实验记录重新建立或明确转换 |
| `RGA CSV does not exist` / `Temperature log does not exist` | TOML 中的路径解析后不存在 | 从 `experiment.toml` 所在目录检查相对路径和文件名 |
| `Cannot find Date/Time metadata or data header` | RGA 文件不符合当前 HAL CSV 读取契约 | 检查 `Date`/`Time` 元数据以及以 `Time`、`ms` 开始的数据表头；质量列需含 `mass <数值>` 或 `<AMU>_amu` |
| `RGA time is not monotonic` | `ms` 时间列发生倒退 | 回到原始采集文件判断拼接、重启或导出问题，不要静默排序 |
| `--require-mass values must be positive integers` | 某个必需 AMU 不是正整数 | 修正显式约束；不要用 0 或负数表达缺失通道 |
| `Required AMU channel(s) are missing from RGA data` | `--require-mass` 指定的通道未在 RGA 表头中测得 | 核对实验采集设置；缺失通道不能写成 `0 A` |
| 退出码 `2` 且错误写到 stderr | 配置、参数或数据读取失败 | 修正输入后重跑；不要把失败时的空 stdout 当成有效结果 |

完成创建、检查和人工复核后，再由研究者根据概况选择下一条独立命令。可返回[项目总览](../README.md)或
[文档站首页](index.html)，继续阅读[完整 CLI 参考](cli.md)、[逐步科研流程](scientific-workflow.md)、
[架构与数据边界](architecture.md)和[真实 CLI/XLSX 对照案例](co-tpd-2wxq-example.html)。
