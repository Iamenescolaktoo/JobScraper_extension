const DEFAULT_SETTINGS = {
  requiredJobs: 2,
  unlockMinutes: 5,
  dailyCapEnabled: false,
  dailyCapMax: 20
};

function $(id) { return document.getElementById(id); }

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["settings"], (res) => {
      resolve({ ...DEFAULT_SETTINGS, ...(res.settings || {}) });
    });
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, resolve);
  });
}

function buildJobsPyCommand() {
  // You run this from the repo root (job-gate-extension)
  return `python jobs.py --term "data internship" --location "Chicago, IL" --hours 72 --limit 40`;
}

function formatTime(ms) {
  if (!ms) return "never";
  return new Date(ms).toLocaleString();
}

async function updateStatusFromCache() {
  const data = await new Promise((res) =>
    chrome.storage.local.get(["jobsCacheCount", "jobsCacheUpdatedAt"], res)
  );
  const count = data.jobsCacheCount || 0;
  const when = formatTime(data.jobsCacheUpdatedAt || 0);
  $("status").textContent = `jobsCache: ${count} jobs | updated: ${when}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSettings();

  $("requiredJobs").value = settings.requiredJobs;
  $("unlockMinutes").value = settings.unlockMinutes;

  $("dailyCapEnabled").checked = !!settings.dailyCapEnabled;
  $("dailyCapMax").value = settings.dailyCapMax;

  const setCapUI = () => {
    const enabled = $("dailyCapEnabled").checked;
    $("dailyCapMax").disabled = !enabled;
    $("capRow").classList.toggle("disabled", !enabled);
  };

  const readInputs = () => ({
    requiredJobs: Number($("requiredJobs").value) || DEFAULT_SETTINGS.requiredJobs,
    unlockMinutes: Number($("unlockMinutes").value) || DEFAULT_SETTINGS.unlockMinutes,
    dailyCapEnabled: !!$("dailyCapEnabled").checked,
    dailyCapMax: Math.max(1, Number($("dailyCapMax").value) || DEFAULT_SETTINGS.dailyCapMax)
  });

  setCapUI();
  $("cmdBox").value = buildJobsPyCommand();
  await updateStatusFromCache();

  $("dailyCapEnabled").addEventListener("change", setCapUI);

  $("save").onclick = async () => {
    const s = readInputs();
    await saveSettings(s);

    chrome.runtime.sendMessage({ type: "SET_SETTINGS", settings: s });
    chrome.runtime.sendMessage({ type: "CAP_SETTINGS_UPDATED", settings: s });

    $("status").textContent = "Saved settings.";
    setTimeout(updateStatusFromCache, 120);
  };

  $("refreshJobs").onclick = () => {
    $("status").textContent = "Refreshing…";
    chrome.runtime.sendMessage({ type: "REFRESH_JOBS" }, () => {
      setTimeout(updateStatusFromCache, 150);
    });
  };

  $("copyCmd").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("cmdBox").value);
      $("status").textContent = "Copied jobs.py command.";
    } catch {
      $("status").textContent = "Copy failed. Select + copy manually.";
    }
  };
});
