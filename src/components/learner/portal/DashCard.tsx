export function DashCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ElementType;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-5 transition-shadow hover:shadow-sm"
      style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--st-surface, #F2F4F4)" }}>
          <Icon size={14} style={{ color: "var(--st-ink-muted)" }} />
        </div>
        <p className="text-sm font-semibold flex-1" style={{ color: "var(--st-ink)" }}>{title}</p>
        {action && (
          <button onClick={action.onClick}
            className="text-xs font-medium transition-colors hover:opacity-70"
            style={{ color: "var(--st-ink-muted)", fontFamily: "inherit" }}>
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
