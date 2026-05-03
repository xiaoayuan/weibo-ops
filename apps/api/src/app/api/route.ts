import { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  return Response.json({
    success: true,
    data: {
      service: "weibo-ops-api",
      path: _request.nextUrl.pathname,
    },
  });
}
