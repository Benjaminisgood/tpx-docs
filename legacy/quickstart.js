(() => {
  "use strict";

  const quickstart = document.querySelector("[data-quickstart]");
  if (!quickstart) return;

  const status = quickstart.querySelector("[data-copy-status]");
  const resetTimers = new WeakMap();

  const copyWithFallback = async (text) => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  };

  const selectCode = (code) => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  quickstart.classList.add("copy-enabled");
  quickstart.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-target]");
    if (!button || !quickstart.contains(button)) return;

    const code = document.getElementById(button.dataset.copyTarget);
    const label = button.querySelector("[data-copy-label]");
    const text = code?.dataset.copyValue;
    if (!code || !label || !text) return;

    const previousTimer = resetTimers.get(button);
    if (previousTimer) window.clearTimeout(previousTimer);
    button.disabled = true;

    try {
      const copied = await copyWithFallback(text);
      if (!copied) throw new Error("copy unavailable");
      label.textContent = "已复制";
      if (status) status.textContent = `已复制：${button.getAttribute("aria-label")}`;
    } catch {
      selectCode(code);
      label.textContent = "已选中";
      if (status) status.textContent = "浏览器未允许自动复制；命令已经选中，可手动复制。";
    } finally {
      button.disabled = false;
      const timer = window.setTimeout(() => {
        label.textContent = "复制";
      }, 1800);
      resetTimers.set(button, timer);
    }
  });
})();
