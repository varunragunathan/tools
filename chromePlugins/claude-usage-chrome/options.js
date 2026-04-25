async function load() {
  const { config } = await chrome.storage.local.get("config");
  const cfg = { warn_threshold: 75, critical_threshold: 90, ...config };
  document.getElementById("warn").value     = cfg.warn_threshold;
  document.getElementById("critical").value = cfg.critical_threshold;
  document.getElementById("warn-val").textContent     = `${cfg.warn_threshold}%`;
  document.getElementById("critical-val").textContent = `${cfg.critical_threshold}%`;
}

document.addEventListener("DOMContentLoaded", async () => {
  await load();

  document.getElementById("warn").addEventListener("input", (e) => {
    document.getElementById("warn-val").textContent = `${e.target.value}%`;
  });
  document.getElementById("critical").addEventListener("input", (e) => {
    document.getElementById("critical-val").textContent = `${e.target.value}%`;
  });

  document.getElementById("save-btn").addEventListener("click", async () => {
    const warn     = parseInt(document.getElementById("warn").value, 10);
    const critical = parseInt(document.getElementById("critical").value, 10);
    await chrome.storage.local.set({
      config: { warn_threshold: warn, critical_threshold: critical },
      cache: null,
    });
    chrome.runtime.sendMessage({ type: "refresh" });
    const status = document.getElementById("status");
    status.textContent = "Saved!";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
});
