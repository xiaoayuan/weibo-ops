import { CopywritingManager } from "@/components/copywriting-manager";
import { getCopywritingTemplates } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function CopywritingPage() {
  const items = await getCopywritingTemplates();

  return <CopywritingManager initialItems={items} />;
}
