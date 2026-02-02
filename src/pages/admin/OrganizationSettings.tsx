import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, Palette, Globe, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  settings: {
    website?: string;
    address?: string;
    phone?: string;
    siret?: string;
    nda?: string; // Numéro de déclaration d'activité
    qualiopi_number?: string;
    default_vouvoiement?: boolean;
    signature_resend_email?: string;
    bcc_email?: string;
  };
  created_at: string;
}

const OrganizationSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    logo_url: "",
    primary_color: "#6366f1",
    website: "",
    address: "",
    phone: "",
    siret: "",
    nda: "",
    qualiopi_number: "",
    signature_resend_email: "",
    bcc_email: "",
  });

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (!profile?.organization_id) {
          setLoading(false);
          return;
        }

        const { data: org, error } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", profile.organization_id)
          .single();

        if (error) throw error;

        setOrganization(org);
        setFormData({
          name: org.name,
          slug: org.slug,
          logo_url: org.logo_url || "",
          primary_color: org.primary_color || "#6366f1",
          website: org.settings?.website || "",
          address: org.settings?.address || "",
          phone: org.settings?.phone || "",
          siret: org.settings?.siret || "",
          nda: org.settings?.nda || "",
          qualiopi_number: org.settings?.qualiopi_number || "",
          signature_resend_email: org.settings?.signature_resend_email || "",
          bcc_email: org.settings?.bcc_email || "",
        });
      } catch (error) {
        console.error("Error fetching organization:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, []);

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: formData.name,
          slug: formData.slug,
          logo_url: formData.logo_url || null,
          primary_color: formData.primary_color,
          settings: {
            website: formData.website || null,
            address: formData.address || null,
            phone: formData.phone || null,
            siret: formData.siret || null,
            nda: formData.nda || null,
            qualiopi_number: formData.qualiopi_number || null,
            signature_resend_email: formData.signature_resend_email || null,
            bcc_email: formData.bcc_email || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Paramètres enregistrés",
        description: "Les modifications ont été sauvegardées.",
      });
    } catch (error) {
      console.error("Error saving organization:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les modifications.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!organization) {
    return (
      <AdminLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Aucune organisation trouvée.
            </p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Paramètres de l'organisation</h2>
            <p className="text-sm text-muted-foreground">
              Créée le {format(new Date(organization.created_at), "d MMMM yyyy", { locale: fr })}
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="hidden sm:flex">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>

        {/* General Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informations générales
            </CardTitle>
            <CardDescription>
              Ces informations apparaissent sur vos documents et emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l'organisation *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Mon organisme de formation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Identifiant (slug) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  placeholder="mon-organisme"
                />
                <p className="text-xs text-muted-foreground">
                  Utilisé dans les URLs. Lettres minuscules et tirets uniquement.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="01 23 45 67 89"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Site web</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://www.example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 rue de la Formation, 75001 Paris"
              />
            </div>
          </CardContent>
        </Card>

        {/* Legal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Informations légales (Qualiopi)
            </CardTitle>
            <CardDescription>
              Ces informations sont utilisées pour la conformité réglementaire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET</Label>
                <Input
                  id="siret"
                  value={formData.siret}
                  onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                  placeholder="123 456 789 00012"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nda">N° de déclaration d'activité (NDA)</Label>
                <Input
                  id="nda"
                  value={formData.nda}
                  onChange={(e) => setFormData({ ...formData, nda: e.target.value })}
                  placeholder="11 75 12345 67"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qualiopi">N° de certification Qualiopi</Label>
              <Input
                id="qualiopi"
                value={formData.qualiopi_number}
                onChange={(e) => setFormData({ ...formData, qualiopi_number: e.target.value })}
                placeholder="QUAL/2024/12345"
              />
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Personnalisation
            </CardTitle>
            <CardDescription>
              Personnalisez l'apparence de vos documents et emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logo">URL du logo</Label>
                <Input
                  id="logo"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Format recommandé : PNG ou SVG, fond transparent
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Couleur principale</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    placeholder="#6366f1"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            {formData.logo_url && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Aperçu du logo :</p>
                <img
                  src={formData.logo_url}
                  alt="Logo preview"
                  className="max-h-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration des emails</CardTitle>
            <CardDescription>
              Paramètres avancés pour l'envoi des emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signature_email">Email signature (Resend/Signitic)</Label>
                <Input
                  id="signature_email"
                  type="email"
                  value={formData.signature_resend_email}
                  onChange={(e) => setFormData({ ...formData, signature_resend_email: e.target.value })}
                  placeholder="contact@votre-domaine.fr"
                />
                <p className="text-xs text-muted-foreground">
                  Email utilisé pour la signature automatique Signitic
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bcc_email">Email en copie cachée (BCC)</Label>
                <Input
                  id="bcc_email"
                  type="email"
                  value={formData.bcc_email}
                  onChange={(e) => setFormData({ ...formData, bcc_email: e.target.value })}
                  placeholder="archive@votre-domaine.fr"
                />
                <p className="text-xs text-muted-foreground">
                  Recevra une copie de tous les emails envoyés
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button (mobile) */}
        <div className="md:hidden">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Enregistrer les modifications
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default OrganizationSettings;
