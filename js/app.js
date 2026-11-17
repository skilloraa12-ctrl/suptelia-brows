(function () {
  const C = window.SITE_CONFIG, store = window.store;
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

  const state = (window.SITE_STATE = { price: [], about: '', posts: [] });

  /* ---------- шапка і меню ---------- */
  const header = $('#top');
  addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 8), { passive: true });
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    $('#burger').setAttribute('aria-expanded', open);
    $('#burger').setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    $('#menu').setAttribute('aria-hidden', !open);
  }
  $('#burger').onclick = () => setMenu(!document.body.classList.contains('menu-open'));
  $$('#menu a').forEach((a) => (a.onclick = () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { setMenu(false); $('#lb').hidden = true; } });

  // 4 натискання на лого → вхід
  let taps = 0, tapT;
  $('#logo').onclick = () => {
    taps++; clearTimeout(tapT);
    tapT = setTimeout(() => { if (taps < 4) scrollTo({ top: 0, behavior: 'smooth' }); taps = 0; }, 700);
    if (taps >= 4) { taps = 0; clearTimeout(tapT); openLogin(); }
  };

  /* ---------- контент ---------- */
  function renderPrice() {
    $('#plist').innerHTML = state.price.map(([n, p]) => `<div class="prow"><b>${esc(n)}</b><span class="pr">${Number(p) || 0}<small>ГРН</small></span></div>`).join('');
    $('#rvService').innerHTML = '<option value="">Не вказувати</option>' + state.price.map(([n]) => `<option>${esc(n)}</option>`).join('');
  }
  const card = (src, isNew) => `<button class="card" data-lb="${esc(src)}"><img src="${esc(src)}" alt="Робота suptelia.brows" loading="lazy">${isNew ? '<span class="new">нове</span>' : ''}</button>`;
  const BASE_BA = [1, 2, 3, 4, 5, 6].map((i) => `assets/stories/do-pislia-${i}.jpg`);
  const BASE_WORK = [1, 2, 3].map((i) => `assets/work/robota-${i}.jpg`);
  function renderRails() {
    const mine = (t) => state.posts.filter((p) => p.type === t);
    $('#railBA').innerHTML = mine('ba').map((p) => card(p.src, 1)).join('') + BASE_BA.map((s) => card(s)).join('');
    $('#railWork').innerHTML = mine('work').map((p) => card(p.src, 1)).join('') + BASE_WORK.map((s) => card(s)).join('');
  }
  function renderAbout() { $('#aboutText').textContent = state.about; }
  const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  const date = (s) => { try { return new Date(s).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
  async function renderReviews() {
    let list = [];
    try { list = await store.getReviews(false); } catch (e) {}
    $('#rvList').innerHTML = list.length
      ? list.map((r) => `<article class="rv"><span class="stars" aria-label="Оцінка ${r.rating} з 5">${stars(r.rating)}</span><p>${esc(r.text)}</p><span class="meta">${esc(r.name)}${r.service ? ' · ' + esc(r.service) : ''} · ${date(r.created_at)}</span></article>`).join('')
      : '<div class="rv-empty">Тут з\'являться відгуки клієнток. Будьте першою: розкажіть, як вам результат.</div>';
  }

  async function loadAll() {
    try { const s = await store.getSettings(); state.price = s.price; state.about = s.about; } catch (e) { toast('Не вдалося завантажити дані'); }
    try { state.posts = await store.getPosts(); } catch (e) { state.posts = []; }
    renderPrice(); renderRails(); renderAbout(); renderReviews();
  }
  loadAll();

  $$('.rail-ctrl').forEach((c) => {
    const r = document.getElementById(c.dataset.for), [p, n] = c.querySelectorAll('button');
    p.onclick = () => r.scrollBy({ left: -r.clientWidth * 0.8, behavior: 'smooth' });
    n.onclick = () => r.scrollBy({ left: r.clientWidth * 0.8, behavior: 'smooth' });
  });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-lb]'); if (!b) return; $('#lb img').src = b.dataset.lb; $('#lb').hidden = false; });
  $('#lb').onclick = (e) => { if (e.target.tagName !== 'IMG') $('#lb').hidden = true; };
  $$('[data-copy]').forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Скопійовано'); } catch (e) { toast(b.dataset.copy); } }));

  // карта
  const q = encodeURIComponent(C.mapQuery);
  $('#mapFrame').src = `https://maps.google.com/maps?q=${q}&z=16&output=embed`;
  $('#mapLink').href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  $('#routeLink').href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;

  // відгук
  $('#rvForm').onsubmit = async (e) => {
    e.preventDefault();
    const rv = { name: $('#rvName').value.trim(), rating: +document.querySelector('input[name=rate]:checked').value, service: $('#rvService').value, text: $('#rvText').value.trim() };
    if (!rv.name || !rv.text) return;
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      await store.addReview(rv);
      e.target.reset(); $('#r5').checked = true;
      $('#rvOk').textContent = 'Дякуємо! Відгук з\'явиться на сайті після перевірки майстром.';
    } catch (err) { $('#rvOk').textContent = 'Не вдалося надіслати відгук. Спробуйте ще раз трохи пізніше.'; }
    btn.disabled = false;
  };

  /* ---------- вхід ---------- */
  $('#lgUserLabel').textContent = store.loginLabel;
  $('#lgUser').type = store.mode === 'supabase' ? 'email' : 'text';
  async function openLogin() {
    if (await store.isSignedIn()) return openAdmin();
    $('#loginModal').hidden = false; $('#lgErr').textContent = ''; $('#lgUser').focus();
  }
  $('#loginClose').onclick = () => ($('#loginModal').hidden = true);
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    try { await store.signIn($('#lgUser').value, $('#lgPass').value); $('#loginModal').hidden = true; $('#lgPass').value = ''; openAdmin(); }
    catch (err) { $('#lgErr').textContent = err.message; }
  };
  function openAdmin() {
    $('#admin').hidden = false; document.body.style.overflow = 'hidden';
    renderPosts(); renderPriceEdit(); renderAdminReviews(); $('#aboutEdit').value = state.about; draw();
  }
  $('#logout').onclick = async () => { await store.signOut(); $('#admin').hidden = true; document.body.style.overflow = ''; };
  $$('.tabs button').forEach((b) => (b.onclick = () => {
    $$('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
    $$('.panel').forEach((p) => (p.hidden = p.id !== b.dataset.tab));
  }));

  /* ---------- шаблони ---------- */
  const TPL = { kolo: 'assets/templates/kolo.png', oval: 'assets/templates/oval.png', robota: 'assets/templates/robota.png' };
  const tplImg = {};
  Object.entries(TPL).forEach(([k, s]) => { const i = new Image(); i.onload = () => draw(); i.src = s; tplImg[k] = i; });
  const photos = { A: null, B: null };
  const cv = $('#cv'), ctx = cv.getContext('2d');
  const val = (id) => parseFloat($('#' + id).value);
  const tpl = () => document.querySelector('input[name=tpl]:checked').value;

  function loadFile(input, slot) {
    const f = input.files[0]; if (!f) return;
    const img = new Image(); img.onload = () => { photos[slot] = img; draw(); }; img.src = URL.createObjectURL(f);
  }
  $('#fileA').onchange = (e) => loadFile(e.target, 'A');
  $('#fileB').onchange = (e) => loadFile(e.target, 'B');
  $$('.controls input[type=range], #svc').forEach((i) => (i.oninput = draw));
  $$('input[name=tpl]').forEach((i) => (i.onchange = () => {
    const r = tpl() === 'robota';
    $('#upB').hidden = r; $('#upL').hidden = !r; $('#svcWrap').hidden = r;
    $('#upALabel').textContent = r ? 'Фото роботи' : 'Фото «після»'; draw();
  }));

  function cover(img, x, y, w, h, z, ox, oy) {
    const s = Math.max(w / img.width, h / img.height) * z, dw = img.width * s, dh = img.height * s;
    const dx = x + (w - dw) / 2 + (ox * (dw - w)) / 2, dy = y + (h - dh) / 2 + (oy * (dh - h)) / 2;
    ctx.drawImage(img, dx, dy, dw, dh); return { s };
  }
  function clip(path, fn) { ctx.save(); ctx.beginPath(); path(); ctx.clip(); fn(); ctx.restore(); }
  function draw() {
    const t = tpl(); ctx.clearRect(0, 0, 1080, 1920); ctx.fillStyle = '#E7E1DC'; ctx.fillRect(0, 0, 1080, 1920);
    const A = photos.A, B = photos.B;
    if (t === 'robota') {
      if (A) {
        const m = cover(A, 0, 0, 1080, 1420, val('zA'), -val('xA'), -val('yA'));
        const s = m.s * val('zL'), fx = val('xL') * A.width, fy = val('yL') * A.height;
        clip(() => ctx.arc(279, 1345, 185, 0, Math.PI * 2), () => ctx.drawImage(A, 279 - fx * s, 1345 - fy * s, A.width * s, A.height * s));
      }
    } else {
      if (A) clip(() => ctx.arc(610, 1040, 368, 0, Math.PI * 2), () => cover(A, 242, 672, 736, 736, val('zA'), -val('xA'), -val('yA')));
      if (B) {
        if (t === 'kolo') clip(() => ctx.arc(280, 680, 200, 0, Math.PI * 2), () => cover(B, 80, 480, 400, 400, val('zB'), -val('xB'), -val('yB')));
        else clip(() => ctx.roundRect(70, 480, 580, 320, 160), () => cover(B, 70, 480, 580, 320, val('zB'), -val('xB'), -val('yB')));
      }
    }
    const T = tplImg[t]; if (T && T.complete && T.naturalWidth) ctx.drawImage(T, 0, 0, 1080, 1920);
    if (t !== 'robota' && $('#svc').value) {
      ctx.save(); ctx.font = '600 23px Manrope'; ctx.fillStyle = '#8C9196'; ctx.textAlign = 'center';
      try { ctx.letterSpacing = '8.7px'; } catch (e) {}
      ctx.fillText($('#svc').value.toUpperCase(), 540, 318); ctx.restore();
    }
    const ready = t === 'robota' ? !!A : !!(A && B);
    $('#publish').disabled = $('#download').disabled = !ready;
    $('#pvHint').textContent = ready ? 'Готово. Можна публікувати.' : t === 'robota' ? 'Додайте фото роботи.' : 'Додайте обидва фото: «до» і «після».';
  }
  if (document.fonts) document.fonts.load('600 23px Manrope').then(draw);

  const toJpeg = () => new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85));
  $('#publish').onclick = async () => {
    const btn = $('#publish'); btn.disabled = true;
    try { await store.addPost(tpl() === 'robota' ? 'work' : 'ba', await toJpeg()); state.posts = await store.getPosts(); renderRails(); renderPosts(); toast('Опубліковано на сайті'); }
    catch (e) { toast(e.message || 'Не вдалося опублікувати'); }
    btn.disabled = false;
  };
  $('#download').onclick = () => cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `suptelia-${tpl()}-${Date.now()}.png`; a.click(); toast('Картинку збережено'); }, 'image/png');

  function renderPosts() {
    const l = $('#postsList');
    if (!state.posts.length) { l.innerHTML = '<p class="hint">Поки що немає власних публікацій. Створіть першу у вкладці «Шаблони».</p>'; return; }
    l.innerHTML = state.posts.map((p) => `<figure><img src="${esc(p.src)}" alt=""><figcaption>${p.type === 'ba' ? 'до / після' : 'фото'}<button data-del="${p.id}">Видалити</button></figcaption></figure>`).join('');
    l.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { await store.deletePost(b.dataset.del); state.posts = await store.getPosts(); renderPosts(); renderRails(); toast('Видалено'); }));
  }

  async function renderAdminReviews() {
    const w = $('#adminReviews'); let list = [];
    try { list = await store.getReviews(true); } catch (e) {}
    const pending = list.filter((r) => r.status === 'pending').length;
    $('#rvBadge').textContent = pending ? `(${pending})` : '';
    if (!list.length) { w.innerHTML = '<p class="hint">Відгуків поки немає.</p>'; return; }
    w.innerHTML = list.map((r) => `<div class="arv"><div class="top"><b>${esc(r.name)} · ${stars(r.rating)}</b><span class="st ${r.status}">${r.status === 'approved' ? 'на сайті' : 'чекає перевірки'}</span></div>
      <div>${esc(r.text)}</div><div class="hint">${r.service ? esc(r.service) + ' · ' : ''}${date(r.created_at)}</div>
      <div class="acts">${r.status === 'approved' ? `<button data-st="pending" data-id="${r.id}">Сховати з сайту</button>` : `<button data-st="approved" data-id="${r.id}">Схвалити</button>`}<button data-rm="${r.id}">Видалити</button></div></div>`).join('');
    w.querySelectorAll('[data-st]').forEach((b) => (b.onclick = async () => { await store.setReviewStatus(b.dataset.id, b.dataset.st); renderAdminReviews(); renderReviews(); toast(b.dataset.st === 'approved' ? 'Відгук на сайті' : 'Відгук сховано'); }));
    w.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = async () => { await store.deleteReview(b.dataset.rm); renderAdminReviews(); renderReviews(); toast('Видалено'); }));
  }

  function renderPriceEdit() {
    const w = $('#priceRows'); w.innerHTML = '';
    state.price.forEach(([n, p], i) => {
      const r = document.createElement('div'); r.className = 'pr-row';
      r.innerHTML = `<input aria-label="Послуга" id="pn${i}"><input aria-label="Ціна" id="pp${i}" inputmode="numeric"><button class="rm" aria-label="Видалити">×</button>`;
      r.children[0].value = n; r.children[1].value = p;
      r.children[2].onclick = () => { collectPrice(); state.price.splice(i, 1); renderPriceEdit(); };
      w.appendChild(r);
    });
  }
  function collectPrice() { state.price = [...$('#priceRows').children].map((r) => [r.children[0].value.trim(), parseInt(r.children[1].value) || 0]).filter((r) => r[0]); }
  $('#addPrice').onclick = () => { collectPrice(); state.price.push(['Нова послуга', 0]); renderPriceEdit(); };
  $('#savePrice').onclick = async () => { collectPrice(); try { await store.saveSettings({ price: state.price }); renderPrice(); renderPriceEdit(); toast('Прайс збережено'); } catch (e) { toast(e.message); } };
  $('#saveAbout').onclick = async () => { state.about = $('#aboutEdit').value.trim(); try { await store.saveSettings({ about: state.about }); renderAbout(); toast('Текст збережено'); } catch (e) { toast(e.message); } };
})();
