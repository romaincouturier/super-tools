/**
 * Qui peut passer par le relais Pennylane : un admin, ou un compte qui a le
 * module Finances. Une session valide ne suffit pas : l'inscription est ouverte,
 * un apprenant a une session.
 *
 * Les deux fonctions SQL reçoivent l'identifiant vérifié par getUser(), jamais
 * une valeur fournie par le client. Une erreur de lecture vaut refus.
 */

type Supabase = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

export const PENNYLANE_MODULE = "finances";

export async function canUsePennylane(admin: Supabase, userId: string): Promise<boolean> {
  const [isAdmin, hasModule] = await Promise.all([
    admin.rpc("is_admin", { _user_id: userId }),
    admin.rpc("has_module_access", { _user_id: userId, _module: PENNYLANE_MODULE }),
  ]);
  if (!isAdmin.error && isAdmin.data === true) return true;
  return !hasModule.error && hasModule.data === true;
}
