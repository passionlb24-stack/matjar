"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, EyeOff, Star, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

// Admin-only publish/feature/verify/delete island for business_leaders. RLS
// lets super-admins mutate any row, so the calls run straight from the client.
// Mirrors admin-verification-actions.tsx.
export function AdminLeaderActions({
  id,
  published,
  featured,
  verificationStatus,
}: {
  id: string;
  published: boolean;
  featured: boolean;
  verificationStatus: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const verified = verificationStatus === "verified";

  async function toggleFeatured() {
    const next = !featured;
    setBusy(true);
    const { error } = await createClient()
      .from("business_leaders")
      .update({ featured: next })
      .eq("id", id);
    setBusy(false);
    if (error) {
      notifyError("حدث خطأ. حاوِل مرة أخرى.");
      return;
    }
    void logAdminAction(next ? "featured" : "unfeatured", "leader", id);
    router.refresh();
  }

  async function toggleVerified() {
    const next = !verified;
    setBusy(true);
    const { error } = await createClient()
      .from("business_leaders")
      .update({ verification_status: next ? "verified" : "needs_review" })
      .eq("id", id);
    setBusy(false);
    if (error) {
      notifyError("حدث خطأ. حاوِل مرة أخرى.");
      return;
    }
    void logAdminAction(next ? "verified" : "unverified", "leader", id);
    router.refresh();
  }

  async function togglePublished() {
    const nextPublished = !published;
    setBusy(true);
    const { error } = await createClient()
      .from("business_leaders")
      .update({ published: nextPublished })
      .eq("id", id);
    setBusy(false);
    if (error) {
      notifyError("حدث خطأ. حاوِل مرة أخرى.");
      return;
    }
    void logAdminAction(nextPublished ? "published" : "hidden", "leader", id);
    router.refresh();
  }

  async function remove() {
    if (
      !(await confirm({
        message: "هل أنت متأكد من حذف هذا الملف نهائيًا؟",
        confirmLabel: "تأكيد",
        cancelLabel: "إلغاء",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    const { error } = await createClient()
      .from("business_leaders")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (error) {
      notifyError("حدث خطأ. حاوِل مرة أخرى.");
      return;
    }
    void logAdminAction("deleted", "leader", id);
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        size="sm"
        variant={featured ? "primary" : "outline"}
        onClick={toggleFeatured}
        disabled={busy}
        leftIcon={<Star className="h-4 w-4" />}
      >
        {featured ? "إلغاء التمييز" : "تمييز"}
      </Button>
      <Button
        size="sm"
        variant={verified ? "primary" : "outline"}
        onClick={toggleVerified}
        disabled={busy}
        leftIcon={<BadgeCheck className="h-4 w-4" />}
      >
        {verified ? "إلغاء التوثيق" : "توثيق"}
      </Button>
      {published ? (
        <Button
          size="sm"
          variant="outline"
          onClick={togglePublished}
          disabled={busy}
          leftIcon={<EyeOff className="h-4 w-4" />}
        >
          إخفاء
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          onClick={togglePublished}
          disabled={busy}
          leftIcon={<Check className="h-4 w-4" />}
        >
          نشر
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={remove}
        disabled={busy}
        leftIcon={<Trash2 className="h-4 w-4" />}
        className="!text-danger !border-danger/30 hover:!bg-danger/5"
      >
        حذف
      </Button>
    </div>
  );
}
