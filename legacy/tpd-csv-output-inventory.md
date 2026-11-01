# TPX TPD CSV 输出合同与默认命名

> 历史核对快照：2026-08-29（Asia/Shanghai）。当时运行时为 `tpdtpd 0.8.0`，manifest protocol `1`，35 个叶命令。
> 下文的“当前”和“完成”均指该次科学输出合同审计，不代表新运行时已重复完成相同实验。
> 当前命令、参数和默认值以 `tpxtpx catalog` / `tpdtpd --manifest-json` 为准；运行入口见[实验助手](experiment-assistant.md)。

## 结论

- 当前 `tpdtpd` 有 **35 个叶命令**，其中只有 **10 个命令动作会写 CSV**。
- 这 10 个动作每次都只写 **1 张 CSV**，不再有一个命令同时写 summary、curve 或 combined 表的情况。
- 由于 `vacuum subtract` 和 `fragmentation correct` 会按校准支路、脱附支路或未知角色选择不同职责名，全部可能出现的默认 CSV basename 是 **14 个**；标准完整流程不会使用两个未知角色 fallback 名。
- 从原始数据重新完成“校准支路 + 脱附支路 + 四步定量 + 归一化”，一个实验的标准流程会写 **11 张 CSV**。
- 若该实验需要 `response_zeroing apply`，再增加 1 张，合计 **12 张 CSV**。
- 同时选择多个 target species 时，四步定量仍各写一张 long-format CSV，**不会按物种增加文件数**。
- 默认不再创建 `preview/`、`final/` 或 `diagnostic/` 子目录。CSV 默认放在其输入旁；需要保存的图片使用对应输入旁的职责名；机器审计 JSON 统一放在 `records/`。
- `vacuum show` 的 `vacuum_baseline_review.png` 与 `records/vacuum_baseline_review.json` 是
  constant/exponential 联合审核工件，不是 CSV，也不修改 experiment TOML。
- 现有历史 CSV 不会被自动重命名、移动或删除；它们只是旧合同留下的文件。

## 统计口径

本文的“CSV 数量”只统计命令新写入磁盘的派生 `.csv`，不统计原始仪器 CSV、experiment TOML、ProcessingRecord、`.tpxmodel`、JSON、PNG/PDF、终端 stdout 或 工作流运行记录。“默认名称”指省略对应输出参数后，CLI 根据 config、输入角色和输入位置解析出的 basename；manifest 中动态输出的 `default: null` 不代表没有运行时默认名。

## 用户要求逐条验收

| 原要求 | 当前实现与落盘位置 | 验收结论 |
| --- | --- | --- |
| 删除 `vacuum_baseline.csv` | `vacuum show` 必选 constant/exponential，按 AMU 独立窗口写 `records/vacuum_baseline_review.json` 与输入旁 `vacuum_baseline_review.png`，保持 TOML 不变；人工复核后由 `vacuum set --current` 写常数，或 `--review-record` 验证 config/raw SHA-256 后接受记录。共享窗口直接替换 TOML 的旧入口已删除 | 完成 |
| 删除 `calibration_preview.csv` | `calibration preview` 把 provisional 状态写入 `[calibration_preview.<species>]`，详细证据默认写 `records/<target>_calibration_preview.json`；可选审核图不是 CSV | 完成 |
| 删除 calibration 单行结果 CSV | `calibration fit` 把 reviewed 结果写入 `[calibration.<species>]`，详细证据默认写 `records/<target>_calibration_fit.json`；不再写 `calibration.csv` | 完成 |
| `response_zeroing apply` 不选 target | apply 的参数只有 config、input、output 和通用 stage 输出开关；它一次应用 TOML 中与当前输入 SHA-256、父 ProcessingRecord 指纹都匹配的全部物种定义，未配置物种原样通过 | 完成 |
| quantify 可在一个输入框选多个 target | 四个 `quantify` 动作的 `--target` 都是 `species_list`；CLI 接受 `CO,NH3` 与 `CO，NH3`，输入时按真实 parser 的物种列表规则填写 | 完成 |
| 删除 `quantify all` 和 combined CSV | 当时 manifest 已不再提供 `quantify.all`；只保留 relative、composition、flow、rate 四步，每步一张 multi-target long-format CSV | 完成 |
| 删除局部扣基线 CSV，并区分 normalize 与 integration | `<target>_baseline_subtracted.csv` writer 已删除；`normalized.csv` 是可复用的逐点尺度换算表，审核基线定义进 `[integration_baseline.<target>]`，面积摘要进 `[peak_integration.<result-id>]`，二者不是同一运算 | 完成 |
| 峰检测不写 summary/curve CSV | `integration peaks` 只把候选摘要写入 `[integration_peaks.<result-id>]`，逐点证据进 `records/<result-id>_peaks.json`，可选输出审核图 | 完成 |
| 积分不写 summary/curve CSV | `integration areas --preview` 只写审核 JSON/图片；正式 `integration areas` 把面积摘要写入 `[peak_integration.<result-id>]`，逐点证据进 `records/<result-id>_areas.json` | 完成 |
| 统一 integration 命名 | 当前命令统一为 `integration baseline preview/accept`、`integration peaks`、`integration areas`；旧 `integration_baseline`、`detect_peaks`、`integrate_peak_areas` 不再注册，其旧 CSV writer 也已从退休模块删除 | 完成 |
| 不默认创建 `preview/`、`final/`、`diagnostic/` | CSV 和需要保存的图片默认在职责输入旁；只有机器审计 JSON 默认进入 `records/`。显式输出路径仍可由研究者指定 | 完成 |

这里的“完成”是软件合同验收：同时核对 live manifest、真实 parser、当时参数呈现、源码 writer 和自动测试。历史 experiment TOML 中的旧 ProcessingRecord 仍保留只读 SHA-256 核验能力；这不会重新暴露旧命令或生成旧 CSV。软件验收也不替代具体实验的科研人工审核。

## 当前两个实验：新合同是 24 张，不是磁盘上的 54 张

两个当前实验都保留了 `response_zeroing.CO` 设置和可核验的 `response_zeroing.apply` 处理记录。因此，如果现在按本文所述的新合同从原始输入完整重跑，两者都会采用“含响应归零”的 12 张流程：

| 实验 | 按新合同重跑的新派生 CSV | 当前磁盘上的历史派生 CSV | 原始采集 CSV | 当前磁盘 CSV 合计 |
| --- | ---: | ---: | ---: | ---: |
| `20260804#2` | **12** | 26 | 1 | 27 |
| `20260804#3` | **12** | 28 | 1 | 29 |
| 两个实验合计 | **24** | **54** | **2** | **56** |

这里的 **24 张**是当前命令合同下两次完整重跑应新生成的派生 CSV 数；不包含两张原始仪器 CSV。每个实验的 12 个默认 basename 依次是：

```text
temperature_fit.csv
aligned.csv
calibration_vacuum.csv
calibration_fragmentation.csv
desorption_vacuum.csv
desorption_fragmentation.csv
response_zeroed.csv
relative.csv
composition.csv
flow.csv
rate.csv
normalized.csv
```

磁盘上的 **54 张历史派生 CSV** 包含旧版合同、替代处理分支和诊断文件，不能反推当前默认输出。本文没有重命名、移动或删除这两个真实实验目录中的任何 CSV/TOML。

本次只读复核中，`20260804#2` 和 `20260804#3` 各有 **11/11** 条 ProcessingRecord 通过文件存在性与 SHA-256 核验，均为 0 missing、0 mismatch；两份 experiment TOML 的复核前后 SHA-256 分别保持为 `a5d1e9d5d01b8e5a83dc3aee8c2b5faf20f9286003873913e11172b7ee7e7c45` 和 `4015f64b0c5b9e8baeac339071a6230e43ce56d7dcee9c7a06232e88b640a1db`。这证明本次清点没有改写真实实验，也证明现存记录可读取；它不等于对旧处理结果作新的科研接受。

## 保留的 10 个 CSV 动作

| 序号 | 命令动作 | 默认名称 | 为什么仍需要 CSV |
| ---: | --- | --- | --- |
| 1 | `temperature fit` | `temperature_fit.csv` | 逐点对照记录温度与拟合温度，供人工检查温程拟合 |
| 2 | `temperature align` | `aligned.csv` | 把每一行 RGA 信号与程序时间、拟合温度对齐，是后续脱附处理的逐点输入 |
| 3 | `vacuum subtract` | 校准支路 `calibration_vacuum.csv`；脱附支路 `desorption_vacuum.csv`；角色未知时 `vacuum.csv` | 逐行保存 `m*_input_a`、实际 `m*_baseline_a` 与 `m*_signal_a`；后续 fragmentation 必须消费它 |
| 4 | `fragmentation correct` | 校准支路 `calibration_fragmentation.csv`；脱附支路 `desorption_fragmentation.csv`；角色未知时 `fragmentation.csv` | 碎片矩阵对每一行信号解混，校准和定量都需要解混后的逐点物种响应 |
| 5 | `response_zeroing apply` | `response_zeroed.csv` | 可选；一次把当前 TOML 中属于该输入的全部物种零点应用到逐点响应 |
| 6 | `quantify relative` | `relative.csv` | 逐点目标/内标相对响应 |
| 7 | `quantify composition` | `composition.csv` | 逐点应用各物种校准因子后的摩尔组成 |
| 8 | `quantify flow` | `flow.csv` | 逐点目标流量 |
| 9 | `quantify rate` | `rate.csv` | 逐点摩尔速率 `response_umol_min` |
| 10 | `normalize` | `normalized.csv` | 保留绝对速率，并逐点增加质量和 BET 归一化响应，供绘图与峰面积分析复用 |

vacuum 的常数/指数模型可以在不同 AMU 混用，同一 AMU 不可重复。指数只接受审核记录所绑定的
exact raw acquisition，或 ProcessingRecord 证明直接同源且时间范围未越界的 `temperature.align`
脱附子表；缺时间列、来源不符或越界都不写 CSV。指数 baseline 不回退、不裁剪负结果。
ProcessingRecord 的 vacuum fingerprint 编码实际应用 AMU 的模型类型、系数、时间坐标和来源 SHA-256，
因此模型变化会使旧 fragmentation/calibration/response-zeroing/quantify/normalize/integration 链失配。

默认 CSV 名只表示“这张表当前负责什么”，不再把物种、峰号、样品质量、BET、版本号或整段处理历史塞进文件名。四步定量和归一化 long 表的物种身份保存在 `target_species` 列；上游 fragmentation 表则用 `{species}_resolved_a` 列名标识物种。处理谱系、输入输出 SHA-256 和科学参数保存在 experiment TOML 的 ProcessingRecord 中。

## 一个完整流程为什么是 11 张或 12 张

从原始数据和当前实验事实重新运行时，CSV 顺序如下：

```text
温程支路
  temperature fit                    → temperature_fit.csv
  temperature align                  → aligned.csv

完整采集校准支路
  vacuum subtract                     → calibration_vacuum.csv
  fragmentation correct              → calibration_fragmentation.csv
  calibration preview / fit          → 不写 CSV；状态进 TOML，证据进 records/

温度对齐脱附支路
  vacuum subtract                     → desorption_vacuum.csv
  fragmentation correct              → desorption_fragmentation.csv
  [response_zeroing apply]            → [response_zeroed.csv]
  quantify relative                   → relative.csv
  quantify composition                → composition.csv
  quantify flow                       → flow.csv
  quantify rate                       → rate.csv
  normalize                           → normalized.csv

峰分析
  integration baseline preview/accept → 不写 CSV
  integration peaks                   → 不写 CSV
  integration areas                   → 不写 CSV
```

因此：

- 不做响应归零：`2 + 2 + 2 + 4 + 1 = 11` 张（温程、校准信号处理、脱附信号处理、四步定量、归一化）；
- 做响应归零：`11 + 1 = 12` 张；
- 若已有仍然有效且已审核的 calibration，不重跑完整采集校准支路，则减去 2 张；
- 多 target species 仍共享四张 long-format 定量表和一张 `normalized.csv`，不按 target 数量相乘。

## 已取消的 CSV 现在放在哪里

| 旧 CSV / 旧命令 | 新合同 | TOML 中的计算状态 | 默认审计记录 |
| --- | --- | --- | --- |
| `vacuum_baseline.csv` | `vacuum show → 人工复核 → vacuum set` | show 不改 TOML；set 以 `--current` 写常数，或从 `--review-record` 写入经来源验证的整组模型；新模型仅替换同 AMU | `records/vacuum_baseline_review.json` + 输入旁 `vacuum_baseline_review.png` |
| `calibration_preview.csv` | `calibration preview` 不再写 CSV | `[calibration_preview.<species>]`，状态为 provisional | `records/<target>_calibration_preview.json` |
| `calibration.csv` | `calibration fit` 不再写 CSV | `[calibration.<species>]`，保存 reviewed calibration | `records/<target>_calibration_fit.json` |
| `<target>_quantified.csv` | 删除 `quantify all` | 不再存在 combined 路线；依次运行四个明确步骤 | 每一步的 ProcessingRecord 写入 TOML |
| `<target>_baseline_subtracted.csv` | 删除旧 `integration_baseline apply` 输出 | `integration baseline preview → 人工审核 → accept` 保存基线定义和审核状态 | `records/<target>_integration_baseline_review.json`、`records/<target>_integration_baseline_acceptance.json` |
| `detected_peaks.csv` | 删除旧 `detect_peaks` 顶层命令 | `integration peaks` 把候选峰摘要写入 TOML；候选仍不是正式峰 | `records/<result-id>_peaks.json` |
| `peak_detection_curve.csv` | 不再物化诊断曲线 CSV | TOML 只保留候选摘要和指纹 | 同一份 `records/<result-id>_peaks.json` 保存逐点计算证据 |
| `<result-id>_integration.csv` | 删除积分 summary CSV | `integration areas` 把具名区间、峰位语义和各口径面积写入 `[peak_integration.<result-id>]` | `records/<result-id>_areas.json` |
| `<result-id>_integration_curve.csv` | 不再物化积分曲线 CSV | TOML 保存正式摘要、输入 SHA-256 与基线定义指纹 | 同一份 `records/<result-id>_areas.json` 保存逐点计算证据 |

`integration areas --preview` 只写审核 JSON 和图片，不写正式 TOML 面积；正式 `integration areas` 才更新 `[peak_integration.<result-id>]`。两种模式都不会创建 CSV。

## `normalized`、基线和积分不是一回事

这三个词代表三种不同的数学操作：

1. `normalize` 是逐点换单位或除以样品尺度，例如把 `µmol min⁻¹` 换成 `µmol min⁻¹ g⁻¹`。它不选峰、不扣主观基线，也不计算面积。
2. integration baseline 是研究者审核的背景模型 `b(t)`。它是一个科学决定，因此定义、anchor、范围和审核状态进入 TOML；逐点复算证据进入 JSON，不再单独生成扣基线 CSV。
3. `integration areas` 计算 `A = ∫[r(t) - b(t)]dt`。结果是峰面积摘要，进入 TOML；它不是另一种 normalization。

所以 `normalized.csv` 仍有必要：它是最后一张可复用的逐点科学数据表。基线和积分则直接从这张表、TOML 中已审核的基线定义以及精确 SHA-256 复算。

`plot response --response-mode baseline-subtracted` 也直接读取 `normalized.csv`，按 `--target` 选择物种，并用 TOML 中已审核的基线重算显示曲线；不再要求一张历史的 baseline-subtracted CSV。

## 多物种归零与定量

- `response_zeroing apply` 不再有 `--target` 参数。它读取 experiment TOML 中所有与当前 fragmentation 输入和父处理指纹匹配的零点，一次应用；没有零点的物种原样传递。
- target species 到 `quantify` 阶段才选择。
- 单输入框支持英文逗号和中文全角逗号，例如 `--target CO,NH3` 或 `--target 'CO，NH3'`。
- `relative.csv`、`composition.csv`、`flow.csv`、`rate.csv` 和 `normalized.csv` 使用 long format；每行都有 `target_species`，因此 CO、NH3 等目标可以共用同一组文件而不会混淆。

## 默认目录规则

1. CSV 默认写在其输入 CSV 旁边；`temperature_fit.csv` 默认写在 experiment TOML 旁边。
2. `vacuum show` 默认把 `vacuum_baseline_review.png` 写在 HAL CSV 输入旁；其他有默认审核图的 integration/plot 动作同样把图片写在对应输入旁边，不再自动创建 `preview/`、`final/` 或 `diagnostic/`。calibration suggest/preview/fit 默认不保存永久图片，只有显式 `--plot-output` 才保存。
3. JSON 审计记录默认统一进入 experiment 项目的 `records/`。
4. experiment TOML 是当前科学状态和摘要的计算入口；`records/*.json` 是详细证据，不靠文件名代替 provenance。
5. 所有显式输出路径仍然可用；默认和显式输出都拒绝静默覆盖已有文件。

## 默认 `records/` JSON 清单

当前有 9 个动作会默认写机器记录 JSON；`integration areas` 因 preview/正式模式不同，共形成 10 种默认 basename：

| 命令动作 | 默认 JSON | 记录价值 |
| --- | --- | --- |
| `temperature fit` | `records/temperature_fit_record.json` | 拟合来源、有效参数、诊断、模型与审阅表哈希 |
| `vacuum show` | `records/vacuum_baseline_review.json` | 输入身份、必选模型、逐 AMU 窗口、估计器、点数、锚值/衰减/残差诊断和默认审核图哈希；TOML 不变 |
| `calibration preview` | `records/<target>_calibration_preview.json` | provisional 窗口、平台、因子、处理链与配置快照 |
| `calibration fit` | `records/<target>_calibration_fit.json` | reviewed calibration 的完整计算与来源证据 |
| `response_zeroing estimate` | `records/<target>_response_zeroing_estimate.json` | 单物种审核区间、offset、点数和输入/父链身份 |
| `integration baseline preview` | `records/<target>_integration_baseline_review.json` | anchor、估计量、逐点复算值和 pending 审核材料 |
| `integration baseline accept` | `records/<target>_integration_baseline_acceptance.json` | 接受时重新核验的输入、定义和审核状态；其哈希会绑定 reviewed 状态 |
| `integration peaks` | `records/<result-id>_peaks.json` | 候选峰、建议区间、平滑/Gaussian 诊断和逐点证据 |
| `integration areas --preview` | `records/<result-id>_areas_review.json` | 暂算区间、逐点积分证据和审核材料，不写正式面积 TOML |
| `integration areas` | `records/<result-id>_areas.json` | 正式具名区间、峰位、面积、样品尺度和逐点证据 |

其余逐点转换动作已经把科学数据保留在各自 CSV，并把输入/输出 SHA-256、参数指纹、父链和配置指纹写入 experiment TOML 的 ProcessingRecord，因此不再重复生成旁车 JSON。命令的 `--json` 只改变 stdout 格式，不会额外创建文件。

## 当前命令名称

峰分析统一为一个命令族：

```text
tpdtpd integration baseline preview ...
tpdtpd integration baseline accept ...
tpdtpd integration peaks ...
tpdtpd integration areas ... --preview
tpdtpd integration areas ...
```

旧的 `integration_baseline`、`detect_peaks` 和 `integrate_peak_areas` 不再注册为 CLI 命令。历史 experiment TOML 中已有的旧 ProcessingRecord 仍可只读核验，避免旧实验突然无法打开；新运行不会再生成旧式 CSV。

## 复核方法

当前命令和参数以 live manifest 为准：

```bash
.venv/bin/python -m tpxtpx.tpdtpd --manifest-json > /tmp/tpdtpd-manifest.json
jq '[.commands[] as $command
     | $command.parameters[]
     | select(.path_role == "output_file" and .semantic_format == "csv")
     | $command.id]
    | {csv_output_slots: length, csv_actions: (unique | length), actions: unique}' \
   /tmp/tpdtpd-manifest.json
```

清点 CSV 输出动作时，只统计参数同时满足：

- `path_role = output_file`
- `semantic_format = csv`

这样不会把 CSV 输入、PNG、`.tpxmodel`、stdout JSON 或 `records/*.json` 误算成 CSV 输出。
