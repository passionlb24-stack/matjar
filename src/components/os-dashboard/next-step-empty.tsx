import {
  Package,
  Plus,
  ExternalLink,
  Calculator,
  LayoutDashboard,
  MessageCircle,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  getSector,
  OS_MODULE_META,
  sectorPrimarySetup,
  type OsModuleKey,
} from "@/lib/sectors";
import { getStoreReadiness, canOffer } from "@/lib/store-readiness";
import {
  ModuleEmpty,
  type EmptyAction,
} from "@/components/os-dashboard/module-empty";

// ===== Onboarding guidance, wherever the merchant actually is =====
//
// ISS-034: the checklist and the rule-based suggestions are good, and they live
// only on the OS home. A merchant who clicks a sidebar module leaves all of it
// behind and lands on a dashed box. This is that guidance, resolved per module
// and per store state, rendered at the exact moment the merchant is staring at
// nothing — no wizard, no tour, no modal to skip: the page simply says what is
// true about this store and hands over the control that changes it.
//
// An async server component so it costs nothing when the module has data: pages
// render it only in the empty branch, so the two queries behind it never run on
// a working screen.

/** Modules whose emptiness is a customer-hasn't-arrived-yet problem. */
// `tickets` is deliberately absent: for an events store the catalogue IS the
// ticket types, so "add your first item" would link the page back to itself.
export type NextStepModule =
  | "orders"
  | "bookings"
  | "requests"
  | "leads"
  | "stays"
  // Same shape as `stays`: the fleet is the setup step and this screen is where
  // the customer's absence shows. `vehicles` is deliberately absent for the
  // same reason `tickets` is — for an automotive store the fleet IS the primary
  // setup entity, so its empty state would link the page back to itself.
  | "rentals"
  | "members"
  | "customers"
  | "reports";

export async function NextStepEmpty({
  lang,
  dict,
  storeId,
  module,
  title,
  className,
}: {
  lang: Locale;
  dict: Dictionary;
  storeId: string;
  module: NextStepModule;
  /** The fact, in the module's own existing words ("no orders yet"). */
  title: string;
  className?: string;
}) {
  const t = dict.os.nextStep;
  const base = `/${lang}/merchant/${storeId}`;
  const readiness = await getStoreReadiness(lang, storeId);

  const Icon = OS_MODULE_META[module as OsModuleKey]?.Icon ?? Package;

  // The store row vanished under us (deleted mid-session, or an RLS edge). Say
  // the one thing we still know rather than inventing a next step.
  if (!readiness) {
    return <ModuleEmpty Icon={Icon} title={title} className={className} />;
  }
  const category = readiness.category;

  // Where "add your first thing" actually points: a hotel's rooms, an
  // organiser's ticket types, everyone else's catalogue. The sector's own label
  // is already an imperative ("Add your first unit"), so it is the button.
  const primarySetup = sectorPrimarySetup(category);
  const addHref = primarySetup
    ? `${base}/${OS_MODULE_META[primarySetup.module].path}`
    : `${base}/items`;
  const addLabel = primarySetup
    ? dict.merchant.checklist[primarySetup.labelKey]
    : t.addFirstItem;

  // ---- Switched off. Nothing here is the merchant's to fix from this page ----
  if (readiness.stage === "blocked") {
    return (
      <ModuleEmpty
        Icon={Icon}
        title={title}
        note={t.stoppedNote}
        noteKind="danger"
        primary={{
          key: "home",
          href: base,
          label: t.openDashboard,
          Icon: LayoutDashboard,
        }}
        className={className}
      />
    );
  }

  // ---- Waiting on review. Nobody can reach the page, so nothing can arrive ---
  // Anything that is not live and not blocked is a waiting room — written as
  // "not live" rather than "=== review" so a fourth status added upstream lands
  // in the honest branch instead of being told to go share a link that 404s.
  if (readiness.stage !== "live") {
    return (
      <ModuleEmpty
        Icon={Icon}
        title={title}
        body={readiness.offerings === 0 ? t.setupBody : t.reviewBody}
        note={t.reviewNote}
        primary={{ key: "add", href: addHref, label: addLabel, Icon: Plus }}
        className={className}
      />
    );
  }

  // ---- Live, empty catalogue. Nothing exists to be ordered ------------------
  if (readiness.offerings === 0) {
    return (
      <ModuleEmpty
        Icon={Icon}
        title={title}
        body={t.setupBody}
        primary={{ key: "add", href: addHref, label: addLabel, Icon: Plus }}
        secondary={
          readiness.storePath
            ? [
                {
                  key: "view",
                  href: readiness.storePath,
                  label: dict.os.viewPublic,
                  Icon: ExternalLink,
                },
              ]
            : []
        }
        className={className}
      />
    );
  }

  // ---- Live, stocked, and nobody has come. A distribution problem -----------
  // WhatsApp is how a Lebanese shop actually sends a link, and a plain anchor
  // keeps this server-rendered — no client component, no dictionary shipped to
  // the browser for one button.
  const waHref = `https://wa.me/?text=${encodeURIComponent(
    `${t.shareMessage.replace("{store}", readiness.storeName)} ${readiness.storeUrl ?? ""}`.trim(),
  )}`;

  const secondary: EmptyAction[] = [];
  if (readiness.storePath)
    secondary.push({
      key: "view",
      href: readiness.storePath,
      label: dict.os.viewPublic,
      Icon: ExternalLink,
    });
  // The till is a real way to make the first sale exist — but only offered to a
  // store that can actually open it. Pointing a free merchant at a paywall is
  // the thing this whole change is meant to stop doing.
  const sectorModules = new Set(
    Object.values(getSector(category).modules).flat(),
  );
  if (
    module === "orders" &&
    sectorModules.has("pos") &&
    canOffer(readiness, "pro")
  )
    secondary.push({
      key: "pos",
      href: `${base}/pos`,
      label: t.recordSale,
      Icon: Calculator,
    });

  return (
    <ModuleEmpty
      Icon={Icon}
      title={title}
      body={t.liveBody.replace("{n}", String(readiness.offerings))}
      primary={{
        key: "share",
        href: waHref,
        label: t.shareWhatsapp,
        Icon: MessageCircle,
        external: true,
      }}
      secondary={secondary}
      className={className}
    />
  );
}
