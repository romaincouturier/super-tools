export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  location_type: "physical" | "visio";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventMedia {
  id: string;
  event_id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video_link";
  mime_type: string | null;
  file_size: number | null;
  position: number;
  created_by: string | null;
  created_at: string;
}
