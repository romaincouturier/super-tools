import type {
  NetworkContact,
  NetworkAction,
  NetworkInteraction,
  CoolingContact,
  CoolingThresholds,
  NetworkStats,
  WarmthLevel,
} from "@/types/reseau";

const DEFAULT_THRESHOLDS: CoolingThresholds = { hot: 14, warm: 30, cold: 60 };

export function computeCoolingContacts(
  contacts: NetworkContact[],
  thresholds: CoolingThresholds = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): CoolingContact[] {
  const cooling: CoolingContact[] = [];

  for (const contact of contacts) {
    const threshold = thresholds[contact.warmth];
    const refDate = contact.last_contact_date
      ? new Date(contact.last_contact_date)
      : new Date(contact.created_at);
    const daysSince = Math.floor(
      (now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince >= threshold * 0.7) {
      cooling.push({
        contact,
        daysSinceLastContact: daysSince,
        threshold,
        isOverdue: daysSince >= threshold,
      });
    }
  }

  cooling.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.daysSinceLastContact - a.daysSinceLastContact;
  });

  return cooling;
}

export function computeNetworkStats(
  contacts: NetworkContact[],
  actions: (NetworkAction & { contact: NetworkContact | null })[],
  interactions: NetworkInteraction[],
  now: Date = new Date(),
): NetworkStats {
  const d7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const warmthDistribution: Record<WarmthLevel, number> = { hot: 0, warm: 0, cold: 0 };
  for (const c of contacts) warmthDistribution[c.warmth]++;
  const total = contacts.length || 1;
  const warmthPercent: Record<WarmthLevel, number> = {
    hot: Math.round((warmthDistribution.hot / total) * 100),
    warm: Math.round((warmthDistribution.warm / total) * 100),
    cold: Math.round((warmthDistribution.cold / total) * 100),
  };

  const actionsDone = actions.filter((a) => a.status === "done").length;
  const actionsSkipped = actions.filter((a) => a.status === "skipped").length;
  const actionsPending = actions.filter((a) => a.status === "pending").length;
  const completedOrSkipped = actionsDone + actionsSkipped;
  const completionRate = completedOrSkipped > 0 ? Math.round((actionsDone / completedOrSkipped) * 100) : 0;

  const interactionsLast7d = interactions.filter((i) => new Date(i.created_at) >= d7ago).length;
  const interactionsLast30d = interactions.filter((i) => new Date(i.created_at) >= d30ago).length;

  const weeklyActivity: { week: string; count: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(now.getTime() - (w * 7 + 6) * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const count = interactions.filter((i) => {
      const d = new Date(i.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeklyActivity.push({ week: w === 0 ? "Cette sem." : `S-${w}`, count });
  }

  let totalDays = 0;
  let contactsNeverContacted = 0;
  for (const c of contacts) {
    if (c.last_contact_date) {
      totalDays += Math.floor(
        (now.getTime() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24)
      );
    } else {
      contactsNeverContacted++;
      totalDays += Math.floor(
        (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }
  const averageDaysSinceContact = contacts.length > 0 ? Math.round(totalDays / contacts.length) : 0;

  const hotPercent = warmthPercent.hot;
  const recentActivityScore = Math.min(interactionsLast7d * 20, 100);
  const neverContactedPenalty = contacts.length > 0
    ? Math.round((contactsNeverContacted / contacts.length) * 100)
    : 0;
  const networkHealthScore = Math.min(100, Math.max(0, Math.round(
    (hotPercent * 0.3) + (completionRate * 0.3) + (recentActivityScore * 0.25) + ((100 - neverContactedPenalty) * 0.15)
  )));

  return {
    totalContacts: contacts.length,
    warmthDistribution,
    warmthPercent,
    totalActions: actions.length,
    actionsDone,
    actionsSkipped,
    actionsPending,
    completionRate,
    totalInteractions: interactions.length,
    interactionsLast7d,
    interactionsLast30d,
    weeklyActivity,
    averageDaysSinceContact,
    contactsNeverContacted,
    networkHealthScore,
  };
}
