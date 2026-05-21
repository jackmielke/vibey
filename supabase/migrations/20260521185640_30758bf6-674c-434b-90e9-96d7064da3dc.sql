
create table if not exists public.vibey_vents (
  id uuid primary key default gen_random_uuid(),
  urgency text not null check (urgency in ('fyi','stuck','blocked')),
  message text not null,
  context text,
  source text,
  telegram_message_id bigint,
  delivered boolean not null default false,
  delivery_error text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.vibey_vents enable row level security;

do $$ begin
  create policy "Admins can read vibey_vents"
    on public.vibey_vents for select
    to authenticated
    using (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null;
end $$;

insert into public.agent_tools (name, label, description, category, is_enabled)
values (
  'notify_jack',
  'Notify Jack',
  'Send Jack a Telegram DM when Vibey is stuck, blocked, or wants to flag something.',
  'admin',
  true
)
on conflict (name) do nothing;
