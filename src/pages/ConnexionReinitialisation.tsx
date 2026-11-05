import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Lock, ShieldCheck, CheckCircle2, Circle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthBadge, AuthInfoPanel, AuthShell, AuthSplitCard, AuthSupportLine, AuthTitle } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import { validatePassword } from "@/lib/passwordValidation";
import { useAuthActions, usePasswordRecoverySession } from "@/hooks/useAuthActions";
import { useSession } from "@/hooks/useSession";
import { resolvePostLoginPath, REDIRECT_PARAM } from "@/lib/authRouting";
import { usePasswordIdentity } from "@/hooks/usePasswordIdentity";
import { passwordIdentitySchema } from "@/services/passwordIdentity";
import { reportHandledError } from "@/lib/sentry";

export default function ConnexionReinitialisation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isStaff, refresh } = useSession();
  const { stage, confirmRecovery, canResend, requestNewLink } = usePasswordRecoverySession();
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { updatePassword, markPasswordChanged } = useAuthActions();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const identity = usePasswordIdentity(stage === "ready");

  useEffect(() => {
    if (!identity.data) return;
    setFirstName(identity.data.firstName);
    setLastName(identity.data.lastName);
  }, [identity.data]);

  const rules = validatePassword(password);
  const canSubmit = stage === "ready" && !identity.isPending && !identity.isError
    && passwordIdentitySchema.safeParse({ firstName, lastName }).success
    && rules.isValid && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await identity.saveIdentity({ firstName, lastName });
    } catch (error) {
      reportHandledError(error);
      setErrorMsg("Votre prénom et votre nom n’ont pas été enregistrés. Réessayez.");
      setSubmitting(false);
      return;
    }

    const failure = await updatePassword(password);
    if (failure) {
      setErrorMsg(failure);
      setSubmitting(false);
      return;
    }
    // Ce parcours est accessible directement par URL, sans passer par la
    // résolution d'identité : un apprenant qui n'avait encore aucun mot de
    // passe peut y arriver. Sans cet appel, password_set resterait à faux et
    // la prochaine connexion le renverrait vers un lien au lieu du mot de
    // passe qu'il vient de définir (W8, point 6 : un seul mécanisme).
    await markPasswordChanged();
    await refresh();
    navigate(
      resolvePostLoginPath({ isStaff, mustChangePassword: false, next: searchParams.get(REDIRECT_PARAM) }),
      { replace: true },
    );
  };

  if (stage === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (stage === "invalid") {
    return (
      <AuthShell backLabel="Retour à la connexion" onBack={() => navigate("/connexion")}>
        <AuthSplitCard
          left={
            <>
              <AuthBadge><KeyRound className="h-6 w-6" /></AuthBadge>
              <AuthTitle>
                Ce lien a expiré
              </AuthTitle>
              <p className="mb-7 w-full text-[15.5px] text-muted-foreground">
                Ce lien n'est plus valable : il a expiré ou a déjà servi.
                {canResend
                  ? " Recevez un nouveau lien à votre adresse email, valable 24 heures."
                  : " Demandez-en un nouveau, nous vous l'envoyons tout de suite."}
              </p>
              {resend === "sent" ? (
                <p className="mb-4 text-[15.5px] text-foreground" role="status">
                  Un nouveau lien vient de vous être envoyé par email. Il est valable 24 heures.
                </p>
              ) : (
                <AuthButton type="button" disabled={resend === "sending"} onClick={async () => {
                  if (!canResend) { navigate("/connexion/mot-de-passe-oublie"); return; }
                  setResend("sending");
                  setResend((await requestNewLink()) ? "sent" : "error");
                }}>
                  {resend === "sending" ? <Spinner /> : "Recevoir un nouveau lien"}
                </AuthButton>
              )}
              {resend === "error" && (
                <p className="mt-3 text-sm text-destructive">L'envoi a échoué. Réessayez dans quelques minutes.</p>
              )}
              <AuthSupportLine />
            </>
          }
          right={
            <AuthInfoPanel
              items={[{
                icon: <ShieldCheck className="h-[21px] w-[21px]" />,
                title: "Pourquoi un lien à usage unique ?",
                text: "Un lien qui ne sert qu'une fois protège votre compte si votre messagerie est consultée par quelqu'un d'autre.",
              }]}
            />
          }
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell backLabel="Retour à la connexion" onBack={() => navigate("/connexion")}>
      <AuthSplitCard
        left={
          <>
            <AuthBadge><KeyRound className="h-6 w-6" /></AuthBadge>
            <AuthTitle>
              Nouveau mot de passe
            </AuthTitle>
            <p className="mb-5 max-w-[42ch] text-[15.5px] text-muted-foreground">
              Choisissez un nouveau mot de passe pour sécuriser votre compte.
            </p>

            {stage === "confirm" ? (
              <AuthButton type="button" disabled={submitting} onClick={async () => {
                setSubmitting(true);
                await confirmRecovery();
                setSubmitting(false);
              }}>
                {submitting ? <Spinner /> : "Continuer"}
              </AuthButton>
            ) : identity.isPending ? <Spinner /> : identity.isError ? (
              <>
                <p className="mb-4 text-sm text-destructive">Impossible de charger vos informations.</p>
                <AuthButton type="button" onClick={() => { void identity.refetch(); }}>Réessayer</AuthButton>
              </>
            ) : <form onSubmit={handleSubmit}>
              <AuthField id="first-name" label="Prénom (obligatoire)" value={firstName}
                onChange={setFirstName} autoComplete="given-name" required autoFocus />
              <AuthField id="last-name" label="Nom (obligatoire)" value={lastName}
                onChange={setLastName} autoComplete="family-name" required />
              <AuthField
                id="new-password"
                label="Nouveau mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                icon={<Lock className="h-[18px] w-[18px]" />}
                required
              />

              <div className="mb-5 flex flex-col gap-1.5 rounded-[11px] bg-primary/10 px-4 py-3.5">
                <Rule ok={rules.hasMinLength} label="Au moins 8 caractères" />
                <Rule ok={rules.hasUppercase && rules.hasLowercase} label="Une majuscule et une minuscule" />
                <Rule ok={rules.hasNumber} label="Un chiffre" />
                <Rule ok={rules.hasSpecialChar} label="Un caractère spécial" />
              </div>

              {errorMsg && <p className="mb-4 text-sm text-destructive">{errorMsg}</p>}

              <AuthButton disabled={!canSubmit}>
                {submitting ? <Spinner /> : "Enregistrer mon nouveau mot de passe"}
              </AuthButton>
            </form>}

            <AuthSupportLine />
          </>
        }
        right={
          <AuthInfoPanel
            items={[
              {
                icon: <ShieldCheck className="h-[21px] w-[21px]" />,
                title: "Mot de passe sécurisé",
                text: "Utilisez un mot de passe unique, que vous n'utilisez pas ailleurs.",
              },
              {
                icon: <CheckCircle2 className="h-[21px] w-[21px]" />,
                title: "Connexion ensuite",
                text: "Une fois enregistré, vous arrivez directement dans votre espace.",
              },
            ]}
          />
        }
      />
    </AuthShell>
  );
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-[14.5px] ${ok ? "text-foreground" : "text-muted-foreground"}`}>
      {ok
        ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-primary" />
        : <Circle className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />}
      {label}
    </div>
  );
}
