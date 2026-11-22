-- À coller une seule fois dans Supabase : menu « SQL Editor » > « New query » > coller > « Run ».
-- Crée la table des tâches. Chaque compte ne peut lire et modifier que ses propres tâches.

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- seuls les comptes connectés peuvent utiliser la table (et uniquement leurs lignes, voir plus bas)
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "lire mes taches" on public.tasks
  for select using (auth.uid() = user_id);
create policy "ajouter mes taches" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "modifier mes taches" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "supprimer mes taches" on public.tasks
  for delete using (auth.uid() = user_id);

-- mise à jour en direct entre l'ordinateur, l'iPhone et l'iPad
alter publication supabase_realtime add table public.tasks;
