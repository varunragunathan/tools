if (window.__claudeUsageLoaded) return; // already injected, existing listener still active
window.__claudeUsageLoaded = true;

function xhrGet(path) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", path, true);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve({ status: xhr.status, data: JSON.parse(xhr.responseText) }); }
        catch (e) { reject(new Error("JSON parse failed")); }
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
    try {
      const { data: bootstrap } = await xhrGet("/api/bootstrap");
      const account = bootstrap?.account ?? {};
      const orgId   = account?.memberships?.[0]?.organization?.uuid;
      const acctId  = account?.uuid;

      // Walk candidate endpoints in order
      const candidates = [
        orgId  && `/api/organizations/${orgId}/usage`,
        acctId && `/api/accounts/${acctId}/usage`,
        `/api/usage`,
      ].filter(Boolean);

      for (const path of candidates) {
        try {
          const { data: usage } = await xhrGet(path);
          if (usage?.five_hour || usage?.seven_day) {
            sendResponse({ ok: true, orgId: orgId ?? acctId, usage });
            return;
          }
        } catch (_) { /* try next */ }
      }

      // Nothing worked — return account sub-keys for debugging
      sendResponse({
        ok: false,
        error: "usage endpoint not found",
        debug: {
          accountKeys: Object.keys(account),
          orgId,
          acctId,
          triedPaths: candidates,
        },
      });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();

  return true;
});
