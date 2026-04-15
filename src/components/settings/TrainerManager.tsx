import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Plus, Pencil, Trash2, Save, X, Upload, FileText, GraduationCap, Award, BookOpen, FolderOpen } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface FormationSuivie {
  titre: string;
  organisme: string;
  date: string;
  duree: string;
}

interface TrainerDocument {
  id: string;
  trainer_id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  created_at: string;
}

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  cv_url: string | null;
  is_default: boolean;
  competences: string[];
  diplomes_certifications: string | null;
  formations_suivies: FormationSuivie[];
}

export default function TrainerManager() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trainerToDelete, setTrainerToDelete] = useState<Trainer | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<TrainerDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [competences, setCompetences] = useState<string[]>([]);
  const [newCompetence, setNewCompetence] = useState("");
  const [diplomesCertifications, setDiplomesCertifications] = useState("");
  const [formationsSuivies, setFormationsSuivies] = useState<FormationSuivie[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    fetchTrainers();
  }, []);

  const fetchTrainers = async () => {
    try {
      const { data, error } = await supabase
        .from("trainers")
        .select("*")
        .order("is_default", { ascending: false })
        .order("last_name");

      if (error) throw error;
      setTrainers((data || []).map((t: any) => ({
        ...t,
        competences: t.competences || [],
        formations_suivies: t.formations_suivies || [],
      })));
    } catch (error) {
      console.error("Error fetching trainers:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les formateurs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (trainerId: string) => {
    const { data } = await supabase
      .from("trainer_documents")
      .select("*")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false });
    setDocuments(data || []);
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPhotoUrl("");
    setCvUrl("");
    setIsDefault(false);
    setCompetences([]);
    setNewCompetence("");
    setDiplomesCertifications("");
    setFormationsSuivies([]);
    setDocuments([]);
    setEditingTrainer(null);
  };

  const openDialog = (trainer?: Trainer) => {
    if (trainer) {
      setEditingTrainer(trainer);
      setFirstName(trainer.first_name);
      setLastName(trainer.last_name);
      setEmail(trainer.email);
      setPhone(trainer.phone || "");
      setPhotoUrl(trainer.photo_url || "");
      setCvUrl(trainer.cv_url || "");
      setIsDefault(trainer.is_default);
      setCompetences(trainer.competences || []);
      setDiplomesCertifications(trainer.diplomes_certifications || "");
      setFormationsSuivies(trainer.formations_suivies || []);
      fetchDocuments(trainer.id);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `trainer-${Date.now()}.${fileExt}`;
      const filePath = `trainers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("training-documents")
        .getPublicUrl(filePath);

      setPhotoUrl(urlData.publicUrl);
      toast({ title: "Photo uploadée" });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({ title: "Erreur", description: "Impossible d'uploader la photo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file || !editingTrainer) return;

    setUploadingDoc(true);
    try {
      const fileName = `trainer-doc-${Date.now()}_${file.name}`;
      const filePath = `trainers/docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("training-documents")
        .getPublicUrl(filePath);

      await supabase.from("trainer_documents").insert({
        trainer_id: editingTrainer.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        document_type: docType,
      });

      await fetchDocuments(editingTrainer.id);
      toast({ title: "Document ajouté" });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({ title: "Erreur", description: "Impossible d'uploader le document.", variant: "destructive" });
    } finally {
      setUploadingDoc(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    await supabase.from("trainer_documents").delete().eq("id", docId);
    if (editingTrainer) await fetchDocuments(editingTrainer.id);
    toast({ title: "Document supprimé" });
  };

  const handleAddCompetence = () => {
    const trimmed = newCompetence.trim();
    if (trimmed && !competences.includes(trimmed)) {
      setCompetences([...competences, trimmed]);
      setNewCompetence("");
    }
  };

  const handleRemoveCompetence = (comp: string) => {
    setCompetences(competences.filter((c) => c !== comp));
  };

  const handleAddFormation = () => {
    setFormationsSuivies([...formationsSuivies, { titre: "", organisme: "", date: "", duree: "" }]);
  };

  const handleUpdateFormation = (index: number, field: keyof FormationSuivie, value: string) => {
    const updated = [...formationsSuivies];
    updated[index] = { ...updated[index], [field]: value };
    setFormationsSuivies(updated);
  };

  const handleRemoveFormation = (index: number) => {
    setFormationsSuivies(formationsSuivies.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast({ title: "Champs requis", description: "Prénom, nom et email sont obligatoires.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (isDefault) {
        await supabase
          .from("trainers")
          .update({ is_default: false })
          .neq("id", editingTrainer?.id || "");
      }

      const trainerData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        photo_url: photoUrl || null,
        cv_url: cvUrl.trim() || null,
        is_default: isDefault,
        competences,
        diplomes_certifications: diplomesCertifications.trim() || null,
        formations_suivies: formationsSuivies.filter((f) => f.titre.trim()),
      };

      if (editingTrainer) {
        const { error } = await supabase
          .from("trainers")
          .update(trainerData as any)
          .eq("id", editingTrainer.id);
        if (error) throw error;
        toast({ title: "Formateur modifié" });
      } else {
        const { error } = await supabase.from("trainers").insert(trainerData as any);
        if (error) throw error;
        toast({ title: "Formateur ajouté" });
      }

      setDialogOpen(false);
      resetForm();
      fetchTrainers();
    } catch (error) {
      console.error("Error saving trainer:", error);
      toast({ title: "Erreur", description: "Impossible de sauvegarder le formateur.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!trainerToDelete) return;

    try {
      const { error } = await supabase
        .from("trainers")
        .delete()
        .eq("id", trainerToDelete.id);

      if (error) throw error;
      toast({ title: "Formateur supprimé" });
      setDeleteDialogOpen(false);
      setTrainerToDelete(null);
      fetchTrainers();
    } catch (error) {
      console.error("Error deleting trainer:", error);
      toast({ title: "Erreur", description: "Impossible de supprimer le formateur.", variant: "destructive" });
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getDocTypeLabel = (type: string) => {
    const labels: Record<string, string> = { cv: "CV", diplome: "Diplôme", certification: "Certification", autre: "Autre" };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Gestion des formateurs
              </CardTitle>
              <CardDescription className="mt-1">
                Gérez les formateurs, leurs compétences, diplômes et formations suivies (Indicateurs 21 & 22 Qualiopi).
              </CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un formateur
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {trainers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun formateur configuré.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {trainers.map((trainer) => (
                <div key={trainer.id} className="border rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={trainer.photo_url || undefined} />
                        <AvatarFallback>{getInitials(trainer.first_name, trainer.last_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{trainer.first_name} {trainer.last_name}</div>
                        {trainer.is_default && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Par défaut</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(trainer)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setTrainerToDelete(trainer); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{trainer.email}</div>
                    {trainer.phone && <div>{trainer.phone}</div>}
                  </div>
                  {trainer.competences && trainer.competences.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {trainer.competences.slice(0, 4).map((comp) => (
                        <Badge key={comp} variant="secondary" className="text-xs">{comp}</Badge>
                      ))}
                      {trainer.competences.length > 4 && (
                        <Badge variant="outline" className="text-xs">+{trainer.competences.length - 4}</Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTrainer ? "Modifier le formateur" : "Ajouter un formateur"}</DialogTitle>
            <DialogDescription>Renseignez les informations du formateur.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={photoUrl || undefined} />
                <AvatarFallback>{firstName && lastName ? getInitials(firstName, lastName) : "?"}</AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="photo-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                    {uploading ? <Spinner /> : <Upload className="h-4 w-4" />}
                    {photoUrl ? "Changer la photo" : "Ajouter une photo"}
                  </div>
                </Label>
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={uploading} />
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex: Romain" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ex: Couturier" />
              </div>
            </div>

            {/* Contact fields */}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex: email@exemple.fr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 06 12 34 56 78" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvUrl">Lien vers le CV</Label>
              <Input id="cvUrl" type="url" value={cvUrl} onChange={(e) => setCvUrl(e.target.value)} placeholder="https://..." />
            </div>

            {/* Default switch */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isDefault">Formateur par défaut</Label>
                <p className="text-sm text-muted-foreground">Sera pré-sélectionné lors de la création d'une formation</p>
              </div>
              <Switch id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
            </div>

            <Separator />

            {/* Compétences */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Compétences et domaines d'intervention
              </Label>
              <div className="flex flex-wrap gap-2">
                {competences.map((comp) => (
                  <Badge key={comp} variant="secondary" className="flex items-center gap-1">
                    {comp}
                    <button type="button" onClick={() => handleRemoveCompetence(comp)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newCompetence}
                  onChange={(e) => setNewCompetence(e.target.value)}
                  placeholder="Ajouter une compétence..."
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCompetence(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddCompetence} disabled={!newCompetence.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Diplômes et certifications */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Diplômes et certifications
              </Label>
              <Textarea
                value={diplomesCertifications}
                onChange={(e) => setDiplomesCertifications(e.target.value)}
                placeholder="Ex: Master 2 Management de l'innovation, Certification ICF ACC, ..."
                rows={3}
              />
            </div>

            <Separator />

            {/* Formations suivies (indicateur 22) */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Formations suivies (développement des compétences)
              </Label>
              {formationsSuivies.map((formation, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Formation {index + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFormation(index)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Titre de la formation" value={formation.titre} onChange={(e) => handleUpdateFormation(index, "titre", e.target.value)} />
                    <Input placeholder="Organisme" value={formation.organisme} onChange={(e) => handleUpdateFormation(index, "organisme", e.target.value)} />
                    <Input type="date" placeholder="Date" value={formation.date} onChange={(e) => handleUpdateFormation(index, "date", e.target.value)} />
                    <Input placeholder="Durée (ex: 14h)" value={formation.duree} onChange={(e) => handleUpdateFormation(index, "duree", e.target.value)} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={handleAddFormation}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une formation suivie
              </Button>
            </div>

            {/* Documents (only if editing existing trainer) */}
            {editingTrainer && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Documents (CV, diplômes, certifications)
                  </Label>
                  {documents.length > 0 && (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between border rounded p-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                              {doc.file_name}
                            </a>
                            <Badge variant="outline" className="text-xs shrink-0">{getDocTypeLabel(doc.document_type)}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteDocument(doc.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {["cv", "diplome", "certification", "autre"].map((docType) => (
                      <div key={docType}>
                        <Label htmlFor={`doc-upload-${docType}`} className="cursor-pointer">
                          <div className="flex items-center gap-1.5 text-sm border rounded px-3 py-1.5 hover:bg-accent transition-colors">
                            {uploadingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            {getDocTypeLabel(docType)}
                          </div>
                        </Label>
                        <input
                          id={`doc-upload-${docType}`}
                          type="file"
                          className="hidden"
                          onChange={(e) => handleUploadDocument(e, docType)}
                          disabled={uploadingDoc}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingTrainer ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le formateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {trainerToDelete?.first_name} {trainerToDelete?.last_name} ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
