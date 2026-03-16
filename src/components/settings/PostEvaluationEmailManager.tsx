import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Mail, Copy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CatalogEntry {
  id: string;
  formation_name: string;
}

interface PostEvalEmail {
  id: string;
  catalog_id: string | null;
  subject: string;
  html_content: string;
  is_active: boolean;
}

const PostEvaluationEmailManager = () => {
  const [emails, setEmails] = useState<PostEvalEmail[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    const [emailsResult, catalogResult] = await Promise.all([
      supabase
        .from("post_evaluation_emails")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("formation_configs")
        .select("id, formation_name")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

    if (!emailsResult.error) {
      setEmails((emailsResult.data || []).map((e: any) => ({
        id: e.id,
        catalog_id: e.catalog_id,
        subject: e.subject,
        html_content: e.html_content,
        is_active: e.is_active,
      })));
    }
    if (!catalogResult.error) {
      setCatalogEntries(catalogResult.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEmails(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        catalog_id: null,
        subject: "",
        html_content: "",
        is_active: true,
      },
    ]);
  };

  const handleChange = (id: string, field: keyof PostEvalEmail, value: string | boolean | null) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleSave = async (email: PostEvalEmail) => {
    if (!email.catalog_id || !email.subject.trim() || !email.html_content.trim()) {
      toast({ title: "Erreur", description: "Tous les champs sont obligatoires (formation, sujet, contenu).", variant: "destructive" });
      return;
    }

    setSaving(email.id);

    const payload = {
      catalog_id: email.catalog_id,
      subject: email.subject.trim(),
      html_content: email.html_content.trim(),
      is_active: email.is_active,
    };

    if (email.id.startsWith("new-")) {
      const { data, error } = await supabase.from("post_evaluation_emails").insert(payload).select().single();
      if (error) {
        toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
      } else {
        setEmails(prev => prev.map(e => e.id === email.id ? {
          id: data.id,
          catalog_id: data.catalog_id,
          subject: data.subject,
          html_content: data.html_content,
          is_active: data.is_active,
        } : e));
        const catName = catalogEntries.find(c => c.id === email.catalog_id)?.formation_name || "";
        toast({ title: "Créé", description: `Email post-évaluation pour "${catName}" ajouté.` });
      }
    } else {
      const { error } = await supabase.from("post_evaluation_emails").update(payload).eq("id", email.id);
      if (error) {
        toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
      } else {
        const catName = catalogEntries.find(c => c.id === email.catalog_id)?.formation_name || "";
        toast({ title: "Sauvegardé", description: `Email post-évaluation pour "${catName}" mis à jour.` });
      }
    }

    setSaving(null);
  };

  const handleDuplicate = (email: PostEvalEmail) => {
    setEmails(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        catalog_id: email.catalog_id,
        subject: email.subject,
        html_content: email.html_content,
        is_active: email.is_active,
      },
    ]);
    toast({ title: "Dupliqué", description: "Email dupliqué. Pensez à le sauvegarder." });
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith("new-")) {
      setEmails(prev => prev.filter(e => e.id !== id));
      return;
    }

    const { error } = await supabase.from("post_evaluation_emails").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    } else {
      setEmails(prev => prev.filter(e => e.id !== id));
      toast({ title: "Supprimé", description: "Email post-évaluation supprimé." });
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Emails post-évaluation
            </CardTitle>
            <CardDescription>
              Emails envoyés automatiquement après la soumission d'une évaluation, selon la formation du catalogue.
              Variables disponibles : {"{{first_name}}"}, {"{{training_name}}"}.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {emails.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun email post-évaluation configuré. Cliquez sur "Ajouter" pour en créer un.
          </p>
        )}

        {emails.map((email) => (
          <div key={email.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={email.is_active}
                  onCheckedChange={(v) => handleChange(email.id, "is_active", v)}
                />
                <span className="text-sm font-medium">
                  {email.is_active ? "Actif" : "Désactivé"}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSave(email)}
                  disabled={saving === email.id}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saving === email.id ? "..." : "Sauvegarder"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDuplicate(email)}
                  title="Dupliquer"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(email.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Formation du catalogue</Label>
              <Select
                value={email.catalog_id || ""}
                onValueChange={(v) => handleChange(email.id, "catalog_id", v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une formation..." />
                </SelectTrigger>
                <SelectContent>
                  {catalogEntries.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.formation_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                L'email sera envoyé si la session est liée à cette formation du catalogue.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sujet de l'email</Label>
              <Input
                placeholder="Ex: Ton accès à la formation en ligne {{training_name}}"
                value={email.subject}
                onChange={(e) => handleChange(email.id, "subject", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Contenu de l'email (HTML)</Label>
              <Textarea
                placeholder="Contenu HTML de l'email..."
                value={email.html_content}
                onChange={(e) => handleChange(email.id, "html_content", e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Le contenu est inséré après la salutation et avant la signature. HTML supporté.
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default PostEvaluationEmailManager;
