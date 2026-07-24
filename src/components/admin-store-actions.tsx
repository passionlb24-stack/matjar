"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidateStores } from "@/lib/cache-actions";
import { logAdminAction } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function AdminStoreActions({
  storeId,
  approveLabel,
  rejectLabel,
  confirmRejectLabel,
  errorLabel,
}: {
  storeId: string;
  approveLabel: string;
  rejectLabel: string;
  confirmRejectLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "active" | "rejected") {
    if (
      status === "rejected" &&
      !(await confirm({
        message: confirmRejectLabel,
        confirmLabel: "تأكيد",
        cancelLabel: "إلغاء",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    const { error } = await createClient()
      .from("stores")
      .update({ status })
      .eq("id", storeId);
    setBusy(false);
    if (error) {
      notifyError(errorLabel);
      return;
    }
    void logAdminAction(
      status === "active" ? "approved" : "rejected",
      "store",
      storeId,
      { to: status },
    );
    await revalidateStores();
    router.refresh();
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button
        size="sm"
        disabled={busy}
        onClick={() => setStatus("active")}
        leftIcon={<Check className="h-4 w-4" />}
      >
        {approveLabel}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => setStatus("rejected")}
        leftIcon={<X className="h-4 w-4" />}
        className="!text-danger"
      >
        {rejectLabel}
      </Button>
    </div>
  );
}
