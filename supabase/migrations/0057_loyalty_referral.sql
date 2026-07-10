-- Loyalty points + referral program (growth flywheel).
--
-- Points are an append-only ledger; balance = sum(delta). Points are earned
-- when an order is completed (1 per whole currency unit of the total) and as
-- referral bonuses. A referral rewards BOTH users the first time the referred
-- user completes an order. Referral codes are generated lazily (no change to
-- the signup trigger, which must never fail). Redemption-to-discount is a
-- later step (needs a funding decision under cash-on-delivery).

-- ── Referral code per user (lazy-filled) ────────────────────────────────────
alter table public.profiles add column if not exists referral_code text unique;

-- ── Points ledger ───────────────────────────────────────────────────────────
create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta int not null,
  reason text not null, -- 'order' | 'referral_referrer' | 'referral_referred' | 'redeem'
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_ledger_user_idx on public.loyalty_ledger (user_id);
alter table public.loyalty_ledger enable row level security;
-- Read-only to the owner; all writes go through SECURITY DEFINER functions.
drop policy if exists loyalty_ledger_select_own on public.loyalty_ledger;
create policy loyalty_ledger_select_own on public.loyalty_ledger
  for select to authenticated using (user_id = (select auth.uid()));

-- ── Referrals ───────────────────────────────────────────────────────────────
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null unique references public.profiles (id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'rewarded'
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  constraint referrals_not_self check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
alter table public.referrals enable row level security;
drop policy if exists referrals_select_own on public.referrals;
create policy referrals_select_own on public.referrals
  for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));

-- ── Balance helper ──────────────────────────────────────────────────────────
create or replace function public.loyalty_balance(p_user uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(delta), 0)::int
  from public.loyalty_ledger where user_id = p_user;
$$;
grant execute on function public.loyalty_balance(uuid) to authenticated;

-- ── Referral code getter/creator ────────────────────────────────────────────
create or replace function public.get_my_referral_code()
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_code text;
begin
  if v_uid is null then return null; end if;
  select referral_code into v_code from public.profiles where id = v_uid;
  if v_code is null then
    -- 8 hex chars derived from the user id: stable + effectively unique.
    v_code := upper(substr(md5(v_uid::text), 1, 8));
    update public.profiles set referral_code = v_code where id = v_uid;
  end if;
  return v_code;
end; $$;
grant execute on function public.get_my_referral_code() to authenticated;

-- ── Record a referral (called by the referred user right after signup) ──────
create or replace function public.record_referral(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_referrer uuid;
begin
  if v_uid is null or p_code is null or length(trim(p_code)) = 0 then
    return false;
  end if;
  if exists (select 1 from public.referrals where referred_id = v_uid) then
    return false; -- already attributed
  end if;
  select id into v_referrer from public.profiles
    where referral_code = upper(trim(p_code)) and id <> v_uid;
  if v_referrer is null then
    return false;
  end if;
  insert into public.referrals (referrer_id, referred_id, status)
    values (v_referrer, v_uid, 'pending')
    on conflict (referred_id) do nothing;
  return true;
end; $$;
grant execute on function public.record_referral(text) to authenticated;

-- ── Earn on completed orders + settle referral ──────────────────────────────
create or replace function public.award_loyalty_on_complete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pts int; v_ref record; v_bonus int := 200;
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
     and new.customer_id is not null then

    -- 1 point per whole unit of the order total, once per order.
    if not exists (
      select 1 from public.loyalty_ledger where order_id = new.id and reason = 'order'
    ) then
      v_pts := floor(new.total)::int;
      if v_pts > 0 then
        insert into public.loyalty_ledger (user_id, delta, reason, order_id)
        values (new.customer_id, v_pts, 'order', new.id);
      end if;
    end if;

    -- First completed order settles a pending referral, rewarding both sides.
    select * into v_ref from public.referrals
      where referred_id = new.customer_id and status = 'pending';
    if found then
      update public.referrals set status = 'rewarded', rewarded_at = now()
        where id = v_ref.id;
      insert into public.loyalty_ledger (user_id, delta, reason, order_id) values
        (v_ref.referred_id, v_bonus, 'referral_referred', new.id),
        (v_ref.referrer_id, v_bonus, 'referral_referrer', new.id);
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists orders_award_loyalty on public.orders;
create trigger orders_award_loyalty
  after update on public.orders
  for each row execute function public.award_loyalty_on_complete();
