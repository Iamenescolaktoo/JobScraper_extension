(async () => {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.runtime) {
    console.error("❌ JobGate: Chrome extension APIs not available");
    return;
  }

  const J = window.JobGate;
  J.log("Content loaded", location.href, "v", J.VERSION);

  // Pull state/settings
  const all = await J.getAll();
  const settings = all?.settings || {};
  const state = all?.state || {};

  // Daily reset (local date)
  const today = J.todayKey();
  if (state.lastResetDate !== today) {
    state.completedJobsToday = 0;
    state.lastResetDate = today;
    J.setState(state);
  }

  // Import jobs.json into jobsCache on page load (no-server mode)
  // This ensures when you run jobs.py, the extension can pick up changes without you opening popup first.
  await J.refreshJobs();

  const appliedJobs = await J.getAppliedJobs();
  const skippedJobs = await J.getSkippedJobs();

  function isUnlocked() {
    return Date.now() < (state.unlockedUntil || 0);
  }

  function dismissedForToday() {
    return state.dismissedUntil === J.todayKey();
  }

  async function openSprint() {
    await J.renderJobSprint({ settings, state, appliedJobs, skippedJobs });
  }

  function tick() {
    if (dismissedForToday()) return;

    if (isUnlocked()) {
      J.removeLock();
    } else {
      J.renderLock(settings, openSprint);
    }
  }

  // initial + periodic enforcement
  tick();
  setInterval(tick, 1500);
})();
