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

create table if not exists public.prl_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  project_name text not null,
  company_name text not null,
  company_email text not null,
  company_cif text,
  contact_name text,
  role text,
  parent_invitation_id uuid references public.prl_invitations(id) on delete set null,
  token text not null unique,
  status text not null default 'invited',
  contractor_id uuid,
  accepted_at timestamptz,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prl_contractors (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  contractor_type text not null default 'empresa',
  company_name text not null,
  company_cif text,
  contact_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.prl_workers (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references public.prl_contractors(id) on delete cascade,
  invitation_id uuid references public.prl_invitations(id) on delete cascade,
  project_id text not null,
  full_name text not null,
  dni text,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prl_documents (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  invitation_id uuid references public.prl_invitations(id) on delete cascade,
  company_name text not null,
  company_email text not null,
  document_type text not null,
  category text not null default 'empresa',
  owner_type text not null default 'company',
  owner_id uuid,
  owner_name text,
  file_name text not null,
  file_path text,
  file_url text,
  status text not null default 'revision',
  issue_date date,
  expiry_date date,
  uploaded_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  rejection_comment text,
  internal_comment text
);

alter table public.prl_invitations enable row level security;
alter table public.prl_contractors enable row level security;
alter table public.prl_workers enable row level security;
alter table public.prl_documents enable row level security;

drop policy if exists "Read prl invitations" on public.prl_invitations;
create policy "Read prl invitations"
on public.prl_invitations
for select
using (true);

drop policy if exists "Read prl contractors" on public.prl_contractors;
create policy "Read prl contractors"
on public.prl_contractors
for select
using (true);

drop policy if exists "Read prl workers" on public.prl_workers;
create policy "Read prl workers"
on public.prl_workers
for select
using (true);

drop policy if exists "Read prl documents" on public.prl_documents;
create policy "Read prl documents"
on public.prl_documents
for select
using (true);

create index if not exists prl_invitations_project_idx
on public.prl_invitations (project_id);

alter table public.prl_invitations
add column if not exists email_sent_at timestamptz;

alter table public.prl_invitations
add column if not exists email_error text;

alter table public.prl_invitations
add column if not exists contractor_id uuid;

alter table public.prl_invitations
add column if not exists accepted_at timestamptz;

alter table public.prl_invitations
add column if not exists parent_invitation_id uuid references public.prl_invitations(id) on delete set null;

alter table public.prl_contractors
add column if not exists contractor_type text not null default 'empresa';

alter table public.prl_documents
add column if not exists owner_type text not null default 'company';

alter table public.prl_documents
add column if not exists owner_id uuid;

alter table public.prl_documents
add column if not exists owner_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prl_invitations_contractor_id_fkey'
  ) then
    alter table public.prl_invitations
    add constraint prl_invitations_contractor_id_fkey
    foreign key (contractor_id) references public.prl_contractors(id);
  end if;
end $$;

create index if not exists prl_documents_project_idx
on public.prl_documents (project_id);

create index if not exists prl_documents_invitation_idx
on public.prl_documents (invitation_id);

create index if not exists prl_workers_invitation_idx
on public.prl_workers (invitation_id);
