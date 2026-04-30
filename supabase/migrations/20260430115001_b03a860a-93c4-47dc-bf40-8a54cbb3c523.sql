insert into public.community_members (community_id, user_id, role)
values ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '3f5ca19c-bed2-48ee-919e-8a2f553ee399', 'admin')
on conflict do nothing;