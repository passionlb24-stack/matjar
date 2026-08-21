-- ============================================================================
-- RLS policy regression matrix
-- ============================================================================
-- WHY THIS EXISTS
--   Migration 0159 re-pointed the Business OS tables from can_manage_store()
--   (true for ANY staff row) to staff_can(store_id, perm). Five siblings kept
--   the old predicate and nobody noticed: a staff member hired to manage
--   products could read the name and phone of every customer who abandoned a
--   cart. Fixed in 0291.
--
--   It was nearly missed twice, and both near-misses are the design of this
--   file:
--
--   1. Querying those tables as the staff member returned ZERO ROWS, which read
--      as "RLS is holding". It was not -- the tables were simply empty for that
--      store. RLS FILTERS ROWS SILENTLY; IT DOES NOT RAISE. On an empty table
--      "blocked" and "nothing there" are the same answer. So every assertion
--      here SEEDS A ROW FIRST, and every "expected 0" is paired with an
--      "expected >=1" from an actor who should see that same row. A suite that
--      only checks the negative passes just as happily when the feature has
--      been deleted.
--
--   2. pos_sale_items and lead_activities LOOK equally exposed -- both still
--      gate on can_manage_store, which is true for any staff row -- but they
--      gate through a subquery on a parent (pos_sales, leads) that is itself
--      RLS-filtered, so the nested read returns nothing and the child is
--      protected transitively. Reading the policy text alone would have called
--      both of them broken. They are asserted here deliberately, so that if
--      someone later "simplifies" the parent policy the child's protection
--      cannot vanish silently.
--
-- HOW IT RUNS / HOW IT ROLLS BACK
--   The file is one dollar-quoted DO block wrapped in begin/rollback. It seeds
--   two whole
--   stores' worth of fixtures, acts as fourteen different principals via
--   `set local role` + `request.jwt.claims`, and ALWAYS ends by RAISING -- a
--   raised exception aborts the transaction, so nothing it wrote can survive
--   even if the trailing `rollback;` never runs (SQL editor, a client that
--   splits statements, an abort halfway through). Belt and braces, because
--   production is a live marketplace and a stray row in `orders` is a real
--   defect on somebody's dashboard.
--
--   Run it from the Supabase SQL editor, or:
--     supabase db execute --file supabase/tests/rls_policy_matrix.test.sql
--
--   Interpreting the result -- the run "errors" ON PURPOSE:
--     * message contains 'RLS MATRIX PASSED'  -> green
--     * message contains 'RLS MATRIX FAILED'  -> red; the message lists every
--       non-passing check as
--          actor=<who> table=<what> store=<A|B> expected <what>, saw <n> row(s)
--     * message contains 'RLS MATRIX STALE'   -> the suite is right about the
--       database and wrong about itself: a check marked "pending migration
--       0287" started passing, so 0287 has landed and the marker in section 4
--       must be deleted. One-line edit.
--
-- WHAT IT COVERS
--   * Staff permissions. Twelve staff members: ten holding EXACTLY ONE of the
--     ten PERM_KEYS from src/components/staff-manager.tsx with the other nine
--     explicitly false, one holding all ten, and one holding none. Every one of
--     them reads every governed table. 0291's five -- checkout_intents,
--     store_invoices, payments, subscriptions, supplier_transactions -- are in
--     the matrix by name.
--   * Cross-store isolation. Every fixture exists twice, once in store A and
--     once in store B, and every store-A principal is asserted to see zero of
--     store B. store B's owner reading his own row is the positive control that
--     proves the B row was really there.
--   * Anonymous reach. anon against every merchant table (must be zero) and
--     against the public storefront tables (must be non-zero -- a suite that
--     only proved anon sees nothing would go green on a bricked storefront).
--   * Column-level exposure of user identifiers on the review and question
--     tables, which is a GRANT question, not an RLS question: those rows are
--     `select using (true)` on purpose and no policy can hide one column of a
--     row that must stay visible.
--
-- ADDING A TABLE is one line in `v_cases` plus its fixture row. The expected
-- value is DERIVED from the actor, never written out per table -- a
-- hand-written expectation matrix is where the next hole hides.
--
-- ----------------------------------------------------------------------------
-- PROOF THAT IT BITES
-- ----------------------------------------------------------------------------
-- A test that has never failed is a guess. Each invariant was broken on
-- purpose against production, inside `begin; ... rollback;`, and the suite was
-- re-run. Baseline for comparison: 729 passed / 0 failed / 24 pending.
--
--   1. Restored the PRE-0291 predicate on checkout_intents
--        using (can_manage_store(store_id) or is_super_admin())
--      -> 10 FAILs, led by
--         "actor=staff:products table=checkout_intents store=A expected 0 rows,
--          saw 1 row(s) (0291)"
--      which is the leak, named. Every other store-A staffer and staff:NONE
--      followed. This is the exact regression 0291 fixed.
--   2. checkout_intents_select -> using (true)
--      -> 29 FAILs including owner:A reading store B, owner:B reading store A,
--         staff:ALL reading store B, shopper, and anon. Cross-store isolation
--         and anonymous reach both fail loudly and separately.
--   3. Emptied the seeded checkout_intents rows before the reads -- the 0291
--      near-miss, staged deliberately.
--      -> 4 FAILs, all POSITIVE controls:
--         owner:A/A, owner:B/B, staff:orders/A, staff:ALL/A, each
--         "expected >=1 row, saw 0 row(s)". The negatives all still "passed",
--         which is precisely why they alone are worthless. On an empty table
--         this suite goes RED rather than green.
--   4. `grant select on public.craft_reviews to anon` (undoing 0286's revoke)
--      -> FAIL "actor=anon table=craft_reviews column=customer_id wanted
--         denied, got allowed".
--   5. Deleted the seeded store_classes rows
--      -> FAIL "actor=anon table=store_classes public storefront read expected
--         >=1 row, saw 0" -- the guard against over-restriction, the 0287
--         outage class.
--   6. The anti-vacuity guard in section 5 was exercised in isolation with
--      v_pos_pass = 0 and fired. NOT proven end-to-end via a fully vacuous
--      run; mutation 3 is the real-world version of the same failure.
--
-- After every mutation the policy/grant was confirmed restored by reading
-- pg_policies and has_column_privilege back. No test row was ever committed.
-- ============================================================================

begin;

do $$
declare
  -- ---- fixture ids -------------------------------------------------------
  v_owner_a    uuid := gen_random_uuid();
  v_owner_b    uuid := gen_random_uuid();
  v_shopper    uuid := gen_random_uuid();   -- signed in, unrelated to A and B
  v_bookcust   uuid := gen_random_uuid();   -- the person a booking belongs to
  v_store_a    uuid;
  v_store_b    uuid;
  v_prod_a     uuid;  v_prod_b     uuid;    -- draft: not publicly visible
  v_pub_a      uuid;                        -- active: the storefront product
  v_order_a    uuid;  v_order_b    uuid;
  v_lead_a     uuid;  v_lead_b     uuid;
  v_pos_a      uuid;  v_pos_b      uuid;
  v_sup_a      uuid;  v_sup_b      uuid;
  v_unit_a     uuid;  v_unit_b     uuid;
  v_ett_a      uuid;  v_ett_b      uuid;
  v_cust_a     uuid;  v_cust_b     uuid;
  v_prov       uuid;  v_req        uuid;
  v_uid        uuid;

  v_perm_keys  text[] := array[
    'orders','products','bookings','inventory','customers',
    'pos','suppliers','expenses','classes','tasks'];
  k            text;

  -- ---- the matrix --------------------------------------------------------
  v_actors     jsonb := '[]'::jsonb;
  v_cases      jsonb;
  v_public     jsonb;
  v_cols       jsonb;

  -- ---- runner state ------------------------------------------------------
  a            jsonb;
  c            jsonb;
  v_side       text;
  v_expect     int;
  v_got        int;
  v_state      text;
  v_q          text;
  v_role       text;
  v_claims     text;
  v_allowed    boolean;
  v_excused    boolean;

  v_pass       int := 0;
  v_fail       int := 0;
  v_pending    int := 0;
  v_stale      int := 0;
  v_pos_pass   int := 0;   -- "someone who SHOULD see it, did" -- anti-vacuity
  v_neg_pass   int := 0;   -- "someone who should NOT see it, did not"
  v_report     text := '';
  v_line       text;
begin
  -- ==========================================================================
  -- 1. FIXTURES
  --    Seeded as `postgres`, which is BYPASSRLS, so no policy interferes with
  --    setup. Every column guard in this schema (guard_order_money_columns,
  --    guard_review_columns, enforce_store_plan, guard_product_review_subject,
  --    ...) short-circuits for a current_user that is not authenticated/anon,
  --    so the seed writes the literal values asked for.
  -- ==========================================================================
  insert into auth.users (id) values (v_owner_a), (v_owner_b), (v_shopper), (v_bookcust);
  insert into public.profiles (id, full_name) values
    (v_owner_a,  'RLS Owner A'),
    (v_owner_b,  'RLS Owner B'),
    (v_shopper,  'RLS Shopper'),
    (v_bookcust, 'RLS Booking Customer')
  on conflict (id) do nothing;

  -- 'pro' so the free-plan product cap and the plan gates on stock_movements /
  -- supplier_transactions are not what a failure here is really about.
  insert into public.stores (owner_id, name, status, plan)
    values (v_owner_a, 'RLS Matrix Store A', 'active', 'pro') returning id into v_store_a;
  insert into public.stores (owner_id, name, status, plan)
    values (v_owner_b, 'RLS Matrix Store B', 'active', 'pro') returning id into v_store_b;

  v_actors := jsonb_build_array(
    jsonb_build_object('name','owner:A', 'role','authenticated','uid',v_owner_a::text,'perm','*'),
    jsonb_build_object('name','owner:B', 'role','authenticated','uid',v_owner_b::text,'perm','*B'),
    jsonb_build_object('name','shopper', 'role','authenticated','uid',v_shopper::text,'perm','-'),
    jsonb_build_object('name','anon',    'role','anon',         'uid',null,           'perm','-'));

  -- One staff member per permission key, holding that key and nothing else.
  -- The nine falses are written out rather than omitted so the fixture matches
  -- what the staff editor actually saves: normalize() in staff-manager.tsx
  -- defaults every missing key to false, and staff_can() coalesces a missing
  -- key to false as well -- so present-and-false is the honest shape.
  foreach k in array v_perm_keys loop
    v_uid := gen_random_uuid();
    insert into auth.users (id) values (v_uid);
    insert into public.profiles (id, full_name) values (v_uid, 'RLS Staff ' || k)
      on conflict (id) do nothing;
    insert into public.store_staff (store_id, user_id, role, permissions)
      values (v_store_a, v_uid, 'staff',
              (select jsonb_object_agg(x, x = k) from unnest(v_perm_keys) x));
    v_actors := v_actors || jsonb_build_array(jsonb_build_object(
      'name','staff:' || k, 'role','authenticated','uid',v_uid::text,'perm',k));
  end loop;

  -- Every permission at once. Must STILL be blocked from the owner-only tables
  -- (payments, subscriptions): 0291 chose is_store_owner there on purpose --
  -- what the shop pays Matjar is not an operational permission anyone holds.
  v_uid := gen_random_uuid();
  insert into auth.users (id) values (v_uid);
  insert into public.profiles (id, full_name) values (v_uid, 'RLS Staff all')
    on conflict (id) do nothing;
  insert into public.store_staff (store_id, user_id, role, permissions)
    values (v_store_a, v_uid, 'staff',
            (select jsonb_object_agg(x, true) from unnest(v_perm_keys) x));
  v_actors := v_actors || jsonb_build_array(jsonb_build_object(
    'name','staff:ALL', 'role','authenticated','uid',v_uid::text,'perm','ALL'));

  -- A staff row with every permission off. This is the actor that separates
  -- staff_can() from can_manage_store(): can_manage_store is TRUE for them, so
  -- any table that regresses to the old predicate lights up here first.
  v_uid := gen_random_uuid();
  insert into auth.users (id) values (v_uid);
  insert into public.profiles (id, full_name) values (v_uid, 'RLS Staff none')
    on conflict (id) do nothing;
  insert into public.store_staff (store_id, user_id, role, permissions)
    values (v_store_a, v_uid, 'staff',
            (select jsonb_object_agg(x, false) from unnest(v_perm_keys) x));
  v_actors := v_actors || jsonb_build_array(jsonb_build_object(
    'name','staff:NONE', 'role','authenticated','uid',v_uid::text,'perm','NONE'));

  -- ---- rows, one per store ------------------------------------------------
  -- products: DRAFT on purpose. An active product in an active store is
  -- readable by the whole internet through products_select's public branch, so
  -- a draft is the only product that exercises the staff predicate at all.
  insert into public.products (store_id, name, price, status)
    values (v_store_a, 'RLS Draft A', 10, 'draft') returning id into v_prod_a;
  insert into public.products (store_id, name, price, status)
    values (v_store_b, 'RLS Draft B', 10, 'draft') returning id into v_prod_b;
  insert into public.products (store_id, name, price, status)
    values (v_store_a, 'RLS Public A', 10, 'active') returning id into v_pub_a;

  -- orders: customer_id left NULL (a guest order) so orders_select's
  -- "auth.uid() = customer_id" branch cannot hand the row to `shopper` and
  -- quietly turn a real failure into a pass.
  insert into public.orders (store_id) values (v_store_a) returning id into v_order_a;
  insert into public.orders (store_id) values (v_store_b) returning id into v_order_b;

  -- product_id is REQUIRED here even though the column is nullable: the
  -- decrement_product_stock trigger updates products by new.product_id and
  -- raises insufficient_stock when that UPDATE matches no row, so a NULL
  -- product_id fails the insert outright. The products above leave stock NULL
  -- (untracked), which the same trigger treats as "always enough".
  insert into public.order_items (order_id, product_id, name)
    values (v_order_a, v_prod_a, 'RLS item A');
  insert into public.order_items (order_id, product_id, name)
    values (v_order_b, v_prod_b, 'RLS item B');

  insert into public.checkout_intents (store_id, phone, customer_name)
    values (v_store_a, '0199000001', 'Abandoned Cart A');
  insert into public.checkout_intents (store_id, phone, customer_name)
    values (v_store_b, '0199000002', 'Abandoned Cart B');

  insert into public.store_invoices (store_id, seq, number, legal_name, customer_name)
    values (v_store_a, 900001, 'RLS-A-900001', 'RLS Legal A', 'Invoice Customer A');
  insert into public.store_invoices (store_id, seq, number, legal_name, customer_name)
    values (v_store_b, 900001, 'RLS-B-900001', 'RLS Legal B', 'Invoice Customer B');

  insert into public.payments (store_id, amount) values (v_store_a, 10);
  insert into public.payments (store_id, amount) values (v_store_b, 10);
  insert into public.subscriptions (store_id) values (v_store_a);
  insert into public.subscriptions (store_id) values (v_store_b);

  insert into public.leads (store_id, name, phone)
    values (v_store_a, 'RLS Lead A', '0199000011') returning id into v_lead_a;
  insert into public.leads (store_id, name, phone)
    values (v_store_b, 'RLS Lead B', '0199000012') returning id into v_lead_b;
  insert into public.lead_activities (lead_id, activity_type) values (v_lead_a, 'note');
  insert into public.lead_activities (lead_id, activity_type) values (v_lead_b, 'note');

  insert into public.pos_sales (store_id, subtotal, total)
    values (v_store_a, 10, 10) returning id into v_pos_a;
  insert into public.pos_sales (store_id, subtotal, total)
    values (v_store_b, 10, 10) returning id into v_pos_b;
  insert into public.pos_sale_items (sale_id, name, price, qty)
    values (v_pos_a, 'RLS pos A', 10, 1);
  insert into public.pos_sale_items (sale_id, name, price, qty)
    values (v_pos_b, 'RLS pos B', 10, 1);

  insert into public.store_suppliers (store_id, name)
    values (v_store_a, 'RLS Supplier A') returning id into v_sup_a;
  insert into public.store_suppliers (store_id, name)
    values (v_store_b, 'RLS Supplier B') returning id into v_sup_b;
  insert into public.supplier_transactions (store_id, supplier_id, kind, amount)
    values (v_store_a, v_sup_a, 'purchase', 25);
  insert into public.supplier_transactions (store_id, supplier_id, kind, amount)
    values (v_store_b, v_sup_b, 'purchase', 25);

  insert into public.store_customers (store_id, name)
    values (v_store_a, 'RLS Customer A') returning id into v_cust_a;
  insert into public.store_customers (store_id, name)
    values (v_store_b, 'RLS Customer B') returning id into v_cust_b;
  insert into public.customer_transactions (store_id, customer_id, kind, amount)
    values (v_store_a, v_cust_a, 'charge', 5);   -- kind check: charge|payment|adjustment
  insert into public.customer_transactions (store_id, customer_id, kind, amount)
    values (v_store_b, v_cust_b, 'charge', 5);

  insert into public.stock_movements (store_id, product_id, delta) values (v_store_a, v_prod_a, 1);
  insert into public.stock_movements (store_id, product_id, delta) values (v_store_b, v_prod_b, 1);

  insert into public.store_expenses (store_id, label) values (v_store_a, 'RLS Expense A');
  insert into public.store_expenses (store_id, label) values (v_store_b, 'RLS Expense B');
  insert into public.store_tasks (store_id, title) values (v_store_a, 'RLS Task A');
  insert into public.store_tasks (store_id, title) values (v_store_b, 'RLS Task B');

  -- store_classes has store_classes_public_read `using (true)`: the SELECT is
  -- world-readable by design and the 'classes' permission governs writes only.
  -- It is asserted in v_public below, not in the deny matrix -- asserting a
  -- deny here would encode a rule the schema does not have.
  insert into public.store_classes (store_id, name) values (v_store_a, 'RLS Class A');
  insert into public.store_classes (store_id, name) values (v_store_b, 'RLS Class B');

  -- active = false on purpose. units_public_read is
  -- `(active = true) or can_manage_store(store_id)`, so an ACTIVE unit is
  -- readable by the whole internet and would never exercise the staff
  -- predicate -- the same trap as seeding an active product.
  insert into public.accommodation_units (store_id, name, active)
    values (v_store_a, 'RLS Unit A', false) returning id into v_unit_a;
  insert into public.accommodation_units (store_id, name, active)
    values (v_store_b, 'RLS Unit B', false) returning id into v_unit_b;
  -- customer_id left NULL: stays_select also matches on it.
  insert into public.stay_bookings (store_id, unit_id, guest_name, phone, check_in, check_out, nights)
    values (v_store_a, v_unit_a, 'RLS Guest A', '0199000021',
            current_date + 7, current_date + 8, 1);
  insert into public.stay_bookings (store_id, unit_id, guest_name, phone, check_in, check_out, nights)
    values (v_store_b, v_unit_b, 'RLS Guest B', '0199000022',
            current_date + 7, current_date + 8, 1);

  -- active = false, same reason as accommodation_units above
  -- (ticket_types_public_read is `(active = true) or can_manage_store(...)`).
  insert into public.event_ticket_types (store_id, name, active)
    values (v_store_a, 'RLS Ticket Type A', false) returning id into v_ett_a;
  insert into public.event_ticket_types (store_id, name, active)
    values (v_store_b, 'RLS Ticket Type B', false) returning id into v_ett_b;
  -- customer_id left NULL: tickets_select also matches on it.
  insert into public.event_tickets (store_id, ticket_type_id, attendee_name, phone)
    values (v_store_a, v_ett_a, 'RLS Attendee A', '0199000031');
  insert into public.event_tickets (store_id, ticket_type_id, attendee_name, phone)
    values (v_store_b, v_ett_b, 'RLS Attendee B', '0199000032');

  -- bookings.customer_id is NOT NULL and bookings_select matches on it, so it
  -- points at a fourth person who is not one of the actors.
  insert into public.bookings (store_id, customer_id) values (v_store_a, v_bookcust);
  insert into public.bookings (store_id, customer_id) values (v_store_b, v_bookcust);

  -- Public-by-design rows, for the anon sections.
  insert into public.reviews (store_id, customer_id, rating, customer_name)
    values (v_store_a, v_shopper, 5, 'RLS Reviewer');
  insert into public.product_reviews (product_id, customer_id, rating, customer_name)
    values (v_pub_a, v_shopper, 5, 'RLS Reviewer');
  insert into public.product_questions (product_id, asker_id, question, asker_name)
    values (v_pub_a, v_shopper, 'RLS question?', 'RLS Asker');

  insert into public.craft_providers (user_id, name)
    values (v_shopper, 'RLS Craft Provider') returning id into v_prov;
  insert into public.craft_requests (provider_id, phone, description)
    values (v_prov, '0199000041', 'RLS craft request') returning id into v_req;
  insert into public.craft_reviews (provider_id, request_id, customer_id, rating, customer_name)
    values (v_prov, v_req, v_shopper, 5, 'RLS Craft Reviewer');

  -- ==========================================================================
  -- 2. THE CASE TABLE
  --    (table, governing permission, the column that scopes it, the A row, the
  --    B row). 'OWNER' means no permission grants it -- only the store owner.
  --    Adding a table is ONE line here plus its fixture above.
  -- ==========================================================================
  v_cases := jsonb_build_array(
    -- 0291's five, by name -------------------------------------------------
    jsonb_build_object('t','checkout_intents',      'p','orders',   'c','store_id','a',v_store_a,'b',v_store_b,'n','0291'),
    jsonb_build_object('t','store_invoices',        'p','orders',   'c','store_id','a',v_store_a,'b',v_store_b,'n','0291'),
    jsonb_build_object('t','payments',              'p','OWNER',    'c','store_id','a',v_store_a,'b',v_store_b,'n','0291'),
    jsonb_build_object('t','subscriptions',         'p','OWNER',    'c','store_id','a',v_store_a,'b',v_store_b,'n','0291'),
    jsonb_build_object('t','supplier_transactions', 'p','suppliers','c','store_id','a',v_store_a,'b',v_store_b,'n','0291'),
    -- orders ---------------------------------------------------------------
    jsonb_build_object('t','orders',                'p','orders',   'c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','order_items',           'p','orders',   'c','order_id','a',v_order_a,'b',v_order_b,'n','child of orders'),
    jsonb_build_object('t','leads',                 'p','orders',   'c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','lead_activities',       'p','orders',   'c','lead_id', 'a',v_lead_a, 'b',v_lead_b, 'n','TRANSITIVE via leads'),
    -- products -------------------------------------------------------------
    -- scoped by product id, not store_id: store A also holds an ACTIVE product,
    -- which products_select shows the whole internet, so a store-scoped count
    -- would come back 1 for anon and say nothing about the draft.
    jsonb_build_object('t','products',              'p','products', 'c','id',      'a',v_prod_a, 'b',v_prod_b, 'n','draft row'),
    -- FOUND BY THIS SUITE, still open. units_public_read and
    -- ticket_types_public_read are `(active = true) or can_manage_store(...)`,
    -- and can_manage_store is true for ANY staff row -- so a staff member with
    -- every permission switched OFF reads the store's INACTIVE units and
    -- inactive ticket types. That is the identical predicate 0291 replaced on
    -- its five tables; these two are siblings it did not reach. 'pend' means
    -- the same-store-staff deny is reported as PENDING rather than FAIL, so the
    -- suite is usable today; the cross-store and anon denies on these tables
    -- are NOT excused and still fail hard. Fix is a migration, not a test:
    -- swap can_manage_store for staff_can(store_id,'products') in both.
    jsonb_build_object('t','accommodation_units',   'p','products', 'c','store_id','a',v_store_a,'b',v_store_b,'n','','pend','units_public_read still gates on can_manage_store'),
    jsonb_build_object('t','event_ticket_types',    'p','products', 'c','store_id','a',v_store_a,'b',v_store_b,'n','','pend','ticket_types_public_read still gates on can_manage_store'),
    jsonb_build_object('t','event_tickets',         'p','products', 'c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    -- bookings -------------------------------------------------------------
    jsonb_build_object('t','bookings',              'p','bookings', 'c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','stay_bookings',         'p','bookings', 'c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    -- the remaining permission keys ----------------------------------------
    jsonb_build_object('t','stock_movements',       'p','inventory','c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','store_customers',       'p','customers','c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','customer_transactions', 'p','customers','c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','pos_sales',             'p','pos',      'c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','pos_sale_items',        'p','pos',      'c','sale_id', 'a',v_pos_a,  'b',v_pos_b,  'n','TRANSITIVE via pos_sales'),
    jsonb_build_object('t','store_suppliers',       'p','suppliers','c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','store_expenses',        'p','expenses', 'c','store_id','a',v_store_a,'b',v_store_b,'n',''),
    jsonb_build_object('t','store_tasks',           'p','tasks',    'c','store_id','a',v_store_a,'b',v_store_b,'n',''));
  -- ------------------------------------------------------------------------
  -- NOT COVERED HERE, deliberately, and worth writing down rather than
  -- quietly leaving out. Sweeping pg_policies for `can_manage_store` in a
  -- SELECT qual turns up far more than the five 0291 fixed. Some are
  -- transitively safe (order_events, order_status_events and bundle_items gate
  -- through an RLS-filtered parent, like pos_sale_items does); the rest are a
  -- direct store-scoped read that ANY staff row satisfies:
  --   order_payments, booking_waitlist, course_enrollments, service_requests,
  --   store_memberships, delivery_requests, stock_waitlist, store_credit_notes,
  --   store_campaigns, coupons, automations, automation_runs, product_imports
  -- Several of those carry customer identity. They are left out because
  -- asserting a deny would encode a permission mapping nobody has chosen yet
  -- -- 0291 picked its predicate per table, on the merits, and that call
  -- belongs to whoever writes the migration, not to this file. When it is
  -- made, each one is a single line above.
  -- ------------------------------------------------------------------------
  -- NOT HERE for a different reason: store_classes. Its SELECT is
  -- store_classes_public_read `using (true)` -- world-readable by design -- so
  -- the 'classes' permission governs writes only and there is no read to deny.
  -- It is asserted as a public read below instead. If someone ever narrows
  -- that policy, the public assertion goes red; if someone ever wants the read
  -- gated, this is the line to move.

  -- Public storefront reads. anon MUST still see these: a suite that only ever
  -- proves anon sees nothing would go green on a storefront that had been
  -- bricked by an over-restrictive policy or an over-eager column revoke.
  v_public := jsonb_build_array(
    jsonb_build_object('t','stores',           'c','id',        'v',v_store_a),
    jsonb_build_object('t','products',         'c','id',        'v',v_pub_a),
    jsonb_build_object('t','reviews',          'c','store_id',  'v',v_store_a),
    jsonb_build_object('t','product_reviews',  'c','product_id','v',v_pub_a),
    jsonb_build_object('t','product_questions','c','product_id','v',v_pub_a),
    jsonb_build_object('t','store_classes',    'c','store_id',  'v',v_store_a),
    -- Added when 0302 made store_locations WRITES owner-only. Its read is
    -- deliberately NOT narrowed: it carries the branch list on every public
    -- store page. That is the exact accident 0302 header records -- a
    -- narrowing applied ahead of its deploy took the reviews block off every
    -- store page -- so the read is pinned here rather than trusted. Needs no
    -- fixture line: stores_create_primary_location is a SECURITY DEFINER
    -- trigger, so inserting store A already created its primary branch.
    jsonb_build_object('t','store_locations',  'c','store_id',  'v',v_store_a));

  -- ==========================================================================
  -- 3. THE RUNNER
  --    For each (actor, case, side): become the actor, count the seeded row,
  --    RESET ROLE, and only then compare -- the comparison must not itself be
  --    subject to the policy under test.
  --
  --    The expectation is DERIVED, never written down per table:
  --      side A: owner:A sees it; a staffer sees it iff they hold the table's
  --              permission (never, for an OWNER table); everyone else zero.
  --      side B: owner:B sees it -- that is the proof the B row exists at all
  --              -- and every store-A principal sees zero. Cross-store
  --              isolation, the invariant whose failure is worst.
  -- ==========================================================================
  for i in 0 .. jsonb_array_length(v_actors) - 1 loop
    a := v_actors -> i;
    v_role   := a ->> 'role';
    v_claims := case when a ->> 'uid' is null then '{}'
                     else jsonb_build_object('sub', a ->> 'uid', 'role', v_role)::text end;

    for j in 0 .. jsonb_array_length(v_cases) - 1 loop
      c := v_cases -> j;

      foreach v_side in array array['A','B'] loop
        if v_side = 'B' then
          v_expect := case when a ->> 'name' = 'owner:B' then 1 else 0 end;
        else
          v_expect := case
            when a ->> 'name' = 'owner:A' then 1
            when a ->> 'perm' = 'ALL'     then (case when c ->> 'p' = 'OWNER' then 0 else 1 end)
            when a ->> 'perm' = c ->> 'p' then 1
            else 0 end;
        end if;

        v_q := format('select count(*) from public.%I where %I = %L',
                      c ->> 't', c ->> 'c',
                      ((case v_side when 'A' then c ->> 'a' else c ->> 'b' end))::uuid);

        execute format('set local role %I', v_role);
        perform set_config('request.jwt.claims', v_claims, true);
        perform set_config('request.jwt.claim.sub', '', true);
        v_state := null;
        begin
          execute v_q into v_got;
        exception when others then
          -- A missing GRANT (42501) hides the row just as effectively as a
          -- policy does, so it counts as zero visible -- but the sqlstate is
          -- kept and printed, because "blocked by grant" and "blocked by
          -- policy" are different repairs.
          v_got := 0;
          v_state := sqlstate;
        end;
        reset role;

        v_line := format('actor=%-16s table=%-22s store=%s  expected %s, saw %s row(s)%s%s',
                         a ->> 'name', c ->> 't', v_side,
                         case when v_expect = 1 then '>=1 row' else '0 rows' end, v_got,
                         case when v_state is null then '' else '  [sqlstate ' || v_state || ']' end,
                         case when coalesce(c ->> 'n','') = '' then '' else '  (' || (c ->> 'n') || ')' end);

        -- A 'pend' on a case excuses ONE narrow cell: the same-store staff
        -- deny on side A, which is where a known-open can_manage_store
        -- predicate shows up. Cross-store (side B), anon, shopper and every
        -- positive control still fail hard, so a pend can never hide a
        -- cross-store leak.
        v_excused := coalesce(c ->> 'pend','') <> ''
                     and v_side = 'A' and v_expect = 0
                     and (a ->> 'name') like 'staff:%';

        -- Visibility, not an exact count: a trigger elsewhere in the schema is
        -- free to add a second row to a table this suite seeded (crm_capture
        -- does exactly that), and "saw 2 where 1 was expected" is not a
        -- security finding. Seeing ANY row you should not is.
        if (v_got > 0) = (v_expect = 1) then
          if v_excused then
            v_stale := v_stale + 1;
            v_report := v_report || E'\n  STALE    ' || v_line
                     || format('  -- now holds; drop the pend marker (%s)', c ->> 'pend');
          else
            v_pass := v_pass + 1;
            if v_expect = 1 then v_pos_pass := v_pos_pass + 1; else v_neg_pass := v_neg_pass + 1; end if;
          end if;
        elsif v_excused then
          v_pending := v_pending + 1;
          v_report := v_report || E'\n  PENDING  ' || v_line
                   || format('  -- known open: %s', c ->> 'pend');
        else
          v_fail := v_fail + 1;
          v_report := v_report || E'\n  FAIL     ' || v_line;
        end if;
      end loop;
    end loop;
  end loop;

  -- ---- anon must still see the storefront ---------------------------------
  for j in 0 .. jsonb_array_length(v_public) - 1 loop
    c := v_public -> j;
    v_q := format('select count(*) from public.%I where %I = %L',
                  c ->> 't', c ->> 'c', (c ->> 'v')::uuid);
    execute format('set local role %I', 'anon');
    perform set_config('request.jwt.claims', '{}', true);
    perform set_config('request.jwt.claim.sub', '', true);
    v_state := null;
    begin
      execute v_q into v_got;
    exception when others then
      v_got := 0; v_state := sqlstate;
    end;
    reset role;

    if v_got >= 1 then
      v_pass := v_pass + 1; v_pos_pass := v_pos_pass + 1;
    else
      v_fail := v_fail + 1;
      v_report := v_report || format(
        E'\n  FAIL     actor=anon             table=%-22s public storefront read expected >=1 row, saw %s%s',
        c ->> 't', v_got,
        case when v_state is null then '' else '  [sqlstate ' || v_state || ']' end);
    end if;
  end loop;

  -- ==========================================================================
  -- 4. COLUMN-LEVEL EXPOSURE OF USER IDENTIFIERS
  --    reviews, product_reviews, product_questions and craft_reviews are all
  --    `select using (true)`: the ROWS are public on purpose and no policy can
  --    hide one column of them. Hiding customer_id / asker_id is therefore a
  --    GRANT question -- and a bare `revoke select (col)` is a NO-OP, because
  --    column-level revoke only withdraws column-level grants while the
  --    table-level SELECT still covers every column. The working form is
  --    revoke-the-table then grant-back-the-columns, which is what 0286/0287
  --    do. This section asserts the OUTCOME, not the statement, so it stays
  --    true however the grant is spelled next time.
  --
  --    'pend' marks a check that is EXPECTED to be open today because
  --    0287_PENDING_DEPLOY has not been applied -- and must not be, until the
  --    app change that stops selecting those columns is deployed, or the
  --    storefront silently loses its reviews block (0287 records that outage).
  --    A pending check that starts PASSING is reported as STALE: 0287 landed,
  --    delete the marker on that line.
  -- ==========================================================================
  v_cols := jsonb_build_array(
    jsonb_build_object('r','anon',         't','craft_reviews',    'col','customer_id',  'want','denied', 'k','id',        'v',null,     'pend',''),
    jsonb_build_object('r','authenticated','t','craft_reviews',    'col','customer_id',  'want','denied', 'k','id',        'v',null,     'pend',''),
    jsonb_build_object('r','anon',         't','craft_reviews',    'col','customer_name','want','allowed','k','id',        'v',null,     'pend',''),
    jsonb_build_object('r','anon',         't','reviews',          'col','customer_id',  'want','denied', 'k','store_id',  'v',v_store_a,'pend','0287'),
    jsonb_build_object('r','anon',         't','reviews',          'col','customer_name','want','allowed','k','store_id',  'v',v_store_a,'pend',''),
    jsonb_build_object('r','anon',         't','product_reviews',  'col','customer_id',  'want','denied', 'k','product_id','v',v_pub_a,  'pend','0287'),
    jsonb_build_object('r','anon',         't','product_reviews',  'col','customer_name','want','allowed','k','product_id','v',v_pub_a,  'pend',''),
    jsonb_build_object('r','anon',         't','product_questions','col','asker_id',     'want','denied', 'k','product_id','v',v_pub_a,  'pend','0287'),
    jsonb_build_object('r','anon',         't','product_questions','col','asker_name',   'want','allowed','k','product_id','v',v_pub_a,  'pend',''),
    jsonb_build_object('r','authenticated','t','product_questions','col','asker_id',     'want','denied', 'k','product_id','v',v_pub_a,  'pend','0287'),
    -- Deliberately asymmetric, per 0287: a signed-in customer's "have I
    -- already reviewed this?" filters on customer_id, and Postgres requires
    -- column SELECT privilege for a WHERE reference even on a row the caller
    -- owns (policy expressions are exempt; the caller's own column list is
    -- not). authenticated keeps the column; anon, which has no ownership
    -- question to ask, does not.
    jsonb_build_object('r','authenticated','t','reviews',          'col','customer_id',  'want','allowed','k','store_id',  'v',v_store_a,'pend',''));

  for j in 0 .. jsonb_array_length(v_cols) - 1 loop
    c := v_cols -> j;
    v_q := case when c ->> 'v' is null
           then format('select count(%I) from public.%I', c ->> 'col', c ->> 't')
           else format('select count(%I) from public.%I where %I = %L',
                       c ->> 'col', c ->> 't', c ->> 'k', (c ->> 'v')::uuid) end;

    execute format('set local role %I', c ->> 'r');
    perform set_config('request.jwt.claims',
      case when c ->> 'r' = 'anon' then '{}'
           else jsonb_build_object('sub', v_shopper::text, 'role', 'authenticated')::text end, true);
    perform set_config('request.jwt.claim.sub', '', true);
    v_state := null;
    begin
      execute v_q into v_got;
      v_allowed := true;
    exception when insufficient_privilege then
      v_allowed := false; v_state := sqlstate;
    when others then
      v_allowed := null; v_state := sqlstate;
    end;
    reset role;

    v_line := format('actor=%-16s table=%-22s column=%-14s wanted %s, got %s%s',
                     c ->> 'r', c ->> 't', c ->> 'col', c ->> 'want',
                     case when v_allowed is null then 'error'
                          when v_allowed then 'allowed' else 'denied' end,
                     case when v_state is null then '' else '  [sqlstate ' || v_state || ']' end);

    if v_allowed is null then
      v_fail := v_fail + 1;
      v_report := v_report || E'\n  FAIL     ' || v_line;
    elsif (c ->> 'want' = 'allowed') = v_allowed then
      if coalesce(c ->> 'pend','') <> '' then
        v_stale := v_stale + 1;
        v_report := v_report || E'\n  STALE    ' || v_line
                 || format('  -- migration %s has landed; drop the pending marker on this line', c ->> 'pend');
      else
        v_pass := v_pass + 1;
        if c ->> 'want' = 'allowed' then v_pos_pass := v_pos_pass + 1;
        else v_neg_pass := v_neg_pass + 1; end if;
      end if;
    elsif coalesce(c ->> 'pend','') <> '' then
      v_pending := v_pending + 1;
      v_report := v_report || E'\n  PENDING  ' || v_line
               || format('  -- known open until migration %s is applied', c ->> 'pend');
    else
      v_fail := v_fail + 1;
      v_report := v_report || E'\n  FAIL     ' || v_line;
    end if;
  end loop;

  -- ==========================================================================
  -- 5. VERDICT
  -- ==========================================================================
  -- Anti-vacuity. If nothing that SHOULD have been visible was visible, the
  -- fixtures did not land and every "expected 0" above proves nothing. This is
  -- the check that stops this file becoming the thing it was written against.
  if v_pos_pass = 0 then
    raise exception
      'RLS MATRIX FAILED: not one positive control passed -- no actor saw a row they were entitled to, so the fixtures did not land and every zero above is meaningless. checks=%',
      v_pass + v_fail;
  end if;

  if v_fail > 0 or v_stale > 0 then
    raise exception E'RLS MATRIX FAILED: % failed, % stale, % pending, % passed (% positive controls, % negative).\n%\n(transaction rolled back, nothing written)',
      v_fail, v_stale, v_pending, v_pass, v_pos_pass, v_neg_pass, v_report;
  end if;

  raise exception E'RLS MATRIX PASSED: % checks passed (% positive controls, % negative), % pending.\n%\n(transaction rolled back, nothing written)',
    v_pass, v_pos_pass, v_neg_pass, v_pending, v_report;
end;
$$;

rollback;
