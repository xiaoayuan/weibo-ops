import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { updateInviteCodeSchema } from "@/src/lib/validators";

export async function PATCH(request: Request, context: RouteContext<"/api/invite-codes/[id]">) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updateInviteCodeSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const item = await prisma.inviteCode.update({
      where: { id },
      data: {
        disabled: parsed.data.disabled,
      },
    });

    await writeExecutionLog({
      actionType: "INVITE_CODE_UPDATED",
      requestPayload: {
        inviteCodeId: id,
        disabled: parsed.data.disabled,
      },
      success: true,
    });

    return Response.json({ success: true, data: item });
  } catch {
    return Response.json({ success: false, message: "更新注册码失败" }, { status: 500 });
  }
}
