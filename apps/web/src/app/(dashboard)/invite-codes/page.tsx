import { InviteCodesManager } from "@/components/invite-codes-manager";
import { getInviteCodes } from "@/lib/app-data";
import { PageHeader } from "@/components/page-header";
import { SurfaceCard } from "@/components/surface-card";

export const metadata = { title: "邀请码管理 — 魏来运营助手" };

export default async function InviteCodesPage() {
  const codes = await getInviteCodes();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统管理"
        title="邀请码"
        description="查看邀请码的使用情况"
      />
      <SurfaceCard className="rounded-[24px] p-6">
        <InviteCodesManager initialCodes={codes} />
      </SurfaceCard>
    </div>
  );
}
