export function authorDisplayName(email: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  return email.split("@")[0];
}

export function authorInitialsFromPost(email: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}
