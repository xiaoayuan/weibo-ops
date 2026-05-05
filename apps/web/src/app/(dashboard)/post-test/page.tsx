import type { SuperTopic, WeiboAccount } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";
import { PostTestClient } from "@/components/post-test-client";

export const dynamic = "force-dynamic";

export default async function PostTestPage() {
  await requireSession();

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3007";
  let accounts: WeiboAccount[] = [];
  let topics: SuperTopic[] = [];

  try {
    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { cache: "no-store" });
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      if (session?.user?.id) {
        const [accountsRes, topicsRes] = await Promise.all([
          fetch(`${baseUrl}/api/accounts`, { cache: "no-store" }),
          fetch(`${baseUrl}/api/super-topics`, { cache: "no-store" }),
        ]);
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          const allAccounts: WeiboAccount[] = accountsData.payload?.data ?? [];
          accounts = allAccounts.filter(
            (a: WeiboAccount) => a.ownerUserId === session.user.id,
          );
        }
        if (topicsRes.ok) {
          const topicsData = await topicsRes.json();
          topics = topicsData.payload?.data ?? [];
        }
      }
    }
  } catch {
    // 忽略错误
  }

  return <PostTestClient accounts={accounts} topics={topics} />;
}
