# 23 — Security & privacy

**Method.** Static review of `supabase/migrations/` (267 files, ~22,310 lines of
SQL, `0001`–`0271` with gaps at 0152 and 0201–0203), the four API route
handlers, `src/lib/supabase/admin.ts` and its consumers, and the WebAuthn
clock-in path.

**What was NOT done, and why it matters.** No query was run against the
production database. No policy was tested with `set local role authenticated`.
No penetration testing. Every finding below is derived from the migration source
— which means a policy that was later altered outside the migration files, or a
grant changed by hand in the dashboard, would not appear here. **Findings should
be re-confirmed against live `pg_policies` and `information_schema.role_routine_grants`
before anything is acted on.** The repo convention is that migrations are the
source of truth, so this is a reasonable basis, not a certain one.

---

## 1. Overall posture

This is, honestly, a **well-defended database for a platform of this size**. The
discipline is real and it is visible in the migration history:

- **123 `enable row level security` statements.** Every table created in
  `public.` has one. The single exception is `private.app_config`
  (`0049_push_on_events.sql:9–10`), which lives in an unexposed schema — see §5.1.
- **399 `create policy` / 231 `drop policy`.** The net live count is consistent
  with the ~289 figure carried into this audit: policies are replaced, not
  accumulated, and the replacements are deliberate (`0054_rls_consolidation.sql`,
  `0159_staff_permission_scoped_rls.sql`, `0232_staff_permissions_mean_something.sql`).
- **286 `SECURITY DEFINER` function headers across 192 distinct functions, and
  every single one sets `search_path`.** Zero exceptions. This is the most
  common Supabase privilege-escalation vector and it is closed platform-wide.
- **Dynamic SQL: no injection.** Five files use `EXECUTE format(...)`
  (`0034:23`, `0230:66`, `0232:79`, `0238:142`); every identifier goes through
  `%I`, and the only `%s` substitutes policy expressions read from `pg_policies`
  inside a one-shot migration `DO` block. No user input reaches any `EXECUTE`,
  and there is no `format()` in any callable function body.
- **Three deny-all tables** (RLS on, zero policies): `store_visits`
  (`0161:29–30`), `webauthn_challenges` (`0261:81`), `enrolment_attempts`
  (`0264:40–41`). Correct pattern for service-role/DEFINER-only data.
- **The team has audited itself before, and wrote down what it found.**
  `0196_emergency_hardening.sql`, `0225_move_verification_docs_out_of_public_read.sql`,
  `0258_actually_revoke_anon_from_hr_functions.sql` and
  `0259` are each a real vulnerability found and fixed, with the reasoning left
  in the file. `0258:1–17` in particular records the exact Supabase trap —
  `revoke … from public` does not remove Supabase's direct `anon`/`authenticated`
  grants — and names the migrations that got it wrong.

That history is the strongest security signal in the repo. What follows is what
is still open.

---

## 2. The `revoke from public, anon, authenticated` convention

**The convention is correct and it is applied inconsistently.**

The intended shape:

```sql
create or replace function public.foo(...)
  ... security definer set search_path = '' as $$ ... $$;
revoke execute on function public.foo(...) from public, anon;
grant  execute on function public.foo(...) to authenticated;
```

Reality across the 192 SECURITY DEFINER functions:

| | count |
|---|---|
| have an explicit `revoke` | 120 |
| **have no `revoke` anywhere** | **77** (55 directly callable, 22 `returns trigger`) |

Because PostgreSQL grants `EXECUTE` to `PUBLIC` by default **and** Supabase
grants `anon`/`authenticated` on top, each of those 55 callable functions is
reachable from an anonymous PostgREST client holding only the publishable key.

**Most of them are not exploitable**, because they carry an internal guard —
spot-verified on the sensitive ones: `set_freelancer_verified`
(`0215:34–36`), `store_margin_report` (`0210:52–54`), `void_invoice`
(`0212:224–226`), `import_products` (`0214:134–140`), `update_delivery_status`
(`0213:193–195`), `record_customer_transaction` (`0211:110`), `customer_balance`
(`0211:62`), `store_customer_balances` (`0211:83`). Defence-in-depth is missing;
defence is not.

**One is exploitable.** See §3.1.

**The convention should become a gate, not a habit.** A CI check that fails when
a migration adds a SECURITY DEFINER function without a matching `revoke` line
would have caught `0248`, `0254` and `0256` (all recorded as revoke-from-`public`-only
no-ops in `0258:1–17`) and would catch the next one. That is a small script and
it is the single highest-leverage security investment available here.

---

## 3. Findings ranked by real risk

### 3.1 CRITICAL-adjacent — `run_trial_maintenance()` is an unauthenticated, state-mutating RPC

`supabase/migrations/0208_trial_lifecycle.sql:102–149`.

```
create or replace function public.run_trial_maintenance()
returns void language plpgsql security definer set search_path to '' as $function$
```

- **No internal authorization check of any kind.** Not `is_super_admin()`, not
  a caller test, nothing.
- **No `REVOKE` anywhere in the 267 migrations** (`grep -rn run_trial_maintenance *.sql`
  returns only the definition at `:102` and the cron schedule at `:154`).
- It is a nightly `pg_cron` job (`0208:151–155`); every comparable cron entry
  point in the set *is* revoked.

So `POST /rest/v1/rpc/run_trial_maintenance` with the anon key runs a job that
inserts `trial_ending` / `trial_ended` notifications and calls
`sync_plan_parking(store_id)` — which hides merchant products past the free-plan
limit.

**Honest bounding of the impact.** Both loops are guarded by
`not exists (select 1 from public.notifications … )` (`:117–123`, `:137–143`), so
an attacker cannot spam duplicate notifications by calling it repeatedly. The
real impact is:

1. **Unauthorised triggering of a business process at an attacker-chosen time** —
   a merchant's products can be parked the instant their trial lapses rather than
   at 02:30, and trial warnings can be fired early.
2. **Denial of service.** Each call does full scans over `stores` correlated
   against `notifications`, plus `sync_plan_parking` writes per lapsed store.
   Called in a loop from an anonymous client, this is a cheap way to load the
   database.

**Fix:** one line. `revoke execute on function public.run_trial_maintenance() from public, anon, authenticated;`
Nothing calls it except cron, which runs as the table owner.

### 3.2 HIGH — the push-hook shared secret is plaintext, unRLS'd, and travels as an RPC argument

Three facts that are individually defensible and jointly a problem.

**a. The secret is stored in the clear with no RLS.**
`0049_push_on_events.sql:9–13` creates `private.app_config` and inserts
`push_hook_secret = encode(gen_random_bytes(24),'hex')`. This is the only table
in the entire schema without RLS. It is in an unexposed schema, so PostgREST
cannot reach it — but any function or role with `USAGE` on `private` reads it.

**b. `get_push_subs` is granted to `anon`, on purpose, and the codebase knows.**
`0049:30–31`:

```sql
revoke execute on function public.get_push_subs(uuid, text) from public;
grant  execute on function public.get_push_subs(uuid, text) to anon, authenticated;
```

The function returns any user's full Web Push subscription — `endpoint`,
`p256dh`, `auth` — for an arbitrary `p_uid`, gated **only** on the caller
supplying the correct `p_secret` (`0049:22–24`). `0196_emergency_hardening.sql:7`
records this as open finding **MJ-A02** and explains why it was left: the hook
route calls it as `anon`, so revoking the grant would break push.

So the entire confidentiality of every user's push credentials rests on one
24-byte hex string.

**c. That string is handled in ways that leak it.**

- `src/app/api/push/hook/route.ts:27–30` passes it **as an RPC argument**:
  `supabase.rpc("get_push_subs", { p_uid, p_secret: hookSecret })`. PostgREST RPC
  arguments travel in the request body and are eligible to appear in Supabase API
  logs and in `pg_stat_statements` normalisation. A secret should never be a
  function parameter.
- `src/app/api/push/hook/route.ts:14` compares it with `!==` — a
  non-constant-time comparison. Over a network this is close to untestable, so
  this is a hygiene note, not a live risk.
- `notify_push` (`0049:38–45`) sends it as an `x-push-secret` header over
  `pg_net`. That part is fine.

**Fix, in order of value:**
1. Have the route call a **service-role** client for `get_push_subs`, then
   `revoke execute … from anon`. This removes the anonymous path entirely and is
   the fix MJ-A02 was waiting for. `adminClientIfConfigured()` already exists
   (`src/lib/supabase/admin.ts:34`) and this is a legitimate fourth use of it.
2. Stop passing the secret as an RPC argument once (1) makes it unnecessary.
3. Replace `!==` with a constant-time compare.

### 3.3 HIGH — `can_manage_store` is permission-blind, and it still gates salaries, ID numbers and GPS

`can_manage_store(store_id)` (`0018_store_staff.sql:30–36`) returns true for the
owner **or any row in `store_staff`** — regardless of that staffer's permission
map. It appears **233 times** across the migrations.

The codebase knows this. `0232_staff_permissions_mean_something.sql:1–33` says
so explicitly, and `0159_staff_permission_scoped_rls.sql` migrated the customer
book to the permission-aware `staff_can(store_id, 'customers')`
(`0159:9–13`). That work was correct and incomplete.

Still gated on `can_manage_store` — i.e. readable by a clerk hired with
`{"products": true}`:

| Table | What it holds | Policy |
|---|---|---|
| `store_employees` | `pay_rate`, **`id_number`**, `residency_expires_on`, `phone` | `0254_hr_employees_and_attendance.sql:97–100` |
| `employee_attendance` | clock-in times **with `lat`/`lng`** | `0254:102–106` |
| `employee_advances` | salary advances | `0254:107–110` |
| `employee_breaks` | break log | `0266:75–81` |
| `payroll_runs`, `payroll_lines` | computed pay | `0255:47–57` |
| `employee_devices`, `employee_enrolments` | passkey binding + **plaintext enrolment codes** | `0261:86–95` |
| `clock_attempts` | failed clock-in log | `0258:44–45` |
| `leads` | guest `name`, `phone`, `message` | `0190_lead_engine.sql:50–52` |
| `checkout_intents` | abandoned-cart `phone`, `name`, cart | `0120_abandoned_cart.sql:52–54` |
| `delivery_requests` | `0213:98–100` | |
| `store_invoices` | `0212:91–93` | |
| `order_payments` | payment ledger | `0086:157–166` |

The most pointed one is `0254:94–96`, whose own comment reads: *the existing
per-module staff permissions do not include "may see everyone's salary", so this
stays with whoever can manage the store.* But `can_manage_store` **is** "any
staff row" — so the policy does not implement the intent the comment states. A
part-time cashier can read every colleague's salary, national ID number and GPS
clock-in history.

**This is the most serious *design* finding in the audit.** It is not a bug that
leaks to the internet; it is a bug that leaks to the person standing at the till.
In a Lebanese small business that is arguably worse.

**Fix:** add an `hr` permission to the staff permission map and move the seven
HR/payroll tables from `can_manage_store` to
`is_store_owner(store_id) or staff_can(store_id, 'hr')`. `is_store_owner`
already exists (`0232:52–60`). The lead/CRM tables want `staff_can(store_id, 'customers')`,
which also already exists.

### 3.4 HIGH — enrolment codes are plaintext and readable by the people they defend against

`employee_enrolments.code` (`0261_clock_in_from_the_employees_own_phone.sql:54`)
is a plaintext 6-digit secret with a 10-minute TTL. `employee_enrolments_read`
(`0261:94–95`) is gated on `can_manage_store`.

The whole design goal of the WebAuthn clock-in, stated at `0261:9–16`, is to end
buddy-punching by binding a punch to one phone's biometric. A staffer who can
read a live enrolment code can register **their own** phone against a
**colleague's** employee record — which is buddy-punching, reintroduced through
the enrolment door.

`redeem_enrolment_code` is properly revoked (`0262:60`) and rate-limited to five
wrong guesses per fifteen minutes per store (`0264`), so the attack requires
*reading* the code, not guessing it. §3.3's fix closes this too.

Secondary: hash the code. It is short-lived, but a plaintext credential in a
readable table has no upside.

### 3.5 MEDIUM–HIGH — `record_checkout_intent` is an anonymous write into a merchant notification channel

`supabase/migrations/0120_abandoned_cart.sql:65–110`, granted to `anon`
(`:108–109`). Called from `src/components/store-products.tsx:406–428`, fired on
**blur of the phone field** (`store-products.tsx:1405–1411`).

Two separate problems.

**Security.** Any anonymous caller can insert an arbitrary `phone` +
`customer_name` + fabricated cart against any *active* store. Thirty minutes
later `scan_abandoned_carts` (`0120:145–190`) dispatches an `order_abandoned`
automation, which reaches the **merchant** as an in-app notification carrying a
one-tap `wa.me` link (`0120:1–7`). There is no rate limit — contrast `create_lead`
(`0190:98–104`), which caps guest inserts at five per phone per hour. Impact:
a merchant can be made to receive, and be tempted to WhatsApp, arbitrary phone
numbers; and `checkout_intents` grows one row per unique `(store_id, phone)`
with no bound.

**Privacy.** See §4.

**Fix:** apply the same rate-limit shape `create_lead` already uses (it is in the
same codebase, `0190:98–104`), and require the phone to have passed at least one
plausibility check beyond `length >= 4` (`0120:85–88`).

### 3.6 MEDIUM — reviewer identity is world-readable and joinable

Three `USING (true)` SELECT policies over tables carrying `customer_id`
(an `auth.users` UUID) and `customer_name`:

| Table | Policy |
|---|---|
| `reviews` | `0009_reviews.sql:23–25` |
| `product_reviews` | `0050_product_reviews.sql:19–20` |
| `craft_reviews` | `0239_craft_requests_and_reviews.sql:85` (+ `customer_name` added `0243:9`) |
| `product_questions` (`asker_id`) | `0051_qa_and_counts.sql:33–34` |

`profiles` itself is correctly private (`0054:156–161`), and `0243:1–8` explains
that names are denormalised **because** profiles is private. The unintended
consequence: `customer_id` is a stable identifier exposed on four public tables,
so an anonymous client can join across them and reconstruct any user's complete
review and question history across the whole platform — including a pharmacy
review next to a clinic question.

**Fix:** drop `customer_id` from the public projection. Either remove the column
from the anon-visible select (column-level grants, or a public view), or replace
it with a per-store hashed pseudonym. The displayed `customer_name` can stay.

### 3.7 MEDIUM — `craft_requests` accepts anonymous inserts, and its UPDATE policy lets a customer self-certify

Two policies in `0239_craft_requests_and_reviews.sql`:

- INSERT (`:70–74`): `with check (customer_id is null or customer_id = (select auth.uid()))`
  with **no `TO` clause**, so `anon` qualifies, and **no rate limit**. This table
  holds `phone`, `address`, `description`, `photos` — home addresses. It is an
  unbounded anonymous write path into a tradesman's inbox.
- UPDATE (`:77–82`): `using (customer_id = auth.uid() or owns_craft_provider(provider_id) or is_super_admin())`,
  **no `WITH CHECK`**. Postgres falls back to the `USING` expression, which the
  new row still satisfies — so a customer can (a) reassign their request to a
  **different provider**, pushing their address and phone to a tradesman who
  never received it, and (b) set `status = 'completed'` themselves.

(b) matters because `craft_reviews_write` (`0239:88–98`) requires a
`status = 'completed'` request. The "verified job" precondition on a craft review
is therefore self-attestable, which is the trust primitive of the whole crafts
vertical.

**Fix:** add `WITH CHECK` clauses pinning `provider_id` and restricting `status`
transitions to the provider; move guest inserts behind an RPC with the
`create_lead` rate limit.

### 3.8 MEDIUM — two more UPDATE policies missing `WITH CHECK`

- `store_assets_owner_update` (`0008_storage_bucket.sql:15–17`). Combined with
  the **unscoped INSERT policy** at `0008:10–13` — `with check (bucket_id = 'store-assets')`
  and nothing else — any authenticated user can write anywhere in the public
  bucket and rename their own objects over another store's path prefix.
  `0077_security_hardening.sql:9–10` acknowledges the deferral: *"Per-user path
  scoping is deferred: current upload paths key on storeId, not uid."*
  `digital-goods` shows the right pattern (`0234:59–77`, path-scoped by store
  UUID) — apply it to `store-assets`.
- `product_reviews_update_own` (`0050:23–24`). A reviewer can repoint
  `product_id` to a different product while keeping the rating. Worse: `verified`
  is stamped only `before insert` (`0050:38–41`), so a moved review **keeps a
  stale `verified = true`** from an unrelated purchase. That is a working method
  to manufacture verified negative reviews.

### 3.9 LOW–MEDIUM — WebAuthn `rpID` is derived from a request header

`src/lib/webauthn.ts:16–20`:

```
const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
```

The reasoning in the file is good — the same code has to work on localhost, on a
Vercel preview and on production, and WebAuthn signs the origin into the
assertion.

The residual risk is small but real: the browser will only ever sign for the
origin it actually loaded, so an attacker cannot induce a signature for
`matjarlb.com` from `evil.com`. What *can* happen is that a device enrolled on a
**preview deployment** produces a credential stored in `employee_devices` keyed
only by `credential_id` + `store_id` (`clock/punch/route.ts:81–94`), with no
record of which `rpID` it was issued under. On Vercel, `x-forwarded-host` is set
by the platform and cannot be spoofed by a client, which is why this stays low.

**Fix:** allow-list the hosts (production + explicit preview) rather than
trusting the header, and store the `rpID` alongside the credential.

### 3.10 LOW — two anon-callable functions with `search_path = 'public'` and unqualified table references

`resource_booked_times()` (`0128_store_resources_timeslot.sql:35–43`, references
`bookings` unqualified at `:39`) and `class_spots_taken()`
(`0130_store_classes.sql:40–47`, `:44`). Both SECURITY DEFINER, both pinned to
`'public'` rather than `''`, and **neither is revoked**. These are the only two
functions in the set combining all three weaknesses. Impact is low — booked slot
times are shown in the public picker anyway — but they are the residue of the
pattern and should be brought in line.

Five functions in total use `search_path = public` instead of `''`
(`0001:38`, `0007:7`, `0128:38`, `0130:42`, `0132:22`).

---

## 4. Privacy

### 4.1 The privacy policy is contradicted by the code

`src/app/[lang]/(site)/privacy/page.tsx` is 69 lines, and the policy itself is
**four bullet points** hardcoded in the component (`:35–46`). The first one says:

> "We collect only the information needed to run the service: your account,
> orders, and bookings."

Data the platform actually collects that is none of those three:

| Data | Where | Consent? |
|---|---|---|
| Phone + name + cart **before any order exists** | `checkout_intents`, `0120:29–39`; fired on blur, `store-products.tsx:1405–1411` | none, and nothing on screen says it |
| Employee **GPS coordinates** at every punch | `employee_attendance.lat/lng`, `0254` | employer-mediated |
| Employee **national ID number** | `store_employees.id_number`, `0254:11–41` | employer-mediated |
| Store-visit telemetry | `store_visits`, `0161:29–30` (`track_store_visit`, `0161:36`) | none |
| Search queries | `log_search`, `0216:91` | none |
| Device push tokens | `device_push_tokens`, `0067` | permission prompt only |
| Vercel Analytics | `src/app/[lang]/layout.tsx` | none |

The page also says "Passwords are encrypted" — Supabase hashes them, which is
stronger and differently meant. A privacy policy that is wrong in the customer's
favour is still wrong.

**This blocks the app stores.** Apple's App Privacy details and Google Play's
Data Safety form both require per-data-type declarations (collected / linked to
identity / used for tracking). A four-bullet page cannot back either
declaration, and declaring "we collect only account, orders and bookings" while
the binary requests location and camera is the kind of mismatch that produces a
rejection or, later, a removal.

**Fix:** a real policy enumerating the table above, with retention periods; a
one-line disclosure under the checkout phone field; and a data-deletion route
(the page currently says "contact us", which Play Store now requires to be a
self-serve URL for account deletion).

### 4.2 The checkout phone field is an undisclosed submit button

Covered as a security issue in §3.5 and as an experience issue in
`16_CUSTOMER_EXPERIENCE.md` §6. The privacy statement of it: a customer types a
phone number into a shop's checkout, abandons, and thirty minutes later that shop
is holding their number and being prompted to WhatsApp them. Nothing on the
screen indicated that typing was a disclosure.

The engineering around it is careful — `0120` is fail-safe end to end, deduped,
cleared on conversion (`0120:115–130`). The consent model is the gap, not the code.

**Fix:** move the capture to a deliberate forward step, and add one line of copy.

### 4.3 The digital-goods pattern is exactly right — keep it as the template

`src/lib/supabase/admin.ts` is 36 lines with 16 lines of comment explaining that
the service-role client exists for one job and that any new use is a security
review. The intended flow, in `src/app/[lang]/download/[itemId]/route.ts`:

1. `supabase.rpc("digital_download_grant")` runs **as the caller** (`:39`) and
   decides entitlement — a question about an *order*, which RLS on
   `storage.objects` cannot see.
2. Only then does the admin client mint a signed URL (`:64–66`).

The bucket has `public = false` and no read policy at all
(`0234_digital_products.sql:55–77`). Entitlement first, key second. This is the
pattern every future service-role use should be measured against.

### 4.4 The two clock routes exceed what `admin.ts` says the client is for

The doc comment says *"It exists for one job: signing a URL for a file in the
private digital-goods bucket."* There are three consumers, and two of them are
the clock routes, which perform arbitrary RLS-bypassing RPCs and direct
`employee_devices` reads and writes on behalf of an **unauthenticated** request
(`clock/punch/route.ts:43, 59, 73, 81, 119, 130, 140`;
`clock/register/route.ts:37, 58, 65, 88, 104, 124`).

The design reason is sound and is written down: the employee has no Matjar
account, so a biometric assertion is the only thing that can stand for one. The
routes are also carefully built — `userVerification: "required"`, no
`allowCredentials` list so the endpoint never reveals which devices are
registered (`punch:56–57`), a device registered at another shop is rejected
(`punch:94`), the signature counter is checked when the authenticator keeps one
(`punch:117–123`), challenges are single-use through `spend_webauthn_challenge`,
and `attestationType: "none"` avoids collecting hardware identifiers.

Two gaps:

- **`admin.ts`'s comment is now false**, which matters because the comment is
  the control. Update it to name all three uses and the rule that governs a
  fourth.
- **`step: "options"` on `/api/clock/punch` is unauthenticated and unrated.**
  It takes only a `shortCode`, issues a WebAuthn challenge and writes a row via
  `issue_webauthn_challenge` (`punch:59–64`). `clock_store_context`
  (`0262:8`) also distinguishes a valid short code from an invalid one, so the
  endpoint is a store-code oracle and an unbounded challenge-row writer. The
  *registration* path is rate-limited (`redeem_enrolment_code`, five attempts per
  fifteen minutes, `0264`); the *authentication* path's options step is not.

---

## 5. Two smaller notes

### 5.1 `private.app_config` — the only table without RLS
Covered in §3.2. Even in an unexposed schema, `alter table private.app_config enable row level security;`
with no policy costs nothing and removes the exception from the "every table has
RLS" statement, which is worth keeping true for the next reviewer.

### 5.2 `app.allow_role_change` is a transaction-scoped bypass of the role guard
`prevent_role_change()` (`0170_transfer_hardening.sql:15–37`) returns early when
`current_setting('app.allow_role_change', true) = '1'`, which
`transfer_store_ownership` sets at `:71` and clears at `:74`. The design is
sound — transaction-local, and `set_config` lives in `pg_catalog` so PostgREST
cannot expose it. The hazard is future: any SECURITY DEFINER function that sets
it and then raises before clearing leaves the platform's role-escalation guard
off for the rest of that transaction. Worth an `exception` block in
`transfer_store_ownership` and a comment for the next author.

---

## 6. Priority order

| # | Finding | Severity | Effort |
|---|---|---|---|
| 1 | `run_trial_maintenance` anon-callable | high | one line |
| 2 | `get_push_subs` granted to `anon`; secret passed as an RPC argument | high | small |
| 3 | HR/payroll/GPS/ID readable by any staff row (`can_manage_store`) | high | medium — needs an `hr` permission |
| 4 | Plaintext enrolment codes readable by any staff row | high | closed by #3 |
| 5 | Privacy policy contradicts the code; blocks store submission | high | content |
| 6 | `record_checkout_intent` anonymous + unrated; undisclosed capture | med-high | small |
| 7 | `craft_requests` anon insert + missing `WITH CHECK` (self-certified completion) | medium | small |
| 8 | Reviewer `customer_id` world-readable and joinable | medium | small |
| 9 | `store-assets` bucket writable at any path | medium | small |
| 10 | `product_reviews` UPDATE keeps stale `verified` | medium | small |
| 11 | 55 unrevoked callable DEFINER functions (defence-in-depth) | medium | script + CI gate |
| 12 | WebAuthn `rpID` from request header | low | small |
| 13 | `search_path = public` on 5 functions; 2 unrevoked | low | small |
| 14 | `private.app_config` has no RLS | low | one line |

---

## 7. What could not be verified

- **Live policy state.** Everything here is read from migrations. Policies or
  grants changed outside them are invisible to this audit.
- **Whether the 55 unrevoked functions are actually reachable** with the
  production anon key — that needs one `role_routine_grants` query, which was not
  run.
- **Whether `run_trial_maintenance` is exploitable today**, for the same reason.
  The migration says it is; the live grant table would say for certain.
- No penetration testing, no auth-flow testing, no session/cookie review, no
  rate-limit testing against the live edge, no review of Supabase dashboard
  settings (JWT expiry, email confirmation, leaked-password protection), and no
  run of `supabase get_advisors`.
- CSP (`next.config.ts:12–28`) was read and is a genuine allow-list, but
  `script-src 'unsafe-inline'` is present in production. Whether it can be
  removed depends on Next's inline bootstrap and was not tested.
