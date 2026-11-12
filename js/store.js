/* ==========================================================
   CrowdChek — Data layer (frontend only)
   Semua data disimpan di localStorage sebagai pengganti backend.
   Pada saat pertama dibuka, data contoh (seed) dibuat otomatis.
   ========================================================== */
(function (global) {
  'use strict';

  const DB_KEY = 'cc_db_v1';
  const SESSION_KEY = 'cc_session_v1';

  const LEVELS = {
    1: { id: 1, label: 'Sepi', desc: 'Lengang, tanpa antrean', color: '#1f9d63' },
    2: { id: 2, label: 'Sedang', desc: 'Cukup ramai, masih nyaman', color: '#d9a400' },
    3: { id: 3, label: 'Ramai', desc: 'Antrean mulai terbentuk', color: '#e8721c' },
    4: { id: 4, label: 'Padat', desc: 'Sangat penuh, sebaiknya dihindari', color: '#d6334a' }
  };
  const CATEGORIES = {
    mall: 'Mal',
    transport: 'Transportasi',
    pasar: 'Pasar',
    wisata: 'Wisata & Taman',
    kuliner: 'Kuliner'
  };
  const TAGS = ['Antrean panjang', 'Parkir penuh', 'Tempat duduk tersedia', 'Kasir cepat', 'Berisik', 'Nyaman'];

  /* ---------- util ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) { // hash sederhana (hanya demo, BUKAN pengganti hashing di server)
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'h' + (h >>> 0).toString(36);
  }
  function pctToLevel(p) { return p < 28 ? 1 : p < 55 ? 2 : p < 78 ? 3 : 4; }
  function makePattern(cat, rand) {
    const peaks = {
      mall: [[13, 2, 55], [19.5, 2.1, 70]],
      transport: [[7.5, 1.3, 90], [17.5, 1.6, 90]],
      pasar: [[7, 2, 85], [16, 1.5, 30]],
      wisata: [[9, 2, 45], [16.5, 2.2, 62]],
      kuliner: [[12.5, 1.2, 85], [19, 1.5, 75]]
    }[cat];
    const scale = 0.82 + rand() * 0.3;
    const out = [];
    for (let h = 0; h < 24; h++) {
      let v = h < 5 ? 2 : 8;
      peaks.forEach(([mu, s, a]) => { v += a * scale * Math.exp(-((h - mu) ** 2) / (2 * s * s)); });
      v += (rand() - 0.5) * 8;
      out.push(Math.max(1, Math.min(100, Math.round(v))));
    }
    return out;
  }

  /* ---------- seed ---------- */
  function seed() {
    const rand = mulberry32(20261110);
    const now = Date.now();
    const MIN = 60000, DAY = 86400000;

    const placeSeed = [
      ['Grand Indonesia', 'mall', 'Jl. M.H. Thamrin No.1, Menteng', 50, 46],
      ['Stasiun Sudirman', 'transport', 'Jl. Jend. Sudirman, Tanah Abang', 38, 58],
      ['Pasar Tanah Abang', 'pasar', 'Jl. Kebon Jati, Tanah Abang', 24, 40],
      ['Monas (Taman Monas)', 'wisata', 'Jl. Medan Merdeka, Gambir', 60, 24],
      ['Blok M Square', 'mall', 'Jl. Melawai, Kebayoran Baru', 33, 82],
      ['Stasiun Manggarai', 'transport', 'Jl. Manggarai Utara, Tebet', 74, 66],
      ['Kota Tua Jakarta', 'wisata', 'Taman Fatahillah, Pinangsia', 52, 9],
      ['Pasar Baru', 'pasar', 'Jl. Pasar Baru, Sawah Besar', 72, 30],
      ['Gelora Bung Karno', 'wisata', 'Jl. Pintu Satu Senayan', 14, 64],
      ['Kuningan City', 'mall', 'Jl. Prof. Dr. Satrio, Setiabudi', 62, 78],
      ['Kawasan Kuliner Sabang', 'kuliner', 'Jl. H. Agus Salim, Menteng', 58, 38],
      ['Taman Menteng', 'wisata', 'Jl. HOS Cokroaminoto, Menteng', 82, 50]
    ];
    const places = placeSeed.map((p, i) => ({
      id: 'p' + (i + 1), name: p[0], category: p[1], address: p[2], x: p[3], y: p[4],
      pattern: makePattern(p[1], rand), createdAt: now - (30 + i) * DAY
    }));

    const users = [
      { id: 'u1', name: 'Admin CrowdChek', email: 'admin@crowdchek.id', pass: hash('admin123'), role: 'admin', active: true, joined: now - 60 * DAY },
      { id: 'u2', name: 'Demo Pengguna', email: 'user@crowdchek.id', pass: hash('user123'), role: 'user', active: true, joined: now - 20 * DAY },
      { id: 'u3', name: 'Rina Pratama', email: 'rina@example.com', pass: hash('rina123'), role: 'user', active: true, joined: now - 14 * DAY },
      { id: 'u4', name: 'Budi Santoso', email: 'budi@example.com', pass: hash('budi123'), role: 'user', active: true, joined: now - 9 * DAY },
      { id: 'u5', name: 'Sari Wulandari', email: 'sari@example.com', pass: hash('sari123'), role: 'user', active: true, joined: now - 6 * DAY },
      { id: 'u6', name: 'Dimas Aditya', email: 'dimas@example.com', pass: hash('dimas123'), role: 'user', active: false, joined: now - 3 * DAY }
    ];

    const notes = {
      1: ['Lengang, bisa langsung masuk.', 'Sepi banget, tempat duduk banyak.', 'Aman, tidak ada antrean.'],
      2: ['Lumayan ramai tapi masih nyaman.', 'Antrean pendek, jalan lancar.', 'Cukup ramai, parkir masih ada.'],
      3: ['Antrean mulai panjang.', 'Ramai, harus sabar sedikit.', 'Banyak orang, parkir hampir penuh.'],
      4: ['Penuh sesak, susah bergerak.', 'Antre panjang sekali, sebaiknya tunda.', 'Sangat padat, parkir penuh.']
    };
    const reporters = users.filter(u => u.active && u.role === 'user');
    const reports = [];
    let rid = 1;
    function mk(place, ts) {
      const hour = new Date(ts).getHours();
      let pct = place.pattern[hour] + (rand() - 0.5) * 22;
      const level = pctToLevel(pct);
      const u = reporters[Math.floor(rand() * reporters.length)];
      const tags = [];
      if (level >= 3 && rand() < 0.6) tags.push(rand() < 0.5 ? 'Antrean panjang' : 'Parkir penuh');
      if (level <= 2 && rand() < 0.5) tags.push(rand() < 0.5 ? 'Tempat duduk tersedia' : 'Nyaman');
      const list = notes[level];
      reports.push({
        id: 'r' + rid++, placeId: place.id, userId: u.id, userName: u.name, level,
        wait: level >= 3 ? [5, 10, 15, 20, 30][Math.floor(rand() * 5)] : null,
        tags, note: rand() < 0.75 ? list[Math.floor(rand() * list.length)] : '', ts, hidden: false
      });
    }
    places.forEach(pl => {
      const recent = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < recent; k++) mk(pl, now - (4 + rand() * 100) * MIN);
      for (let k = 0; k < 9; k++) mk(pl, now - (3 + rand() * 6.8 * 24 * 60) * MIN);
    });
    reports.sort((a, b) => b.ts - a.ts);
    return { users, places, reports, seq: { place: places.length + 1, report: rid, user: users.length + 1 } };
  }

  /* ---------- persistence ---------- */
  let db;
  function load() {
    try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; }
    if (!db || !db.places) { db = seed(); save(); }
  }
  // Baca ulang data terbaru dari penyimpanan (dipakai sebelum menulis agar tidak menimpa perubahan tab lain)
  function reload() {
    try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && d.places && d.reports && d.users) db = d; } catch (e) { /* pakai data di memori */ }
  }
  function save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* storage penuh/diblokir */ }
  }
  /* ---------- sinkron antar tab ----------
     Event 'storage' hanya terkirim ke tab LAIN di browser yang sama. Jadi saat user
     mengirim laporan di satu tab, tab admin langsung menerimanya tanpa refresh. */
  const listeners = [];
  function emit(ev) { listeners.slice().forEach(fn => { try { fn(ev); } catch (e) { if (global.console) console.error(e); } }); }
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
  global.addEventListener('storage', e => {
    if (e.key !== null && e.key !== DB_KEY && e.key !== SESSION_KEY) return;
    const before = new Set(db.reports.map(r => r.id));
    reload();
    db.reports.filter(r => !before.has(r.id)).forEach(r => emit({ type: 'report', action: 'insert', report: r }));
    emit({ type: 'sync' });
  });

  function resetDemo() { db = seed(); save(); logout(); }

  /* ---------- auth ---------- */
  function currentUser() {
    reload();
    let id = null;
    try { id = localStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
    return id ? db.users.find(u => u.id === id && u.active) || null : null;
  }
  function login(email, pass) {
    reload();
    const u = db.users.find(x => x.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!u || u.pass !== hash(pass)) return { ok: false, msg: 'Email atau kata sandi salah.' };
    if (!u.active) return { ok: false, msg: 'Akun Anda dinonaktifkan oleh admin.' };
    try { localStorage.setItem(SESSION_KEY, u.id); } catch (e) { /* ignore */ }
    return { ok: true, user: u };
  }
  function logout() { try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }
  function register(name, email, pass) {
    reload();
    if (db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase()))
      return { ok: false, msg: 'Email sudah terdaftar. Silakan masuk.' };
    const u = { id: 'u' + db.seq.user++, name: name.trim(), email: email.trim(), pass: hash(pass), role: 'user', active: true, joined: Date.now() };
    db.users.push(u); save();
    try { localStorage.setItem(SESSION_KEY, u.id); } catch (e) { /* ignore */ }
    return { ok: true, user: u };
  }

  /* ---------- crowd logic ---------- */
  const WINDOW = 120 * 60000; // laporan dihitung dalam jendela 2 jam terakhir
  function crowd(place) {
    const now = Date.now();
    const rs = db.reports.filter(r => r.placeId === place.id && !r.hidden && now - r.ts <= WINDOW);
    if (rs.length) {
      let sw = 0, s = 0;
      rs.forEach(r => { const w = 1 - 0.7 * ((now - r.ts) / WINDOW); sw += w; s += w * r.level; });
      const score = s / sw;
      return { level: Math.max(1, Math.min(4, Math.round(score))), score, source: 'laporan', count: rs.length, updated: Math.max(...rs.map(r => r.ts)) };
    }
    const p = place.pattern[new Date().getHours()];
    return { level: pctToLevel(p), score: 1 + (p / 100) * 3, source: 'prediksi', count: 0, updated: null };
  }
  function bestWindow(place) {
    let best = 8, min = 1e9;
    for (let h = 8; h <= 20; h++) {
      const v = place.pattern[h] + place.pattern[h + 1];
      if (v < min) { min = v; best = h; }
    }
    return { from: best, to: best + 2 };
  }
  function peakHour(place) {
    let h = 0; place.pattern.forEach((v, i) => { if (v > place.pattern[h]) h = i; });
    return h;
  }

  /* ---------- CRUD ---------- */
  const places = () => db.places.slice();
  const place = id => db.places.find(p => p.id === id);
  const reports = (fn) => db.reports.filter(fn || (() => true)).sort((a, b) => b.ts - a.ts);
  const visibleReports = () => reports(r => !r.hidden);
  const users = () => db.users.slice();

  function addReport(r) {
    reload();
    const rep = Object.assign({ id: 'r' + db.seq.report++, ts: Date.now(), hidden: false }, r);
    db.reports.unshift(rep); save(); return rep;
  }
  function updateReport(id, patch) { reload(); const r = db.reports.find(x => x.id === id); if (r) { Object.assign(r, patch); save(); } }
  function deleteReport(id) { reload(); db.reports = db.reports.filter(r => r.id !== id); save(); }
  function savePlace(data) {
    reload();
    if (data.id) {
      Object.assign(place(data.id), data);
    } else {
      const rand = mulberry32(Date.now() % 100000);
      db.places.push(Object.assign({ id: 'p' + db.seq.place++, pattern: makePattern(data.category, rand), createdAt: Date.now() }, data));
    }
    save();
  }
  function deletePlace(id) {
    reload();
    db.places = db.places.filter(p => p.id !== id);
    db.reports = db.reports.filter(r => r.placeId !== id); save();
  }
  function updateUser(id, patch) { reload(); const u = db.users.find(x => x.id === id); if (u) { Object.assign(u, patch); save(); } }

  load();

  global.CC = global.CC || {};
  Object.assign(global.CC, {
    LEVELS, CATEGORIES, TAGS, pctToLevel,
    currentUser, login, logout, register,
    places, place, reports, visibleReports, users,
    crowd, bestWindow, peakHour,
    addReport, updateReport, deleteReport, savePlace, deletePlace, updateUser, resetDemo, onChange
  });
})(window);
