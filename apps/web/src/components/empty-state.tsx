export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-app-line bg-app-panel/60 px-6 py-10 text-center">
      <h3 className="text-lg font-medium text-app-text-strong">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-app-text-muted">{description}</p>
    </div>
  );
}
