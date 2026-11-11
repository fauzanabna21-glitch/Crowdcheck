CC.onReady(function () {
  const { $, $$, esc, qs, badge, timeAgo, toast, ICONS, nextUrl } = CC.ui;
  const user = CC.currentUser();
  const COOLDOWN = 10 * 60000; // 1 laporan per lokasi per 10 menit

  /* ---- belum login: tampilkan gerbang ---- */
  if (!user) {
    $('#formCard').innerHTML = `<div class="gate"><div class="ic">${ICONS.lock}</div>
      <h3>Masuk untuk membuat laporan</h3>
      <p class="muted">Akun diperlukan agar laporan dapat dipercaya dan tidak disalahgunakan.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary" href="login.html?next=${nextUrl()}">Masuk</a>
        <a class="btn btn-ghost" href="login.html?tab=register&next=${nextUrl()}">Daftar</a></div></div>`;
    $('#mine').innerHTML = '<p class="muted small">Masuk untuk melihat riwayat laporanmu.</p>';
    return;
  }

  /* ---- form ---- */
  const preset = qs('place');
  const opts = CC.places().sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `<option value="${p.id}" ${p.id === preset ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const levelOpts = [1, 2, 3, 4].map(i => `
    <div class="level-opt"><input type="radio" name="level" id="lv${i}" value="${i}" required>
      <label for="lv${i}" class="l${i}"><span class="meter big m${i}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <b>${CC.LEVELS[i].label}</b><span>${CC.LEVELS[i].desc}</span></label></div>`).join('');
  const tagOpts = CC.TAGS.map((t, i) => `<label><input type="checkbox" name="tag" value="${esc(t)}"><span>${esc(t)}</span></label>`).join('');

  function showForm() {
    $('#formCard').innerHTML = `
    <form id="rf" novalidate>
      <div class="field" id="fPlace"><label for="place">Lokasi</label>
        <select class="select" id="place"><option value="">— Pilih lokasi —</option>${opts}</select>
        <div class="err">Pilih lokasi terlebih dahulu.</div></div>
      <div class="field" id="fLevel"><div class="label" id="lvLabel">Seberapa ramai sekarang?</div>
        <div class="levels" role="radiogroup" aria-labelledby="lvLabel">${levelOpts}</div>
        <div class="err">Pilih tingkat keramaian.</div></div>
      <div class="field"><label for="wait">Perkiraan waktu antre <span class="muted">(opsional)</span></label>
        <select class="select" id="wait"><option value="">Tidak ada antrean / tidak tahu</option>
          <option value="5">± 5 menit</option><option value="10">± 10 menit</option><option value="15">± 15 menit</option>
          <option value="30">± 30 menit</option><option value="45">45 menit atau lebih</option></select></div>
      <div class="field"><div class="label">Kondisi tambahan <span class="muted">(opsional)</span></div><div class="tagpick">${tagOpts}</div></div>
      <div class="field" id="fNote"><label for="note">Catatan <span class="muted">(opsional)</span></label>
        <textarea class="textarea" id="note" maxlength="140" placeholder="Contoh: antrean kasir mengular sampai pintu."></textarea>
        <div class="hint"><span id="cnt">0</span>/140 karakter</div></div>
      <button class="btn btn-primary btn-block" type="submit">Kirim laporan</button>
    </form>`;
    const f = $('#rf');
    $('#note').addEventListener('input', e => { $('#cnt').textContent = e.target.value.length; });
    $('#place').addEventListener('change', () => $('#fPlace').classList.remove('invalid'));
    $$('input[name=level]', f).forEach(i => i.addEventListener('change', () => $('#fLevel').classList.remove('invalid')));
    f.addEventListener('submit', onSubmit);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const placeId = $('#place').value;
    const lv = ($('input[name=level]:checked') || {}).value;
    $('#fPlace').classList.toggle('invalid', !placeId);
    $('#fLevel').classList.toggle('invalid', !lv);
    if (!placeId || !lv) { toast('Lengkapi formulir terlebih dahulu.', 'err'); return; }

    const last = CC.reports(r => r.userId === user.id && r.placeId === placeId)[0];
    if (last && Date.now() - last.ts < COOLDOWN) {
      const left = Math.ceil((COOLDOWN - (Date.now() - last.ts)) / 60000);
      toast(`Kamu baru saja melapor di lokasi ini. Coba lagi ${left} menit lagi.`, 'err'); return;
    }
    const btn = $('#rf button[type=submit]'); btn.disabled = true;
    try {
      await CC.addReport({
        placeId, level: +lv,
        wait: $('#wait').value ? +$('#wait').value : null,
        tags: $$('input[name=tag]:checked').map(i => i.value),
        note: $('#note').value.trim()
      });
    } catch (err) { btn.disabled = false; toast(err.message, 'err'); return; }
    const p = CC.place(placeId);
    toast('Laporan terkirim. Terima kasih!');
    $('#formCard').innerHTML = `<div class="success"><div class="ok">${ICONS.check}</div>
      <h3>Laporan terkirim!</h3>
      <p class="muted">Kondisi <b>${esc(p.name)}</b> kini ditandai <b>${CC.LEVELS[lv].label}</b>.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary" href="dashboard.html">Lihat di dashboard</a>
        <button class="btn btn-ghost" id="again">Buat laporan lain</button></div></div>`;
    $('#again').addEventListener('click', () => { showForm(); });
    renderMine();
  }

  function renderMine() {
    const mine = CC.reports(r => r.userId === user.id);
    $('#mine').innerHTML = mine.length ? mine.slice(0, 8).map(r => {
      const p = CC.place(r.placeId);
      return `<div class="feed-item"><div class="tx"><b>${esc(p ? p.name : '—')}</b> ${badge(r.level)}
        <div class="small muted">${timeAgo(r.ts)}${r.hidden ? ' · disembunyikan admin' : ''}</div>
        ${r.note ? `<p>${esc(r.note)}</p>` : ''}</div></div>`;
    }).join('') : '<p class="muted small">Belum ada laporan. Laporan pertamamu akan muncul di sini.</p>';
  }

  showForm(); renderMine();
});
