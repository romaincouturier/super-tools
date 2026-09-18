import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

/** Étapes de l'ouverture d'un lien reçu par email (W5, W10). */
export type RedemptionStage =
  | "confirm"
  | "unavailable"
  | "redeeming"
  | "connected"
  | "password-required"
  | "other-session"
  | "expired"
  | "used"
  | "invalid";

export type RedeemResponse = {
  status?: string;
  email?: string;
  token_hash?: string;
  next?: string | null;
};

/**
 * Traduit la réponse du serveur en étape d'écran.
 *
 * Une absence de réponse n'est pas un lien invalide : c'est un service qui ne
 * répond pas. Confondre les deux ferait accuser le lien de l'apprenant d'un
 * défaut qui n'est pas le sien, et l'enverrait en redemander un autre pour rien.
 */
export function stageFromResponse(payload: RedeemResponse | null): RedemptionStage {
  if (payload === null || payload === undefined) return "unavailable";
  const status = payload.status;
  if (status === "expired") return "expired";
  if (status === "used") return "used";
  if (status === "ok" && payload.token_hash) return "connected";
  return "invalid";
}

export function useLearnerTokenRedemption() {
  const [stage, setStage] = useState<RedemptionStage>("confirm");
  const [email, setEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [destination, setDestination] = useState<string | null>(null);
  const [pending, setPending] = useState<{ token: string; tokenHash: string } | null>(null);
  const { invoke } = useEdgeFunction<RedeemResponse>("redeem-learner-token", { silentOnError: true });

  /** Ouvre la session depuis l'empreinte, consomme le jeton, puis aiguille. */
  const openSession = useCallback(async (token: string, tokenHash: string) => {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error) {
      setStage("invalid");
      return;
    }

    // Usage unique : le jeton est consommé dès l'ouverture de session (RG-04).
    await supabase.rpc("consume_learner_token", { p_token: token });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStage("invalid");
      return;
    }
    const { data: security } = await supabase
      .from("user_security_metadata")
      .select("password_set")
      .eq("user_id", user.id)
      .maybeSingle();

    // Premier accès sans mot de passe : sa création est imposée avant l'entrée
    // dans l'espace. Un accès durable sans mot de passe n'existe plus.
    setStage(security && security.password_set === false ? "password-required" : "connected");
  }, []);

  /** L'utilisateur choisit de rester sur la session déjà ouverte. */
  const keepCurrentSession = useCallback(() => setStage("connected"), []);

  /** L'utilisateur choisit de se connecter avec le compte du lien. */
  const switchAccount = useCallback(async () => {
    if (!pending) return;
    setStage("redeeming");
    await openSession(pending.token, pending.tokenHash);
  }, [pending, openSession]);

  /**
   * RG-21 : rien ne part au chargement de la page. Les passerelles de sécurité
   * des messageries d'entreprise ouvrent les liens avant l'utilisateur ; un
   * jeton consommé par un robot arriverait déjà mort chez l'apprenant.
   */
  const redeem = useCallback(async (token: string) => {
    if (!token) {
      setStage("invalid");
      return;
    }
    setStage("redeeming");

    const payload = await invoke({ token });
    if (payload?.email) setEmail(payload.email);
    if (payload?.next) setDestination(payload.next);

    const next = stageFromResponse(payload);
    if (next !== "connected") {
      setStage(next);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const current = session?.user?.email?.toLowerCase() ?? "";

    // Déjà connecté avec le même compte : pas de nouvelle authentification, et
    // le jeton n'est pas dépensé (W5 étape 4).
    if (current && current === payload?.email) {
      setStage("connected");
      return;
    }

    // Session ouverte pour quelqu'un d'autre : on demande, on ne bascule pas
    // dans son dos (W5 étape 5).
    if (current) {
      setSessionEmail(current);
      setPending({ token, tokenHash: payload!.token_hash! });
      setStage("other-session");
      return;
    }

    await openSession(token, payload!.token_hash!);
  }, [openSession, invoke]);

  return { stage, email, sessionEmail, destination, redeem, keepCurrentSession, switchAccount };
}
