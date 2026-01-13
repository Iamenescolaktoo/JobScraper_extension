(() => {
  const J = window.JobGate;

  J.getAll = function getAll() {
    return new Promise((res) => chrome.runtime.sendMessage({ type: "GET_ALL" }, res));
  };

  J.setState = function setState(state) {
    chrome.runtime.sendMessage({ type: "SET_STATE", state });
  };

  J.refreshJobs = function refreshJobs() {
    return new Promise((res) => chrome.runtime.sendMessage({ type: "REFRESH_JOBS" }, res));
  };

  J.getAppliedJobs = function getAppliedJobs() {
    return new Promise((res) =>
      chrome.storage.local.get(["appliedJobs"], (r) => res(new Set(r.appliedJobs || [])))
    );
  };

  J.saveAppliedJob = function saveAppliedJob(key) {
    chrome.storage.local.get(["appliedJobs"], (r) => {
      const s = new Set(r.appliedJobs || []);
      s.add(key);
      chrome.storage.local.set({ appliedJobs: [...s] });
    });
  };

  J.getSkippedJobs = function getSkippedJobs() {
    return new Promise((res) =>
      chrome.storage.local.get(["skippedJobs"], (r) => res(new Set(r.skippedJobs || [])))
    );
  };

  J.saveSkippedJob = function saveSkippedJob(key) {
    chrome.storage.local.get(["skippedJobs"], (r) => {
      const s = new Set(r.skippedJobs || []);
      s.add(key);
      chrome.storage.local.set({ skippedJobs: [...s] });
    });
  };

  // Prefer jobsCache; fallback to jobs.json (cache-busted)
  J.loadJobs = async function loadJobs() {
    const cache = await new Promise((res) =>
      chrome.storage.local.get(["jobsCache"], (r) => res(Array.isArray(r.jobsCache) ? r.jobsCache : []))
    );

    if (cache.length > 0) return cache;

    const url = chrome.runtime.getURL("jobs.json") + `?v=${Date.now()}`;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`jobs.json HTTP ${resp.status}`);
    return await resp.json();
  };
})();
