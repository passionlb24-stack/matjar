// Shared types for the Business Leaders directory (Hub). Used by the public
// directory, the profile page, the submission form, and the admin queue.

export type LeaderCompany = { name: string; role?: string; year?: string };

export type LeaderSocials = {
  linkedin?: string;
  instagram?: string;
  x?: string;
  facebook?: string;
  youtube?: string;
};

export type Leader = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  cover_url: string | null;
  website: string | null;
  location: string | null;
  socials: LeaderSocials;
  companies: LeaderCompany[];
  achievements: string[];
  published: boolean;
};

// Columns to select for a full profile.
export const LEADER_COLUMNS =
  "id, slug, name, name_en, headline, bio, photo_url, cover_url, website, location, socials, companies, achievements, published";

// Columns for a directory/list card (lighter).
export const LEADER_CARD_COLUMNS =
  "id, slug, name, name_en, headline, photo_url, cover_url, location";

export type LeaderCard = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  headline: string | null;
  photo_url: string | null;
  cover_url: string | null;
  location: string | null;
};
