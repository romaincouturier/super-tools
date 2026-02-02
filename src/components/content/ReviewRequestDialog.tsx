import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ReviewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardTitle: string;
  onCreated: () => void;
}

interface User {
  id: string;
  email: string;
}

const ReviewRequestDialog = ({
  open,
  onOpenChange,
  cardId,
  cardTitle,
  onCreated,
}: ReviewRequestDialogProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [reviewType, setReviewType] = useState<"card" | "external">("card");
  const [externalUrl, setExternalUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      // Get users with content access
      const { data, error } = await supabase
        .from("user_module_access")
        .select("user_id")
        .eq("module", "contenu");

      if (error) throw error;

      // For now, we'll use a simplified approach
      // In a real app, you'd fetch user emails from a profiles table
      const userIds = [...new Set((data || []).map((u) => u.user_id))];
      
      // Add default users (Emmanuelle & Romain)
      setUsers([
        { id: "emmanuelle", email: "emmanuelle@supertilt.fr" },
        { id: "romain", email: "romain@supertilt.fr" },
      ]);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      toast.error("Veuillez sélectionner un relecteur");
      return;
    }

    if (reviewType === "external" && !externalUrl) {
      toast.error("Veuillez entrer l'URL externe");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id;

      // For demo purposes, we'll use the current user as reviewer
      // In production, you'd map the email to actual user IDs
      const reviewerId = currentUserId; // This would be the selected user's ID

      const { error } = await supabase.from("content_reviews").insert({
        card_id: cardId,
        reviewer_id: reviewerId,
        external_url: reviewType === "external" ? externalUrl : null,
        created_by: currentUserId,
      });

      if (error) throw error;

      // Create notification
      await supabase.from("content_notifications").insert({
        user_id: reviewerId,
        type: "review_requested",
        reference_id: cardId,
        message: `Nouvelle demande de relecture : ${cardTitle}`,
      });

      // Send email notification
      try {
        await supabase.functions.invoke("send-content-notification", {
          body: {
            type: "review_requested",
            recipientEmail: selectedUser,
            cardTitle,
            cardId,
            externalUrl: reviewType === "external" ? externalUrl : null,
          },
        });
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
      }

      toast.success("Demande de relecture envoyée");
      onOpenChange(false);
      onCreated();
    } catch (error) {
      console.error("Error creating review request:", error);
      toast.error("Erreur lors de la création de la demande");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demander une relecture</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Relecteur</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un relecteur" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.email}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type de relecture</Label>
            <RadioGroup
              value={reviewType}
              onValueChange={(v) => setReviewType(v as "card" | "external")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="font-normal">
                  Contenu de la carte
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="external" id="external" />
                <Label htmlFor="external" className="font-normal">
                  Contenu externe (URL)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {reviewType === "external" && (
            <div className="space-y-2">
              <Label htmlFor="external-url">URL externe</Label>
              <Input
                id="external-url"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Envoi..." : "Envoyer la demande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewRequestDialog;
