import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}

export default function ActionBlockShell({ icon: Icon, label, children }: Props) {
  return (
    <div className="rounded-xl border border-primary/30 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-primary/10 border-b border-primary/20">
        <Icon className="h-5 w-5 text-primary shrink-0" />
        <span className="text-lg font-bold">{label}</span>
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </div>
  );
}
