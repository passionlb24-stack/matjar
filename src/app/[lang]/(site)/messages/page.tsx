import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";

type Convo = {
  conversation_id: string;
  store_name: string | null;
  other_name: string | null;
  display_name: string | null;
  last_body: string | null;
  last_at: string;
  unread: boolean;
};

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.messages;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase.rpc("my_conversations");
  const convos = (data ?? []) as Convo[];

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>

        {convos.length ? (
          <ul className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {convos.map((c) => (
              <li key={c.conversation_id}>
                <Link
                  href={`/${lang}/messages/${c.conversation_id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-muted"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold">
                        {c.display_name || c.store_name || c.other_name || t.unknown}
                      </span>
                      {c.unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p
                      className={`truncate text-sm ${c.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {c.last_body || t.noMessagesYet}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <MessageCircle className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">{t.empty}</p>
          </div>
        )}
      </Container>
    </div>
  );
}
