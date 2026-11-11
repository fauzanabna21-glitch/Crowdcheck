document.addEventListener('DOMContentLoaded', function () {
  const { $, $$, qs, toast } = CC.ui;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // tujuan setelah login (hanya halaman lokal .html)
  let next = qs('next') || '';
  if (!/^[a-z0-9_-]+\.html(\?[\w=&%.-]*)?$/i.test(next)) next = '';
  const goto = u => { toast('Berhasil! Mengalihkan…'); setTimeout(() => location.href = next || (u.role === 'admin' ? 'admin.html' : 'dashboard.html'), 700); };

  if (CC.currentUser() && !qs('stay')) { /* sudah login */ const u = CC.currentUser(); location.replace(next || 'dashboard.html'); return; }

  /* ---- tab ---- */
  function tab(which) {
    const reg = which === 'register';
    $('#tabLogin').setAttribute('aria-selected', !reg); $('#tabReg').setAttribute('aria-selected', reg);
    $('#panelLogin').hidden = reg; $('#panelReg').hidden = !reg;
  }
  $('#tabLogin').addEventListener('click', () => tab('login'));
  $('#tabReg').addEventListener('click', () => tab('register'));
  tab(qs('tab'));

  /* ---- tampilkan/sembunyikan sandi ---- */
  $$('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const i = $('#' + b.dataset.toggle); const show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.textContent = show ? 'Sembunyikan' : 'Tampilkan';
  }));

  /* ---- akun demo ---- */
  $$('[data-fill]').forEach(b => b.addEventListener('click', () => {
    const [e, p] = b.dataset.fill.split('|'); $('#lEmail').value = e; $('#lPass').value = p;
    $('#lfEmail').classList.remove('invalid'); $('#lfPass').classList.remove('invalid'); $('#lError').style.display = 'none';
  }));

  const mark = (id, bad) => $('#' + id).classList.toggle('invalid', bad);

  /* ---- login ---- */
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const em = $('#lEmail').value, pw = $('#lPass').value;
    mark('lfEmail', !emailRe.test(em.trim())); mark('lfPass', !pw);
    if (!emailRe.test(em.trim()) || !pw) return;
    const r = CC.login(em, pw);
    if (!r.ok) { const el = $('#lError'); el.textContent = r.msg; el.style.display = 'block'; return; }
    goto(r.user);
  });

  /* ---- indikator kekuatan sandi ---- */
  $('#rPass').addEventListener('input', e => {
    const v = e.target.value; let s = 0;
    if (v.length >= 6) s++; if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v) && /[^\w]/.test(v)) s++;
    $('#strength').textContent = v ? 'Kekuatan sandi: ' + ['Lemah', 'Cukup', 'Baik', 'Kuat', 'Sangat kuat'][s] : '';
  });

  /* ---- register ---- */
  $('#regForm').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('#rName').value.trim(), em = $('#rEmail').value.trim(), p1 = $('#rPass').value, p2 = $('#rPass2').value, t = $('#rTerms').checked;
    const bad = { rfName: n.length < 3, rfEmail: !emailRe.test(em), rfPass: p1.length < 6, rfPass2: p1 !== p2 || !p2, rfTerms: !t };
    Object.entries(bad).forEach(([k, v]) => mark(k, v));
    if (Object.values(bad).some(Boolean)) return;
    const r = CC.register(n, em, p1);
    if (!r.ok) { const el = $('#rError'); el.textContent = r.msg; el.style.display = 'block'; return; }
    goto(r.user);
  });
});
