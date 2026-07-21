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
import { getHubTool } from "@/lib/hub-tools";
import { ProfitCalculator } from "@/components/hub/profit-calculator";
import { PricingCalculator } from "@/components/hub/pricing-calculator";
import { QrGenerator } from "@/components/hub/qr-generator";
import { BarcodeGenerator } from "@/components/hub/barcode-generator";
import { InvoiceGenerator } from "@/components/hub/invoice-generator";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COMPONENTS: Record<string, (props: { dict: Dictionary }) => ReactNode> = {
  profit: ProfitCalculator,
  pricing: PricingCalculator,
  qr: QrGenerator,
  barcode: BarcodeGenerator,
  invoice: InvoiceGenerator,
};

export default async function StoreToolPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string; tool: string }>;
}) {
  const { lang, storeId, tool } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const meta = getHubTool(tool);
  const Comp = COMPONENTS[tool];
  if (!meta || !Comp) notFound();
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

  const td = dict.hub.tools[tool as keyof typeof dict.hub.tools];

  return (
    <div className="py-10">
      <Container className="max-w-4xl">
        <Link
          href={`/${lang}/merchant/${storeId}/tools`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.hub.toolsTitle}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{td.name}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{td.desc}</p>
        <div className="mt-8">
          <Comp dict={dict} />
        </div>
      </Container>
    </div>
  );
}
