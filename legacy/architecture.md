# Architecture

## Boundary

TPX 由独立的 nanobot 运行时、WebUI、项目插件、科学 CLI 与 SDK 组成。`tpxtpxtpx/`
维护聊天、Provider、会话和插件；`tpxtpx/` 提供命令目录、control v1 与科学 CLI；`tpx/`
保存数值算法。三个 Python 包直接位于仓库根目录。`webui/` 是浏览器客户端，`tui/` 是可选
终端客户端，`labcode/` 保存可检查的实验室脚本，`labview/` 预留实验室程序接入。

正式步骤的调用方向为：

```text
nanobot catalog/describe → 参数卡或实验处理页面
  → workflow prepare → control.prepare → 用户审阅并点击运行
  → workflow 检查一次执行身份 → control.revalidate → 核对输入哈希
  → 固定 Python module + argv → tpdtpd CLI → tpx SDK
  → 运行记录、日志与工件 → 人工检查并决定下一步
```

控制层读取真实解析器并统一验证参数、生成 argv、绑定配置与运行时身份。工作流插件承担
准备、执行门禁、状态、日志、取消和运行记录；浏览器提供参数编辑、计划审阅与结果展示。
Agent 的工作流工具可查目录、准备卡片和读取结果，执行必须来自用户在宿主中的操作；不能
通过消息中的哈希或 `user_confirmed` 字段取得执行资格。每次执行重新核对冻结计划和输入，
科学接受仍由研究者明确完成。完整协议见[控制层说明](control-protocol.md)，交互见
[实验助手](experiment-assistant.md)，来源和部署边界见[迁移说明](nanobot-migration.md)。

`tpx` 不导入 CLI。CLI 模块只负责 `argparse`、显式文件路径、参数适配、调用普通 SDK
函数、写阶段工件，并输出默认人类报告或显式 `--json` 机器 stdout。`--json` 本身不额外创建
旁车文件；脚本必须在首次执行时选择它，不能为了取得 JSON 重跑计算。阶段合同可以另外要求
专用记录，例如 `temperature fit` 自动生成的拟合清单。
科学计算不放在 dispatcher 中。
所有产生阶段结果的 leaf action 都共享同一个输出契约：默认报告优先显示产物、核心结果、来源
SHA256 和实际参数；显式 `--json` 保留稳定的
`schema_version/stage/timestamp_utc/inputs/outputs/parameters/result` 结构。输出模式不依赖 TTY，
因此脚本不会因重定向方式而获得不同语义。

## Schema 4 stores durable facts, not workflow state

一次实验对应一个 schema 4 TOML，按阅读顺序保存：

```text
[experiment]                         实验名称与方法
[files]                              RGA CSV 与温控日志
[temperature_suggestion]             自动、尚未人工确认的边界建议及来源哈希（成功 suggest 后才有）
[temperature_suggestion.parameters]  当次实际建议参数与时钟容差
[sample]                             已知时才写质量和 BET
[reference_gas]                      内标气、AMU、sccm、标准状态与审核状态
[mass_spectrometer]                  通道仪器配置
[[mass_spectrometer.channels]]       仅保存通道 AMU 与标签
[calibration_suggestion.<species>]   该物种 provisional 选区、处理历史、输入选择与来源哈希
[calibration_suggestion.<species>.parameters]  当次自动选区参数
[calibration_preview.<species>]      provisional 校准指标、来源与参数；quantify 不消费
[calibration]                        初始化为空的校准命名空间
[calibration.<species>]              fit 后保存的人工复核校准
[fragmentation]                      observed-by-species 运行矩阵
[vacuum_baseline.currents_a]         当前逐 AMU 常数真空模型
[vacuum_baseline.exponential."<AMU>"] 当前逐 AMU raw-bound 纯指数真空模型
[response_zeroing.<species>]         该物种 pending 归零窗口/计算值、输入哈希与父处理指纹
[integration_baseline.<species>]     该物种分析基线定义、输入哈希、计算参数与 review 状态
[integration_peaks.<result-id>]      未审核候选峰摘要、输入/基线指纹与检测参数
[peak_integration.<result-id>]       正式逐峰结果、样品属性快照与来源工件哈希
[[processing_record]]                已写出工件的身份、输入/输出哈希、父链与配置指纹
```

它不根据文件存在性自动选输入，也不保存温程拟合模型或绘图的当次判断。响应归零 estimate 和
分析基线 preview 的后续计算状态写入上述目标物种表；baseline accept 只把来源仍匹配的 pending
定义改为 reviewed。候选峰摘要按 result ID 写入 `[integration_peaks.<result-id>]`，正式面积按
result ID 写入 `[peak_integration.<result-id>]`。逐点复算证据放在 `records/*.json`，删除 JSON
不删除 TOML 摘要，但会失去详细审计证据。未知样品质量或 BET 时保持缺失，不伪造默认值。
ProcessingRecord 只记录已经实际写出的输出工件身份及其处理父链，供后续命令按字节核对，不是阶段
审阅记录或自动调度状态。
`temperature.align` 直接把当前 RGA、温控日志、`.tpxmodel`、信号输入与 align 参数绑定进
`alignment_fingerprint`；它既不复制模型系数、插值节点或拟合诊断，也不要求 fit record 存续。
`response_zeroing` 不写成跨实验仪器常数：每个目标的 estimate 分别写入当前 experiment TOML 的
`[response_zeroing.<species>]`，绑定坐标、稳定无峰窗口、estimator、最低点数、offset、这次 aligned
fragmentation 输入和父处理指纹；此时是 pending 计算状态。estimate 默认发布归零前/后的完整曲线和所选窗口
四面板图。人工看图后，无 target 参数的 CLI apply 才显式接受并应用所有仍匹配当前输入和父指纹的
estimate，计算一张新 CSV，并只为这个实际输出追加 ProcessingRecord。estimate JSON 是记录/展示副本，
apply 不读它。
架构上四类基线必须分层：`vacuum` 位于 fragmentation 前的 AMU 电流域，可为常数或与 raw
acquisition 绑定的纯指数；`calibration background`
只在 full-acquisition 标气支路中计算平台增量；`response_zeroing` 位于 fragmentation 后、quantify 前的
species-response 域；`integration baseline` 位于 quantify/normalize 后的面积分析域。任一层都不使用另一层的
窗口或数值作为自己的隐式默认。
新建配置的 `[calibration]` 为空；MS 通道没有响应修正因子。目标物种的乘法因子只在人工复核
calibration 后存在于 `[calibration.<species>]`。初始化不猜测 CO、NH3 或其他目标物种。

新建配置的 reference 是 `inherited-unreviewed`；真空本底是一组继承的 AMU→常数电流初值。
历史工作簿未测量 m/z 14，所以默认真空本底省略 14，不把缺失值写成 `0 A`。
`vacuum show` 从完整 raw HAL CSV 中读取一个或多个 `m{AMU}_raw` 信号，必选常数或
两锚点纯指数模型，并按 AMU 使用独立 `acquisition_time_min` 窗口生成候选、审核 JSON 和图片，
但不改配置；人工复核后 `vacuum set` 才写入。指数模型保存参考时间/电流、衰减率、时间列、
raw SHA-256、完整来源范围和 review-record 路径/SHA-256。不同 AMU 可以混用两种模型，同一 AMU
只能保留一种；共享窗口直接替换整张映射的旧入口已删除。reference 仍保留独立的
show/set/accept 审核契约。
reference 接受只绑定 species、AMU、流量和标准压温五个科学字段；旧 reviewed 记录缺绑定为
`incomplete`，绑定后字段变化为 `stale`，只有 `current` 会放行
消费 reference 流量或标态的 `quantify flow` 与 `quantify rate`；
`quantify relative` / `quantify composition` 不消费这些绝对换算量。

fresh fragmentation 是 2/18/28/40/44 五通道中性单位阵，与有历史真空值的求解集合自洽；
未测 m/z 14 既不补成 `0 A`，也不进入这个默认矩阵。单位阵仍必须实际执行并留下处理记录。

只有明确动作可以受控写回：`temperature suggest` 写入明确标记为
尚未人工确认的 `[temperature_suggestion]`；`calibration suggest` 按目标物种写入 provisional
`[calibration_suggestion.<species>]`；reference 的 set 与 accept 分开；vacuum show 只写 pending 审核
JSON/图片，vacuum set 通过互斥的 `--current` 或 `--review-record` 写入已复核模型；vacuum 没有
accept 或审核状态；
`fragmentation set` 原子写入研究者明确提供的矩阵，final `calibration fit` 写入 reviewed calibration；
fragmentation 没有独立的 `accept`/review-status 门禁，因此 fresh 默认矩阵也必须先由研究者
`show` 检查，必要时再 `set`。`response_zeroing estimate`、`integration baseline preview`、
`integration baseline accept`、`integration peaks` 和正式 `integration areas` 通过各自窄入口更新
experiment TOML。成功写出逐点 CSV 的 `temperature align`、`vacuum subtract`、
`fragmentation correct`、`response_zeroing apply`、四个 `quantify` action 与 `normalize` 会为实际
输出追加 ProcessingRecord。integration 命令不物化扣基线、候选峰或积分 summary/curve CSV：
`peaks` 把候选摘要写入 `[integration_peaks.<result-id>]`；正式 `areas` 把具名区间、峰位语义、
绝对/质量/BET 面积、样品属性快照和输入/基线指纹写入 `[peak_integration.<result-id>]`。
`areas --preview` 只写 review JSON/图片，不写正式面积表。建议记录和 preview 都不是 reviewed 结果。
校准命令要求显式 `--target`；
首次成功 final fit 才创建相应 `[calibration.<species>]`。这些命令调用窄范围专用更新函数，用临时文件和
原子替换写 TOML，并报告
更新前后 SHA256。浮点使用 Python 可往返表示序列化，不截断已复核小电流。对同时产生 CSV 的命令，
配置更新失败会删除本次新建 CSV，保留原 TOML
字节。其余科学参数不隐式写入 TOML。所有阶段表仍需显式输入路径；省略 `--output` 时使用该步骤
职责对应的固定文件名（例如 `aligned.csv`、`calibration_vacuum.csv`、
`desorption_vacuum.csv`、`calibration_fragmentation.csv`、`desorption_fragmentation.csv`），不会把处理历史
不断追加到输入 stem；显式路径和默认路径都拒绝覆盖。
配置写入包括 suggestion、reference、vacuum、fragmentation、reviewed calibration、正式
peak integration 与 processing record 的各自专用入口；不提供把任意分析结果塞进 TOML 的通用
registry 接口。

## SDK modules

| 模块 | 边界 |
|---|---|
| `tpx.core` | 公共不可变数据类型与 `TPXError` / `UsageError` / `DataError` |
| `tpx.curve` / `tpx.analysis` | Curve、Interval 与响应表到曲线的显式适配 |
| `tpx.alignment` | 数值/时间坐标上的通用多列线性插值 |
| `tpx.io` | HAL RGA、温度日志、CSV 文件格式 |
| `tpx.config` | 严格读取 schema 4，并提供窄范围专用原子更新函数 |
| `tpx.processing` | 工件 SHA256、父记录与 vacuum/fragmentation/alignment 指纹链 |
| `tpx.temperature` | 数据驱动候选边界建议、人工边界单调/多项式拟合、模型序列化和时钟对齐 |
| `tpx.table` / `tpx.signal_table` | 可编辑的语义表头、稳定坐标、当前活动质量信号、fragmentation 解混物种列 |
| `tpx.calibration` | 目标/内标乘法响应修正因子与选区建议 |
| `tpx.fragmentation` | `observed = matrix @ species` 的显式求解 |
| `tpx.vacuum` | 独立 MS 真空记录的逐 AMU 常数/两锚点纯指数估计、求值与扣除 |
| `tpx.response_zeroing` | aligned fragmentation 后的单一 resolved-species response 零点 SDK 算子；CLI adapter 对全部匹配 estimate 逐一调用 |
| `tpx.baseline` | 积分曲线使用的零、常数和线性基线算子 |
| `tpx.quantification` | 相对响应、摩尔比、sccm、摩尔速率四段 DataFrame API |
| `tpx.normalization` | Curve 级纯换算，以及质量/BET 表格归一化 |
| `tpx.integration` | 温度选区、时间积分和累计量 |
| `tpx.peaks` | 与积分独立的峰识别 |
| `tpx.plotting` | 临时复核图和显式指定的永久图片 |

`tpx.signal_table.mass_stage_frame()` 让 vacuum 交接“本步读入的
`m{AMU}_input_a` + 本行实际扣除的 `m{AMU}_baseline_a` + 本步输出的 `m{AMU}_signal_a`”。fragmentation 保留本步消费的
`m{AMU}_input_a`，把矩阵解混结果写为 `{species}_resolved_a`，例如 `co_resolved_a` / `ar_resolved_a`。
表头不编码处理历史；来源只由匹配的 processing record、角色/阶段和 SHA-256 证明。

函数签名直接表达数据流。定量的四步是普通 DataFrame API：

```python
relative = calculate_relative_response(
    desorption_frame,
    target_column="co_resolved_a",
    reference_column="ar_resolved_a",
    reference_level_a=reviewed_calibration.reference_plateau_current_a,
    minimum_reference_fraction=0.10,
)
composition = calculate_molar_ratio(
    relative,
    relative_column="target_relative_to_reference",
    response_correction_factor=reviewed_calibration.response_correction_factor,
)
flow = calculate_target_flow(
    composition,
    ratio_column="target_molar_ratio",
    reference_flow_sccm=reference_gas.flow_sccm,
)
rate = calculate_molar_rate(
    flow,
    flow_column="target_flow_sccm",
    standard_pressure_kpa=reference_gas.standard_pressure_kpa,
    standard_temperature_k=reference_gas.standard_temperature_k,
)
```

示例假设当前 fragmentation 已经由实验依据把对应列标为 CO/Ar。fresh 中性单位阵实际生成
`m28_resolved_a` / `m40_resolved_a`，不会自动作出化学物种认定；CLI 会按 reviewed
calibration 的 AMU 与当前 fragmentation 映射选择实际列，并另外记录 target/reference 化学身份。
relative 保留实际输入列并生成 `target_relative_to_reference`。composition 为
`target_relative_to_reference,target_molar_ratio`，flow 为
`target_molar_ratio,target_flow_sccm`，rate 为 `target_flow_sccm,response_umol_min`。

`response_correction_factor` 的方向始终是乘法：
`molar_ratio = measured_relative_response * response_correction_factor`。
`quantify_response()` 仅是按上述顺序直接组合这四个函数的便利 API，不是 workflow 基础。
这些具体能力模块都是公共 SDK；它们没有 CO 或“脱附”专属假设，因此可供 TPD、TPR、TPO
复用。方法差异留在各自的薄 CLI 命令和科研参数选择中，不再使用含义模糊的
`tpx.experiment` 聚合模块。

## Explicit artifacts

```text
raw RGA + temperature log
  → data-driven terminal suggestion report + diagnostics/warnings
  → optional blocking, non-persistent review figure
  → automatic, unreviewed [temperature_suggestion] + source hashes
reviewed ISO heat-start/heat-end + temperature log
  ├─→ temperature_fit.csv (human review)
  ├─→ temperature_model.tpxmodel (pure reloadable TOML computation model)
  └─→ records/temperature_fit_record.json (sources, effective parameters, diagnostics, hashes)
reviewed .tpxmodel + current raw RGA/temperature log + explicit align policy
  → aligned.csv: coordinates + m{AMU}_signal_a
  → temperature.align ProcessingRecord bound to the actual model, sources, signal and policy
schema-4 init
  → inherited-unreviewed reference gas
  → vacuum AMU→constant-current defaults
  → unmeasured m/z 14 omitted from default vacuum baselines
  → strict neutral 5-channel identity fragmentation: 2/18/28/40/44
complete calibration/vacuum-tail HAL RGA + required constant/exponential choice
  + one per-AMU window (constant) or two ordered disjoint windows (exponential)
  ├─→ records/vacuum_baseline_review.json (pending models, windows, diagnostics and hashes)
  └─→ vacuum_baseline_review.png beside the input (complete signals + models + corrected signals)
      TOML unchanged
reviewed manual AMU current or exact review record
  → updates named constant/exponential models; other AMUs remain
reference show → accept
  → reviewed complete reference
full-acquisition signal table + current TOML vacuum models
  → calibration_vacuum.csv: m{AMU}_input_a + m{AMU}_baseline_a + m{AMU}_signal_a
  → full-acquisition vacuum processing record
      vacuum_masses_amu = actual input/config intersection
      vacuum fingerprint = exactly those applied models
calibration_vacuum.csv + configured TOML fragmentation matrix
  → strict fresh 5-channel solve, or explicit available-principal-submatrix correction for a custom matrix
  → calibration_fragmentation.csv:
      m{AMU}_input_a + {species}_resolved_a
  → full-acquisition fragmentation record + matrix fingerprint
complete acquisition after direct vacuum→fragmentation correction
  → optional temporary three-panel review or explicit permanent review image
  → provisional [calibration_suggestion.<species>] + verified processing/input hash
reviewed calibration-background range + adsorption-plateau range + actual target:Ar mixture
  → calibration preview: provisional [calibration_preview.<species>]
      + records/<target>_calibration_preview.json (no CSV)
  → final fit: reviewed [calibration.<species>]
      + records/<target>_calibration_fit.json (no CSV)
      + processing/vacuum/fragmentation fingerprints

temperature-aligned desorption + the same configured TOML vacuum models
  → desorption_vacuum.csv: m{AMU}_input_a + m{AMU}_baseline_a + m{AMU}_signal_a
  → heating_desorption_aligned vacuum record
      vacuum_masses_amu = actual input/config intersection
      applied-model vacuum fingerprint + alignment fingerprint
desorption_vacuum.csv + the same configured TOML fragmentation matrix
  → desorption_fragmentation.csv:
      m{AMU}_input_a + {species}_resolved_a
  → heating_desorption_aligned fragmentation record
desorption_fragmentation.csv + per-target coordinate/stable response-zero window
  → one pending [response_zeroing.<species>] per target in experiment.toml
  → records/<target>_response_zeroing_estimate.json (record/display only)
  → <target>_response_zeroing_estimate.png (four-panel human review)
human review of each estimate result and default figure
  → response_zeroing apply (explicit acceptance and application; no target argument)
  → response_zeroed.csv + response_zeroing.apply record
      every estimate matching the exact input and parent fingerprint applied;
      resolved species without a matching estimate passed through
verified direct or response-zeroed desorption species-current table
  + current fingerprint-bound reference gas + reviewed target calibration in TOML
  + matching current/config/calibration processing fingerprints
  → relative.csv → composition.csv → flow.csv → rate.csv
      (multi-target long tables; target_species identifies each species)
  → normalized.csv
normalized.csv
  → integration baseline preview
      → pending [integration_baseline.<species>]
      → records/<target>_integration_baseline_review.json + review PNG
  → human review → integration baseline accept
      → reviewed [integration_baseline.<species>]
      → records/<target>_integration_baseline_acceptance.json
  ├─→ integration peaks
  │     → [integration_peaks.<result-id>] candidate summary
  │     → records/<result-id>_peaks.json + review PNG
  └─→ integration areas --preview → records/<result-id>_areas_review.json + review PNG
        human review → formal integration areas
          → [peak_integration.<result-id>] in experiment.toml
          → records/<result-id>_areas.json
          → no derived CSV
normalized.csv + verified [peak_integration.*]
  → plot response: complete program branch by default + formal peak annotations
at least two experiments' normalized CSVs + verified [peak_integration.*]
  → plot comparison: absolute / mass-umol / BET panels by default
```

`.tpxmodel` 后缀只用于程序升温模型。response zeroing、integration baseline、候选峰摘要和正式面积
状态都写入现有 experiment TOML；`records/` 下 JSON 保存逐点证据和运行审计，不替代这些状态。

这两条支路在真实工件中的对应关系见
[`20260811 #2WXQ：CLI 分步处理与 XLSX 人工处理`](co-tpd-2wxq-example.html)。

`vacuum show experiment.toml --input HAL.csv --baseline-model constant|exponential` 要求显式选择模型且
没有默认值；窗口以可重复的 `--signal-window AMU START_MIN END_MIN` 给出，统计量也必须显式选择
`--estimator median|mean`。
constant 对每个 AMU 恰好使用一个窗口；exponential 对每个 AMU 按输入顺序恰好使用两个严格分离、
不重叠的首尾窗口。两个窗口的统计量为 `I1,I2`，相应有限样本时间中位数为 `t1,t2`，纯指数采用
`b(t)=I1*exp[-k*(t-t1)]`、`k=ln(I1/I2)/(t2-t1)`，并只接受 `I1 > I2 > 0`、正有限 `k` 和
完整来源范围内有限预测；它最终趋近 0，不回退模型或裁剪负结果。exponential 的 show 输入必须
是 experiment 配置的 exact `rga_csv`；constant 可使用另一份明确的完整 HAL CSV。

show 默认写 `records/vacuum_baseline_review.json` 与输入旁的 `vacuum_baseline_review.png`，stdout
可用 `--json` 切换为 stage 结构，但 TOML 始终不变。指数图/记录同时展示完整 raw、指数曲线、
两个窗口、扣除后曲线、零线、锚点、`k`、`tau`、残差、窗口斜率与基线范围；只提供机械证据。
科研人员审核后，`vacuum set --current AMU:A` 直接写常数，或用互斥的
`vacuum set --review-record JSON` 校验记录、当前 config SHA-256 与 raw SHA-256 后原样写入记录内
全部模型。写入某 AMU 会移除它原来的另一种模型，未点名 AMU 保持不变。
旧 `[vacuum_baseline.measurement]` 与 calibration `vacuum_sources` 仅兼容读取，当前 writer 下一次
写出 schema 4 TOML 时会省略。图中的 `aligned.csv` 明确由
`temperature align` 生成，`vacuum` 只消费选定的一组活动 `m{AMU}_signal_a` 列。
指数模型在 subtract 时只接受当前 experiment raw 中与其来源 SHA-256 相同的字节，或
ProcessingRecord 证明直接来自相同 raw 字节的 `temperature.align` 脱附子表；路径迁移本身不是第二套
隐藏身份。它要求 `acquisition_time_min` 有限、单调，且整个输入范围位于审核 raw 范围内。每个应用
AMU 的输出都保存 input/baseline/signal 三列，不裁剪负值。
vacuum fingerprint 只针对实际应用 AMU，并编码模型类型、系数、时间坐标和来源 SHA-256；同一联合
snapshot 也进入 calibration preview/fit。任一模型变化都会使 vacuum 后的 fragmentation、calibration、
response zeroing、quantify、normalize 与 integration 谱系失配。
`fragmentation show experiment.toml` 同样默认打印人类矩阵表，明确行是 observed m/z、列是 true
species，并显示来源、条件数和单位阵含义；`--json` 才恢复机器结构。
`response_zeroing` 没有跨实验的配置 `show/set/accept`：每次 estimate 直接把本次 aligned fragmentation
工件的一个 target、coordinate column、zero window、estimator、最低点数、offset、输入哈希和父指纹写入
experiment TOML 作为 pending 状态。CLI 合同是
`--coordinate-column {program_time_min|acquisition_time_min|temperature_fit_c} --zero-window START:END`；
窗口可在升温前或峰后尾段，负数范围使用 `--zero-window=-5:0`。科研人员检查默认四面板图中归零前/后
的完整曲线和所选窗口后，再执行一次无 target 参数的 apply，以显式接受并应用全部匹配状态。
JSON 只作记录/展示，不参与 apply 计算。

文件名不用于证明输入。temperature align 向导只读加载 experiment TOML 同级的 canonical
`temperature_model.tpxmodel`；它不扫描 `records/`，也不把 fit CSV 或 fit record 变成计算输入。
其他交互向导从 manifest、experiment TOML 和已记录输出工件中提供可检查的参数建议，用户按 Enter
接受后仍须核对路径、角色、阶段及输入/输出 SHA-256，也不会自动执行缺失步骤。`records/` 下的
JSON 不作为计算输入。calibration/quantify 同样必须找到输入 SHA256 对应的 ProcessingRecord，
并核对父记录、`vacuum_masses_amu` 所列实际应用子集的 vacuum fingerprint 与 fragmentation 指纹；
fit record 的缺失或哈希变化只作为拟合审计异常
单独报告，不会使 aligned anchor 或继承其 alignment fingerprint 的下游记录失效。
response_zeroing estimate 还要求其输入是 `heating_desorption_aligned fragmentation.correct`；无 target
参数的 apply 要求 experiment TOML 中全部实际应用的 estimate 状态及其输入/父指纹完全匹配。
因此只有当同一内容哈希对应一个无歧义的语义身份时，安全改名才仍可验证；相同字节若对应多个
stage/role/fingerprint 组合会被拒绝，伪造文件名或表头也不能绕过记录。final fit 把当时的指纹写进
reviewed calibration；quantify 可接受直接 vacuum→fragmentation，或上述完整
vacuum→fragmentation→response_zeroing 脱附链，并对比 calibration、当前配置和脱附工件三方；任一不一致
就拒绝旧因子。四步 quantify 与 normalize 都写 multi-target long CSV，并把 target 集合和父链写入
ProcessingRecord；文件名不再承担物种身份。

`integration peaks` 与 `integration areas` 都要求显式、稳定、研究者可读的 `--result-id`。
前者只写候选摘要 TOML 与详细 JSON；后者 preview 只写审核 JSON/图片，正式运行才写
`[peak_integration.<result-id>]` 和 `records/<result-id>_areas.json`。它们都从 `normalized.csv`、
已 reviewed 的 baseline 定义和精确 SHA-256 复算，不生成 baseline-subtracted、summary 或 curve CSV。
同一样品、同一 target 的多峰共享一条 reviewed baseline 时，应在一次 areas 中使用一个 result ID 和
多个具名区间。不同样品的 response-zero offset 和 integration baseline 位于各自 TOML，不共享数值。

真实运行优先使用 CLI 已定义的默认 basename；只需更换 output 位置时保留 basename，仅改父目录。
不擅自加 `fresh`、`final`、`v2`、日期或时间戳。`--result-id` 没有 CLI 默认值，它是 TOML 科学身份；
应复用已审核 ID 或使用最小职责型 ID。

`plot response` 默认 `--display-range program`，从程序零点画到第一次最高温的完整升温支路，而不是
只裁到峰区；默认输出名包含目标物种、total/baseline-subtracted、basis 与显示范围，并在三份来源
SHA-256 仍匹配时标注 `[peak_integration.*]` 中的正式峰位及当前 basis 面积。
`plot comparison` 要求至少两组显式 label/config/normalized CSV 和显式输出路径；默认在共享温度轴上
依次绘制 absolute、mass-umol 与 BET 三个 panel，并核验各实验的归一化列、样品质量/BET 快照和正式
峰来源，不静默降级为缺少口径或峰标注的半成品。

当前 CLI 不提供 `quantify all`。研究者依次运行 `quantify relative`、`composition`、`flow`、`rate`，
每一步各写一张职责明确的 long CSV，保持每个科学换算独立可审阅。

这里有三种不能混用的记录边界：

- `temperature_fit_record.json` 是由 CLI 生成、随实验目录迁移的单次温程拟合清单；它绑定来源、
  有效参数、诊断、纯计算模型和人工审阅表的 SHA-256，但只用于记录/展示，不进入计算或正式信号父链。
- experiment TOML 的 `[[processing_record]]` 只描述内容寻址的输出工件身份与谱系；从 align 开始记录
  `input → output`、处理指纹和父链，不承载旁车 JSON、审阅结论或动作状态。
- 工作流插件的 `receipt.json` 与日志记录一次进程事实，包括 argv、计划及输入身份、stdout/stderr、
  退出状态、开始/结束时间和用户确认状态；直接终端执行不会产生该插件记录。失败命令可有运行记录，
  同时没有成功生成的 ProcessingRecord。记录默认位于实例配置旁的 `tpx-workflow/runs/`。

三者中的 SHA-256 都只证明所比较字节是否一致。退出码 0、哈希一致、ProcessingRecord 存在和
科研人员接受模型或结论是相互独立的状态。

## CLI organization

公共 dispatcher 只保存命令名称、模块路径、用途和简短示例。`--list` 在可交互终端使用
标准库 `curses` 菜单，非 TTY、`TERM=dumb` 或 `--list --plain` 输出稳定文本。菜单和参数向导直接
遍历真实 `argparse` parser，不维护第二份参数 schema。向导先收集必填参数，再用一次
“是否修改已有默认值”询问决定是否覆盖命令默认；随后可按编号或参数名只选择需要配置的项，
`all` 才逐项遍历。参数是否进入这一组只由真实 parser 的 required/default 契约决定，不再维护
“高级”标记或特殊提前询问规则。每个 TPD
命令模块包含：

1. 一个普通 `build_parser()`；
2. 一个薄 `execute(args)`；
3. 明确的 SDK 调用和 CSV 写出。

没有 decorator 命令框架、Recipe、Pipeline、DAG 或字符串 artifact key。TPD 已有真实步骤；
TPR/TPO 只在获得代表性数据、化学计量和标定规则后分别实现。

`tpdtpd config inspect CONFIG [--clock-elapsed-tolerance-s SECONDS] [--require-mass AMU ...] [--json]`
是 schema 4 TPD 配置与原始数据的
只读概况入口。它在组装任何人类或 JSON 输出前先严格加载配置，再各读取一次其引用的
RGA CSV 和温控日志。因此任一配置或数据错误都会以退出码 2 失败，不会泄露部分摘要，
也不会写配置或阶段产物。可重复的 `--require-mass` 在同一次读取中检查下游明确需要的实测通道。

`config inspect`、`config status` 和 `config provenance` 都先调用同一严格 schema-4 加载器，之后职责分开：
`inspect` 负责读取两份原始数据及可选 AMU 硬约束；`provenance` 负责 ProcessingRecord 输出、父链和
当前文件 SHA256，本身不打开配置引用的 RGA/温控文件；`status` 汇总 command readiness、审核门禁和
证据状态，并按当前记录需要读取其绑定文件。三者都是只读，但不能互相代替各自的证据范围。

`temperature suggest experiment.toml` 不从配置或代码注入 -180/250 °C
边界，而是从实测与设定温度共同升温的候选中选择共同温升占优的一段，以局部前平台离开点
和升温后首个确认平台提出 ISO 边界，并暴露候选支撑、两条温升、优势和歧义 warning。
默认终端报告逐项显示候选，`--json` 中的 `ramp_candidates` 保留全部机器字段；
`ramp_support_*` 表示斜率检测支撑，而
`heat_start/heat_end` 表示最终建议边界，两者无需相等。显式 `--show` 只惰性导入绘图库并
打开含全程、边界放大和候选表的阻塞式临时窗口，不保存图片；正常关闭后才原子提交
`[temperature_suggestion]`，绘图错误或中断则保持原配置字节。该段保存自动建议、完整有效参数
和两份源文件 SHA256，但不是 reviewed fit，也不会自动执行下一步。可选起止温度 hint 必须成对
显式提供，仅用于高级锚定。

参数向导可在源哈希仍匹配时，让 `temperature fit` 的两个边界按 Enter 接受 TOML 建议，并把
边界、时钟容差和平滑参数显式展开到最终 argv。源文件改变后拒绝复用并要求重新 suggest。
直接 CLI 调用仍必须显式提供 `--heat-start/--heat-end`。小数秒可省略或含 1–6 位，必须复制
检测值；`.9` 与 `.900000` 是同一时刻。

`calibration suggest` 只对显式传入的 vacuum-then-fragmentation 物种电流表计算 calibration
background 与 adsorption plateau 候选。`--show` 惰性打开包含目标、内标和目标/内标比值的三联阻塞窗口；正常关闭且
配置/输入哈希仍与计算前一致后，才按物种原子提交 provisional
`[calibration_suggestion.<species>]`。绘图失败、Ctrl-C 或审阅期间输入改变都发生在提交前；显式
`--plot-output` 则可保存永久图片。CO 与 NH3 等物种记录互不覆盖。

`calibration fit` 的参数向导只读取最新且输入 SHA256 仍匹配的 suggestion，并把其中的目标物、
输入路径、AMU/列、时间列、calibration background、adsorption plateau 和建议最低窗口点数展开为
显式 argv；该点数作为
fit 的 `--minimum-points`，避免稀疏数据的建议区间与 fit 默认阈值冲突；`--mixture` 仍由用户
输入；preview/fit 的数值状态写入 experiment TOML，详细证据默认写入 `records/`，不再写
`calibration_preview.csv` 或 `calibration.csv`。直接 CLI 调用不消费 suggestion 隐式状态。
`--input` 对 suggest 与 fit 都必填，且必须由 SHA256 对应的 processing record 证明已经依次完成
vacuum 和 fragmentation；文件名或表头不能代替这条记录。fit 只接受
`--calibration-background` 和 `--adsorption-plateau` 这两个明确区间名。`calibration preview`
计算指标/图并写 provisional `[calibration_preview.<species>]`，但不写 reviewed 配置；只有 final fit
才把校准指标及 processing、
vacuum 与 fragmentation 指纹保存到 `[calibration.<species>]`。
`calibration preview --compare` 可加入重复的 `--compare-preview-record PATH`，并列
provisional、本次/显式旧 preview 与 active reviewed 状态，并明确 quantify 只使用
active reviewed。

正式机器 JSON 统一放在 `records/`；CSV 和审核图的默认路径位于其输入旁，CLI 不再自动创建
`preview/`、`final/` 或 `diagnostic/` 角色目录。CLI 不创建 `commands.log`、
`human_reports.log` 或 `runtime_provenance.txt`。阶段 action 的默认人类报告与 `--json` 机器 stdout
来自同一份结构化执行结果；只有真实科学
输出路径、输入和配置参加 no-clobber/conflict 预检。机器调用应在首次执行时选择 `--json`，
不得对已写工件或改配置的命令加 `--json` 重跑。
