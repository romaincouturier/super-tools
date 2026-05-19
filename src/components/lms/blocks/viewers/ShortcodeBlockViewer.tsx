import { ClipboardList, Sparkles, ExternalLink } from "lucide-react";
import type { ShortcodeBlockContent, ShortcodeKind } from "@/types/lms-blocks";
import { Button } from "@/components/ui/button";
import ActionBlockShell from "./ActionBlockShell";

interface Props {
  content: ShortcodeBlockContent;
  /** Email de l'apprenant connecté (omise en mode preview). */
  learnerEmail?: string;
  /** ID du cours LearnDash, peut venir du bloc ou d'un fallback côté page. */
  fallbackCourseId?: string | null;
}

const META: Record<
  ShortcodeKind,
  { label: string; icon: typeof ClipboardList; intro: string }
> = {
  besoins: {
    label: "Recueil des besoins",
    icon: ClipboardList,
    intro:
      "Quelques minutes pour exprimer vos attentes : votre formateur adaptera la session à votre profil.",
  },
  evaluation: {
    label: "Évaluation de la formation",
    icon: Sparkles,
    intro:
      "Votre avis nous aide à améliorer cette formation. Le formulaire prend environ 3 minutes.",
  },
};

export default function ShortcodeBlockViewer({
  content,
  learnerEmail,
  fallbackCourseId,
}: Props) {
  const code = (content.code ?? "besoins") as ShortcodeKind;
  const meta = META[code];
  const Icon = meta.icon;
  const courseId = content.course_id ?? fallbackCourseId ?? null;
  const title = content.title || meta.label;

  // No learner context (admin preview) — show a styled placeholder.
  if (!learnerEmail) {
    return (
      <ActionBlockShell icon={Icon} label={title}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{meta.intro}</p>
          <p className="text-xs italic text-muted-foreground">
            Aperçu : le formulaire « {meta.label} » s'affichera ici pour l'apprenant
            connecté.
          </p>
        </div>
      </ActionBlockShell>
    );
  }

  // No course id available — show an explanatory CTA only.
  if (!courseId) {
    return (
      <ActionBlockShell icon={Icon} label={title}>
        <p className="text-sm text-muted-foreground">
          Le formulaire « {meta.label} » est accessible depuis vos emails de
          formation.
        </p>
      </ActionBlockShell>
    );
  }

  const params = new URLSearchParams({
    email: learnerEmail,
    course_id: String(courseId),
  });
  const href = `/formulaire/${code}?${params.toString()}`;

  return (
    <ActionBlockShell icon={Icon} label={title}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{meta.intro}</p>
        <div className="overflow-hidden rounded-lg border bg-background">
          <iframe
            src={href}
            title={title}
            className="w-full"
            style={{ minHeight: 520, border: 0 }}
            loading="lazy"
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-xs text-muted-foreground"
          >
            <a href={href} target="_blank" rel="noreferrer">
              Ouvrir dans un nouvel onglet
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </ActionBlockShell>
  );
}
