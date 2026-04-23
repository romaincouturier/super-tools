import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  Bot,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Mail,
  Send,
  Star,
} from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import { Spinner } from "@/components/ui/spinner";
import { MODULE_ICONS } from "@/components/moduleIcons";
import { useModuleAccess, type AppModule } from "@/hooks/useModuleAccess";
import {
  useDashboardData,
  type DashboardAttentionIcon,
  type DashboardKpi,
} from "@/hooks/useDashboardData";

// ── Palette (charte SuperTools) ──────────────────────────────
const CREAM = "#f7f5f0";
const ANTHRACITE = "#101820";
const YELLOW = "#ffd100";

const serif = '"Fraunces", "Playfair Display", Georgia, serif';

// ── Module tiles : source commune, access-filtered ───────────
const MODULE_ORDER = [
  "crm",
  "missions",
  "formations",
  "okr",
  "evaluations",
  "catalogue",
  "contenu",
  "events",
  "medias",
  "besoins",
  "lms",
  "ameliorations",
  "supertilt",
  "historique",
  "emails",
  "reclamations",
  "reseau",
  "veille",
];

const FAVORITES = new Set(["crm", "missions", "formations", "okr", "evaluations"]);

function moduleKeyToAppModule(key: string): AppModule {
  return key.replace("-", "_") as AppModule;
}

// ── Attention icon mapping ───────────────────────────────────
const ATTENTION_ICON: Record<DashboardAttentionIcon, typeof AlertTriangle> = {
  alert: AlertTriangle,
  file: FileText,
  clipboard: ClipboardCheck,
  mail: Mail,
};

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

function Sparkline({ data, color, width = 64, height = 28, strokeWidth = 1.75 }: { data: number[]; color: string; width?: number; height?: number; strokeWidth?: number }) {
  if (!data.length) return null;
  const safeData = data.length === 1 ? [data[0], data[0]] : data;
  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;
  const step = width / (safeData.length - 1);
  const pts = safeData
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── KPI card ─────────────────────────────────────────────────
function KpiCard({ kpi }: { kpi: DashboardKpi }) {
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
  const { hasAccess } = useModuleAccess();
  const dashboard = useDashboardData();

  const now = useMemo(() => new Date(), []);
  const greet = greetingFor(now.getHours());
  const today = formatToday(now);
  const [agentPrompt, setAgentPrompt] = useState("");

  const accessibleModules = useMemo(
    () =>
      MODULE_ORDER
        .map((key) => ({ key, info: MODULE_ICONS[key] }))
        .filter((m) => !!m.info && hasAccess(moduleKeyToAppModule(m.key))),
    [hasAccess],
  );

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = agentPrompt.trim();
    navigate(trimmed ? `/agent?q=${encodeURIComponent(trimmed)}` : "/agent");
  };

  const firstName = dashboard.user.firstName || "vous";

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
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>{firstName}</em>.
              </h1>
              <p style={{ fontSize: 16, color: "rgba(16,24,32,0.65)", margin: "10px 0 0", maxWidth: 560, lineHeight: 1.5 }}>
                {dashboard.isLoading ? "Chargement de votre tableau de bord…" : dashboard.subtitle}
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
                {dashboard.insight.headline}
              </div>
              <div style={{ fontSize: 14, color: "rgba(16,24,32,0.75)", marginTop: 12, lineHeight: 1.5 }}>
                {dashboard.insight.detail}
              </div>
              <button
                type="button"
                onClick={() => navigate(dashboard.insight.path)}
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
            {dashboard.isLoading && dashboard.kpis.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", padding: 32 }}>
                <Spinner />
              </div>
            ) : (
              dashboard.kpis.map((k) => <KpiCard key={k.id} kpi={k} />)
            )}
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
                    {dashboard.agenda.length > 0
                      ? `${dashboard.agenda.length} événement${dashboard.agenda.length > 1 ? "s" : ""}`
                      : "Rien de prévu aujourd'hui"}
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
              {dashboard.agenda.length === 0 ? (
                <div style={{ padding: "18px 0", fontSize: 13, color: "rgba(16,24,32,0.5)" }}>
                  Aucun créneau de formation ni événement prévu aujourd&apos;hui.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {dashboard.agenda.map((e, i) => (
                    <div
                      key={`${e.time}-${e.title}-${i}`}
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
                          background: e.accent ? YELLOW : "rgba(16,24,32,0.15)",
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
              )}
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
                {dashboard.attention.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "rgba(16,24,32,0.5)" }}>
                    {dashboard.isLoading ? "Chargement…" : "Tout est à jour — rien d'urgent."}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dashboard.attention.map((a) => {
                      const IconCmp = ATTENTION_ICON[a.icon];
                      return (
                        <button
                          key={`${a.icon}-${a.text}`}
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
                )}
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
                {accessibleModules.length} accessibles
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              {accessibleModules.map(({ key, info }) => {
                const isFav = FAVORITES.has(key);
                const IconCmp = info.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(info.path)}
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
                    <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.2 }}>{info.label}</div>
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
