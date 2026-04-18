import { SuperTopicsManager } from "@/components/super-topics/super-topics-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SuperTopicsPage() {
  const session = await requirePageRole("VIEWER");

  const topics = await prisma.superTopic.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <SuperTopicsManager currentUserRole={session.role} initialTopics={topics} />;
}
