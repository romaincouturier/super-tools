import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AddParticipantDialogProps {
  trainingId: string;
  onParticipantAdded: () => void;
}

const AddParticipantDialog = ({ trainingId, onParticipantAdded }: AddParticipantDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const { toast } = useToast();

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setCompany("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Email requis",
        description: "L'adresse email est obligatoire.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Generate unique token for needs survey
      const token = crypto.randomUUID();

      const { error } = await supabase.from("training_participants").insert({
        training_id: trainingId,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim().toLowerCase(),
        company: company.trim() || null,
        needs_survey_token: token,
        needs_survey_status: "non_envoye",
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Participant déjà inscrit",
            description: "Un participant avec cet email est déjà inscrit à cette formation.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Participant ajouté",
        description: `${email} a été ajouté à la formation.`,
      });

      resetForm();
      setOpen(false);
      onParticipantAdded();
    } catch (error: any) {
      console.error("Error adding participant:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter un participant</DialogTitle>
            <DialogDescription>
              Ajoutez un participant à cette formation. Seul l'email est obligatoire.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean.dupont@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Société</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ACME Corp"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                "Ajouter"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddParticipantDialog;
