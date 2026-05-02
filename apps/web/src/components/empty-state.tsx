export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-dashed border-app-line bg-app-panel-muted px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-300 hover:border-app-line-strong hover:bg-app-panel">
      {/* Animated background orbs */}
      <div className="absolute left-1/4 top-1/4 h-24 w-24 rounded-full bg-app-accent/5 blur-2xl transition-all duration-700 group-hover:scale-150" />
      <div className="absolute right-1/4 bottom-1/4 h-32 w-32 rounded-full bg-app-info/5 blur-3xl transition-all duration-700 group-hover:scale-150" />
      
      <div className="relative">
        {/* Icon placeholder */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-app-line bg-app-panel-muted transition-all duration-300 group-hover:scale-110 group-hover:border-app-line-strong">
          <svg className="h-8 w-8 text-app-text-soft transition-colors duration-300 group-hover:text-app-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-app-text-strong transition-colors duration-300 group-hover:text-app-accent">{title}</h3>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-app-text-muted transition-colors duration-300 group-hover:text-app-text">{description}</p>
      </div>
    </div>
  );
}
