-- 0195: Pin search_path on stay_base_total (CP5 helper). It's an IMMUTABLE SQL
-- helper that only calls built-ins (generate_series/extract/coalesce/sum), so an
-- empty search_path is safe and clears the function_search_path_mutable advisor.
alter function public.stay_base_total(public.accommodation_units, date, date)
  set search_path = '';
