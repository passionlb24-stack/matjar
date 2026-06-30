// Shared catalog metadata for the 6 business modules, plus demo stores and
// products used across the public pages until real data is wired from Supabase.

export const categoryKeys = [
  "food",
  "retail",
  "services",
  "healthcare",
  "realEstate",
  "automotive",
] as const;

export type CategoryKey = (typeof categoryKeys)[number];

export type Bilingual = { ar: string; en: string };

// Full Tailwind class strings (literal so the scanner keeps them).
export const categoryStyles: Record<
  CategoryKey,
  { cover: string; iconWrap: string }
> = {
  food: { cover: "from-amber-100 to-orange-100", iconWrap: "bg-amber-500/10 text-amber-600" },
  retail: { cover: "from-violet-100 to-fuchsia-100", iconWrap: "bg-violet-500/10 text-violet-600" },
  services: { cover: "from-sky-100 to-blue-100", iconWrap: "bg-sky-500/10 text-sky-600" },
  healthcare: { cover: "from-emerald-100 to-teal-100", iconWrap: "bg-emerald-500/10 text-emerald-600" },
  realEstate: { cover: "from-rose-100 to-pink-100", iconWrap: "bg-rose-500/10 text-rose-600" },
  automotive: { cover: "from-slate-100 to-zinc-200", iconWrap: "bg-slate-500/10 text-slate-600" },
};

export type RegionKey =
  | "beirut"
  | "mountLebanon"
  | "north"
  | "south"
  | "bekaa";

export const regions: { key: RegionKey; name: Bilingual }[] = [
  { key: "beirut", name: { ar: "بيروت", en: "Beirut" } },
  { key: "mountLebanon", name: { ar: "جبل لبنان", en: "Mount Lebanon" } },
  { key: "north", name: { ar: "الشمال", en: "North" } },
  { key: "south", name: { ar: "الجنوب", en: "South" } },
  { key: "bekaa", name: { ar: "البقاع", en: "Bekaa" } },
];

export type Store = {
  id: string;
  name: Bilingual;
  area: Bilingual;
  region?: RegionKey;
  category: CategoryKey;
  rating?: number;
  reviews?: number;
  isOpen: boolean;
  plan?: "free" | "pro";
  favorited?: boolean;
  tag?: Bilingual;
  description?: Bilingual;
};

// Kept for back-compat with the StoreCard component prop type.
export type FeaturedStore = Store;

export const stores: Store[] = [
  {
    id: "1",
    name: { ar: "مطعم بيت الزيتون", en: "Beit El Zeitoun" },
    area: { ar: "الأشرفية، بيروت", en: "Achrafieh, Beirut" },
    region: "beirut",
    category: "food",
    rating: 4.8,
    reviews: 326,
    isOpen: true,
    tag: { ar: "توصيل مجاني", en: "Free delivery" },
    description: {
      ar: "مأكولات لبنانية أصيلة، محضّرة طازة يومياً من قلب الأشرفية.",
      en: "Authentic Lebanese cuisine, freshly prepared daily in the heart of Achrafieh.",
    },
  },
  {
    id: "2",
    name: { ar: "متجر نون للإلكترونيات", en: "Noon Electronics" },
    area: { ar: "جونية، كسروان", en: "Jounieh, Keserwan" },
    region: "mountLebanon",
    category: "retail",
    rating: 4.6,
    reviews: 184,
    isOpen: true,
    description: {
      ar: "أحدث الهواتف والإلكترونيات بأسعار منافسة وضمان رسمي.",
      en: "The latest phones and electronics at competitive prices with official warranty.",
    },
  },
  {
    id: "3",
    name: { ar: "عيادة د. سارة حداد", en: "Dr. Sara Haddad Clinic" },
    area: { ar: "صيدا، الجنوب", en: "Saida, South" },
    region: "south",
    category: "healthcare",
    rating: 4.9,
    reviews: 97,
    isOpen: false,
    description: {
      ar: "عيادة جلدية وتجميل، حجز مواعيد أونلاين بكل سهولة.",
      en: "Dermatology and aesthetics clinic with easy online appointment booking.",
    },
  },
  {
    id: "4",
    name: { ar: "كراج الأمين للصيانة", en: "Al Amin Auto Care" },
    area: { ar: "طرابلس، الشمال", en: "Tripoli, North" },
    region: "north",
    category: "automotive",
    rating: 4.7,
    reviews: 142,
    isOpen: true,
    tag: { ar: "حجز موعد", en: "Book a slot" },
    description: {
      ar: "صيانة شاملة لكل أنواع السيارات على يد فنّيين خبراء.",
      en: "Complete maintenance for all car types by expert technicians.",
    },
  },
  {
    id: "5",
    name: { ar: "حلويات الصفا", en: "Al Safa Sweets" },
    area: { ar: "زحلة، البقاع", en: "Zahle, Bekaa" },
    region: "bekaa",
    category: "food",
    rating: 4.9,
    reviews: 411,
    isOpen: true,
    tag: { ar: "الأكثر مبيعاً", en: "Bestseller" },
  },
  {
    id: "6",
    name: { ar: "بوتيك لمى للأزياء", en: "Lama Fashion Boutique" },
    area: { ar: "الحمرا، بيروت", en: "Hamra, Beirut" },
    region: "beirut",
    category: "retail",
    rating: 4.5,
    reviews: 128,
    isOpen: true,
  },
  {
    id: "7",
    name: { ar: "مكتب الإعمار العقاري", en: "Al Imar Real Estate" },
    area: { ar: "بعبدا، جبل لبنان", en: "Baabda, Mount Lebanon" },
    region: "mountLebanon",
    category: "realEstate",
    rating: 4.4,
    reviews: 73,
    isOpen: true,
    tag: { ar: "شقق وأراضٍ", en: "Apartments & land" },
  },
  {
    id: "8",
    name: { ar: "شركة النظافة المثالية", en: "Perfect Cleaning Co." },
    area: { ar: "جبيل، جبل لبنان", en: "Byblos, Mount Lebanon" },
    region: "mountLebanon",
    category: "services",
    rating: 4.7,
    reviews: 156,
    isOpen: false,
    tag: { ar: "حجز خدمة", en: "Book service" },
  },
];

export const featuredStores: Store[] = stores.slice(0, 4);

// Show the demo/sample stores alongside real ones while the platform fills up.
// Off for launch: only real, approved stores are shown. Flip to true locally if
// you want the sample catalog back while developing.
export const SHOW_DEMO_STORES = false;

export function getStoreById(id: string): Store | undefined {
  return stores.find((store) => store.id === id);
}

export type Product = { name: Bilingual; price: number };

// Demo products/services shown on a store page, by business module.
export const sampleProducts: Record<CategoryKey, Product[]> = {
  food: [
    { name: { ar: "وجبة مشاوي مشكّلة", en: "Mixed grill plate" }, price: 14 },
    { name: { ar: "تبّولة طازة", en: "Fresh tabbouleh" }, price: 6 },
    { name: { ar: "حمّص باللحمة", en: "Hummus with meat" }, price: 8 },
    { name: { ar: "عصير ليمون بالنعنع", en: "Mint lemonade" }, price: 4 },
  ],
  retail: [
    { name: { ar: "سمّاعات لاسلكية", en: "Wireless earbuds" }, price: 45 },
    { name: { ar: "شاحن سريع 65W", en: "65W fast charger" }, price: 22 },
    { name: { ar: "غطاء حماية للهاتف", en: "Protective phone case" }, price: 12 },
    { name: { ar: "ساعة ذكية", en: "Smart watch" }, price: 89 },
  ],
  services: [
    { name: { ar: "تنظيف منزل كامل", en: "Full home cleaning" }, price: 60 },
    { name: { ar: "تنظيف مكتب", en: "Office cleaning" }, price: 80 },
    { name: { ar: "تنظيف بعد الترميم", en: "Post-renovation cleaning" }, price: 120 },
  ],
  healthcare: [
    { name: { ar: "استشارة جلدية", en: "Dermatology consultation" }, price: 40 },
    { name: { ar: "جلسة تنظيف بشرة", en: "Facial treatment" }, price: 55 },
    { name: { ar: "فحص شامل", en: "Full check-up" }, price: 70 },
  ],
  realEstate: [
    { name: { ar: "شقة 140م² للبيع", en: "140m² apartment for sale" }, price: 165000 },
    { name: { ar: "شقة 90م² للإيجار", en: "90m² apartment for rent" }, price: 650 },
  ],
  automotive: [
    { name: { ar: "تغيير زيت وفلتر", en: "Oil and filter change" }, price: 35 },
    { name: { ar: "فحص ميكانيكي شامل", en: "Full mechanical check" }, price: 25 },
    { name: { ar: "تبديل إطارات", en: "Tire replacement" }, price: 90 },
  ],
};
