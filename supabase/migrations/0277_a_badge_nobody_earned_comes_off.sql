-- Three stores show customers a verification badge that nothing backs.
--
-- `admin-subs-client.tsx` set `is_verified = true` as a side effect of recording
-- a subscription payment, so "موثّق" came to mean "paid". Measured before writing
-- this: 3 stores carry the flag, and between them they have **zero**
-- store_verifications rows with status 'verified', zero commercial_reg_verified,
-- and — the part that makes it plainly accidental — zero payments. The flag was
-- reachable from two places and earned in neither.
--
-- Pro and Verified are different promises. Pro is a tier a merchant bought.
-- Verified is a claim Matjar makes to a customer that it checked something. A
-- badge its own subject can purchase is not evidence, and the store card already
-- renders the two separately, so nothing is lost by telling the truth.
--
-- This is a data correction that removes something three merchants currently
-- display, which is why it is a recorded migration and not a quiet UPDATE.
--
-- It is deliberately CONDITIONAL rather than a blanket reset: a store that has
-- actually been verified keeps its badge. Today that set is empty, so all three
-- clear — but the condition is what makes this safe to re-run and honest to read
-- later. Re-verifying any of them is now a real path: the merchant submits to
-- store_verifications and an admin approves it (0272).
update public.stores s
set is_verified = false
where s.is_verified = true
  and coalesce(s.commercial_reg_verified, false) = false
  and not exists (
    select 1
    from public.store_verifications v
    where v.store_id = s.id
      and v.status = 'verified'
      and (v.expires_on is null or v.expires_on >= (now() at time zone 'Asia/Beirut')::date)
  );

comment on column public.stores.is_verified is
  'Matjar checked this business. Set only by an admin acting on a store_verifications submission — never by a plan change, a payment, or anything the merchant can buy. See 0272 for the submission flow and 0277 for why three unearned flags were cleared.';
