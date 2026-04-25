const MIN_FETCH_MS = 60_000;

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

  bar(4,               winPct,  winColor);
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

// ── Fetch via tab ─────────────────────────────────────────────────────────────
// Runs the API calls inside an existing claude.ai tab so the session cookies
// are included automatically — service workers can't send them directly.

async function fetchViaTab(cachedOrgId) {
  const tabs = await chrome.tabs.query({ url: "https://claude.ai/*" });
  if (!tabs.length) {
    const err = new Error("No claude.ai tab open");
    err.code = "NO_TAB";
    throw err;
  }

  const tabId = tabs[0].id;

  // Inject content script if not already present (tabs that were open before
  // the extension installed don't get content scripts automatically).
  // The guard in content.js prevents duplicate listener registration.
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (_) { /* already injected or tab not ready — proceed anyway */ }

  // Send message to content.js running inside the claude.ai tab.
  // Content scripts have full session cookie access; service workers don't.
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "fetchUsage", orgId: cachedOrgId ?? null },
      (response) => {
        if (chrome.runtime.lastError) {
          const err = new Error(chrome.runtime.lastError.message);
          err.code = "NO_CONTENT_SCRIPT";
          reject(err);
          return;
        }
        if (!response?.ok) {
          const d = response?.debug;
          const msg = d
            ? `${response.error} | boot:${JSON.stringify(d.bootstrapKeys)} acct:${JSON.stringify(d.accountKeys)} org:${d.orgId} acct:${d.acctId} tried:${JSON.stringify(d.tried)}`
            : (response?.error ?? "content script returned error");
          const err = new Error(msg);
          err.authFail = response?.authFail ?? false;
          reject(err);
          return;
        }
        // Cache the OAuth token if the content script found one in localStorage
        if (response.oauthToken) {
          chrome.storage.local.set({ oauthToken: response.oauthToken });
        }
        resolve({ orgId: response.orgId, usage: response.usage });
      },
    );
  });
}

// ── Badge + icon ──────────────────────────────────────────────────────────────

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

async function applyIdle(text, title) {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: COLOR.gray });
  await chrome.action.setTitle({ title });
}

// ── Refresh ───────────────────────────────────────────────────────────────────

async function doRefresh() {
  const stored = await chrome.storage.local.get(["config", "cache", "orgId"]);
  const cfg    = { warn_threshold: 75, critical_threshold: 90, ...stored.config };
  const cache  = stored.cache || {};

  const age = Date.now() - (cache.fetched_at || 0);
  if (cache.data && age < MIN_FETCH_MS) {
    await applyData(cache.data, cfg);
    return;
  }

  try {
    const { orgId, usage } = await fetchViaTab(stored.orgId);
    await chrome.storage.local.set({
      orgId,
      cache: { data: usage, fetched_at: Date.now() },
      noTab: false,
      authError: false,
      lastError: null,
    });
    await applyData(usage, cfg);
  } catch (err) {
    if (err.code === "NO_TAB" || err.code === "NO_CONTENT_SCRIPT") {
      await chrome.storage.local.set({ noTab: true, lastError: err.message });
      if (cache.data) {
        await applyData(cache.data, cfg);
      } else {
        await applyIdle("–", "Claude Usage — open claude.ai in a tab");
      }
    } else {
      await chrome.storage.local.set({ orgId: null, authError: true, lastError: err.message });
      if (cache.data) {
        await applyData(cache.data, cfg);
      } else {
        await applyIdle("!", `Claude Usage — ${err.message}`);
      }
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
    chrome.storage.local.set({ cache: null, authError: false, noTab: false }).then(() => {
      doRefresh().then(() => sendResponse({ ok: true }));
    });
    return true;
  }
});
