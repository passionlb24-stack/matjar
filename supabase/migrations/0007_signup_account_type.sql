-- Honor the account type chosen at signup (merchant or customer only;
-- never a privileged role). Read from raw_user_meta_data.account_type.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_type text := new.raw_user_meta_data ->> 'account_type';
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when requested_type = 'merchant' then 'merchant'::platform_role
      else 'customer'::platform_role
    end
  );
  return new;
end;
$$;
