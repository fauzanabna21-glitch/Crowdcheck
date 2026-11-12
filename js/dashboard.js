document.addEventListener('DOMContentLoaded', function () {
  const { $, esc, badge, meter, srcText, timeAgo, initials, openPlace } = CC.ui;
  let cat = 'all';
  let selected = null;

  const user = CC.currentUser();
  $('#hello').textContent = user ? 'Halo, ' + user.name.split(' ')[0] + ' 👋' : 'Halo, Pengunjung 👋';
  $('#today').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  $('#map').innerHTML = CC.mapSVG();

  // chips kategori
  const cats = [['all', 'Semua']].concat(Object.entries(CC.CATEGORIES));
  $('#catChips').innerHTML = cats.map(([k, v]) => `<button class="chip" data-cat="${k}" aria-pressed="${k === cat}">${v}</button>`).join('');
  $('#catChips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    cat = b.dataset.cat;
    CC.ui.$$('.chip', $('#catChips')).forEach(c => c.setAttribute('aria-pressed', c === b));
    renderMap();
  });

  function data() { return CC.places().map(p => ({ p, c: CC.crowd(p) })); }

  function renderKpis(all) {
    const day = CC.visibleReports().filter(r => Date.now() - r.ts < 864e5).length;
    const sorted = all.slice().sort((a, b) => b.c.score - a.c.score);
    const busy = sorted[0], quiet = sorted[sorted.length - 1];
    const crowded = all.filter(x => x.c.level >= 3).length;
    $('#kpis').innerHTML = `
      <div class="card kpi"><span class="k">Lokasi dipantau</span><span class="v">${all.length}</span><span class="s">${crowded} lokasi ramai/padat</span></div>
      <div class="card kpi"><span class="k">Laporan 24 jam</span><span class="v">${day}</span><span class="s">dari ${CC.users().filter(u => u.active).length} pengguna aktif</span></div>
      <div class="card kpi"><span class="k">Terpadat</span><span class="v" style="font-size:1.2rem;padding:.4em 0">${esc(busy.p.name)}</span><span class="s">${badge(busy.c.level)}</span></div>
      <div class="card kpi"><span class="k">Tersepi</span><span class="v" style="font-size:1.2rem;padding:.4em 0">${esc(quiet.p.name)}</span><span class="s">${badge(quiet.c.level)}</span></div>`;
  }

  function renderMap() {
    const map = $('#map');
    CC.ui.$$('.pin', map).forEach(n => n.remove());
    data().filter(x => cat === 'all' || x.p.category === cat).forEach(({ p, c }) => {
      const b = document.createElement('button');
      b.className = 'pin p' + c.level + (selected === p.id ? ' sel' : '');
      b.style.left = p.x + '%'; b.style.top = p.y + '%';
      b.setAttribute('aria-label', `${p.name}: ${CC.LEVELS[c.level].label}`);
      b.innerHTML = `${c.level}<span class="tip">${esc(p.name)} · ${CC.LEVELS[c.level].label}</span>`;
      b.addEventListener('click', () => { selected = p.id; renderMap(); openPlace(p.id); });
      map.appendChild(b);
    });
  }

  function listHtml(arr) {
    return arr.map(({ p, c }, i) => `
      <li><button class="row" data-id="${p.id}"><span class="rank">${i + 1}</span>
        <span class="grow"><b>${esc(p.name)}</b><span>${srcText(c)}</span></span>${badge(c.level)}</button></li>`).join('');
  }
  function renderLists(all) {
    const sorted = all.slice().sort((a, b) => b.c.score - a.c.score);
    $('#topList').innerHTML = listHtml(sorted.slice(0, 5));
    $('#quietList').innerHTML = listHtml(sorted.slice(-3).reverse());
  }
  document.addEventListener('click', e => {
    const r = e.target.closest('button.row[data-id]'); if (r) openPlace(r.dataset.id);
  });

  function renderFeed() {
    const rs = CC.visibleReports().slice(0, 6);
    $('#feed').innerHTML = rs.map(r => {
      const p = CC.place(r.placeId);
      return `<div class="feed-item"><div class="av">${esc(initials(r.userName))}</div>
        <div class="tx"><b>${esc(r.userName)}</b> di <b>${esc(p ? p.name : '—')}</b> ${badge(r.level)}
        <span class="small muted">· ${timeAgo(r.ts)}</span>
        ${r.note ? `<p>${esc(r.note)}</p>` : ''}${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>`;
    }).join('') || '<p class="muted">Belum ada laporan.</p>';
  }

  function renderCatBars(all) {
    $('#catBars').innerHTML = Object.entries(CC.CATEGORIES).map(([k, label]) => {
      const xs = all.filter(x => x.p.category === k);
      if (!xs.length) return '';
      const avg = xs.reduce((s, x) => s + x.c.score, 0) / xs.length;
      const lv = Math.max(1, Math.min(4, Math.round(avg)));
      return `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;font-weight:600;font-size:.92rem;margin-bottom:6px">
        <span>${label} <span class="muted small">(${xs.length} lokasi)</span></span>${badge(lv)}</div>
        <div style="height:10px;background:var(--line-2);border-radius:99px;overflow:hidden">
        <div style="width:${((avg - 1) / 3 * 100).toFixed(0)}%;min-width:6%;height:100%;background:var(--lv${lv});border-radius:99px"></div></div></div>`;
    }).join('');
  }

  function render() {
    const all = data();
    renderKpis(all); renderMap(); renderLists(all); renderFeed(); renderCatBars(all);
  }
  render();
  setInterval(render, 30000); // segarkan tiap 30 detik
  let t = null;
  CC.onChange(() => { clearTimeout(t); t = setTimeout(render, 250); }); // laporan baru dari tab lain
});
