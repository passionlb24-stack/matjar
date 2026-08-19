import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-client";
import {
  GUIDES,
  type Guide,
  type AcademyCategory,
  type GuideLevel,
  type GuideBlock,
} from "@/content/academy";
import { FETCH_BOUNDS, warnIfTruncated } from "./bounds";

type Row = {
  slug: string;
  category: string;
  level: string;
  title: string;
  title_en: string;
  excerpt: string;
  read_min: number;
  emoji: string;
  blocks: GuideBlock[] | null;
};

function toGuide(r: Row): Guide {
  return {
    slug: r.slug,
    category: r.category as AcademyCategory,
    level: (r.level as GuideLevel) || "beginner",
    title: r.title,
    titleEn: r.title_en,
    excerpt: r.excerpt,
    readMin: r.read_min,
    emoji: r.emoji,
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
  };
}

// Published academy guides are public + admin-managed (rarely change), and this
// read is also called from sitemap generation — so cache it cross-request (10min)
// with the cookie-less client. Tagged "academy" so an admin edit/publish can bust
// it. Returns [] on empty/error; the wrapper below falls back to the in-repo GUIDES.
const fetchAcademyGuides = unstable_cache(
  async (): Promise<Guide[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("academy_guides")
      .select(
        "slug, category, level, title, title_en, excerpt, read_min, emoji, blocks",
      )
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .limit(FETCH_BOUNDS.referenceRows);
    if (error || !data) return [];
    warnIfTruncated(data, FETCH_BOUNDS.referenceRows, "academy_guides");
    return (data as unknown as Row[]).map(toGuide);
  },
  ["academy-guides"],
  { revalidate: 600, tags: ["academy"] },
);

// DB-primary with a static fallback: if academy_guides is empty or the query
// errors, the public Academy falls back to the original in-repo GUIDES so the
// live surface can never blank out.
export async function getAcademyGuides(): Promise<Guide[]> {
  try {
    const guides = await fetchAcademyGuides();
    return guides.length > 0 ? guides : GUIDES;
  } catch {
    return GUIDES;
  }
}

export async function getAcademyGuide(slug: string): Promise<Guide | null> {
  const guides = await getAcademyGuides();
  return guides.find((g) => g.slug === slug) ?? null;
}
