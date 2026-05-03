export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureUserAutomationSchedulerStarted } = await import("@/server/scheduler/user-automation");
    const { ensureActionJobDispatcherStarted } = await import("@/server/action-jobs/dispatcher");

    ensureUserAutomationSchedulerStarted();
    ensureActionJobDispatcherStarted();
  }
}
