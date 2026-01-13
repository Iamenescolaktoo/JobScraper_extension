(() => {
  const J = window.JobGate;

  J.removeLock = function removeLock() {
    document.getElementById("job-lock")?.remove();
  };

  J.renderLock = function renderLock(settings, onOpenSprint) {
    if (document.getElementById("job-lock")) return;

    const lock = document.createElement("div");
    lock.id = "job-lock";
    lock.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.95);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui;
      color: white;
    `;

    const req = Number(settings.requiredJobs) || 2;
    const mins = Number(settings.unlockMinutes) || 5;

    lock.innerHTML = `
      <div style="text-align:center;max-width:420px;padding:16px;">
        <h1 style="margin:0 0 10px;">YouTube Locked</h1>
        <p style="opacity:.75;margin:0 0 14px;">
          Apply to ${req} jobs to unlock ${mins} minutes of YouTube.
        </p>
        <button id="jg-open-sprint"
          style="padding:12px 18px;border-radius:10px;background:#4da3ff;border:none;font-size:16px;cursor:pointer;color:white;">
          Open Job Sprint
        </button>
      </div>
    `;

    document.documentElement.appendChild(lock);
    document.getElementById("jg-open-sprint").onclick = onOpenSprint;
  };
})();
