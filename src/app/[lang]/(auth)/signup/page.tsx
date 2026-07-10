import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SignupForm } from "@/components/auth-forms";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  // SignupForm reads ?ref via useSearchParams, which needs a Suspense boundary
  // during prerender.
  return (
    <Suspense>
      <SignupForm lang={lang} dict={dict} />
    </Suspense>
  );
}
