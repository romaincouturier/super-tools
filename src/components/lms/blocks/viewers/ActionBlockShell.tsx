import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}

export default function ActionBlockShell({ icon: Icon, label, children }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid hsl(var(--yellow-brand) / 0.45)" }}>
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: "hsl(var(--feedback-warning-surface))", borderBottom: "1px solid hsl(var(--yellow-brand) / 0.3)" }}>
        <Icon className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--ink))" }} />
        <span className="text-xl font-bold" style={{ color: "hsl(var(--ink))" }}>{label}</span>
      </div>
      <div className="p-5 space-y-4 bg-white">
        {children}
      </div>
    </div>
  );
}
