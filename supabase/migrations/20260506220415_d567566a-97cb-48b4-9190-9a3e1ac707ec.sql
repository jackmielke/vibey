
create table public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label text not null,
  description text not null,
  prompt text not null,
  category text not null default 'general',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_skills enable row level security;

create policy "Authenticated can view skills"
  on public.agent_skills for select
  to authenticated
  using (true);

create policy "Admins can insert skills"
  on public.agent_skills for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update skills"
  on public.agent_skills for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete skills"
  on public.agent_skills for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger update_agent_skills_updated_at
  before update on public.agent_skills
  for each row execute function public.update_updated_at_column();

insert into public.agent_skills (name, label, description, prompt, category) values
  ('explain_vibecoin',
   'Explain Vibecoin',
   'Give a warm, concise explainer of what Vibecoin (VIBE) is and why the community uses it.',
   'Explain Vibecoin (VIBE) in 3-4 sentences for someone new. Cover: it''s the community''s social token on Solana, used to reward contributions and unlock residency perks; supply is fixed; pool liquidity is thin so it''s a community currency, not a speculation vehicle. Keep it warm, plainspoken, no hype.',
   'community'),
  ('summarize_chat',
   'Summarize this chat',
   'Summarize the current conversation into a crisp recap with key decisions and next steps.',
   'Summarize the conversation so far as: (1) one-sentence TL;DR, (2) key points as bullets, (3) decisions made, (4) open questions or next steps. Be specific, skip filler.',
   'meta'),
  ('draft_tweet',
   'Draft a tweet',
   'Turn the recent context into a punchy tweet in the user''s voice.',
   'Draft a single tweet (≤270 chars) capturing the most interesting idea from the recent conversation. Match the user''s voice: direct, curious, lowercase-friendly, no hashtags, no emojis unless the user uses them. Return only the tweet text.',
   'writing'),
  ('residency_pitch',
   'Pitch the residency',
   'Give a short, honest pitch for the Vibe Code Residency tailored to who is asking.',
   'Pitch the Vibe Code Residency in 4-5 sentences. What it is: a builder residency where people ship together IRL. Who it''s for: builders shipping AI products, community-minded, allergic to LARPing. Tone: confident, specific, not salesy. Adapt detail level to what the user has asked.',
   'community');
