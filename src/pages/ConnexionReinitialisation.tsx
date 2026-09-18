import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Lock, ShieldCheck, CheckCircle2, Circle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthBadge, AuthInfoPanel, AuthShell, AuthSplitCard, AuthSupportLine, AuthTitle } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import { validatePassword } from "@/lib/passwordValidation";
import { useAuthActions, usePasswordRecoverySession } from "@/hooks/useAuthActions";
import { useSession } from "@/hooks/useSession";
import { resolvePostLoginPath, REDIRECT_PARAM } from "@/lib/authRouting";

export default function ConnexionReinitialisation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isStaff, mustChangePassword, refresh } = useSession();
  const { stage, confirmRecovery } = usePasswordRecoverySession();
  const { updatePassword, markPasswordChanged } = useAuthActions();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rules = validatePassword(password);
  const matches = password.length > 0 && password === confirmation;
  const canSubmit = rules.isValid && matches && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);

    // RG-21 : pour un lien ?token_hash=...&type=recovery, rien n'a encore été
    // consommé (usePasswordRecoverySession, stage "confirm") — un filtre de
    // sécurité de messagerie qui a pré-ouvert l'email n'a donc rien brûlé.
    // On ne le consomme qu'ici, sur ce clic réel de l'apprenant, sans lui
    // imposer un écran ni un clic supplémentaires : enregistrer son mot de
    // passe EST l'action qui prouve qu'il est bien là.
    if (stage === "confirm") {
      const confirmed = await confirmRecovery();
      if (!confirmed) { setSubmitting(false); return; }
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
              <p className="mb-7 max-w-[42ch] text-[15.5px] text-muted-foreground">
                Les liens de réinitialisation sont valables 1 heure et ne fonctionnent qu'une fois.
                Demandez-en un nouveau, nous vous l'envoyons tout de suite.
              </p>
              <AuthButton type="button" onClick={() => navigate("/connexion/mot-de-passe-oublie")}>
                Recevoir un nouveau lien
              </AuthButton>
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

            <form onSubmit={handleSubmit}>
              <AuthField
                id="new-password"
                label="Nouveau mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                icon={<Lock className="h-[18px] w-[18px]" />}
                autoFocus
                required
              />
              <AuthField
                id="new-password-confirm"
                label="Confirmer le mot de passe"
                type="password"
                value={confirmation}
                onChange={setConfirmation}
                autoComplete="new-password"
                icon={<Lock className="h-[18px] w-[18px]" />}
                required
              />

              <div className="mb-5 flex flex-col gap-1.5 rounded-[11px] bg-primary/10 px-4 py-3.5">
                <Rule ok={rules.hasMinLength} label="Au moins 8 caractères" />
                <Rule ok={rules.hasUppercase && rules.hasLowercase} label="Une majuscule et une minuscule" />
                <Rule ok={rules.hasNumber} label="Un chiffre" />
                <Rule ok={rules.hasSpecialChar} label="Un caractère spécial" />
                <Rule ok={matches} label="Les deux saisies correspondent" />
              </div>

              {errorMsg && <p className="mb-4 text-sm text-destructive">{errorMsg}</p>}

              <AuthButton disabled={!canSubmit}>
                {submitting ? <Spinner /> : "Enregistrer mon nouveau mot de passe"}
              </AuthButton>
            </form>

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
