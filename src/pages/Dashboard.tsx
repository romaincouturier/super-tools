import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  Award,
  BarChart3,
  Bot,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Database,
  Eye,
  FileText,
  GraduationCap,
  History,
  Image as ImageIcon,
  Inbox,
  Kanban,
  LifeBuoy,
  Newspaper,
  Send,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";

// ── Palette (charte SuperTools) ──────────────────────────────
const CREAM = "#f7f5f0";
const ANTHRACITE = "#101820";
const YELLOW = "#ffd100";

// ── Typographie helpers ──────────────────────────────────────
const serif = '"Fraunces", "Playfair Display", Georgia, serif';

// ── Mock data (à câbler aux vraies queries ultérieurement) ───
const USER = { first: "Romain", initials: "RC" } as const;

const KPIS: KpiDefinition[] = [
  { id: "ca", label: "CA signé ce mois", value: "48 320 €", delta: "+12,4 %", trend: "up", spark: [22, 28, 24, 31, 35, 33, 42, 48] },
  { id: "missions", label: "Missions actives", value: "7", delta: "2 nouvelles", trend: "up", spark: [4, 4, 5, 5, 6, 6, 7, 7] },
  { id: "formations", label: "Formations à venir", value: "12", delta: "3 cette semaine", trend: "flat", spark: [8, 10, 11, 11, 10, 12, 12, 12] },
  { id: "devis", label: "Devis en attente", value: "4", delta: "1 à relancer", trend: "warn", spark: [2, 3, 3, 4, 5, 4, 4, 4] },
];

interface AgendaItem { time: string; dur: string; title: string; tag: string; color: "yellow" | "neutral" }
const AGENDA: AgendaItem[] = [
  { time: "09:30", dur: "1h", title: "Kick-off Axa Formation", tag: "Mission", color: "yellow" },
  { time: "11:00", dur: "45 min", title: "Relecture livrable — Orange Pro", tag: "Contenu", color: "neutral" },
  { time: "14:00", dur: "3h", title: "Formation Leadership — J2 (Decathlon)", tag: "Formation", color: "yellow" },
  { time: "17:30", dur: "30 min", title: "Point hebdo équipe", tag: "Interne", color: "neutral" },
];

interface AttentionItem { icon: typeof AlertTriangle; text: string; path: string; tone: "warn" | "info" }
const ATTENTION: AttentionItem[] = [
  { icon: AlertTriangle, text: "3 emails en erreur d'envoi", path: "/emails-erreur", tone: "warn" },
  { icon: FileText, text: "1 devis expire dans 2 jours", path: "/crm", tone: "warn" },
  { icon: ClipboardCheck, text: "14 évaluations non lues", path: "/evaluations", tone: "info" },
];

const INSIGHT = {
  headline: "Votre taux de transformation devis → mission a bondi à 68 % ce trimestre",
  detail: "C'est 14 points au-dessus du Q4 2025. Les missions « audit » tirent la hausse.",
};

const FAVORITES = new Set(["crm", "missions", "formations", "okr", "evaluations"]);

interface ModuleTile { id: string; label: string; icon: typeof Kanban; path: string }
const MODULES: ModuleTile[] = [
  { id: "crm", label: "CRM", icon: Kanban, path: "/crm" },
  { id: "missions", label: "Missions", icon: Briefcase, path: "/missions" },
  { id: "formations", label: "Formations", icon: Calendar, path: "/formations" },
  { id: "micro-devis", label: "Micro-devis", icon: FileText, path: "/micro-devis" },
  { id: "okr", label: "OKR", icon: Target, path: "/okr" },
  { id: "contenu", label: "Contenu", icon: Newspaper, path: "/contenu" },
  { id: "events", label: "Événements", icon: CalendarDays, path: "/events" },
  { id: "medias", label: "Médiathèque", icon: ImageIcon, path: "/medias" },
  { id: "catalogue", label: "Catalogue", icon: BookOpen, path: "/catalogue" },
  { id: "evaluations", label: "Évaluations", icon: ClipboardCheck, path: "/evaluations" },
  { id: "certificates", label: "Certificats", icon: Award, path: "/certificates" },
  { id: "besoins", label: "Besoins", icon: ClipboardList, path: "/besoins" },
  { id: "lms", label: "E-learning", icon: GraduationCap, path: "/lms" },
  { id: "reclamations", label: "Réclamations", icon: AlertTriangle, path: "/reclamations" },
  { id: "emails", label: "Emails reçus", icon: Inbox, path: "/emails" },
  { id: "historique", label: "Historique", icon: History, path: "/historique" },
  { id: "statistiques", label: "Statistiques", icon: BarChart3, path: "/statistiques" },
  { id: "monitoring", label: "Monitoring", icon: Database, path: "/monitoring" },
  { id: "ameliorations", label: "Améliorations", icon: TrendingUp, path: "/ameliorations" },
  { id: "support", label: "Support", icon: LifeBuoy, path: "/support" },
  { id: "reseau", label: "Réseau", icon: Users, path: "/reseau" },
  { id: "veille", label: "Veille", icon: Eye, path: "/veille" },
  { id: "arena", label: "AI Arena", icon: Sparkles, path: "/arena" },
];

// ── Greeting utility ─────────────────────────────────────────
function greetingFor(hour: number): string {
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

function formatToday(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ── Sparkline ────────────────────────────────────────────────
interface KpiDefinition { id: string; label: string; value: string; delta: string; trend: "up" | "warn" | "flat"; spark: number[] }

function Sparkline({ data, color, width = 64, height = 28, strokeWidth = 1.75 }: { data: number[]; color: string; width?: number; height?: number; strokeWidth?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── KPI card ─────────────────────────────────────────────────
function KpiCard({ kpi }: { kpi: KpiDefinition }) {
  const trendColor = kpi.trend === "up" ? "#1a7a3f" : kpi.trend === "warn" ? "#b45309" : "rgba(16,24,32,0.3)";
  const deltaColor = kpi.trend === "up" ? "#1a7a3f" : kpi.trend === "warn" ? "#b45309" : "rgba(16,24,32,0.5)";
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "20px 20px 18px",
        border: "1px solid rgba(16,24,32,0.05)",
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(16,24,32,0.55)", marginBottom: 10 }}>{kpi.label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: serif, fontSize: 30, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1 }}>{kpi.value}</div>
          <div
            style={{
              fontSize: 11.5,
              marginTop: 8,
              color: deltaColor,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {kpi.trend === "up" && <ArrowUpRight size={11} strokeWidth={2} />}
            {kpi.delta}
          </div>
        </div>
        <Sparkline data={kpi.spark} color={trendColor} />
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const greet = greetingFor(now.getHours());
  const today = formatToday(now);
  const [agentPrompt, setAgentPrompt] = useState("");

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = agentPrompt.trim();
    if (trimmed) {
      navigate(`/agent?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate("/agent");
    }
  };

  return (
    <ModuleLayout>
      <div style={{ background: CREAM, color: ANTHRACITE, minHeight: "100%", fontFamily: '"Inter", system-ui, sans-serif' }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 40px 48px" }}>
          {/* Greeting header */}
          <header
            style={{
              marginBottom: 32,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: "rgba(16,24,32,0.5)",
                  marginBottom: 12,
                }}
              >
                {today}
              </div>
              <h1
                style={{
                  fontFamily: serif,
                  fontSize: "clamp(32px, 5vw, 52px)",
                  fontWeight: 400,
                  lineHeight: 1.02,
                  letterSpacing: -1.5,
                  margin: 0,
                }}
              >
                {greet},{" "}
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>{USER.first}</em>.
              </h1>
              <p style={{ fontSize: 16, color: "rgba(16,24,32,0.65)", margin: "10px 0 0", maxWidth: 560, lineHeight: 1.5 }}>
                4 événements sur votre journée, 2 devis à relancer. Vous avancez bien sur les OKR Q2.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => navigate("/agent")}
                style={{
                  padding: "10px 16px",
                  background: ANTHRACITE,
                  color: CREAM,
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Bot size={15} /> Parler à l&apos;agent
              </button>
            </div>
          </header>

          {/* Hero insight band */}
          <section
            style={{
              background: YELLOW,
              borderRadius: 18,
              padding: "28px 32px",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
              gap: 40,
              alignItems: "center",
              marginBottom: 36,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: "rgba(16,24,32,0.65)",
                  marginBottom: 10,
                }}
              >
                ◆ Insight de la semaine
              </div>
              <div
                style={{
                  fontFamily: serif,
                  fontSize: 26,
                  lineHeight: 1.2,
                  letterSpacing: -0.6,
                  fontWeight: 500,
                  color: ANTHRACITE,
                }}
              >
                {INSIGHT.headline}
              </div>
              <div style={{ fontSize: 14, color: "rgba(16,24,32,0.75)", marginTop: 12, lineHeight: 1.5 }}>
                {INSIGHT.detail}
              </div>
              <button
                type="button"
                onClick={() => navigate("/statistiques")}
                style={{
                  marginTop: 16,
                  padding: "8px 14px",
                  background: ANTHRACITE,
                  color: YELLOW,
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Voir le détail <ArrowRight size={13} />
              </button>
            </div>
            {/* Stylized chart */}
            <div style={{ position: "relative", height: 140 }}>
              <svg width="100%" height="100%" viewBox="0 0 320 140" style={{ overflow: "visible" }} aria-hidden="true">
                <defs>
                  <linearGradient id="dashboard-insight-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor={ANTHRACITE} stopOpacity="0.25" />
                    <stop offset="1" stopColor={ANTHRACITE} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 110 L40 95 L80 100 L120 75 L160 60 L200 50 L240 30 L280 25 L320 10 L320 140 L0 140 Z"
                  fill="url(#dashboard-insight-fill)"
                />
                <path
                  d="M0 110 L40 95 L80 100 L120 75 L160 60 L200 50 L240 30 L280 25 L320 10"
                  fill="none"
                  stroke={ANTHRACITE}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((x, i) => {
                  const ys = [110, 95, 100, 75, 60, 50, 30, 25, 10];
                  return <circle key={x} cx={x} cy={ys[i]} r={i === 8 ? 5 : 3} fill={ANTHRACITE} />;
                })}
                <text x="300" y="4" fontSize="11" fill={ANTHRACITE} fontWeight="600" textAnchor="end">68%</text>
              </svg>
            </div>
          </section>

          {/* KPIs */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 36,
            }}
          >
            {KPIS.map((k) => (
              <KpiCard key={k.id} kpi={k} />
            ))}
          </section>

          {/* Two-column: Agenda + Attention/Agent prompt */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
              gap: 20,
              marginBottom: 32,
            }}
            className="dashboard-twocol"
          >
            {/* Agenda */}
            <section style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid rgba(16,24,32,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontFamily: serif, fontSize: 19, fontWeight: 500, letterSpacing: -0.4, margin: 0 }}>
                    Votre journée
                  </h2>
                  <div style={{ fontSize: 12, color: "rgba(16,24,32,0.5)", marginTop: 2 }}>
                    {AGENDA.length} événements · fin à 18h
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/events")}
                  style={{
                    fontSize: 12.5,
                    color: ANTHRACITE,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Voir le calendrier <ChevronRight size={12} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {AGENDA.map((e, i) => (
                  <div
                    key={`${e.time}-${e.title}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "64px 4px 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: i > 0 ? "1px solid rgba(16,24,32,0.05)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13.5, fontWeight: 600, letterSpacing: -0.2 }}>
                        {e.time}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(16,24,32,0.45)" }}>{e.dur}</div>
                    </div>
                    <div
                      style={{
                        width: 3,
                        height: 28,
                        borderRadius: 2,
                        background: e.color === "yellow" ? YELLOW : "rgba(16,24,32,0.15)",
                      }}
                    />
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "rgba(16,24,32,0.55)",
                        padding: "3px 8px",
                        background: "rgba(16,24,32,0.05)",
                        borderRadius: 20,
                      }}
                    >
                      {e.tag}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Right column: Agent IA prompt + Attention */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <section style={{ background: ANTHRACITE, color: CREAM, borderRadius: 14, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Bot size={16} style={{ color: YELLOW }} />
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>Agent IA</div>
                </div>
                <div style={{ fontSize: 12, color: "rgba(247,245,240,0.6)", marginBottom: 12 }}>
                  Posez une question, lancez une action
                </div>
                <form
                  onSubmit={handleAgentSubmit}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    background: "rgba(247,245,240,0.08)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <input
                    value={agentPrompt}
                    onChange={(ev) => setAgentPrompt(ev.target.value)}
                    placeholder="Ex: relance les devis ouverts depuis +7j…"
                    aria-label="Message à l'Agent IA"
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: CREAM,
                      fontSize: 13,
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="submit"
                    aria-label="Envoyer à l'agent"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: "none",
                      background: YELLOW,
                      color: ANTHRACITE,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Send size={13} />
                  </button>
                </form>
              </section>

              <section style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid rgba(16,24,32,0.05)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>À votre attention</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ATTENTION.map((a) => {
                    const IconCmp = a.icon;
                    return (
                      <button
                        key={a.text}
                        type="button"
                        onClick={() => navigate(a.path)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(16,24,32,0.03)",
                          border: "none",
                          width: "100%",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "inherit",
                          fontFamily: "inherit",
                        }}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 7,
                            background: a.tone === "warn" ? "rgba(255,209,0,0.25)" : "rgba(16,24,32,0.06)",
                            color: a.tone === "warn" ? "#8a6d00" : ANTHRACITE,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconCmp size={13} />
                        </div>
                        <div style={{ fontSize: 12.5, flex: 1 }}>{a.text}</div>
                        <ChevronRight size={13} style={{ opacity: 0.4 }} />
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          {/* Modules grid */}
          <section>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: serif, fontSize: 19, fontWeight: 500, letterSpacing: -0.4, margin: 0 }}>
                Vos modules
              </h2>
              <div style={{ fontSize: 12, color: "rgba(16,24,32,0.5)" }}>
                {MODULES.length} accessibles
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              {MODULES.slice(0, 18).map((m) => {
                const isFav = FAVORITES.has(m.id);
                const IconCmp = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => navigate(m.path)}
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: "14px 14px 12px",
                      border: "1px solid rgba(16,24,32,0.05)",
                      cursor: "pointer",
                      position: "relative",
                      transition: "transform .14s ease, box-shadow .14s ease",
                      textAlign: "left",
                      fontFamily: "inherit",
                      color: "inherit",
                    }}
                    onMouseEnter={(ev) => {
                      (ev.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                      (ev.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(16,24,32,0.06)";
                    }}
                    onMouseLeave={(ev) => {
                      (ev.currentTarget as HTMLButtonElement).style.transform = "";
                      (ev.currentTarget as HTMLButtonElement).style.boxShadow = "";
                    }}
                  >
                    {isFav && (
                      <div style={{ position: "absolute", top: 8, right: 8, color: YELLOW }}>
                        <Star size={11} fill={YELLOW} strokeWidth={0} />
                      </div>
                    )}
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: isFav ? ANTHRACITE : "rgba(16,24,32,0.05)",
                        color: isFav ? YELLOW : ANTHRACITE,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 10,
                      }}
                    >
                      <IconCmp size={15} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.2 }}>{m.label}</div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </ModuleLayout>
  );
};

export default Dashboard;
