import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormationFormHook } from "@/hooks/useFormationForm";
import { useCommunityCourses } from "@/hooks/useCommunityCourses";

export default function TrainingCommunityFields({ form }: { form: FormationFormHook }) {
  const courses = useCommunityCourses();
  const mode = form.communityCourseId ? "internal" : form.privateGroupUrl ? "external" : "none";
  return <div id="training-community" className="space-y-3">
    <Label htmlFor="community-choice">Communauté des apprenants</Label>
    <Select value={mode} onValueChange={(value) => {
      if (value === "internal") { form.setPrivateGroupUrl(""); form.setCommunityCourseId(form.lmsCourseId || courses.data?.[0]?.id || null); }
      else { form.setCommunityCourseId(null); form.setPrivateGroupUrl(value === "external" ? "https://" : ""); }
    }}>
      <SelectTrigger id="community-choice"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Aucune communauté</SelectItem>
        <SelectItem value="internal" disabled={!courses.data?.length}>Interne · SuperTilt Academy</SelectItem>
        <SelectItem value="external">Externe</SelectItem>
      </SelectContent>
    </Select>
    {mode === "internal" && <Select value={form.communityCourseId ?? ""} onValueChange={form.setCommunityCourseId}>
      <SelectTrigger aria-label="Cours de la communauté"><SelectValue placeholder="Choisir le cours" /></SelectTrigger>
      <SelectContent>{courses.data?.map((course) => <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>)}</SelectContent>
    </Select>}
    {mode === "external" && <div className="flex items-center gap-2">
      <Input id="privateGroupUrl" aria-label="Lien de la communauté externe" type="url" value={form.privateGroupUrl} onChange={(event) => form.setPrivateGroupUrl(event.target.value)} placeholder="https://…" />
      <Button type="button" variant="outline" onClick={() => form.setPrivateGroupUrl("")} title="Supprimer le lien externe"><Trash2 className="h-4 w-4 mr-2" />Supprimer</Button>
    </div>}
    {courses.isError && <p role="alert" className="text-sm text-destructive">Les cours ne sont pas disponibles. <Button type="button" variant="link" onClick={() => courses.refetch()}>Réessayer</Button></p>}
  </div>;
}