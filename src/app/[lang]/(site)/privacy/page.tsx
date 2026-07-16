import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
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

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const points =
    lang === "ar"
      ? [
          "نجمع فقط المعلومات اللازمة لتشغيل الخدمة: حسابك، طلباتك، وحجوزاتك.",
          "ما منشارك بياناتك مع أطراف ثالثة لأغراض تسويقية.",
          "كلمات المرور مشفّرة، والوصول للبيانات محمي بصلاحيات صارمة.",
          "فيك تطلب تعديل أو حذف بياناتك بأي وقت عبر التواصل معنا.",
        ]
      : [
          "We collect only the information needed to run the service: your account, orders, and bookings.",
          "We do not share your data with third parties for marketing purposes.",
          "Passwords are encrypted and data access is protected by strict permissions.",
          "You can request to edit or delete your data at any time by contacting us.",
        ];

  return (
    <div className="py-14">
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.footer.links.privacy}
        </h1>
        <ul className="mt-5 space-y-3">
          {points.map((p) => (
            <li key={p} className="leading-8 text-muted-foreground">
              • {p}
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
