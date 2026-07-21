"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Sparkles, TrendingUp, Tag, Camera, MessageSquare, HeartHandshake, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  CATEGORY_STYLE,
  CATEGORY_ICON,
  RECOMMEND_TOPICS,
  RECOMMEND_MAP,
  type AcademyCategory,
  type GuideLevel,
  type RecommendTopic,
} from "@/content/academy";

export type LightGuide = {
  slug: string;
  title: string;
  titleEn: string;
  excerpt: string;
  readMin: number;
  category: AcademyCategory;
  level: GuideLevel;
};

const TOPIC_ICON: Record<RecommendTopic, LucideIcon> = {
  sales: TrendingUp,
  pricing: Tag,
  photos: Camera,
  whatsapp: MessageSquare,
  service: HeartHandshake,
  instagram: Share2,
};

// "What do you want to improve today?" — pills filter the guide grid to the
// recommended set for the chosen topic. Client-side, no network.
export function AcademyExplorer({
  guides,
  dict,
  lang,
}: {
  guides: LightGuide[];
  dict: Dictionary;
  lang: Locale;
}) {
  const a = dict.hub.academy;
  const [topic, setTopic] = useState<RecommendTopic | null>(null);

  const shown = topic
    ? guides.filter((g) => RECOMMEND_MAP[topic].includes(g.slug))
    : guides;

  return (
    <section className="mt-16">
      <div className="rounded-3xl border border-border bg-surface-muted/40 p-5 sm:p-6">
        <p className="flex items-center gap-2 font-extrabold">
          <Sparkles className="h-5 w-5 text-primary" />
          {a.recommendTitle}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {RECOMMEND_TOPICS.map((t) => {
            const Icon = TOPIC_ICON[t];
            const on = topic === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(on ? null : t)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  on
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface text-foreground hover:border-primary/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {a.topics[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((g) => {
          const s = CATEGORY_STYLE[g.category];
          const Icon = CATEGORY_ICON[g.category];
          return (
            <Link
              key={g.slug}
              href={`/${lang}/hub/academy/${g.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`relative h-20 border-b border-border/60 bg-gradient-to-bl ${s.grad} to-transparent`}>
                <span className={`absolute bottom-[-18px] end-4 grid h-11 w-11 place-items-center rounded-xl shadow-sm ${s.tint}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5 pt-6">
                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                  <span className={s.text}>{a.categories[g.category]}</span>
                  <span>·</span>
                  <span>{a.levels[g.level]}</span>
                </div>
                <h3 className="mt-2 font-bold leading-snug transition-colors group-hover:text-primary">
                  {lang === "en" ? g.titleEn : g.title}
                </h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{g.excerpt}</p>
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {a.readMin.replace("{n}", String(g.readMin))}
                  </span>
                  <span className="text-xs font-bold text-primary">{a.readArticle}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {shown.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {a.noResults}
        </p>
      )}
    </section>
  );
}
