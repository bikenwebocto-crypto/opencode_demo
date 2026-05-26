-- ============================================================
-- SUPABASE QUICK SETUP
-- Run this in your Supabase SQL Editor to get started
-- ============================================================

-- 1. Create a sample table
create table instruments (
  id bigint primary key generated always as identity,
  name text not null
);

-- Insert sample data
insert into instruments (name)
values
  ('violin'),
  ('viola'),
  ('cello');

-- Grant read access to the anon role
grant select on public.instruments to anon;

-- Enable Row Level Security
alter table instruments enable row level security;

-- Create an RLS policy for public read
create policy "public can read instruments"
on public.instruments
for select to anon
using (true);

-- ============================================================
-- 2. Verify setup
-- ============================================================
-- After running, you should be able to query:
-- const { data: instruments } = await supabase.from('instruments').select()
-- See: /instruments page
