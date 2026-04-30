export function getLegacyBackendOrigin() {
  return process.env.LEGACY_BACKEND_ORIGIN || "http://127.0.0.1:3007";
}
