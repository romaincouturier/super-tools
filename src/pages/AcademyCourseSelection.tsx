import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useAcademyAuth } from "@/hooks/useAcademyAuth";
import { useAcademyCatalog } from "@/hooks/useAcademyCatalog";
import { useAcademyEnrollment } from "@/hooks/useAcademyEnrollment";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/useSession";
import { toastError } from "@/lib/toastError";
import { HIDDEN_FREE_COURSE_IDS } from "@/lib/academyFreeCourses";

/**
 * Choix des formations gratuites, après création de compte (Flux B). Un
 * apprenant peut en rejoindre autant qu'il veut avant de terminer — jamais
 * une seule, contrairement à l'ancien parcours à une formation à la fois.
 */
export default function AcademyCourseSelection() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAcademyAuth();
  const { data, isLoading } = useAcademyCatalog();
  const enroll = useAcademyEnrollment();
  const { refresh } = useSession();

  const preselected = searchParams.get("course") ?? "";
  const [selected, setSelected] = useState<Set<string>>(() => (preselected ? new Set([preselected]) : new Set()));

  useEffect(() => {
    if (!authLoading && !user) navigate("/connexion", { replace: true });
  }, [authLoading, user, navigate]);

  const freeCourses = useMemo(
    () => (data?.courses ?? []).filter((c) => c.access_type === "gratuit" && !HIDDEN_FREE_COURSE_IDS.has(c.id)),
    [data?.courses],
  );

  const toggle = (courseId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId); else next.add(courseId);
      return next;
    });
  };

  const handleFinish = async () => {
    if (selected.size === 0) return;
    try {
      await enroll.mutateAsync(Array.from(selected));
      navigate("/espace-apprenant");
    } catch (error) {
      toastError(toast, error instanceof Error ? error.message : "Réessayez dans quelques instants.", { cause: error });
    }
  };

  if (authLoading || isLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Spinner size="lg" className="text-primary" /></div>;
  }

  return (
    <main className="min-h-screen bg-secondary">
      <header className="bg-background px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <SupertiltLogo className="h-9" />
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-14 lg:py-20">
        <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-primary"><Gift className="h-4 w-4" /> Compte créé</p>
        <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">Choisissez vos formations gratuites</h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">Rejoignez autant de formations que vous voulez, puis cliquez sur « Terminer ».</p>

        {freeCourses.length === 0 ? (
          <p className="mt-10 border border-border bg-background p-6 text-muted-foreground">Aucune formation gratuite n'est disponible pour le moment.</p>
        ) : (
          <div className="mt-10 grid gap-4">
            {freeCourses.map((course) => {
              const isSelected = selected.has(course.id);
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => toggle(course.id)}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between gap-6 border p-6 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary"}`}
                >
                  <span className="text-lg font-bold leading-tight">{course.title}</span>
                  <span className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold ${isSelected ? "bg-primary text-primary-foreground" : "border border-border text-primary"}`}>
                    {isSelected ? <><Check className="h-4 w-4" /> Rejoint</> : "Rejoindre"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <Button className="mt-10 w-full font-bold sm:w-auto" disabled={selected.size === 0 || enroll.isPending} onClick={handleFinish}>
          {enroll.isPending ? <Spinner /> : <>Terminer <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </div>
    </main>
  );
}
