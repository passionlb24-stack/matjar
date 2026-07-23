import { createClient } from "@/lib/supabase/client";

// Universal admin audit logging. Call after a successful admin mutation:
//   void logAdminAction("deleted", "review", id);
// Fire-and-forget — it must NEVER block or break the underlying action, so it
// swallows every error. The `log_admin_action` RPC (migration 0151) is
// SECURITY DEFINER + admin-guarded, so non-admins are silently ignored.

// Canonical verbs (the `action`). Keep in sync with dict.admin.auditLabels.verbs.
export type AuditVerb =
  | "created"
  | "updated"
  | "deleted"
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
  | "user"
  | "business_type"
  | "market_category"
  | "market_city"
  | "market_region"
  | "delivery_company"
  | "subscription"
  | "setting";

export async function logAdminAction(
  action: AuditVerb | string,
  entityType?: AuditEntity,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await createClient().rpc("log_admin_action", {
      p_action: action,
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
      p_metadata: metadata ?? {},
    });
  } catch {
    /* logging must never break the action it records */
  }
}
