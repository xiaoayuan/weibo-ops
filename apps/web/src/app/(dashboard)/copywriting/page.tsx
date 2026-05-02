import { CopywritingManager } from "@/components/copywriting-manager";
import { getAiCopywritingConfig, getAiRiskConfig, getCopywritingTemplates } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CopywritingPage() {
  await requireSession();

  const [items, aiConfig, aiRiskConfig] = await Promise.all([
    getCopywritingTemplates(),
    getAiCopywritingConfig(),
    getAiRiskConfig(),
  ]);

  return (
    <CopywritingManager
      initialItems={items}
      initialAiConfig={aiConfig}
      initialAiRiskConfig={aiRiskConfig}
    />
  );
}
