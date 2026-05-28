import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Video,
  Image,
  LayoutGrid,
  List,
  Pencil,
  Star,
  Upload,
  FolderOpen,
  ExternalLink,
  CheckCircle,
  Layers,
} from "lucide-react";
import type { LessonBlockType } from "./lms-blocks";

export interface TemplateBlockDef {
  type: LessonBlockType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content?: Record<string, any>;
  children?: TemplateBlockDef[];
}

export interface LessonTemplate {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  blocks: TemplateBlockDef[];
}

export const LESSON_TEMPLATES: LessonTemplate[] = [
  {
    id: "intro-lesson",
    label: "Introduction de leçon",
    description: "Une section de présentation avec texte d'intro et points clés.",
    icon: BookOpen,
    blocks: [
      {
        type: "section",
        content: { title: "Introduction", background: "muted" },
        children: [
          {
            type: "text",
            content: {
              html: "<p>Bienvenue dans cette leçon. Découvrez ici les concepts fondamentaux qui vous permettront de progresser efficacement.</p>",
            },
          },
          {
            type: "key_points",
            content: {
              title: "Ce que vous allez apprendre",
              items: [
                "Comprendre les notions essentielles de ce module.",
                "Mettre en pratique les concepts abordés.",
                "Évaluer votre progression à l'issue de la leçon.",
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "video-summary",
    label: "Vidéo + résumé",
    description: "Une vidéo suivie d'un texte de résumé.",
    icon: Video,
    blocks: [
      {
        type: "section",
        content: { title: null, background: "default" },
        children: [
          { type: "video" },
          {
            type: "text",
            content: {
              html: "<h3>Résumé</h3><p>Ce que vous venez de voir en quelques mots clés…</p>",
            },
          },
        ],
      },
    ],
  },
  {
    id: "image-caption",
    label: "Image + légende",
    description: "Une image illustrative avec sa légende.",
    icon: Image,
    blocks: [
      {
        type: "image",
        content: { url: null, caption_html: "<p>Légende — décrivez ici le contenu de l'image.</p>" },
      },
    ],
  },
  {
    id: "two-images",
    label: "Deux images côte à côte",
    description: "Une rangée de deux images disposées en colonnes.",
    icon: LayoutGrid,
    blocks: [
      {
        type: "row",
        content: { column_count: 2 },
        children: [
          { type: "image", content: { url: null, caption_html: null } },
          { type: "image", content: { url: null, caption_html: null } },
        ],
      },
    ],
  },
  {
    id: "key-points",
    label: "Points clés à retenir",
    description: "Un encadré listant les notions essentielles.",
    icon: List,
    blocks: [
      {
        type: "key_points",
        content: {
          title: "À retenir",
          items: [
            "Premier point essentiel.",
            "Deuxième point essentiel.",
            "Troisième point essentiel.",
          ],
        },
      },
    ],
  },
  {
    id: "exercise",
    label: "Exercice guidé",
    description: "Un exercice avec énoncé et corrigé masqué.",
    icon: Pencil,
    blocks: [
      {
        type: "exercise",
        content: {
          prompt_html: "<p><strong>Exercice :</strong> Rédigez en quelques lignes les grandes étapes du processus abordé dans ce module.</p>",
          answer_html: "<p><em>[Insérez ici un exemple de réponse attendue]</em></p>",
        },
      },
    ],
  },
  {
    id: "self-assessment",
    label: "Auto-évaluation",
    description: "Un widget pour que l'apprenant note sa compréhension.",
    icon: Star,
    blocks: [
      {
        type: "self_assessment",
        content: {
          prompt: "Comment évaluez-vous votre niveau de compréhension sur cette section ?",
          scale: "stars",
        },
      },
    ],
  },
  {
    id: "work-deposit",
    label: "Dépôt de travail",
    description: "Un formulaire pour que l'apprenant dépose son travail.",
    icon: Upload,
    blocks: [
      {
        type: "work_deposit",
        content: {
          title: "Déposer mon travail",
          instructions_html: "<p>Déposez votre document en nommant le fichier avec votre prénom et le titre du module.</p>",
          expected_deliverable: "<p>Un fichier PDF ou Word, 2 pages maximum.</p>",
          accepted_formats: ["pdf", "docx"],
          max_size_mb: 10,
          sharing_allowed: true,
          comments_enabled: true,
          feedback_enabled: true,
        },
      },
    ],
  },
  {
    id: "resources",
    label: "Ressources à télécharger",
    description: "Une section dédiée aux fichiers à télécharger.",
    icon: FolderOpen,
    blocks: [
      {
        type: "section",
        content: { title: "Ressources", background: "muted" },
        children: [
          {
            type: "text",
            content: {
              html: "<p>Retrouvez ci-dessous les ressources associées à cette leçon pour approfondir votre apprentissage.</p>",
            },
          },
          {
            type: "file",
            content: { url: null, name: "Ressource — Module.pdf", size: null, description_html: null },
          },
        ],
      },
    ],
  },
  {
    id: "go-further",
    label: "Pour aller plus loin",
    description: "Un encadré avec un lien vers des ressources complémentaires.",
    icon: ExternalLink,
    blocks: [
      {
        type: "callout",
        content: {
          color: "blue",
          title: "Pour aller plus loin",
          body_html: "<p>Vous souhaitez approfondir ce sujet ? Consultez la ressource ci-dessous.</p>",
        },
      },
      {
        type: "button",
        content: { label: "Accéder à la ressource", url: "", variant: "primary", open_in_new_tab: true },
      },
    ],
  },
  {
    id: "procreate-concepts",
    label: "Comparatif Procreate / Concepts",
    description: "Structure en 6 blocs : intro + vidéo + exercice pour Procreate, puis Concepts.",
    icon: Layers,
    blocks: [
      { type: "text", content: { html: "<h2>Procreate</h2>" } },
      { type: "video" },
      { type: "exercise", content: { prompt_html: "<p><strong>Exercice :</strong> Entraînez-vous sur Procreate.</p>", answer_html: "" } },
      { type: "text", content: { html: "<h2>Concepts</h2>" } },
      { type: "video" },
      { type: "exercise", content: { prompt_html: "<p><strong>Exercice :</strong> Entraînez-vous sur Concepts.</p>", answer_html: "" } },
    ],
  },
  {
    id: "conclusion",
    label: "Conclusion de leçon",
    description: "Une section de synthèse avec texte récapitulatif et acquis.",
    icon: CheckCircle,
    blocks: [
      {
        type: "section",
        content: { title: "Conclusion", background: "muted" },
        children: [
          {
            type: "text",
            content: {
              html: "<p>Félicitations ! Vous avez terminé cette leçon. Récapitulons ensemble les points essentiels abordés.</p>",
            },
          },
          {
            type: "key_points",
            content: {
              title: "Ce que vous avez appris",
              items: [
                "Notion clé n°1.",
                "Notion clé n°2.",
                "Notion clé n°3.",
              ],
            },
          },
        ],
      },
    ],
  },
];
