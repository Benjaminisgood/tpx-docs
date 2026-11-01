(() => {
  const offsetLab = document.querySelector("[data-offset-lab]");
  const offsetButtons = document.querySelectorAll("[data-offset-value]");
  const offsetClockLabel = document.querySelector("[data-offset-clock-label]");
  const offsetSummary = document.querySelector("[data-offset-summary]");
  const effectiveDelta = document.querySelector("[data-effective-delta]");
  const programDelta = document.querySelector("[data-program-delta]");
  const offsetStates = {
    "-30": {
      state: "minus",
      clock: "向前移动 30 s",
      summary: "−30 s · 温度时钟向前移",
      effective: "−30 s",
      program: "+0.5 min",
    },
    0: {
      state: "zero",
      clock: "不移动",
      summary: "0 s · 两条时间轴不平移",
      effective: "不变",
      program: "不变",
    },
    30: {
      state: "plus",
      clock: "向后移动 30 s",
      summary: "+30 s · 温度时钟向后移",
      effective: "+30 s",
      program: "−0.5 min",
    },
  };

  if (
    offsetLab &&
    offsetClockLabel &&
    offsetSummary &&
    effectiveDelta &&
    programDelta &&
    offsetButtons.length
  ) {
    offsetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.offsetValue;
        const copy = offsetStates[value];
        offsetLab.dataset.offsetState = copy.state;
        offsetClockLabel.textContent = copy.clock;
        offsetSummary.textContent = copy.summary;
        effectiveDelta.textContent = copy.effective;
        programDelta.textContent = copy.program;
        offsetButtons.forEach((candidate) => {
          candidate.setAttribute("aria-pressed", String(candidate === button));
        });
      });
    });
  }

  const boundsWorkbench = document.querySelector("[data-bounds-workbench]");
  const boundsButtons = document.querySelectorAll("[data-bounds-policy]");
  const boundsLabel = document.querySelector("[data-bounds-label]");
  const boundsTitle = document.querySelector("[data-bounds-title]");
  const boundsCopy = document.querySelector("[data-bounds-copy]");
  const boundsShape = document.querySelector("[data-bounds-shape]");
  const boundsStates = {
    error: {
      label: "error · 最保守的首次检查",
      title: "发现任一越界 RGA 行就停止",
      copy: "不会静默删行、填缺失或延长端点温度；先检查两只时钟、offset 与实际覆盖范围。",
      shape: "无对齐输出",
    },
    drop: {
      label: "drop · 显式接受数据缺口",
      title: "删除温控范围之外的 RGA 行",
      copy: "保留下来的行都有可插值温度，但输出不再包含完整窗口内的全部 RGA 行；必须检查删去多少。",
      shape: "N_aligned < N_window（存在越界时）",
    },
    nan: {
      label: "nan · 保留行结构与缺失",
      title: "保留越界 RGA 行，插值温度写为 NaN",
      copy: "行标识和信号仍在，缺失温度保持可见；后续步骤必须能正确处理缺失值。",
      shape: "N_aligned = N_window；temperature_interp_c 可缺失",
    },
    clip: {
      label: "clip · 显式采用端点假设",
      title: "保留越界 RGA 行，使用最近端点温度",
      copy: "不会做线性外推，但端点温度会覆盖越界时刻；这项假设需要实验依据，不能因为图形连续就默认接受。",
      shape: "N_aligned = N_window；越界温度取最近端点",
    },
  };

  if (
    boundsWorkbench &&
    boundsLabel &&
    boundsTitle &&
    boundsCopy &&
    boundsShape &&
    boundsButtons.length
  ) {
    boundsButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const policy = button.dataset.boundsPolicy;
        const copy = boundsStates[policy];
        boundsWorkbench.dataset.policy = policy;
        boundsLabel.textContent = copy.label;
        boundsTitle.textContent = copy.title;
        boundsCopy.textContent = copy.copy;
        boundsShape.textContent = copy.shape;
        boundsButtons.forEach((candidate) => {
          candidate.setAttribute("aria-pressed", String(candidate === button));
        });
      });
    });
  }
})();
