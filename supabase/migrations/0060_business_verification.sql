-- Chamber-of-Commerce business verification. A merchant records their
-- commercial registration number (رقم السجل التجاري); an admin confirms it,
-- flipping commercial_reg_verified, which surfaces a strong "registered
-- business" trust badge — distinct from the lighter is_verified flag.
--
-- Security: like featured_until, the verified flag is admin-only. We extend the
-- existing stores admin-fields guard so a merchant can set their registration
-- NUMBER but cannot self-verify, and changing the number drops any prior
-- verification (forcing a fresh admin review).

alter table public.stores
  add column if not exists commercial_reg_no text,
  add column if not exists commercial_reg_verified boolean not null default false;

create or replace function public.guard_store_featured()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    -- featured_until is granted by admins only.
    new.featured_until := old.featured_until;
    -- Merchants may edit their registration number, but not the verified flag;
    -- editing the number invalidates a prior verification.
    if new.commercial_reg_no is distinct from old.commercial_reg_no then
      new.commercial_reg_verified := false;
    else
      new.commercial_reg_verified := old.commercial_reg_verified;
    end if;
  end if;
  return new;
end; $$;
