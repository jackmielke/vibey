create table if not exists public.github_agent_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_auth_id uuid,
  actor_name text,
  action text not null,
  repo text not null,
  path text,
  ref text,
  commit_sha text,
  commit_url text,
  message text,
  ok boolean not null default true,
  error text,
  meta jsonb
);

create index if not exists github_agent_actions_created_idx
  on public.github_agent_actions (created_at desc);

alter table public.github_agent_actions enable row level security;

create policy "github actions: admin read"
  on public.github_agent_actions
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));