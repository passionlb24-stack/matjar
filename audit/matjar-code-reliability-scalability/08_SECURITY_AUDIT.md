# 08 — Security Audit

_Checkpoint 0. Non-destructive. Evidence-based. No exploitation performed. Supabase `get_advisors(security)` = **0 ERROR-level** findings (152 WARN are the project-wide `security_definer_executable` lint every RPC trips by design + pre-existing extension-in-public + a dashboard toggle)._

## Verdict
The platform's security posture is **above average for its stage**: RLS everywhere, server-side price/stock recompute, privilege-escalation triggers, no leaked secrets, no `any`, parameterized queries only (no string-built SQL). The material findings are: one **High** data-exposure via an over-broad RLS read, one **Medium** push-endpoint auth weakness, and a set of **missing rate-limits / abuse controls** on public write RPCs.

## Findings (OWASP-tagged)

| ID | Title | OWASP | Severity | Evidence |
|---|---|---|---|---|
| SEC-01 | `store_verifications` public read exposes unverified/rejected licence docs + numbers; no status filter | A01 Broken Access Control / A04 | **High** | `0126:32` `using(true)` — see AUTH-01 |
| SEC-02 | `get_push_subs` DEFINER granted to `anon`, guarded by one shared static secret → enumerate any user's push crypto | A01 / A07 | **Medium** | `0049:18` — see AUTH-02 |
| SEC-03 | Public write RPCs lacking rate-limit/abuse controls: `place_stay_booking` (anon, unlimited → inventory denial), `buy_tickets` (anon, unlimited → capacity denial) | A04 Insecure Design | **Medium** | CID-02, CID-03 |
| SEC-04 | Over-broad staff access on new engines (`can_manage_store` vs `staff_can`) exposes attendee/guest PII to any staff role | A01 | Low/Med | AUTH-03 |
| SEC-05 | `product_modifier_groups` public read leaks draft/hidden menu structure | A01 | Low | AUTH-04 |
| SEC-06 | JSON-LD injection: 7 `dangerouslySetInnerHTML` render server-built JSON-LD from user-controlled store/product/job names — safe **iff** `jsonLdScript()` escapes `<`/`</script>` | A03 Injection (XSS) | Low | `jsonld.ts:231`; verify escaping (memory: previously hardened) |
| SEC-07 | `api/push/*` route secret validation + replay/duplicate-event protection + payload-size cap not verified | A08 | Medium (needs verification) | `src/app/api/push/*/route.ts` |
| SEC-08 | Coupon single-use bypassable under concurrency (over-redemption) | A04 | Medium | CID-04 |
| SEC-09 | `config.ts` hardcodes a fallback Supabase URL + publishable anon key (public-by-design, RLS-protected) — acceptable, but the pattern must NEVER be reused for a `service_role` key | A05 Misconfig | Info/Low | `lib/supabase/config.ts:9,13` |
| SEC-10 | Leaked-password protection disabled (Supabase Auth) | A07 | Low | advisor `auth_leaked_password_protection` — dashboard toggle (owner action) |

## Checked and clean
- **SQL injection:** none — all DB access is parameterized Supabase queries / RPC args; no string-concatenated SQL in app code. RPC bodies use parameters + `set search_path=''`.
- **Secrets:** no `sk-`/`eyJ`/bearer literals; server secrets from `process.env` (`VAPID_PRIVATE_KEY`, `PUSH_HOOK_SECRET`).
- **XSS (stored/reflected):** no `innerHTML` of user content; React auto-escapes; the only raw-HTML sink is JSON-LD (SEC-06).
- **IDOR / cross-tenant:** RLS scopes every sensitive read by `customer_id=auth.uid()` or store ownership; no policy lets one merchant/customer read another's private rows (verified in `07`).
- **Privilege escalation:** `prevent_role_change`, `prevent_admin_perm_change` triggers block self-escalation via PostgREST.
- **Mass assignment:** writes go through RPCs with explicit column lists, not client-supplied row objects.
- **Security headers / CSP:** CSP shipped previously (memory: verified live on matjarlb.com) — **re-verify headers at runtime** (`next.config.ts` / middleware) as part of Checkpoint 1.

## Abuse / enumeration surface (public forms)
| Endpoint | Control today | Gap |
|---|---|---|
| `place_guest_order` | 5/hr per phone | OK |
| `create_lead` | 5/hr per phone/store | OK |
| `place_stay_booking` | **none** | SEC-03 / CID-02 |
| `buy_tickets` | **none** | SEC-03 / CID-03 |
| signup / login | Supabase Auth defaults | email/phone enumeration — verify generic error messages; leaked-password off (SEC-10) |
| `track_store_visit` | DEFINER, anon | analytics spam → inflated counts (low; see cost risks) |

## Priority
1. **SEC-01** (High) — close the verification read before any go-live (document leak + fake-badge).
2. **SEC-02** (Medium) — restrict `get_push_subs`, rotate secret.
3. **SEC-03 / SEC-08** — add rate-limits to stay/ticket RPCs + fix coupon over-redemption before marketing drives concurrency.
4. **SEC-07** — verify the push route auth at runtime (Checkpoint 1).
