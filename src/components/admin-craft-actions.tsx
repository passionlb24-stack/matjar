"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Pause, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { logAdminAction } from "@/lib/audit";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

// Approve, reject, suspend, verify.
//
// These four columns are guarded from the provider by a trigger (0238/0241), so
// this island is the only way any of them move — which is the whole point of
// the guard. The badge in particular: "verified" is the one claim a customer is
// asked to take on trust, and it means an admin looked, not that a form was
// filled in.
export function AdminCraftActions({
  providerId,
  status,
  verified,
  labels,
}: {
  providerId: string;
  status: string;
  verified: boolean;
  labels: {
    approve: string;
    reject: string;
    suspend: string;
    restore: string;
    verify: string;
    unverify: string;
    confirmReject: string;
    confirmSuspend: string;
    confirm: string;
    cancel: string;
    error: string;
  };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function patch(
    changes: Record<string, unknown>,
    action: string,
    ask?: string,
  ) {
    if (ask) {
      const ok = await confirm({
        message: ask,
        confirmLabel: labels.confirm,
        cancelLabel: labels.cancel,
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    const { error } = await createClient()
      .from("craft_providers")
      .update(changes)
      .eq("id", providerId);
    setBusy(false);
    if (error) {
      notifyError(labels.error);
      return;
    }
    void logAdminAction(action, "craft_provider", providerId);
    router.refresh();
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {status !== "active" && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => patch({ status: "active" }, "approved")}
          leftIcon={<Check className="h-4 w-4" />}
        >
          {labels.approve}
        </Button>
      )}

      {status === "pending" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            patch({ status: "rejected" }, "rejected", labels.confirmReject)
          }
          leftIcon={<X className="h-4 w-4" />}
        >
          {labels.reject}
        </Button>
      )}

      {status === "active" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            patch({ status: "suspended" }, "suspended", labels.confirmSuspend)
          }
          leftIcon={<Pause className="h-4 w-4" />}
        >
          {labels.suspend}
        </Button>
      )}

      <Button
        size="sm"
        variant={verified ? "primary" : "outline"}
        disabled={busy}
        onClick={() =>
          patch(
            {
              verified: !verified,
              // Stamped alongside the flag so "verified" always carries a date
              // rather than being a boolean nobody can date.
              verified_at: !verified ? new Date().toISOString() : null,
            },
            verified ? "unverified" : "verified",
          )
        }
        leftIcon={<BadgeCheck className="h-4 w-4" />}
      >
        {verified ? labels.unverify : labels.verify}
      </Button>
    </div>
  );
}
