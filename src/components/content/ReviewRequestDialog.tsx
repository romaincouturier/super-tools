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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_module_access")
        .select("user_id")
        .eq("module", "contenu");

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map((d) => d.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, display_name")
          .in("user_id", userIds);

        if (profiles) {
          setUsers(profiles.map((p) => ({
            id: p.user_id,
            email: p.email,
          })));
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      toast.error("Veuillez sélectionner un relecteur");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id;

      const reviewerId = currentUserId;

      const { error } = await supabase.from("content_reviews").insert({
        card_id: cardId,
        reviewer_id: reviewerId,
        reviewer_email: selectedUser,
        external_url: null,
        created_by: currentUserId,
      });

      if (error) throw error;

      // Create notification
      await (supabase as any).from("content_notifications").insert({
        user_id: reviewerId,
        type: "review_requested",
        reference_id: cardId,
        card_id: cardId,
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
          },
        });
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
      }

      toast.success("Relecteur associé");
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
          <DialogTitle>Associer un relecteur</DialogTitle>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Association..." : "Associer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewRequestDialog;
