export type WarmthLevel = "hot" | "warm" | "cold";
export type ConversationPhase = "onboarding" | "cartography";

export interface NetworkContact {
  id: string;
  user_id: string;
  name: string;
  context: string | null;
  warmth: WarmthLevel;
  linkedin_url: string | null;
  last_contact_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface NetworkAction {
  id: string;
  user_id: string;
  contact_id: string;
  action_type: string;
  message_draft: string | null;
  scheduled_week: string | null;
  status: "pending" | "done" | "skipped";
  result: string | null;
  done_at: string | null;
  created_at: string;
}

export interface UserPositioning {
  id: string;
  user_id: string;
  pitch_one_liner: string | null;
  key_skills: string[];
  target_client: string | null;
  onboarding_completed_at: string | null;
  updated_at: string;
}

export interface NetworkMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  phase: ConversationPhase;
  created_at: string;
}

export interface ExtractedContact {
  name: string;
  context: string;
  warmth: WarmthLevel;
}

export interface NetworkAIResponse {
  reply: string;
  positioning?: {
    pitch_one_liner: string;
    key_skills: string[];
    target_client: string;
  };
  contacts?: ExtractedContact[];
}

export type ActionType = "linkedin_message" | "email" | "phone_call" | "coffee_invite" | "share_content";

export interface GeneratedAction {
  contact_id: string;
  contact_name: string;
  action_type: ActionType;
  reason: string;
  message_draft: string;
}

export interface NetworkActionWithContact extends NetworkAction {
  contact?: NetworkContact;
}

export interface NetworkInteraction {
  id: string;
  user_id: string;
  contact_id: string;
  interaction_type: string;
  notes: string | null;
  created_at: string;
}

export interface CoolingThresholds {
  hot: number;
  warm: number;
  cold: number;
}

export interface CoolingContact {
  contact: NetworkContact;
  daysSinceLastContact: number;
  threshold: number;
  isOverdue: boolean;
}

export interface NetworkStats {
  totalContacts: number;
  warmthDistribution: Record<WarmthLevel, number>;
  warmthPercent: Record<WarmthLevel, number>;
  totalActions: number;
  actionsDone: number;
  actionsSkipped: number;
  actionsPending: number;
  completionRate: number;
  totalInteractions: number;
  interactionsLast7d: number;
  interactionsLast30d: number;
  weeklyActivity: { week: string; count: number }[];
  averageDaysSinceContact: number;
  contactsNeverContacted: number;
  networkHealthScore: number;
}
