type OnboardingProfile = {
  photo_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export function getLearnerOnboardingSteps(profile?: OnboardingProfile | null): ("avatar" | "name")[] {
  const steps: ("avatar" | "name")[] = [];
  if (!profile?.photo_url?.trim()) steps.push("avatar");
  if (!profile?.first_name?.trim() || !profile?.last_name?.trim()) steps.push("name");
  return steps;
}