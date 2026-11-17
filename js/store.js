// Сховище даних. Два режими:
//  • локальний (тест): localStorage у браузері;
//  • Supabase: таблиці settings, posts, reviews і бакет posts (див. supabase/schema.sql).
(function () {
  const C = window.SITE_CONFIG;
  const DEFAULTS = {
    price: [
      ['Корекція брів', 200],
      ['Фарбування + корекція', 300],
      ['Ламінування + фарбування + корекція', 500],
    ],
    about:
      'Я створюю брови, які підкреслюють ваші риси, а не змінюють їх.\n\n' +
      'На кожному візиті підбираю форму під обличчя, колір під тон шкіри й волосся та розповідаю, як доглядати за бровами вдома.\n\n' +
      'Чекаю вас у затишному кабінеті на вул. Дашковича.',
  };

  const useSupabase = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
  const sb = useSupabase ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey) : null;

  // ---------- локальний режим ----------
  const KEY = 'suptelia-site-v2';
  const SESSION = 'suptelia-admin-session';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } };
  const local = {
    mode: 'local',
    async getSettings() { const d = read(); return { price: d.price || DEFAULTS.price, about: d.about || DEFAULTS.about }; },
    async saveSettings(patch) { const d = read(); Object.assign(d, patch); if (!write(d)) throw new Error('Не вдалося зберегти'); },
    async getPosts() { return (read().posts || []).slice().reverse(); },
    async addPost(type, blob) {
      const src = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
      const d = read(); d.posts = d.posts || []; d.posts.push({ id: Date.now(), type, src });
      if (!write(d)) { throw new Error('У браузері закінчилося місце. Видаліть старі публікації.'); }
    },
    async deletePost(id) { const d = read(); d.posts = (d.posts || []).filter((p) => p.id != id); write(d); },
    async getReviews(all) {
      const r = (read().reviews || []).slice().reverse();
      return all ? r : r.filter((x) => x.status === 'approved');
    },
    async addReview(rv) { const d = read(); d.reviews = d.reviews || []; d.reviews.push({ ...rv, id: Date.now(), status: 'pending', created_at: new Date().toISOString() }); write(d); },
    async setReviewStatus(id, status) { const d = read(); (d.reviews || []).forEach((r) => { if (r.id == id) r.status = status; }); write(d); },
    async deleteReview(id) { const d = read(); d.reviews = (d.reviews || []).filter((r) => r.id != id); write(d); },
    loginLabel: 'Логін',
    async signIn(user, pass) {
      if (user.trim() === C.testLogin && pass === C.testPassword) { try { sessionStorage.setItem(SESSION, '1'); } catch (e) {} return; }
      throw new Error('Невірний логін або пароль. Перевірте і спробуйте ще раз.');
    },
    async isSignedIn() { try { return sessionStorage.getItem(SESSION) === '1'; } catch (e) { return false; } },
    async signOut() { try { sessionStorage.removeItem(SESSION); } catch (e) {} },
  };

  // ---------- Supabase ----------
  const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const remote = {
    mode: 'supabase',
    async getSettings() {
      const rows = must(await sb.from('settings').select('key,value'));
      const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return { price: m.price || DEFAULTS.price, about: m.about || DEFAULTS.about };
    },
    async saveSettings(patch) {
      const rows = Object.entries(patch).map(([key, value]) => ({ key, value }));
      must(await sb.from('settings').upsert(rows));
    },
    async getPosts() {
      return must(await sb.from('posts').select('id,type,image_url,created_at').order('created_at', { ascending: false }))
        .map((p) => ({ id: p.id, type: p.type, src: p.image_url, path: p.image_url }));
    },
    async addPost(type, blob) {
      const path = `${type}/${Date.now()}.jpg`;
      must(await sb.storage.from('posts').upload(path, blob, { contentType: 'image/jpeg' }));
      const url = sb.storage.from('posts').getPublicUrl(path).data.publicUrl;
      must(await sb.from('posts').insert({ type, image_url: url, storage_path: path }));
    },
    async deletePost(id) {
      const row = must(await sb.from('posts').select('storage_path').eq('id', id).single());
      if (row && row.storage_path) await sb.storage.from('posts').remove([row.storage_path]);
      must(await sb.from('posts').delete().eq('id', id));
    },
    async getReviews(all) {
      let q = sb.from('reviews').select('*').order('created_at', { ascending: false });
      if (!all) q = q.eq('status', 'approved');
      return must(await q);
    },
    async addReview(rv) { must(await sb.from('reviews').insert({ name: rv.name, rating: rv.rating, service: rv.service, text: rv.text })); },
    async setReviewStatus(id, status) { must(await sb.from('reviews').update({ status }).eq('id', id)); },
    async deleteReview(id) { must(await sb.from('reviews').delete().eq('id', id)); },
    loginLabel: 'Пошта',
    async signIn(email, pass) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) throw new Error(error.message.includes('confirm')
        ? 'Пошту ще не підтверджено. Відкрийте лист від Supabase і натисніть посилання.'
        : 'Невірна пошта або пароль. Перевірте і спробуйте ще раз.');
    },
    async isSignedIn() { const { data } = await sb.auth.getSession(); return !!data.session; },
    async signOut() { await sb.auth.signOut(); },
  };

  window.store = useSupabase ? remote : local;
})();
