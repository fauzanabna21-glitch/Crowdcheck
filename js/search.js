document.addEventListener('DOMContentLoaded', function () {
  const { $, $$, esc, qs, debounce, badge, meter, srcText, ICONS, openPlace } = CC.ui;
  const state = { q: qs('q') || '', cat: 'all', lv: 0, sort: 'busy' };

  $('#sIcon').innerHTML = ICONS.search;
  $('#q').value = state.q;

  const cats = [['all', 'Semua']].concat(Object.entries(CC.CATEGORIES));
  $('#catChips').innerHTML = cats.map(([k, v]) => `<button class="chip" data-cat="${k}" aria-pressed="${k === 'all'}">${v}</button>`).join('');
  const lvs = [[0, 'Semua level']].concat([1, 2, 3, 4].map(i => [i, CC.LEVELS[i].label]));
  $('#lvChips').innerHTML = lvs.map(([k, v]) => `<button class="chip" data-lv="${k}" aria-pressed="${k === 0}">${v}</button>`).join('');

  function bindChips(root, attr, key) {
    root.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      state[key] = key === 'lv' ? +b.dataset[attr] : b.dataset[attr];
      $$('.chip', root).forEach(c => c.setAttribute('aria-pressed', c === b));
      render();
    });
  }
  bindChips($('#catChips'), 'cat', 'cat');
  bindChips($('#lvChips'), 'lv', 'lv');
  $('#q').addEventListener('input', debounce(e => { state.q = e.target.value; render(); }, 180));
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  $('#resetBtn').addEventListener('click', () => {
    state.q = ''; state.cat = 'all'; state.lv = 0; $('#q').value = '';
    $$('#catChips .chip').forEach((c, i) => c.setAttribute('aria-pressed', i === 0));
    $$('#lvChips .chip').forEach((c, i) => c.setAttribute('aria-pressed', i === 0));
    render();
  });

  function render() {
    const term = state.q.trim().toLowerCase();
    let rows = CC.places().map(p => ({ p, c: CC.crowd(p) })).filter(({ p, c }) =>
      (state.cat === 'all' || p.category === state.cat) &&
      (!state.lv || c.level === state.lv) &&
      (!term || (p.name + ' ' + p.address + ' ' + CC.CATEGORIES[p.category]).toLowerCase().includes(term)));
    rows.sort((a, b) => state.sort === 'name' ? a.p.name.localeCompare(b.p.name)
      : state.sort === 'quiet' ? a.c.score - b.c.score : b.c.score - a.c.score);

    $('#count').textContent = rows.length + ' lokasi ditemukan';
    $('#empty').hidden = rows.length > 0;
    const hl = t => {
      if (!term) return esc(t);
      const i = t.toLowerCase().indexOf(term);
      return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark style="background:#ffe58a;border-radius:3px">' + esc(t.slice(i, i + term.length)) + '</mark>' + esc(t.slice(i + term.length));
    };
    $('#results').innerHTML = rows.map(({ p, c }) => `
      <button class="card place-card" data-id="${p.id}" aria-label="${esc(p.name)}, ${CC.LEVELS[c.level].label}. Buka detail">
        <div class="top"><div><h3>${hl(p.name)}</h3><div class="addr">${hl(p.address)}</div></div>${meter(c.level)}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(c.level)}<span class="badge neutral">${esc(CC.CATEGORIES[p.category])}</span></div>
        <div class="foot"><span>${srcText(c)}</span><span style="color:var(--brand);font-weight:700">Detail →</span></div>
      </button>`).join('');
  }
  $('#results').addEventListener('click', e => {
    const b = e.target.closest('.place-card'); if (b) openPlace(b.dataset.id);
  });
  render();
});
