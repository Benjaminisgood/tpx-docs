# Command-line interface

本页按科研流程解释 CLI。需要逐条查看当前全部 35 个叶命令的用途、必须输入、默认行为、
写入边界和最小示例时，参见 [`tpdtpd` 全部命令中文参考](cli-command-reference.md)。

## Discover commands

```bash
tpdtpd --help
tpdtpd --list
tpdtpd --list --plain
tpdtpd COMMAND --help
tpdtpd COMMAND ACTION --help
```

顶层帮助由轻量 dispatcher 生成；只有选择具体命令后才导入科学依赖。CLI 没有一键
`run`：科研人员检查一个阶段后，再主动执行下一条命令。通用两表插值不再作为
`tpdtpd align` 暴露；TPD 科学流程使用 `temperature align`，程序代码需要通用插值时直接调用
`tpx.alignment.align_by_coordinate()`。

在 TTY 中，`--list` 进入标准库 `curses` 菜单：方向键移动，Space 展开当前命令的真实
`argparse` 帮助，Enter 进入参数向导，Esc 退出。向导按 parser 顺序先询问子命令、位置参数、
没有默认值的选项和必填互斥组；若存在已有命令默认值的参数，只统一询问一次是否修改，按 Enter
即全部采用默认值。最后用 `shlex.join()` 显示可复制命令；确认后仍由原 dispatcher 执行。Esc 或 Ctrl-C
取消不会创建输出或改配置。非 TTY、管道、`TERM=dumb` 会自动回退到稳定文本；
`--list --plain` 强制文本模式。回答 yes 后的默认参数选择器接受编号或参数名，输入 `all`
才逐项询问全部默认参数；`--show` 等默认关闭的开关遵循同一规则，不再有另一套“高级”分组。

输入 config 后，叶子命令可以从该 schema 4 TOML 提议能够唯一确定的已复核值。提示中按 Enter
接受后，该值仍显式出现在 Copyable command 中；直接 CLI 的必填参数契约不变。定量命令只有在
恰好一个 `[calibration.<species>]` 含可用的正内标平台电流时才提议 `--target`。零个时提示先完成
`calibration fit`；多个时稳定列出候选并要求手工选择，不把 TOML 表顺序或最新 provisional
suggestion 当成默认目标。真实 parser 已声明的布局、技术策略和输出规则会作为默认值展示；只有
无法唯一推导的输入处理历史与科学判断仍要求研究者明确选择。

## Prepare and inspect a schema 4 experiment

新实验用 `init`；然后用 `config inspect` 严格检查配置及其引用的原始数据。下一步明确依赖
某些实测通道时，在同一命令上重复指定 `--require-mass`：

```bash
tpdtpd init experiment.toml \
  --name "sample-1 TPD" \
  --rga-csv raw/sample-1.csv \
  --temperature-log raw/temperature.txt

tpdtpd config inspect experiment.toml \
  --require-mass 28 \
  --require-mass 40
```

TOML 保存单个实验的稳定事实、内标气条件及审核状态、MS 通道、可选的自动温度建议、按物种保存的
provisional 校准选区/指标、经复核校准、碎片矩阵、逐 AMU 常数/指数真空模型、按物种保存的 integration baseline，
以及按稳定 result ID 保存的候选峰摘要和正式逐峰积分结果。两类 suggestion 与 calibration preview
带源 SHA256，但都不是 reviewed fit；`[integration_peaks.<result-id>]` 保存未审核候选，
`[peak_integration.<result-id>]` 只由正式 `integration areas` 产生。
初始化得到空的 `[calibration]`，不会猜测目标物种。默认分析通道是 2/14/18/28/40/44，
只保存中性 AMU/标签；通道没有 `response_correction_factor`。乘法响应修正仅属于人工复核后创建的
`[calibration.<species>]`。fresh fragmentation 使用 2/18/28/40/44 五通道中性单位阵，与有
历史真空值的严格求解集合自洽；m/z 14 缺测且不进入默认矩阵。单位阵仍必须执行并生成物种电流列。
未知质量和 BET 保持缺失。
默认真空电流保留参考工作簿的完整可往返浮点值：

```toml
[vacuum_baseline.currents_a]
"2" = 1.77127014636763e-13
"16" = 1.10074217416044e-14
"17" = 4.26790171399101e-14
"18" = 1.3575523015025e-13
"28" = 1.3301617730933e-14
"32" = 1.08196261834265e-14
"40" = 7.04306287485808e-15
"44" = 7.047031167948e-15
"45" = 6.56431924639854e-15
"46" = 6.69107670262831e-15
```

历史工作簿未采集 m/z 14，因此初始化的默认常数真空本底省略 14，不把未测量值写成 `0 A`。
常数保存在 `[vacuum_baseline.currents_a]`；审核通过的纯指数保存在严格的
`[vacuum_baseline.exponential."<AMU>"]`，并绑定时间坐标、参考点、衰减率、raw SHA-256、来源范围和
审核记录路径/SHA-256。同一 AMU 只能使用一种模型。

指数表的严格持久化形状如下；这是 renderer 的说明，不是建议手抄系数。正式写入应使用
`vacuum set --review-record`：

```toml
[vacuum_baseline.exponential."28"]
mass_amu = 28
time_column = "acquisition_time_min"
reference_time_min = 2.0
reference_current_a = 1.2e-10
decay_rate_per_min = 0.08
source_input_sha256 = "<raw CSV SHA-256>"
source_range_min = [0.0, 30.0]
review_record_path = "<resolved vacuum_baseline_review.json path>"
review_record_sha256 = "<review JSON SHA-256>"
```

fresh reference 仍标记为 `inherited-unreviewed` 并保留独立审核流程。`vacuum show` 从 raw HAL CSV
按 AMU 独立窗口生成模型、审核 JSON 和图片，但不改 TOML；科研人员检查后用 `vacuum set` 写入，
之后才由 `vacuum subtract` 消费。公开真空流程只有
`show → 人工复核 → set → subtract`，不会用一个共享窗口直接替换整张映射。

`config inspect` 只接受 schema 4 TPD TOML，先严格验证配置，再各读取一次其引用的
RGA CSV 和温控日志。它不接受裸 CSV 或目录，也不修改配置或数据。默认的人类输出与
`--json` 都包含配置路径/SHA256、实验与样品、内标气审核状态、MS 通道、已配置校准、
碎片矩阵摘要、真空本底摘要、RGA 起始时间/时长/点数/AMU，以及温度点数/范围。可选质量、
BET 或校准缺失时输出 `null` 或空列表，不另行判定“未完成”。需要完整矩阵时使用
`fragmentation show`；需要查看已存真空模型时检查 `config inspect`/TOML，需要从实测曲线重新审核
候选模型时才运行带 `--input`、必填 `--baseline-model` 和逐 AMU `--signal-window` 的 `vacuum show`。
`--clock-elapsed-tolerance-s` 默认是 `1 s`；只在需要覆盖温控时钟/elapsed
重建阈值时显式传入。`--require-mass AMU` 可重复；每个值必须是正整数，任一指定通道
未在 RGA 表头中实测时整条检查失败。默认不额外要求 AMU。

三个 `config` 子命令都会先严格加载 schema 4，但后续证据范围不同：`config inspect` 读取两份
原始数据并执行可选 AMU 硬约束；`config provenance` 核验 ProcessingRecord 输出、父链和当前文件
SHA256，本身不打开配置引用的 RGA CSV 或温控日志；`config status` 汇总 command readiness、审核门禁
与证据状态，并会按当前记录需要读取其绑定文件。三者不再重复承担同一个公开入口。

非法 TOML、任何非 schema 4 版本、非 TPD 配置、缺失/损坏数据或非法时钟容差都以退出码 2
失败，不输出部分结果。所有阶段处理仍把输入、输出与当次科学判断写在命令行上。
只有明确的 suggestion、reference set/accept、vacuum set、fragmentation set、calibration
preview/final fit、response zeroing、integration baseline/peaks/areas 和 processing-record 追加会原子
更新各自受控 TOML 段；suggestion、calibration preview、baseline preview 和 peak candidates 都不是
reviewed 结果。`vacuum show` 只写审核 JSON/图片，不更新 TOML。其他科学判断不隐式写入配置。
科学阶段工件的输出路径若已存在，命令会拒绝覆盖；重跑时必须改用新文件名或新输出目录。
`init --force` 仅用于明确替换实验 TOML，不会覆盖原始数据。

## Required signal processing and default outputs

两条输入支路都明确执行 vacuum subtraction 与 fragmentation correction。calibration 只消费完整采集；
response zeroing 是 aligned 脱附支路在 fragmentation 后的可选步骤：

```text
full acquisition raw → vacuum subtract → fragmentation correct
  → adsorption/dosing segment + calibration background + adsorption plateau
  → reviewed target:Ar mixture → calibration fit

aligned desorption → vacuum subtract → fragmentation correct
  → [response_zeroing estimate → human review → response_zeroing apply]
  → quantify relative → composition → flow → rate → normalize
  → integration baseline preview → human review → accept
  → integration peaks / integration areas → TOML + records JSON
  → plot response / plot comparison
```

真实命令、工作簿公式与每个阶段数值的并排复核见
[`20260811 #2WXQ：CLI 分步处理与 XLSX 人工处理`](co-tpd-2wxq-example.html)。

Vacuum subtraction and fragmentation correction are not optional branches. Even when the configured
fragmentation matrix is the identity matrix, `fragmentation correct` is still executed: the values
remain unchanged, but the command produces explicit species-current columns and processing
provenance. `calibration suggest/fit` still require the direct full-acquisition
vacuum→fragmentation branch. `quantify` accepts either a SHA256-verified
`heating_desorption_aligned` vacuum→fragmentation branch or the verified
vacuum→fragmentation→response_zeroing branch; it rejects raw, full-acquisition calibration tables,
vacuum-only tables, and hand-authored input.

标准阶段 CSV 只保留可用的稳定坐标，例如 `row_id`、
`acquisition_time_min`, `program_time_min`, and `temperature_fit_c`, plus the hand-off columns:

| Stage | Review input | Active output |
| --- | --- | --- |
| Raw HAL | instrument export | `m{AMU}_raw` |
| `temperature align` | raw source is bound by record and SHA-256 | `m{AMU}_signal_a` |
| `vacuum subtract` | `m{AMU}_input_a` for input/baseline intersection AMUs | per-row `m{AMU}_baseline_a` and corrected `m{AMU}_signal_a` |
| `fragmentation correct` | consumed mass signals retained as `m{AMU}_input_a` | `{species}_resolved_a` |
| `response_zeroing apply` | all pending definitions matching the current input and parent fingerprint, explicitly accepted by this call | all matching resolved species zeroed; species without a matching estimate unchanged |
| `calibration fit` | processed target/Ar species currents in two reviewed windows | reviewed factor in TOML；详细 JSON；无 CSV |
| `quantify relative` | processed target/Ar species currents in the desorption segment | diagnostic current copies plus `target_relative_to_reference` |

`m{AMU}_input_a` means only “the value consumed by this step”; `m{AMU}_baseline_a` means the baseline
actually subtracted on that row; `m{AMU}_signal_a` means the active mass signal;
`{species}_resolved_a` means a matrix-resolved species signal. Headers no longer encode
the processing history. Former processed tables containing `m*_current_a`, `observed_*`, or
`species_*_current_a` are rejected and must be regenerated from the raw HAL source. There is no legacy
suffix migration path.

当前 35 个叶命令中只有 10 个 action 写 CSV，每次各写一张。默认职责名是：

- `temperature fit` → `temperature_fit.csv`；`temperature align` → `aligned.csv`；
- `vacuum subtract` → `calibration_vacuum.csv` 或 `desorption_vacuum.csv`，角色不能验证时为 `vacuum.csv`；
- `fragmentation correct` → `calibration_fragmentation.csv` 或 `desorption_fragmentation.csv`，角色不能验证时为 `fragmentation.csv`；
- `response_zeroing apply` → `response_zeroed.csv`；
- 四步 quantify → `relative.csv`、`composition.csv`、`flow.csv`、`rate.csv`；
- `normalize` → `normalized.csv`。

完整重跑校准支路与脱附支路时，无 response zeroing 共 11 张 CSV，有 response zeroing 共 12 张。
多 target 共用 long-format 定量表并由 `target_species` 区分，文件数不按物种相乘。CSV 默认位于其输入
旁，`temperature_fit.csv` 位于 experiment TOML 旁；默认不再创建或切换 `preview/`、`final/`、
`diagnostic/` 角色目录。显式输出路径仍可用，并且都拒绝覆盖已有文件。

真实实验运行应优先使用上述 CLI 默认 basename。需要改到指定 output 目录时，只改父目录并
保留默认 basename；不擅自附加 `fresh`、`final`、`v2`、日期或时间戳。`--result-id` 是必填的
TOML 科学身份而不是临时文件名；它没有 CLI 默认值，应复用当前实验已审核的稳定 ID，或使用
不包含运行状态的最小职责型 ID。

这些职责名和表头不能证明处理实际发生。`temperature align`、`vacuum subtract`、
`fragmentation correct`、`response_zeroing apply`、四个 `quantify` action 与 `normalize` 为实际写出的
CSV 追加 SHA256-addressed ProcessingRecord。ProcessingRecord
describes output identity and lineage: it carries the input/output hashes, a parameter
fingerprint, and any parent/config fingerprints needed to identify that artifact. The vacuum and
fragmentation records retain their complete configuration fingerprints; the response-zeroing apply record
retains the exact aligned-fragmentation parent. The `temperature.align` record binds the configured RGA and temperature-log
bytes, the selected `.tpxmodel` and signal bytes, the clock reconstruction tolerance, the clock offset,
and the out-of-bounds policy in its alignment fingerprint.
Calibration and quantify require the input hash to resolve to that chain; neither a filename nor a
plausible header can replace a missing/mismatched record. Final fit persists
the selected columns plus processing/vacuum/fragmentation fingerprints; quantify compares the
calibration, current config, and desorption artifact before using the factor.

`temperature_fit_record.json` is a portable record/display manifest for one temperature fit;
`[[processing_record]]` is the experiment-level output-artifact identity and lineage; the workflow plugin’s
`receipt.json` and logs describe one process invocation, including argv, stdout/stderr, exit status, and timing.
Workflow records live in the independent instance state directory and are not part of the experiment TOML.
None is a substitute for another, and a matching SHA-256 proves byte identity rather than scientific
acceptance。record/display JSON 默认位于 `records/`；reloadable `.tpxmodel` 位于 experiment TOML
旁或显式的非 `records/` 路径。CLI 不创建 `commands.log`、`human_reports.log` 或
`runtime_provenance.txt`。`integration peaks` 写候选摘要 TOML 与逐点 JSON；`integration areas --preview`
只写审核 JSON/图片；正式 `integration areas` 写 `[peak_integration.<result-id>]` 与详细 JSON。integration
命令不生成扣基线、候选峰、summary 或 curve CSV。需要审计 stdout 时，应在第一次执行就使用 `--json`。

## Temperature

温度处理分成三个明确决策边界：机器建议、人工边界拟合、模型重放对齐。

```bash
tpdtpd temperature suggest experiment.toml

# 可选的阻塞式临时审阅图
tpdtpd temperature suggest experiment.toml --show

# 下面是 #2WXQ 与 XLSX 同决定复验的实测参数；每个实验都要重新复核
tpdtpd temperature fit experiment.toml \
  --heat-start 2026-08-04T16:34:21 \
  --heat-end 2026-08-04T17:18:21 \
  --clock-elapsed-tolerance-s 0 \
  --model polynomial --polynomial-degree 18 \
  --polynomial-monotonic-tolerance-c 0.23 \
  --smooth-points 31 --smoothing-estimator median \
  --window-extra-min 5 --minimum-ramp-points 3 \
  --platform-estimator median --empty-platform-policy edge \
  --fit-output output/temperature_fit.csv \
  --model-output output/temperature_model.tpxmodel \
  --fit-record-output output/records/temperature_fit_record.json

tpdtpd plot temperature experiment.toml \
  --input output/temperature_fit.csv \
  --title "sample-1 temperature fit" \
  --show \
  --dpi 600

tpdtpd temperature align experiment.toml \
  --model-input output/temperature_model.tpxmodel \
  --clock-elapsed-tolerance-s 0 \
  --time-offset-s 0 \
  --out-of-bounds drop
```

`experiment.toml` 是位置参数，必须填写现有 schema 4 配置文件的路径，例如
`output0809/experiment.toml`；在参数向导中输入 `1` 会被当成文件名 `1`，不是菜单选择。
默认向导因此是“选择 `suggest` → 填 config → 决定是否修改已有默认值 → 检查命令”。
需要临时审阅图时，在默认参数目录中只选择 `--show`；其他检测参数继续采用命令默认值。

`suggest` 没有隐藏的 -180/250 °C 起止温度。默认算法先寻找实测温度和设定温度同时达到
升温斜率条件的连续候选段，再按实测与设定温升中的较小值（共同温升）选择最显著候选；
起点取升温前局部实测平台离开阈值的首次交叉，终点取该升温段之后第一个连续确认的平台。
长时间采样断档不能跨接成连续平台。

输出包含候选边界、选择方式与序号、候选支撑区间、实测/设定/共同温升、相对其他候选的
优势、升温前局部平台和离开阈值，以及一条可复制但仍需复核的
`recommended_fit_command`。默认终端报告会逐项显示候选；`--json` 的 `ramp_candidates`
数组还会按出现顺序列出每个候选的
`support_start`、`support_end`、时长和三种温升，所选项由 `selected_ramp_ordinal` 标识。
多个强度相近的升温段会产生 ambiguity warning。成功建议会原子替换
`[temperature_suggestion]`，保存自动边界、检测标签与序号、完整有效参数、时钟容差和两份源文件
SHA256，并在默认报告及 `--json` 中报告配置更新前后 SHA256。该段不是人工复核结果，也不会自动执行 `fit`。
只有需要用已知温度锚定异常或多循环数据时，才成对覆盖温度提示参数：

```bash
tpdtpd temperature suggest experiment.toml \
  --start-temperature-hint-c -180 \
  --end-temperature-hint-c 250
```

两个 hint 必须一起提供；它们只改变本次建议规则，不是任何实验的默认范围。其他检测阈值也
只影响建议，不能替代人工复核。`suggest` 不创建温程 CSV、模型或对齐表。

在 `tpdtpd --list` 的 fit 向导中，若当前 RGA CSV 和温控日志的 SHA256 仍与 TOML 建议相同，
两个边界提示可以按 Enter 接受。向导会在可复制命令中显式加入 `--heat-start`、`--heat-end`
以及用户主动修改的默认参数；未修改的时钟容差、模型和平滑参数由当前 CLI 默认值处理。最终确认仍由科研人员
完成。任一源哈希改变时不能复用旧建议，必须重新运行 suggest。直接 CLI 调用不读取隐藏默认，
仍必须显式提供两个本地 ISO 8601 墙钟边界，且不能带时区偏移。格式
`YYYY-MM-DDTHH:MM:SS[.ffffff]` 的小数秒可以没有，也可以有 1–6 位；应复制实际检测值，不能随意
填写，`.9` 与 `.900000` 表示同一时刻。`fit` 不再自动寻找升温段。
默认拟合模型及可选模型参数以 `temperature fit --help` 为准。
默认 `model=monotonic` 的中文名称、PAVA 最小二乘约束、升温段保序、完整温程再次保序和分段线性重放原理，
见[温程拟合与双时钟对齐：单调非降保序回归](temperature-alignment.html#monotonic-model)。

`ramp_support_start` / `ramp_support_end` 是平滑后实测与设定温度斜率共同满足升温条件的
支撑区间，不是最终拟合边界。`heat_start` 来自局部前平台离开规则，`heat_end` 来自确认平台
或明确报告的 fallback；所以它们与 support 边界存在时间偏移通常是预期结果。
`--show` 用一个阻塞式 GUI 窗口同时显示全程总览、起点放大、终点放大和全部候选表；窗口
正常关闭后才原子提交 TOML 并输出人类报告。该选项没有输出路径，不保存图片或阶段文件；绘图
失败或 Ctrl-C 中断发生在提交前，experiment TOML 保持原字节；
非交互 Matplotlib backend 不能使用它。

`temperature_fit.csv` 是人工审阅工件，用于逐行检查记录温度、拟合温度和选区。
`temperature_model.tpxmodel` 是严格可重载的 UTF-8 TOML 计算模型，只保存边界、单位、
平台值、模型类型，以及多项式系数或单调模型的插值节点；它不保存来源、运行信息、RMSE 或 CSV
哈希。`records/temperature_fit_record.json` 才保存工具版本、相对实验根目录的原始来源与两项输出、
有效拟合参数、RMSE/最大误差/单调性等诊断及全部 SHA-256，并明确 `review_required=true`。
`records/` 只用于这些审计/哈希记录，不存放 `.tpxmodel` 计算模型。
`.tpxmodel` 后缀只属于程序升温模型；response-zeroing 与 integration-baseline 的计算状态写入现有
experiment TOML，不使用该后缀。

不要仅凭 CSV 的显示值重新构造模型。`.tpxmodel` 是 align 唯一的温度模型计算输入；省略
`--model-input` 时使用 experiment TOML 同级的 canonical 模型，也可显式覆盖为另一份已复核模型。
fit CSV 不是原始 RGA，也不进入 align 计算；原始 RGA 与温控日志仍由 experiment TOML 的 `[files]`
提供。时钟容差、时钟偏移与越界策略采用本次 align 的默认值或显式覆盖值，不能从 fit record 读取。

成功后，`temperature.align` ProcessingRecord 保存 aligned 表的实际信号输入/输出 SHA-256，
其 alignment fingerprint 绑定当前 RGA、温控日志、`.tpxmodel`、所选信号输入和上述三个 align 参数。
`records/temperature_fit_record.json` 仍可独立核对拟合来源、参数、诊断以及 model/审阅 CSV 哈希，
但不是必要输入，也不驱动 ProcessingRecord 或下游消费门禁；它缺失或变化只影响拟合审计状态。
这些哈希表示对应字节和计算身份，不是数字签名，也不表示科研人员已接受拟合。

旧式 `temperature_model.json` 不兼容当前合同；先归档旧工件，再重新执行 `temperature fit`
生成 `.tpxmodel`。默认模型位于 experiment TOML 同级，也可以显式选择其他非 `records/` 路径；
canonical `records/` 目录中的模型会被拒绝。

`--out-of-bounds` 明确决定拟合时间范围外 RGA 行的处理：

- `error`：发现任何越界行就停止并报错；首跑推荐，避免静默丢行或外推假象；
- `drop`：删除越界 RGA 行，只输出拟合范围内的行；
- `nan`：保留越界 RGA 行，但这些行插值得到的温度为 NaN；
- `clip`：保留越界 RGA 行，并把它们的温度设为最近的拟合端点温度。

RGA 原始表中的 HAL `Time` 字段在 SDK 输出中统一命名为 `rga_elapsed_hms`。它保留相对
`HH:MM:SS` 字符串，不是绝对日期时间，也不是温控日志时钟；不得用它直接做跨仪器时间比较。
对齐及后续数值处理使用 `acquisition_time_min`、`program_time_min` 和 `temperature_fit_c`。

## Reference gas review

fresh init 保留实验室 reference 默认值，但状态是 `inherited-unreviewed`。先看当前完整记录；若
当前实验使用了不同气体、AMU、流量或标准状态，`set` 会把整条记录置为 pending；最后单独 accept：

```bash
tpdtpd reference show experiment.toml

tpdtpd reference set experiment.toml \
  --species Ar --mass 40 --flow-sccm 25 \
  --standard-pressure-kpa 101.325 --standard-temperature-c 0

tpdtpd reference show experiment.toml
tpdtpd reference accept experiment.toml \
  --expected-reference-gas-fingerprint FINGERPRINT_FROM_REFERENCE_SHOW
```

`show` 是只读的，并明确打印当前/已接受指纹、审核状态、`review_validity` 和绝对 quantify
是否允许。`accept` 必须显式传回本次 `show` 的 `current_reference_gas_fingerprint`；它按同一次配置
快照校验指纹，并在原子替换前比较当前 TOML 的完整字节，发现并发改动就拒绝覆盖。旧 reviewed
配置没有接受指纹时为 `incomplete`，接受后值不匹配时为
`stale`；只有 `current` 可用于绝对定量。`set` 与 `accept` 分开是为了让研究者在提交前检查整条
标准状态；`relative` 与 `composition` 仍可用于检查已复核校准下的
相对响应/摩尔比，但它们不是绝对摩尔流率结果。脚本需要机器结果时，必须在首次执行 action 时增加 `--json`
并读取 stdout，不要在动作完成后为了取得 JSON 重跑。

## Calibration

目标物种不会由 `init` 或配置加载器猜测。`suggest` 和直接调用的 `fit` 都必须显式给出
`--input` 与 `--target`；首次校准用 `--target-mass` 声明目标 AMU，内标物种来自 TOML。
输入必须是完整采集记录依次经过 vacuum 与 fragmentation 后的物种电流表，并且包含配气前区间
和通气后的吸附平台。自动选区只给建议。下面的物种和区间是 #2WXQ 与 XLSX 同决定复验的实测参数，不是默认：

```bash
tpdtpd vacuum subtract experiment.toml \
  --input raw/sample-1.csv \
  --output output/calibration_vacuum.csv

tpdtpd fragmentation correct experiment.toml \
  --input output/calibration_vacuum.csv \
  --output output/calibration_fragmentation.csv \
  --maximum-condition-number 1e10

tpdtpd calibration suggest experiment.toml \
  --input output/calibration_fragmentation.csv \
  --target CO \
  --target-mass 28 \
  --window-min 10 \
  --reference-floor-fraction 0.50 \
  --maximum-stability 0.20 \
  --plateau-level-fraction 0.90 \
  --background-stability-weight 10 \
  --minimum-points 20 \
  --minimum-window-points 5 \
  --maximum-window-fraction 0.20 \
  --minimum-gap-windows 1 \
  --target-label CO \
  --reference-label Ar \
  --plot-title "sample-1 calibration suggestion" \
  --show \
  --dpi 600
```

`suggest --show` 使用阻塞式三联临时窗口，三行分别显示完整目标信号、内标信号和目标/内标比值，
并用阴影标出建议的 calibration background 与 adsorption plateau。窗口本身不保存图片；正常关闭
后，程序再次检查 experiment TOML 和校准输入的 SHA256，只有两者仍与计算前相同才按目标物种
原子写入 provisional
`[calibration_suggestion.CO]`。绘图失败、Ctrl-C 或审阅期间输入变化都不会写 suggestion。
若需要保留图片，显式加 `--plot-output output/calibration_suggestion.png`；无 `--show` 的成功
suggest 也会立即提交 provisional 记录。

每条 suggestion 保存已验证 processing record 的指纹、目标/内标物种、AMU、列名、时间列、
建议区间、算法参数、输入路径与哈希，
不保存响应修正因子或内标平台电流，也不能当作 `[calibration.<species>]`。CO 与 NH3 分别存入
`[calibration_suggestion.CO]` 和 `[calibration_suggestion.NH3]`；更新同一物种只替换该物种，
不串用或删除另一个物种。

用 preview 计算指标/图并写入 provisional `[calibration_preview.<species>]`，在同一次调用中比较
suggestion、本次/旧 preview 与 active reviewed 状态；人工复核后才显式 final fit：

```bash
tpdtpd calibration preview experiment.toml \
  --input output/calibration_fragmentation.csv \
  --target CO --target-mass 28 \
  --calibration-background 80:95 \
  --adsorption-plateau 140:170 \
  --mixture 5:95 --minimum-points 10 \
  --plot-output output/calibration_preview.png \
  --compare

tpdtpd calibration fit experiment.toml \
  --input output/calibration_fragmentation.csv \
  --target CO \
  --target-mass 28 \
  --calibration-background 80:95 \
  --adsorption-plateau 140:170 \
  --mixture 5:95 \
  --background-estimator median \
  --plateau-estimator mean \
  --minimum-points 10 \
  --target-label CO \
  --reference-label Ar \
  --plot-title "sample-1 calibration fit" \
  --plot-output output/calibration_review.png \
  --dpi 600
```

`calibration preview --compare` 并列显示 suggestion、本次 preview 与 active reviewed
calibration 的 factor、区间、mixture、输入和哈希；重复的 `--compare-preview-record PATH` 可显式
加入旧 preview JSON。quantify 始终只使用 active reviewed 项。preview 默认写
`records/<target>_calibration_preview.json`，fit 默认写 `records/<target>_calibration_fit.json`；
两者都不写 metrics CSV，只有 final `fit` 才提交 reviewed calibration。

在 `tpdtpd --list` 的 `calibration fit` 向导中，最新 suggestion 的 processing record 与输入文件
SHA256 仍匹配时，
目标物、输入路径、目标/内标 AMU 与列、时间列、calibration background 和 adsorption plateau
都可按 Enter 接受。采用值
以及当次建议的 `minimum_window_points` 会显式展开在最终可复制 argv 中，后者作为 fit 的
`--minimum-points`，使建议和拟合采用一致的最低有效点数；`--mixture` 必须由用户输入。输入哈希
变化或 suggestion 缺失时，向导要求手工填写。直接 CLI 调用不把 suggestion 当作隐式参数，仍
显式要求 `--input`、`--target`、`--calibration-background`、`--adsorption-plateau` 和
`--mixture`。

`--mixture` 的顺序固定为“`--target` 物种 : TOML `[reference_gas].species`”。例如 CO 为目标、
Ar 为内标且已知配气是 5%:95% 时输入 `5:95`，理论 CO/Ar 比按 `5/95` 计算，不是 `5/100`。
两个值都必须是有限正数；向导会在生成 Copyable command 前拒绝 `j`、`5`、`0:95` 等无效输入。

`--input` 不可省略；程序按目标/内标 AMU 与当前 fragmentation 的 AMU→species 映射解析实际
解混物种信号列，并在报告中显示所选列名。fresh 中性映射下，CO/m/z 28 与 Ar/m/z 40 会读取
`m28_resolved_a` / `m40_resolved_a`，不会把列名改写成未经 fragmentation 配置确认的 CO/Ar 化学身份。
输入内容 SHA256 必须解析到已完成 vacuum→fragmentation 的 processing record；文件名和表头都
不能制造这项证据。旧 processed CSV 不提供迁移入口，必须从 HAL 原始数据重跑。
首次 `fit` 创建并原子回填 `[calibration.<TARGET>]`，同时写详细 record JSON，不输出校准 CSV。
MS 通道不再同步或保存重复的乘法因子；校准因子只属于该目标物种，定义为
`expected_molar_ratio / measured_response_ratio`，后续通过乘法使用。回填内容包括 Ar 平台电流、
区间、估计器、点数、CV、输入哈希，以及 processing、vacuum 和 fragmentation 指纹。
配置更新失败时，本次新建 JSON 和图会回滚。

`calibration background` 是通入目标气体之前的目标物种基线，`adsorption plateau` 是实际按
本次配气比通气后升高并稳定的平台。`fit` 先计算目标物种平台增量，再结合同时测得的 Ar 平台和
实际 `target:Ar` 配气比求乘法修正因子。它不生成供定量继续消费的背景校正表。
校准支路的 `calibration_fragmentation.csv` 来自 raw full acquisition，保留吸附/配气段并按
vacuum→fragmentation 的直接支路拟合校准。脱附支路的 `desorption_fragmentation.csv` 来自同一实验的
temperature-aligned 数据，使用相同 configured vacuum/fragmentation，之后可以加入独立复核的
`response_zeroing` 响应归零。

## Vacuum baseline and required subtraction

`vacuum` 始终作用在 fragmentation 之前的 raw-AMU 电流域。`vacuum show` 的
`--baseline-model constant|exponential` 必填且没有默认值：常数模型要求每个 AMU 恰好一个窗口；
纯指数模型要求每个 AMU 按输入顺序恰好两个首尾窗口，二者严格分离且不重叠。先生成模型与审核图，
再由科研人员显式接受：

```bash
tpdtpd vacuum show experiment.toml \
  --input raw/calibration.csv \
  --baseline-model exponential \
  --signal-window 28 1.0 3.0 \
  --signal-window 28 24.0 27.5 \
  --estimator median \
  --minimum-points 3

# 人工检查 stdout、records/vacuum_baseline_review.json 和
# raw/vacuum_baseline_review.png 后，原样接受记录中的模型：
tpdtpd vacuum set experiment.toml \
  --review-record records/vacuum_baseline_review.json

tpdtpd vacuum subtract experiment.toml \
  --input output/aligned.csv
```

每个窗口都在 `acquisition_time_min` 上选择对应 `m{AMU}_raw` 的闭区间；显式的
`--estimator median|mean` 分别作用于各窗口，`--minimum-points` 也逐窗口校验。指数的两个窗口得到
`I1,I2`，相应有限样本时间的中位数得到 `t1,t2`，然后计算

\[
b(t)=I_1\exp[-k(t-t_1)],\qquad k=\frac{\ln(I_1/I_2)}{t_2-t_1}.
\]

只接受 `I1 > I2 > 0`、有限正 `k` 且完整 raw 范围内预测有限的数据。纯指数最终趋近 0；命令不
自动改用常数/线性模型，也不裁剪负的校正结果。指数审核图逐 AMU 显示完整 raw 信号与指数曲线、
两个窗口、扣除后的完整信号与零线；JSON 另给点数、锚值、`k`、`tau=1/k`、残差 MAD/RMSE、
窗口斜率和完整范围基线极值。这些都是机械证据，不是稳定性或科学接受判断。
exponential 的 `show --input` 必须就是 experiment TOML 配置的确切 `rga_csv`；constant 可审核
另一份明确给出的完整 HAL CSV。

默认审核记录是 `records/vacuum_baseline_review.json`，默认图片是输入旁的
`vacuum_baseline_review.png`；`--json` 只切换 stdout。结果明确 `stored=false`，`show` 不修改 TOML。
`set --current AMU:A` 直接写已复核常数；互斥的 `set --review-record JSON` 严格验证记录结构、当前
config SHA-256 与当前配置 raw 的 SHA-256 后，接受记录中的全部模型并避免手抄指数系数。接受后的
指数模型以 raw 内容 SHA-256 为采集身份；路径改到字节完全相同的副本不会单独使模型 stale，任何
字节变化都会使它和下游谱系失效。设置某 AMU 的新模型会移除它原来的另一种模型，未点名 AMU
保持不变，所以同一配置可在分别审核后混用两种模型。

上例的 `output/aligned.csv` 来自前一节的 `tpdtpd temperature align`，不是 `vacuum`
子命令的产物。省略输出时，这个已验证的 desorption 输入写 `output/desorption_vacuum.csv`；对配置
指向的 raw full acquisition 则默认写 `calibration_vacuum.csv`，角色无法验证时才回退 `vacuum.csv`。
每个已应用 AMU 都输出 `m{AMU}_input_a`、逐行实际扣除的 `m{AMU}_baseline_a` 和
`m{AMU}_signal_a`。

使用一个共享 `--range` 并直接替换整张真空电流映射的旧入口已经删除；当前没有绕过逐 AMU
`show → 人工复核 → set` 门禁的兼容缩写。旧
`[vacuum_baseline.measurement]` 与 calibration `vacuum_sources` 仅兼容读取，当前 writer 下一次写出
schema 4 TOML 时会省略它们。

常数模型继续适用于 raw 或 canonical mass-signal 表。指数模型则只允许当前配置中与来源 SHA-256
相同的 raw 字节，或 ProcessingRecord 证明直接来自相同 raw 字节的 `temperature.align` 脱附子表；输入必须具有有限、单调的
`acquisition_time_min`，并完全位于审核 raw 的时间范围内。来源不符、缺少时间列或范围越界都拒绝。

`subtract` 只读 TOML，只对“输入有该 AMU 列且配置有本底”的交集生成校正列。默认终端报告分别
列出已应用 AMU、因无本底而保持不变的输入 AMU、因无输入列而未使用的配置 AMU，并明确显示
“Missing baselines treated as zero: no”；`--json` 保留完整机器字段。缺失键从不当作零；初始化时
m/z 14 因未测量而从默认 baseline 省略，所以输入即使含 m/z 14，vacuum 输出也不制造其校正列。
成功输出会在 experiment TOML 中追加带 vacuum fingerprint、输入/输出 SHA256 和父链的
ProcessingRecord。fingerprint 包含实际应用 AMU 的模型类型、系数、时间坐标和来源 SHA-256；
任一模型变化都会使其后的 fragmentation、calibration、response zeroing、quantify、normalize 与
integration 谱系失配。配置更新报告前后 config SHA256。

## Optional resolved-response zeroing

`response_zeroing estimate` 每次只审核 temperature-aligned `fragmentation.correct` 之后的一个目标
`{species}_resolved_a`。研究者必须使用
`--coordinate-column {program_time_min|acquisition_time_min|temperature_fit_c}` 选择坐标，并用
`--zero-window START:END` 选择当前样品、当前物种的稳定无峰窗口。窗口可在升温前，也可在所有
峰结束后的尾段；命令不自动选择“最稳定”区间。estimate 估计恒定 offset，将窗口、值、输入哈希和父指纹
作为 pending 计算状态写入 experiment TOML 的 `[response_zeroing.<species>]`，并默认写
`records/<target>_response_zeroing_estimate.json` 与输入旁的
`<target>_response_zeroing_estimate.png`。四面板图同时展示归零前/后的完整曲线和所选窗口。

科研人员检查该默认四面板图后，再显式执行 `response_zeroing apply`。apply 不接受 target 参数；
这一动作就是对当前输入和父指纹仍匹配的全部 pending estimate 进行显式接受并应用。没有匹配 estimate
的 resolved species 原样通过。JSON 只作记录/展示，不参与 apply 计算；apply 从 TOML 和精确原输入
复算并验证 offset。

这里有四个不能混用的基线概念：`vacuum` 是 fragmentation 前的逐 AMU 常数/指数真空电流；
`calibration background` 只是完整标气实验中目标平台增量的背景段；`response_zeroing` 是 fragmentation
后、quantify 前的每样品每物种常数归零；`integration baseline` 是 quantify/normalize 后的面积参考线。

```bash
tpdtpd response_zeroing estimate experiment.toml \
  --input output/desorption_fragmentation.csv --target CO \
  --coordinate-column program_time_min \
  --zero-window=-5:0 \
  --estimator median \
  --minimum-points 64

# 分别检查各 target 的 estimate 结果后，apply 读取 experiment TOML 中全部匹配的归零状态：
tpdtpd response_zeroing apply experiment.toml \
  --input output/desorption_fragmentation.csv
```

`estimate` 只接受内容 SHA256 能解析到 `heating_desorption_aligned fragmentation.correct`
ProcessingRecord 的输入。它把 target、response column、坐标、窗口、estimator、最低点数、offset、输入 SHA256
和父 processing fingerprint 写入 TOML，并把详情写入记录/展示 JSON。`apply` 再核对 TOML
状态中的目标列、输入 SHA256 和父 processing fingerprint；apply 一次应用当前 TOML 中所有与该输入
和父指纹匹配的物种 offset，没有 `--target`；未配置 offset 的物种原样通过。删除 JSON 不影响 apply，任一计算输入
字节变化仍会停止。
输出额外保留 `{target}_zeroing_input_a`，覆写活动 `{target}_resolved_a`，其他 resolved species
逐点不变。该分支会改变 `quantify relative`，并可能改变所有下游定量值和积分峰面积。

## Required fragmentation correction

```bash
tpdtpd fragmentation show experiment.toml
# 结构化机器输出：
tpdtpd fragmentation show experiment.toml --json

tpdtpd fragmentation set experiment.toml \
  --species H2,H2O,CO,Ar,CO2 \
  --masses 2,18,28,40,44 \
  --matrix-file reviewed_fragmentation_matrix.csv

tpdtpd fragmentation correct experiment.toml \
  --input output/desorption_vacuum.csv \
  --maximum-condition-number 1e10
```

`show` 默认打印适合人阅读的矩阵表和来源、条件数、单位阵状态；`--json` 保留机器可读结构。
矩阵行是观测 AMU，列是真实物种，即 `observed_current = matrix @ species_current`。
fresh init 的 2/18/28/40/44 五通道单位阵表示求解前后数值相同，但 `correct` 仍必须执行并生成
明确的 `{species}_resolved_a` 列；所消费的质量信号保留为 `m{AMU}_input_a`。raw/full 与 aligned
角色只由匹配的 processing record 与 SHA-256 证明，不编码进表头。不要把
工作簿 `fragment` 页的参考谱直接当成可逆运行矩阵。`set` 原子替换经复核矩阵；`correct` 只读它。默认
`--missing-observed error` 严格要求每个矩阵行都有输入列，fresh 配置可直接满足。只有自定义矩阵
确实缺少观测列且研究者接受部分求解假设时，显式 `available` 才会跳过缺失行和同位置物种列，
再解剩余 principal submatrix。结果报告 applied/skipped masses/species、完整与实际求解
条件数、`ignored_coupling_max_abs`、负解和部分求解 warning。非单位阵下这等价于假设被跳过物种
对保留观测的贡献为零，不能忽略耦合诊断。

## Quantification and 60 mg normalization

```bash
tpdtpd quantify relative experiment.toml \
  --target CO,NH3 \
  --input output/desorption_fragmentation.csv \
  --minimum-reference-fraction 0.10

tpdtpd quantify composition experiment.toml \
  --target CO,NH3 \
  --input output/relative.csv

tpdtpd quantify flow experiment.toml \
  --target CO,NH3 \
  --input output/composition.csv

tpdtpd quantify rate experiment.toml \
  --target CO,NH3 \
  --input output/flow.csv

tpdtpd normalize experiment.toml \
  --input output/rate.csv \
  --mass-mg 60
```

四个子命令接受一个或多个逗号分隔的 `--target`，并按各自 reviewed calibration 的目标/内标 AMU
与当前 fragmentation 映射解析实际 `{species}_resolved_a` 列。fresh 中性映射会解析 m/z 28/40 为
`m28_resolved_a` / `m40_resolved_a`；输出中的 `target_species` / `reference_species`
才记录 reviewed calibration 的 CO/Ar 化学身份。输入内容必须对应完成 vacuum→fragmentation，或脱附专用
vacuum→fragmentation→response_zeroing 的 processing record；文件名和表头不能替代记录。
采用归零支路时，程序还验证 `response_zeroing.apply` 的精确父记录是已验证的 aligned
`fragmentation.correct`。程序同时核对 active calibration 保存的
processing/vacuum/fragmentation 指纹、当前配置指纹和脱附工件记录，三方不一致就拒绝旧 calibration。
每一步只保留坐标、物种身份、上一步输入值和本步输出值，输出一张 multi-target long CSV：
`relative.csv → composition.csv → flow.csv → rate.csv`。`target_species` / `reference_species` 在每行
明确身份；多个 target 共享文件，不按物种拆表。当前 CLI 没有 `quantify all`、combined 或 split 布局。
`normalize` 读取 `rate.csv`，写同样 long-format 的 `normalized.csv`。

校准因子、当前 Ar 平台电流、Ar 流量和标准压力/温度全部来自 TOML，不接收校准 CSV
或 CLI 覆盖。`flow` 与 `rate` 要求 `review_validity=current` 的 reference；所有 quantify action 都要求当前
reviewed calibration 具有正的内标平台电流。
`normalize` 的质量/BET 优先读取 `[sample]`；显式 CLI 值与 TOML 不同会拒绝，只有同时给
`--reviewed-sample-override` 才采用覆盖值，并在完成报告中保留 configured/CLI/resolved 来源。

## Analysis baseline review and integration

正式分析使用统一的 `integration` 命令族。先 preview 基线，再由科研人员 accept；随后候选峰和正式
面积都从同一 `normalized.csv` 与 TOML 中 reviewed baseline 复算，不再物化扣基线 CSV：

```bash
tpdtpd integration baseline preview experiment.toml \
  --input output/normalized.csv --target CO \
  --baseline-program-time-range-min=0:60 \
  --start-c -180 --end-c 240 \
  --baseline piecewise-linear \
  --baseline-anchor-range-c=-180:-172 \
  --baseline-anchor-range-c=50:90 \
  --baseline-anchor-range-c=130:190 \
  --baseline-anchor-range-c=220:240 \
  --baseline-estimator median

tpdtpd integration baseline accept experiment.toml \
  --input output/normalized.csv --target CO

tpdtpd integration areas experiment.toml \
  --input output/normalized.csv --target CO \
  --result-id co_integration \
  --start-c -160 --end-c -90 --interval-name peak-1 \
  --interval peak-2 -90 50 --method trapezoid \
  --interpolate-bounds
```

`baseline preview` 把定义以 pending 状态写入 `[integration_baseline.<target>]`，默认输出
`records/<target>_integration_baseline_review.json` 和 `<target>_integration_baseline.png`。
`accept` 重新核对 normalized 输入、target 和定义指纹，再把状态改为 reviewed，并写
`records/<target>_integration_baseline_acceptance.json`。二者都不生成 CSV。

`--baseline-anchor-range-c=START:END` 只用于 `piecewise-linear`，至少重复两次；每个窗口的
median/mean 决定高度，窗口内实际程序时间中位数决定锚点位置。窗口必须来自研究者判断的无峰区，
不能把待确认的宽峰当成基线。`zero/constant/linear` 的现有数值语义保持不变。

`integration areas` 的第一个区间使用 `--start-c/--end-c`，`--interval-name NAME` 给它命名；重复
`--interval NAME START_C END_C` 可追加更多人工确认区间。区间按升温顺序给出且不能有正宽度重叠。
温度只选择区间，面积沿 `program_time_min` 计算；结果在 TOML/JSON 中同时报告 requested 与 actual
bounds/gaps。没有 `--peak-position INTERVAL TEMP_C` 时记录实际积分响应最大采样点 `Tmax`；只有显式
复核位置才使用 `Tp`。

正式运行把具名区间、峰位语义、绝对/质量/BET 面积、样品属性快照及 normalized 输入/基线指纹写入
`[peak_integration.<result-id>]` 和 `records/<result-id>_areas.json`，不写 summary 或 curve CSV。
同 ID 只替换自己，不覆盖其他结果。

正式写 TOML 面积前可用相同 argv 运行 preview：

```bash
tpdtpd integration areas experiment.toml \
  --input output/normalized.csv --target CO --result-id co_integration \
  --start-c -160 --end-c -90 --interval-name peak-1 \
  --interval peak-2 -90 50 --method trapezoid \
  --interpolate-bounds \
  --preview --plot-range program
```

`--preview` 只写 `records/<result-id>_areas_review.json` 和 `<result-id>_areas.png`，不写正式面积；
人工确认后去掉 `--preview`，首次执行正式命令。若区间超出 reviewed baseline 范围，正式模式默认在
写入前拒绝。优先扩展 baseline review；只有明确承担该外推风险时才加
`--allow-endpoint-held-extension`，并在 TOML/JSON 中保留 override 审计。
对 `--target CO --result-id co_integration`，应直接使用默认图名
`co_integration_baseline.png` 与 `co_integration_areas.png`；不为预览或重跑擅自加 `fresh`、`final`、`v2`
或时间戳。

同一样品、同一物种的两个峰若共享一条 reviewed baseline，应在一次 `integration areas`
调用中使用多个命名区间、同一 `result-id` 和同一 baseline 指纹。如果 response zeroing 后已经科学
接受零线，这两个峰可共享当前样品的 `baseline zero`；这不代表两个样品共享同一个数值。
每个样品的 response-zero offset 和 integration baseline 都位于其自己的 experiment TOML，必须独立审核。
只有两峰确实需要互不兼容的基线时，才使用不同配置分支分别执行
`baseline preview → 人工审核 → accept → areas`，不让后一份 preview 静默替换前一份正式分析入口。

## Peaks

```bash
tpdtpd integration peaks experiment.toml \
  --input output/normalized.csv --target CO \
  --result-id co_candidates --basis absolute \
  --program-time-start-min 0 --start-c -180 --end-c 60 \
  --count 2 \
  --minimum-separation-c 40 \
  --smoothing-window-c 6
```

省略 `--count` 默认报告全部候选峰；省略 `--minimum-height` 默认不设绝对峰高阈值；
指定 `--count` 后仍默认允许实际数量更少，只有明确的峰数假设才加 `--strict`。这些选择只影响
峰识别，不会重算积分。`--smoothing-window-c 6` 表示约 6 °C **总宽**（约 ±3 °C），不是 6 °C 半窗。
数据分辨率或选区点数无法实现该窗口时命令报错，不会默认关闭或缩小平滑；报告仍披露换算后的
半窗点数。命令从 normalized long table 选择 target 并用 TOML 中 reviewed baseline 复算扣基线响应。
候选摘要写入 `[integration_peaks.<result-id>]`，详细逐点证据默认写入
`records/<result-id>_peaks.json`，审核图默认写 `<result-id>_peaks.png`；不生成 peaks/curve CSV。
候选峰和相邻谷底明确标为未审核，不会自动成为 `integration areas` 参数。

可重复提供显式 `--gaussian-seed CENTER_C:SIGMA_C`，增加默认关闭的探索性 Gaussian 形状拟合。中心为负温时必须用
等号写法，例如 `--gaussian-seed=-100:10`。拟合使用未平滑的
扣基线响应，不含常数/斜率项，不修改局部峰检测和谷底建议；报告中心、sigma、峰高、RMSE、R²和
条件数，但故意不输出 Gaussian 面积。响应对温度的解析面积不是按程序时间得到的脱附量，正式面积
仍只能来自人工确认区间的 `integration areas`。

## Plot

五个 `plot` 子命令都把样式与平滑视为**显示参数**。`--title` 不是必填项：默认 `auto` 会根据实验、
物种/口径和视图生成标题，显式值则完整替换自动标题。`--font-family auto` 保留出版字体栈；也可传入
Matplotlib 能找到的字体族，例如 macOS 的 `Heiti TC`。显式字体不存在时命令直接失败，不会悄悄换成
另一个字体。`--font-weight auto` 保留标题、坐标和正文的层级，也可显式选择 `normal`、`medium`、
`semibold` 或 `bold`。

时间坐标图 `raw`、`temperature`、`calibration` 用 `--smoothing-window-min`；温度坐标图 `response`、
`comparison` 用 `--smoothing-window-c`。参数值都是相应物理坐标上的 local-quadratic **总窗宽**，默认
`0` 不平滑。非零窗按输入的中位非零采样间距换算为 `2 × half_window + 1` 个点，必须至少为 5 点。
这一步只生成绘图副本，不改写 CSV/TOML，也不重新决定温程模型、校准因子、基线、积分区间、正式峰位
或峰面积。完成报告/JSON 会记录方法、物理总窗宽、坐标单位、实际点半窗和解析后的字体。

```bash
# 时间坐标图使用 min 总窗宽：
tpdtpd plot raw experiment.toml \
  --input raw.csv --all-masses \
  --smoothing-window-min 0.5

tpdtpd plot temperature experiment.toml \
  --input output/temperature_fit.csv \
  --smoothing-window-min 1

tpdtpd plot calibration experiment.toml \
  --input output/calibration_fragmentation.csv \
  --target CO --target-mass 28 \
  --calibration-background 0:5 --adsorption-plateau 15:25 \
  --smoothing-window-min 0.5

# 响应图使用 °C 总窗宽：
tpdtpd plot response experiment.toml \
  --input output/normalized.csv --target CO \
  --response-mode total \
  --basis mass-umol \
  --display-range program \
  --smoothing-window-c 12 \
  --color '#5b9bd5' \
  --title "sample-1 CO-TPD, smoothed display, 60 mg" \
  --font-family 'Heiti TC' \
  --font-weight medium \
  --show \
  --output output/response_mass.png \
  --dpi 600

# 基线扣除显示直接由 normalized.csv 与 TOML 中 reviewed baseline 复算：
tpdtpd plot response experiment.toml \
  --input output/normalized.csv --target CO \
  --response-mode baseline-subtracted \
  --basis mass-mmol \
  --display-range program \
  --smoothing-window-c 12 \
  --y-min 0 \
  --color '#5b9bd5' \
  --title "sample-1 CO-TPD, baseline-subtracted, 60 mg" \
  --show \
  --output output/response_mass_mmol_baseline_subtracted.png \
  --dpi 600

# 两组或更多实验的完整温程比较；默认 absolute、mass-umol、BET 三行：
tpdtpd plot comparison \
  --series Ge-ZSM-5 ge_zsm5/experiment.toml ge_zsm5/normalized.csv \
  --series ZSM-5 zsm5/experiment.toml zsm5/normalized.csv \
  --smoothing-window-c 12 \
  --title "CO TPD comparison" \
  --font-family 'Heiti TC' \
  --font-weight medium \
  --output output/co_response_comparison.png \
  --dpi 600

```

响应图必须显式选择 `--response-mode`。`total` 从 quantify/normalize 表读取 `--basis`
对应的总响应列；这里的零点没有经过峰基线校正，脱附前不一定为零。
`baseline-subtracted` 读取同一 `normalized.csv`，按 `--target` 选择物种，通过 ProcessingRecord 核对
输入身份，再使用 experiment TOML 中 reviewed baseline 复算对应 basis；不读取 integration JSON 或
历史 baseline-subtracted CSV。
`--display-range program|analysis|custom` 明确区分完整程序升温段、正式审核/分析窗口与自定义显示；
只有 `custom` 同时接收 `--start-c/--end-c`。完整程序图中的端点保持区域仍由工件逐行标明，
不会被表述为已审核积分区间。
`program` 是默认值，严格取 `program_time_min >= 0` 到第一次最高温，因而不是“仅峰”图。
可选 `--y-min` 只控制纵轴显示下界；`--y-min 0` 适合从 0 起绘制的基线扣除响应图，并会在图上隐藏
零点以下的噪声，但底层 `normalized.csv` 保持不变。
非零 `--smoothing-window-c` 会让响应线和峰标记的纵坐标落在显示平滑副本上；标注文字中的正式峰温、
面积与位置语义仍逐字来自已验证的 `[peak_integration.*]`，绝不从平滑线重新找峰或积分。
`--basis` 为 `absolute`、`mass-mmol`、`mass-umol` 或 `bet`；对应标准单位分别是
`umol min^-1`、`mmol min^-1 g^-1`、`umol min^-1 g^-1`、`umol min^-1 m^-2`。
图中的科学计数法、温度、`Tₚ/Tₘₐₓ` 以及 `min⁻¹`、`g⁻¹`、`m⁻²` 单位使用 Matplotlib MathText
真正排版上下标；`text.usetex=False`，所以不要求安装 LaTeX。这里列出的 ASCII 单位仍是 CSV、TOML
和 CLI 契约中的机器可读单位，不代表图片会把 `^-1` 原样画出来。
图片默认写入命令职责对应的 PNG；`--output` 覆盖该路径，`--show` 额外打开交互审阅窗口，也可两者同时使用。
单样默认名包含目标物种、response mode、basis 和范围，例如
`co_response_total_mass-umol_program.png`，所以同一实验中的 CO、乙烷和不同纵轴不会碰撞。
非默认平滑、字体族或字重还会自动追加例如
`_smooth11c_font-heiti-tc_weight-medium` 的样式后缀；只修改自定义标题时应显式给新的 `--output`。
配置中已有
正式 peak integration 时，默认重新核验 normalized 输入和 TOML 指纹后标出所有 `Tₘₐₓ/Tₚ` 和当前 basis 面积；
`--no-annotate-integrations` 才显式关闭。

`plot comparison` 的每个 `--series` 都必须显式给 label、config 与完整 normalized CSV，`--output`
必须显式给出。默认横轴为各完整升温支路的并集，但不外推任一曲线；三行 panel 内分别共享同一纵轴
尺度，保留负值并画零线。默认请求 BET，因此任一样品缺 `[sample].bet_m2_g`、BET 响应列或正式 BET
面积时整张图失败，不生成半张图。需要较少 panel 时可重复 `--basis` 明确选择。图底表格列出每个样品
每个峰/宽特征的位置语义、温度以及 `µmol`、`µmol g⁻¹`、`µmol m⁻²` 面积。完整曲线是 total response；
面积由各样品自己的 reviewed baseline 得到；同一样品、同一 target 的多峰可共享该基线，
不同样品不共享数值。比较图的同一个 °C 总窗宽会按每份曲线自己的实际采样间距换算
点半窗；因此各系列可以有不同点半窗，但共享同一物理平滑尺度，且都不改变正式峰结果。

正式响应图通过 `--display-range program|analysis|custom` 选择完整程序升温段、审核分析段或自定义窗口；
`custom` 才接收成对的 `--start-c/--end-c`。这些显示选择不会改变积分或找峰的科学区间。

## Provenance and exit codes

阶段命令默认输出适合人阅读的完成报告，包含输出文件、核心结果、输入/输出 SHA256、实际参数，
受控配置更新还显示 TOML 修改前后 SHA256。`--json` 把相同执行结果的完整稳定结构写到 stdout，
字段为 `schema_version/stage/timestamp_utc/inputs/outputs/parameters/result`；它不会额外创建
机器记录文件，也不会改变命令生成的科学工件：

```bash
tpdtpd integration areas experiment.toml \
  --input output/normalized.csv --target CO --result-id co_integration \
  --start-c -160 --end-c -90 --interval-name peak-1 \
  --interval peak-2 -90 20 \
  --json
```

机器调用必须在第一次执行时选择 `--json` 并捕获 stdout。不要先运行人类模式再用相同输出加
`--json` 重跑：no-clobber 会拒绝，配置写入 action 也不应重复。

输出路径若与输入、`experiment.toml` 或同一步的另一输出相同，或者该路径已存在，
命令会在写文件前失败。优先在新输出目录中保留 CLI 默认 basename；只在确有科学身份区分需求时才显式改名，不覆盖旧结果。

- `0`：成功或显示帮助。
- `2`：配置、数据或命令使用错误。
- `130`：用户中断。
