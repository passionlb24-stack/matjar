import { createClient } from "@/lib/supabase/client";

// Admin audit logging.
//
// There are two paths here and the difference matters.
//
// `logAdminAction` is the fire-and-forget one, for REVERSIBLE admin actions —
// status toggles, feature flags, plan changes. If the log write fails, the
// action still stands, because blocking a reversible change on its own logger
// is the worse bargain. What it no longer does is fail *silently*:
// supabase-js `.rpc()` does not throw on a Postgres error, it RESOLVES with
// `{ error }`, so the try/catch this function used to rely on caught almost
// nothing. A denied or broken audit write looked identical to a successful one.
// It now inspects the result and reports the failure to the console, which is
// the only signal a client-side logger can honestly offer.
//
// `softDeleteAsAdmin` is the other path, for DESTRUCTIVE actions. It does not
// log after the fact at all — the removal and its audit row happen inside one
// SECURITY DEFINER transaction (`admin_soft_delete`, migration 0294). There is
// no code path that removes the row without writing the record, and if the
// record cannot be written the removal rolls back. A client that can simply
// forget to call the logger — as admin-broadcast.tsx did — is the wrong place
// for the only proof that something happened.

// Canonical verbs (the `action`). Keep in sync with dict.admin.auditLabels.verbs.
export type AuditVerb =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "broadcast"
  | "published"
  | "hidden"
  | "approved"
  | "rejected"
  | "suspended"
  | "reactivated"
  | "featured"
  | "unfeatured"
  | "verified"
  | "unverified"
  | "status_changed"
  | "plan_changed"
  | "access_changed"
  | "activated"
  | "downgraded";

// Canonical entity types. Keep in sync with dict.admin.auditLabels.entities.
export type AuditEntity =
  | "store"
  | "listing"
  | "job"
  | "gig"
  | "wholesale"
  | "message"
  | "question"
  | "review"
  | "verification"
  | "leader"
  | "craft_provider"
  | "user"
  | "business_type"
  | "market_category"
  | "market_city"
  | "market_region"
  | "delivery_company"
  | "subscription"
  | "setting"
  | "academy"
  | "product"
  | "page";

/**
 * The entities whose removal goes through `admin_soft_delete`. These are the
 * five tables that hold a user's own work (0294); everything else still hard
 * deletes, deliberately.
 */
export type SoftDeletableEntity =
  | "listing"
  | "review"
  | "job"
  | "gig"
  | "wholesale";

export async function logAdminAction(
  action: AuditVerb | string,
  entityType?: AuditEntity,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await createClient().rpc("log_admin_action", {
      p_action: action,
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
      p_metadata: metadata ?? {},
    });
    if (error) {
      // Not a toast: the admin's action succeeded and there is nothing for them
      // to do about a logging failure. But it must not be invisible.
      console.error("[audit] log_admin_action failed", {
        action,
        entityType,
        entityId,
        message: error.message,
      });
    }
  } catch (e) {
    console.error("[audit] log_admin_action threw", { action, entityType, e });
  }
}

/**
 * Remove a piece of user-generated content, reversibly and on the record.
 *
 * Sets `deleted_at` and writes the audit row in one transaction. Returns `true`
 * on success; on failure returns `false` and the caller shows its own error —
 * nothing was removed, so retrying is safe.
 */
export async function softDeleteAsAdmin(
  entity: SoftDeletableEntity,
  id: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await createClient().rpc("admin_soft_delete", {
    p_entity: entity,
    p_id: id,
    p_metadata: metadata ?? {},
  });
  if (error) {
    console.error("[audit] admin_soft_delete failed", {
      entity,
      id,
      message: error.message,
    });
    return false;
  }
  return true;
}
