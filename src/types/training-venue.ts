export interface TrainingVenue {
  id: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  email: string;
  room_name: string | null;
  formal_address: boolean;
  created_at: string;
}
