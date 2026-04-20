import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const steps = await prisma.actionJobStep.findMany({
    where: {
      job: {
        jobType: "REPOST_ROTATION",
        createdBy: auth.session.id,
      },
      account: {
        ownerUserId: auth.session.id,
      },
      status: {
        in: ["PENDING", "FAILED"],
      },
    },
    include: {
      account: {
        select: {
          id: true,
          nickname: true,
        },
      },
      job: {
        select: {
          id: true,
          status: true,
          config: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { sequenceNo: "asc" }],
  });

  const mobileSteps = steps.filter((step) => {
    const config = step.job.config as { executionMode?: string } | null;
    return config?.executionMode === "MOBILE_ASSISTED";
  });

  return Response.json({ success: true, data: mobileSteps });
}
