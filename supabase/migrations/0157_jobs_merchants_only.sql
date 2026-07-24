-- Job postings are for merchants only: a user must own a store to post a job.
-- Reuses owns_store() (0156). DB-level gate so the UI can't be bypassed.
drop policy if exists job_postings_insert on public.job_postings;
create policy job_postings_insert on public.job_postings
  for insert to authenticated
  with check (poster_id = (select auth.uid()) and public.owns_store());
