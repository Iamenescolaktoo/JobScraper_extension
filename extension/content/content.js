// content.js (fixed with proper Chrome API checks)
(async function () {
	
	// ✅ FIX: Check if Chrome APIs are available
	if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime) {
		console.error('❌ Chrome extension APIs not available');
		return;
	}

	console.log('✅ Job Gate content script loaded');

	const getIrrelevantPatterns = () =>
		new Promise((res) =>
			chrome.storage.local.get(["irrelevantPatterns"], (r) =>
				res(r.irrelevantPatterns || { keywords: [] })
			)
		);
	  
	const saveIrrelevantPattern = (keyword) =>
		chrome.storage.local.get(["irrelevantPatterns"], (r) => {
			const patterns = r.irrelevantPatterns || { keywords: [] };
			if (!patterns.keywords.includes(keyword)) {
				patterns.keywords.push(keyword);
				chrome.storage.local.set({ irrelevantPatterns: patterns });
			}
		});

	function todayKey() {
		// Local date (prevents UTC midnight from making "today" flip early/late)
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`; // YYYY-MM-DD (local)
	}
  
	// ✅ FIX: Stable fingerprint so "No" survives job URL/ID changes
	function jobFingerprint(job) {
		const company = (job.company || "").toLowerCase().trim();
		const title = (job.title || "").toLowerCase().trim();
		const location = (job.location || "").toLowerCase().trim();
		return `${company}|${title}|${location}`;
	}
  
	/* =========================
	   Storage helpers
	========================== */
	const getAll = () =>
		new Promise((res) => chrome.runtime.sendMessage({ type: "GET_ALL" }, res));
  
	const setState = (state) =>
		chrome.runtime.sendMessage({ type: "SET_STATE", state });
  
	const getAppliedJobs = () =>
		new Promise((res) =>
			chrome.storage.local.get(["appliedJobs"], (r) =>
				res(new Set(r.appliedJobs || []))
			)
		);
  
	const saveAppliedJob = (jobId) =>
		chrome.storage.local.get(["appliedJobs"], (r) => {
			const applied = new Set(r.appliedJobs || []);
			applied.add(jobId);
			chrome.storage.local.set({ appliedJobs: [...applied] });
		});
  
	const getSkippedJobs = () =>
		new Promise((res) =>
			chrome.storage.local.get(["skippedJobs"], (r) =>
				res(new Set(r.skippedJobs || []))
			)
		);
  
	const saveSkippedJob = (key) =>
		chrome.storage.local.get(["skippedJobs"], (r) => {
			const skipped = new Set(r.skippedJobs || []);
			skipped.add(key);
			chrome.storage.local.set({ skippedJobs: [...skipped] });
		});
  
	// ✅ Load settings + state first (MUST happen before use)
	console.log('📦 Loading extension data...');
	const all = await getAll();
	const settings = all?.settings || {};
	const state = all?.state || {};
	const appliedJobs = await getAppliedJobs();
	const skippedJobs = await getSkippedJobs();
	const irrelevantPatterns = await getIrrelevantPatterns();

	console.log('✅ Data loaded:', { settings, state });

	/* =========================
	   Click delegation: Close modal
	   (your data-action="close-modal")
	========================== */
	document.addEventListener("click", (e) => {
		const btn = e.target.closest("[data-action]");
		if (!btn) return;
  
		const action = btn.dataset.action;
  
		if (action === "close-modal") {
			// Dismiss for today so it doesn't pop back until tomorrow
			state.dismissedUntil = todayKey();
			setState(state);
  
			document.getElementById("job-modal")?.remove();
			document.getElementById("job-lock")?.remove();
		}
	});
  
	/* =========================
	   Daily reset (safe even if cap off)
	========================== */
	const today = todayKey();
	if (state.lastResetDate !== today) {
		state.completedJobsToday = 0;
		state.lastResetDate = today;
		setState(state);
	}
  
	/* =========================
	   Lock logic
	========================== */
	function isUnlocked() {
		return Date.now() < (state.unlockedUntil || 0);
	}
  
	function unlockYouTube() {
		state.completedJobs = 0;
		state.unlockedUntil =
			Date.now() + (Number(settings.unlockMinutes) || 5) * 60 * 1000;
  
		setState(state);
		document.getElementById("job-lock")?.remove();
	}
  
	/* =========================
	   UI: Lock screen
	========================== */
	function lockYouTube() {
		if (document.getElementById("job-lock")) return;

		console.log('🔒 Showing lock screen');
  
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
  
		lock.innerHTML = `
			<div style="text-align:center;max-width:420px;">
				<h1>YouTube Locked</h1>
				<p style="opacity:.7;margin:12px 0;">
					Apply to ${Number(settings.requiredJobs) || 2} jobs to unlock
					${Number(settings.unlockMinutes) || 5} minutes of YouTube.
				</p>
				<button id="openJobs"
					style="
						padding:12px 18px;
						border-radius:10px;
						background:#4da3ff;
						border:none;
						font-size:16px;
						cursor:pointer;
						color:white;
					">
					Open Job Sprint
				</button>
			</div>
		`;
  
		document.body.appendChild(lock);
		document.getElementById("openJobs").onclick = showJobSprint;
	}
  
	/* =========================
	   Job Sprint
	========================== */
	async function showJobSprint() {
		// Prevent duplicate modals
		if (document.getElementById("job-modal")) return;

		console.log('🚀 Opening Job Sprint modal');
  
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
			<div id="card"
				style="background:#111;padding:20px;border-radius:12px;width:360px;">
				<h2>Job Sprint</h2>
				<p id="status">Loading jobs…</p>
				<button data-action="close-modal" style="margin-top:10px;padding:8px 16px;background:#444;border:none;color:white;border-radius:6px;cursor:pointer;">Close</button>
			</div>
		`;
  
		document.body.appendChild(modal);

		/* ---- Load jobs (prefer jobsCache, fallback to packaged jobs.json) ---- */
		let jobs;
		try {
			const cached = await new Promise((res) =>
				chrome.storage.local.get(["jobsCache"], (r) => res(r.jobsCache))
			);

			if (Array.isArray(cached) && cached.length) {
				console.log("📦 Using jobsCache from storage:", cached.length);
				jobs = cached;
			} else {
				const url = chrome.runtime.getURL("jobs.json");
				console.log("📥 Fetching jobs from:", url);
				jobs = await fetch(url).then((r) => r.json());
				console.log("✅ Loaded", jobs.length, "jobs");
			}
		} catch (e) {
			console.error("❌ Failed to load jobs:", e);
			const statusEl = document.getElementById("status");
			if (statusEl) statusEl.textContent = "Failed to load jobs list (jobsCache/jobs.json)";
			return;
		}

		// ✅ FIX #1 (continued): filter by BOTH old key (id/url) AND new fingerprint
		jobs = (jobs || []).filter((j) => {
			if (!j?.job_url) return false;

			const oldKey = j.id || j.job_url; // backward compat
			const fp = jobFingerprint(j);

			const blockedBySkip =
				skippedJobs.has(oldKey) || skippedJobs.has(fp);

			return !blockedBySkip;
		});

		// Apply "Not related" learned patterns
		if (irrelevantPatterns?.keywords?.length) {
			jobs = jobs.filter((j) => {
				const t = (j.title || "").toLowerCase();
				return !irrelevantPatterns.keywords.some((kw) => t.includes(kw));
			});
		}

		let idx = 0;

		const statusEl = document.getElementById("status");
		const card = document.getElementById("card");

		function renderJob() {
			if (!jobs.length) {
				statusEl.textContent = "No jobs left 🎉";
				return;
			}

			if (idx >= jobs.length) idx = 0;

			const job = jobs[idx];

			statusEl.innerHTML = `
				<div style="margin-top:10px;">
					<div style="font-weight:700;">${job.title || "Untitled role"}</div>
					<div style="opacity:.8;">${job.company || ""} • ${job.location || ""}</div>
					<div style="opacity:.7;margin-top:6px;">
						Progress: ${state.completedJobs}/${Number(settings.requiredJobs) || 2}
					</div>
				</div>
			`;

			// Remove any previous buttons
			card.querySelectorAll(".job-actions").forEach((n) => n.remove());

			const actions = document.createElement("div");
			actions.className = "job-actions";
			actions.style.cssText = "display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;";

			const open = document.createElement("button");
			open.textContent = "Open";
			open.style.cssText = "padding:8px 12px;border-radius:8px;border:none;cursor:pointer;background:#4da3ff;color:white;";
			open.onclick = () => window.open(job.job_url, "_blank");

			const yes = document.createElement("button");
			yes.textContent = "Applied ✅";
			yes.style.cssText = "padding:8px 12px;border-radius:8px;border:none;cursor:pointer;background:#2ecc71;color:#000;";
			yes.onclick = () => {
				// Track applied both ways
				const oldKey = job.id || job.job_url;
				const fp = jobFingerprint(job);

				saveAppliedJob(oldKey);
				saveAppliedJob(fp);

				state.completedJobs += 1;
				state.completedJobsToday = (state.completedJobsToday || 0) + 1;
				setState(state);

				// Daily cap check (optional)
				if (settings.dailyCapEnabled && state.completedJobsToday >= settings.dailyCapMax) {
					state.dismissedUntil = todayKey(); // hide until tomorrow
					setState(state);
					document.getElementById("job-modal")?.remove();
					document.getElementById("job-lock")?.remove();
					return;
				}

				// Unlock when reached required jobs
				if (state.completedJobs >= (Number(settings.requiredJobs) || 2)) {
					unlockYouTube();
					document.getElementById("job-modal")?.remove();
					return;
				}

				idx += 1;
				renderJob();
			};

			const no = document.createElement("button");
			no.textContent = "Skip ❌";
			no.style.cssText = "padding:8px 12px;border-radius:8px;border:none;cursor:pointer;background:#e74c3c;color:white;";
			no.onclick = () => {
				const oldKey = job.id || job.job_url;
				const fp = jobFingerprint(job);

				saveSkippedJob(oldKey);
				saveSkippedJob(fp);

				jobs.splice(idx, 1);
				renderJob();
			};

			const notRelated = document.createElement("button");
			notRelated.textContent = "Not related 🚫";
			notRelated.style.cssText = "padding:8px 12px;border-radius:8px;border:none;cursor:pointer;background:#555;color:white;";
			notRelated.onclick = () => {
				const keyword = (job.title || "").toLowerCase().split(" ").slice(0, 3).join(" ");
				saveIrrelevantPattern(keyword);

				jobs = jobs.filter((j) => !(j.title || "").toLowerCase().includes(keyword));
				renderJob();
			};

			actions.appendChild(open);
			actions.appendChild(yes);
			actions.appendChild(no);
			actions.appendChild(notRelated);

			card.appendChild(actions);
		}

		renderJob();
	}

	/* =========================
	   Startup decision
	========================== */
	const dismissedNow = state.dismissedUntil === todayKey();
	if (!dismissedNow) {
		if (!isUnlocked()) lockYouTube();
	}

	// Recheck lock status every 2s (covers expiry)
	setInterval(() => {
		const dismissed = state.dismissedUntil === todayKey();
		if (dismissed) return;

		if (isUnlocked()) {
			document.getElementById("job-lock")?.remove();
		} else {
			lockYouTube();
		}
	}, 2000);
})();
