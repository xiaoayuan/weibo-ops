import { CopywritingManager } from "@/components/copywriting/copywriting-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CopywritingPage() {
  const items = await prisma.copywritingTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <CopywritingManager initialItems={items} />;
}
