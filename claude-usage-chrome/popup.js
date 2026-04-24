const COLORS = { green: "#34C759", orange: "#FF9500", red: "#FF3B30" };

function colorFor(pct, cfg) {
  if (pct >= cfg.critical_threshold) return COLORS.red;
  if (pct >= cfg.warn_threshold)     return COLORS.orange;
  return COLORS.green;
}

function colorClass(pct, cfg) {
  if (pct >= cfg.critical_threshold) return "red";
  if (pct >= cfg.warn_threshold)     return "orange";
  return "green";
}

function timeUntil(isoStr) {
  if (!isoStr) return null;
  const secs = Math.floor((new Date(isoStr) - Date.now()) / 1000);
  if (secs <= 0) return "resetting soon";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function sectionHTML(title, pct, resetsAt, cfg) {
  const color    = colorFor(pct, cfg);
  const cls      = colorClass(pct, cfg);
  const resetStr = timeUntil(resetsAt);
  return `
    <div class="section">
      <div class="section-title">${title}</div>
      <div class="progress-row">
        <div class="progress-bar">
          <div class="progress-fill" style="width:${Math.min(pct, 100)}%;background:${color}"></div>
        </div>
        <span class="pct-label ${cls}">${pct.toFixed(1)}%</span>
      </div>
      ${resetStr ? `<div class="reset-time">Resets in ${resetStr}</div>` : ""}
    </div>`;
}

async function render() {
  const content   = document.getElementById("content");
  const updatedAt = document.getElementById("updated-at");

  const stored = await chrome.storage.local.get(["config", "cache", "authError"]);
  const cfg    = { warn_threshold: 75, critical_threshold: 90, ...stored.config };

  if (stored.authError) {
    content.innerHTML = `
      <div class="no-token">
        <strong>Not logged in</strong>
        Log in to claude.ai, then click Refresh.
      </div>`;
    updatedAt.textContent = "";
    return;
  }

  const cache = stored.cache;
  if (!cache?.data) {
    content.innerHTML = `<div class="placeholder">Fetching…</div>`;
    updatedAt.textContent = "";
    return;
  }

  const data    = cache.data;
  const win     = data.five_hour      || {};
  const week    = data.seven_day      || {};
  const opus    = data.seven_day_opus || {};
  const winPct  = parseFloat(win.utilization  ?? 0);
  const weekPct = parseFloat(week.utilization ?? 0);
  const opusPct = parseFloat(opus.utilization ?? 0);

  let html = sectionHTML("5-Hour Window", winPct, win.resets_at, cfg);
  html += `<div class="divider"></div>`;
  html += sectionHTML("Weekly", weekPct, week.resets_at, cfg);

  if (opusPct > 0) {
    html += `<div class="divider"></div>`;
    html += sectionHTML("Weekly Opus", opusPct, opus.resets_at, cfg);
  }

  content.innerHTML = html;

  const ageSecs = Math.floor((Date.now() - (cache.fetched_at || 0)) / 1000);
  if (ageSecs < 60)   updatedAt.textContent = `Updated ${ageSecs}s ago`;
  else if (ageSecs < 3600) updatedAt.textContent = `Updated ${Math.floor(ageSecs / 60)}m ago`;
  else                updatedAt.textContent = `Updated ${Math.floor(ageSecs / 3600)}h ago`;
}

document.addEventListener("DOMContentLoaded", async () => {
  await render();

  document.getElementById("refresh-btn").addEventListener("click", async () => {
    const btn = document.getElementById("refresh-btn");
    btn.classList.add("spinning");
    btn.disabled = true;
    await chrome.runtime.sendMessage({ type: "refresh" });
    await render();
    btn.classList.remove("spinning");
    btn.disabled = false;
  });

  document.getElementById("options-btn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});
