import { useContext } from "react";
import { SessionContext, type SessionState } from "@/contexts/SessionProvider";

/** État de session résolu une seule fois par l'application (lot 2). */
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession doit être utilisé dans un SessionProvider");
  return ctx;
}
