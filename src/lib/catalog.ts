// Shared catalog metadata for the 6 business modules, plus demo featured
// stores used on the landing page until real data is wired from Supabase.

export const categoryKeys = [
  "food",
  "retail",
  "services",
  "healthcare",
  "realEstate",
  "automotive",
] as const;

export type CategoryKey = (typeof categoryKeys)[number];

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

export type Bilingual = { ar: string; en: string };

export type FeaturedStore = {
  id: string;
  name: Bilingual;
  area: Bilingual;
  category: CategoryKey;
  rating: number;
  reviews: number;
  isOpen: boolean;
  tag?: Bilingual;
};

export const featuredStores: FeaturedStore[] = [
  {
    id: "1",
    name: { ar: "مطعم بيت الزيتون", en: "Beit El Zeitoun" },
    area: { ar: "الأشرفية، بيروت", en: "Achrafieh, Beirut" },
    category: "food",
    rating: 4.8,
    reviews: 326,
    isOpen: true,
    tag: { ar: "توصيل مجاني", en: "Free delivery" },
  },
  {
    id: "2",
    name: { ar: "متجر نون للإلكترونيات", en: "Noon Electronics" },
    area: { ar: "جونية، كسروان", en: "Jounieh, Keserwan" },
    category: "retail",
    rating: 4.6,
    reviews: 184,
    isOpen: true,
  },
  {
    id: "3",
    name: { ar: "عيادة د. سارة حداد", en: "Dr. Sara Haddad Clinic" },
    area: { ar: "صيدا، الجنوب", en: "Saida, South" },
    category: "healthcare",
    rating: 4.9,
    reviews: 97,
    isOpen: false,
  },
  {
    id: "4",
    name: { ar: "كراج الأمين للصيانة", en: "Al Amin Auto Care" },
    area: { ar: "طرابلس، الشمال", en: "Tripoli, North" },
    category: "automotive",
    rating: 4.7,
    reviews: 142,
    isOpen: true,
    tag: { ar: "حجز موعد", en: "Book a slot" },
  },
];
