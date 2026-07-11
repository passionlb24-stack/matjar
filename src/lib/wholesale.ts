export const WHOLESALE_CATEGORIES = [
  "food",
  "beverages",
  "clothing",
  "electronics",
  "household",
  "cosmetics",
  "hardware",
  "stationery",
  "other",
] as const;

export type WholesaleCategory = (typeof WHOLESALE_CATEGORIES)[number];

export type PriceTier = { qty: number; price: number };

export type WholesaleProduct = {
  id: string;
  seller_id: string;
  seller_name: string | null;
  title: string;
  description: string;
  category: string | null;
  image_url: string | null;
  unit: string | null;
  moq: number | null;
  price: number | null;
  tiers: PriceTier[];
  region: string | null;
  status: string;
  created_at: string;
};
