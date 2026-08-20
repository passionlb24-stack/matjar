"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { softDeleteAsAdmin } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function AdminReviewDelete({
  reviewId,
  label,
  confirmLabel,

  errorLabel,
  okLabel,
  cancelLabel,
}: {
  reviewId: string;
  label: string;
  confirmLabel: string;
  errorLabel: string;
  /**
   * Button labels for the confirm dialog. These were the Arabic literals
   * "تأكيد" / "إلغاء", so an English admin was asked to approve an
   * irreversible action with two buttons they could not read.
   */
  okLabel: string;
  cancelLabel: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !(await confirm({
        message: confirmLabel,
        confirmLabel: okLabel,
        cancelLabel: cancelLabel,
        danger: true,
      }))
    )
      return;
    setBusy(true);
    // Soft delete + audit row in one transaction (0294). A review is a
    // customer's own writing and the store's public rating is computed from it,
    // so removing it has to be both reversible and on the record; the rating
    // rollup (sync_store_rating) now excludes soft-deleted rows, so the stars
    // move the moment this lands.
    const ok = await softDeleteAsAdmin("review", reviewId);
    setBusy(false);
    if (!ok) {
      notifyError(errorLabel);
      return;
    }
    router.refresh();
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={remove}
      disabled={busy}
      leftIcon={<Trash2 className="h-4 w-4" />}
      className="shrink-0 !text-danger"
    >
      {label}
    </Button>
  );
}
