"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const labelClass = "text-sm font-semibold";
const submitClass =
  "w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60";

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function LoginForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(dict.auth.errorInvalid);
      setLoading(false);
      return;
    }
    router.push(`/${lang}`);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <Header title={dict.auth.loginTitle} subtitle={dict.auth.loginSubtitle} />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="email">
            {dict.auth.email}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="name@email.com" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            {dict.auth.password}
          </label>
          <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className={fieldClass} />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? dict.auth.loading : dict.auth.loginButton}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {dict.auth.noAccount}{" "}
        <Link href={`/${lang}/signup`} className="font-bold text-primary hover:underline">
          {dict.auth.createOne}
        </Link>
      </p>
    </div>
  );
}

export function SignupForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
        data: { full_name: String(form.get("full_name")) },
        emailRedirectTo: `${window.location.origin}/${lang}`,
      },
    });
    if (error) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setSent(true);
      setLoading(false);
      return;
    }
    router.push(`/${lang}`);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <MailCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">{dict.auth.checkEmailTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dict.auth.checkEmail}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <Header title={dict.auth.signupTitle} subtitle={dict.auth.signupSubtitle} />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="full_name">
            {dict.auth.fullName}
          </label>
          <input id="full_name" name="full_name" type="text" required autoComplete="name" placeholder={dict.auth.fullNamePlaceholder} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">
            {dict.auth.email}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="name@email.com" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            {dict.auth.password}
          </label>
          <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="••••••••" className={fieldClass} />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? dict.auth.loading : dict.auth.signupButton}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {dict.auth.haveAccount}{" "}
        <Link href={`/${lang}/login`} className="font-bold text-primary hover:underline">
          {dict.auth.loginLink}
        </Link>
      </p>
    </div>
  );
}
