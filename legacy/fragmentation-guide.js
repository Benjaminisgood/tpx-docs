(() => {
  const orientation = document.querySelector("[data-orientation-matrix]");
  const orientationButtons = document.querySelectorAll("[data-matrix-mode]");
  const orientationExplanation = document.querySelector("[data-matrix-explanation]");
  const orientationCopy = {
    all: "先把矩阵当成一张映射表：每一行对应一个观测 m/z，每一列对应一个待求物种。",
    row: "读一行：同一个观测 m/z 可以同时接收多个物种的贡献。",
    column: "读一列：同一个物种可以在多个观测 m/z 上留下响应。",
  };

  if (orientation && orientationExplanation && orientationButtons.length) {
    orientationButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.matrixMode;
        orientation.dataset.mode = mode;
        orientationExplanation.textContent = orientationCopy[mode];
        orientationButtons.forEach((candidate) => {
          candidate.setAttribute(
            "aria-pressed",
            String(candidate === button),
          );
        });
      });
    });
  }

  const policyDemo = document.querySelector("[data-policy-demo]");
  const policyButtons = document.querySelectorAll("[data-policy-mode]");
  const strictResult = document.querySelector("[data-policy-result='error']");
  const availableResult = document.querySelector(
    "[data-policy-result='available']",
  );

  if (
    policyDemo &&
    strictResult &&
    availableResult &&
    policyButtons.length
  ) {
    policyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.policyMode;
        policyDemo.dataset.policy = mode;
        strictResult.hidden = mode !== "error";
        availableResult.hidden = mode !== "available";
        policyButtons.forEach((candidate) => {
          candidate.setAttribute(
            "aria-pressed",
            String(candidate === button),
          );
        });
      });
    });
  }
})();
