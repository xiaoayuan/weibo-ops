import { requireApiRole } from "@/lib/permissions";
import { createProxyNode, listProxyNodes } from "@/server/proxy-pool";
import { createProxyNodeSchema } from "@/server/validators/proxy-node";

export async function GET() {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const nodes = await listProxyNodes(auth.session.id);

  return Response.json({
    success: true,
      data: nodes.map((node) => ({
        id: node.id,
        name: node.name,
        protocol: node.protocol,
        rotationMode: node.rotationMode,
        countryCode: node.countryCode,
        host: node.host,
        port: node.port,
      username: node.username,
      enabled: node.enabled,
      maxAccounts: node.maxAccounts,
      assignedAccounts: node._count.accounts,
      hasPassword: Boolean(node.passwordEncrypted),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createProxyNodeSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, message: "参数校验失败", errors: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const node = await createProxyNode(auth.session.id, {
      ...parsed.data,
      countryCode: parsed.data.countryCode || undefined,
      username: parsed.data.username || undefined,
      password: parsed.data.password || undefined,
    });

    return Response.json({
      success: true,
      data: {
        id: node.id,
        name: node.name,
        protocol: node.protocol,
        rotationMode: node.rotationMode,
        countryCode: node.countryCode,
        host: node.host,
        port: node.port,
        username: node.username,
        enabled: node.enabled,
        maxAccounts: node.maxAccounts,
        assignedAccounts: 0,
        hasPassword: Boolean(node.passwordEncrypted),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建代理节点失败";
    const status = message.includes("Unique constraint") ? 400 : 500;

    return Response.json({ success: false, message: status === 400 ? "同一主机端口已存在" : message }, { status });
  }
}
