create table if not exists public.course_appearances (
  course_id text primary key,
  banner_color text not null check (banner_color in (
    'from-indigo-500 to-violet-700',
    'from-sky-500 to-blue-700',
    'from-emerald-500 to-teal-700',
    'from-rose-500 to-pink-700',
    'from-amber-400 to-orange-600',
    'from-slate-600 to-slate-900'
  )),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.course_appearances enable row level security;
