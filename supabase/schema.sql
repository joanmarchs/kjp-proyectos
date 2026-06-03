create table if not exists public.project_costs_2026 (
  id text primary key,
  name text not null,
  start_date date,
  cost numeric not null default 0,
  sales numeric not null default 0,
  profit numeric not null default 0,
  suppliers jsonb not null default '[]'::jsonb,
  categories jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

alter table public.project_costs_2026 enable row level security;

drop policy if exists "Read project costs" on public.project_costs_2026;
create policy "Read project costs"
on public.project_costs_2026
for select
using (true);

create index if not exists project_costs_2026_profit_idx
on public.project_costs_2026 (profit);

alter table public.project_costs_2026
add column if not exists start_date date;

create index if not exists project_costs_2026_start_date_idx
on public.project_costs_2026 (start_date);
