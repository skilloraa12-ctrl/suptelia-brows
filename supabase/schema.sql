-- suptelia.brows — схема бази даних Supabase.
-- Усі об'єкти сайту мають префікс suptelia_, тож їх можна безпечно додати в проєкт,
-- де вже є інші таблиці.
-- Виконайте весь файл у Supabase → SQL Editor → New query → Run.

-- Адмін сайту: тільки користувач з ПІДТВЕРДЖЕНОЮ поштою margoesterhazi@gmail.com.
create or replace function public.suptelia_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'margoesterhazi@gmail.com'
      and u.email_confirmed_at is not null
  )
$$;
revoke all on function public.suptelia_is_admin() from public;
grant execute on function public.suptelia_is_admin() to anon, authenticated;

-- Налаштування сайту: прайс і текст «Про нас»
create table if not exists public.suptelia_settings (
  key   text primary key,
  value jsonb not null
);

-- Публікації з адмінки (до/після і готові роботи)
create table if not exists public.suptelia_posts (
  id           bigint generated always as identity primary key,
  type         text not null check (type in ('ba','work')),
  image_url    text not null,
  storage_path text,
  created_at   timestamptz not null default now()
);

-- Відгуки клієнток. 3–5 зірок публікуються одразу, 1–2 зірки чекають перевірки власниці.
create table if not exists public.suptelia_reviews (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 40),
  rating     int  not null check (rating between 1 and 5),
  service    text,
  text       text not null check (char_length(text) between 1 and 800),
  status     text not null default 'approved' check (status in ('pending','approved')),
  created_at timestamptz not null default now()
);

alter table public.suptelia_settings enable row level security;
alter table public.suptelia_posts    enable row level security;
alter table public.suptelia_reviews  enable row level security;

-- settings: читають усі, змінює тільки адмін
drop policy if exists "suptelia settings read"  on public.suptelia_settings;
drop policy if exists "suptelia settings write" on public.suptelia_settings;
create policy "suptelia settings read"  on public.suptelia_settings for select using (true);
create policy "suptelia settings write" on public.suptelia_settings for all
  using (public.suptelia_is_admin()) with check (public.suptelia_is_admin());

-- posts: читають усі, змінює тільки адмін
drop policy if exists "suptelia posts read"  on public.suptelia_posts;
drop policy if exists "suptelia posts write" on public.suptelia_posts;
create policy "suptelia posts read"  on public.suptelia_posts for select using (true);
create policy "suptelia posts write" on public.suptelia_posts for all
  using (public.suptelia_is_admin()) with check (public.suptelia_is_admin());

-- reviews: усі бачать опубліковані; будь-хто може надіслати новий (статус ставить тригер за оцінкою);
-- адмін бачить і змінює все
drop policy if exists "suptelia reviews read"   on public.suptelia_reviews;
drop policy if exists "suptelia reviews insert" on public.suptelia_reviews;
drop policy if exists "suptelia reviews update" on public.suptelia_reviews;
drop policy if exists "suptelia reviews delete" on public.suptelia_reviews;
create policy "suptelia reviews read"   on public.suptelia_reviews for select
  using (status = 'approved' or public.suptelia_is_admin());
create policy "suptelia reviews insert" on public.suptelia_reviews for insert
  with check (status = case when rating >= 3 then 'approved' else 'pending' end);
create policy "suptelia reviews update" on public.suptelia_reviews for update
  using (public.suptelia_is_admin()) with check (public.suptelia_is_admin());
create policy "suptelia reviews delete" on public.suptelia_reviews for delete
  using (public.suptelia_is_admin());

-- Сховище картинок: публічний бакет suptelia-posts, завантажує тільки адмін
insert into storage.buckets (id, name, public) values ('suptelia-posts', 'suptelia-posts', true)
on conflict (id) do nothing;
drop policy if exists "suptelia files read"   on storage.objects;
drop policy if exists "suptelia files write"  on storage.objects;
drop policy if exists "suptelia files delete" on storage.objects;
create policy "suptelia files read"   on storage.objects for select using (bucket_id = 'suptelia-posts');
create policy "suptelia files write"  on storage.objects for insert
  with check (bucket_id = 'suptelia-posts' and public.suptelia_is_admin());
create policy "suptelia files delete" on storage.objects for delete
  using (bucket_id = 'suptelia-posts' and public.suptelia_is_admin());

-- Початкові дані
insert into public.suptelia_settings (key, value) values
  ('price', '[["Корекція брів",200],["Фарбування + корекція",300],["Ламінування + фарбування + корекція",500]]'),
  ('about', to_jsonb(
    'Я створюю брови, які підкреслюють ваші риси, а не змінюють їх.' || chr(10) || chr(10) ||
    'На кожному візиті підбираю форму під обличчя, колір під тон шкіри й волосся та розповідаю, як доглядати за бровами вдома.' || chr(10) || chr(10) ||
    'Чекаю вас у затишному кабінеті на вул. Дашковича.'))
on conflict (key) do nothing;

-- Тригер відгуків, обмеження та ліміти сховища: див. supabase/security-update.sql (запустіть після цього файлу).
