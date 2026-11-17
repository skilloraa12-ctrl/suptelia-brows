// Міні-бот: відповідає на типові питання за ключовими словами. Ціни бере з актуального прайсу.
(function () {
  const C = window.SITE_CONFIG;
  const price = () => (window.SITE_STATE && window.SITE_STATE.price) || [];
  const priceOf = (re) => price().find(([n]) => re.test(n.toLowerCase()));
  const fmt = (p) => p ? `${p[0]} — ${p[1]} грн` : '';
  const BOOK = `Записатися можна в Direct: <a href="https://ig.me/m/${C.instagram}" target="_blank" rel="noopener">@${C.instagram}</a> або за телефоном ${C.phone}.`;
  const INDIVIDUAL = 'Склад і відтінок підбираються для кожної клієнтки індивідуально, після консультації з майстром.';

  const A = {
    price: () => 'Ось актуальний прайс:\n' + price().map(fmt).join('\n') + '\n\n' + BOOK,
    brands: () => 'Працюю на професійних матеріалах:\n• Ламінування: склади ZOLA. Залежно від лінійки в них є доглядові компоненти, наприклад кератин, пантенол, протеїни.\n• Фарбування: фарби ZOLA і Sculptor, відтінок змішую під ваш колір волосся і тон шкіри.\n\n' + INDIVIDUAL,
    lamination: () => { const p = priceOf(/ламін/); return `Ламінування робимо на складах ZOLA: волоски укладаються в потрібному напрямку і тримають форму.${p ? '\n' + fmt(p) : ''}\n\n${INDIVIDUAL}`; },
    tint: () => { const p = priceOf(/фарб/); return `Фарбування роблю фарбами ZOLA і Sculptor, відтінок підбираю під ваш колір волосся і тон шкіри.${p ? '\n' + fmt(p) : ''}\n\n${INDIVIDUAL}`; },
    correction: () => { const p = priceOf(/^корекц/); return `Корекція: прибираю зайве і будую форму під риси вашого обличчя.${p ? '\n' + fmt(p) : ''}`; },
    book: () => BOOK,
    address: () => `Адреса: ${C.address}. Карта і відео, як дійти, є на сайті в розділі «Карта».`,
    contacts: () => `Телефон: ${C.phone}\nInstagram: @${C.instagram}\nПошта: ${C.email}`,
    hello: () => 'Привіт! Я помічник suptelia.brows. Можу підказати ціни, розповісти про бренди і як записатися.',
    fallback: () => 'На це питання краще відповість майстер особисто. ' + BOOK,
  };
  const RULES = [
    [/(бренд|матеріал|zola|зола|sculptor|скульптор|склад|чим (ви )?працю|косметик)/, 'brands'],
    [/(ламін)/, 'lamination'],
    [/(фарб|колір|відтін|хна)/, 'tint'],
    [/(корекц|форм)/, 'correction'],
    [/(ціна|ціни|прайс|скільки|коштує|вартість|грн|price)/, 'price'],
    [/(запис|вільн|віконц|час|direct|директ)/, 'book'],
    [/(адрес|де ви|де знаход|як дійти|карта|кабінет|поверх)/, 'address'],
    [/(телефон|номер|пошт|email|контакт|інстаграм|instagram)/, 'contacts'],
    [/^(привіт|вітаю|добр|hello|hi)/, 'hello'],
  ];
  const CHIPS = [['Скільки коштує?', 'price'], ['Які бренди?', 'brands'], ['Ламінування', 'lamination'], ['Фарбування', 'tint'], ['Як записатися?', 'book'], ['Де ви знаходитесь?', 'address']];

  const $ = (s) => document.querySelector(s);
  const log = $('#botLog');
  function say(html, who) {
    const d = document.createElement('div'); d.className = 'msg ' + who;
    if (who === 'u') d.textContent = html; else d.innerHTML = html;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  function answer(key) { setTimeout(() => say(A[key](), 'b'), 250); }
  function ask(text) {
    const t = text.toLowerCase().trim(); if (!t) return;
    say(text, 'u');
    const hit = RULES.find(([re]) => re.test(t));
    answer(hit ? hit[1] : 'fallback');
  }

  $('#botChips').innerHTML = CHIPS.map(([l, k]) => `<button type="button" data-k="${k}">${l}</button>`).join('');
  $('#botChips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; say(b.textContent, 'u'); answer(b.dataset.k); });
  $('#botForm').addEventListener('submit', (e) => { e.preventDefault(); ask($('#botInput').value); $('#botInput').value = ''; });

  let started = false;
  function toggle(open) {
    $('#bot').hidden = !open; $('#botBtn').setAttribute('aria-expanded', open);
    if (open && !started) { started = true; say(A.hello(), 'b'); }
    if (open) $('#botInput').focus();
  }
  $('#botBtn').addEventListener('click', () => toggle($('#bot').hidden));
  $('#botClose').addEventListener('click', () => toggle(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
})();
