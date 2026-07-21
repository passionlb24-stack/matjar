import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isPro } from "@/lib/plan";
import { getStorePlan } from "@/lib/plan-server";
import { ProGate } from "@/components/pro-gate";
import { Container } from "@/components/ui/container";
import { HUB_TOOLS, HUB_TOOL_CATEGORIES } from "@/lib/hub-tools";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Business tools live inside the merchant dashboard as a Pro perk.
export default async function StoreToolsPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);
  const { data: canManage } = await supabase.rpc("can_manage_store", {
    p_store_id: storeId,
  });
  if (!canManage) redirect(`/${lang}/merchant`);

  if (!isPro(await getStorePlan(storeId))) {
    return <ProGate lang={lang} dict={dict} storeId={storeId} />;
  }

  const h = dict.hub;
  const base = `/${lang}/merchant/${storeId}`;

  return (
    <div className="py-10">
      <Container>
        <Link
          href={base}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.dashboard.panel}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{h.toolsTitle}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{h.toolsSubtitle}</p>

        <div className="mt-8 space-y-10">
          {HUB_TOOL_CATEGORIES.map((cat) => {
            const tools = HUB_TOOLS.filter((t) => t.category === cat);
            if (!tools.length) return null;
            return (
              <section key={cat}>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  {h.categories[cat]}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => {
                    const td = h.tools[tool.slug as keyof typeof h.tools];
                    const Icon = tool.Icon;
                    return (
                      <Link
                        key={tool.slug}
                        href={`${base}/tools/${tool.slug}`}
                        className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                      >
                        <span className={`grid h-12 w-12 place-items-center rounded-xl ${tool.tint}`}>
                          <Icon className="h-6 w-6" />
                        </span>
                        <h3 className="mt-4 font-bold transition-colors group-hover:text-primary">{td.name}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{td.desc}</p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
