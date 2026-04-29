(() => {
  if (window.__claudeUsageLoaded) return;
  window.__claudeUsageLoaded = true;

  let interceptedData = null;
  let interceptedToken = null;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'CLAUDE_API_INTERCEPT') {
      const data = event.data.data;
      if (data?.five_hour || data?.seven_day) {
        interceptedData = { data, ts: Date.now(), url: event.data.url };
      } else {
        // Search deeply for five_hour or seven_day in the response
        const findUsage = (o, d = 0) => {
          if (d > 6 || !o || typeof o !== "object") return null;
          if (o.five_hour || o.seven_day) return o;
          for (const v of Object.values(o)) { const f = findUsage(v, d + 1); if (f) return f; }
          return null;
        };
        const embedded = findUsage(data);
        if (embedded) {
          interceptedData = { data: embedded, ts: Date.now(), url: event.data.url };
        }
      }
    } else if (event.data?.type === 'CLAUDE_API_TOKEN') {
      interceptedToken = event.data.token;
    }
  });

  function findOAuthToken() {
    if (interceptedToken) return interceptedToken;
    for (const store of [localStorage, sessionStorage]) {
      for (const key of Object.keys(store)) {
        try {
          const raw = store.getItem(key);
          if (!raw) continue;
          if (raw.startsWith("eyJ") && raw.split(".").length === 3) return raw;
          const val = JSON.parse(raw);
          const token = val?.accessToken ?? val?.access_token ?? val?.claudeAiOauth?.accessToken ?? val?.token;
          if (typeof token === "string" && token.startsWith("eyJ")) return token;
        } catch { /* skip */ }
      }
    }
    return null;
  }

  async function findOAuthTokenIDB() {
    try {
      const dbs = await indexedDB.databases();
      for (const { name } of dbs) {
        try {
          const token = await new Promise((res) => {
            const req = indexedDB.open(name);
            const timer = setTimeout(() => res(null), 800);
            req.onsuccess = (e) => {
              const db = e.target.result;
              const stores = Array.from(db.objectStoreNames);
              const results = [];
              let pending = stores.length;
              if (!pending) { clearTimeout(timer); res(null); return; }
              for (const s of stores) {
                try {
                  const tx = db.transaction(s, "readonly");
                  const cur = tx.objectStore(s).openCursor();
                  cur.onsuccess = (ev) => {
                    const c = ev.target.result;
                    if (c) {
                      const v = JSON.stringify(c.value ?? "");
                      const m = v.match(/"(eyJ[A-Za-z0-9._-]{20,})"/);
                      if (m) results.push(m[1]);
                      c.continue();
                    } else {
                      if (--pending === 0) { clearTimeout(timer); res(results[0] ?? null); }
                    }
                  };
                  cur.onerror = () => { if (--pending === 0) { clearTimeout(timer); res(results[0] ?? null); } };
                } catch { if (--pending === 0) { clearTimeout(timer); res(results[0] ?? null); } }
              }
            };
            req.onerror = () => { clearTimeout(timer); res(null); };
          });
          if (token) return token;
        } catch {}
      }
    } catch {}
    return null;
  }

  function xhrGet(url, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
      for (const [k, v] of Object.entries(extraHeaders)) xhr.setRequestHeader(k, v);
      xhr.withCredentials = true;
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error("JSON parse failed")); }
        } else {
          const err = new Error(`HTTP ${xhr.status}`);
          err.status = xhr.status;
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error("network error"));
      xhr.send();
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== "fetchUsage") return;

    (async () => {
      const dbg = { oauthFound: false, idbFound: false, tried: [] };
      try {
        if (interceptedData && (Date.now() - interceptedData.ts) < 300_000) {
          sendResponse({ ok: true, orgId: null, usage: interceptedData.data });
          return;
        }

        let oauthToken = findOAuthToken();
        dbg.oauthFound = !!oauthToken;

        if (!oauthToken) {
          oauthToken = await findOAuthTokenIDB();
          dbg.idbFound = !!oauthToken;
        }

        if (oauthToken) {
          try {
            const usage = await xhrGet("https://api.anthropic.com/api/oauth/usage", {
              "Authorization": `Bearer ${oauthToken}`,
              "anthropic-beta": "oauth-2025-04-20",
              "User-Agent": "claude-code/2.0.32",
            });
            if (usage?.five_hour || usage?.seven_day) {
              sendResponse({ ok: true, orgId: null, usage, oauthToken });
              return;
            }
          } catch (e) { dbg.oauthError = e.message; }
        }

        let bootstrap;
        try {
          bootstrap = await xhrGet("/api/bootstrap");
          dbg.orgId = bootstrap?.account?.memberships?.[0]?.organization?.uuid ?? null;
          dbg.acctId = bootstrap?.account?.uuid ?? null;

          const findUsage = (o, d = 0) => {
            if (d > 6 || !o || typeof o !== "object") return null;
            if (o.five_hour || o.seven_day) return o;
            for (const v of Object.values(o)) { const f = findUsage(v, d + 1); if (f) return f; }
            return null;
          };
          const embedded = findUsage(bootstrap);
          if (embedded) { sendResponse({ ok: true, orgId: dbg.orgId, usage: embedded }); return; }
        } catch (e) {
          sendResponse({ ok: false, error: `bootstrap failed: ${e.message}`, debug: dbg });
          return;
        }

        const paths = [
          dbg.orgId  && `/api/organizations/${dbg.orgId}/usage`,
          dbg.acctId && `/api/accounts/${dbg.acctId}/usage`,
          dbg.orgId  && `/api/organizations/${dbg.orgId}/rate_limit_status`,
          dbg.orgId  && `/api/organizations/${dbg.orgId}/limits`,
          dbg.acctId && `/api/accounts/${dbg.acctId}/rate_limit_status`,
          `/api/usage`,
          `/api/usage_status`,
          `/api/rate_limit_status`,
        ].filter(Boolean);

        for (const path of paths) {
          try {
            const usage = await xhrGet(path);
            dbg.tried.push(path);
            if (usage?.five_hour || usage?.seven_day) {
              sendResponse({ ok: true, orgId: dbg.orgId ?? dbg.acctId, usage });
              return;
            }
          } catch (e) { dbg.tried.push({ path, err: e.message }); }
        }

        sendResponse({ ok: false, error: "usage endpoint not found", debug: dbg });
      } catch (e) {
        sendResponse({ ok: false, error: e.message, debug: dbg });
      }
    })();
    return true;
  });
})();
