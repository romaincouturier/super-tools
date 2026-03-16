import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCourseEnrollments, useEnrollLearner } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Mail } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  courseId: string;
}

const statusLabels: Record<string, string> = {
  active: "Actif",
  completed: "Terminé",
  paused: "En pause",
  dropped: "Abandonné",
};

const statusColors: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-700",
  completed: "bg-emerald-500/10 text-emerald-700",
  paused: "bg-amber-500/10 text-amber-700",
  dropped: "bg-red-500/10 text-red-700",
};

export default function LmsEnrollmentManager({ courseId }: Props) {
  const { data: enrollments = [], isLoading } = useCourseEnrollments(courseId);
  const enrollLearner = useEnrollLearner();
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const handleEnroll = async () => {
    if (!email.trim()) return;
    await enrollLearner.mutateAsync({ course_id: courseId, learner_email: email.trim().toLowerCase() });
    setEmail("");
    toast({ title: "Apprenant inscrit" });
  };

  return (
    <div className="space-y-4">
      {/* Enroll form */}
      <Card>
        <CardContent className="flex items-center gap-2 py-4">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email de l'apprenant..."
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleEnroll()}
          />
          <Button onClick={handleEnroll} disabled={!email.trim() || enrollLearner.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Inscrire
          </Button>
        </CardContent>
      </Card>

      {/* Enrollments list */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="w-4 h-4" />
        {enrollments.length} apprenant{enrollments.length !== 1 ? "s" : ""} inscrit{enrollments.length !== 1 ? "s" : ""}
      </div>

      {enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun apprenant inscrit
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {enrollments.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{e.learner_email}</p>
                  <p className="text-xs text-muted-foreground">
                    Inscrit le {format(new Date(e.enrolled_at), "dd MMM yyyy", { locale: fr })}
                  </p>
                </div>
                <div className="w-32">
                  <Progress value={e.completion_percentage || 0} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right mt-1">
                    {Math.round(e.completion_percentage || 0)}%
                  </p>
                </div>
                <Badge variant="outline" className={statusColors[e.status] || ""}>
                  {statusLabels[e.status] || e.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
