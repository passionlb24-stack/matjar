import {
  Anvil,
  Armchair,
  Axe,
  Battery,
  BatteryCharging,
  Bug,
  Building2,
  Car,
  CircleDot,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Frame,
  Hammer,
  HardHat,
  Heater,
  Home,
  LayoutGrid,
  Package,
  PaintRoller,
  Paintbrush,
  Plug,
  Refrigerator,
  Ruler,
  SatelliteDish,
  Snowflake,
  Sofa,
  Sparkles,
  Sprout,
  Sun,
  Trees,
  Truck,
  Umbrella,
  Utensils,
  Warehouse,
  WashingMachine,
  Waves,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

// The taxonomy's icons, chosen in code.
//
// The trades and trade_groups tables carry an emoji per row, and for a while
// the pages rendered it. Emoji have no consistent weight, colour or baseline —
// forty of them on one page reads like a toy. The DB column stays (nothing
// migrates), the pages just stop reading it: every slug resolves to a Lucide
// glyph here, drawn in one style inside one container style, and an unknown
// slug quietly gets the wrench rather than a hole in the layout.

const GROUP_ICONS: Record<string, LucideIcon> = {
  home: Home,
  cooling: Snowflake,
  appliances: Plug,
  energy: Zap,
  auto: Car,
  cleaning: Sparkles,
  moving: Truck,
  outdoor: Trees,
  building: Hammer,
};

const TRADE_ICONS: Record<string, LucideIcon> = {
  // home — صيانة البيت
  electrician: Zap,
  plumber: Droplets,
  carpenter: Hammer,
  painter: Paintbrush,
  tiler: LayoutGrid,
  plasterer: PaintRoller,
  blacksmith: Anvil,
  aluminium: Frame,
  glazier: Frame,
  "doors-windows": DoorOpen,
  waterproofing: Umbrella,
  // cooling — تكييف وتبريد
  "ac-install": Snowflake,
  "ac-service": Fan,
  "fridge-repair": Refrigerator,
  "cold-rooms": Warehouse,
  // appliances — صيانة الأجهزة
  "washer-repair": WashingMachine,
  "dishwasher-repair": Utensils,
  "oven-repair": Flame,
  "heater-repair": Heater,
  "appliance-general": Plug,
  // energy — كهربا ومي
  generator: BatteryCharging,
  solar: Sun,
  inverter: Battery,
  "water-pump": Waves,
  "water-tank": Droplets,
  "satellite-net": SatelliteDish,
  // auto — السيارات
  mechanic: Wrench,
  "auto-electric": Zap,
  tyres: CircleDot,
  "car-battery": Battery,
  "car-glass": Car,
  "car-wash": Sparkles,
  towing: Truck,
  // cleaning — تنظيف
  "home-cleaning": Sparkles,
  "office-cleaning": Building2,
  "post-construction": HardHat,
  "sofa-carpet": Armchair,
  "pest-control": Bug,
  // moving — نقل وتركيب
  "furniture-moving": Truck,
  "goods-transport": Package,
  "furniture-assembly": Sofa,
  // outdoor — حدائق وخارجي
  landscaping: Trees,
  "tree-cutting": Axe,
  irrigation: Sprout,
  // building — بناء وترميم
  construction: HardHat,
  renovation: Hammer,
  contracting: Ruler,
};

/** Icon for a trade group; the wrench for anything unmapped. */
export function groupIcon(slug: string): LucideIcon {
  return GROUP_ICONS[slug] ?? Wrench;
}

/**
 * Icon for a trade. Falls back to the trade's group icon when the trade slug
 * is new to this map, and to the wrench when both are unknown — a freshly
 * seeded trade renders sensibly before anyone updates this file.
 */
export function tradeIcon(slug: string, groupSlug?: string): LucideIcon {
  return (
    TRADE_ICONS[slug] ?? (groupSlug ? GROUP_ICONS[groupSlug] : undefined) ?? Wrench
  );
}
