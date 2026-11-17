-- suptelia.brows — оновлення захисту (запустіть один раз у Supabase → SQL Editor → Run).
-- Безпечно запускати повторно.

-- 1. Відгуки: сервер сам ставить статус і дату, чистить пробіли й обмежує частоту.
create or replace function public.suptelia_review_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.name    := btrim(new.name);
  new.text    := btrim(new.text);
  new.service := nullif(btrim(coalesce(new.service, '')), '');
  if new.name = '' or new.text = '' then
    raise exception 'Порожнє ім''я або текст відгуку';
  end if;
  -- захист від спаму: не більше 10 відгуків за 10 хвилин на весь сайт
  if (select count(*) from public.suptelia_reviews where created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Забагато відгуків за короткий час. Спробуйте трохи пізніше.';
  end if;
  new.created_at := now();                                              -- дату не можна підробити
  new.status := case when new.rating >= 3 then 'approved' else 'pending' end; -- 3–5 зірок одразу, 1–2 на перевірку
  return new;
end $$;
revoke all on function public.suptelia_review_status() from public, anon, authenticated;

drop trigger if exists suptelia_review_status on public.suptelia_reviews;
create trigger suptelia_review_status before insert on public.suptelia_reviews
  for each row execute function public.suptelia_review_status();

-- 2. Обмеження довжини поля «послуга»
alter table public.suptelia_reviews drop constraint if exists suptelia_reviews_service_len;
alter table public.suptelia_reviews add constraint suptelia_reviews_service_len
  check (service is null or char_length(service) <= 80);

-- 3. Сховище фото: лише картинки JPEG/PNG до 5 МБ
update storage.buckets
   set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png']
 where id = 'suptelia-posts';

-- 4. Права адміна: функцію може викликати лише сама база під час перевірки правил
revoke all on function public.suptelia_is_admin() from public;
grant execute on function public.suptelia_is_admin() to anon, authenticated;
