"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  EyeOff,
  Trash2,
  ExternalLink,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction } from "@/lib/audit";
import { notifyError } from "@/lib/notify";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";

// One normalized shape for any user-generated listing (job / gig / wholesale).
// Each admin page maps its own table rows into this and hands them to this
// single, config-driven moderation surface — adding a new moderated vertical is
// a new page + a table name, not a new screen.
export type ModerationItem = {
  id: string;
  title: string;
  author: string | null; // company / freelancer / seller name
  meta: string | null; // category · region · price, already formatted
  image: string | null;
  status: string; // 'active' = public; anything else = not shown publicly
  createdAt: string;
};

// Tables this component is allowed to moderate. Keeping it a literal union means
// the (untyped) Supabase call stays honest about what can be written.
export type ModerationTable = "job_postings" | "gigs" | "wholesale_products";

const TABS = ["all", "active", "hidden"] as const;
type Tab = (typeof TABS)[number];

export function AdminModerationClient({
  lang,
  dict,
  table,
  icon: Icon,
  title,
  subtitle,
  viewBase,
  items,
}: {
  lang: Locale;
  dict: Dictionary;
  table: ModerationTable;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  viewBase: string; // public route segment, e.g. "jobs" | "freelance" | "wholesale"
  items: ModerationItem[];
}) {
  const router = useRouter();
  const t = dict.admin.moderation;
  const entity = {
    job_postings: "job",
    gigs: "gig",
    wholesale_products: "wholesale",
  }[table] as "job" | "gig" | "wholesale";
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let active = 0;
    let hidden = 0;
    for (const it of items) {
      if (it.status === "active") active++;
      else hidden++;
    }
    return { all: items.length, active, hidden };
  }, [items]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((it) => {
      const matchTab =
        tab === "all"
          ? true
          : tab === "active"
            ? it.status === "active"
            : it.status !== "active";
      const matchQ =
        !query ||
        it.title.toLowerCase().includes(query) ||
        (it.author ?? "").toLowerCase().includes(query);
      return matchTab && matchQ;
    });
  }, [items, tab, q]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    const { error } = await createClient()
      .from(table)
      .update({ status })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    void logAdminAction(status === "active" ? "published" : "hidden", entity, id);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    setBusyId(id);
    const { error } = await createClient().from(table).delete().eq("id", id);
    setBusyId(null);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    void logAdminAction("deleted", entity, id);
    router.refresh();
  }

  return (
    <div className="py-10">
      <Container>
        <PageHeader icon={Icon} title={title} subtitle={subtitle} />

        <div className="grid grid-cols-3 gap-3">
          <Stat label={t.total} value={counts.all.toLocaleString("en-US")} />
          <Stat label={t.public} value={counts.active.toLocaleString("en-US")} />
          <Stat label={t.hidden} value={counts.hidden.toLocaleString("en-US")} />
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {TABS.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.tabs[s]}
              <span className="ms-1.5 opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>

        <div className="relative mt-4 max-w-sm">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState className="mt-6" icon={Icon} title={t.empty} />
        ) : (
          <div data-animate className="mt-6 space-y-2">
            {filtered.map((it) => {
              const isPublic = it.status === "active";
              return (
                <Card key={it.id}>
                  <CardBody className="flex flex-wrap items-center gap-4 p-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                      {it.image ? (
                        <Image
                          src={it.image}
                          alt=""
                          width={64}
                          height={64}
                          className="h-16 w-16 object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-foreground/10" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{it.title}</span>
                        <Badge
                          variant={isPublic ? "success" : "neutral"}
                          size="sm"
                        >
                          {isPublic ? t.tabs.active : t.hiddenBadge}
                        </Badge>
                        {it.author && (
                          <Badge variant="neutral" size="sm">
                            {it.author}
                          </Badge>
                        )}
                      </div>
                      {it.meta && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {it.meta}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <ButtonLink
                        href={`/${lang}/${viewBase}/${it.id}`}
                        target="_blank"
                        variant="secondary"
                        size="sm"
                        aria-label={t.view}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </ButtonLink>
                      {isPublic ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === it.id}
                          onClick={() => setStatus(it.id, "hidden")}
                          leftIcon={<EyeOff className="h-3.5 w-3.5" />}
                          className="!text-danger"
                        >
                          {t.hide}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busyId === it.id}
                          onClick={() => setStatus(it.id, "active")}
                          leftIcon={<Check className="h-3.5 w-3.5" />}
                        >
                          {t.approve}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === it.id}
                        onClick={() => remove(it.id)}
                        aria-label={t.delete}
                        className="!text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
