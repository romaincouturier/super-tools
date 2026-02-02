import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Star } from "lucide-react";

interface Trainer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  specialties: string[] | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

const TrainersManagement = () => {
  const [loading, setLoading] = useState(true);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    bio: "",
    specialties: "",
    is_default: false,
  });

  const fetchTrainers = async (orgId: string) => {
    const { data, error } = await supabase
      .from("trainers")
      .select("*")
      .eq("organization_id", orgId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching trainers:", error);
      return;
    }

    setTrainers(data || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (profile?.organization_id) {
          setOrganizationId(profile.organization_id);
          await fetchTrainers(profile.organization_id);
        }
      } catch (error) {
        console.error("Error initializing:", error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      bio: "",
      specialties: "",
      is_default: false,
    });
    setSelectedTrainer(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (trainer: Trainer) => {
    setSelectedTrainer(trainer);
    setFormData({
      name: trainer.name,
      email: trainer.email,
      phone: trainer.phone || "",
      bio: trainer.bio || "",
      specialties: trainer.specialties?.join(", ") || "",
      is_default: trainer.is_default,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !organizationId) return;

    setSaving(true);
    try {
      const specialtiesArray = formData.specialties
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const trainerData = {
        organization_id: organizationId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        bio: formData.bio || null,
        specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
        is_default: formData.is_default,
      };

      // If setting as default, unset others first
      if (formData.is_default) {
        await supabase
          .from("trainers")
          .update({ is_default: false })
          .eq("organization_id", organizationId);
      }

      if (selectedTrainer) {
        // Update
        const { error } = await supabase
          .from("trainers")
          .update({ ...trainerData, updated_at: new Date().toISOString() })
          .eq("id", selectedTrainer.id);

        if (error) throw error;

        toast({
          title: "Formateur mis à jour",
          description: "Les informations ont été enregistrées.",
        });
      } else {
        // Create
        const { error } = await supabase
          .from("trainers")
          .insert(trainerData);

        if (error) throw error;

        toast({
          title: "Formateur créé",
          description: "Le nouveau formateur a été ajouté.",
        });
      }

      await fetchTrainers(organizationId);
      setShowDialog(false);
      resetForm();
    } catch (error) {
      console.error("Error saving trainer:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le formateur.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTrainer || !organizationId) return;

    try {
      const { error } = await supabase
        .from("trainers")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", selectedTrainer.id);

      if (error) throw error;

      await fetchTrainers(organizationId);

      toast({
        title: "Formateur désactivé",
        description: "Le formateur a été désactivé.",
      });
    } catch (error) {
      console.error("Error deleting trainer:", error);
      toast({
        title: "Erreur",
        description: "Impossible de désactiver le formateur.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setSelectedTrainer(null);
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Gestion des formateurs</h2>
            <p className="text-sm text-muted-foreground">
              Configurez les formateurs de votre organisation
            </p>
          </div>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un formateur
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Formateurs</CardTitle>
            <CardDescription>
              {trainers.filter(t => t.is_active).length} formateur{trainers.filter(t => t.is_active).length > 1 ? "s" : ""} actif{trainers.filter(t => t.is_active).length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trainers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun formateur configuré. Ajoutez votre premier formateur.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Nom</TableHead>
                      <TableHead className="min-w-[180px] hidden sm:table-cell">Email</TableHead>
                      <TableHead className="min-w-[150px] hidden md:table-cell">Spécialités</TableHead>
                      <TableHead className="min-w-[80px]">Statut</TableHead>
                      <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainers.map((trainer) => (
                      <TableRow key={trainer.id} className={!trainer.is_active ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{trainer.name}</span>
                              {trainer.is_default && (
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground sm:hidden">{trainer.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{trainer.email}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {trainer.specialties?.slice(0, 3).map((spec, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                            {trainer.specialties && trainer.specialties.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{trainer.specialties.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={trainer.is_active ? "default" : "secondary"}>
                            {trainer.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(trainer)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!trainer.is_default && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedTrainer(trainer);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedTrainer ? "Modifier le formateur" : "Ajouter un formateur"}
              </DialogTitle>
              <DialogDescription>
                Les informations du formateur apparaîtront dans les emails et documents.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jean@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="06 12 34 56 78"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialties">Spécialités (séparées par des virgules)</Label>
                <Input
                  id="specialties"
                  value={formData.specialties}
                  onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                  placeholder="Management, Leadership, Communication"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Biographie</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Brève description du formateur..."
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Formateur par défaut</Label>
                  <p className="text-sm text-muted-foreground">
                    Sera sélectionné automatiquement lors de la création d'une formation
                  </p>
                </div>
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving || !formData.name || !formData.email}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedTrainer ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Désactiver ce formateur ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le formateur {selectedTrainer?.name} ne pourra plus être sélectionné pour de nouvelles formations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Désactiver
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default TrainersManagement;
