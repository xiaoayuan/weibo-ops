export function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build"
    || process.env.npm_lifecycle_event === "build";
}

export function shouldRunRuntimeSideEffects() {
  return !isBuildPhase() && process.env.SKIP_RUNTIME_SIDE_EFFECTS !== "true";
}
