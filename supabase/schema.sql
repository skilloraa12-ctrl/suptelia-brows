-- suptelia.brows — схема бази даних Supabase.
-- Виконайте весь файл у Supabase → SQL Editor → New query → Run.

-- Хто є адміністратором: тільки ця пошта (майстер).
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'margoesterhazi@gmail.com'
$$;

-- Налаштування сайту: прайс і текст «Про нас»
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);

-- Публікації з адмінки (до/після і готові роботи)
create table if not exists public.posts (
  id           bigint generated always as identity primary key,
  type         text not null check (type in ('ba','work')),
  image_url    text not null,
  storage_path text,
  created_at   timestamptz not null default now()
);

-- Відгуки клієнток. Нові відгуки чекають на перевірку.
create table if not exists public.reviews (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 40),
  rating     int  not null check (rating between 1 and 5),
  service    text,
  text       text not null check (char_length(text) between 1 and 800),
  status     text not null default 'pending' check (status in ('pending','approved')),
  created_at timestamptz not null default now()
);

alter table public.settings enable row level security;
alter table public.posts    enable row level security;
alter table public.reviews  enable row level security;

-- settings: читають усі, змінює тільки адмін
create policy "settings read"  on public.settings for select using (true);
create policy "settings write" on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- posts: читають усі, змінює тільки адмін
create policy "posts read"  on public.posts for select using (true);
create policy "posts write" on public.posts for all using (public.is_admin()) with check (public.is_admin());

-- reviews: усі бачать схвалені, будь-хто може надіслати новий (тільки зі статусом pending),
-- адмін бачить і змінює все
create policy "reviews read approved" on public.reviews for select using (status = 'approved' or public.is_admin());
create policy "reviews insert"        on public.reviews for insert with check (status = 'pending');
create policy "reviews admin update"  on public.reviews for update using (public.is_admin()) with check (public.is_admin());
create policy "reviews admin delete"  on public.reviews for delete using (public.is_admin());

-- Сховище картинок: публічний бакет posts, завантажує тільки адмін
insert into storage.buckets (id, name, public) values ('posts','posts', true)
on conflict (id) do nothing;
create policy "posts files read"   on storage.objects for select using (bucket_id = 'posts');
create policy "posts files write"  on storage.objects for insert with check (bucket_id = 'posts' and public.is_admin());
create policy "posts files delete" on storage.objects for delete using (bucket_id = 'posts' and public.is_admin());

-- Початкові дані
insert into public.settings (key, value) values
  ('price', '[["Корекція брів",200],["Фарбування + корекція",300],["Ламінування + фарбування + корекція",500]]'),
  ('about', to_jsonb('Я створюю брови, які підкреслюють ваші риси, а не змінюють їх.' || chr(10) || chr(10) || 'На кожному візиті підбираю форму під обличчя, колір під тон шкіри й волосся та розповідаю, як доглядати за бровами вдома.' || chr(10) || chr(10) || 'Чекаю вас у затишному кабінеті на вул. Дашковича.'::text))
on conflict (key) do nothing;
