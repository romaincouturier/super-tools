/**
 * Synthèse de l'avis et pièces du DCE, dans la fiche de revue.
 *
 * Deux blocs distincts parce que les deux sources le sont : l'avis est déjà en
 * base, le DCE se dépose à la main. Rien n'est calculé à l'ouverture de la
 * fiche — à 98 % de No Go, produire une synthèse pour chaque avis consulté
 * serait payer un appel de modèle pour des marchés écartés en lisant le titre.
 */
import { useState } from "react";
import { FileSearch, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";
import EntityDocumentsManager from "@/components/shared/EntityDocumentsManager";
import {
  TENDER_DOCS_AI_QUERY_KEY,
  useTenderDocumentAnalyses,
  useTenderDocumentAnalysis,
  useTenderNoticeSummary,
} from "@/hooks/crm/useTenderAi";
import { tenderAdequacyTone, type TenderWithContext } from "@/types/tenders";

/** Formats que l'extraction sait lire. Une archive ZIP donnerait un document
 *  que le modèle ne peut pas ouvrir : autant la refuser au dépôt. */
const ACCEPTED =
  ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg";

function Bullets({ title, items }: { title: string; items?: string[] | null }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="list-disc pl-4 space-y-0.5 text-sm">
        {items.map((item, i) => (
          <li key={`${title}-${i}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function TenderAiPanel({ tender }: { tender: TenderWithContext }) {
  const summary = tender.ai_summary;
  const { loading: summarizing, run: runSummary } = useTenderNoticeSummary();
  const { data: analyses = [] } = useTenderDocumentAnalyses(tender.id);
  const { run: runAnalysis } = useTenderDocumentAnalysis(tender.id);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const analyze = async (documentId: string) => {
    setAnalyzingId(documentId);
    try {
      await runAnalysis(documentId);
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Synthèse de l'avis ───────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Synthèse de l'avis</p>
          <Button
            variant="outline"
            size="sm"
            disabled={summarizing}
            onClick={() => runSummary(tender.id)}
          >
            {summarizing ? <Spinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{summary ? "Refaire la synthèse" : "Résumer l'avis"}</span>
          </Button>
        </div>

        {!summary ? (
          <p className="text-sm text-muted-foreground">
            L'avis complet est en base. La synthèse reformule l'objet, liste ce qui est
            réellement attendu, la pondération des critères et les points qui coûtent cher.
          </p>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm">{summary.synthese}</p>

            {summary.adequation?.verdict && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={tenderAdequacyTone[summary.adequation.verdict] ?? "bg-muted"}
                  variant="secondary"
                >
                  Adéquation {summary.adequation.verdict}
                </Badge>
                <span className="text-xs text-muted-foreground">{summary.adequation.motif}</span>
              </div>
            )}

            <Bullets title="Ce qui est attendu" items={summary.attendu} />

            {!!summary.criteres?.length && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Critères</p>
                <ul className="space-y-0.5 text-sm">
                  {summary.criteres.map((c, i) => (
                    <li key={`crit-${i}`} className="flex justify-between gap-3">
                      <span>{c.libelle}</span>
                      <span className="text-muted-foreground shrink-0">{c.poids ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Bullets title="Points de vigilance" items={summary.vigilance} />

            {tender.ai_summary_at && (
              <p className="text-[11px] text-muted-foreground">
                Produite le {new Date(tender.ai_summary_at).toLocaleString("fr-FR")}
              </p>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Pièces du DCE ────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Dossier de consultation</p>
        <p className="text-sm text-muted-foreground">
          Le DCE ne se récupère pas automatiquement : il se retire sur PLACE ou AWS derrière un
          compte. Téléchargez le CCTP ou le règlement de consultation et déposez-le ici pour
          l'analyser. Une archive ZIP doit être décompressée avant dépôt.
        </p>

        <EntityDocumentsManager
          entityType="tender"
          entityId={tender.id}
          variant="bare"
          accept={ACCEPTED}
          title="Pièces déposées"
          showDeliverableToggle={false}
          // Le gestionnaire mutualisé n'invalide que sa propre liste : sans ce
          // rappel, une pièce déposée n'apparaîtrait pas dans les analyses.
          onUploadComplete={() =>
            queryClient.invalidateQueries({ queryKey: [TENDER_DOCS_AI_QUERY_KEY, tender.id] })
          }
        />

        {analyses.length > 0 && (
          <p className="pt-1 text-xs font-medium text-muted-foreground">Analyse des pièces</p>
        )}

        {analyses.map((doc) => (
          <div key={doc.id} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium break-all">{doc.file_name}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={analyzingId === doc.id}
                onClick={() => analyze(doc.id)}
              >
                {analyzingId === doc.id ? (
                  <Spinner size="sm" />
                ) : (
                  <FileSearch className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">{doc.ai_analysis ? "Refaire" : "Analyser"}</span>
              </Button>
            </div>

            {doc.ai_error && (
              <p className="flex items-start gap-1.5 text-sm text-destructive">
                <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {doc.ai_error}
              </p>
            )}

            {doc.ai_analysis && (
              <div className="space-y-3">
                <p className="text-sm">{doc.ai_analysis.synthese}</p>
                <Bullets title="Ce qui est demandé" items={doc.ai_analysis.demande} />
                <Bullets title="Contraintes" items={doc.ai_analysis.contraintes} />
                <Bullets title="Pièces à produire" items={doc.ai_analysis.pieces_a_produire} />
                <Bullets title="Points de vigilance" items={doc.ai_analysis.vigilance} />
                {doc.ai_analysis_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Analysée le {new Date(doc.ai_analysis_at).toLocaleString("fr-FR")}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
