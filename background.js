let running = false;

async function clearAndReload() {
  // The listener's tab arg is unreliable when focus is in DevTools, so resolve it ourselves.
  const [win, allTabs] = await Promise.all([
    chrome.windows.getLastFocused({ windowTypes: ["normal"] }),
    chrome.tabs.query({}),
  ]);

  const active = allTabs.find((t) => t.windowId === win.id && t.active);
  if (!active?.url) return false;

  const url = new URL(active.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const site = await registrableDomain(url);
  const onSite = (u) => {
    if (!URL.canParse(u)) return false;
    const { protocol, hostname } = new URL(u);
    return (
      (protocol === "http:" || protocol === "https:") &&
      (hostname === site || hostname.endsWith("." + site))
    );
  };

  // Other open tabs on the site would otherwise write their in-memory state straight back.
  const tabs = allTabs.filter((t) => !t.discarded && onSite(t.url));

  const [frames, visited] = await Promise.all([
    Promise.all(
      tabs.map((t) =>
        chrome.scripting
          .executeScript({
            target: { tabId: t.id, allFrames: true },
            world: "MAIN",
            func: silencePage,
            args: [site],
          })
          .catch(() => []),
      ),
    ),
    // Storage can only be cleared per exact origin, so history is the only way to find the site's other ports and subdomains.
    chrome.history.search({ text: site, startTime: 0, maxResults: 100000 }),
  ]);

  const origins = new Set([url.origin]);
  for (const u of [
    ...allTabs.map((t) => t.url),
    ...visited.map((i) => i.url),
    ...frames.flat().map((f) => f.result),
  ]) {
    if (onSite(u)) origins.add(new URL(u).origin);
  }

  await chrome.browsingData
    .remove(
      { origins: [...origins] },
      {
        cacheStorage: true,
        cookies: true,
        fileSystems: true,
        indexedDB: true,
        localStorage: true,
        serviceWorkers: true,
      },
    )
    .finally(() =>
      // Reload even if the wipe failed, or the silenced tabs keep dropping every write; a tab closed meanwhile is not an error.
      Promise.all(
        tabs.map((t) =>
          chrome.tabs.reload(t.id, { bypassCache: true }).catch(() => { }),
        ),
      ),
    );

  // Chrome runs removals one at a time and this one scans the whole disk cache, so it goes last and nothing waits for it.
  chrome.browsingData
    .remove({ origins: [...origins] }, { cache: true })
    .catch(console.error);

  return true;
}

// Runs in the page: without this, unload handlers and pending timers would persist state again between the wipe and the reload.
function silencePage(site) {
  const { hostname } = location;
  if (hostname !== site && !hostname.endsWith("." + site)) return null;

  for (const type of ["beforeunload", "pagehide", "unload", "visibilitychange", "freeze"]) {
    addEventListener(type, (e) => e.stopImmediatePropagation(), true);
  }

  try {
    sessionStorage.clear();
  } catch { }

  Storage.prototype.setItem = () => { };
  Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set() { } });
  return location.origin;
}

// Chrome has no public suffix API, but it refuses cookies on public suffixes, so the first parent domain that accepts one is the site.
async function registrableDomain({ origin, hostname }) {
  if (/^[\d.]+$/.test(hostname)) return hostname;

  const labels = hostname.split(".");
  for (let i = labels.length - 2; i > 0; i--) {
    const domain = labels.slice(i).join(".");
    if (
      await chrome.cookies
        .set({ url: origin, domain, name: "__clear_and_reload_probe", value: "1" })
        .catch(() => null)
    ) {
      return domain;
    }
  }
  return hostname;
}

function flashBadge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1500);
}

chrome.action.onClicked.addListener(async () => {
  if (running) return;
  running = true;
  try {
    if (await clearAndReload()) flashBadge("✓", "#2e7d32");
  } catch (e) {
    console.error(e);
    flashBadge("!", "#c62828");
  } finally {
    running = false;
  }
});
