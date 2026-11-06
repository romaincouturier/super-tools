/** Chemin de connexion pour un lien de cours ouvert sans session. */
export function buildLearnerLoginPath(pathname: string, search: string, redirectParam: string): string {
  const params = new URLSearchParams(search);
  const email = params.get("email");
  params.delete("email");
  const rest = params.toString();
  const target = pathname + (rest ? `?${rest}` : "");
  const login = new URLSearchParams();
  if (email) login.set("email", email);
  login.set(redirectParam, target);
  return `/connexion?${login.toString()}`;
}
