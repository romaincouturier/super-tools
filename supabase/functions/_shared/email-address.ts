/**
 * Découpage d'un en-tête d'adresse mail (`From`, `To`) en nom et adresse.
 *
 * Partagé : le webhook de réception l'utilise pour identifier l'expéditeur, et
 * tout routage ultérieur (alertes marchés publics) filtre sur cette adresse.
 * Une adresse mal découpée casse silencieusement ces deux usages.
 */

export interface ParsedAddress {
  email: string;
  name: string | null;
}

/**
 * Accepte les trois formes que produisent les serveurs de mail :
 *   `adresse@domaine.fr`
 *   `<adresse@domaine.fr>`
 *   `Nom Prénom <adresse@domaine.fr>`, le nom pouvant être entre guillemets
 *
 * L'adresse est normalisée en minuscules, comme partout ailleurs dans le code
 * (`normalizeEmail`), pour que les comparaisons d'égalité fonctionnent.
 */
export function parseEmailAddress(address: string): ParsedAddress {
  const input = (address ?? "").trim();
  if (!input) return { email: "", name: null };

  // Forme avec chevrons : l'adresse est ce qu'ils encadrent, le reste est le
  // nom. Le dernier `<` gagne, un nom peut légitimement contenir ce caractère.
  const angle = input.match(/^(.*)<([^<>]+)>[^>]*$/s);
  if (angle) {
    const name = angle[1].trim().replace(/^"(.*)"$/s, "$1").trim();
    return { email: angle[2].trim().toLowerCase(), name: name || null };
  }

  return { email: input.toLowerCase(), name: null };
}
