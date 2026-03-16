import { useState, useEffect } from "react";
import { useQuoteSettings, useUpdateQuoteSettings } from "@/hooks/useQuotes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Building2, CreditCard, Scale, FileText } from "lucide-react";
import { toast } from "sonner";
import type { QuoteSettings } from "@/types/quotes";

export default function QuoteSettingsForm() {
  const { data: settings, isLoading } = useQuoteSettings();
  const updateMutation = useUpdateQuoteSettings();
  const [form, setForm] = useState<Partial<QuoteSettings>>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const set = (key: keyof QuoteSettings, value: QuoteSettings[keyof QuoteSettings]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    try {
      const { id, created_at, updated_at, ...updates } = form as QuoteSettings;
      await updateMutation.mutateAsync(updates);
      toast.success("Paramètres du module devis enregistrés");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Émetteur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5" />
            Données émetteur
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Raison sociale</Label>
            <Input
              value={form.company_name || ""}
              onChange={(e) => set("company_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email de contact</Label>
            <Input
              type="email"
              value={form.company_email || ""}
              onChange={(e) => set("company_email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Adresse</Label>
            <Input
              value={form.company_address || ""}
              onChange={(e) => set("company_address", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input
              value={form.company_phone || ""}
              onChange={(e) => set("company_phone", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Code postal</Label>
            <Input
              value={form.company_zip || ""}
              onChange={(e) => set("company_zip", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Ville</Label>
            <Input
              value={form.company_city || ""}
              onChange={(e) => set("company_city", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Paramètres du devis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            Paramètres du devis
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Préfixe de numérotation</Label>
            <Input
              value={form.quote_prefix || ""}
              onChange={(e) => set("quote_prefix", e.target.value)}
              placeholder="D"
            />
          </div>
          <div className="space-y-2">
            <Label>Prochain numéro de séquence</Label>
            <Input
              type="number"
              min={1}
              value={form.next_sequence_number || 1}
              onChange={(e) =>
                set("next_sequence_number", parseInt(e.target.value) || 1)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Durée de validité par défaut (jours)</Label>
            <Input
              type="number"
              min={1}
              value={form.default_validity_days || 30}
              onChange={(e) =>
                set("default_validity_days", parseInt(e.target.value) || 30)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Taux de TVA par défaut (%)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.default_vat_rate || 20}
              onChange={(e) =>
                set("default_vat_rate", parseFloat(e.target.value) || 20)
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Type de vente par défaut</Label>
            <Input
              value={form.default_sale_type || ""}
              onChange={(e) => set("default_sale_type", e.target.value)}
              placeholder="Prestation de services"
            />
          </div>
        </CardContent>
      </Card>

      {/* Conditions de paiement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5" />
            Conditions de paiement
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Texte pénalités de retard</Label>
            <Textarea
              value={form.late_penalty_text || ""}
              onChange={(e) => set("late_penalty_text", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Indemnité forfaitaire de recouvrement (€)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.recovery_indemnity_amount || 40}
              onChange={(e) =>
                set(
                  "recovery_indemnity_amount",
                  parseFloat(e.target.value) || 40
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Établissement bancaire</Label>
            <Input
              value={form.bank_name || ""}
              onChange={(e) => set("bank_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>IBAN</Label>
            <Input
              value={form.bank_iban || ""}
              onChange={(e) => set("bank_iban", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>BIC</Label>
            <Input
              value={form.bank_bic || ""}
              onChange={(e) => set("bank_bic", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mentions légales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="w-5 h-5" />
            Mentions légales
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Forme juridique</Label>
            <Input
              value={form.legal_form || ""}
              onChange={(e) => set("legal_form", e.target.value)}
              placeholder="SAS, SARL, etc."
            />
          </div>
          <div className="space-y-2">
            <Label>Capital social</Label>
            <Input
              value={form.share_capital || ""}
              onChange={(e) => set("share_capital", e.target.value)}
              placeholder="10 000 €"
            />
          </div>
          <div className="space-y-2">
            <Label>N° SIREN</Label>
            <Input
              value={form.siren || ""}
              onChange={(e) => set("siren", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>N° TVA intracommunautaire</Label>
            <Input
              value={form.vat_number || ""}
              onChange={(e) => set("vat_number", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>N° RCS</Label>
            <Input
              value={form.rcs_number || ""}
              onChange={(e) => set("rcs_number", e.target.value)}
              placeholder="123 456 789"
            />
          </div>
          <div className="space-y-2">
            <Label>Ville du RCS</Label>
            <Input
              value={form.rcs_city || ""}
              onChange={(e) => set("rcs_city", e.target.value)}
              placeholder="Paris"
            />
          </div>
          <div className="space-y-2">
            <Label>Code APE / NAF</Label>
            <Input
              value={form.ape_code || ""}
              onChange={(e) => set("ape_code", e.target.value)}
              placeholder="8559A"
            />
          </div>
          <div className="space-y-2">
            <Label>N° de déclaration d'activité (NDA)</Label>
            <Input
              value={form.training_declaration_number || ""}
              onChange={(e) => set("training_declaration_number", e.target.value)}
              placeholder="11 75 XXXXX 75"
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch
              checked={form.vat_exempt ?? false}
              onCheckedChange={(v) => set("vat_exempt", v)}
            />
            <Label>TVA non applicable (art. 293 B du CGI)</Label>
          </div>
          {form.vat_exempt && (
            <div className="space-y-2 md:col-span-2">
              <Label>Mention d'exonération de TVA</Label>
              <Input
                value={form.vat_exempt_text || ""}
                onChange={(e) => set("vat_exempt_text", e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conditions de règlement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conditions de règlement</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Délai de paiement (jours)</Label>
            <Input
              type="number"
              min={0}
              value={form.payment_terms_days || 30}
              onChange={(e) => set("payment_terms_days", parseInt(e.target.value) || 30)}
            />
          </div>
          <div className="space-y-2">
            <Label>Modes de paiement acceptés</Label>
            <Input
              value={form.payment_methods || ""}
              onChange={(e) => set("payment_methods", e.target.value)}
              placeholder="Virement bancaire"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Conditions de paiement (texte complet)</Label>
            <Textarea
              value={form.payment_terms_text || ""}
              onChange={(e) => set("payment_terms_text", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Escompte pour paiement anticipé</Label>
            <Input
              value={form.early_payment_discount || ""}
              onChange={(e) => set("early_payment_discount", e.target.value)}
              placeholder="Pas d'escompte pour paiement anticipé"
            />
          </div>
          <div className="space-y-2">
            <Label>Unité par défaut (lignes de prestation)</Label>
            <Input
              value={form.default_unit || ""}
              onChange={(e) => set("default_unit", e.target.value)}
              placeholder="jour, heure, forfait..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Assurance professionnelle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assurance professionnelle</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom de l'assureur</Label>
            <Input
              value={form.insurance_name || ""}
              onChange={(e) => set("insurance_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>N° de police</Label>
            <Input
              value={form.insurance_policy_number || ""}
              onChange={(e) => set("insurance_policy_number", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Zone de couverture</Label>
            <Input
              value={form.insurance_coverage_zone || ""}
              onChange={(e) => set("insurance_coverage_zone", e.target.value)}
              placeholder="France"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cession de droits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cession de droits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.rights_transfer_enabled ?? true}
              onCheckedChange={(v) => set("rights_transfer_enabled", v)}
            />
            <Label>Activer par défaut dans les devis</Label>
          </div>
          <div className="space-y-2">
            <Label>Taux de cession (% du HT)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.rights_transfer_rate || 15}
              onChange={(e) =>
                set("rights_transfer_rate", parseFloat(e.target.value) || 15)
              }
              className="max-w-[200px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Clause de cession de droits</Label>
            <Textarea
              value={form.rights_transfer_clause || ""}
              onChange={(e) => set("rights_transfer_clause", e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="gap-2"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
