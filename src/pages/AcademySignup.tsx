import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Gift, LockKeyhole } from "lucide-react";
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

/**
 * Création de compte Academy. Le choix des formations vient après (écran
 * /academy/choisir-mes-formations), pas avant : ?course= n'est ici qu'une
 * préférence transmise à l'étape suivante, jamais une condition d'accès.
 */
export default function AcademySignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("course") ?? "";
  const { data, isLoading } = useAcademyCatalog();
  const preselectedCourse = useMemo(() => data?.courses.find((item) => item.id === courseId), [courseId, data?.courses]);
  const createAccount = useAcademyAccount();
  const { loading: authLoading, user, signIn } = useAcademyAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Pendant la création de compte, la connexion fait apparaitre l'utilisateur :
  // la redirection automatique ne doit pas court-circuiter le choix des
  // formations, sinon la garde voit un compte encore sans acces.
  const signingUp = useRef(false);

  useEffect(() => {
    if (user && !authLoading && !signingUp.current) navigate("/espace-apprenant");
  }, [authLoading, navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isStrongPassword(password)) return;
    const normalizedEmail = email.trim().toLowerCase();
    signingUp.current = true;
    try {
      await createAccount.mutateAsync({ fullName: fullName.trim(), email: normalizedEmail, password });
      await signIn(normalizedEmail, password);
      const next = courseId ? `?course=${encodeURIComponent(courseId)}` : "";
      navigate(`/academy/choisir-mes-formations${next}`);
    } catch (error) {
      signingUp.current = false;
      toastError(toast, error instanceof Error ? error.message : "Réessayez dans quelques instants.", { cause: error });
    }
  };

  if (isLoading || authLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><Spinner size="lg" className="text-primary" /></div>;

  const passwordIsStrong = isStrongPassword(password);
  const heading = preselectedCourse ? <>Commencez avec<br />{preselectedCourse.title}</> : "Créez votre compte gratuit";
  return <main className="min-h-screen bg-secondary"><header className="bg-background px-6 py-5"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link to="/" aria-label="Retour à l’Academy"><SupertiltLogo className="h-9" /></Link><Link to="/connexion" className="text-sm font-semibold hover:text-primary">J’ai déjà un compte</Link></div></header><div className="mx-auto grid max-w-5xl gap-12 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24"><div><Link to="/" className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Retour à l’Academy</Link><p className="mt-12 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-primary"><Gift className="h-4 w-4" /> Formation gratuite</p><h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">{heading}</h1><p className="mt-6 text-lg leading-8 text-muted-foreground">Créez votre compte gratuitement, vous choisirez vos formations juste après.</p></div><div className="bg-background p-7 shadow-sm sm:p-10"><h2 className="text-2xl font-black">Créer mon compte</h2><p className="mt-2 text-sm text-muted-foreground">Quelques informations, et vous pouvez commencer.</p><form onSubmit={handleSubmit} className="mt-8 space-y-5"><div className="space-y-2"><Label htmlFor="academy-name">Nom complet</Label><Input id="academy-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Marie Dupont" required /></div><div className="space-y-2"><Label htmlFor="academy-email">Adresse email</Label><Input id="academy-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.fr" required /></div><div className="space-y-2"><Label htmlFor="academy-password">Mot de passe</Label><div className="relative"><Input id="academy-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères, majuscule, chiffre et symbole" required className="pr-11" /><Button type="button" variant="ghost" size="icon" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff /> : <Eye />}</Button></div>{password.length > 0 && !passwordIsStrong && <p className="text-xs text-destructive">Utilisez au moins 8 caractères, avec une majuscule, une minuscule, un chiffre et un symbole.</p>}</div><Button type="submit" className="w-full font-bold" disabled={createAccount.isPending || !passwordIsStrong}>{createAccount.isPending ? <Spinner /> : "Créer mon compte"}</Button></form><p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Vos données restent protégées. Vous pourrez vous connecter avec cet email et ce mot de passe.</p></div></div></main>;
}
