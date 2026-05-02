import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SurfaceCard } from "@/components/surface-card";

export function PlaceholderModule({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <SurfaceCard>
        <EmptyState title="功能开发中" description="该模块正在开发中，敬请期待。" />
      </SurfaceCard>
    </div>
  );
}
