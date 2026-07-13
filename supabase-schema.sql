-- FitControl Pro v13 Cloud
-- Ejecutar una sola vez en Supabase > SQL Editor.

create table if not exists public.fitcontrol_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.fitcontrol_user_data enable row level security;

revoke all on table public.fitcontrol_user_data from anon;
grant select, insert, update, delete on table public.fitcontrol_user_data to authenticated;

create policy "Usuarios leen sus propios datos"
on public.fitcontrol_user_data
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Usuarios crean sus propios datos"
on public.fitcontrol_user_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Usuarios actualizan sus propios datos"
on public.fitcontrol_user_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Usuarios eliminan sus propios datos"
on public.fitcontrol_user_data
for delete
to authenticated
using ((select auth.uid()) = user_id);
