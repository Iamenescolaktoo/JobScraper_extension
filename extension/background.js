// background.js (NO SERVER mode)
// Refreshing jobs means: import extension/jobs.json into chrome.storage.local as jobsCache.

const DEFAULT = {
  settings: {
    requiredJobs: 2,
    unlockMinutes: 5,
    query: "data internship",
    location: "Chicago, IL",
    hoursOld: 72,
    limit: 40,
    gradMonth: 5,
    gradYear: 2026,
    dailyCapEnabled: false,
    dailyCapMax: 20
  },
  state: {
    completedJobs: 0,
    unlockedUntil: 0,
    dismissedUntil: null,
    completedJobsToday: 0,
    lastResetDate: ""
  }
};

async function importJobsJsonToCache() {
  try {
    const url = chrome.runtime.getURL("jobs.json") + `?v=${Date.now()}`;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`jobs.json HTTP ${resp.status}`);

    const jobs = await resp.json();
    const count = Array.isArray(jobs) ? jobs.length : 0;

    await chrome.storage.local.set({
      jobsCache: jobs,
      jobsCacheUpdatedAt: Date.now(),
      jobsCacheCount: count
    });

    console.log(`✅ Imported jobs.json into jobsCache (${count})`);
  } catch (err) {
    console.error("⚠️ Failed to import jobs.json:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(null, (existing) => {
    const merged = {
      settings: { ...DEFAULT.settings, ...(existing.settings || {}) },
      state: { ...DEFAULT.state, ...(existing.state || {}) },
      appliedJobs: existing.appliedJobs || [],
      skippedJobs: existing.skippedJobs || [],
      jobsCache: existing.jobsCache || [],
      jobsCacheUpdatedAt: existing.jobsCacheUpdatedAt || 0,
      jobsCacheCount: existing.jobsCacheCount || 0
    };

    chrome.storage.local.set(merged, () => {
      importJobsJsonToCache();
    });
  });
});

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  switch (msg.type) {
    case "GET_ALL":
      chrome.storage.local.get(null, sendResponse);
      return true;

    case "SET_STATE":
      chrome.storage.local.set({ state: msg.state });
      break;

    case "SET_SETTINGS":
      chrome.storage.local.set({ settings: msg.settings }, () => {
        // No server. We just re-import whatever jobs.json exists.
        importJobsJsonToCache();
      });
      break;

    case "CAP_SETTINGS_UPDATED":
      chrome.storage.local.get(["state"], (res) => {
        const state = res.state || {};

        if (!msg.settings.dailyCapEnabled) {
          state.dismissedUntil = null;
        }

        if (
          msg.settings.dailyCapEnabled &&
          state.completedJobsToday < msg.settings.dailyCapMax
        ) {
          state.dismissedUntil = null;
        }

        chrome.storage.local.set({ state });
      });
      break;

    case "REFRESH_JOBS":
      importJobsJsonToCache();
      break;
  }
});
