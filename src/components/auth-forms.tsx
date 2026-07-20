"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, MailCheck, ShoppingBag, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Card } from "@/components/ui/card";
import { Field, Input, fieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/** Brand mark + title + subtitle centered atop each auth card. */
function AuthHeader({
  title,
  subtitle,
  brand,
}: {
  title: string;
  subtitle: string;
  brand: string;
}) {
  return (
    <div className="mb-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <Store className="h-6 w-6" />
      </span>
      <span className="sr-only">{brand}</span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/** Password input with a show/hide toggle. Kept as custom markup (the shared
 *  <Input> has no trailing-affordance slot); still built on `fieldClass`. */
function PasswordField({
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
    <Field label={label} htmlFor="password" hint={hint}>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className={`${fieldClass} pe-11`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? hideLabel : showLabel}
          className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </Field>
  );
}

/** Full-page confirmation card (email sent / password updated). */
function StatusCard({
  title,
  message,
  children,
}: {
  title: string;
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className="p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <MailCheck className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-xl font-extrabold">{title}</h1>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
      {children}
    </Card>
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
    <Card variant="elevated" className="p-6 sm:p-8">
      <AuthHeader
        title={dict.auth.loginTitle}
        subtitle={dict.auth.loginSubtitle}
        brand={dict.common.brand}
      />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={dict.auth.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@email.com"
          />
        </Field>
        <PasswordField
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
        {error && (
          <p className="text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" full loading={loading}>
          {dict.auth.loginButton}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {dict.auth.noAccount}{" "}
        <Link
          href={`/${lang}/signup`}
          className="font-bold text-primary hover:underline"
        >
          {dict.auth.createOne}
        </Link>
      </p>
    </Card>
  );
}

export function SignupForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [accountType, setAccountType] = useState<"customer" | "merchant">(
    "customer",
  );

  // Remember an inbound referral code so it survives email confirmation; it's
  // redeemed once the referred user is authenticated (see LoyaltyPanel).
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      try {
        localStorage.setItem("matjar-ref", ref);
      } catch {
        /* ignore */
      }
    }
  }, [searchParams]);

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
    // Logged in immediately — attribute the referral now if one was shared.
    const ref = searchParams.get("ref");
    if (ref) {
      await supabase.rpc("record_referral", { p_code: ref });
      try {
        localStorage.removeItem("matjar-ref");
      } catch {
        /* ignore */
      }
    }
    router.push(accountType === "merchant" ? `/${lang}/merchant` : `/${lang}`);
    router.refresh();
  }

  if (sent) {
    return (
      <StatusCard
        title={dict.auth.checkEmailTitle}
        message={dict.auth.checkEmail}
      />
    );
  }

  const typeBtn = (active: boolean) =>
    `flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
      active
        ? "border-primary bg-primary-soft text-primary"
        : "border-border text-muted-foreground hover:border-primary/40"
    }`;

  return (
    <Card variant="elevated" className="p-6 sm:p-8">
      <AuthHeader
        title={dict.auth.signupTitle}
        subtitle={dict.auth.signupSubtitle}
        brand={dict.common.brand}
      />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={dict.auth.accountType}>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAccountType("customer")}
              className={typeBtn(accountType === "customer")}
            >
              <ShoppingBag className="h-4 w-4" />
              {dict.auth.asCustomer}
            </button>
            <button
              type="button"
              onClick={() => setAccountType("merchant")}
              className={typeBtn(accountType === "merchant")}
            >
              <Store className="h-4 w-4" />
              {dict.auth.asMerchant}
            </button>
          </div>
        </Field>
        <Field label={dict.auth.fullName} htmlFor="full_name">
          <Input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            placeholder={dict.auth.fullNamePlaceholder}
          />
        </Field>
        <Field label={dict.auth.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@email.com"
          />
        </Field>
        <PasswordField
          label={dict.auth.password}
          autoComplete="new-password"
          minLength={8}
          hint={dict.auth.passwordHint}
          showLabel={dict.auth.showPassword}
          hideLabel={dict.auth.hidePassword}
        />
        {error && (
          <p className="text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" full loading={loading}>
          {dict.auth.signupButton}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {dict.auth.haveAccount}{" "}
        <Link
          href={`/${lang}/login`}
          className="font-bold text-primary hover:underline"
        >
          {dict.auth.loginLink}
        </Link>
      </p>
    </Card>
  );
}

export function ForgotPasswordForm({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
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
      <StatusCard
        title={dict.auth.checkEmailTitle}
        message={dict.auth.resetSent}
      />
    );
  }

  return (
    <Card variant="elevated" className="p-6 sm:p-8">
      <AuthHeader
        title={dict.auth.forgotTitle}
        subtitle={dict.auth.forgotSubtitle}
        brand={dict.common.brand}
      />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={dict.auth.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@email.com"
          />
        </Field>
        {error && (
          <p className="text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" full loading={loading}>
          {dict.auth.sendReset}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link
          href={`/${lang}/login`}
          className="font-bold text-primary hover:underline"
        >
          {dict.auth.backToLogin}
        </Link>
      </p>
    </Card>
  );
}

export function ResetPasswordForm({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
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
      <Card variant="elevated" className="p-8 text-center">
        <h1 className="text-xl font-extrabold text-primary">
          {dict.auth.resetDone}
        </h1>
        <p className="mt-4">
          <Link
            href={`/${lang}/login`}
            className="font-bold text-primary hover:underline"
          >
            {dict.auth.backToLogin}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="p-6 sm:p-8">
      <AuthHeader
        title={dict.auth.resetTitle}
        subtitle={dict.auth.resetSubtitle}
        brand={dict.common.brand}
      />
      <form onSubmit={onSubmit} className="space-y-4">
        <PasswordField
          label={dict.auth.newPassword}
          autoComplete="new-password"
          minLength={8}
          hint={dict.auth.passwordHint}
          showLabel={dict.auth.showPassword}
          hideLabel={dict.auth.hidePassword}
        />
        {error && (
          <p className="text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" full loading={loading}>
          {dict.auth.updatePassword}
        </Button>
      </form>
    </Card>
  );
}
