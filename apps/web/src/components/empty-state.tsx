export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-app-line bg-app-panel-muted px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <h3 className="text-lg font-medium tracking-[-0.02em] text-app-text-strong">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-app-text-muted">{description}</p>
    </div>
  );
}
