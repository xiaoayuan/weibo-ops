// AUTO-START: scheduler + dispatcher for standalone container
// This module is imported by start-with-scheduler.js at boot time

let started = false;

export function ensureSchedulerStarted() {
  if (started) return;
  
  const role = process.env.NODE_ROLE || "controller";
  if (role !== "controller" && role !== "worker") return;
  
  started = true;
  
  // Dynamic imports to load the full modules (they register global listeners)
  import("@/server/scheduler/user-automation").then(m => {
    m.ensureUserAutomationSchedulerStarted();
    console.log("[auto-start] Scheduler started");
  }).catch(e => console.error("[auto-start] Scheduler fail:", e.message));
  
  import("@/server/action-jobs/dispatcher").then(m => {
    m.ensureActionJobDispatcherStarted();
    console.log("[auto-start] Dispatcher started");
  }).catch(e => console.error("[auto-start] Dispatcher fail:", e.message));
}
