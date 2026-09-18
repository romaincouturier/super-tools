import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordCreationCard } from "@/components/auth/PasswordCreationCard";
import { useSession } from "@/hooks/useSession";
import { resolvePostLoginPath, REDIRECT_PARAM } from "@/lib/authRouting";

/**
 * Rattrapage des sessions ouvertes par un lien avant que le mot de passe
 * devienne obligatoire. Tant qu'aucun mot de passe n'est défini, l'espace
 * apprenant renvoie ici ; l'écran ne porte aucune sortie.
 */
export default function ConnexionDefinirMotDePasse() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, isStaff, passwordSet, refresh } = useSession();
  const next = searchParams.get(REDIRECT_PARAM);
  const home = resolvePostLoginPath({ isStaff, mustChangePassword: false, next });

  useEffect(() => {
    if (status === "loading") return;
    if (status === "anon") {
      navigate("/connexion", { replace: true });
      return;
    }
    if (passwordSet) navigate(home, { replace: true });
  }, [status, passwordSet, home, navigate]);

  if (status === "loading" || status === "anon" || passwordSet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f6f7]">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  return (
    <AuthShell>
      <PasswordCreationCard
        onDone={async () => {
          await refresh();
          navigate(home, { replace: true });
        }}
      />
    </AuthShell>
  );
}
