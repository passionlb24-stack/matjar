-- Jobs vertical. Employers (any authenticated user — often a store owner) post
-- jobs; people apply. Reuses profiles + the notification/push pipeline; no
-- payment. Applications carry a cover note, phone, and optional CV link.

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  title text not null,
  company_name text not null,
  description text not null,
  region text,
  job_type text,      -- full_time | part_time | contract | remote | internship
  salary_note text,
  how_to_apply text,
  status text not null default 'active', -- active | closed
  created_at timestamptz not null default now()
);
create index if not exists job_postings_active_idx
  on public.job_postings (status, created_at desc);
create index if not exists job_postings_poster_idx
  on public.job_postings (poster_id);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  cover_note text,
  phone text,
  cv_url text,
  created_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);
create index if not exists job_applications_job_idx
  on public.job_applications (job_id);

alter table public.job_postings enable row level security;
alter table public.job_applications enable row level security;

-- Postings: public reads active ones; the poster sees + manages their own.
drop policy if exists job_postings_select on public.job_postings;
create policy job_postings_select on public.job_postings
  for select to public
  using (status = 'active' or poster_id = (select auth.uid()));
drop policy if exists job_postings_insert on public.job_postings;
create policy job_postings_insert on public.job_postings
  for insert to authenticated with check (poster_id = (select auth.uid()));
drop policy if exists job_postings_update on public.job_postings;
create policy job_postings_update on public.job_postings
  for update to authenticated
  using (poster_id = (select auth.uid())) with check (poster_id = (select auth.uid()));
drop policy if exists job_postings_delete on public.job_postings;
create policy job_postings_delete on public.job_postings
  for delete to authenticated using (poster_id = (select auth.uid()));

-- Applications: the applicant and the job's poster can read; applicant inserts
-- as themselves; applicant may withdraw (delete) their own.
drop policy if exists job_applications_select on public.job_applications;
create policy job_applications_select on public.job_applications
  for select to authenticated
  using (
    applicant_id = (select auth.uid())
    or exists (
      select 1 from public.job_postings j
      where j.id = job_id and j.poster_id = (select auth.uid())
    )
  );
drop policy if exists job_applications_insert on public.job_applications;
create policy job_applications_insert on public.job_applications
  for insert to authenticated with check (applicant_id = (select auth.uid()));
drop policy if exists job_applications_delete on public.job_applications;
create policy job_applications_delete on public.job_applications
  for delete to authenticated using (applicant_id = (select auth.uid()));

-- Notify the poster when someone applies (→ web-push pipeline).
create or replace function public.notify_job_application()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_poster uuid;
begin
  select poster_id into v_poster from public.job_postings where id = new.job_id;
  if v_poster is not null and v_poster <> new.applicant_id then
    insert into public.notifications (user_id, type, data)
    values (v_poster, 'job_application', jsonb_build_object('job_id', new.job_id));
  end if;
  return new;
end; $$;
drop trigger if exists job_applications_notify on public.job_applications;
create trigger job_applications_notify after insert on public.job_applications
  for each row execute function public.notify_job_application();

-- Add a 'job_application' case to the push mapping (else-fallback also covers it).
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_title text; v_body text; v_url text; v_lid text;
begin
  v_lid := new.data->>'listing_id';
  case new.type
    when 'order_new' then v_title := 'طلب جديد 🛒'; v_body := 'وصلك طلب جديد على متجرك'; v_url := '/ar/merchant';
    when 'order_status' then v_title := 'تحديث طلبك'; v_body := 'تغيّرت حالة طلبك'; v_url := '/ar/orders';
    when 'booking_new' then v_title := 'حجز جديد 📅'; v_body := 'وصلك حجز جديد'; v_url := '/ar/merchant';
    when 'booking_status' then v_title := 'تحديث حجزك'; v_body := 'تغيّرت حالة حجزك'; v_url := '/ar/bookings';
    when 'store_product' then v_title := 'منتج جديد'; v_body := 'متجر بتتابعه نزّل منتج جديد'; v_url := '/ar';
    when 'listing_approved' then v_title := 'تمت الموافقة ✅'; v_body := 'تمت الموافقة على إعلانك في سوق الأحد'; v_url := coalesce('/ar/market/'||v_lid,'/ar/account');
    when 'listing_rejected' then v_title := 'إعلانك'; v_body := 'تم رفض إعلانك في سوق الأحد'; v_url := '/ar/account';
    when 'listing_match' then v_title := 'إعلان جديد 🔔'; v_body := 'إعلان جديد يطابق بحثك المحفوظ'; v_url := coalesce('/ar/market/'||v_lid,'/ar/market');
    when 'message' then v_title := 'رسالة جديدة 💬'; v_body := 'وصلتك رسالة جديدة'; v_url := '/ar/messages';
    when 'job_application' then v_title := 'طلب توظيف جديد 📄'; v_body := 'حدا قدّم على وظيفتك'; v_url := '/ar/jobs/mine';
    else v_title := 'متجر'; v_body := 'عندك تحديث جديد'; v_url := '/ar/notifications';
  end case;
  perform public.notify_push(new.user_id, v_title, v_body, v_url);
  return new;
end $$;
