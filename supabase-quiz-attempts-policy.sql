alter table public.quiz_attempts enable row level security;

grant select on table public.quiz_attempts to authenticated;

drop policy if exists "Students can read own quiz attempts" on public.quiz_attempts;
create policy "Students can read own quiz attempts"
on public.quiz_attempts
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins can read all quiz attempts" on public.quiz_attempts;
create policy "Admins can read all quiz attempts"
on public.quiz_attempts
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

drop policy if exists "Students can insert their own quiz attempts" on public.quiz_attempts;
create policy "Students can insert their own quiz attempts"
on public.quiz_attempts
for insert
to authenticated
with check ((select auth.uid()) = user_id);