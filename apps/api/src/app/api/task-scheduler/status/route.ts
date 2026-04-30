import { NextRequest } from "next/server";

import { proxyToLegacyBackend } from "@/src/lib/legacy-backend";

export async function GET(request: NextRequest) {
  return proxyToLegacyBackend(request, ["task-scheduler", "status"]);
}
