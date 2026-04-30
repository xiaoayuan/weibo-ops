import { NextRequest } from "next/server";

import { getLegacyBackendOrigin } from "@/src/lib/legacy-backend";

export async function GET(request: NextRequest) {
  return Response.json({
    success: true,
    data: {
      service: "weibo-ops-api",
      legacyBackendOrigin: getLegacyBackendOrigin(),
      path: request.nextUrl.pathname,
    },
  });
}
