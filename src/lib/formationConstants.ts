export const LIEUX = [
  "En ligne en accédant à son compte sur supertilt.fr",
  "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon",
  "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris",
  "Chez le client",
];

/** Capitalize each part of a name/city: "JEAN-PIERRE" -> "Jean-Pierre", "LYON" -> "Lyon" */
export const capitalizeName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
