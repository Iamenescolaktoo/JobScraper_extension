(() => {
  const J = window.JobGate;

  J.todayKey = function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // local YYYY-MM-DD
  };

  J.safeLower = function safeLower(x) {
    return (x ?? "").toString().toLowerCase().trim();
  };

  // Stable fingerprint so skips survive URL changes
  J.jobFingerprint = function jobFingerprint(job) {
    const company = J.safeLower(job?.company);
    const title = J.safeLower(job?.title);
    const location = J.safeLower(job?.location);
    return `${company}|${title}|${location}`;
  };

  J.sleep = function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  };
})();
