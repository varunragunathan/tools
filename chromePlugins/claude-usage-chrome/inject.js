(() => {
  if (window.__claudeUsageFetchWrapped) return;
  window.__claudeUsageFetchWrapped = true;

  const _fetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === "string" ? args[0] : (args[0]?.url ?? "");
    let token = null;

    // Try to extract Authorization header if it's passed in options
    if (args[1] && args[1].headers) {
      const headers = new Headers(args[1].headers);
      if (headers.has('Authorization')) {
        token = headers.get('Authorization').replace('Bearer ', '');
      }
    }

    if (token) {
      window.postMessage({ type: 'CLAUDE_API_TOKEN', token }, '*');
    }

    const reqPromise = _fetch.apply(this, args);
    reqPromise.then(resp => {
      try {
        if (url && (url.includes('usage') || url.includes('rate_limit') || url.includes('limit_status') || url.includes('bootstrap') || url.includes('chat_conversations') || url.includes('messages'))) {
          resp.clone().json().then(data => {
            window.postMessage({ type: 'CLAUDE_API_INTERCEPT', url, data }, '*');
          }).catch(() => {});
        }
      } catch (err) {
        // Ignore errors
      }
    });
    return reqPromise;
  };
})();
