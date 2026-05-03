import { NextRequest } from "next/server";

import { requireApiRole } from "@/src/lib/permissions";
import { proxyToLegacyBackend } from "@/src/lib/legacy-backend";

async function handle(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  const { path } = await context.params;

  if (!path || path.length === 0) {
    return Response.json({ success: false, message: "未知 API 路径" }, { status: 404 });
  }

  return proxyToLegacyBackend(request, path || []);
}

async function handleAuth(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  return handle(request, context);
}

export async function GET(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  return handleAuth(request, context);
}

export async function POST(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  return handleAuth(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  return handleAuth(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  return handleAuth(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  return handleAuth(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  return handleAuth(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  return handleAuth(request, context);
}
