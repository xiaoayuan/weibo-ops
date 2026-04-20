import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { MobileRepostTasksManager } from "@/components/mobile/mobile-repost-tasks-manager";

export default async function MobileTasksPage() {
  const session = await requirePageRole("VIEWER");

  const steps = await prisma.actionJobStep.findMany({
    where: {
      job: {
        jobType: "REPOST_ROTATION",
        createdBy: session.id,
      },
      account: {
        ownerUserId: session.id,
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
          createdAt: true,
          config: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { sequenceNo: "asc" }],
  });

  const mobileSteps = steps.filter((step) => {
    const config = step.job.config as { executionMode?: string } | null;
    return config?.executionMode === "MOBILE_ASSISTED";
  });

  const normalizedSteps = mobileSteps.map((step) => ({
    ...step,
    payload:
      step.payload && typeof step.payload === "object" && !Array.isArray(step.payload)
        ? (step.payload as { repostContent?: string })
        : null,
    job: {
      ...step.job,
      createdAt: step.job.createdAt.toISOString(),
      config:
        step.job.config && typeof step.job.config === "object" && !Array.isArray(step.job.config)
          ? (step.job.config as { executionMode?: string; times?: number })
          : {},
    },
  }));

  return <MobileRepostTasksManager initialTasks={normalizedSteps} />;
}
