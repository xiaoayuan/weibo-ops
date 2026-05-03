import { DashboardFrame } from "@/components/dashboard-frame";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

let legacyTriggered = false;
function triggerLegacyApp() {
  if (!legacyTriggered) {
    legacyTriggered = true;
    fetch("http://app:3000/login", { method: "HEAD", cache: "no-store" }).catch(() => {});
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  triggerLegacyApp();

  return <DashboardFrame session={session}>{children}</DashboardFrame>;
}
