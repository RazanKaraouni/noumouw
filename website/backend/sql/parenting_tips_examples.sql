-- Optional before/after examples for parenting tips hero cards.
alter table public.parenting_tips
  add column if not exists example_before text,
  add column if not exists example_after text;
