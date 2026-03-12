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
