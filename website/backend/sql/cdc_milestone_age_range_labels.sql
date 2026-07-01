-- Remap milestone age bounds to CDC checkpoint bands (2026 spec).
-- Run milestones_age_range_column.sql first, then this file (Supabase SQL editor or migration runner).
--
-- Canonical bands:
--   by 2 Months   0–2    | by 4 Months   2–4   | by 6 Months   4–6
--   by 9 Months   6–9    | by 12 Months  9–12  | by 18 Months  12–18
--   by 2 Years    12–24  | by 30 Months  24–30 | by 3 Years    30–36
--   by 4 Years    36–48  | by 5 Years    48–60
--
-- Step 1: legacy checkpoint-style rows (min = prior checkpoint month).
update public.milestones set age_months_min = 0,  age_months_max = 2  where age_months_min = 2  and age_months_max = 3;
update public.milestones set age_months_min = 2,  age_months_max = 4  where age_months_min = 4  and age_months_max = 5;
update public.milestones set age_months_min = 4,  age_months_max = 6  where age_months_min = 6  and age_months_max = 8;
update public.milestones set age_months_min = 6,  age_months_max = 9  where age_months_min = 9  and age_months_max = 11;
update public.milestones set age_months_min = 9,  age_months_max = 12 where age_months_min = 12 and age_months_max = 14;

-- Step 2: old 12-tier bands → new bands (drop by 15 Months).
update public.milestones set age_months_min = 12, age_months_max = 18 where age_months_min = 12 and age_months_max = 15;
update public.milestones set age_months_min = 12, age_months_max = 18 where age_months_min = 15 and age_months_max = 18;
update public.milestones set age_months_min = 12, age_months_max = 24 where age_months_min = 18 and age_months_max = 24;

-- Additional legacy checkpoint bands in seeded catalog.
update public.milestones set age_months_min = 12, age_months_max = 18 where age_months_min = 15 and age_months_max = 17;
update public.milestones set age_months_min = 12, age_months_max = 24 where age_months_min = 18 and age_months_max = 23;
update public.milestones set age_months_min = 30, age_months_max = 36 where age_months_min = 24 and age_months_max = 35;
update public.milestones set age_months_min = 36, age_months_max = 48 where age_months_min = 36 and age_months_max = 47;
update public.milestones set age_months_min = 48, age_months_max = 60 where age_months_min = 48 and age_months_max = 59;
update public.milestones set age_months_min = 48, age_months_max = 60 where age_months_min = 60 and age_months_max = 72;

-- Step 4: backfill age_range labels (requires milestones_age_range_column.sql).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'milestones'
      and column_name = 'age_range'
  ) then
    execute $view$
      create or replace view public.milestone_cdc_age_label as
      select
        age_months_min,
        age_months_max,
        case
          when age_months_min = 0  and age_months_max = 2  then 'by 2 Months'
          when age_months_min = 2  and age_months_max = 4  then 'by 4 Months'
          when age_months_min = 4  and age_months_max = 6  then 'by 6 Months'
          when age_months_min = 6  and age_months_max = 9  then 'by 9 Months'
          when age_months_min = 9  and age_months_max = 12 then 'by 12 Months'
          when age_months_min = 12 and age_months_max = 18 then 'by 18 Months'
          when age_months_min = 12 and age_months_max = 24 then 'by 2 Years'
          when age_months_min = 24 and age_months_max = 30 then 'by 30 Months'
          when age_months_min = 30 and age_months_max = 36 then 'by 3 Years'
          when age_months_min = 36 and age_months_max = 48 then 'by 4 Years'
          when age_months_min = 48 and age_months_max = 60 then 'by 5 Years'
          else null
        end as cdc_label
      from (
        select distinct age_months_min, age_months_max
        from public.milestones
      ) bounds
    $view$;

    update public.milestones m
    set age_range = v.cdc_label
    from public.milestone_cdc_age_label v
    where m.age_months_min = v.age_months_min
      and m.age_months_max = v.age_months_max
      and v.cdc_label is not null;

    update public.milestones
    set age_range = case trim(age_range)
      when '2 Months' then 'by 2 Months'
      when '4 Months' then 'by 4 Months'
      when '6 Months' then 'by 6 Months'
      when '9 Months' then 'by 9 Months'
      when '1 Year' then 'by 12 Months'
      when 'by 1 Year' then 'by 12 Months'
      when '12 Months' then 'by 12 Months'
      when '15 Months' then 'by 18 Months'
      when 'by 15 Months' then 'by 18 Months'
      when '18 Months' then 'by 18 Months'
      when '2 Years' then 'by 2 Years'
      when '30 Months' then 'by 30 Months'
      when '3 Years' then 'by 3 Years'
      when '4 Years' then 'by 4 Years'
      when '5 Years' then 'by 5 Years'
      else age_range
    end
    where age_range is not null
      and trim(age_range) <> '';
  end if;
end $$;
