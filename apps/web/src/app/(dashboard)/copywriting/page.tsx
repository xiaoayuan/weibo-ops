import { CopywritingManager } from "@/components/copywriting-manager";
import { getCopywritingTemplates } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CopywritingPage() {
  await requireSession();

  const items = await getCopywritingTemplates();

  return <CopywritingManager initialItems={items} />;
}
