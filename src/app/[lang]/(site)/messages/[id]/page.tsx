import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { MessageThread, type ChatMessage } from "@/components/message-thread";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(id)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  // RLS returns the row only if the user is a participant.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, store_id, stores(name)")
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();

  const { data: others } = await supabase
    .from("conversation_participants")
    .select("user_id, profiles(full_name)")
    .eq("conversation_id", id)
    .neq("user_id", user.id);
  const otherName =
    (others?.[0]?.profiles as unknown as { full_name: string | null } | null)
      ?.full_name ?? null;
  const storeName =
    (conv.stores as unknown as { name: string } | null)?.name ?? null;
  const header = storeName || otherName || dict.messages.unknown;

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // Mark this conversation read for me.
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .eq("user_id", user.id);

  return (
    <div className="py-6">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/messages`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.messages.title}
        </Link>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight">{header}</h1>
        {conv.store_id && storeName && (
          <Link
            href={`/${lang}/store/${conv.store_id}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {dict.messages.viewStore}
          </Link>
        )}

        <div className="mt-4">
          <MessageThread
            conversationId={id}
            meId={user.id}
            initialMessages={(msgs ?? []) as ChatMessage[]}
            dict={dict}
          />
        </div>
      </Container>
    </div>
  );
}
