document.addEventListener('DOMContentLoaded', function () {
  const { $, $$, esc, badge, timeAgo, fmtDate, toast, modal, confirmBox, nextUrl, ICONS, initials } = CC.ui;
  const me = CC.currentUser();
  const root = $('#adminRoot');

  /* ---- guard: hanya admin ---- */
  if (!me || me.role !== 'admin') {
    root.innerHTML = `<div class="card gate" style="max-width:520px;margin:64px auto"><div class="ic">${ICONS.lock}</div>
      <h2>Akses khusus admin</h2>
      <p class="muted">${me ? 'Akunmu tidak memiliki izin admin.' : 'Silakan masuk dengan akun admin.'}</p>
      <a class="btn btn-primary" href="login.html?next=${nextUrl()}">${me ? 'Ganti akun' : 'Masuk sebagai admin'}</a></div>`;
    return;
  }

  let tab = 'overview';
  let repFilter = { place: '', status: 'all' };

  $('#side').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    tab = b.dataset.tab;
    $$('#side button').forEach(x => x.setAttribute('aria-selected', x === b));
    render();
  });

  function render() { ({ overview, places, reports, users })[tab](); }
  const panel = html => { $('#panel').innerHTML = html; };

  /* ================= Ringkasan ================= */
  function overview() {
    const rs = CC.reports(), ps = CC.places(), us = CC.users();
    const day = rs.filter(r => Date.now() - r.ts < 864e5 && !r.hidden).length;
    panel(`
      <h2>Ringkasan</h2>
      <div class="grid g4 kpis" style="margin-bottom:20px">
        <div class="card kpi"><span class="k">Lokasi</span><span class="v">${ps.length}</span></div>
        <div class="card kpi"><span class="k">Total laporan</span><span class="v">${rs.length}</span><span class="s">${day} dalam 24 jam</span></div>
        <div class="card kpi"><span class="k">Pengguna</span><span class="v">${us.length}</span><span class="s">${us.filter(u => !u.active).length} nonaktif</span></div>
        <div class="card kpi"><span class="k">Disembunyikan</span><span class="v">${rs.filter(r => r.hidden).length}</span><span class="s">laporan dimoderasi</span></div>
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h3>Laporan terbaru</h3></div>
          ${rs.slice(0, 5).map(r => `<div class="feed-item"><div class="av">${esc(initials(r.userName))}</div><div class="tx"><b>${esc(r.userName)}</b> · ${esc((CC.place(r.placeId) || {}).name || '—')} ${badge(r.level)}
            <div class="small muted">${timeAgo(r.ts)}</div></div></div>`).join('')}</div>
        <div class="card"><div class="card-head"><h3>Data demo</h3></div>
          <p class="muted">Data tersimpan di browser ini (localStorage), jadi hanya laporan dari browser yang sama yang terlihat. Laporan baru dari tab lain muncul otomatis, tanpa refresh. Atur ulang untuk mengembalikan data contoh awal.</p>
          <button class="btn btn-danger btn-sm" id="resetBtn">Atur ulang data demo</button></div>
      </div>`);
    $('#resetBtn').addEventListener('click', async () => {
      if (await confirmBox('Atur ulang data?', 'Semua perubahan akan dihapus dan Anda akan keluar dari sesi.', 'Ya, atur ulang')) {
        CC.resetDemo(); toast('Data demo dikembalikan.'); setTimeout(() => location.href = 'login.html', 700);
      }
    });
  }

  /* ================= Lokasi ================= */
  function places() {
    const ps = CC.places().sort((a, b) => a.name.localeCompare(b.name));
    panel(`
      <div class="toolbar"><h2 class="grow" style="margin:0">Kelola lokasi</h2><button class="btn btn-primary" id="addPlace">+ Tambah lokasi</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Kategori</th><th>Level kini</th><th>Aksi</th></tr></thead>
        <tbody>${ps.map(p => `<tr><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.address)}</div></td>
          <td>${esc(CC.CATEGORIES[p.category])}</td><td>${badge(CC.crowd(p).level)}</td>
          <td><div class="actions"><button class="btn btn-ghost btn-sm" data-edit="${p.id}">Ubah</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--lv4-i)" data-del="${p.id}">Hapus</button></div></td></tr>`).join('')}</tbody>
      </table></div>`);
    $('#addPlace').addEventListener('click', () => placeForm());
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => placeForm(CC.place(b.dataset.edit))));
    $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const p = CC.place(b.dataset.del);
      if (await confirmBox('Hapus lokasi?', `“${p.name}” beserta seluruh laporannya akan dihapus permanen.`, 'Hapus')) { CC.deletePlace(p.id); toast('Lokasi dihapus.'); render(); }
    }));
  }

  function placeForm(p) {
    const d = p || { name: '', category: 'mall', address: '', x: 50, y: 50 };
    const m = modal({
      title: p ? 'Ubah lokasi' : 'Tambah lokasi',
      body: `<form id="pf" novalidate>
        <div class="field" id="pfName"><label for="pName">Nama lokasi</label><input class="input" id="pName" value="${esc(d.name)}"><div class="err">Nama minimal 3 karakter.</div></div>
        <div class="field"><label for="pCat">Kategori</label><select class="select" id="pCat">
          ${Object.entries(CC.CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === d.category ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field" id="pfAddr"><label for="pAddr">Alamat</label><input class="input" id="pAddr" value="${esc(d.address)}"><div class="err">Alamat wajib diisi.</div></div>
        <div class="label">Posisi di peta</div>
        <div class="mini-map" id="mm">${CC.mapSVG()}<i id="mmDot"></i></div>
        <div class="grid g2" style="gap:12px;margin-top:10px">
          <div><label class="small" for="pX">Horizontal</label><input type="range" id="pX" min="4" max="96" value="${d.x}" style="width:100%"></div>
          <div><label class="small" for="pY">Vertikal</label><input type="range" id="pY" min="6" max="94" value="${d.y}" style="width:100%"></div>
        </div></form>`,
      actions: [
        { label: 'Batal', onClick: () => { } },
        { label: 'Simpan', cls: 'btn-primary', keep: true, onClick: (ov, close) => {
          const name = $('#pName', ov).value.trim(), addr = $('#pAddr', ov).value.trim();
          $('#pfName', ov).classList.toggle('invalid', name.length < 3);
          $('#pfAddr', ov).classList.toggle('invalid', !addr);
          if (name.length < 3 || !addr) return false;
          CC.savePlace({ id: p && p.id, name, category: $('#pCat', ov).value, address: addr, x: +$('#pX', ov).value, y: +$('#pY', ov).value });
          toast(p ? 'Lokasi diperbarui.' : 'Lokasi ditambahkan.'); close(); render();
        } }
      ]
    });
    const dot = $('#mmDot', m.el), x = $('#pX', m.el), y = $('#pY', m.el);
    const upd = () => { dot.style.left = x.value + '%'; dot.style.top = y.value + '%'; };
    x.addEventListener('input', upd); y.addEventListener('input', upd); upd();
  }

  /* ================= Laporan ================= */
  function reports() {
    const ps = CC.places().sort((a, b) => a.name.localeCompare(b.name));
    let rs = CC.reports(r => (!repFilter.place || r.placeId === repFilter.place) &&
      (repFilter.status === 'all' || (repFilter.status === 'hidden' ? r.hidden : !r.hidden)));
    panel(`
      <h2>Moderasi laporan</h2>
      <div class="toolbar">
        <select class="select grow" id="fPlace" aria-label="Filter lokasi"><option value="">Semua lokasi</option>
          ${ps.map(p => `<option value="${p.id}" ${repFilter.place === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select class="select" id="fStatus" style="width:auto" aria-label="Filter status">
          <option value="all">Semua status</option><option value="visible" ${repFilter.status === 'visible' ? 'selected' : ''}>Tampil</option>
          <option value="hidden" ${repFilter.status === 'hidden' ? 'selected' : ''}>Disembunyikan</option></select>
      </div>
      <p class="small muted">${rs.length} laporan</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Lokasi</th><th>Pelapor</th><th>Level</th><th>Catatan</th><th>Waktu</th><th>Aksi</th></tr></thead>
        <tbody>${rs.slice(0, 40).map(r => `<tr style="${r.hidden ? 'opacity:.55' : ''}">
          <td><b>${esc((CC.place(r.placeId) || {}).name || '—')}</b></td><td>${esc(r.userName)}</td><td>${badge(r.level)}</td>
          <td style="max-width:240px">${esc(r.note) || '<span class="muted">—</span>'}</td><td class="small">${timeAgo(r.ts)}</td>
          <td><div class="actions"><button class="btn btn-ghost btn-sm" data-hide="${r.id}">${r.hidden ? 'Tampilkan' : 'Sembunyikan'}</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--lv4-i)" data-rdel="${r.id}">Hapus</button></div></td></tr>`).join('') ||
          '<tr><td colspan="6" class="muted" style="text-align:center;padding:32px">Tidak ada laporan.</td></tr>'}</tbody>
      </table></div>
      ${rs.length > 40 ? '<p class="small muted" style="margin-top:10px">Menampilkan 40 laporan terbaru. Gunakan filter untuk menyaring.</p>' : ''}`);
    $('#fPlace').addEventListener('change', e => { repFilter.place = e.target.value; reports(); });
    $('#fStatus').addEventListener('change', e => { repFilter.status = e.target.value; reports(); });
    $$('[data-hide]').forEach(b => b.addEventListener('click', () => {
      const r = CC.reports(x => x.id === b.dataset.hide)[0];
      CC.updateReport(r.id, { hidden: !r.hidden }); toast(r.hidden ? 'Laporan ditampilkan.' : 'Laporan disembunyikan.'); reports();
    }));
    $$('[data-rdel]').forEach(b => b.addEventListener('click', async () => {
      if (await confirmBox('Hapus laporan?', 'Laporan akan dihapus permanen.', 'Hapus')) { CC.deleteReport(b.dataset.rdel); toast('Laporan dihapus.'); reports(); }
    }));
  }

  /* ================= Pengguna ================= */
  function users() {
    const us = CC.users();
    panel(`
      <h2>Pengguna</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Peran</th><th>Bergabung</th><th>Laporan</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${us.map(u => {
          const self = u.id === me.id;
          return `<tr><td><b>${esc(u.name)}</b>${self ? ' <span class="badge neutral">Anda</span>' : ''}<div class="small muted">${esc(u.email)}</div></td>
          <td><select class="select" style="width:auto;padding:6px 10px" data-role="${u.id}" ${self ? 'disabled' : ''} aria-label="Peran ${esc(u.name)}">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>Pengguna</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></td>
          <td class="small">${fmtDate(u.joined)}</td><td>${CC.reports(r => r.userId === u.id).length}</td>
          <td>${u.active ? '<span class="badge lv-1">Aktif</span>' : '<span class="badge lv-4">Nonaktif</span>'}</td>
          <td><button class="btn btn-ghost btn-sm" data-act="${u.id}" ${self ? 'disabled' : ''}>${u.active ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>`;
        }).join('')}</tbody>
      </table></div>`);
    $$('[data-role]').forEach(s => s.addEventListener('change', () => { CC.updateUser(s.dataset.role, { role: s.value }); toast('Peran diperbarui.'); }));
    $$('[data-act]').forEach(b => b.addEventListener('click', () => {
      const u = CC.users().find(x => x.id === b.dataset.act);
      CC.updateUser(u.id, { active: !u.active }); toast(u.active ? 'Pengguna dinonaktifkan.' : 'Pengguna diaktifkan.'); users();
    }));
  }

  /* ---- laporan baru / perubahan dari tab lain langsung tampil ---- */
  let timer = null;
  CC.onChange(ev => {
    if (ev.type === 'report' && ev.action === 'insert') {
      const r = ev.report;
      toast('Laporan baru: ' + r.userName + ' di ' + ((CC.place(r.placeId) || {}).name || '—') + ' (' + CC.LEVELS[r.level].label + ')');
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if ($('.overlay')) return;                                   // jangan ganggu form/dialog yang terbuka
      const ae = document.activeElement;
      if (ae && ae.tagName === 'SELECT' && ae.closest('#panel')) return; // jangan tutup dropdown yang sedang dipakai
      render();
    }, 250);
  });

  render();
});
