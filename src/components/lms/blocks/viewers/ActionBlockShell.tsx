import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}

export default function ActionBlockShell({ icon: Icon, label, children }: Props) {
  return (
    <div className="rounded-lg border border-primary/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border-b border-primary/20">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}
