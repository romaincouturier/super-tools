import { useNavigate } from "react-router-dom";
import { UserX } from "lucide-react";
import { AuthShell, AuthCard } from "@/components/auth/AuthShell";
import { AuthButton } from "@/components/auth/AuthField";
import { useSession } from "@/hooks/useSession";

/**
 * Compte authentifié qui n'est rattaché ni à l'équipe ni à une formation
 * (critère 13). État terminal et explicite : ni renvoi vers le back-office,
 * ni boucle vers la connexion.
 */
export default function CompteSansAcces() {
  const { email, signOut } = useSession();
  const navigate = useNavigate();

  return (
    <AuthShell backLabel="Aller à la connexion" onBack={() => navigate("/connexion")}>
      <AuthCard>
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#fdf6e4]">
          <UserX className="h-7 w-7 text-[#1a2230]" />
        </div>
        <h1 className="mb-2.5 text-[26px] font-semibold leading-tight tracking-[-0.7px] sm:text-[31px]">
          Votre compte n'a pas encore d'accès
        </h1>
        <p className="mb-8 text-base text-[#6b7686]">
          Votre compte {email ? <strong>{email}</strong> : null} existe bien, mais aucune formation
          ni aucun espace ne lui est rattaché. Écrivez-nous, nous réglons cela rapidement.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={`mailto:contact@supertilt.fr?subject=${encodeURIComponent("Mon compte n'a pas d'accès")}&body=${encodeURIComponent(`Bonjour,\n\nMon compte ${email ?? ""} n'a accès à aucune formation.\n\nMerci de votre aide.`)}`}
            className="text-[15px] font-bold underline underline-offset-[3px]"
          >
            Écrire au support
          </a>
          <AuthButton
            type="button"
            onClick={async () => {
              await signOut();
              navigate("/connexion", { replace: true });
            }}
          >
            Me déconnecter
          </AuthButton>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
