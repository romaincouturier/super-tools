import { FileText, LayoutDashboard, BookOpen, Palette, HelpCircle, Sparkles, MessageSquare, ThumbsUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/stringUtils";
import SupertiltLogo from "@/components/SupertiltLogo";
import type { NavSection } from "@/types/learner-portal";
import { PRATIQUE_SECTIONS } from "@/types/learner-portal";

export function LearnerSidebar({
  active,
  onNav,
  firstName,
  lastName,
  fonction,
  photoUrl,
  email,
  onLogout,
  onEditProfile,
  mobile,
  onClose,
}: {
  active: NavSection;
  onNav: (s: NavSection) => void;
  firstName: string;
  lastName: string;
  fonction?: string | null;
  photoUrl?: string | null;
  email: string;
  onLogout: () => void;
  onEditProfile: () => void;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const navItems: Array<{ id: NavSection; label: string; icon: React.ElementType; subItems?: Array<{ id: NavSection; label: string; icon: React.ElementType }> }> = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "formations", label: "Mes formations", icon: BookOpen },
    { id: "recommandees", label: "Mes formations recommandées", icon: Sparkles },
    { id: "travaux", label: "Mes travaux", icon: FileText },
    {
      id: "pratique", label: "Communauté", icon: Palette,
      subItems: [
        { id: "pratique_publications", label: "Mes publications", icon: FileText },
        { id: "pratique_commentaires", label: "Mes commentaires", icon: MessageSquare },
        { id: "pratique_likes", label: "Mes likes", icon: ThumbsUp },
      ],
    },
    { id: "aide", label: "Aide", icon: HelpCircle },
  ];

  return (
    <aside
      className="flex flex-col h-full"
      style={{ background: "var(--st-white)", borderRight: "1px solid rgba(16,24,32,0.08)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b shrink-0"
        style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <SupertiltLogo className="h-9" />
        {mobile && onClose && (
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5">
            <X size={16} style={{ color: "var(--st-ink)" }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon, subItems }) => {
          const subExpanded = subItems && PRATIQUE_SECTIONS.includes(active);
          return (
            <div key={id}>
              <button
                onClick={() => { onNav(id); onClose?.(); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                  active === id ? "text-[#101820]" : "hover:bg-black/5",
                )}
                style={active === id ? { background: "var(--st-yellow)", color: "#101820", fontFamily: "inherit" } : { fontFamily: "inherit", color: "var(--st-ink-muted)" }}
              >
                <Icon size={17} />
                {label}
              </button>
              {subExpanded && (
                <div className="mt-0.5 ml-4 pl-3 space-y-0.5 border-l" style={{ borderColor: "rgba(16,24,32,0.1)" }}>
                  {subItems!.map(({ id: sid, label: slabel, icon: SIcon }) => (
                    <button
                      key={sid}
                      onClick={() => { onNav(sid); onClose?.(); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
                        active === sid ? "font-semibold" : "hover:bg-black/5",
                      )}
                      style={active === sid ? { color: "#101820", background: "rgba(255,209,0,0.18)", fontFamily: "inherit" } : { fontFamily: "inherit", color: "var(--st-ink-muted)" }}
                    >
                      <SIcon size={15} />
                      {slabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User block */}
      <div className="px-3 pb-5 pt-3 border-t" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <button
          onClick={onEditProfile}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:bg-black/5 text-left"
          style={{ fontFamily: "inherit" }}
          title="Mon compte"
        >
          <div
            className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: photoUrl ? "transparent" : "var(--st-yellow)", color: "#101820" }}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              getInitials(firstName, lastName)
            )}
          </div>
        </button>
      </div>
    </aside>
  );
}
