import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { getInitials } from "@/lib/stringUtils";
import { Camera } from "lucide-react";

export default function StaffProfileSettings() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, first_name, last_name, photo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfileId(data.id);
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setPhotoUrl(data.photo_url ?? null);
      }
      setLoading(false);
    });
  }, []);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const path = `staff-profiles/profile-${Date.now()}.${fileExt}`;
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("path", path);
      const { data, error } = await supabase.functions.invoke("upload-training-file", { body: formData });
      if (error) throw error;
      const url = (data as { publicUrl?: string } | null)?.publicUrl;
      if (!url) throw new Error("URL introuvable après l'upload");
      setPhotoUrl(url);
      toast({ title: "Photo uploadée" });
    } catch {
      toastError(toast, "Impossible d'uploader la photo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!profileId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          photo_url: photoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);
      if (error) throw error;
      toast({ title: "Profil mis à jour" });
    } catch {
      toastError(toast, "Impossible de sauvegarder le profil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner size="sm" />;

  const initials = getInitials(firstName, lastName, "?");

  return (
    <div className="space-y-6 max-w-sm">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarImage src={photoUrl ?? undefined} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
          >
            {uploading ? <Spinner size="sm" /> : <Camera className="h-3 w-3" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} />
        </div>
        <div className="text-sm text-muted-foreground">
          Cliquez sur l'icône pour changer la photo.
          <br />Elle s'affichera dans la communauté e-learning.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Prénom</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" />
        </div>
        <div className="space-y-1.5">
          <Label>Nom</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? <Spinner size="sm" /> : "Sauvegarder"}
      </Button>
    </div>
  );
}
