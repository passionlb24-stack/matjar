"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { waLink } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/notify";

// On-platform subscribe / enroll (migration 0192). Records a real membership or
// course enrollment for signed-in users; WhatsApp stays as a secondary contact.
export function JoinAction({
  kind,
  targetId,
  whatsapp,
  waText,
  loginHref,
  labels,
}: {
  kind: "membership" | "course";
  targetId: string;
  whatsapp: string | null;
  waText: string;
  loginHref: string;
  labels: {
    join: string;
    done: string;
    errorGeneric: string;
  };
}) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setUid(user?.id ?? null));
  }, []);

  const waHref = waLink(whatsapp, waText);

  async function act() {
    if (!uid) {
      window.location.href = loginHref;
      return;
    }
    setBusy(true);
    const supa = createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    const name =
      (user?.user_metadata?.full_name as string | undefined) ??
      user?.email ??
      "";
    const { error } =
      kind === "membership"
        ? await supa.rpc("subscribe_membership", {
            p_plan_id: targetId,
            p_name: name,
            p_phone: "",
          })
        : await supa.rpc("enroll_course", {
            p_course_id: targetId,
            p_name: name,
            p_phone: "",
          });
    setBusy(false);
    if (error) {
      // Idempotent from the user's view: already subscribed/enrolled = done.
      if (error.message?.includes("already")) {
        setDone(true);
        return;
      }
      notifyError(labels.errorGeneric);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 text-sm font-bold text-white">
        <Check className="h-4 w-4" />
        {labels.done}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <Button onClick={act} loading={busy} full>
        {labels.join}
      </Button>
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
      )}
    </div>
  );
}
