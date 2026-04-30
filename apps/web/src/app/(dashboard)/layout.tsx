import { DashboardFrame } from "@/components/dashboard-frame";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return <DashboardFrame session={session}>{children}</DashboardFrame>;
}
