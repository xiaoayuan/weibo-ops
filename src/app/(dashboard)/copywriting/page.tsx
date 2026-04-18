import { CopywritingManager } from "@/components/copywriting/copywriting-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CopywritingPage() {
  const session = await requirePageRole("VIEWER");

  const items = await prisma.copywritingTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <CopywritingManager currentUserRole={session.role} initialItems={items} />;
}
