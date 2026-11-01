# Python SDK

科学函数从 `tpx` 导入；不要从 CLI 包导入计算逻辑。

本页的代码是按能力拆开的片段，不是一份从 fresh config 原样顺序执行的脚本。顶层 `tpx` 暴露
稳定科学类型与算子；`tpx.signal_table` 中的 `aligned_signal_frame()` 等是显式的模块级表格 helper。
`tpx.table` 的 `ColumnSpec`、`TableSchema`、`TableHeaderMap`、`build_table()`、`validate_table()` 与
`relabel_table()` 通过稳定 semantic key 管理可编辑表头，并由顶层 `tpx` 重导出。普通 SDK 函数只做内存计算：它们不会自动执行 CLI 的 reference 审核
门禁，也不会创建或验证 CLI 的 vacuum 指纹与 processing-record 父链。

新处理表只接受 `m{AMU}_signal_a`、`m{AMU}_input_a`、vacuum 输出的
`m{AMU}_baseline_a` 与 `{species}_resolved_a` 语义。旧
`m*_current_a`、`observed_*`、`species_*_current_a` processed CSV 不迁移，必须从原始 HAL 的
`m{AMU}_raw` 重跑。表头和文件名都不证明 provenance；CLI 仍必须验证 record 与 SHA-256。

## Experiment config stores durable state and provisional suggestions

```python
from tpx import load_experiment_config

experiment = load_experiment_config("experiment.toml")
print(experiment.name, experiment.rga_csv, experiment.temperature_log)
print(experiment.reference_gas.flow_sccm)
if experiment.temperature_suggestion is not None:
    print(experiment.temperature_suggestion.suggested_heat_start)
for provisional in experiment.calibration_suggestions:
    print(provisional.target_species, provisional.background_range_min, provisional.plateau_range_min)
for reviewed in experiment.calibrations:
    print(reviewed.species, reviewed.response_correction_factor)
```

schema 4 的 `ExperimentConfig` 保存实验身份、原始路径、已知样品物性、内标气条件、MS 通道、
可选的自动温度建议、按物种隔离的 provisional 校准选区、经复核的物种校准、运行碎片矩阵、
逐 AMU 常数/指数真空模型，以及按物种隔离的 response-zeroing/integration-baseline 状态、按 result ID 隔离的
integration peak candidates 与正式 peak integration 摘要。fresh reference 是
`inherited-unreviewed`；fresh vacuum 仍从 AMU→constant-current 初值开始；fresh
fragmentation 是 2/18/28/40/44 五通道中性单位阵，m/z 14 缺测且不在矩阵中。新配置没有任何
suggestion，`calibration_suggestions` 与 `calibrations` 均为空；MS 通道不保存响应修正因子。
首次校准前，`response_calibration("CO")` 或 `response_calibration("NH3")` 都会明确报未配置。
ProcessingRecords 只保存已写出工件的身份与谱系字段用于验证，不决定温程拟合、积分、峰识别或
绘图的当次参数。通用 SDK updater 只保证提交时对应字节哈希存在并原子写入记录；calibration、
response_zeroing 和 quantify 等具体 CLI consumer 还会额外核对 stage、role、当前配置指纹与父记录链。
ProcessingRecord 不引用旁车 JSON 或承载审阅状态。align 的 ProcessingRecord 通过实际源文件、
`.tpxmodel`、信号输入及 align 参数形成 alignment fingerprint；fit record
缺失或哈希变化只影响独立的拟合审计状态，不会让 aligned 工件或下游计算谱系失效。
`response_zeroing` 同样不成为跨实验可复用仪器常数：每次 estimate 把本次 aligned 数据中一个 target
的坐标、稳定无峰窗口、estimator、最低点数、offset、输入 SHA256 与父指纹作为 pending 计算状态写入
`[response_zeroing.<species>]`。CLI 默认生成归零前/后的完整曲线和所选窗口四面板图；人工看图后，
无 target 参数的 apply 才显式接受并应用全部匹配状态。estimate JSON 只用于记录/展示，默认位于
`records/`，删除后不影响 TOML 状态或 apply 复算。`integration baseline preview`
把可复算定义写入 `[integration_baseline.<species>]`，`accept` 把来源仍匹配的定义改为 reviewed；
`integration peaks` 与正式 `integration areas` 分别写入 `[integration_peaks.<result-id>]` 和
`[peak_integration.<result-id>]`。配套 JSON 保存详细证据，不作为下一命令的科学状态输入。
真实运行中应优先使用 CLI 已定义的默认 basename；如果只需改变保存目录，保留 basename，
仅改父目录。不擅自加 `fresh`、`final`、`v2`、日期或时间戳。无默认值的 `--result-id` 是
TOML 科学身份，应复用已审核 ID 或使用最小职责型 ID。

语义表头可以按用途准确改名，而科学代码仍通过 semantic key 取列：

```python
from tpx import ColumnSpec, TableSchema, build_table, relabel_table

schema = TableSchema(
    schema_id="example.co-signal",
    version=1,
    columns=(
        ColumnSpec("coordinate.program_time", "program_time_min", unit="min", role="coordinate"),
        ColumnSpec("species.co.resolved", "co_resolved_a", unit="A", role="resolved_signal"),
    ),
)
table = build_table(
    schema,
    {
        "coordinate.program_time": [0.0, 0.1],
        "species.co.resolved": [1.2e-10, 1.3e-10],
    },
)
display_table = relabel_table(
    table,
    schema,
    target_headers={"species.co.resolved": "CO_signal_A"},
)
```

自定义表头是显示合同，不是处理证明；若写成正式工件，完整 header map 仍应进入对应 record。

配置写入不是一个通用 results registry，而是窄范围专用普通函数，例如：

```python
from tpx import (
    accept_reference_gas_config,
    update_calibration_suggestion_config,
    update_fragmentation_config,
    update_processing_record_config,
    update_reference_gas_config,
    update_response_calibration_config,
    update_temperature_suggestion_config,
    update_exponential_vacuum_baseline_config,
    update_vacuum_baseline_config,
    reference_gas_fingerprint,
    reference_gas_review_validity,
)
```

reference 的 set/update 与 accept 是不同动作；vacuum 的两个窄 updater 分别合并/替换常数与指数模型。它们只更新
各自的受控 TOML 段，原子替换文件，返回包含 `before_sha256` 和
`after_sha256` 的 `ConfigUpdate`。`load_experiment_config()` 只严格接受 schema 4，任何其他
`schema_version` 都以 `Unsupported schema_version …; expected 4.` 拒绝。
`update_reference_gas_config()` 把完整 reference 置为 pending，并清除旧接受指纹；随后把刚刚展示的
`reference_gas_fingerprint()` 作为 `expected_reference_gas_fingerprint` 传给
`accept_reference_gas_config()`。函数先用同一次读取所得的配置快照计算五个科学字段的指纹；受控写回会先
完成临时文件落盘，再紧邻原子替换比较目标 TOML 与该快照的完整字节（POSIX 上同时用 advisory lock
串行化受控写入）。比较发现配置已经变化时会拒绝覆盖并保留外部改动。
旧 reviewed 配置缺接受指纹时 `reference_gas_review_validity()` 返回 `incomplete`，已接受内容变化时返回
`stale`，只有 `current` 允许绝对定量。`update_vacuum_baseline_config()` 合并或替换
AMU→constant-current；`update_exponential_vacuum_baseline_config()` 写入
`VacuumExponentialBaseline`，包含 `acquisition_time_min`、参考时间/电流、正衰减率、raw SHA-256、
来源范围和 review-record 路径/SHA-256。写入任一模型都会移除同 AMU 的另一种模型，未点名 AMU
保持不变。vacuum 没有独立 review status；CLI 的 review record 是写入指数模型的受控来源。
`update_exponential_vacuum_baseline_config()` 是低层配置 API：它验证模型类型以及当前 raw/review
文件的 SHA-256 绑定，但不把任意 JSON 重新解释为一次人工接受。正式接受入口是
`tpdtpd vacuum set --review-record JSON`；该命令会严格解析 show 记录，并从记录的 raw 字节、窗口和
统计量重新计算全部模型后再调用配置更新器。
CLI 的 `flow` / `rate` 仍执行
reference 审核门禁；relative/composition 不消费 reference 流量或标态。
旧 `[vacuum_baseline.measurement]` 与 calibration `vacuum_sources` 只在加载历史 schema 4 TOML 时
兼容；当前 renderer 不把它们写回，因此下一次受控写出会将其省略。
公共的 `inspect_rga()` 仍可用于只读检查一个 RGA 文件；CLI `config inspect` 则使用现有
`read_rga_csv()` 与 `read_temperature_log()`，严格加载 TPD 配置并各读取一次配置指向的数据，
不引入新的 SDK 类型。

## Temperature is explicit

```python
from datetime import datetime

from tpx import (
    TemperatureProgramSettings,
    align_rga_to_temperature,
    fit_temperature_program_reviewed,
    read_rga_csv,
    read_temperature_log,
    shift_temperature_fit,
    shift_temperature_timeline,
    suggest_temperature_program_window,
    temperature_fit_from_tpxmodel,
    temperature_fit_to_tpxmodel,
)
from tpx.signal_table import aligned_signal_frame

rga, rga_start = read_rga_csv(experiment.rga_csv)
temperature = read_temperature_log(
    experiment.temperature_log,
    rga_start,
    # 本例为 #2WXQ 复验显式采用零容差；SDK/CLI 通用默认是 1.0 s。
    clock_elapsed_tolerance_s=0,
)
settings = TemperatureProgramSettings(
    model="polynomial",
    polynomial_degree=18,
    polynomial_monotonic_tolerance_c=0.23,
)
suggestion = suggest_temperature_program_window(temperature, settings)

# suggestion 只供检查；下面采用 #2WXQ 与 XLSX 同决定复验的实测参数，不是默认值。
reviewed_start = datetime.fromisoformat("2026-08-04T16:34:21")
reviewed_end = datetime.fromisoformat("2026-08-04T17:18:21")
fit, fit_table = fit_temperature_program_reviewed(
    temperature,
    settings,
    heat_start=reviewed_start,
    heat_end=reviewed_end,
)

# 精确模型可以序列化为严格、带版本的可读 TOML，并从同一文本严格读回。
# CLI 另写 fit-record JSON；来源、参数、诊断和 CSV/model 哈希不混入模型文本。
fit_model_toml = temperature_fit_to_tpxmodel(fit)
replayed_fit = temperature_fit_from_tpxmodel(fit_model_toml)
shifted_temperature = shift_temperature_timeline(temperature, offset_s=0)
shifted_fit = shift_temperature_fit(replayed_fit, offset_s=0)
aligned_full = align_rga_to_temperature(
    rga,
    shifted_temperature,
    shifted_fit,
    out_of_bounds="drop",
)
aligned = aligned_signal_frame(aligned_full)
```

`suggest_temperature_program_window()` 只返回候选边界和诊断；它不会自动成为拟合输入。
默认 settings 不含 -180/250 °C 或任何其他温度锚点。默认模型是 `monotonic`；多项式阶数 3
与降温步容差 0.0 °C 是仅在改选 `polynomial` 时才消费的折叠默认，单调模型会忽略它们。
建议器从实测温度与设定温度共同升温的
候选段中按共同温升选择主段，以升温前局部实测平台的离开点作为起点，再寻找升温后的第一个
连续确认平台作为终点。结果同时暴露选择方式、候选序号与支撑区间、实测/设定/共同温升、
候选优势、局部平台、离开阈值和歧义 warnings，供科研人员查看原始曲线时判断。
`suggestion.ramp_candidates` 是全部候选的不可变序列；每项含 ordinal、support 起止、时长及
三种温升。`suggestion.ramp_support_start/end` 是所选候选满足共同斜率条件的支撑区间，
`suggestion.heat_start/end` 是局部平台离开与终点平台/fallback 得到的最终建议边界；二者不同
不是错误。CLI 默认报告逐项显示这些 candidates，显式 `--json` 时仍完整序列化机器字段。

CLI 的 `temperature suggest experiment.toml --show` 会惰性打开阻塞式临时审阅窗口，显示
全程总览、起点/终点放大和全部候选表。窗口不保存图片或阶段文件；正常关闭后才原子写入
`[temperature_suggestion]` 并返回默认人类报告；完整机器结果 stdout 使用 `--json`。绘图错误或
Ctrl-C 发生在提交前。无 `--show` 的成功
suggest 也写入同一段。该段保存自动建议、完整有效参数、时钟容差与两份源 SHA256，明确不是
reviewed fit；普通 SDK `suggest_temperature_program_window()` 本身仍是无 I/O 计算函数。

只有需要用已知温度锚定异常或多循环数据时，才成对显式提供 hint：

```python
hinted_settings = TemperatureProgramSettings(
    start_temperature_hint_c=-180,
    end_temperature_hint_c=250,
)
```

两个字段必须同时为有限值或同时省略；它们不是全局默认，也不会让 suggestion 自动执行 fit。
`fit_temperature_program_reviewed()` 要求显式 datetime 边界。CLI 因此拆为
`temperature suggest → fit → align`：`temperature_fit.csv` 是人工审阅工件，
`temperature_model.tpxmodel` 是只含计算模型的 TOML，
`records/temperature_fit_record.json` 保存来源、有效参数、诊断和输出哈希，但只用于记录/展示。align 只显式接收
`--model-input` 作为模型计算输入；省略时使用 experiment TOML 同级的 canonical
`temperature_model.tpxmodel`。温控时间线重建、时钟偏移和越界策略由 align 自己的参数决定；
CLI 默认依次是 1.0 s、0.0 s 与 `error`，且不从 fit record 读取。成功后，
`temperature.align` ProcessingRecord 绑定实际 RGA、温控日志、
`.tpxmodel`、信号输入与 align 参数。fit CSV 或 fit record 被删除或修改不会改变同一模型和同一
align 参数的数值结果或 fingerprint，只会影响人工复核材料或拟合审计状态。
模型默认写在 experiment TOML 同级；显式路径也必须位于 canonical `records/` 目录之外。
`.tpxmodel` 后缀只用于程序升温模型；response-zeroing 与 integration-baseline 的计算状态保存在现有
experiment TOML，不创建其他 `.tpxmodel`。
fit record 不是 ProcessingRecord：前者是一次拟合的记录/展示清单，后者只描述正式输出工件的
输入/输出身份和父链。工作流插件的运行记录及日志描述一次进程调用，保存在独立实例状态目录，
不属于科学 SDK 或实验 TOML。
这些哈希与重放只证明当前工件的内部一致性，不是数字签名，也不表示人工科学接受。

`tpdtpd --list` 的 fit 向导可读取 TOML 中仍有效的自动建议：只有当前 RGA CSV 和温控日志
SHA256 都匹配时，按 Enter 才会采用边界，并把 `--heat-start`、`--heat-end`、时钟容差、
平滑点数和 estimator 显式展开到 argv。源文件变化后必须重新 suggest。直接 CLI 仍明确要求
两个边界。`YYYY-MM-DDTHH:MM:SS[.ffffff]` 可没有小数秒或含 1–6 位；小数必须复制检测值，
`.9` 与 `.900000` 表示同一时刻。

`model="monotonic"` 时多项式参数不参与计算。改用 `model="polynomial"` 时默认采用
`polynomial_degree=3` 和 `polynomial_monotonic_tolerance_c=0.0`；只有在复现已审核的其他
多项式阶数或允许有依据的小幅局部下降时才覆盖它们。这里示例的 18 和 0.23 是 #2WXQ 与
XLSX 同决定复验的实验参数，不是通用默认。
省略 `ramp_occurrence` 时按共同温升选择占优候选；只有人工确认要复现某个循环时才显式给出
出现序号。升温与平台检测参数只影响 suggestion，不隐藏在 reviewed fit 中。
`read_rga_csv()` 输出的 `rga_elapsed_hms` 保留 HAL 相对 `HH:MM:SS`，不是绝对时间；对齐使用
由文件元数据重建的 datetime 与数值坐标，不能拿该字符串直接比较温控日志时钟。

## Vacuum models are explicit per AMU

常数候选与纯指数候选分别由两个无文件状态算子计算；二者都不选窗口、不写 TOML：

```python
from tpx import (
    estimate_exponential_vacuum_baseline_windows,
    estimate_vacuum_baseline_windows,
)

constant_candidates = estimate_vacuum_baseline_windows(
    raw_frame,
    signal_windows_min=((40, (26.0, 27.5)),),
    estimator="median",
    minimum_points=3,
)
exponential_candidates = estimate_exponential_vacuum_baseline_windows(
    raw_frame,
    signal_windows_min=(
        (28, (1.0, 3.0)),
        (28, (24.0, 27.5)),
    ),
    estimator="median",
    minimum_points=3,
)
```

`estimate_vacuum_baseline_windows()` 要求每个 AMU 恰好一个窗口。
`estimate_exponential_vacuum_baseline_windows()` 要求每个 AMU 恰好两个按输入顺序排列、严格分离且
不重叠的窗口。每个窗口的 mean/median 为 `I1,I2`，相应有限样本时间中位数为 `t1,t2`，计算
`b(t)=I1*exp[-k*(t-t1)]`、`k=ln(I1/I2)/(t2-t1)`。它只接受
`I1 > I2 > 0`、正有限 `k` 和完整 source range 内有限的预测；没有模型回退和负值裁剪，纯指数
最终趋近 0。返回的 `VacuumExponentialBaselineEstimate` 还包含 `tau_min`、MAD/RMSE、两个窗口斜率
及完整范围预测极值，供人工审核，不给稳定性结论。

持久化类型 `VacuumExponentialBaseline` 另要求 raw SHA-256、来源范围和 review-record 路径/SHA-256；
`VacuumBaselineSettings` 可同时容纳不同 AMU 的常数和指数，但拒绝同一 AMU 重复。数值
`subtract_vacuum_baseline()` 为每个应用 AMU 生成 `m{AMU}_input_a`、
`m{AMU}_baseline_a`、`m{AMU}_signal_a`，其中 baseline 列是每行真正相减的值。指数求值要求匹配的
`acquisition_time_min` 且不允许越出模型来源范围；普通 SDK 不验证文件身份，CLI 才核验 exact raw 或
同源 `temperature.align` ProcessingRecord。

## Calibration background and adsorption plateau

SDK 不提供默认目标物种。CLI 的 `calibration suggest/fit --target SPECIES` 是必填选择；
首次成功 fit 才把该物种和实测因子写入配置。校准输入必须是完整采集记录先扣 vacuum、再执行
fragmentation 后的物种电流表，不能从 raw、只完成一步的表或只覆盖 TPD 升温段的表反推配气平台。
下面片段依赖前文已经得到的 `experiment`，并由调用者把完整采集表定义为 `full_acquisition`。
它还假设研究者已根据实验依据把当前 fragmentation 配置为包含 CO、Ar 的矩阵，且所需观测 AMU
全部存在。fresh 中性单位阵的标签是 `m2/m18/m28/m40/m44`，对应输出为
`m28_resolved_a` / `m40_resolved_a`，不会自动认定为 CO/Ar。
下面是 #2WXQ 与 XLSX 同决定复验的 CO 区间与配气比，不是默认：

```python
from tpx import correct_fragmentation, fit_response_calibration, subtract_vacuum_baseline

vacuum = subtract_vacuum_baseline(
    full_acquisition,
    experiment.vacuum_baseline,
)
fragmented = correct_fragmentation(
    vacuum.frame,
    experiment.fragmentation,
    maximum_condition_number=1e10,
    missing_observed="error",
)

calibration_fit = fit_response_calibration(
    fragmented.frame,
    target_column="co_resolved_a",
    reference_column="ar_resolved_a",
    background_min=(80.0, 95.0),
    plateau_min=(140.0, 170.0),
    expected_molar_ratio=5 / 95,
    background_estimator="median",
    plateau_estimator="mean",
    minimum_points=10,
)
```

`subtract_vacuum_baseline()` 先为每个应用 AMU 生成 `m28_input_a` / `m28_baseline_a` /
`m28_signal_a` 等逐点证据；
`correct_fragmentation()` 必须紧接着执行，并按当前 fragmentation species 标签生成列。本例配置为
CO/Ar 时得到 `co_resolved_a` / `ar_resolved_a`；fresh 中性映射得到
`m28_resolved_a` / `m40_resolved_a`。单位矩阵只表示这次求解不改变数值，不表示
可以跳过函数调用或已经确认了化学身份。

`fit_response_calibration()` 返回内存中的 `CalibrationResult`：乘法因子是
`calibration_fit.factor`，内标平台是 `calibration_fit.reference_plateau_level_a`。final CLI fit
写入 TOML 后，`experiment.response_calibration("CO")` 返回另一类型
`ResponseCalibrationSettings`；其规范持久化字段是 `response_correction_factor` 与
`reference_plateau_current_a`，并额外提供只读 `.factor` 别名。它没有
`reference_plateau_level_a` 别名；下面的 TOML 重放链因此使用 `reference_plateau_current_a`。

普通 SDK `suggest_ratio_calibration_windows()` 仍是无 I/O 计算函数。CLI 的成功
`calibration suggest` 会用专用更新函数按物种保存 provisional
`[calibration_suggestion.<species>]`；它记录目标/内标 AMU 与列、时间列、calibration background /
adsorption plateau、
检测参数、已验证 processing 指纹、输入路径和 SHA256，但不创建或修改 reviewed
`[calibration.<species>]`。可分别读取：

```python
co_provisional = experiment.calibration_suggestion("CO")
latest_provisional = experiment.latest_calibration_suggestion()
```

CO 与 NH3 记录独立，同物种的新建议只替换本物种。`calibration suggest --show` 使用阻塞式临时
三联图显示目标、内标和目标/内标比值；正常关闭且输入/配置哈希未变后才提交。绘图失败、Ctrl-C
或输入变化不写；只有显式 `--plot-output` 才保留永久图片。

`calibration fit` 的参数向导仅从最新、记录了 `vacuum-fragmentation` 且输入 SHA256 仍匹配的记录
预填目标物、输入路径、AMU/列、
时间列、calibration background、adsorption plateau 及建议最低窗口点数，并把接受值展开为显式
argv；最低窗口点数作为 fit 的
`--minimum-points`。`--mixture` 必须人工输入；
`--input` 对 suggest 与 fit 都必填；fit 区间参数只使用 `--calibration-background` 和
`--adsorption-plateau`。直接 CLI 调用也不会把 suggestion 当作隐藏默认值。preview 把 provisional
指标写入 `[calibration_preview.<species>]` 与 `records/<target>_calibration_preview.json`；成功 fit
才把 species-specific 乘法因子及 processing/vacuum/fragmentation 指纹写入 reviewed 校准与
`records/<target>_calibration_fit.json`。两者都不写 CSV；MS 通道本身不保存重复因子。
`calibration preview --compare` 则并列 provisional、本次/显式旧 preview JSON 与 active reviewed 状态。

`--mixture` 是已知配气的 `target_parts:reference_parts`，其中 reference 是 TOML 的
`[reference_gas].species`。例如 CO:Ar 的 `5:95` 生成 `expected_molar_ratio = 5/95`；它不是
目标气体占总量的 `5/100`。向导会在命令预览前校验恰好两个有限正数。

CLI 校准只接受内容 SHA256 对应已完成 vacuum 和 fragmentation processing record 的物种电流表；
文件名或表头都不能替代缺失/不匹配的记录。CLI final fit 把该处理指纹、完整
vacuum/matrix 指纹、实际列和输入哈希持久化供复核。
响应修正方向是：

```text
response_correction_factor = expected_molar_ratio / measured_response_ratio
target_molar_ratio = measured_relative_response * response_correction_factor
```

这里的 calibration background 是通入目标气体之前的目标物种基线，adsorption plateau 是按本次
实际配气比通气后升高并稳定的平台。两者的差值只在 `fit_response_calibration()` 内部用于计算
响应因子，不创建独立背景校正结果，也不是脱附数据的预处理步骤。

## Quantification is four ordinary DataFrame functions

```python
from tpx import (
    calculate_molar_rate,
    calculate_molar_ratio,
    calculate_relative_response,
    calculate_target_flow,
    reference_gas_review_validity,
)

# 仅在本实验已复核的 final fit 写入 TOML 后，才显式查询 CO。
reviewed_calibration = experiment.response_calibration("CO")
gas = experiment.reference_gas
# SDK 调用者自行执行有效性门禁；CLI flow/rate 会强制要求 current。
if reference_gas_review_validity(gas) != "current":
    raise RuntimeError("Show and accept the current reference gas before absolute quantification.")

# `desorption_fragmented` 来自下一节明确的脱附处理支路，不是校准支路的表。
desorption = desorption_fragmented.frame[
    desorption_fragmented.frame["program_time_min"] >= 0
].copy()

relative = calculate_relative_response(
    desorption,
    target_column="co_resolved_a",
    reference_column="ar_resolved_a",
    reference_level_a=reviewed_calibration.reference_plateau_current_a,
    minimum_reference_fraction=0.10,
    sample_name=experiment.name,
)
composition = calculate_molar_ratio(
    relative,
    response_correction_factor=reviewed_calibration.response_correction_factor,
)
flow = calculate_target_flow(
    composition,
    reference_flow_sccm=gas.flow_sccm,
)
rate = calculate_molar_rate(
    flow,
    standard_pressure_kpa=gas.standard_pressure_kpa,
    standard_temperature_k=gas.standard_temperature_k,
)
```

每个函数输入和输出都是 DataFrame，并保留稳定坐标
`row_id`、`program_time_min`、`temperature_fit_c`。每一步同时保留它实际消费的前一数值列：

- `relative`：保留实际传入的两列物种电流，再加 `target_relative_to_reference`；具体列名由当前
  fragmentation 标签决定，fresh 中性映射不自动改成化学物种名；
- `composition`：`target_relative_to_reference`、`target_molar_ratio`；
- `flow`：`target_molar_ratio`、`target_flow_sccm`；
- `rate`：`target_flow_sccm`、`response_umol_min`。

这些 SDK 算子保持通用数值列契约；`tpdtpd quantify` 的 CLI 适配层会在每张输出表增加常量
`target_species` / `reference_species`，使 composition、flow、rate 等窄表单看一行也能辨认物种。

`quantify_response()` 只按这个可见顺序组合四个函数，作为 Python SDK 便利 API；它不保存状态，也不
调度其他处理步骤。当前 CLI 没有 `quantify all`，而是要求显式运行四个 action；每步写一张
multi-target long CSV，并用 `target_species` 区分目标。
这组 DataFrame API 位于 `tpx.quantification`；底层 Curve 变换仍是可单独调用的普通函数。

## Calibration and desorption use explicit correction branches

校准支路固定为 vacuum→fragmentation；带温程坐标的脱附支路也先完成这两步，
然后才可选对 resolved species response 进行 `response_zeroing`。下例展示 Python SDK 的一次单目标调用：

```python
from tpx import (
    ResponseZeroEstimate,
    ResponseZeroing,
    apply_response_zero,
    correct_fragmentation,
    estimate_response_zero,
    subtract_vacuum_baseline,
)

# 完整采集：保留配气前背景和吸附平台，只用于拟合 calibration。
calibration_vacuum = subtract_vacuum_baseline(
    full_acquisition,
    experiment.vacuum_baseline,
)
calibration_fragmented = correct_fragmentation(
    calibration_vacuum.frame,
    experiment.fragmentation,
    maximum_condition_number=1e10,
    missing_observed="error",
)

# 温度对齐后的脱附采集：先扣相同 vacuum，再做 fragmentation。
desorption_vacuum = subtract_vacuum_baseline(
    aligned,
    experiment.vacuum_baseline,
)
desorption_fragmented = correct_fragmentation(
    desorption_vacuum.frame,
    experiment.fragmentation,
    maximum_condition_number=1e10,
    missing_observed="error",
)

# 科研人员先检查一个 target 的坐标、稳定无峰窗口、点数和 offset。
zero_estimate: ResponseZeroEstimate = estimate_response_zero(
    desorption_fragmented.frame,
    target_species="CO",
    coordinate_column="program_time_min",
    zero_window=(-5.0, 0.0),
    estimator="median",
    minimum_points=64,
)
zeroed: ResponseZeroing = apply_response_zero(
    desorption_fragmented.frame,
    target_species=zero_estimate.target_species,
    response_column=zero_estimate.response_column,
    offset_a=zero_estimate.offset_a,
)
```

`ResponseZeroEstimate` 保存 target species、resolved response column、coordinate column、zero window、offset、
estimator、最低点数、实际选中行数、finite points、MAD、SD 与窗内斜率。
`estimate_response_zero()` 要求有限的 `START < END` 区间，并只接受 `*_resolved_a` 列；它不把区间
限定在升温前。研究者可以用 `program_time_min`、`acquisition_time_min` 或 `temperature_fit_c`
选择升温前或峰后尾段的稳定无峰窗口。`apply_response_zero()` 保留坐标和
其他 resolved species，额外写出 `{target}_zeroing_input_a`，并用扣除 offset 后的值更新目标
`{target}_resolved_a`。这是单目标 Python 算子；CLI `estimate` 也逐目标独立审核，但 CLI `apply` 不带
target 参数，会遍历 TOML 中与当前输入及父指纹匹配的全部 estimate，并对每个目标调用该算子。支路历史
不编码进列名，只由 CLI record 与 SHA-256 证明。

真空扣除只处理输入列与已配置本底的 AMU 交集，不把缺失键当作 0，也不裁剪负值；默认缺测
m/z 14 因此不会被合成。常数/指数 AMU 可以混用，返回的 baseline 列明确给出每行实际扣除量。
fresh 五通道矩阵可用 `missing_observed="error"` strict 求解；自定义矩阵只有在研究者
接受部分求解假设时才使用 `"available"`，并检查 applied/skipped、条件数和
`ignored_coupling_max_abs`。

这些 SDK 函数是无文件状态的普通算子。上面的显式检查使用每次 subtraction 返回的
`applied_masses_amu`，即输入通道与 configured baseline 的实际交集，示范了 SDK 调用者应保留的
vacuum 通道覆盖边界；CLI 在其外层还要求 `response_zeroing estimate` 的输入必须是
SHA256 已验证、角色为 `heating_desorption_aligned` 的 `fragmentation.correct` 工件；无 target 参数的
`apply` 还会逐项核对 estimate、target、response column、同一输入和父 processing fingerprint，并只应用
全部匹配项。完整采集校准表、raw 或
手写同名 CSV 都不能通过该门禁。校准仍只接受 full-acquisition vacuum→fragmentation 支路。

四类易混淆量在 SDK 中也保持分离：`subtract_vacuum_baseline()` 处理 fragmentation 前逐 AMU
常数/指数真空电流；calibration background 只进入标定平台增量；`estimate_response_zero()` 处理 fragmentation 后的
每样品每物种常数零点；integration baseline 定义定量后的面积参考线。同一样品的两个峰可共享
一条 reviewed integration baseline 和一个 areas result ID；不同样品的 offset 或 baseline 不共享。

逐 AMU 真空能力位于 `tpx.vacuum`，fragmentation 求解位于 `tpx.fragmentation`，解混响应归零位于
`tpx.response_zeroing`。

## 60 mg normalization

```python
from tpx import normalize_response

normalized = normalize_response(
    rate,
    sample_mass_mg=60,
    sample_name=experiment.name,
)
```

只有已知本样品 BET 时才额外传 `bet_surface_area_m2_g`。绝对速率列始终保留。
表格级 `normalize_response()` 与 Curve 级质量/BET 算子统一位于 `tpx.normalization`。

## Integration and peaks are separate operators

```python
from tpx import (
    BaselineAnchor,
    BaselineSpec,
    GaussianFitSpec,
    GaussianSeed,
    IntegrationSpec,
    Interval,
    PeakSpec,
    curve_from_response_table,
    detect_peaks,
    estimate_baseline,
    fit_gaussian_components,
    integrate_curve,
    suggest_peak_intervals,
)

analysis_frame = normalized.frame[
    normalized.frame["program_time_min"] >= 0
].copy()
curve = curve_from_response_table(
    analysis_frame,
    response_column="response_umol_min",
    response_unit="umol min^-1",
    sample_name=experiment.name,
)

integral = integrate_curve(
    curve,
    IntegrationSpec(
        method="trapezoid",
        interval=Interval(-180, 60, axis="temperature", unit="degC"),
        baseline=BaselineSpec(
            mode="linear",
            left_interval=Interval(-180, -170, axis="temperature", unit="degC"),
            right_interval=Interval(60, 65, axis="temperature", unit="degC"),
            estimator="median",
            # Curve.x 是 program_time_min；SDK 用 "x" 表示沿真实时间连线。
            linear_on="x",
        ),
        clip_negative=False,
        interpolate_bounds=False,
    ),
)

peaks = detect_peaks(
    curve,
    PeakSpec(
        position_axis="temperature",
        interval=Interval(-180, 60, axis="temperature", unit="degC"),
        count=2,
        polarity="positive",
        minimum_separation=40,
        smoothing_window=10,
        minimum_height=None,
        strict=False,
    ),
)
candidate_intervals = suggest_peak_intervals(peaks)
```

若两端直线不能描述缓慢基线曲率，可显式给出两个以上窗口锚点；窗口的响应估计值放在该窗口
`source.x` 的中位数位置，返回的 `resolved_anchors` 保存实际 x/value、估计量和点数：

```python
piecewise = estimate_baseline(
    curve,
    BaselineSpec(
        mode="piecewise-linear",
        anchors=tuple(
            BaselineAnchor(interval=Interval(start, end, axis="temperature", unit="degC"))
            for start, end in ((-180, -172), (50, 90), (130, 190), (220, 240))
        ),
        estimator="median",
    ),
)
```

锚点间只做真实 x 轴上的分段线性插值，外侧保持首末锚点；它不会自动寻找“看起来接近零”的区间。
窗口必须由研究者确认无峰，不能穿过待分析的 −50～50 °C 宽峰。

先显式排除 `program_time_min < 0` 的升温前行。温度是选择坐标；曲线主轴仍是
`program_time_min`，所以积分沿真实时间进行。积分的基线来源可以是事件区间之外的原始 curve。
SDK 调用者仍可直接组合这些普通算子；正式 CLI 则把这一选择放进独立的
`integration baseline preview → 人工审核 → integration baseline accept` 阶段：preview 把计算定义
以 pending 状态写入 experiment TOML，accept 在重新核对输入与定义指纹后改为 reviewed。二者都不写
扣基线 CSV。`integration peaks`、`integration areas` 与 baseline-subtracted 绘图直接从
`normalized.csv` 和 reviewed TOML baseline 复算；峰平滑结果不参与面积计算。

`PeakSpec.smoothing_window` 与位置轴同单位且表示**总宽**；这里的 `10` 是约 10 °C 总宽。
基础 SDK 的 `detect_peaks()` 报当前输入信号的峰高。当前 CLI 的 `integration peaks` 固定从
normalized long table 中选择 `--target`，应用 reviewed baseline 后再调用同一个峰算子；候选摘要写入
`[integration_peaks.<result-id>]`，逐点证据写入 `records/<result-id>_peaks.json`，不生成峰表或曲线 CSV。

`suggest_peak_intervals()` 在检测所用的定向平滑曲线上寻找相邻峰之间的谷底；返回类型和名称都
明确是 suggestion，且不会调用积分器。调用者必须显示这些候选边界并让研究者决定最终区间。
对于已经独立审核并扣除基线的搜索区曲线，可选的纯 NumPy Gaussian 形状拟合也要求显式 seeds：

```python
fit = fit_gaussian_components(
    baseline_subtracted_search_curve,
    GaussianFitSpec(
        seeds=(GaussianSeed(-105, 12), GaussianSeed(-72, 10)),
        position_axis="temperature",
        polarity="positive",
    ),
)
```

模型没有常数或斜率项，不会重新定义基线；结果报告中心、sigma、峰高、RMSE、R²和条件数，但组件
对象故意没有 area 字段。响应对温度的 Gaussian 解析面积不能替代沿 `program_time_min` 的正式积分。

SDK 逐区积分时，`IntegrationResult.region` 是实际参加积分的采样覆盖。若关闭边界插值，调用者不能
只比较两个请求温区是否相接，还应比较前一区间 `region` 的末点和后一区间 `region` 的首点；CLI 的
`actual_gap_ranges` 与 TOML/JSON 中的 `actual_gap_*` 正是按实际温度和程序时间报告这类空档。

`integration areas --preview` 只写审核 JSON 与图片；正式运行才把具名区间、峰位语义、绝对/质量/BET
面积、样品属性快照和输入/基线指纹写入 `[peak_integration.<result-id>]` 与
`records/<result-id>_areas.json`。两种模式都不生成 integration summary/curve CSV。

这里保留的 `BaselineResult.corrected`、`detect_peaks()` 与 `integrate_curve()` 是稳定 Python SDK API，
不代表正式 CLI 仍接受未经审核的
“already corrected”声明。用户可见术语统一为 `baseline-subtracted response`，中文“基线扣除响应”；
它明确表示从含基线响应中减去了经审核的分析基线。SDK 不强制文件审核门，CLI 才强制。

## Small operators and errors

其他可单独调用的算子包括：

- `estimate_vacuum_baseline_windows()` / `estimate_exponential_vacuum_baseline_windows()` /
  `evaluate_exponential_vacuum_baseline()` / `subtract_vacuum_baseline()`
- `vacuum_baseline_snapshot()` / `vacuum_baseline_from_snapshot()` / `vacuum_baseline_fingerprint()`
- `estimate_response_zero()` / `apply_response_zero()`
- `calibrate_ratio()` / `fit_response_calibration()`
- `estimate_baseline()` / `subtract_baseline()`
- `calculate_relative_response()` / `calculate_molar_ratio()`
- `calculate_target_flow()` / `calculate_molar_rate()`
- `divide_by_reference()` / `apply_response_factor()` / `ratio_to_flow()` / `flow_to_molar_rate()`
- `normalize_rate_by_mass()` / `normalize_rate_by_surface_area()`
- `align_by_coordinate()`

可预期错误继承自 `TPXError`：`UsageError` 表示参数或 API 使用错误，`DataError` 表示
实验数据不满足计算条件。
