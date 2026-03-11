import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  FileDown,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuoteSettings, useUpdateQuote } from "@/hooks/useQuotes";
import type { Quote, QuoteLineItem } from "@/types/quotes";
import { v4 as uuid } from "uuid";

interface Props {
  quote: Quote;
  synthesis: string;
  instructions: string;
  travelTotal?: number;
  onContinue: (updatedQuote: Quote) => void;
}

function emptyLine(vatRate: number, defaultUnit = "jour"): QuoteLineItem {
  return {
    id: uuid(),
    product: "",
    description: "",
    quantity: 1,
    unit: defaultUnit,
    unit_price_ht: 0,
    vat_rate: vatRate,
    total_ht: 0,
    total_ttc: 0,
  };
}

export default function Step3QuoteGeneration({
  quote,
  synthesis,
  instructions,
  travelTotal = 0,
  onContinue,
}: Props) {
  const { data: settings } = useQuoteSettings();
  const updateMutation = useUpdateQuote();
  const defaultVat = settings?.default_vat_rate ?? 20;
  const defaultUnit = settings?.default_unit || "jour";

  const [lines, setLines] = useState<QuoteLineItem[]>(
    quote.line_items?.length > 0 ? quote.line_items : []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiryDate, setExpiryDate] = useState(quote.expiry_date);
  const [saleType, setSaleType] = useState(
    quote.sale_type || settings?.default_sale_type || ""
  );
  const [rightsEnabled, setRightsEnabled] = useState(quote.rights_transfer_enabled);
  const [rightsRate, setRightsRate] = useState(quote.rights_transfer_rate ?? 15);

  // Recalculate totals
  const totals = useMemo(() => {
    const vatGroups: Record<number, { ht: number; vat: number }> = {};
    let totalHt = 0;

    for (const line of lines) {
      const lineHt = line.quantity * line.unit_price_ht;
      const lineVat = lineHt * (line.vat_rate / 100);
      totalHt += lineHt;
      if (!vatGroups[line.vat_rate]) vatGroups[line.vat_rate] = { ht: 0, vat: 0 };
      vatGroups[line.vat_rate].ht += lineHt;
      vatGroups[line.vat_rate].vat += lineVat;
    }

    const totalVat = Object.values(vatGroups).reduce((s, g) => s + g.vat, 0);
    const rightsAmount = rightsEnabled ? totalHt * (rightsRate / 100) : 0;
    const rightsVat = rightsAmount * (defaultVat / 100);

    return {
      totalHt: totalHt + rightsAmount,
      totalVat: totalVat + rightsVat,
      totalTtc: totalHt + rightsAmount + totalVat + rightsVat,
      vatGroups,
      rightsAmount,
    };
  }, [lines, rightsEnabled, rightsRate, defaultVat]);

  const generateLines = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-quote-lines",
        {
          body: {
            synthesis,
            instructions,
            defaultVatRate: defaultVat,
            travelTotal,
          },
        }
      );
      if (error) throw error;
      if (data?.lines?.length > 0) {
        let generatedLines = data.lines.map((l: any) => ({
          id: uuid(),
          product: l.product || "",
          description: l.description || "",
          quantity: l.quantity || 1,
          unit: l.unit || defaultUnit,
          unit_price_ht: l.unit_price_ht || 0,
          vat_rate: l.vat_rate ?? defaultVat,
          total_ht: (l.quantity || 1) * (l.unit_price_ht || 0),
          total_ttc:
            (l.quantity || 1) *
            (l.unit_price_ht || 0) *
            (1 + (l.vat_rate ?? defaultVat) / 100),
        }));

        // Add travel expenses line if not already included
        if (travelTotal > 0 && !generatedLines.some((l: any) => l.product?.toLowerCase().includes("déplacement"))) {
          generatedLines.push({
            id: uuid(),
            product: "Frais de déplacement",
            description: "Frais de transport, hébergement et restauration",
            quantity: 1,
            unit: "forfait",
            unit_price_ht: Math.round(travelTotal * 100) / 100,
            vat_rate: defaultVat,
            total_ht: Math.round(travelTotal * 100) / 100,
            total_ttc: Math.round(travelTotal * (1 + defaultVat / 100) * 100) / 100,
          });
        }

        setLines(generatedLines);
        if (data.sale_type_suggestion && !saleType) {
          setSaleType(data.sale_type_suggestion);
        }
      }
    } catch (e: any) {
      console.error("Line generation error:", e);
      const fallbackLines: QuoteLineItem[] = [emptyLine(defaultVat, defaultUnit)];
      // Always add travel line on error fallback
      if (travelTotal > 0) {
        fallbackLines.push({
          id: uuid(),
          product: "Frais de déplacement",
          description: "Frais de transport, hébergement et restauration",
          quantity: 1,
          unit: "forfait",
          unit_price_ht: Math.round(travelTotal * 100) / 100,
          vat_rate: defaultVat,
          total_ht: Math.round(travelTotal * 100) / 100,
          total_ttc: Math.round(travelTotal * (1 + defaultVat / 100) * 100) / 100,
        });
      }
      if (lines.length === 0) {
        setLines(fallbackLines);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (lines.length === 0 && !isGenerating) {
      generateLines();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLine = (id: string, field: keyof QuoteLineItem, value: any) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        updated.total_ht = updated.quantity * updated.unit_price_ht;
        updated.total_ttc = updated.total_ht * (1 + updated.vat_rate / 100);
        return updated;
      })
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine(defaultVat, defaultUnit)]);
  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id));

  const handleSave = async () => {
    const updates = {
      line_items: lines,
      total_ht: totals.totalHt,
      total_vat: totals.totalVat,
      total_ttc: totals.totalTtc,
      expiry_date: expiryDate,
      sale_type: saleType,
      rights_transfer_enabled: rightsEnabled,
      rights_transfer_rate: rightsEnabled ? rightsRate : null,
      rights_transfer_amount: rightsEnabled ? totals.rightsAmount : null,
      status: "generated" as const,
    };
    const updated = await updateMutation.mutateAsync({
      id: quote.id,
      updates,
    });
    return updated;
  };

  const handleDownloadPdf = async () => {
    const updated = await handleSave();
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - 2 * margin;
      let y = 15;

      // ── HEADER: Company info (left) + Quote number (right) ──
      // Yellow accent bar at top
      doc.setFillColor(230, 188, 0); // SuperTilt yellow #e6bc00
      doc.rect(0, 0, pageW, 4, "F");

      y = 14;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(settings?.company_name || "SuperTilt", margin, y);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      y += 6;
      doc.text(`${settings?.company_address || ""}, ${settings?.company_zip || ""} ${settings?.company_city || ""}`, margin, y);
      y += 4;
      if (settings?.company_phone) { doc.text(`Tél : ${settings.company_phone}`, margin, y); y += 4; }
      if (settings?.company_email) { doc.text(`Email : ${settings.company_email}`, margin, y); y += 4; }
      if (settings?.siren) { doc.text(`SIREN : ${settings.siren}`, margin, y); y += 4; }
      if (settings?.vat_number) { doc.text(`TVA : ${settings.vat_number}`, margin, y); y += 4; }
      if (settings?.rcs_number) { doc.text(`RCS ${settings.rcs_city} ${settings.rcs_number}`, margin, y); y += 4; }

      // Quote number box (right side)
      const boxW = 65;
      const boxX = pageW - margin - boxW;
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(boxX, 10, boxW, 28, 2, 2, "F");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.text("DEVIS", boxX + boxW / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(updated.quote_number, boxX + boxW / 2, 26, { align: "center" });
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Du ${updated.issue_date}`, boxX + boxW / 2, 32, { align: "center" });
      doc.text(`Valide jusqu'au ${updated.expiry_date}`, boxX + boxW / 2, 36, { align: "center" });

      y = Math.max(y, 46) + 4;

      // ── CLIENT BOX ──
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(220);
      doc.roundedRect(pageW / 2, y, contentW / 2, 30, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100);
      doc.text("DESTINATAIRE", pageW / 2 + 5, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30);
      doc.setFontSize(9);
      doc.text(updated.client_company, pageW / 2 + 5, y + 12);
      doc.setFontSize(8);
      doc.setTextColor(80);
      doc.text(updated.client_address, pageW / 2 + 5, y + 17);
      doc.text(`${updated.client_zip} ${updated.client_city}`, pageW / 2 + 5, y + 22);
      if (updated.client_siren) doc.text(`SIREN : ${updated.client_siren}`, pageW / 2 + 5, y + 27);

      y += 36;

      // ── TABLE ──
      const cols = [
        { header: "Désignation", x: margin, w: contentW * 0.40 },
        { header: "Qté", x: margin + contentW * 0.40, w: contentW * 0.08 },
        { header: "Unité", x: margin + contentW * 0.48, w: contentW * 0.10 },
        { header: "PU HT", x: margin + contentW * 0.58, w: contentW * 0.14 },
        { header: "TVA", x: margin + contentW * 0.72, w: contentW * 0.10 },
        { header: "Total HT", x: margin + contentW * 0.82, w: contentW * 0.18 },
      ];

      // Table header
      doc.setFillColor(50, 50, 50);
      doc.rect(margin, y, contentW, 8, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255);
      for (const col of cols) {
        const align = col.header === "Désignation" ? "left" : "right";
        const textX = align === "left" ? col.x + 3 : col.x + col.w - 3;
        doc.text(col.header, textX, y + 5.5, { align } as any);
      }
      y += 8;

      // Table rows
      const allLines = updated.line_items || [];
      doc.setFont("helvetica", "normal");
      for (let idx = 0; idx < allLines.length; idx++) {
        const line = allLines[idx];
        const lineHt = line.quantity * line.unit_price_ht;

        // Alternate row background
        if (idx % 2 === 0) {
          doc.setFillColor(248, 248, 248);
          doc.rect(margin, y, contentW, 10, "F");
        }

        // Product name
        doc.setFontSize(8);
        doc.setTextColor(30);
        doc.setFont("helvetica", "bold");
        doc.text(line.product || "", cols[0].x + 3, y + 4.5, { maxWidth: cols[0].w - 6 });

        // Description (smaller, below product)
        if (line.description) {
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(120);
          const descLines = doc.splitTextToSize(line.description, cols[0].w - 6);
          const descText = descLines.slice(0, 2).join("\n");
          doc.text(descText, cols[0].x + 3, y + 8);
        }

        // Numbers
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30);
        doc.text(String(line.quantity), cols[1].x + cols[1].w - 3, y + 4.5, { align: "right" });
        doc.text(line.unit || "", cols[2].x + cols[2].w - 3, y + 4.5, { align: "right" });
        doc.text(fmt(line.unit_price_ht), cols[3].x + cols[3].w - 3, y + 4.5, { align: "right" });
        doc.text(`${line.vat_rate}%`, cols[4].x + cols[4].w - 3, y + 4.5, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.text(fmt(lineHt), cols[5].x + cols[5].w - 3, y + 4.5, { align: "right" });

        const rowH = line.description ? 14 : 10;
        y += rowH;
        if (y > pageH - 60) { doc.addPage(); y = 15; }
      }

      // Table bottom line
      doc.setDrawColor(50);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentW, y);

      // ── TOTALS BOX ──
      y += 6;
      const totX = pageW - margin - 80;

      // Rights transfer
      if (updated.rights_transfer_enabled && updated.rights_transfer_amount) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text("Cession de droits", totX, y);
        doc.text(fmt(updated.rights_transfer_amount), pageW - margin, y, { align: "right" });
        y += 5;
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      doc.text("Total HT", totX, y);
      doc.setTextColor(30);
      doc.text(fmt(updated.total_ht || 0), pageW - margin, y, { align: "right" });
      y += 5;

      if (!settings?.vat_exempt) {
        doc.setTextColor(60);
        doc.text("Total TVA", totX, y);
        doc.setTextColor(30);
        doc.text(fmt(updated.total_vat || 0), pageW - margin, y, { align: "right" });
        y += 6;
      }

      // Total TTC with background
      doc.setFillColor(230, 188, 0);
      doc.roundedRect(totX - 5, y - 4, pageW - margin - totX + 10, 12, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.text("Total TTC", totX, y + 4);
      doc.text(
        fmt(settings?.vat_exempt ? (updated.total_ht || 0) : (updated.total_ttc || 0)),
        pageW - margin, y + 4, { align: "right" }
      );

      // ── FOOTER: Legal mentions ──
      if (settings) {
        y += 20;
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120);
        const mentions: string[] = [];
        if (settings.payment_terms_text) mentions.push(`Conditions de règlement : ${settings.payment_terms_text}`);
        if (settings.early_payment_discount) mentions.push(`Escompte : ${settings.early_payment_discount}`);
        if (settings.late_penalty_text) mentions.push(`Pénalités de retard : ${settings.late_penalty_text}`);
        mentions.push(`Indemnité forfaitaire de recouvrement : ${fmt(settings.recovery_indemnity_amount)} €`);
        if (settings.training_declaration_number) mentions.push(`N° déclaration d'activité : ${settings.training_declaration_number}`);
        if (settings.vat_exempt && settings.vat_exempt_text) mentions.push(settings.vat_exempt_text);
        if (settings.insurance_name) mentions.push(`Assurance RC Pro : ${settings.insurance_name} — Police n° ${settings.insurance_policy_number}`);
        
        // Signature area
        y += 2;
        doc.setDrawColor(200);
        doc.line(margin, y, margin + contentW, y);
        y += 3;
        
        for (const m of mentions) {
          if (y > pageH - 10) { doc.addPage(); y = 15; }
          doc.text(m, margin, y);
          y += 3.5;
        }

        // Signature block
        if (y < pageH - 40) {
          y = Math.max(y + 10, pageH - 50);
          doc.setFontSize(8);
          doc.setTextColor(80);
          doc.text("Bon pour accord — Date et signature du client :", margin, y);
          doc.setDrawColor(200);
          doc.rect(margin, y + 3, 80, 25);
        }
      }

      doc.save(`${updated.quote_number}.pdf`);
      toast.success("PDF téléchargé");
    } catch (e: any) {
      console.error("PDF generation error:", e);
      toast.error("Erreur lors de la génération du PDF : " + (e.message || "inconnue"));
    }
    onContinue(updated);
  };

  const handleContinue = async () => {
    const updated = await handleSave();
    onContinue(updated);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Devis {quote.quote_number}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={generateLines}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Régénérer les lignes
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date d'expiration</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de vente</Label>
              <Input
                value={saleType}
                onChange={(e) => setSaleType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date d'émission</Label>
              <Input value={quote.issue_date} disabled />
            </div>
          </div>

          {travelTotal > 0 && (
            <div className="bg-accent/50 border border-accent rounded-lg p-3 text-sm">
              <span className="font-medium">Frais de déplacement inclus :</span>{" "}
              <span className="font-bold">{fmt(travelTotal)}</span>
              <span className="text-muted-foreground ml-2">(ajoutés automatiquement comme ligne)</span>
            </div>
          )}

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <div className="text-center space-y-1">
                <p className="font-medium">Génération automatique du devis...</p>
                <p className="text-sm text-muted-foreground">
                  L'IA analyse la synthèse et vos instructions pour positionner les prestations et les prix
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Line items — card layout for readability */}
              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div key={line.id} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground bg-muted rounded px-2 py-0.5">
                            Ligne {idx + 1}
                          </span>
                        </div>
                        <Input
                          value={line.product}
                          onChange={(e) => updateLine(line.id, "product", e.target.value)}
                          placeholder="Intitulé de la prestation"
                          className="font-medium text-base"
                        />
                        <Textarea
                          value={line.description}
                          onChange={(e) => updateLine(line.id, "description", e.target.value)}
                          placeholder="Description détaillée"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        className="text-destructive shrink-0 mt-6"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Quantité</Label>
                        <Input
                          type="number"
                          min={0}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, "quantity", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Unité</Label>
                        <Input
                          value={line.unit || defaultUnit}
                          onChange={(e) => updateLine(line.id, "unit", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Prix unitaire HT</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.unit_price_ht}
                          onChange={(e) => updateLine(line.id, "unit_price_ht", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">TVA %</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.vat_rate}
                          onChange={(e) => updateLine(line.id, "vat_rate", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Total HT</Label>
                        <div className="h-9 flex items-center px-3 bg-muted rounded-md font-semibold text-sm">
                          {fmt(line.quantity * line.unit_price_ht)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addLine} className="gap-2">
                <Plus className="w-4 h-4" />
                Ajouter une ligne
              </Button>

              {/* Rights transfer */}
              {settings?.rights_transfer_enabled && (
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rightsEnabled}
                      onChange={(e) => setRightsEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span className="font-medium">Cession de droits</span>
                  </label>
                  {rightsEnabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={rightsRate}
                        onChange={(e) => setRightsRate(parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        % du HT = {fmt(totals.rightsAmount)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Totals summary */}
              <div className="border rounded-lg p-5 space-y-3 bg-card">
                {settings?.vat_exempt && (
                  <div className="text-sm font-medium text-amber-700 bg-amber-50 p-2 rounded">
                    {settings.vat_exempt_text}
                  </div>
                )}
                {!settings?.vat_exempt && Object.entries(totals.vatGroups).map(([rate, g]) => (
                  <div key={rate} className="flex justify-between text-sm text-muted-foreground">
                    <span>TVA {rate}%</span>
                    <span>Base HT : {fmt(g.ht)} — TVA : {fmt(g.vat)}</span>
                  </div>
                ))}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-base font-medium">
                    <span>Total HT</span>
                    <span>{fmt(totals.totalHt)}</span>
                  </div>
                  {!settings?.vat_exempt && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Total TVA</span>
                      <span>{fmt(totals.totalVat)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold pt-1 border-t">
                    <span>Total TTC</span>
                    <span className="text-primary">
                      {fmt(settings?.vat_exempt ? totals.totalHt : totals.totalTtc)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Legal mentions preview */}
              {settings && (
                <div className="border rounded-lg p-4 space-y-3 text-xs text-muted-foreground">
                  <h4 className="font-medium text-sm text-foreground">Mentions du devis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {settings.payment_terms_text && (
                      <p><span className="font-medium">Conditions de règlement :</span> {settings.payment_terms_text}</p>
                    )}
                    {settings.early_payment_discount && (
                      <p><span className="font-medium">Escompte :</span> {settings.early_payment_discount}</p>
                    )}
                    {settings.late_penalty_text && (
                      <p><span className="font-medium">Pénalités de retard :</span> {settings.late_penalty_text}</p>
                    )}
                    <p><span className="font-medium">Indemnité forfaitaire de recouvrement :</span> {fmt(settings.recovery_indemnity_amount)}</p>
                    {settings.training_declaration_number && (
                      <p><span className="font-medium">N° déclaration d'activité :</span> {settings.training_declaration_number}</p>
                    )}
                    {settings.rcs_number && (
                      <p><span className="font-medium">RCS :</span> {settings.rcs_city} {settings.rcs_number}</p>
                    )}
                    {settings.insurance_name && (
                      <p><span className="font-medium">Assurance :</span> {settings.insurance_name} — Police n° {settings.insurance_policy_number}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleDownloadPdf}
          disabled={updateMutation.isPending || lines.length === 0}
          className="gap-2"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          Télécharger le PDF
        </Button>
        <Button
          onClick={handleContinue}
          disabled={updateMutation.isPending || lines.length === 0}
          size="lg"
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}
