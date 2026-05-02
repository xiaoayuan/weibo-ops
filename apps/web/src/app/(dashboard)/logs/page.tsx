import { LogsManager } from "@/components/logs-manager";
import type { ExecutionLog, Plan, UserListItem } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";
import { fetchServerApi } from "@/lib/backend";
import { getBusinessDateText } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await requireSession();

  const [logsResponse, usersResponse, plansResponse] = await Promise.all([
    fetchServerApi<ExecutionLog[]>("/api/logs"),
    session.role === "ADMIN" ? fetchServerApi<UserListItem[]>("/api/users") : Promise.resolve(null),
    fetchServerApi<Plan[]>(`/api/plans?date=${getBusinessDateText()}`),
  ]);

  const logs = logsResponse.ok && logsResponse.payload?.success ? logsResponse.payload.data ?? [] : [];
  const users = usersResponse?.ok && usersResponse.payload?.success ? usersResponse.payload.data ?? [] : [];
  const plans = plansResponse.ok && plansResponse.payload?.success ? plansResponse.payload.data ?? [] : [];

  return <LogsManager initialLogs={logs} initialPlans={plans} users={users.map((item) => ({ id: item.id, username: item.username }))} isAdmin={session.role === "ADMIN"} />;
}
