import { useState } from "react";
import { KeyRound, Lock, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthBadge, AuthCard, AuthSupportLine, AuthTitle } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import { validatePassword } from "@/lib/passwordValidation";
import { useAuthActions } from "@/hooks/useAuthActions";

/**
 * Création du mot de passe, étape obligatoire avant d'entrer dans l'espace.
 *
 * Un accès durable sans mot de passe n'existe plus : le lien reçu par email
 * ouvre la porte une fois, cet écran est le dernier pas et n'offre aucune
 * sortie. Carte centrée unique, au gabarit des autres écrans de connexion.
 */
export function PasswordCreationCard({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { updatePassword, markPasswordChanged } = useAuthActions();

  const rules = validatePassword(password);
  const matches = password.length > 0 && password === confirmation;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules.isValid || !matches) return;
    setSaving(true);
    setErrorMsg(null);
    const failure = await updatePassword(password);
    if (failure) {
      setErrorMsg(failure);
      setSaving(false);
      return;
    }
    await markPasswordChanged();
    onDone();
  };

  return (
    <AuthCard>
      <div className="flex flex-col items-center text-center">
        <AuthBadge>
          <KeyRound className="h-6 w-6" />
        </AuthBadge>
        <AuthTitle>Dernière étape : votre mot de passe</AuthTitle>
        <p className="mb-8 max-w-[46ch] text-base text-muted-foreground">
          Choisissez le mot de passe qui protégera votre espace apprenant. Vous vous connecterez
          ensuite directement, sans passer par votre boîte mail.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[420px] text-left">
        <AuthField
          id="creation-password"
          label="Mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          icon={<Lock className="h-[18px] w-[18px]" />}
          autoFocus
          required
        />
        <AuthField
          id="creation-password-confirm"
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
        <AuthButton disabled={saving || !rules.isValid || !matches}>
          {saving ? <Spinner /> : "Enregistrer et accéder à mon espace"}
        </AuthButton>
      </form>

      <div className="mx-auto w-full max-w-[420px]">
        <div className="mt-6 flex items-center justify-center gap-2.5 text-[14.5px] text-muted-foreground">
          <ShieldCheck className="h-[18px] w-[18px]" />
          Connexion sécurisée
        </div>
        <AuthSupportLine />
      </div>
    </AuthCard>
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
