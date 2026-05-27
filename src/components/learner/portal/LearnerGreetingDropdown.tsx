import { useState, useEffect, useRef } from "react";
import {
  GraduationCap, ChevronDown, HelpCircle, LogOut, Sparkles, User2,
} from "lucide-react";
import { getInitials } from "@/lib/stringUtils";
import { useConfirm } from "@/hooks/useConfirm";
import type { NavSection } from "@/types/learner-portal";

export function LearnerGreetingDropdown({
  firstName,
  lastName,
  photoUrl,
  onNav,
  onLogout,
}: {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  onNav: (s: NavSection) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    const confirmed = await confirm({
      title: "Se déconnecter",
      description: "Êtes-vous sûr de vouloir vous déconnecter ?",
      variant: "destructive",
    });
    if (confirmed) onLogout();
  };

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Apprenant";
  const initials = getInitials(firstName, lastName);

  const items: { label: string; icon: React.ElementType; section: NavSection }[] = [
    { label: "Mon compte", icon: User2, section: "compte" },
    { label: "Mes formations", icon: GraduationCap, section: "formations" },
    { label: "Mes formations recommandées", icon: Sparkles, section: "recommandees" },
    { label: "Aide", icon: HelpCircle, section: "aide" },
  ];

  return (
    <>
      <ConfirmDialog />
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all hover:bg-black/5"
          style={{ fontFamily: "inherit" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: photoUrl ? "transparent" : "var(--st-yellow)", color: "#101820", overflow: "hidden" }}
          >
            {photoUrl ? <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" /> : initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Bonjour</p>
            <p className="text-sm font-semibold leading-none" style={{ color: "var(--st-ink)" }}>{displayName}</p>
          </div>
          <ChevronDown size={13} className="hidden sm:block shrink-0 opacity-50" style={{ color: "var(--st-ink-muted)" }} />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border shadow-lg overflow-hidden z-50"
            style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.1)" }}
          >
            {items.map(({ label, icon: Icon, section }) => (
              <button
                key={section + label}
                onClick={() => { onNav(section); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-black/5"
                style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
              >
                <Icon size={15} style={{ color: "var(--st-ink-muted)" }} />
                {label}
              </button>
            ))}
            <div style={{ borderTop: "1px solid rgba(16,24,32,0.08)" }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-red-50"
                style={{ color: "#ef4444", fontFamily: "inherit" }}
              >
                <LogOut size={15} />
                Se déconnecter
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
