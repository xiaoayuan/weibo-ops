import { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  return Response.json({
    success: true,
    data: {
      service: "weibo-ops-api",
      path: _request.nextUrl.pathname,
      runtime: "next-route-handler",
      activeByDefault: false,
      message: "This Next route tree is currently parked for gradual migration. The default apps/api runtime uses src/server.ts (Hono proxy-first).",
    },
  });
}
