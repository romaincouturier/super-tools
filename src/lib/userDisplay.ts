export interface UserProfileLite {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export function displayNameOf(user: UserProfileLite): string {
  if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
  if (user.first_name) return user.first_name;
  return user.email.split("@")[0];
}

export function initialsOf(user: UserProfileLite): string {
  const first = user.first_name?.[0] ?? user.email[0];
  const last = user.last_name?.[0] ?? user.email[1] ?? "";
  return `${first}${last}`.toUpperCase();
}
