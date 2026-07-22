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
  headline_en: string | null;
  bio: string | null;
  bio_en: string | null;
  long_bio: string | null;
  long_bio_en: string | null;
  photo_url: string | null;
  cover_url: string | null;
  website: string | null;
  location: string | null;
  sector: string | null;
  country: string | null;
  company: string | null;
  company_en: string | null;
  company_description: string | null;
  company_description_en: string | null;
  profile_type: string | null;
  socials: LeaderSocials;
  companies: LeaderCompany[];
  achievements: string[];
  source_urls: string[];
  published: boolean;
};

// Columns to select for a full profile.
export const LEADER_COLUMNS =
  "id, slug, name, name_en, headline, headline_en, bio, bio_en, long_bio, long_bio_en, photo_url, cover_url, website, location, sector, country, company, company_en, company_description, company_description_en, profile_type, socials, companies, achievements, source_urls, published";

// Columns for a directory/list card (lighter).
export const LEADER_CARD_COLUMNS =
  "id, slug, name, name_en, headline, photo_url, cover_url, location, sector, company, company_en, profile_type, featured";

export type LeaderCard = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  headline: string | null;
  photo_url: string | null;
  cover_url: string | null;
  location: string | null;
  sector: string | null;
  company: string | null;
  company_en: string | null;
  profile_type: string | null;
  featured: boolean;
};
