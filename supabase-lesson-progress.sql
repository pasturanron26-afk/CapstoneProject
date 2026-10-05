create table if not exists public.lesson_progress (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    lesson_key text not null,
    sections_read text[] not null default '{}'::text[],
    sections_done integer not null default 0,
    total_sections integer not null default 0,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, lesson_key)
);

create index if not exists idx_lesson_progress_user_id
on public.lesson_progress (user_id);

alter table public.lesson_progress enable row level security;

grant select, insert, update, delete on public.lesson_progress to authenticated;

drop policy if exists "Users manage lesson progress" on public.lesson_progress;
create policy "Users manage lesson progress"
on public.lesson_progress
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Admins can read lesson progress" on public.lesson_progress;
create policy "Admins can read lesson progress"
on public.lesson_progress
for select
to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
    )
);

create or replace function public.set_lesson_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists lesson_progress_set_updated_at on public.lesson_progress;
create trigger lesson_progress_set_updated_at
before update on public.lesson_progress
for each row
execute function public.set_lesson_progress_updated_at();
