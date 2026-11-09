import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase-rpc";

/**
 * Référent handicap désigné (indicateur 26).
 *
 * Les écrans publics annonçaient « notre référent handicap » en affichant
 * l'expéditeur générique des emails : personne n'était désigné. Ce hook lit la
 * désignation réelle, et ne retombe sur le contact générique que si aucun
 * référent n'a été saisi — auquel cas `isDesignated` est faux, pour que l'écran
 * puisse le dire plutôt que de laisser croire à une désignation.
 */

export interface HandicapReferent {
  name: string;
  email: string;
  phone: string;
  /** Faux tant qu'aucun référent n'est saisi dans les réglages. */
  isDesignated: boolean;
  loading: boolean;
}

export function useHandicapReferent(fallback?: { name?: string; email?: string }): HandicapReferent {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      rpc.getAppSettingPublic("referent_handicap_name"),
      rpc.getAppSettingPublic("referent_handicap_email"),
      rpc.getAppSettingPublic("referent_handicap_phone"),
    ])
      .then(([n, e, p]) => {
        if (cancelled) return;
        setName((n.data || "").trim());
        setEmail((e.data || "").trim());
        setPhone((p.data || "").trim());
      })
      .catch((err) => {
        console.error("Error loading handicap referent:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Un référent n'est désigné que s'il a un nom ET une adresse : un nom sans
  // moyen de le joindre ne vaut pas une désignation.
  const isDesignated = name.length > 0 && email.length > 0;

  return {
    name: isDesignated ? name : (fallback?.name ?? "").trim(),
    email: isDesignated ? email : (fallback?.email ?? "").trim(),
    phone: isDesignated ? phone : "",
    isDesignated,
    loading,
  };
}
