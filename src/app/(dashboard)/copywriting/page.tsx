import { CopywritingManager } from "@/components/copywriting/copywriting-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getAiCopywritingConfig } from "@/server/copywriting/ai-config";

export const dynamic = "force-dynamic";

export default async function CopywritingPage() {
  const session = await requirePageRole("VIEWER");

  const [items, aiConfig] = await Promise.all([
    prisma.copywritingTemplate.findMany({
      orderBy: { createdAt: "desc" },
    }),
    getAiCopywritingConfig(),
  ]);

  return <CopywritingManager currentUserRole={session.role} initialItems={items} initialAiConfig={aiConfig} />;
}
