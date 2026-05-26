import { GraduationCap, ArrowRight } from "lucide-react";

export default function ReturnToFormationCard({
  lessonTitle,
  resumeHref,
}: {
  lessonTitle: string;
  resumeHref: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "linear-gradient(135deg, rgba(255,209,0,0.18), rgba(255,209,0,0.04))", border: "1px solid rgba(255,209,0,0.5)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--st-yellow)", color: "#101820" }}>
          <GraduationCap size={20} />
        </div>
        <h3 className="text-base font-bold" style={{ color: "var(--st-ink)" }}>Retour à votre formation</h3>
      </div>

      <div>
        <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>Vous étiez en train de suivre :</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--st-ink)" }}>{lessonTitle}</p>
      </div>

      <a
        href={resumeHref}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-px"
        style={{ background: "var(--st-yellow)", color: "#101820" }}
      >
        Reprendre le cours <ArrowRight size={16} />
      </a>
    </div>
  );
}
