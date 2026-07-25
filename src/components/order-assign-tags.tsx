"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, Tag, X, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

const MAX_TAGS = 8;
const MAX_TAG_LEN = 24;

// Assign an order to a team member and label it with free-form tags. Both write
// straight through the orders_update RLS policy (owner or staff). Mirrors the
// small self-contained pattern of OrderNoteEditor / OrderStatusControl.
export function OrderAssignTags({
  orderId,
  assignedTo,
  tags,
  team,
  labels,
  errorLabel,
}: {
  orderId: string;
  assignedTo: string | null;
  tags: string[];
  team: { id: string; name: string }[];
  labels: {
    assignee: string;
    unassigned: string;
    tags: string;
    addTag: string;
    tagPlaceholder: string;
  };
  errorLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  async function assign(next: string) {
    if (busy) return;
    setBusy(true);
    const { error } = await createClient()
      .from("orders")
      .update({ assigned_to: next || null })
      .eq("id", orderId);
    setBusy(false);
    if (error) {
      notifyError(errorLabel);
      return;
    }
    router.refresh();
  }

  async function saveTags(next: string[]) {
    if (busy) return;
    setBusy(true);
    const { error } = await createClient()
      .from("orders")
      .update({ tags: next })
      .eq("id", orderId);
    setBusy(false);
    if (error) {
      notifyError(errorLabel);
      return;
    }
    router.refresh();
  }

  function addTag() {
    const t = draft.trim().slice(0, MAX_TAG_LEN);
    setDraft("");
    setAdding(false);
    if (!t) return;
    // Case-insensitive de-dupe; cap the count.
    if (
      tags.some((x) => x.toLowerCase() === t.toLowerCase()) ||
      tags.length >= MAX_TAGS
    )
      return;
    void saveTags([...tags, t]);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
      {/* Assignee */}
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <UserRound className="h-4 w-4" />
        <span className="font-semibold text-foreground">{labels.assignee}:</span>
        <select
          value={assignedTo ?? ""}
          disabled={busy}
          onChange={(e) => assign(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-sm font-semibold outline-none focus:border-primary disabled:opacity-60"
        >
          <option value="">{labels.unassigned}</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag className="h-4 w-4 text-muted-foreground" />
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary"
          >
            {t}
            <button
              type="button"
              onClick={() => saveTags(tags.filter((x) => x !== t))}
              disabled={busy}
              aria-label={`${labels.tags}: ${t}`}
              className="transition-opacity hover:opacity-70 disabled:opacity-40"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={draft}
            maxLength={MAX_TAG_LEN}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              } else if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder={labels.tagPlaceholder}
            className="w-28 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs outline-none focus:border-primary"
          />
        ) : (
          tags.length < MAX_TAGS && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              {labels.addTag}
            </button>
          )
        )}
      </div>
    </div>
  );
}
