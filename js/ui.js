/* ==========================================================
   CrowdChek — Komponen UI bersama
   Header, footer, toast, modal, helper format, detail lokasi
   ========================================================== */
(function (global) {
  'use strict';
  const CC = global.CC;

  /* ---------- helpers ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const qs = k => new URLSearchParams(location.search).get(k);
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function timeAgo(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' menit lalu';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' jam lalu';
    return Math.round(h / 24) + ' hari lalu';
  }
  const fmtDate = ts => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const pad = n => String(n).padStart(2, '0');
  const initials = n => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const badge = lv => `<span class="badge lv-${lv}">${CC.LEVELS[lv].label}</span>`;
  const meter = lv => `<span class="meter m${lv}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  const srcText = c => c.source === 'laporan'
    ? `${c.count} laporan · ${timeAgo(c.updated)}`
    : 'Prediksi pola jam ini';

  const ICONS = {
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    lock: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    check: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>'
  };

  /* ---------- header & footer ---------- */
  const NAV = [
    ['index.html', 'Beranda'], ['dashboard.html', 'Dashboard'], ['search.html', 'Cari Lokasi'],
    ['report.html', 'Lapor'], ['stats.html', 'Statistik']
  ];
  function renderHeader() {
    const host = $('#site-header'); if (!host) return;
    const file = location.pathname.split('/').pop() || 'index.html';
    const u = CC.currentUser();
    const links = NAV.concat(u && u.role === 'admin' ? [['admin.html', 'Admin']] : [])
      .map(([h, t]) => `<a href="${h}" ${file === h ? 'class="active" aria-current="page"' : ''}>${t}</a>`).join('');
    const right = u ? `
      <div class="user-menu">
        <button class="avatar" id="userBtn" aria-haspopup="true" aria-expanded="false" aria-label="Menu akun ${esc(u.name)}">${esc(initials(u.name))}</button>
        <div class="dropdown" id="userDrop" role="menu">
          <div class="who"><b>${esc(u.name)}</b><span class="small muted">${esc(u.email)} · ${u.role === 'admin' ? 'Admin' : 'Pengguna'}</span></div>
          <a href="dashboard.html" role="menuitem">Dashboard</a>
          <a href="report.html" role="menuitem">Laporan saya</a>
          ${u.role === 'admin' ? '<a href="admin.html" role="menuitem">Admin panel</a>' : ''}
          <button id="logoutBtn" role="menuitem">Keluar</button>
        </div>
      </div>` : `
      <a class="btn btn-ghost btn-sm btn-hide-sm" href="login.html?tab=register">Daftar</a>
      <a class="btn btn-primary btn-sm" href="login.html">Masuk</a>`;
    host.innerHTML = `
      <header class="site-header"><div class="container nav">
        <a class="logo" href="index.html" aria-label="CrowdChek beranda">
          <span class="logo-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>CrowdChek</a>
        <nav class="nav-links" id="navLinks" aria-label="Navigasi utama">${links}</nav>
        <div class="nav-right">${right}
          <button class="menu-btn" id="menuBtn" aria-label="Buka menu" aria-expanded="false">${ICONS.menu}</button>
        </div>
      </div></header>`;
    $('#menuBtn').addEventListener('click', e => {
      const open = $('#navLinks').classList.toggle('open');
      e.currentTarget.setAttribute('aria-expanded', open);
    });
    if (u) {
      $('#userBtn').addEventListener('click', e => {
        e.stopPropagation();
        const o = $('#userDrop').classList.toggle('open');
        e.currentTarget.setAttribute('aria-expanded', o);
      });
      document.addEventListener('click', () => { const d = $('#userDrop'); if (d) d.classList.remove('open'); });
      $('#logoutBtn').addEventListener('click', () => {
        CC.logout(); toast('Anda telah keluar.');
        setTimeout(() => location.href = 'index.html', 600);
      });
    }
  }
  function renderFooter() {
    const host = $('#site-footer'); if (!host) return;
    host.innerHTML = `
      <footer class="site-footer"><div class="container">
        <div class="foot-grid">
          <div><a class="logo" href="index.html"><span class="logo-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>CrowdChek</a>
            <p class="small" style="max-width:34ch;margin-top:12px">Pantau keramaian lokasi publik secara real-time dari laporan warga.</p></div>
          <div><h4>Fitur</h4><ul><li><a href="dashboard.html">Dashboard</a></li><li><a href="search.html">Cari lokasi</a></li><li><a href="report.html">Laporan keramaian</a></li><li><a href="stats.html">Statistik</a></li></ul></div>
          <div><h4>Akun</h4><ul><li><a href="login.html">Masuk</a></li><li><a href="login.html?tab=register">Daftar</a></li></ul></div>
        </div>
        <div class="copy">© 2026 CrowdChek — Proyek UTS Pemrograman Web B. Data pada situs ini adalah data contoh yang disimpan di browser.</div>
      </div></footer>`;
  }

  /* ---------- toast ---------- */
  function toast(msg, type) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'err' ? 'err' : 'ok'); t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
  }

  /* ---------- modal ---------- */
  function modal(opts) {
    const prev = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
      <div class="modal-head"><h3>${esc(opts.title)}</h3><button class="x" aria-label="Tutup">✕</button></div>
      <div class="modal-body">${opts.body || ''}</div>
      ${opts.actions ? '<div class="modal-foot"></div>' : ''}</div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    const close = () => {
      ov.remove(); document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus();
      if (opts.onClose) opts.onClose();
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    $('.x', ov).addEventListener('click', close);
    if (opts.actions) {
      const foot = $('.modal-foot', ov);
      opts.actions.forEach(a => {
        const b = document.createElement('button');
        b.className = 'btn ' + (a.cls || 'btn-ghost'); b.textContent = a.label; b.type = 'button';
        b.addEventListener('click', () => { if (a.onClick(ov, close) !== false && !a.keep) close(); });
        foot.appendChild(b);
      });
    }
    const first = $('input,select,textarea,.btn-primary', ov) || $('.x', ov);
    setTimeout(() => first && first.focus(), 30);
    return { el: ov, close };
  }
  function confirmBox(title, msg, okLabel) {
    return new Promise(res => {
      let done = false;
      modal({
        title, body: `<p>${esc(msg)}</p>`,
        onClose: () => { if (!done) res(false); },
        actions: [
          { label: 'Batal', onClick: () => { done = true; res(false); } },
          { label: okLabel || 'Ya, lanjutkan', cls: 'btn-danger', onClick: () => { done = true; res(true); } }
        ]
      });
    });
  }

  /* ---------- guards ---------- */
  function nextUrl() { return encodeURIComponent(location.pathname.split('/').pop() + location.search); }

  /* ---------- detail lokasi (dipakai dashboard & pencarian) ---------- */
  function openPlace(id) {
    const p = CC.place(id); if (!p) return;
    const c = CC.crowd(p), L = CC.LEVELS[c.level];
    const hr = new Date().getHours();
    const bw = CC.bestWindow(p);
    const bars = p.pattern.map((v, h) => `<i class="${h === hr ? 'now' : ''}" style="height:${v}%" title="${pad(h)}:00 — ${v}%"></i>`).join('');
    const recent = CC.reports(r => r.placeId === p.id && !r.hidden).slice(0, 3);
    const feed = recent.length ? recent.map(r => `
      <div class="feed-item"><div class="av">${esc(initials(r.userName))}</div>
      <div class="tx"><b>${esc(r.userName)}</b> ${badge(r.level)} <span class="small muted">${timeAgo(r.ts)}</span>
      ${r.note ? `<p>${esc(r.note)}</p>` : ''}</div></div>`).join('')
      : '<p class="muted small">Belum ada laporan. Jadilah yang pertama melapor!</p>';
    modal({
      title: p.name,
      body: `
      <p class="muted small" style="margin-top:-8px">${esc(CC.CATEGORIES[p.category])} · ${esc(p.address)}</p>
      <div class="card flat" style="display:flex;align-items:center;gap:16px;margin-bottom:16px;background:var(--lv${c.level}-t);border-color:transparent">
        <span class="meter big m${c.level}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <div><div style="font-size:1.5rem;font-weight:800;color:var(--lv${c.level}-i);line-height:1.1">${L.label}</div>
        <div class="small" style="color:var(--ink-2)">${L.desc}</div>
        <div class="small muted">${srcText(c)}</div></div>
      </div>
      <div class="label">Pola keramaian per jam</div>
      <div class="hours" aria-label="Grafik keramaian per jam">${bars}</div>
      <div class="hours-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      <p class="small" style="margin:12px 0 18px">💡 Waktu paling nyaman berkunjung: <b>${pad(bw.from)}:00–${pad(bw.to)}:00</b></p>
      <div class="label">Laporan terbaru</div>${feed}`,
      actions: [
        { label: 'Lihat statistik', onClick: () => { location.href = 'stats.html?place=' + p.id; return false; } },
        { label: 'Lapor kondisi', cls: 'btn-primary', onClick: () => { location.href = 'report.html?place=' + p.id; return false; } }
      ]
    });
  }

  global.CC.ui = { esc, $, $$, qs, debounce, timeAgo, fmtDate, pad, initials, badge, meter, srcText, ICONS, toast, modal, confirmBox, nextUrl, openPlace };

  document.addEventListener('DOMContentLoaded', () => { renderHeader(); renderFooter(); });
})(window);
