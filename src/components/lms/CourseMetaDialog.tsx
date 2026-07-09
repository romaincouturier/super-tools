import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateCourse, type LmsCourse } from "@/hooks/useLms";
import { ACCESS_OPTIONS, EXPERTISE_OPTIONS, STATUS_OPTIONS } from "@/lib/lmsCourseMeta";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

const NO_EXPERTISE = "none";

type Props = {
  course: LmsCourse | null;
  onClose: () => void;
};

export default function CourseMetaDialog({ course, onClose }: Props) {
  const updateCourse = useUpdateCourse();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [expertise, setExpertise] = useState(NO_EXPERTISE);
  const [access, setAccess] = useState("gratuit");
  const [status, setStatus] = useState("draft");

  useEffect(() => {
    if (!course) return;
    setDescription(course.description ?? "");
    setExpertise(course.expertise ?? NO_EXPERTISE);
    setAccess(course.access_type ?? "gratuit");
    setStatus(course.status);
  }, [course]);

  const handleSave = async () => {
    if (!course) return;
    try {
      await updateCourse.mutateAsync({
        id: course.id,
        description: description.trim() || null,
        expertise: expertise === NO_EXPERTISE ? null : expertise,
        access_type: access,
        status,
      });
      toast({ title: "Cours mis à jour" });
      onClose();
    } catch (err) {
      toastError(toast, err);
    }
  };

  return (
    <Dialog open={!!course} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paramètres du cours</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Description courte</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Décrivez le contenu du cours..."
            />
          </div>
          <div>
            <Label>Expertise</Label>
            <Select value={expertise} onValueChange={setExpertise}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EXPERTISE}>Non renseignée</SelectItem>
                {EXPERTISE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Accès</Label>
            <Select value={access} onValueChange={setAccess}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Statut éditorial</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={updateCourse.isPending} className="w-full">
            {updateCourse.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
