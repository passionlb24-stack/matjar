import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { MessageCircle } from "lucide-react";
import { localeAlternates } from "@/lib/site";
import { supportWaLink } from "@/lib/support";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const title = lang === "ar" ? "سياسة الخصوصية" : "Privacy policy";
  const description =
    lang === "ar"
      ? "كيف نجمع بياناتك ونستخدمها ونحميها على منصّة متجر."
      : "How Matjar collects, uses, and protects your data.";
  return { title, description, alternates: localeAlternates(lang, "/privacy") };
}

// The old page was four bullets claiming we collect "only account, orders and
// bookings". The platform also records checkout intents, push subscriptions,
// visit analytics, search logs, staff GPS punches and device credentials — a
// policy that hides that is worse than none. This page describes what the code
// actually does, section by section, and says who sees each piece. It makes no
// retention promises the code does not keep.
type Section = { title: string; items: string[] };

const SECTIONS_EN: Section[] = [
  {
    title: "What we collect, and who sees it",
    items: [
      "Your account: name, email and an encrypted password (or your social sign-in). Seen by Matjar only.",
      "Orders and bookings: your name, phone number, delivery address and what you ordered. These go to the store or provider you are buying from — that is how they fulfil your order.",
      "Checkout details: when you tap the button to place an order, your phone number, name and cart are recorded for that store even if the order then fails or you close the page — so the store can follow up with you about the unfinished order, usually on WhatsApp.",
      "Craft and service requests: your description of the job, area, address, phone and any photos you attach go to the tradesman or provider you chose.",
      "Messages you exchange with stores and freelancers through the site.",
      "Push notifications: if you enable them, your browser's push subscription (a technical token, not your location or contacts).",
      "Store-visit analytics: an anonymous visitor identifier and a coarse \"where did this visit come from\" category, counted per store. This is not tied to your name or account.",
      "Searches: what you search for on the site is logged to improve results.",
      "Store staff only: clocking in and out records the time and the GPS position of the punch, plus a credential created by the device's fingerprint or face unlock. The employer sees the attendance record; the fingerprint itself never leaves the phone.",
    ],
  },
  {
    title: "Cookies and on-device storage",
    items: [
      "A session cookie keeps you signed in.",
      "Your cart, language choice and similar preferences are kept in your browser's local storage, on your device.",
    ],
  },
  {
    title: "What we do not do",
    items: [
      "We do not sell your data, and we do not share it with third parties for their marketing.",
      "Our hosting and database providers (Vercel, Supabase) process data on our behalf to run the service — they do not use it for their own purposes.",
    ],
  },
  {
    title: "Your requests",
    items: [
      "You can ask for a copy of the data we hold about you, ask us to correct it, or ask us to delete your account and its data.",
      "Message our support line on WhatsApp and we will handle it — the button below opens the chat.",
    ],
  },
];

const SECTIONS_AR: Section[] = [
  {
    title: "شو منجمع، ومين بيشوفو",
    items: [
      "حسابك: الاسم، الإيميل وكلمة مرور مشفّرة (أو دخولك عبر حساباتك الاجتماعية). بيشوفها متجر بس.",
      "الطلبات والحجوزات: اسمك، رقم تلفونك، عنوان التوصيل وشو طلبت. هيدي بتوصل للمتجر أو مقدّم الخدمة يلي عم تشتري منّو — هيك بيقدر يجهّزلك طلبك.",
      "تفاصيل الشراء: لمّا تكبس زر تأكيد الطلب، رقمك واسمك وسلّتك بينسجّلو عند هيدا المتجر حتى لو الطلب ما كمّل أو سكّرت الصفحة — ليقدر المتجر يتابع معك الطلب يلي ما خلص، عادةً عالواتساب.",
      "طلبات الحرفيين والخدمات: وصفك للشغلة، المنطقة، العنوان، رقمك وأي صور بتضيفها بتوصل للحرفي أو المقدّم يلي اخترتو.",
      "الرسائل يلي بتتبادلها مع المتاجر والمستقلين عبر الموقع.",
      "إشعارات الدفع (Push): إذا فعّلتها، منخزّن اشتراك المتصفح (رمز تقني، مش موقعك ولا جهات اتصالك).",
      "إحصاءات زيارات المتاجر: معرّف زائر مجهول وفئة عامة لـ\"من وين إجت الزيارة\"، بتنعدّ لكل متجر. هيدي مش مربوطة باسمك أو حسابك.",
      "البحث: شو بتفتّش عليه بالموقع بينسجّل لنحسّن النتائج.",
      "لموظفي المتاجر بس: تسجيل الدخول والخروج من الدوام بيسجّل الوقت وموقع GPS وقت البصمة، مع رمز من بصمة أو وجه الجهاز. صاحب العمل بيشوف سجل الدوام؛ أما البصمة نفسها فما بتطلع من التلفون أبداً.",
    ],
  },
  {
    title: "الكوكيز والتخزين على جهازك",
    items: [
      "كوكي الجلسة بيخلّيك مسجّل دخول.",
      "سلّتك، لغتك وتفضيلاتك المشابهة بتنحفظ بالتخزين المحلي لمتصفحك، على جهازك.",
    ],
  },
  {
    title: "شو ما منعمل",
    items: [
      "ما منبيع بياناتك، وما منشاركها مع أطراف ثالثة لأغراض تسويقهم.",
      "مزوّدو الاستضافة وقاعدة البيانات (Vercel وSupabase) بيعالجو البيانات لحسابنا لتشغيل الخدمة — ما بيستعملوها لأغراضهم.",
    ],
  },
  {
    title: "طلباتك",
    items: [
      "فيك تطلب نسخة من بياناتك، تطلب تصحيحها، أو تطلب حذف حسابك وبياناته.",
      "ابعتلنا على خط الدعم عالواتساب ومنمشّيلك ياها — الزر تحت بيفتح المحادثة.",
    ],
  },
];

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const sections = lang === "ar" ? SECTIONS_AR : SECTIONS_EN;
  const contactLabel =
    lang === "ar" ? "تواصل معنا عالواتساب" : "Message us on WhatsApp";
  const contactPrefill =
    lang === "ar"
      ? "مرحبا، عندي طلب بخصوص بياناتي الشخصية على متجر."
      : "Hello, I have a request about my personal data on Matjar.";

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-2xl">
        <div data-animate>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {dict.footer.links.privacy}
          </h1>
          {sections.map((s) => (
            <section key={s.title} className="mt-8">
              <h2 className="text-lg font-bold">{s.title}</h2>
              <ul className="mt-3 space-y-3">
                {s.items.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="leading-7 text-muted-foreground">{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <a
            href={supportWaLink(contactPrefill)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {contactLabel}
          </a>
        </div>
      </Container>
    </div>
  );
}
