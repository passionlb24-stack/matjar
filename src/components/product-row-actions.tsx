"use client";
import { revalidateProduct } from "@/lib/cache-actions";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function ProductRowActions({
  productId,
  isAvailable,
  showLabel,
  hideLabel,
  deleteLabel,
  confirmLabel,
  errorLabel,
}: {
  productId: string;
  isAvailable: boolean;
  showLabel: string;
  hideLabel: string;
  deleteLabel: string;
  confirmLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const { error } = await createClient()
      .from("products")
      .update({ is_available: !isAvailable })
      .eq("id", productId);
    setBusy(false);
    if (error) {
      notifyError(errorLabel);
      return;
    }
    await revalidateProduct(productId);
    router.refresh();
  }

  async function remove() {
    if (
      !(await confirm({
        message: confirmLabel,
        confirmLabel: "تأكيد",
        cancelLabel: "إلغاء",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    const { error } = await createClient()
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId);
    setBusy(false);
    if (error) {
      notifyError(errorLabel);
      return;
    }
    await revalidateProduct(productId);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        disabled={busy}
        aria-label={isAvailable ? hideLabel : showLabel}
        title={isAvailable ? hideLabel : showLabel}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-60"
      >
        {isAvailable ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button
        onClick={remove}
        disabled={busy}
        aria-label={deleteLabel}
        title={deleteLabel}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
