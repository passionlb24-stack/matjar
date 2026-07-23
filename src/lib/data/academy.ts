import { createClient } from "@/lib/supabase/server";
import {
  GUIDES,
  type Guide,
  type AcademyCategory,
  type GuideLevel,
  type GuideBlock,
} from "@/content/academy";

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

// DB-primary with a static fallback: if academy_guides is empty or the query
// errors, the public Academy falls back to the original in-repo GUIDES so the
// live surface can never blank out. Once seeded, the DB is authoritative and the
// super admin can edit/publish guides without a code deploy.
export async function getAcademyGuides(): Promise<Guide[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_guides")
      .select(
        "slug, category, level, title, title_en, excerpt, read_min, emoji, blocks",
      )
      .eq("published", true)
      .order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) return GUIDES;
    return (data as unknown as Row[]).map(toGuide);
  } catch {
    return GUIDES;
  }
}

export async function getAcademyGuide(slug: string): Promise<Guide | null> {
  const guides = await getAcademyGuides();
  return guides.find((g) => g.slug === slug) ?? null;
}
