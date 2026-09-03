import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Gift, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useAcademyAccount } from "@/hooks/useAcademyAccount";
import { useAcademyAuth } from "@/hooks/useAcademyAuth";
import { useAcademyCatalog } from "@/hooks/useAcademyCatalog";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

function isStrongPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export default function AcademySignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("course") ?? "";
  const { data, isLoading } = useAcademyCatalog();
  const course = useMemo(() => data?.courses.find((item) => item.id === courseId), [courseId, data?.courses]);
  const createAccount = useAcademyAccount();
  const { loading: authLoading, user, signIn } = useAcademyAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (user && !authLoading) navigate("/espace-apprenant");
  }, [authLoading, navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!course || !isStrongPassword(password)) return;
    try {
      await createAccount.mutateAsync({ courseId: course.id, fullName: fullName.trim(), email: email.trim().toLowerCase(), password });
      await signIn(email.trim().toLowerCase(), password);
      setCreated(true);
      window.setTimeout(() => navigate("/espace-apprenant"), 900);
    } catch (error) {
      toastError(toast, error instanceof Error ? error.message : "Réessayez dans quelques instants.", { cause: error });
    }
  };

  if (isLoading || authLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><Spinner size="lg" className="text-primary" /></div>;
  if (!course || course.access_type !== "gratuit") return <div className="flex min-h-screen items-center justify-center bg-background px-6"><div className="max-w-md text-center"><SupertiltLogo className="mx-auto h-10" /><h1 className="mt-10 text-3xl font-black">Formation indisponible</h1><p className="mt-4 text-muted-foreground">Cette formation gratuite n’est plus disponible.</p><Button asChild className="mt-8"><Link to="/">Retour à l’Academy</Link></Button></div></div>;
  if (created) return <div className="flex min-h-screen items-center justify-center bg-background px-6"><div className="max-w-md text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-primary" /><h1 className="mt-6 text-3xl font-black">Bienvenue dans l’Academy</h1><p className="mt-4 text-muted-foreground">Votre formation est prête. Ouverture de votre espace…</p></div></div>;

  const passwordIsStrong = isStrongPassword(password);
  return <main className="min-h-screen bg-secondary"><header className="bg-background px-6 py-5"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link to="/" aria-label="Retour à l’Academy"><SupertiltLogo className="h-9" /></Link><Link to="/apprenant" className="text-sm font-semibold hover:text-primary">J’ai déjà un compte</Link></div></header><div className="mx-auto grid max-w-5xl gap-12 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24"><div><Link to="/" className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Retour à l’Academy</Link><p className="mt-12 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-primary"><Gift className="h-4 w-4" /> Formation gratuite</p><h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">Commencez avec<br />{course.title}</h1><p className="mt-6 text-lg leading-8 text-muted-foreground">Créez votre compte gratuitement pour accéder à votre formation et à toutes les ressources de l’Academy.</p></div><div className="bg-background p-7 shadow-sm sm:p-10"><h2 className="text-2xl font-black">Créer mon compte</h2><p className="mt-2 text-sm text-muted-foreground">Quelques informations, et vous pouvez commencer.</p><form onSubmit={handleSubmit} className="mt-8 space-y-5"><div className="space-y-2"><Label htmlFor="academy-name">Nom complet</Label><Input id="academy-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Marie Dupont" required /></div><div className="space-y-2"><Label htmlFor="academy-email">Adresse email</Label><Input id="academy-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.fr" required /></div><div className="space-y-2"><Label htmlFor="academy-password">Mot de passe</Label><div className="relative"><Input id="academy-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères, majuscule, chiffre et symbole" required className="pr-11" /><Button type="button" variant="ghost" size="icon" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff /> : <Eye />}</Button></div>{password.length > 0 && !passwordIsStrong && <p className="text-xs text-destructive">Utilisez au moins 8 caractères, avec une majuscule, une minuscule, un chiffre et un symbole.</p>}</div><Button type="submit" className="w-full font-bold" disabled={createAccount.isPending || !passwordIsStrong}>{createAccount.isPending ? <Spinner /> : "Créer mon compte et commencer"}</Button></form><p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Vos données restent protégées. Vous pourrez vous connecter avec cet email et ce mot de passe.</p></div></div></main>;
}
