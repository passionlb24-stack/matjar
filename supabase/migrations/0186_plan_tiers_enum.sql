-- Activate the 3 paid tiers: extend store_plan with basic + business (free stays
-- as the lapsed/entry floor, pro sits between). Values are added out-of-line so
-- they can be used by later statements. Rank order: free < basic < pro < business.
alter type public.store_plan add value if not exists 'basic' before 'pro';
alter type public.store_plan add value if not exists 'business' after 'pro';
