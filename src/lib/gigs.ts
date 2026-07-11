export const GIG_CATEGORIES = [
  "design",
  "photography",
  "video",
  "writing",
  "voice",
  "acting",
  "programming",
  "tutoring",
  "other",
] as const;

export type GigCategory = (typeof GIG_CATEGORIES)[number];

export type Gig = {
  id: string;
  freelancer_id: string;
  freelancer_name: string | null;
  title: string;
  description: string;
  category: string | null;
  price: number | null;
  delivery_days: number | null;
  image_url: string | null;
  region: string | null;
  status: string;
  created_at: string;
};
