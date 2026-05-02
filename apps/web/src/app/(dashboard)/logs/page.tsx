import { LogsManager } from "@/components/logs-manager";
import type { ExecutionLog, UserListItem } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";
import { fetchServerApi } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await requireSession();

  const [logsResponse, usersResponse] = await Promise.all([
    fetchServerApi<ExecutionLog[]>("/api/logs"),
    session.role === "ADMIN" ? fetchServerApi<UserListItem[]>("/api/users") : Promise.resolve(null),
  ]);

  const logs = logsResponse.ok && logsResponse.payload?.success ? logsResponse.payload.data ?? [] : [];
  const users = usersResponse?.ok && usersResponse.payload?.success ? usersResponse.payload.data ?? [] : [];

  return <LogsManager initialLogs={logs} users={users.map((item) => ({ id: item.id, username: item.username }))} isAdmin={session.role === "ADMIN"} />;
}
