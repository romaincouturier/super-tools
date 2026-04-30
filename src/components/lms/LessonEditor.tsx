import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUpdateLesson, LmsLesson } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { Save, Clock } from "lucide-react";
import LessonWorkDepositConfigSection from "@/components/lms/LessonWorkDepositConfigSection";
import type { WorkDepositConfig } from "@/types/lms-work-deposit";
import LessonBlocksEditor from "@/components/lms/blocks/LessonBlocksEditor";

interface Props {
  lesson: LmsLesson;
  /** Course id used by block editors that depend on course-scoped data (quiz picker). */
  courseId?: string;
}

export default function LmsLessonEditor({ lesson, courseId }: Props) {
  const updateLesson = useUpdateLesson();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: lesson.title,
    estimated_minutes: lesson.estimated_minutes || 5,
    is_mandatory: lesson.is_mandatory,
  });

  const handleSave = async () => {
    await updateLesson.mutateAsync({ id: lesson.id, ...form });
    toast({ title: "Leçon sauvegardée" });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Titre de la leçon</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Contenu de la leçon</Label>
        <LessonBlocksEditor lessonId={lesson.id} courseId={courseId} />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <Label>Durée estimée (min)</Label>
          <Input
            type="number"
            value={form.estimated_minutes}
            onChange={(e) => setForm({ ...form, estimated_minutes: +e.target.value })}
            className="w-20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_mandatory}
            onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })}
          />
          <Label>Obligatoire</Label>
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateLesson.isPending}>
        <Save className="w-4 h-4 mr-2" /> Sauvegarder
      </Button>

      <LessonWorkDepositConfigSection
        lessonId={lesson.id}
        initialEnabled={lesson.work_deposit_enabled ?? false}
        initialConfig={(lesson.work_deposit_config || {}) as WorkDepositConfig}
      />
    </div>
  );
}
