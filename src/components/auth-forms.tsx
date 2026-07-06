"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MailCheck, ShoppingBag, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
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

function PasswordInput({
  label,
  autoComplete,
  minLength,
  showLabel,
  hideLabel,
  hint,
}: {
  label: string;
  autoComplete: string;
  minLength?: number;
  showLabel: string;
  hideLabel: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className={labelClass} htmlFor="password">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder="••••••••"
          aria-describedby={hint ? "password-hint" : undefined}
          className={`${fieldClass} pe-11`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? hideLabel : showLabel}
          className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {hint && (
        <p id="password-hint" className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
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
    // Route each role to its home surface.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let dest = `/${lang}`;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "super_admin") dest = `/${lang}/admin`;
      else if (profile?.role === "merchant") dest = `/${lang}/merchant`;
    }
    router.push(dest);
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
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="name@email.com" className={`${fieldClass} mt-1.5`} />
        </div>
        <PasswordInput
          label={dict.auth.password}
          autoComplete="current-password"
          showLabel={dict.auth.showPassword}
          hideLabel={dict.auth.hidePassword}
        />
        <div className="text-end">
          <Link
            href={`/${lang}/forgot-password`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {dict.auth.forgotLink}
          </Link>
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
  const [accountType, setAccountType] = useState<"customer" | "merchant">(
    "customer",
  );

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
        data: {
          full_name: String(form.get("full_name")),
          account_type: accountType,
        },
        emailRedirectTo: `${window.location.origin}/${lang}`,
      },
    });
    if (error) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    if (!data.session) {
      // Email confirmation is enabled — ask the user to confirm.
      setSent(true);
      setLoading(false);
      return;
    }
    router.push(accountType === "merchant" ? `/${lang}/merchant` : `/${lang}`);
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

  const typeBtn = (active: boolean) =>
    `flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
      active
        ? "border-primary bg-primary-soft text-primary"
        : "border-border text-muted-foreground hover:border-primary/40"
    }`;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <Header title={dict.auth.signupTitle} subtitle={dict.auth.signupSubtitle} />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>{dict.auth.accountType}</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAccountType("customer")} className={typeBtn(accountType === "customer")}>
              <ShoppingBag className="h-4 w-4" />
              {dict.auth.asCustomer}
            </button>
            <button type="button" onClick={() => setAccountType("merchant")} className={typeBtn(accountType === "merchant")}>
              <Store className="h-4 w-4" />
              {dict.auth.asMerchant}
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="full_name">
            {dict.auth.fullName}
          </label>
          <input id="full_name" name="full_name" type="text" required autoComplete="name" placeholder={dict.auth.fullNamePlaceholder} className={`${fieldClass} mt-1.5`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">
            {dict.auth.email}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="name@email.com" className={`${fieldClass} mt-1.5`} />
        </div>
        <PasswordInput
          label={dict.auth.password}
          autoComplete="new-password"
          minLength={8}
          hint={dict.auth.passwordHint}
          showLabel={dict.auth.showPassword}
          hideLabel={dict.auth.hidePassword}
        />
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

export function ForgotPasswordForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email"));
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/${lang}/reset-password`,
    });
    if (error) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <MailCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">{dict.auth.checkEmailTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dict.auth.resetSent}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <Header title={dict.auth.forgotTitle} subtitle={dict.auth.forgotSubtitle} />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="email">
            {dict.auth.email}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="name@email.com" className={`${fieldClass} mt-1.5`} />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? dict.auth.loading : dict.auth.sendReset}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href={`/${lang}/login`} className="font-bold text-primary hover:underline">
          {dict.auth.backToLogin}
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const password = String(new FormData(e.currentTarget).get("password"));
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-extrabold text-primary">{dict.auth.resetDone}</h1>
        <p className="mt-4">
          <Link href={`/${lang}/login`} className="font-bold text-primary hover:underline">
            {dict.auth.backToLogin}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <Header title={dict.auth.resetTitle} subtitle={dict.auth.resetSubtitle} />
      <form onSubmit={onSubmit} className="space-y-4">
        <PasswordInput
          label={dict.auth.newPassword}
          autoComplete="new-password"
          minLength={8}
          hint={dict.auth.passwordHint}
          showLabel={dict.auth.showPassword}
          hideLabel={dict.auth.hidePassword}
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? dict.auth.loading : dict.auth.updatePassword}
        </button>
      </form>
    </div>
  );
}
