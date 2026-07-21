"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Admin-only publish/delete island for business_leaders. RLS lets super-admins
// mutate any row, so the calls run straight from the client. Mirrors
// admin-verification-actions.tsx.
export function AdminLeaderActions({
  id,
  published,
}: {
  id: string;
  published: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function togglePublished() {
    setBusy(true);
    const { error } = await createClient()
      .from("business_leaders")
      .update({ published: !published })
      .eq("id", id);
    setBusy(false);
    if (error) {
      window.alert("حدث خطأ. حاوِل مرة أخرى.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("هل أنت متأكد من حذف هذا الملف نهائيًا؟")) return;
    setBusy(true);
    const { error } = await createClient()
      .from("business_leaders")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (error) {
      window.alert("حدث خطأ. حاوِل مرة أخرى.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
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
