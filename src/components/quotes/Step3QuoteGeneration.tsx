import { useState, useEffect, useMemo } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
          },
        }
      );
      if (error) throw error;
      if (data?.lines?.length > 0) {
        setLines(
          data.lines.map((l: any) => ({
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
          }))
        );
        if (data.sale_type_suggestion && !saleType) {
          setSaleType(data.sale_type_suggestion);
        }
      }
    } catch (e: any) {
      console.error("Line generation error:", e);
      if (lines.length === 0) {
        setLines([emptyLine(defaultVat, defaultUnit)]);
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
      // Use client-side jsPDF for reliable PDF generation
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Header
      doc.setFontSize(10);
      doc.setTextColor(100);
      if (settings) {
        doc.text(settings.company_name || "", margin, y);
        y += 5;
        doc.text(`${settings.company_address || ""}, ${settings.company_zip || ""} ${settings.company_city || ""}`, margin, y);
        y += 5;
        if (settings.siren) doc.text(`SIREN : ${settings.siren}`, margin, y);
        y += 5;
        if (settings.vat_number) doc.text(`TVA : ${settings.vat_number}`, margin, y);
        y += 10;
      }

      // Quote number
      doc.setFontSize(18);
      doc.setTextColor(0);
      doc.text(`Devis ${updated.quote_number}`, margin, y);
      y += 10;

      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Date d'émission : ${updated.issue_date}`, margin, y);
      doc.text(`Validité : ${updated.expiry_date}`, pageW - margin - 60, y);
      y += 8;

      // Client
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text("Client :", margin, y);
      y += 5;
      doc.setTextColor(60);
      doc.text(updated.client_company, margin, y); y += 4;
      doc.text(`${updated.client_address}`, margin, y); y += 4;
      doc.text(`${updated.client_zip} ${updated.client_city}`, margin, y); y += 4;
      if (updated.client_siren) { doc.text(`SIREN : ${updated.client_siren}`, margin, y); y += 4; }
      y += 6;

      // Table header
      const colX = [margin, margin + 55, margin + 95, margin + 115, margin + 135, margin + 155];
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 1, pageW - 2 * margin, 7, "F");
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text("Produit / Description", colX[0], y + 4);
      doc.text("Qté", colX[1], y + 4);
      doc.text("Unité", colX[2], y + 4);
      doc.text("PU HT", colX[3], y + 4);
      doc.text("TVA", colX[4], y + 4);
      doc.text("Total HT", colX[5], y + 4);
      y += 10;

      // Lines
      const lines = updated.line_items || [];
      for (const line of lines) {
        const lineHt = line.quantity * line.unit_price_ht;
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(line.product || "", colX[0], y);
        doc.text(String(line.quantity), colX[1], y);
        doc.text(line.unit || "", colX[2], y);
        doc.text(fmt(line.unit_price_ht), colX[3], y);
        doc.text(`${line.vat_rate}%`, colX[4], y);
        doc.text(fmt(lineHt), colX[5], y);
        y += 5;
        if (line.description) {
          doc.setFontSize(7);
          doc.setTextColor(120);
          const descLines = doc.splitTextToSize(line.description, 50);
          doc.text(descLines, colX[0], y);
          y += descLines.length * 3.5;
        }
        y += 2;
        if (y > 260) { doc.addPage(); y = 20; }
      }

      // Totals
      y += 5;
      doc.setDrawColor(200);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text("Total HT :", pageW - margin - 60, y);
      doc.text(fmt(updated.total_ht || 0), pageW - margin, y, { align: "right" });
      y += 6;
      if (!settings?.vat_exempt) {
        doc.text("Total TVA :", pageW - margin - 60, y);
        doc.text(fmt(updated.total_vat || 0), pageW - margin, y, { align: "right" });
        y += 6;
      }
      doc.setFontSize(12);
      doc.text("Total TTC :", pageW - margin - 60, y);
      doc.text(fmt(settings?.vat_exempt ? (updated.total_ht || 0) : (updated.total_ttc || 0)), pageW - margin, y, { align: "right" });

      // Footer mentions
      if (settings) {
        y += 15;
        doc.setFontSize(7);
        doc.setTextColor(120);
        const mentions = [];
        if (settings.payment_terms_text) mentions.push(`Conditions de règlement : ${settings.payment_terms_text}`);
        if (settings.late_penalty_text) mentions.push(`Pénalités de retard : ${settings.late_penalty_text}`);
        mentions.push(`Indemnité forfaitaire de recouvrement : ${fmt(settings.recovery_indemnity_amount)} €`);
        if (settings.training_declaration_number) mentions.push(`N° déclaration d'activité : ${settings.training_declaration_number}`);
        if (settings.vat_exempt && settings.vat_exempt_text) mentions.push(settings.vat_exempt_text);
        for (const m of mentions) {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(m, margin, y);
          y += 3.5;
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
              {/* Line items table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Produit</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="w-20">Qté</TableHead>
                      <TableHead className="w-24">Unité</TableHead>
                      <TableHead className="w-32">Prix u. HT</TableHead>
                      <TableHead className="w-24">TVA %</TableHead>
                      <TableHead className="w-32 text-right">Total HT</TableHead>
                      <TableHead className="w-32 text-right">Total TTC</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Input
                            value={line.product}
                            onChange={(e) =>
                              updateLine(line.id, "product", e.target.value)
                            }
                            placeholder="Intitulé"
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={line.description}
                            onChange={(e) =>
                              updateLine(line.id, "description", e.target.value)
                            }
                            placeholder="Description"
                            rows={2}
                            className="min-h-[60px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                "quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.unit || defaultUnit}
                            onChange={(e) =>
                              updateLine(line.id, "unit", e.target.value)
                            }
                            placeholder="jour"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unit_price_ht}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                "unit_price_ht",
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.vat_rate}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                "vat_rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(line.quantity * line.unit_price_ht)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(
                            line.quantity *
                              line.unit_price_ht *
                              (1 + line.vat_rate / 100)
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(line.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                        onChange={(e) =>
                          setRightsRate(parseFloat(e.target.value) || 0)
                        }
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
              <div className="border rounded-lg p-4 space-y-2">
                {settings?.vat_exempt && (
                  <div className="text-sm font-medium text-amber-700 bg-amber-50 p-2 rounded">
                    {settings.vat_exempt_text}
                  </div>
                )}
                {!settings?.vat_exempt && Object.entries(totals.vatGroups).map(([rate, g]) => (
                  <div key={rate} className="flex justify-between text-sm">
                    <span>TVA {rate}%</span>
                    <span>Base HT: {fmt(g.ht)} — TVA: {fmt(g.vat)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Total HT</span>
                    <span>{fmt(totals.totalHt)}</span>
                  </div>
                  {!settings?.vat_exempt && (
                    <div className="flex justify-between text-sm">
                      <span>Total TVA</span>
                      <span>{fmt(totals.totalVat)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total TTC</span>
                    <span>{fmt(settings?.vat_exempt ? totals.totalHt : totals.totalTtc)}</span>
                  </div>
                </div>
              </div>

              {/* Conditions & mentions légales (preview) */}
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
