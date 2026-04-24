const BOOTSTRAP_URL = "https://claude.ai/api/bootstrap";
const USAGE_URL     = (orgId) => `https://claude.ai/api/organizations/${orgId}/usage`;
const MIN_FETCH_MS  = 60_000;

const COLOR = {
  green:  "#34C759",
  orange: "#FF9500",
  red:    "#FF3B30",
  gray:   "#8E8E93",
};

function thresholdColor(pct, cfg) {
  if (pct >= cfg.critical_threshold) return COLOR.red;
  if (pct >= cfg.warn_threshold)     return COLOR.orange;
  return COLOR.green;
}

// ── Dynamic icon ──────────────────────────────────────────────────────────────
// Two stacked bars drawn into the toolbar icon — visible without opening popup.

function drawBars(winPct, weekPct, winColor, weekColor) {
  const size   = 32;
  const canvas = new OffscreenCanvas(size, size);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = "#1C1C1E";
  ctx.fillRect(0, 0, size, size);

  const pad  = 3;
  const barH = 11;
  const barW = size - pad * 2;

  function bar(y, pct, color) {
    ctx.fillStyle = "#3A3A3C";
    ctx.fillRect(pad, y, barW, barH);
    const fill = Math.max(2, Math.round(barW * pct / 100));
    ctx.fillStyle = color;
    ctx.fillRect(pad, y, fill, barH);
  }

  bar(4,              winPct,  winColor);
  bar(size - barH - 4, weekPct, weekColor);

  return ctx.getImageData(0, 0, size, size);
}

function drawError() {
  const size   = 32;
  const canvas = new OffscreenCanvas(size, size);
  const ctx    = canvas.getContext("2d");
  ctx.fillStyle = "#1C1C1E";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = COLOR.red;
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", size / 2, size / 2);
  return ctx.getImageData(0, 0, size, size);
}

// ── API ───────────────────────────────────────────────────────────────────────

async function getOrgId() {
  const stored = await chrome.storage.local.get("orgId");
  if (stored.orgId) return stored.orgId;

  const resp = await fetch(BOOTSTRAP_URL, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    const err = new Error(`bootstrap HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  const data  = await resp.json();
  const orgId = data?.account?.memberships?.[0]?.organization?.uuid;
  if (!orgId) throw new Error("org ID not found in bootstrap response");
  await chrome.storage.local.set({ orgId });
  return orgId;
}

async function fetchUsage() {
  const orgId = await getOrgId();
  const resp  = await fetch(USAGE_URL(orgId), {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    const err = new Error(`usage HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

// ── Badge + icon update ───────────────────────────────────────────────────────

async function applyData(data, cfg) {
  const winPct  = parseFloat(data.five_hour?.utilization ?? 0);
  const weekPct = parseFloat(data.seven_day?.utilization ?? 0);
  const winColor  = thresholdColor(winPct, cfg);
  const weekColor = thresholdColor(weekPct, cfg);

  await chrome.action.setIcon({ imageData: drawBars(winPct, weekPct, winColor, weekColor) });
  await chrome.action.setBadgeText({ text: String(Math.round(winPct)) });
  await chrome.action.setBadgeBackgroundColor({ color: winColor });
  await chrome.action.setTitle({
    title: `5h: ${winPct.toFixed(1)}%  •  Weekly: ${weekPct.toFixed(1)}%`,
  });
}

async function applyError(text = "!") {
  await chrome.action.setIcon({ imageData: drawError() });
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: COLOR.red });
}

async function applyIdle() {
  await chrome.action.setBadgeText({ text: "–" });
  await chrome.action.setBadgeBackgroundColor({ color: COLOR.gray });
  await chrome.action.setTitle({ title: "Claude Usage — not logged in to claude.ai" });
}

// ── Refresh logic ─────────────────────────────────────────────────────────────

async function doRefresh() {
  const stored = await chrome.storage.local.get(["config", "cache", "authError"]);
  const cfg    = { warn_threshold: 75, critical_threshold: 90, ...stored.config };
  const cache  = stored.cache || {};

  const age = Date.now() - (cache.fetched_at || 0);
  if (cache.data && age < MIN_FETCH_MS) {
    await applyData(cache.data, cfg);
    return;
  }

  try {
    const data = await fetchUsage();
    await chrome.storage.local.set({ cache: { data, fetched_at: Date.now() }, authError: false });
    await applyData(data, cfg);
  } catch (err) {
    const isAuth = err.status === 401 || err.status === 403;
    if (isAuth) {
      // Clear cached org ID — it may have changed after re-login
      await chrome.storage.local.set({ authError: true, orgId: null });
      await applyIdle();
    } else if (cache.data) {
      await applyData(cache.data, cfg);
    } else {
      await applyError("!");
    }
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("refresh", { periodInMinutes: 1 });
  doRefresh();
});

chrome.runtime.onStartup.addListener(() => doRefresh());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refresh") doRefresh();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "refresh") {
    chrome.storage.local.set({ cache: null, authError: false }).then(() => {
      doRefresh().then(() => sendResponse({ ok: true }));
    });
    return true;
  }
});
