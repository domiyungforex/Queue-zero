-- Pricing page display fixes (audit 2026-11-28):
-- plans were displayed out of price order (Professional before Education
-- and Events) because sort_order followed the seed order in
-- 20261126000000, and the Events description said "Per-event pricing"
-- while the plan is billed monthly. Reorder by ascending monthly price
-- (FREE 0, STARTER, EVENTS, GROWTH, EDUCATION, PROFESSIONAL, ENTERPRISE
-- custom) and align the Events description with how it is billed.
-- The seed used "on conflict do nothing", so update rows in place.

begin;

update public.plans set sort_order = case code
  when 'FREE' then 1
  when 'STARTER' then 2
  when 'EVENTS' then 3
  when 'GROWTH' then 4
  when 'EDUCATION' then 5
  when 'PROFESSIONAL' then 6
  when 'ENTERPRISE' then 7
  else sort_order
end
where code in ('FREE', 'STARTER', 'EVENTS', 'GROWTH', 'EDUCATION', 'PROFESSIONAL', 'ENTERPRISE');

update public.plans
set description = 'Event-ready queues for conference and summit organizers.'
where code = 'EVENTS' and description = 'Per-event pricing for conference and summit organizers.';

commit;
