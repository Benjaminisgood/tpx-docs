# `tpdtpd` 全部命令中文参考

本文对应当前源码中的真实 `argparse` parser 和命令 manifest，覆盖全部 35 个叶命令。
完整参数、选项集合和实时默认值仍以本机运行的
`tpdtpd COMMAND [ACTION] --help` 为准；本文解释每条命令为什么存在、最少需要研究者
明确什么，以及命令会读取或改变什么。

## 统一参数规则

1. CLI 只有“调用者必须给值”和“已有命令默认值”两种参数状态，不维护另一套
   “高级”“可选”或 manifest 人工分组。`required=true`、必填互斥组和“至少填写一项”
   组合保持展开；其余参数都由真实 parser 默认值处理。
2. 布尔开关同样有默认值。例如 `--json` 和 `--show` 未出现时都是
   `False`。工作流参数卡读取真实 manifest，并显示默认值；由输入位置或
   配置推导的默认路径则明确显示为命令默认，而不是伪装成空的必填输入。
3. `config` 对直接 CLI 始终必填。终端向导可在当前实验唯一时提议路径；工作流卡片必须
   明确选定实验目录和 TOML，最终 argv 仍包含该路径。
4. 默认 stdout 是适合人读的报告。只有显式增加 `--json` 才输出机器 JSON；工作流
   或其他机器消费者需要 JSON 时应在同一次执行中追加该开关，不能为了读取 JSON 重跑写入命令。
5. TOML 内保存的相对路径以 TOML 所在目录为基准；单独传给 CLI 的相对输入、输出路径
   以当前工作目录为基准。新工件默认拒绝覆盖，默认文件名只描述当前表的职责，不累计
   输入文件的历史后缀。
6. suggestion、preview、show、set、accept、apply 和 fit 的边界不能互相替代。命令成功、
   文件哈希一致和研究者科学接受是三个不同状态。

## 1. 新建与只读检查

### `init`

- 用途：根据已经知道的单实验事实创建 schema 4 `experiment.toml`，不猜目标物种或校准。
- 必须明确：新配置路径、实验名、HAL RGA CSV 和温控日志。
- 默认：样品质量和 BET 可保持未知；`--force` 默认关闭，不替换已有配置。
- 改变：只创建 TOML，不改原始数据。新 reference 仍待复核，vacuum 保存当前 AMU→常数电流初值，
  fragmentation 写入中性 identity 起点。
- 示例：`tpdtpd init experiment.toml --name sample-1 --rga-csv raw.csv --temperature-log temperature.txt`

### `config inspect`

- 用途：严格检查 schema 4 TOML 和两份原始数据，并只读汇总配置 SHA256、实验事实、
  RGA 通道/时长和温控范围。
- 必须明确：`config`。
- 默认：始终读取 RGA CSV 与温控日志；时钟与 elapsed 重建容差为 `1 s`；不额外要求 AMU。
- 改变：不写 TOML、不创建工件；默认输出人类报告。
- 显式约束：下一步需要特定实测通道时，可重复指定正整数 `--require-mass AMU`；任一缺失即失败。
- 示例：`tpdtpd config inspect experiment.toml --require-mass 28 --require-mass 40`

### `config provenance`

- 用途：严格加载 schema 4 后，核验并展示 `ProcessingRecord` 的输入、输出、父链和当前文件 SHA256；
  不读取配置直接引用的 RGA CSV/温控日志，也不承担原始数据概况或 AMU 约束。
- 必须明确：`config`。
- 默认：没有技术参数；机器读取时才显式增加 `--json`。
- 改变：严格只读，不补记录、不修复文件。
- 示例：`tpdtpd config provenance experiment.toml`

### `config status`

- 用途：先严格加载 schema 4；随后只读计算每条命令的就绪状态、缺少的显式输入、审核门禁和
  证据异常，并按当前记录需要读取或哈希其证据/来源文件，因此不能作为纯配置门禁。
- 必须明确：`config`。
- 默认：不选择下一条命令，也不自动执行建议、接受或应用动作。
- 改变：采集前后再次核对配置身份，避免混合两个配置版本；不写入任何状态。
- 示例：`tpdtpd config status experiment.toml`

## 2. 温度程序

### `temperature suggest`

- 用途：从当前温控日志寻找候选升温段，提出绝对本地 `heat_start/heat_end`，供人复核。
- 必须明确：`config`；起止温度 hint 不是普通实验的必填输入。
- 默认：时钟容差 `1 s`，检测、平滑、平台和 fallback 参数来自
  `TemperatureProgramSettings`；`--show=False`。
- 改变：成功后原子更新 provisional `[temperature_suggestion]`，但不产生模型或 aligned CSV。
- 人工边界：多循环、暂停、平台和 fallback 必须查看候选说明；suggestion 不是 fit 接受。
- 默认 `--start-method baseline-departure` 保留既有起点检测；可选 `--start-method short-dwell`
  从原始实测温度中选稳定停留之后第一个只有 1–2 点、随后继续升高的温度档首点。
  `--start-stable-tolerance-c` 默认 0 °C（全档极差容差），回看范围沿用
  `--pre-ramp-window-min`；short-dwell 不与成对温度 hints 同用，找不到候选时遵循
  `--start-fallback` 并报告。候选必须由研究者检查；模型与对齐边界见[温度对齐说明](temperature-alignment.html)。
- 示例：`tpdtpd temperature suggest experiment.toml`

### `temperature fit`

- 用途：用已复核的绝对升温起止时刻拟合可重载温度模型。
- 必须明确：`config`、`--heat-start`、`--heat-end`。向导可提议 source-matching suggestion，
  但最终 argv 仍明确写出两者。
- 默认：`model=monotonic`；多项式维数 `3` 和单调容差 `0 °C` 只在选择
  `model=polynomial` 时消费；时钟容差 `1 s`。
- 输出默认：`temperature_fit.csv`、`temperature_model.tpxmodel` 和
  `records/temperature_fit_record.json`，均拒绝覆盖。
- 人工边界：CSV 用于看拟合，`.tpxmodel` 才是 align 的计算输入，fit record 是审计材料。
- 示例：`tpdtpd temperature fit experiment.toml --heat-start 2026-08-04T16:34:21 --heat-end 2026-08-04T17:18:21`

### `temperature align`

- 用途：把一个已复核 `.tpxmodel` 重放到 RGA/信号行，创建 canonical aligned 表。
- 必须明确：`config`。普通情况可采用其余命令默认值。
- 默认：原始信号读取 TOML RGA；模型读取 TOML 同级 `temperature_model.tpxmodel`；
  `clock=1 s`、`offset=0 s`、越界 `error`、输出 `aligned.csv`。
- 改变：写 aligned CSV，并向 TOML 追加绑定原始源、模型、策略和输出 SHA256 的记录。
- 人工边界：只有确有测得时钟偏移或已复核覆盖缺口时才改 offset/越界策略。
- 示例：`tpdtpd temperature align experiment.toml`

## 3. 真空、内标气与碎片矩阵

### `vacuum show`

- 用途：从一份完整 raw HAL RGA CSV 中，为一个或多个 AMU 分别建立待人工复核的
  常数或两锚点纯指数真空模型，并显示完整信号、模型和窗口；指数模型另显示扣除后完整信号与零线。
- 必须明确：`config`、`--input HAL.csv`、无默认值的
  `--baseline-model constant|exponential`、至少一个可重复的
  `--signal-window AMU START_MIN END_MIN`，以及 `--estimator median|mean`。
  `constant` 要求每个 AMU 恰好一个窗口；`exponential` 要求每个 AMU 按输入顺序恰好两个首尾
  窗口，且首窗终点必须严格早于尾窗起点；exponential 的 `--input` 必须是 experiment TOML
  配置的确切 `rga_csv`。
- 默认：每个窗口至少需要 3 个有限值；详细记录写
  `records/vacuum_baseline_review.json`，审核图写在输入旁的
  `vacuum_baseline_review.png`，图片分辨率为 300 dpi。可用 `--minimum-points`、
  `--record-output`、`--plot-output` 和 `--dpi` 显式覆盖。
- 计算：每个窗口在 `acquisition_time_min` 上独立选择相应 `m{AMU}_raw`。指数模型以窗口统计量
  为 `I1,I2`，以相应有限样本时间中位数为 `t1,t2`，计算
  `b(t)=I1*exp[-k*(t-t1)]`、`k=ln(I1/I2)/(t2-t1)`；只接受
  `I1 > I2 > 0`、`k > 0` 且完整 raw 范围内预测有限的数据。它不退回其他模型、不裁剪负结果，
  纯指数最终趋近 0。
- 输出：审核 JSON 使用 `schema_version=2` 的联合结构，`result.masses_amu` 与 `result.models[]`
  明确每个 AMU 的 constant/exponential 类型，且 `stored=false`。stdout/`--json` 列出各 AMU 的模型与
  机械证据。指数记录另含锚点、`k`、`tau=1/k`、
  残差 MAD/RMSE、两个窗口斜率和完整范围基线极值；这些指标不自动判定“稳定”或“可接受”。
- 改变：以 no-clobber 方式创建审核 JSON 和 PNG；任一发布失败会回滚本次配对工件。
  `stored=false`，不修改 experiment TOML。
- 人工边界：检查完整曲线、选中窗口与模型；选择指数时还要检查扣除后曲线和零线。之后再用
  `vacuum set` 的互斥入口之一写入。
- 示例：`tpdtpd vacuum show experiment.toml --input calibration.csv --baseline-model exponential --signal-window 28 1 3 --signal-window 28 24 27.5 --estimator median`

### `vacuum set`

- 用途：写入已复核的逐 AMU 常数/指数模型。
- 必须明确：`config`，并在两个互斥入口中恰好选择一个：可重复的 `--current AMU:A` 直接写常数；
  `--review-record JSON` 则接受一份 `vacuum show` 审核记录中的全部模型。
- 验证：review-record 路径会严格验证记录结构、当前 experiment config SHA-256 与当前配置 raw 的
  SHA-256；指数系数从记录原样写入，不要求人工抄写。记录或来源字节已改变时拒绝写回。
- 改变：原子合并当前模型，不处理信号表。设置某 AMU 的新模型会移除该 AMU 的旧模型；未点名
  AMU 保持原值。因此同一配置可在分别审核后混用常数与指数，但同一 AMU 不可同时配置两种。
- 示例：`tpdtpd vacuum set experiment.toml --review-record records/vacuum_baseline_review.json`

旧 `[vacuum_baseline.measurement]` 与 calibration `vacuum_sources` 只为历史 TOML 的只读加载
兼容；它们不进入当前运行时合同，并会在当前 writer 下一次写出 schema 4 TOML 时被省略。

### `vacuum subtract`

- 用途：从 raw 或 canonical mass-signal 表中逐行减去当前常数/指数真空模型。
- 必须明确：`config`、`--input`。
- 默认：full-acquisition 校准支路输出 `calibration_vacuum.csv`，temperature-aligned
  脱附支路输出 `desorption_vacuum.csv`；无法验证角色时才回退 `vacuum.csv`。只处理输入通道
  与已配置本底的交集，不伪造缺失通道。
- 输出：每个应用 AMU 显式写 `m{AMU}_input_a`、`m{AMU}_baseline_a`、
  `m{AMU}_signal_a`。不裁剪负的校正值。
- 指数来源边界：只接受当前配置中与来源 SHA-256 相同的 raw 字节，或 ProcessingRecord 证明直接同源的
  `temperature.align` 脱附子表；必须有有限、单调的 `acquisition_time_min`，且输入范围不得越出
  被审核 raw 的完整时间范围。
- 改变：写窄表并追加带 config/output SHA256、父链及当前模型类型、系数、时间坐标、来源 SHA-256、
  实际应用 AMU 的 vacuum fingerprint。任一模型变化都会使旧下游指纹失配。
- 示例：`tpdtpd vacuum subtract experiment.toml --input aligned.csv`

### `reference show`

- 用途：查看内标物种、AMU、流量、标准压力/温度、审核状态及五值指纹。
- 必须明确：`config`。
- 改变：只读。
- 示例：`tpdtpd reference show experiment.toml`

### `reference set`

- 用途：修改内标气的一个或多个科学值。
- 必须明确：`config`，并在 species、AMU、flow、标准压力、标准温度五项中至少填写一项；
  多项可以同一次组合更新。
- 改变：原子更新值并转为待复核；不再要求已经舍弃、且不参与计算的 source 参数。
- 示例：`tpdtpd reference set experiment.toml --species Ar --mass 40 --flow-sccm 20`

### `reference accept`

- 用途：把 `reference show` 得到的当前五值指纹作为并发保护，显式接受内标状态。
- 必须明确：`config`、`--expected-reference-gas-fingerprint`。
- 改变：只有值在 show 与 accept 之间未改变才更新审核状态。
- 示例：`tpdtpd reference accept experiment.toml --expected-reference-gas-fingerprint FINGERPRINT`

### `fragmentation show`

- 用途：按 observed-AMU 行、true-species 列展示当前碎片矩阵、条件数和来源。
- 必须明确：`config`。
- 改变：只读；identity matrix 也必须被看作明确模型，而不是跳过该阶段。
- 示例：`tpdtpd fragmentation show experiment.toml`

### `fragmentation set`

- 用途：写入研究者已确认的 observed-by-species 矩阵。
- 必须明确：`config`、`--species`、`--masses`，并在内联 `--matrix` 或
  `--matrix-file` 中二选一。
- 改变：原子替换矩阵及来源；不会自动执行 correct。
- 示例：`tpdtpd fragmentation set experiment.toml --species CO,Ar --masses 28,40 --matrix '1,0;0,1'`

### `fragmentation correct`

- 用途：求解 mass signals，输出 `{species}_resolved_a`。
- 必须明确：`config`、`--input`。
- 默认：最大条件数 `1e10`，缺观测通道策略 `error`；full-acquisition 校准支路输出
  `calibration_fragmentation.csv`，temperature-aligned 脱附支路输出
  `desorption_fragmentation.csv`，无法验证角色时才回退 `fragmentation.csv`。
- 改变：写窄表并追加矩阵/输入/输出指纹记录；identity 仍会留下显式物种层和 provenance。
- 示例：`tpdtpd fragmentation correct experiment.toml --input vacuum.csv`

## 4. 校准与响应零点

### `calibration suggest`

- 用途：在完整采集的 vacuum→fragmentation 表中建议通气前背景和吸附平台区间。
- 必须明确：`config`、`--input`、`--target-species`；新目标没有配置来源时还需明确 AMU。
- 默认：滚动窗口、稳定性和平台阈值已有保守技术默认，`--show=False`，不保存永久图。
- 改变：正常关闭可选 review 窗口后，原子写 provisional suggestion；不创建 reviewed factor。
- 示例：`tpdtpd calibration suggest experiment.toml --input calibration_fragmentation.csv --target-species CO --target-mass 28`

### `calibration preview`

- 用途：用人工选区和已知混合气计算与最终 fit 相同的指标，但不写 reviewed calibration。
- 必须明确：`config`、full-acquisition `--input`、目标物种、背景区间、平台区间和
  `TARGET_PARTS:REFERENCE_PARTS` mixture。
- 默认：background `median`、plateau `mean`、每区至少 10 点；详细审计写
  `records/<target>_calibration_preview.json`，永久图默认不生成，不再创建单行 CSV。
- 改变：provisional 指标写入 `[calibration_preview.<species>]`；该节不会被 quantify 当成
  reviewed calibration，完整快照保存在 JSON。
- 示例：`tpdtpd calibration preview experiment.toml --input calibration_fragmentation.csv --target-species CO --calibration-background 0:5 --adsorption-plateau 15:25 --mixture 5:95`

### `calibration fit`

- 用途：执行最终校准并把 reviewed `response_correction_factor` 保存到目标物种配置。
- 必须明确：与 preview 相同的 full-acquisition 输入、目标、两个区间和 mixture。
- 默认：详细审计写 `records/<target>_calibration_fit.json`；fit 在全部校验通过后写配置，
  不再创建一行 metrics CSV。
- 改变：原子更新 `[calibration.<species>]` 中的 reviewed calibration 及计算所需输入/矩阵/
  真空指纹；完整同次运行证据保存在 JSON。
- 人工边界：需要不落配置的计算时使用独立 `calibration preview`；preview 不等于
  final fit 已获科学接受。
- 示例：`tpdtpd calibration fit experiment.toml --input calibration_fragmentation.csv --target-species CO --calibration-background 0:5 --adsorption-plateau 15:25 --mixture 5:95`

### `response_zeroing estimate`

- 用途：在 aligned fragmentation 目标响应的任意已审核稳定无峰窗口估计 provisional 常数零点。
  窗口可在升温前，也可在所有峰结束后的尾段；命令不自动选择稳定区。
- 必须明确：`config`、SHA256 可追踪的 `--input`、目标物种、
  `--coordinate-column {program_time_min|acquisition_time_min|temperature_fit_c}` 和
  `--zero-window START:END`。
- 默认：目标列 `{target}_resolved_a`、`median`、至少 3 点；记录/展示 JSON 写入
  `records/<target>_response_zeroing_estimate.json`，四面板审核图写入输入旁的
  `<target>_response_zeroing_estimate.png`。
- 改变：把坐标、窗口、estimator、最低点数、offset、输入 SHA256 与父指纹作为 pending 计算状态
  写入 `[response_zeroing.<target>]`；不会自动应用。JSON 不参与计算，删除后不影响 apply。
- 人工边界：必须看过默认四面板图中归零前/后的完整曲线和所选窗口，再显式运行 apply。
- 示例：`tpdtpd response_zeroing estimate experiment.toml --input fragmentation.csv --target CO --coordinate-column program_time_min --zero-window=-5:0`

### `response_zeroing apply`

- 用途：复核各物种 estimate 后，一次应用当前 TOML 中属于所选 fragmentation 输入及其父指纹的
  全部 pending 零点；这一显式动作同时表示接受并应用。没有匹配零点的物种原样传递。
- 必须明确：`config` 和原 fragmentation 输入；apply 不再接受 target species。
- 默认：输出 `response_zeroed.csv`。
- 改变：创建一条包含全部已应用物种的独立 quantification 分支并追加父链记录；不覆盖原表。
- 证据边界：apply 从 TOML 和精确原输入复算 offset；estimate JSON 只作记录/展示，从不是计算输入。
- 示例：`tpdtpd response_zeroing apply experiment.toml --input fragmentation.csv`

`vacuum`、`calibration background`、`response_zeroing` 和 `integration baseline` 是四个不同概念：
它们分别作用于 fragmentation 前的逐 AMU 常数/指数真空电流、完整标气实验的平台增量、
fragmentation 后每样品每物种的常数零点，以及定量后的面积参考线；不能互相代替。指数 vacuum
仍是 raw-AMU 层，不是 response zeroing 或 integration baseline。

当命令提供默认 basename 时，真实运行应优先使用它；只需改变输出位置时保留 basename，仅改父目录。
不擅自加 `fresh`、`final`、`v2`、日期或时间戳。必填但无默认的 `--result-id` 是 TOML 科学身份，
应复用已审核的稳定 ID 或使用最小职责型 ID。

## 5. 定量与归一化

### `quantify relative`

- 用途：计算目标与内标的相对电流响应，保留诊断电流列。
- 必须明确：`config`、一个或多个 reviewed `--target`、当前 aligned resolved `--input`；
  单输入框接受英文逗号或中文全角逗号，例如 `CO,NH3`。
- 默认：逐目标从已核验列和校准谱系解析目标/内标列，输出一张 long-format `relative.csv`。
- 改变：写窄表并追加处理记录。
- 示例：`tpdtpd quantify relative experiment.toml --target CO --input fragmentation.csv`

### `quantify composition`

- 用途：应用 reviewed response factor，得到目标/内标摩尔比。
- 必须明确：`config`、一个或多个目标、上一量化步骤输入；目标集合和顺序必须与其记录一致。
- 默认：职责型输出 `composition.csv`。
- 改变：写窄表并追加与校准、reference、父工件绑定的记录。
- 示例：`tpdtpd quantify composition experiment.toml --target CO --input relative.csv`

### `quantify flow`

- 用途：结合 reviewed reference flow，把摩尔比换算为目标流量。
- 必须明确：`config`、一个或多个目标、上一量化步骤输入。
- 默认：职责型输出 `flow.csv`。
- 改变：写窄表并追加记录；reference 未接受时失败。
- 示例：`tpdtpd quantify flow experiment.toml --target CO --input composition.csv`

### `quantify rate`

- 用途：用标准压力和温度把流量换算为 `response_umol_min`。
- 必须明确：`config`、一个或多个目标、上一量化步骤输入。
- 默认：职责型输出 `rate.csv`。
- 改变：写窄表并追加记录，不自动做质量或 BET 归一化。
- 示例：`tpdtpd quantify rate experiment.toml --target CO --input flow.csv`

### `normalize`

- 用途：在绝对 `response_umol_min` 旁增加质量和/或 BET 归一化响应。
- 必须明确：`config`、`--input`，并保证样品质量已写入 TOML 或通过 `--mass-mg`
  提供；质量是计算质量归一化和后续积分量的必要实验事实。
- 默认：质量优先读取 TOML；BET 也优先读取 TOML，但 TOML 和 CLI 都缺失时只不生成
  BET 响应。输出一张 long-format `normalized.csv`，多物种由 `target_species` 列区分。
- 改变：写新 CSV 和 ProcessingRecord，不替换绝对响应；CLI 值与 TOML 冲突时必须显式确认
  reviewed override。
- 示例：`tpdtpd normalize experiment.toml --input rate.csv`

## 6. 统一的 integration 命令族

### `integration baseline preview`

- 用途：从一张 `normalized.csv` 的指定 target 计算并画出主观积分基线，供研究者审核。
- 必须明确：`config`、`--input`、`--target`、审核温区和基线模型；不同模型再要求与其相符的
  显式值、范围或 anchor。
- 默认：canonical `response_umol_min`、program start `0 min`、图 `300 dpi`；详细记录写
  `records/<target>_integration_baseline_review.json`，图片写在输入旁。
- 改变：把可复算定义以 `review_status=pending` 写入 `[integration_baseline.<target>]`；不创建
  baseline-subtracted CSV。
- 示例：`tpdtpd integration baseline preview experiment.toml --input normalized.csv --target CO --start-c -180 --end-c 240 --baseline zero`

### `integration baseline accept`

- 用途：研究者看过 preview 图片后，重新核验同一 normalized 输入、SHA256 和保存的定义，再显式
  接受该主观基线。
- 必须明确：`config`、原 `--input` 与 `--target`。
- 默认：详细记录写 `records/<target>_integration_baseline_acceptance.json`。
- 改变：把 TOML 状态改为 reviewed，并绑定 acceptance JSON；不创建扣基线 CSV。后续 peaks、areas
  和 baseline-subtracted plot 都从 normalized 输入与该定义即时复算。
- 示例：`tpdtpd integration baseline accept experiment.toml --input normalized.csv --target CO`

### `integration peaks`

- 用途：用已审核的 TOML baseline 从指定 target 的 normalized 响应中寻找未审核候选峰、建议区间和
  可选 Gaussian 形状诊断；不替代正式面积积分。
- 必须明确：`config`、`--input`、`--target`、稳定 `--result-id`、response basis、温区、最小
  峰间距和平滑宽度。
- 默认：正峰、无绝对峰高阈值、不强制候选数量；详细逐点证据写
  `records/<result-id>_peaks.json`，审核图写在输入旁，不创建 CSV。
- 改变：候选摘要写入 `[integration_peaks.<result-id>]`；候选状态始终明确为 unreviewed，绝不自动
  晋升为正式峰位或积分区间。
- 示例：`tpdtpd integration peaks experiment.toml --input normalized.csv --target CO --result-id co_candidates --basis mass-umol --start-c -180 --end-c 60 --minimum-separation-c 40 --smoothing-window-c 15`

### `integration areas`

- 用途：用指定 target 的 normalized 输入和已审核 TOML baseline，预览或正式计算一个或多个具名
  温区的面积。
- 必须明确：`config`、`--input`、`--target`、稳定 `--result-id` 和第一个
  `--start-c/--end-c`；更多区间用 `--interval NAME START END`。
- 默认：trapezoid、保留有符号响应、不插值边界；质量和 BET 优先从 TOML 获取。preview 记录写
  `records/<result-id>_areas_review.json`，正式记录写 `records/<result-id>_areas.json`。
- 峰位：未给 `--peak-position INTERVAL TEMP_C` 时，记录实际积分响应最大采样点，语义为
  `maximum-integration-response-sample`；只有显式复核峰位才记录 `reviewed-explicit`。peaks 候选
  不会自动晋升。
- 改变：`--preview` 只写 JSON/图片、不改正式 TOML；正式调用把具名区间、峰位语义、绝对/质量/
  BET 面积、输入 SHA256 和 baseline 指纹写入 `[peak_integration.<result-id>]`。两种模式都不创建
  summary 或逐点 CSV。
- 共享语义：同一样品、同一 target 的多个峰共享 reviewed baseline 时，用一次 areas、一个
  `result-id` 和多个 `--interval`。不同样品的 response-zero offset 与 integration baseline 必须在各自 TOML
  中独立审核，不共享数值。
- 示例：`tpdtpd integration areas experiment.toml --input normalized.csv --target CO --result-id co_integration --start-c -180 --end-c -80 --interval-name peak-1 --interval peak-2 -60 80`

## 7. 绘图

五个 `plot` 叶命令共用一组只影响成图的参数。`--title` 默认 `auto`，会从实验和视图生成标题，
也可以显式给出自定义标题；它不是必填项。`--font-family auto` 保留出版字体栈，显式字体族（例如
macOS 的 `Heiti TC`）不存在时直接失败而不静默回退；`--font-weight auto` 保留标题、轴标签和正文的
原有层级，也可改为 `normal`、`medium`、`semibold` 或 `bold`。响应轴单位、科学计数法以及正式峰标注中的
`Tₚ`、`Tₘₐₓ`、`min⁻¹`、`g⁻¹`、`m⁻²` 均由 Matplotlib MathText 排版为真正的上下标，不要求安装 LaTeX。

`raw`、`temperature`、`calibration` 使用 `--smoothing-window-min`，`response`、`comparison` 使用
`--smoothing-window-c`。两者都是物理坐标上的**总窗宽**，默认 `0` 表示不平滑；非零值按输入的中位非零
采样间距换算为奇数点局部二次窗，至少须达到 5 点。该 local-quadratic 平滑只创建显示副本：不改写
CSV/TOML，不重算或改变温程拟合、校准因子、正式峰位、峰面积、基线或积分区间。

### `plot raw`

- 用途：从 HAL RGA 原始表查看一个或全部实测 AMU 电流。
- 必须明确：`config`、`--input`，并在可重复 `--mass` 或 `--all-masses` 中至少选择一种。
- 默认：`yscale=log`、`--smoothing-window-min=0`、自动标题、`600 dpi`、`--show=False`，在输入旁
  输出 `raw_signals.png` 且拒绝覆盖。
- 改变：非零平滑窗只改变所选质量通道的显示线；只写/显示图，不修改数据或配置。
- 示例：`tpdtpd plot raw experiment.toml --input raw.csv --mass 28 --mass 40 --smoothing-window-min 0.5 --font-family 'Heiti TC'`

### `plot temperature`

- 用途：查看 temperature fit review CSV 中的记录温度、拟合温度和选区。
- 必须明确：`config`、`--input`。
- 默认：`--smoothing-window-min=0`、自动标题、`600 dpi`、不显示 GUI，在输入旁写
  `temperature.png`。
- 改变：非零窗保留原始测温散点并增加一条显示平滑的测温线；下游实际使用的拟合温度线不变，
  不重新拟合模型，也不把图当成科研接受。
- 示例：`tpdtpd plot temperature experiment.toml --input temperature_fit.csv --smoothing-window-min 1 --title 'Temperature review'`

### `plot calibration`

- 用途：绘制 full-acquisition 目标/内标响应，并标示人工背景与平台区间。
- 必须明确：`config`、处理后输入、目标物种、两个区间；新目标可能还需目标 AMU。
- 默认：列、reference AMU/label 和 factor 尽量从 reviewed config 解析，
  `--smoothing-window-min=0`、`600 dpi`，不显示 GUI，在输入旁写 `calibration.png`。
- 改变：非零窗只平滑目标/内标显示线，人工背景/平台阴影、校准区间和因子不变；临时复核可显式
  `--response-factor`，正式 factor 仍来自 TOML，不读取旧的一行 calibration CSV。
- 示例：`tpdtpd plot calibration experiment.toml --input calibration_fragmentation.csv --target CO --target-mass 28 --calibration-background 0:5 --adsorption-plateau 15:25 --smoothing-window-min 0.5`

### `plot response`

- 用途：按 absolute、质量或 BET basis 绘制总响应或已审核的 baseline-subtracted 响应。
- 必须明确：`config`、`--response-mode`、`--input`、`--basis`；多目标 normalized 输入还要
  `--target`，单目标时可采用唯一物种。
- 默认：`program` 显示从程序零点到第一次最高温的完整升温支路；自动 y 轴和标题、固定颜色、
  `--smoothing-window-c=0`、`600 dpi`、不显示 GUI。输出名包含目标物种、response mode、basis 和显示范围，例如
  `co_response_total_mass-umol_program.png`，并直接写在输入旁；不同物种/口径不会互相覆盖，非默认
  平滑/字体还会追加防撞样式后缀。
- 条件输入：`total` 直接读取 normalized basis 列；`baseline-subtracted` 从同一 normalized CSV 与
  `[integration_baseline.<target>]` 的已审核定义即时复算并核验 SHA256，不需要扣基线 CSV。
- 正式标注：默认读取同目标物种的 `[peak_integration.*]`，重新核验 normalized 输入、baseline 指纹
  和 records JSON 后，以 MathText 标出每个 `Tₘₐₓ/Tₚ` 和当前 basis 的面积。
  `--no-annotate-integrations` 才显式生成纯响应图。
- 改变：非零 °C 总窗宽只平滑显示曲线，并把标记的纵坐标放在该显示线；TOML 中正式峰温和面积仍按原值
  标注。显示范围和平滑都不裁剪或改写 CSV。`analysis` 只看审核区，`custom` 必须成对提供
  `--start-c/--end-c`；裸温度边界不会暗中改变模式。
- 示例：`tpdtpd plot response experiment.toml --response-mode total --input co/normalized.csv --basis mass-umol --smoothing-window-c 12 --title 'CO TPD response' --font-family 'Heiti TC' --font-weight medium`

### `plot comparison`

- 用途：把至少两份实验的完整 total-response 程序升温曲线和正式逐峰结果画在同一张比较图。
- 必须明确：可重复的 `--series LABEL CONFIG INPUT` 和无歧义的 `--output`；每份 INPUT 都必须是
  对应实验的完整 normalized 单目标曲线。
- 默认：三行共享温度轴，依次为 absolute、mass-umol 和 BET；横轴为各实验完整升温支路的并集，
  `--smoothing-window-c=0`，每条线只画自己的实测区间而不外推。保留负值并画零参考线。
- 门禁：每份 config/曲线及其峰结果工件都重新做 SHA-256 检查。默认三面板中任一样品缺质量、
  BET、对应响应列或对应正式面积时整张图失败，不生成半成品；显式重复 `--basis` 可请求较少面板。
- 输出：曲线上以 MathText 标出每份样品的两个或多个 `Tₘₐₓ/Tₚ`；图底表格逐行列出样品、峰/特征、
  位置语义、温度、`µmol`、`µmol g⁻¹` 和 `µmol m⁻²` 面积。非零 °C 总窗宽独立按每份曲线的采样
  间距换算点窗，只平滑显示线；正式峰温和面积仍来自各样品自己的 reviewed integration baseline。
  同样品多峰可共享一条基线；不能把 endpoint-held extension 当成另一峰的正式基线。
- 示例：`tpdtpd plot comparison --series Ge-ZSM-5 ge.toml ge/normalized.csv --series ZSM-5 zsm.toml zsm/normalized.csv --smoothing-window-c 12 --title 'CO TPD comparison' --font-family 'Heiti TC' --font-weight medium --output response_comparison.png`

## 其他 CLI 入口（不计入上述 35 个 `tpdtpd` 叶命令）

#### `tpxdocs list`

- 用途：只读列出随当前 checkout 或安装包提供的 Markdown、HTML 和图片学习资源；不打开、
  不修改实验。
- 必须明确：没有需要填写的命令参数。
- 默认：列出全部 kind 和 collection；自动发现当前文档根目录；`--json=False`，所以输出
  适合人读的目录。只有需要筛选时才填写 `--kind` / `--collection`。
- 示例：`tpxdocs list`

#### `tpxdocs show RESOURCE_ID`

- 用途：按 `tpxdocs list` 返回的稳定资源 ID 读取一份离线文档。
- 必须明确：位置参数 `RESOURCE_ID`。
- 默认：省略 `--catalog-sha256`，即不要求目录并发校验；`--json=False`，文本资源直接打印
  内容，图片只打印可打开的绝对路径而不把二进制写入终端。
- 示例：`tpxdocs show TPDsop/index.md`

#### `tprtpr` / `tpotpo`

- 这两个方法入口当前各有 0 个已验证科研命令，其 manifest 都是 `commands=[]`。
- 入口和版本信息存在，只表示方法路由已保留，不表示 TPR/TPO 工作流已经实现；不能借用
  `tpdtpd` 命令或伪造科研步骤。

## 如何确认本文仍与源码同步

```bash
tpdtpd --manifest-json
tpdtpd --list --plain
tpdtpd COMMAND ACTION --help
python -m pytest tests/test_cli_parameter_defaults.py tests/test_cli_documentation.py
```

manifest 面向应用发布 parser 的真实 `required/default`、必填组合、类型、单位提示、默认值和
JSON 能力；它不是另一份用来重新定义必填或“高级参数”的人工规则表。
