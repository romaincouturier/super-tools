import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Loader2, Users, Plus, Pencil, Trash2, Save, X, Upload, FileText, ExternalLink } from "lucide-react";
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

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  cv_url: string | null;
  is_default: boolean;
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
  
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  
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
      setTrainers(data || []);
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

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPhotoUrl("");
    setCvUrl("");
    setIsDefault(false);
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
      toast({
        title: "Photo uploadée",
        description: "La photo a été uploadée avec succès.",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'uploader la photo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast({
        title: "Champs requis",
        description: "Prénom, nom et email sont obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // If setting as default, unset other defaults first
      if (isDefault) {
        await supabase
          .from("trainers")
          .update({ is_default: false })
          .neq("id", editingTrainer?.id || "");
      }

      if (editingTrainer) {
        // Update existing trainer
        const { error } = await supabase
          .from("trainers")
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            photo_url: photoUrl || null,
            cv_url: cvUrl.trim() || null,
            is_default: isDefault,
          } as any)
          .eq("id", editingTrainer.id);

        if (error) throw error;
        toast({
          title: "Formateur modifié",
          description: "Les informations ont été mises à jour.",
        });
      } else {
        // Create new trainer
        const { error } = await (supabase as any).from("trainers").insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          photo_url: photoUrl || null,
          cv_url: cvUrl.trim() || null,
          is_default: isDefault,
        });

        if (error) throw error;
        toast({
          title: "Formateur ajouté",
          description: "Le formateur a été ajouté avec succès.",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchTrainers();
    } catch (error) {
      console.error("Error saving trainer:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le formateur.",
        variant: "destructive",
      });
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

      toast({
        title: "Formateur supprimé",
        description: "Le formateur a été supprimé.",
      });

      setDeleteDialogOpen(false);
      setTrainerToDelete(null);
      fetchTrainers();
    } catch (error) {
      console.error("Error deleting trainer:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le formateur.",
        variant: "destructive",
      });
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                Gérez les formateurs qui peuvent animer vos sessions de formation.
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
              <p className="text-sm mt-2">
                Ajoutez un formateur pour pouvoir l'associer à vos formations.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {trainers.map((trainer) => (
                <div
                  key={trainer.id}
                  className="border rounded-lg p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={trainer.photo_url || undefined} />
                        <AvatarFallback>
                          {getInitials(trainer.first_name, trainer.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {trainer.first_name} {trainer.last_name}
                        </div>
                        {trainer.is_default && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Par défaut
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDialog(trainer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setTrainerToDelete(trainer);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{trainer.email}</div>
                    {trainer.phone && <div>{trainer.phone}</div>}
                    {trainer.cv_url && (
                      <a
                        href={trainer.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        CV du formateur
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTrainer ? "Modifier le formateur" : "Ajouter un formateur"}
            </DialogTitle>
            <DialogDescription>
              Renseignez les informations du formateur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={photoUrl || undefined} />
                <AvatarFallback>
                  {firstName && lastName
                    ? getInitials(firstName, lastName)
                    : "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="photo-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {photoUrl ? "Changer la photo" : "Ajouter une photo"}
                  </div>
                </Label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadPhoto}
                  disabled={uploading}
                />
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Romain"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: Couturier"
                />
              </div>
            </div>

            {/* Contact fields */}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: email@exemple.fr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 06 12 34 56 78"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvUrl">Lien vers le CV</Label>
              <Input
                id="cvUrl"
                type="url"
                value={cvUrl}
                onChange={(e) => setCvUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Default switch */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isDefault">Formateur par défaut</Label>
                <p className="text-sm text-muted-foreground">
                  Sera pré-sélectionné lors de la création d'une formation
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
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
              Êtes-vous sûr de vouloir supprimer {trainerToDelete?.first_name}{" "}
              {trainerToDelete?.last_name} ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
