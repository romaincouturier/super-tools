import { useState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useUpsertLearnerProfile,
  uploadLearnerPhoto,
  type LearnerProfile,
} from "@/hooks/useLearnerProfile";

export function LearnerEditProfileModal({
  open,
  onClose,
  email,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  profile: LearnerProfile | null | undefined;
}) {
  const { toast } = useToast();
  const upsert = useUpsertLearnerProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [fonction, setFonction] = useState(profile?.fonction ?? "");
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? "");
  const [uploading, setUploading] = useState(false);

  // Reset fields when profile loads or modal re-opens
  useEffect(() => {
    if (open) {
      setFirstName(profile?.first_name ?? "");
      setLastName(profile?.last_name ?? "");
      setFonction(profile?.fonction ?? "");
      setPhotoUrl(profile?.photo_url ?? "");
    }
  }, [open, profile]);

  const handlePhotoFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLearnerPhoto(file, email);
      setPhotoUrl(url);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de l'upload de la photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        email,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        fonction: fonction.trim() || null,
        photo_url: photoUrl || null,
      });
      toast({ title: "Profil mis à jour" });
      onClose();
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de la sauvegarde");
    }
  };

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-full" style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}>
        <DialogHeader>
          <DialogTitle>Mon profil</DialogTitle>
        </DialogHeader>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold select-none"
              style={{ background: photoUrl ? "transparent" : "#FFD100", color: "#101820" }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(16,24,32,0.45)" }}
            >
              {uploading ? (
                <Spinner className="text-white h-5 w-5" />
              ) : (
                <Camera size={20} className="text-white" />
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoFile(f);
              e.target.value = "";
            }}
          />
          <p className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
            Cliquez pour changer la photo
          </p>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ep-firstname">Prénom</Label>
              <Input
                id="ep-firstname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Prénom"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-lastname">Nom</Label>
              <Input
                id="ep-lastname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Nom"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-fonction">Fonction</Label>
            <Input
              id="ep-fonction"
              value={fonction}
              onChange={(e) => setFonction(e.target.value)}
              placeholder="Ex: Directeur artistique, Manager…"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={upsert.isPending || uploading}
          >
            {upsert.isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
