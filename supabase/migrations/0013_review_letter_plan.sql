-- Wodouh — September 2026 catalogue: review + letter replaces the bundle.
--
-- plan_review_letter (299 SAR, stored as 29900 halalas) is the new
-- before-you-sign package. plan_bundle stays in the allowed list: nobody can
-- buy it any more (the server catalogue in _shared/tap.mjs no longer prices
-- it), but orders already paid for it are real rows and must stay valid.

alter table public.orders drop constraint if exists orders_plan_id_check;
alter table public.orders add constraint orders_plan_id_check check (plan_id in (
  'plan_review', 'plan_reviews5', 'plan_letter',
  'plan_case', 'plan_bundle', 'plan_review_letter', 'plan_biz'
));
