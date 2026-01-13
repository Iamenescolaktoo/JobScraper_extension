(() => {
  const J = window.JobGate;

  J.removeModal = function removeModal() {
    document.getElementById("job-modal")?.remove();
  };

  J.renderJobSprint = async function renderJobSprint(ctx) {
    const { settings, state, appliedJobs, skippedJobs } = ctx;

    if (document.getElementById("job-modal")) return;

    const modal = document.createElement("div");
    modal.id = "job-modal";
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.95);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui;
      color: white;
    `;

    modal.innerHTML = `
      <div id="jg-card" style="background:#111;padding:18px;border-radius:12px;width:380px;max-width:92vw;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <h2 style="margin:0;">Job Sprint</h2>
          <button data-action="jg-close"
            style="padding:8px 10px;background:#333;border:none;border-radius:8px;color:white;cursor:pointer;">
            Close
          </button>
        </div>

        <div id="jg-sub" style="opacity:.75;margin-top:8px;font-size:13px;"></div>
        <div id="jg-status" style="margin-top:12px;">Loading jobs…</div>
        <div id="jg-actions" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;"></div>
      </div>
    `;

    document.documentElement.appendChild(modal);

    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "jg-close") {
        // dismiss for today
        state.dismissedUntil = J.todayKey();
        J.setState(state);
        J.removeModal();
        J.removeLock();
      }
    });

    // Ensure jobsCache is refreshed from jobs.json at least once when opening
    await J.refreshJobs();
    await J.sleep(80);

    let jobs;
    try {
      jobs = await J.loadJobs();
    } catch (err) {
      J.err("Failed to load jobs:", err);
      document.getElementById("jg-status").textContent = "Failed to load jobs.json/jobsCache.";
      return;
    }

    const req = Number(settings.requiredJobs) || 2;
    const mins = Number(settings.unlockMinutes) || 5;

    const sub = document.getElementById("jg-sub");
    sub.textContent = `Apply to ${req} jobs to unlock ${mins} minutes.`;

    // Filter skipped + (optional) already applied
    const filtered = (jobs || []).filter((j) => {
      const url = j?.job_url || j?.id;
      if (!url) return false;
      const oldKey = j.id || url;
      const fp = J.jobFingerprint(j);

      if (skippedJobs.has(oldKey) || skippedJobs.has(fp)) return false;
      return true;
    });

    let idx = 0;

    const statusEl = document.getElementById("jg-status");
    const actionsEl = document.getElementById("jg-actions");

    function render() {
      actionsEl.innerHTML = "";

      if (!filtered.length) {
        statusEl.textContent = "No jobs left 🎉 (Run jobs.py to generate more.)";
        return;
      }

      if (idx >= filtered.length) idx = 0;

      const job = filtered[idx];
      const title = job.title || "Untitled role";
      const company = job.company || "";
      const location = job.location || "";
      const url = job.job_url || job.id;

      statusEl.innerHTML = `
        <div style="font-weight:700;font-size:15px;">${title}</div>
        <div style="opacity:.8;margin-top:2px;">${company} ${company && location ? "•" : ""} ${location}</div>
        <div style="opacity:.7;margin-top:10px;">
          Progress: ${state.completedJobs}/${req}
        </div>
      `;

      const btn = (label, bg, onClick) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = `padding:8px 12px;border-radius:10px;border:none;cursor:pointer;background:${bg};color:white;`;
        b.onclick = onClick;
        return b;
      };

      actionsEl.appendChild(btn("Open", "#4da3ff", () => window.open(url, "_blank")));

      actionsEl.appendChild(
        btn("Applied ✅", "#2ecc71", () => {
          const oldKey = job.id || url;
          const fp = J.jobFingerprint(job);

          J.saveAppliedJob(oldKey);
          J.saveAppliedJob(fp);

          state.completedJobs = (state.completedJobs || 0) + 1;
          state.completedJobsToday = (state.completedJobsToday || 0) + 1;
          J.setState(state);

          if (state.completedJobs >= req) {
            // unlock now
            state.completedJobs = 0;
            state.unlockedUntil = Date.now() + mins * 60 * 1000;
            J.setState(state);
            J.removeModal();
            J.removeLock();
            return;
          }

          idx += 1;
          render();
        })
      );

      actionsEl.appendChild(
        btn("Skip ❌", "#e74c3c", () => {
          const oldKey = job.id || url;
          const fp = J.jobFingerprint(job);

          J.saveSkippedJob(oldKey);
          J.saveSkippedJob(fp);

          filtered.splice(idx, 1);
          render();
        })
      );
    }

    render();
  };
})();
