-- CDC display label for milestone catalog rows (e.g. "by 2 Months").
-- Run in Supabase SQL editor before cdc_milestone_age_range_labels.sql backfill.
alter table public.milestones add column if not exists age_range text;
