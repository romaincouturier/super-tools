import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, BookOpen, ChevronDown, HelpCircle, LogOut, Menu, Sparkles, User,
} from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useConfirm } from "@/hooks/useConfirm";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared learner header used by both the course home page and the lesson
 * player. Keeps both screens visually identical (logo, breadcrumb, sidebar
 * toggle, account menu).
 */
export default function LearnerCourseHeader({
  courseTitle,
  learnerEmail,
  isPreview,
  onToggleSidebar,
  editHref,
}: {
  courseTitle: string;
  learnerEmail: string;
  isPreview: boolean;
  onToggleSidebar: () => void;
  /** Admin-only "Éditer" shortcut (e.g. home builder URL). */
  editHref?: string;
}) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 h-16 px-6 bg-white shrink-0"
      style={{ borderBottom: "1px solid #EDEDED" }}
    >
      <button
        onClick={onToggleSidebar}
        className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5 shrink-0"
        aria-label="Ouvrir/fermer le menu de parcours"
      >
        <Menu size={18} style={{ color: "#101820" }} />
      </button>

      <a
        href={learnerEmail && !isPreview ? "/espace-apprenant" : "/lms"}
        className="shrink-0 flex items-center"
        title="Retour aux formations"
      >
        <SupertiltLogo className="h-8" />
      </a>

      <div className="hidden lg:block w-px h-7 shrink-0" style={{ background: "#EDEDED" }} />

      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] font-medium leading-none mb-0.5 hidden lg:block"
          style={{ color: "#9CA3AF" }}
        >
          Mes formations
        </p>
        <p
          className="text-sm font-semibold truncate leading-tight"
          style={{ color: "#101820" }}
        >
          {courseTitle}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isPreview && editHref && (
          <a
            href={editHref}
            className="mr-2"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 10,
              background: "#FFD100", color: "#101820",
              fontWeight: 700, fontSize: "0.8125rem",
              textDecoration: "none", flexShrink: 0,
            }}
          >
            Éditer
          </a>
        )}

        <button
          className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full transition-colors hover:bg-black/5"
          aria-label="Notifications"
          title="Vous n'avez pas eu de retour sur vos travaux"
        >
          <Bell size={18} style={{ color: "#101820" }} />
        </button>

        <LearnerAccountMenu learnerEmail={learnerEmail} isPreview={isPreview} />
      </div>
    </header>
  );
}

function getLearnerInitials(email: string): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2 && parts[0] && parts[1])
    return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function LearnerAccountMenu({
  learnerEmail,
  isPreview,
}: {
  learnerEmail: string;
  isPreview: boolean;
}) {
  const navigate = useNavigate();
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
    if (confirmed) {
      sessionStorage.removeItem("learner_email");
      await supabase.auth.signOut();
      navigate("/apprenant/connexion");
    }
  };

  const portalItems = [
    { label: "Mon compte", icon: User, section: "compte" },
    { label: "Mes formations", icon: BookOpen, section: "formations" },
    { label: "Mes formations recommandées", icon: Sparkles, section: "recommandees" },
    { label: "Aide", icon: HelpCircle, section: "aide" },
  ];

  const initials = getLearnerInitials(learnerEmail);
  const displayName = learnerEmail ? learnerEmail.split("@")[0] : "Administrateur";

  return (
    <>
      <ConfirmDialog />
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-2 py-1 transition-all hover:bg-black/[0.04] active:bg-black/[0.07]"
          style={{ fontFamily: "inherit" }}
          title={learnerEmail || "Administrateur"}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none"
            style={{ background: "#FFD100", color: "#101820" }}
          >
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-[11px] leading-none mb-0.5" style={{ color: "var(--st-ink-muted)" }}>Bonjour</p>
            <p className="text-sm font-semibold leading-none truncate max-w-[140px]" style={{ color: "var(--st-ink)" }}>
              {displayName}
            </p>
          </div>
          <ChevronDown
            size={14}
            className="hidden sm:block shrink-0 transition-transform duration-200"
            style={{
              color: "var(--st-ink-muted)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-2 z-50"
            style={{
              width: 240,
              background: "#ffffff",
              border: "1px solid rgba(16,24,32,0.08)",
              borderRadius: 16,
              boxShadow: "0 8px 32px rgba(16,24,32,0.12), 0 2px 8px rgba(16,24,32,0.06)",
              overflow: "hidden",
            }}
          >
            <div className="py-1.5">
              {portalItems.map(({ label, icon: Icon, section }) => (
                <button
                  key={section}
                  onClick={() => { navigate(`/espace-apprenant?section=${section}`); setOpen(false); }}
                  className="w-full flex items-center gap-3 text-sm text-left transition-colors hover:bg-black/[0.04]"
                  style={{ color: "var(--st-ink)", fontFamily: "inherit", padding: "10px 16px" }}
                >
                  <Icon size={16} strokeWidth={1.75} style={{ color: "var(--st-ink-muted)", flexShrink: 0 }} />
                  {label}
                </button>
              ))}
            </div>
            {!isPreview && (
              <div style={{ borderTop: "1px solid rgba(16,24,32,0.08)" }} className="py-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 text-sm text-left transition-colors hover:bg-red-50"
                  style={{ color: "#dc2626", fontFamily: "inherit", padding: "10px 16px" }}
                >
                  <LogOut size={16} strokeWidth={1.75} style={{ color: "#dc2626", flexShrink: 0 }} />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
