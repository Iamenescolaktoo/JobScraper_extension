(() => {
  // One shared namespace for all content scripts
  window.JobGate = window.JobGate || {};
  window.JobGate.VERSION = "split-1.0";

  window.JobGate.log = (...args) => console.log("🧱 JobGate:", ...args);
  window.JobGate.warn = (...args) => console.warn("🧱 JobGate:", ...args);
  window.JobGate.err = (...args) => console.error("🧱 JobGate:", ...args);
})();
