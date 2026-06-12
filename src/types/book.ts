export interface BookProfile {
  id: string;
  user_id: string;
  photo_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookAlbum {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // computed
  production_count?: number;
}

export interface BookProduction {
  id: string;
  album_id: string;
  user_id: string;
  title: string;
  file_url: string;
  thumbnail_url: string | null;
  file_type: "image" | "video";
  exif_date: string | null;
  exif_width: number | null;
  exif_height: number | null;
  original_filename: string | null;
  tags: string[];
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BookShareLink {
  id: string;
  album_id: string;
  user_id: string;
  prospect_name: string;
  token: string;
  revoked_at: string | null;
  created_at: string;
}

export interface BookAnalyticsEvent {
  id: string;
  link_id: string;
  event_type: "album_view" | "production_view";
  production_id: string | null;
  viewed_at: string;
}

export interface BookLinkStats {
  link: BookShareLink;
  total_views: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  productions_viewed: string[]; // production ids
}
