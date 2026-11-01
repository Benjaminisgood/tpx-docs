# Scientific workflow is explicit code

科研人员决定每一步的输入、参数和输出。代码提供普通函数、可检查表格与必要校验，不保存
隐藏的流程判断。schema 4 TOML 保存稳定实验事实、仪器配置、reference 审核状态、逐 AMU 常数/指数
真空模型、
自动但尚未人工确认的温度建议与按物种校准选区、人工复核校准、按物种的响应归零/分析基线计算
状态，以及输出工件身份与父链 ProcessingRecords；这些状态不会自动执行下一步。
进入数值处理前，可先用只读命令同时检查 schema 4 TPD 配置及其指向的 RGA/温控数据：

```bash
tpdtpd config inspect experiment.toml --require-mass 28 --require-mass 40 --json
```

它始终严格加载 schema 4 配置并读取两个原始数据源，不修改 TOML 或产生阶段文件。
`--require-mass` 可重复，用于把下一步真正依赖的实测 AMU 变成显式失败门禁；省略时不额外要求通道。

fresh init 中的 reference 是 `inherited-unreviewed`；vacuum 从当前 AMU→常数电流初值开始，并可按
AMU 改为与当前 raw acquisition 绑定的纯指数。
reference 使用完整记录的 `show → set（如需）→ show → accept`；vacuum 使用
`show（必选模型，逐 AMU 独立选窗）→ 人工检查 JSON/图片 → set → subtract`；共享窗口直接替换整张
真空电流表的旧入口已经删除。未审核 reference 阻止消费流量/标态的
`quantify flow/rate`；relative/composition 仍可作为非绝对结果检查。

```bash
tpdtpd vacuum show experiment.toml \
  --input raw/calibration.csv \
  --baseline-model exponential \
  --signal-window 28 1.0 3.0 \
  --signal-window 28 24.0 27.5 \
  --estimator median \
  --minimum-points 3

# 人工检查默认 JSON/图片后：
tpdtpd vacuum set experiment.toml \
  --review-record records/vacuum_baseline_review.json
```

`--baseline-model` 必填且无默认。constant 每个 AMU 恰好一个窗口；exponential 每个 AMU 恰好两个
按输入顺序排列、严格分离且不重叠的首尾窗口。指数以窗口统计量为 `I1,I2`、有限样本时间中位数为
`t1,t2`，计算 `b(t)=I1*exp[-k*(t-t1)]` 与 `k=ln(I1/I2)/(t2-t1)`；只接受
`I1 > I2 > 0` 和完整 raw 范围内有限的正衰减，最终趋近 0，不回退其他模型或裁剪负结果。

真实 #2WXQ 的 CLI 分步工件、XLSX 公式、人工区间选择和最终差异见
[`20260811 #2WXQ：CLI 分步处理与 XLSX 人工处理`](co-tpd-2wxq-example.html)。

## Data flow can be read directly

下面代码只展示普通 SDK 的**数值调用顺序**，不是 CLI 审计链的等价替代：这些函数不会自动检查
reference 审核状态、vacuum 配置指纹或处理父链，不会创建或验证 `[[processing_record]]`，也不会把内存中的 calibration
写回 TOML。需要内容哈希、父链、配置指纹和 absolute-quantify 门禁时，应使用对应 CLI，或由调用者
显式实现并验证这些边界。

示例明确选择 CO/m/z 28，并假设研究者已经依据当前实验把 fragmentation 配置为包含 CO 与 Ar 的
运行矩阵，且矩阵所需的全部观测 AMU 都存在。fresh 配置只有中性标签
`m2/m18/m28/m40/m44`；其单位阵会生成 `m28_resolved_a` / `m40_resolved_a`，不会
自动作出 CO/Ar 化学身份认定。完整采集的校准支路依次经过 vacuum 与 fragmentation，再用
吸附/配气段拟合 calibration；下面的 Python SDK 示例在 fragmentation 之后演示一次单目标
`response_zeroing` 调用。CLI 则逐 target estimate，并由无 target 参数的 apply 一次处理全部匹配状态。

```python
from datetime import datetime

from tpx import (
    TemperatureProgramSettings,
    align_rga_to_temperature,
    calculate_molar_rate,
    calculate_molar_ratio,
    calculate_relative_response,
    calculate_target_flow,
    correct_fragmentation,
    estimate_response_zero,
    fit_response_calibration,
    fit_temperature_program_reviewed,
    load_experiment_config,
    normalize_response,
    read_rga_csv,
    read_temperature_log,
    reference_gas_review_validity,
    shift_temperature_fit,
    shift_temperature_timeline,
    apply_response_zero,
    subtract_vacuum_baseline,
    suggest_temperature_program_window,
)
from tpx.signal_table import aligned_signal_frame

experiment = load_experiment_config("experiment.toml")
if reference_gas_review_validity(experiment.reference_gas) != "current":
    raise RuntimeError("Show and accept the current reference gas before absolute quantification.")

temperature_settings = TemperatureProgramSettings(
    model="polynomial",
    polynomial_degree=18,
    polynomial_monotonic_tolerance_c=0.23,
)
rga, start_time = read_rga_csv(experiment.rga_csv)
temperature = read_temperature_log(
    experiment.temperature_log,
    start_time,
    clock_elapsed_tolerance_s=0,
)
suggestion = suggest_temperature_program_window(temperature, temperature_settings)

# suggestion 只供判断；这里采用 #2WXQ 与 XLSX 同决定复验的实测参数，不是默认值。
reviewed_heat_start = datetime.fromisoformat("2026-08-04T16:34:21")
reviewed_heat_end = datetime.fromisoformat("2026-08-04T17:18:21")
fit, fit_table = fit_temperature_program_reviewed(
    temperature,
    temperature_settings,
    heat_start=reviewed_heat_start,
    heat_end=reviewed_heat_end,
)
# CLI 将 fit_table 保存为人工审阅 CSV，把 fit 保存为纯计算 .tpxmodel，
# 再用独立 fit-record JSON 绑定来源、参数、诊断和两项输出哈希。
shifted_temperature = shift_temperature_timeline(temperature, offset_s=0)
shifted_fit = shift_temperature_fit(fit, offset_s=0)
aligned_full = align_rga_to_temperature(
    rga,
    shifted_temperature,
    shifted_fit,
    out_of_bounds="drop",
)
aligned = aligned_signal_frame(aligned_full)

calibration_vacuum = subtract_vacuum_baseline(
    rga,
    experiment.vacuum_baseline,
)
calibration_fragmented = correct_fragmentation(
    calibration_vacuum.frame,
    experiment.fragmentation,
    maximum_condition_number=1e10,
    missing_observed="error",
)

# 这里的 5:95 仅是本次示例；真实代码使用当前实验实际 target:Ar 配气比。
calibration_fit = fit_response_calibration(
    calibration_fragmented.frame,
    target_column="co_resolved_a",
    reference_column="ar_resolved_a",
    background_min=(80.0, 95.0),
    plateau_min=(140.0, 170.0),
    expected_molar_ratio=5 / 95,
    background_estimator="median",
    plateau_estimator="mean",
    minimum_points=10,
)

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

# Python SDK 的一次调用只处理一个 target；该 target、坐标、稳定无峰窗口与最低点数必须经人工复核。
zero_estimate = estimate_response_zero(
    desorption_fragmented.frame,
    target_species="CO",
    coordinate_column="program_time_min",
    zero_window=(-5.0, 0.0),
    estimator="median",
    minimum_points=64,
)
zeroed = apply_response_zero(
    desorption_fragmented.frame,
    target_species=zero_estimate.target_species,
    response_column=zero_estimate.response_column,
    offset_a=zero_estimate.offset_a,
)

desorption = zeroed.frame[
    zeroed.frame["program_time_min"] >= 0
].copy()
reference_gas = experiment.reference_gas
relative = calculate_relative_response(
    desorption,
    target_column="co_resolved_a",
    reference_column="ar_resolved_a",
    reference_level_a=calibration_fit.reference_plateau_level_a,
    minimum_reference_fraction=0.10,
)
composition = calculate_molar_ratio(
    relative,
    response_correction_factor=calibration_fit.factor,
)
flow = calculate_target_flow(
    composition,
    reference_flow_sccm=reference_gas.flow_sccm,
)
rate = calculate_molar_rate(
    flow,
    standard_pressure_kpa=reference_gas.standard_pressure_kpa,
    standard_temperature_k=reference_gas.standard_temperature_k,
)

normalized = normalize_response(
    rate,
    sample_mass_mg=60,
)
```

`aligned_signal_frame()` 把活动质量信号统一为 `m{AMU}_signal_a`；`subtract_vacuum_baseline()`
随后扣除输入通道与 configured baseline 交集中的逐 AMU 常数/指数真空模型，并为每个应用 AMU
保留 input/baseline/signal 三列。示例紧接着检查返回结果的
`applied_masses_amu`，因此门禁覆盖本次实际扣除的全部 AMU，而不是拿 fragmentation AMU 代替。
两条支路都直接调用 `correct_fragmentation()`，并按当前
fragmentation 的 species 标签生成 `{species}_resolved_a`。本例显式假设标签是 CO/Ar；fresh
中性映射的对应列则是 `m28_resolved_a` / `m40_resolved_a`。脱附支路随后可选调用
`estimate_response_zero()` / `apply_response_zero()`；这两个 Python SDK 算子的一次调用只处理一个目标，
其他 species 原样保留。CLI 的 `estimate` 同样每次审核一个 target，但无 target 参数的 CLI `apply` 会对
当前输入和父指纹仍匹配的全部 pending estimate 逐一复算，并在这一显式动作中接受和应用。
对应 CLI 合同是
`--coordinate-column {program_time_min|acquisition_time_min|temperature_fit_c} --zero-window START:END`；
负数范围必须用等号形式，例如 `--coordinate-column program_time_min --zero-window=-5:0`。estimate 默认生成
归零前/后完整曲线与所选窗口的四面板图；人工看图后才执行 apply。estimate JSON 只作记录/展示，
不参与 apply 计算。

calibration background 是通入 CO 前的 CO 基线，adsorption plateau（图中 mixture plateau）是按
本次实际 CO:Ar 比例通气后升高并稳定的平台；二者的差值只用于 calibration 拟合，calibration
background 绝不从脱附曲线中扣除。

mixture plateau 优先选同一次持续通入标气的**稳定平台后段**，让样品吸附有更充分的平衡时间，
降低尚在吸附过程中的出口响应偏差。先确认完整通气平台，再避开切阀尖峰、流量改变和关气下降沿，
保留可见的边缘间隔；不是去选整份 acquisition 的末尾或关气后的内标平台。目标信号、内标信号
及其比值都应有稳定性依据，并核对斜率、CV、异常点和有效点数；窗口要有足够时长，不能只截末尾
几个点。后段仍漂移、受扰或点数不足时，不应硬把窗口向后推，应说明限制并比较有依据的较早窗口。
后段平坦本身不证明吸附已平衡；先用 preview 比较窗口和必要的邻窗因子敏感性，再由研究者确认
final fit 的显式区间。此选窗原则不改变 suggest 算法，也不把建议或检查通过当作科学接受。

`response_zeroing` 则是 aligned
脱附工件中、fragmentation 后的每样品每物种常数归零；稳定无峰窗口可在升温前或峰后尾段。
它不进入 calibration，也不替代定量后的峰面积 integration baseline。再加上 fragmentation 前的逐 AMU
常数/指数 vacuum 电流，这是四个不能互相替代的背景/基线概念。
若保持 fresh 中性 fragmentation，它是与可用真空通道自洽的 2/18/28/40/44 五通道单位阵，
所以 strict `missing_observed="error"` 可执行，但只生成中性物种列。本例改为 CO/Ar 等经实验依据
配置的矩阵后，同样必须覆盖其全部观测行；未测 m/z 14 始终缺失，不补 `0 A`。只有人工配置的矩阵
确实缺少观测列且科研人员接受部分求解假设时，才使用 `"available"` 并检查 skipped 通道和
ignored coupling。

默认温度建议没有隐藏的 -180/250 °C 锚点：它从实测与设定温度共同升温的候选中按共同温升
选择主段，以局部前平台离开点提出起点，以升温后第一个连续确认平台提出终点。调用者必须检查
候选支撑区间、两条温升、候选优势和歧义 warning；`suggestion.ramp_candidates` 保留所有候选。
其中 `ramp_support_*` 是斜率检测支撑区间，`heat_start/heat_end` 是最终建议边界，两者不同属
正常结果。只有已有温度依据时才成对提供起止 hint。CLI 的 `temperature suggest --show`
可用阻塞式临时窗口查看全程、起止放大和全部候选表；它不保存图片或阶段文件，正常关闭后才
原子写入 `[temperature_suggestion]` 并输出默认人类报告；脚本调用应在首次执行时使用
`--json` 并读取机器 stdout，
绘图失败或中断则不提交配置。

温度 CLI 对应 `suggest → fit → align` 三步：成功 suggest 保存的仍是自动建议，不是 reviewed
fit，也不会自动执行下一步。fit 参数向导仅在 TOML 记录的 RGA/温控源 SHA256 仍匹配时允许
按 Enter 接受建议；随后把两个边界和用户主动修改的默认参数展开到可复制命令。源文件变化后
必须重新 suggest。CSV 是人工审阅工件，`.tpxmodel` 是 align 精确重放的纯计算模型，独立 fit
record 才保存来源、参数、诊断和配对哈希；align 只以 `.tpxmodel` 参与数值计算，CSV 与 fit record
分别保留人工审阅和审计职责。
打开代码即可看到数据来自哪里、
进入哪个函数、返回什么。真空本底和碎片矩阵只有在科研人员明确调用相应函数时才出现，
不由配置开关启动。
内存结果 `CalibrationResult` 的规范字段是 `factor` 与 `reference_plateau_level_a`；final CLI fit
写入 TOML 后，`ResponseCalibrationSettings` 的规范持久化字段是 `response_correction_factor` 与
`reference_plateau_current_a`，同时为乘法因子提供只读 `.factor` 别名。后者没有
`reference_plateau_level_a` 别名，所以平台电流仍应使用与实际类型匹配的字段名。
`quantify_response()` 只是上述四函数的直接便利组合，不是 Recipe、Pipeline 或隐式 workflow。
源码按能力分布在 `tpx.vacuum`、`tpx.fragmentation`、`tpx.response_zeroing`、`tpx.calibration`、
`tpx.quantification` 和 `tpx.normalization`；这些算法不含 TPD 专属假设，因此不放进方法 CLI 包，也不再经过
含义模糊的 `tpx.experiment` 聚合模块。

校准 CLI 同样把机器建议与人工 fit 分开。`calibration suggest --show` 在完整目标信号、内标信号
和目标/内标比值三个面板上标出建议 calibration background/adsorption plateau；窗口正常关闭且
输入与配置 SHA256 未变后，才按物种原子写入 provisional `[calibration_suggestion.<species>]`。
绘图失败、Ctrl-C 或输入
变化不写；显式 `--plot-output` 才保存永久图片。CO 和 NH3 的 suggestion 独立存在，任何一条都
不是 reviewed calibration，也不提供响应因子。

`calibration fit` 向导只允许从最新且输入 SHA256 仍匹配的记录按 Enter 接受目标物、输入/列/AMU/
时间选择、calibration background、adsorption plateau 及建议最低窗口点数，并把它们显式展开进
argv；该点数成为 fit 的显式
`--minimum-points`，`--mixture` 仍由科研人员输入。`--input` 对 suggest 和 fit 都必填，直接 CLI
调用没有 suggestion 隐式默认。
fit 的区间参数名是 `--calibration-background` 与 `--adsorption-plateau`。输入内容 SHA256 必须解析到
完成 vacuum→fragmentation 的 processing record；文件名和表头都不能替代这条记录。
`calibration preview` 把 provisional 指标写入 `[calibration_preview.<species>]`，详细证据默认写入
`records/<target>_calibration_preview.json`；它不提交 reviewed 配置，也不写 CSV。只有 final fit
成功后，才把实际列、指标、输入哈希及 processing/vacuum/fragmentation 指纹写入
`[calibration.<species>]`，并留下 `records/<target>_calibration_fit.json`。
`calibration preview --compare` 可在同一 preview 结果中并列 provisional、本次/旧 preview 与
active reviewed；`--compare-preview-record` 可重复提供旧 preview JSON。quantify 仍只使用 active reviewed。

脱附 quantify 可以使用与 calibration 相同修正设置的 aligned vacuum→fragmentation 支路，也可以使用
vacuum→fragmentation→response_zeroing 支路；后一种只有在 apply 的精确父记录是已验证 aligned
`fragmentation.correct` 工件时才成立。两条支路仍必须使用与
active reviewed calibration 相同的 vacuum 和 fragmentation 配置指纹。

## CSV files are decision boundaries

当前 35 个 CLI 叶动作中只有 10 个动作写 CSV；每次各写一张。从原始数据同时重跑完整校准支路与
脱附支路时，不使用响应归零共 11 张，使用 `response_zeroing apply` 共 12 张。默认 CSV 都位于
其输入旁；`temperature_fit.csv` 位于 experiment TOML 旁，不再自动建立 role 目录。

- `temperature_fit.csv`：人工审阅工件；逐行比较明确边界内的记录温度与拟合温度。
- `temperature_model.tpxmodel`：纯计算工件；使用严格、可读的 TOML 保存边界、单位、平台值、
  模型类型、系数或插值节点。它是 align 的唯一数值模型来源，不保存运行、来源、诊断或其他工件哈希；
  默认位于 experiment TOML 同级，canonical `records/` 目录中的模型会被拒绝；该后缀只用于程序
  升温模型，响应归零和分析基线状态直接写入现有 experiment TOML。
- `records/temperature_fit_record.json`：拟合审计清单；保存工具版本、相对实验根目录的来源/输出路径、
  有效参数、诊断和 SHA-256，并把 model 与人工审阅 CSV 配成同一次 fit；它只用于记录/展示，不重复
  模型系数或节点，删除后不影响 align。
- `aligned.csv`：检查温度坐标、时钟和活动 `m{AMU}_signal_a`；`rga_elapsed_hms` 是 HAL 相对
  `HH:MM:SS`，不是绝对时间。
- `[calibration_suggestion.<species>]`：可选 provisional TOML 工件；保存
  `vacuum-fragmentation` 处理历史、输入选择、建议区间、
  检测参数和输入哈希，不是响应校准结果。
- `calibration_suggestion.png`：仅在显式 `--plot-output` 时产生；临时 `--show` 窗口不落盘。
- `records/vacuum_baseline_review.json` 与输入旁的 `vacuum_baseline_review.png`：`vacuum show`
  对完整 raw HAL 信号逐 AMU 使用必选 constant/exponential 模型及独立 `--signal-window` 生成的
  pending 审核材料。常数显示完整曲线和一个窗口；指数显示完整 raw、指数曲线、两个窗口、扣除后
  曲线和零线，并记录锚点、`k/tau`、残差、窗口斜率与完整范围基线极值。二者都不修改 TOML、
  不生成 CSV，也不自动判断稳定或接受。
- calibration preview/fit 不写 CSV：科学状态分别进入
  `[calibration_preview.<species>]` 与 `[calibration.<species>]`，详细证据进入 `records/*.json`。
  vacuum 候选模型只进入审核 JSON/图片；人工检查后才由 `vacuum set --current` 写常数，或由
  `vacuum set --review-record` 核对 config/raw SHA-256 后接受记录。常数写入
  `[vacuum_baseline.currents_a]`；指数写入 `[vacuum_baseline.exponential."<AMU>"]`。同一 AMU
  的新模型替换旧模型，未点名 AMU 保持不变。
- `calibration_vacuum.csv` / `desorption_vacuum.csv`：两条正式支路的职责名；角色无法从输入和
  ProcessingRecord 确认时才回退为 `vacuum.csv`。每个已应用 AMU 保留 `m{AMU}_input_a`、逐行
  `m{AMU}_baseline_a` 并输出活动 `m{AMU}_signal_a`；检查两类缺失清单。初始化默认 baseline
  省略未测 m/z 14，vacuum 只处理输入与 baseline 的交集，不生成伪造的 `m14_signal_a`，也不裁剪
  负值。指数模型只接受 SHA-256 绑定的 exact raw 或 ProcessingRecord 证明同源且未越出审核范围的
  `temperature.align` 子表。
- `calibration_fragmentation.csv` / `desorption_fragmentation.csv`：两条正式支路的职责名；角色
  无法确认时才回退为 `fragmentation.csv`。实际消费的质量信号保留为 `m{AMU}_input_a`；真物种输出为
  `{species}_resolved_a`；检查矩阵条件数和负解。若使用
  `--missing-observed available`，还要检查 applied/skipped 及 ignored coupling；单位阵仍要执行，
  输出值不变但生成物种列与处理记录。fresh 五通道单位阵可 strict 求解。
- `[response_zeroing.<species>]`：estimate 写入 experiment TOML 的计算状态，保存 target、resolved
  response column、coordinate column、zero window、estimator、最低点数、offset、源输入 SHA256 和 aligned
  fragmentation 父指纹；状态是 pending。默认的 estimate JSON 与四面板 PNG 只作记录/展示，
  JSON 删除后不影响 apply；人工看图后显式 apply 才接受并应用。
- `response_zeroed.csv`：对当前输入和父指纹仍匹配的每个 target，分别保留
  `{target}_zeroing_input_a` 并更新活动 `{target}_resolved_a`；没有匹配 estimate 的 resolved species
  原样通过。
- `relative.csv`：第一张 multi-target long 表，加 `target_relative_to_reference`；每行用
  `target_species` / `reference_species` 明确化学身份。
- `composition.csv`：前一步比值加 `target_molar_ratio`。
- `flow.csv`：摩尔比加经 TOML 内标流量换算的 `target_flow_sccm`。
- `rate.csv`：目标流量加经 TOML 标准状态换算的 `response_umol_min`。
- `normalized.csv`：保留 `response_umol_min` 并增加质量/BET 口径；BET 未知时不产生 BET 列。
- integration baseline、peaks 和 areas 不写派生 CSV。基线定义、候选峰摘要和正式面积分别进入
  `[integration_baseline.<target>]`、`[integration_peaks.<result-id>]` 与
  `[peak_integration.<result-id>]`；逐点证据进入 `records/*.json`。

文件名只表达当前责任，不累积处理历史；交互向导可以推荐 experiment TOML 中记录的当前状态和
输出工件，但不会自动执行上一步。文件名和表头都不是工件身份：vacuum、fragmentation 与
response_zeroing apply 的 ProcessingRecords 保存实际输出、输入/输出 SHA256、参数指纹和父记录；真空与 fragmentation
还保存各自配置指纹。response_zeroing 必须以 `heating_desorption_aligned fragmentation.correct`
为父记录，无 target 参数的 apply 必须同时匹配 experiment TOML 中全部已应用 estimate 状态和该父记录。
下游按内容哈希解析记录；
只有该哈希对应一个无歧义语义身份时，安全改名仍可用，
多个 stage/role/fingerprint 共享相同字节时必须拒绝。伪造文件名或表头不能跳过处理。
quantify 还比较 active
calibration、当前配置和脱附工件三方指纹。vacuum fingerprint 包含实际应用 AMU 的模型类型、系数、
时间坐标和来源 SHA-256；修改任一 vacuum 模型或 fragmentation 后旧 calibration 与下游谱系必须拒绝。
这里的内容寻址谱系由 CLI adapter 建立并由具体 consumer 强制检查；上面的普通 SDK 数值调用本身
不会获得这些保证。
真实实验运行还应优先使用 CLI 职责型默认 basename；只需更换 output 目录时保留 basename，
仅改父目录。不擅自加 `fresh`、`final`、`v2`、日期或时间戳。没有 CLI 默认值的 `--result-id`
是 TOML 科学身份，应复用已审核的稳定 ID 或使用最小职责型 ID。
temperature align 只以 `.tpxmodel` 作为模型计算输入；省略 `--model-input` 时采用 experiment TOML
同级的 canonical 模型。当前 RGA 与温控日志来自 experiment TOML，时钟重建容差、时钟偏移和
越界策略来自本次 align 的默认值或显式覆盖值。成功后，
`temperature.align` ProcessingRecord 记录 aligned 表的实际输入/输出 SHA-256，并让
alignment fingerprint 绑定当前源字节、`.tpxmodel`、实际信号输入与 align 参数。
fit CSV 负责人工复核，fit record 负责一次拟合的来源/参数/诊断/配对；两者都不驱动 align，
fit record 缺失或篡改只影响拟合审计状态，不会阻断 aligned anchor 或其下游计算谱系。
ProcessingRecord 只负责 aligned 之后已写出信号工件的身份与父链；工作流插件的运行记录及日志
负责一次进程的 argv/stdout/stderr/退出状态，保存在实例状态目录，不属于实验 TOML。任何一层哈希一致都不是数字签名，也不是科研人员对边界、模型或结论的接受。
四张定量表和 `normalized.csv` 都是 multi-target long format，共同保留 `row_id`、
`program_time_min`、`temperature_fit_c`、`target_species` / `reference_species`；多个 target 不会
把文件数按物种相乘。

## Integration and peaks are siblings

```python
from tpx import (
    BaselineSpec,
    IntegrationSpec,
    Interval,
    PeakSpec,
    curve_from_response_table,
    detect_peaks,
    integrate_curve,
)

analysis_frame = normalized.frame[
    normalized.frame["program_time_min"] >= 0
].copy()
curve = curve_from_response_table(
    analysis_frame,
    response_column="response_umol_min",
    response_unit="umol min^-1",
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
```

这些区间、基线与峰参数是 #2WXQ 同决定复验的示例，不是库默认值；每个实验都必须重新审核。
`program_time_min >= 0` 是显式筛选，不是函数内的隐藏默认。面积不会因为没有可靠峰而
消失；峰识别也不会暗中决定积分边界或基线。温度只选择数据区域，面积沿真实
`program_time_min` 计算。

正式 CLI 使用统一的 `integration` 命令族。`integration baseline preview` 把 normalized 输入哈希、
模型和取样参数写入 `[integration_baseline.<target>]`，状态为 pending，并写 review JSON/图片；科研人员
确认后运行 `integration baseline accept`，CLI 重新核对输入和定义指纹，再把状态改为 reviewed。
两步都不生成 baseline-subtracted CSV。

`integration peaks` 从 `normalized.csv` 和 reviewed baseline 复算基线扣除响应，使用显式
`--result-id` 把未审核候选摘要写入 `[integration_peaks.<result-id>]`，逐点证据写入
`records/<result-id>_peaks.json`。`--smoothing-window-c 6` 是约 6 °C 总宽（约 ±3 °C），不是
6 °C 半窗；候选峰、相邻谷底和探索性 Gaussian 拟合都不会自动成为正式积分边界或面积。

`integration areas` 同样从 normalized 输入与 reviewed baseline 复算。正式区间必须由研究者通过
`--start-c/--end-c` 和可重复 `--interval` 明确给出；`--preview` 只写
`records/<result-id>_areas_review.json` 与审核图，正式调用才把具名区间、峰位语义、面积、样品属性
快照和输入/基线指纹写入 `[peak_integration.<result-id>]` 及 `records/<result-id>_areas.json`。
它不生成 summary/curve CSV。正式区间超出 reviewed baseline 范围时默认拒绝；只有研究者明确给出
`--allow-endpoint-held-extension` 才允许端点保持外延，并把 override 和警告写入记录。通常应回到
baseline preview，扩大经审核范围。

`plot response --response-mode baseline-subtracted` 也直接读取 `normalized.csv`，按 `--target` 选择
物种，并用 TOML 中 reviewed baseline 重算显示曲线；不依赖历史扣基线 CSV 或 integration JSON。

若曲线存在重叠峰，可在 `integration peaks` 中重复给出显式
`--gaussian-seed CENTER_C:SIGMA_C`，运行默认关闭的探索性 Gaussian 形状拟合；负温中心使用
`--gaussian-seed=-100:10` 这样的等号写法。该拟合不含新的
常数或斜率基线，不改变普通峰检测结果，并且故意不报告解析面积：响应对温度的面积不能替代沿
`program_time_min` 得到的正式脱附量。

## Repeating a decision

若一个分析基线不可信，重新 preview 一套参数；它会替换该 target 当前 pending 定义，但不会伪装成
reviewed。需要保留多个科学分支时应复制配置，而不是依赖不同 CSV 文件名。存在缓慢曲率时可 preview
一条多锚点分段线性基线：

```bash
tpdtpd integration baseline preview experiment.toml \
  --input normalized.csv --target CO \
  --response-column response_umol_min \
  --response-unit 'umol min^-1' \
  --program-time-start-min 0 \
  --baseline-program-time-range-min 0:60 \
  --start-c -180 --end-c 240 \
  --baseline piecewise-linear \
  --baseline-anchor-range-c=-180:-172 \
  --baseline-anchor-range-c=50:90 \
  --baseline-anchor-range-c=130:190 \
  --baseline-anchor-range-c=220:240 \
  --baseline-estimator median

tpdtpd integration baseline accept experiment.toml \
  --input normalized.csv --target CO
```

上例故意省略 `--record-output` 和 `--plot-output`，使用 CLI 默认 basename。如果只需改到指定
output 目录，保留 basename 并仅改父目录；不擅自加 `fresh`、`final`、`v2`、日期或时间戳。

每个 anchor 窗的响应估计值放在该窗实际程序时间的中位数上，锚点之间沿真实程序时间连线。
预览同时显示温度轴和程序时间轴，并在 review record 中保存点数、实际覆盖、MAD 与窗内趋势。
这些窗口不能穿过疑似峰；例如怀疑 −50～50 °C 有宽峰时，不能用该温区把信号强制归零。

先用 `integration peaks` 查看候选峰和谷底，再由科研人员把确认后的第一个温区写入
`integration areas --start-c/--end-c --interval-name NAME`，其余温区用可重复的
`--interval NAME START_C END_C` 明确追加。例如：

```bash
tpdtpd integration peaks experiment.toml \
  --input normalized.csv --target CO --result-id co_candidates \
  --basis absolute --start-c -180 --end-c 240 \
  --minimum-separation-c 40 --smoothing-window-c 15

tpdtpd integration areas experiment.toml \
  --input normalized.csv --target CO --result-id co_integration \
  --start-c -180 --end-c -80 --interval-name peak-1 \
  --interval peak-2 -60 80 --preview

# 人工确认同一 argv 后去掉 --preview，才写正式 TOML 面积与 records JSON。
```

preview 不写正式峰结果 TOML；确认后去掉 `--preview` 才按稳定 `--result-id` 新增或替换
`[peak_integration.<result-id>]`。结果同时披露请求温区间隙和
实际积分采样覆盖间隙；所以关闭边界插值时，即使两个请求区间相接，也不会隐藏落在相邻采样点
之间的未积分温度/程序时间空档。正宽度重叠则拒绝，不能把简单分区表述为重叠峰解卷积。
同一样品、同一 target 的两个峰共享 reviewed baseline 时，就像上例一样用一次 areas、一个
`result-id` 和多个具名区间。如果 response zeroing 后已经科学接受零线且无峰区接近 0，
可优先审核零 integration baseline，让该样品的两个峰共享数值 0。这不表示不同样品共享同一个
response-zero offset 或 baseline；各样品必须在自己的 experiment TOML 中独立审核。零基线不接收
`--baseline-estimator` 或 `--linear-on`。常数标量基线同样不接收它们；只有基线源是温区范围时
才需要 estimator，只有线性基线才需要 `linear-on`。
积分阶段默认只使用实际采样点，并在 TOML/JSON 并列 requested/actual bounds；显式
`--interpolate-bounds` 才会插入请求边界，且要求两个边界都在数据范围内。

对比 preview JSON、图片和默认终端报告后，再选择用于论文的正式规则；脚本需要机器结果时应在首次
执行中使用 `--json` 并捕获 stdout，不要为 JSON 重跑。响应归零 estimate、分析基线、候选峰摘要与
正式面积状态写入 experiment TOML；详细逐点证据进入 `records/`。未显式给峰位置时这里只记录
区间内积分响应最大采样点 `Tmax`；只有 `reviewed-explicit` 才能在图中称为 `Tp`。找峰参数、绘图样式
和 provisional preview 不写入正式面积结果。suggestion 段不能当成人工确认的温度模型或响应校准。

正式单样图默认使用 `plot response --display-range program`，即程序零点到第一次最高温的完整升温支路，
并在 normalized 输入与 TOML 指纹仍匹配时标出 `Tmax/Tp` 和当前 basis 面积。`analysis` 只显示
审核基线范围，`custom` 才接受成对温度边界。默认图名包含目标物种、total/baseline-subtracted、basis
和范围，避免 CO、乙烷或多种纵轴互相争用一个 `response_program.png`。

跨实验比较使用 `plot comparison --series LABEL CONFIG INPUT`（至少两次）和显式 `--output`。默认三行
分别显示 absolute、mass-umol 与 BET，横轴是完整升温支路并集，每条曲线不超出自身实测范围。任一
样品缺 BET 或正式 BET 面积时整张图失败，不静默降级。完整 total-response 曲线只作为温程骨架；逐峰
面积仍来自各样品自己的 reviewed baseline 定义，同样品多峰可共享该定义；禁止把
endpoint-held extension 当作另一峰的正式基线。
