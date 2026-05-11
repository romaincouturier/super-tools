import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import type { AnyExtension } from "@tiptap/core";

/**
 * Configuration unifiée des extensions Tiptap Table.
 * Consommé par MissionPages, CrmDescriptionEditor et le bloc Table du LMS
 * pour garder un rendu cohérent et un seul endroit à modifier.
 *
 * `density: "compact"` rétrécit la taille du texte et le padding pour les
 * éditeurs denses (CRM dans une carte étroite). `density: "normal"` est la
 * valeur par défaut pour les pages mission / leçons LMS.
 */
export function tableExtensions(density: "normal" | "compact" = "normal"): AnyExtension[] {
  const padding = density === "compact" ? "p-1.5" : "p-2";
  const textSize = density === "compact" ? "text-xs" : "text-sm";
  return [
    Table.configure({
      resizable: true,
      HTMLAttributes: { class: `border-collapse my-2 w-full ${textSize}` },
    }),
    TableRow,
    TableHeader.configure({
      HTMLAttributes: {
        class: `border border-muted-foreground/30 bg-muted/50 font-semibold ${padding} text-left`,
      },
    }),
    TableCell.configure({
      HTMLAttributes: { class: `border border-muted-foreground/30 ${padding} align-top` },
    }),
  ];
}
