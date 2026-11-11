/* ==========================================================
   CrowdChek — Data layer (Supabase)
   Data (lokasi, laporan, pengguna) disimpan di database Supabase,
   sehingga laporan dari semua pengguna terlihat oleh admin.
   Hak akses dijaga di sisi server (Row Level Security), lihat
   supabase/schema.sql. Kunci di js/config.js adalah kunci publik.

   API tetap sinkron untuk pembacaan (data dimuat ke memori saat
   halaman dibuka lewat CC.onReady); penulisan memakai Promise.
   ========================================================== */
(function (global) {
  'use strict';

  const CFG = global.CC_CONFIG || {};
  const BASE = String(CFG.SUPABASE_URL || '').replace(/\/+$/, '');
  const KEY = String(CFG.SUPABASE_ANON_KEY || '');
  const CONFIGURED = /^https:\/\/[^\s]+$/.test(BASE) && KEY.length > 20;
  const SESSION_KEY = 'cc_sb_session_v1';

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


  /* ---------- state ---------- */
  const db = { places: [], reports: [], users: [], activeUsers: 0 };
  let session = null;      // { access_token, refresh_token, expires_at, user_id }
  let me = null;           // profil pengguna yang sedang login (aktif)
  let lastProfile = null;  // profil terakhir yang dibaca (untuk pesan "dinonaktifkan")

  /* ---------- pemetaan baris database → objek aplikasi ---------- */
  // Realtime mengirim timestamp dengan presisi mikrodetik / format Postgres; rapikan agar aman di semua browser
  function parseTs(v) {
    if (typeof v === 'number') return v;
    const t = Date.parse(String(v).replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1').replace(/([+-]\d\d)$/, '$1:00'));
    return isNaN(t) ? Date.now() : t;
  }
  function toTags(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v[0] === '{') return v.slice(1, -1).split(',').map(x => x.replace(/^"|"$/g, '')).filter(Boolean);
    return [];
  }
  const truthy = v => v === true || v === 't' || v === 'true';
  const mapPlace = r => ({ id: r.id, name: r.name, category: r.category, address: r.address, x: r.x, y: r.y, pattern: r.pattern, createdAt: parseTs(r.created_at) });
  const mapReport = r => ({ id: r.id, placeId: r.place_id, userId: r.user_id, userName: r.user_name, level: Number(r.level), wait: r.wait_min == null ? null : Number(r.wait_min), tags: toTags(r.tags), note: r.note || '', ts: parseTs(r.ts), hidden: truthy(r.hidden) });
  const mapUser = r => ({ id: r.id, name: r.name, email: r.email, role: r.role, active: r.active, joined: parseTs(r.created_at) });

  /* ---------- HTTP ---------- */
  function errText(d) {
    if (!d) return '';
    if (typeof d === 'string') return d;
    return d.error_description || d.msg || d.message || (typeof d.error === 'string' ? d.error : '') || '';
  }
  async function http(path, opt) {
    opt = opt || {};
    const headers = Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, opt.headers || {});
    if (opt.token) headers.Authorization = 'Bearer ' + opt.token;
    let res;
    try {
      res = await fetch(BASE + path, { method: opt.method || 'GET', headers, body: opt.body === undefined ? undefined : JSON.stringify(opt.body) });
    } catch (e) { const err = new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.'); err.network = true; throw err; }
    const text = await res.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (!res.ok) { const err = new Error(errText(data) || ('HTTP ' + res.status)); err.status = res.status; err.data = data; throw err; }
    return data;
  }

  /* ---------- sesi ---------- */
  function saveSession(s) {
    session = s;
    try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }
  function loadSession() { try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { session = null; } }
  function sessionFrom(d) {
    saveSession({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600)), user_id: d.user && d.user.id });
  }
  async function token() {
    if (!session) return null;
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    try {
      const d = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
      sessionFrom(d); return session.access_token;
    } catch (e) { if (!e.network) { saveSession(null); me = null; } return null; }
  }
  async function api(path, opt) {
    opt = Object.assign({}, opt); const t = await token(); if (t) opt.token = t;
    return http(path, opt);
  }
  // ubah/hapus data: gagal jika tidak ada baris yang berubah (mis. tidak punya izin)
  async function mutate(method, path, body) {
    const rows = await api(path, { method, body, headers: { Prefer: 'return=representation' } });
    if (!rows || !rows.length) { const err = new Error('Tidak diizinkan atau data tidak ditemukan.'); err.status = 403; throw err; }
    return rows;
  }

  /* ---------- pesan error yang ramah ---------- */
  function authMsg(e) {
    const m = String(e && e.message || '').toLowerCase();
    if (e && e.network) return e.message;
    if (m.includes('invalid login')) return 'Email atau kata sandi salah.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Email sudah terdaftar. Silakan masuk.';
    if (m.includes('not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masuk emailmu.';
    if (m.includes('rate limit') || e.status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.';
    if (m.includes('password')) return 'Kata sandi terlalu lemah atau tidak valid (minimal 6 karakter).';
    if (m.includes('valid email') || m.includes('invalid email')) return 'Format email tidak valid.';
    return 'Terjadi kesalahan: ' + (e && e.message || 'tidak diketahui');
  }
  function dbMsg(e) {
    const m = String(e && e.message || '');
    const c = m.match(/COOLDOWN:(\d+)/);
    if (c) return 'Kamu baru saja melapor di lokasi ini. Coba lagi ' + c[1] + ' menit lagi.';
    if (m.includes('NOT_ALLOWED') || e.status === 401 || e.status === 403) return 'Sesi berakhir atau tidak punya izin. Silakan masuk lagi.';
    if (e && e.network) return e.message;
    return 'Gagal menyimpan: ' + m;
  }

  /* ---------- notifikasi ---------- */
  function notify(msg, type) {
    if (global.CC.ui && global.CC.ui.toast) global.CC.ui.toast(msg, type || 'err');
    else if (global.console) console.error(msg);
  }
  function banner(msg) {
    const put = () => {
      if (document.getElementById('cc-banner')) return;
      const d = document.createElement('div'); d.id = 'cc-banner';
      d.setAttribute('role', 'alert');
      d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#d6334a;color:#fff;padding:12px 16px;font:600 14px/1.4 system-ui,sans-serif;text-align:center';
      d.textContent = msg; document.body.appendChild(d);
    };
    if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
  }

  /* ---------- memuat data ---------- */
  async function loadMe() {
    me = null; lastProfile = null;
    if (!session) return;
    const rows = await api('/rest/v1/profiles?id=eq.' + encodeURIComponent(session.user_id) + '&select=*');
    if (rows && rows[0]) { lastProfile = mapUser(rows[0]); if (lastProfile.active) me = lastProfile; }
  }
  async function loadAll() {
    const [ps, rs] = await Promise.all([
      api('/rest/v1/places?select=*&order=created_at.asc'),
      api('/rest/v1/reports?select=*&order=ts.desc&limit=1000')
    ]);
    db.places = ps.map(mapPlace);
    db.reports = rs.map(mapReport);
    if (me && me.role === 'admin') {
      db.users = (await api('/rest/v1/profiles?select=*&order=created_at.asc')).map(mapUser);
    } else db.users = me ? [me] : [];
    try {
      const n = await api('/rest/v1/rpc/active_user_count', { method: 'POST', body: {} });
      db.activeUsers = Number(n) || 0;
    } catch (e) { db.activeUsers = db.users.filter(u => u.active).length; }
  }
  async function refresh() {
    if (!CONFIGURED) return;
    try { if (session) await loadMe(); await loadAll(); } catch (e) { /* biarkan data lama */ }
  }
  async function init() {
    if (!CONFIGURED) {
      banner('Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di js/config.js.');
      return;
    }
    loadSession();
    try {
      if (session) { await token(); if (session) await loadMe(); }
    } catch (e) { /* tetap lanjut sebagai pengunjung */ }
    try { await loadAll(); }
    catch (e) { banner('Gagal memuat data dari server: ' + (e.message || 'tidak diketahui')); }
  }
  const ready = init();
  function onReady(fn) {
    const run = () => ready.then(fn);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  }

  /* ---------- auth ---------- */
  const currentUser = () => me;
  async function login(email, pass) {
    if (!CONFIGURED) return { ok: false, msg: 'Server belum dikonfigurasi.' };
    try {
      const d = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: String(email).trim(), password: pass } });
      sessionFrom(d);
      await loadMe();
      if (!me) {
        const off = lastProfile && !lastProfile.active;
        const t = session.access_token; saveSession(null);
        http('/auth/v1/logout', { method: 'POST', token: t }).catch(() => { });
        return { ok: false, msg: off ? 'Akun Anda dinonaktifkan oleh admin.' : 'Profil akun tidak ditemukan.' };
      }
      await loadAll();
      reconnectLive();
      return { ok: true, user: me };
    } catch (e) { return { ok: false, msg: authMsg(e) }; }
  }
  async function register(name, email, pass) {
    if (!CONFIGURED) return { ok: false, msg: 'Server belum dikonfigurasi.' };
    try {
      const d = await http('/auth/v1/signup', { method: 'POST', body: { email: String(email).trim(), password: pass, data: { name: String(name).trim() } } });
      if (!d || !d.access_token) return { ok: false, needConfirm: true, msg: 'Pendaftaran berhasil. Cek emailmu untuk konfirmasi, lalu masuk.' };
      sessionFrom(d);
      await loadMe(); await loadAll();
      reconnectLive();
      return me ? { ok: true, user: me } : { ok: false, msg: 'Profil akun belum terbentuk. Coba masuk kembali.' };
    } catch (e) { return { ok: false, msg: authMsg(e) }; }
  }
  function logout() {
    const t = session && session.access_token;
    saveSession(null); me = null; reconnectLive();
    if (t) http('/auth/v1/logout', { method: 'POST', token: t }).catch(() => { });
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
  const activeUserCount = () => db.activeUsers;

  // Kirim laporan baru. Mengembalikan Promise; ditolak jika server menolak (mis. batas 10 menit).
  async function addReport(r) {
    if (!me) throw new Error('Silakan masuk terlebih dahulu.');
    try {
      const rows = await api('/rest/v1/reports', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: { place_id: r.placeId, user_id: me.id, level: r.level, wait_min: r.wait == null ? null : r.wait, tags: r.tags || [], note: r.note || '' }
      });
      const rep = mapReport(rows[0]); db.reports.unshift(rep); return rep;
    } catch (e) { throw new Error(dbMsg(e)); }
  }

  // Perubahan oleh admin: cache diperbarui langsung (agar UI responsif),
  // lalu dikirim ke server; jika gagal, data dimuat ulang dan admin diberi tahu.
  function sync(promise) {
    return promise.catch(async e => { notify(dbMsg(e)); await refresh(); throw e; });
  }
  function updateReport(id, patch) {
    const r = db.reports.find(x => x.id === id); if (!r) return Promise.resolve();
    Object.assign(r, patch);
    const body = {}; if ('hidden' in patch) body.hidden = !!patch.hidden;
    return sync(mutate('PATCH', '/rest/v1/reports?id=eq.' + encodeURIComponent(id), body)).catch(() => { });
  }
  function deleteReport(id) {
    db.reports = db.reports.filter(r => r.id !== id);
    return sync(mutate('DELETE', '/rest/v1/reports?id=eq.' + encodeURIComponent(id))).catch(() => { });
  }
  async function savePlace(data) {
    const f = { name: data.name, category: data.category, address: data.address, x: data.x, y: data.y };
    try {
      if (data.id) {
        const rows = await mutate('PATCH', '/rest/v1/places?id=eq.' + encodeURIComponent(data.id), f);
        const p = place(data.id); if (p) Object.assign(p, mapPlace(rows[0]));
      } else {
        const rand = mulberry32(Date.now() % 100000);
        const rows = await mutate('POST', '/rest/v1/places', Object.assign({ pattern: makePattern(data.category, rand) }, f));
        db.places.push(mapPlace(rows[0]));
      }
    } catch (e) { throw new Error(dbMsg(e)); }
  }
  function deletePlace(id) {
    db.places = db.places.filter(p => p.id !== id);
    db.reports = db.reports.filter(r => r.placeId !== id);
    return sync(mutate('DELETE', '/rest/v1/places?id=eq.' + encodeURIComponent(id))).catch(() => { });
  }
  function updateUser(id, patch) {
    const u = db.users.find(x => x.id === id); if (!u) return Promise.resolve();
    Object.assign(u, patch);
    const body = {}; if ('role' in patch) body.role = patch.role; if ('active' in patch) body.active = !!patch.active;
    return sync(mutate('PATCH', '/rest/v1/profiles?id=eq.' + encodeURIComponent(id), body)).catch(() => { });
  }

  /* ---------- realtime (Supabase Realtime lewat WebSocket) ----------
     Laporan baru/ubah/hapus langsung masuk ke cache tanpa refresh halaman.
     Hak akses tetap mengikuti RLS: pengunjung hanya menerima laporan yang
     tampil, admin menerima semuanya. Aktif hanya jika halaman memanggil
     CC.onChange(fn). Jika koneksi putus, otomatis menyambung ulang dan
     memuat data terbaru; polling berkala menjadi cadangan. */
  const listeners = [];
  const live = { ws: null, status: 'off', ref: 0, hb: null, retry: 0, retryTimer: null, lastToken: null, started: false, tick: 0 };
  const LIVE_TOPIC = 'realtime:cc-live';

  function emit(ev) { listeners.slice().forEach(fn => { try { fn(ev); } catch (e) { if (global.console) console.error(e); } }); }
  function setStatus(st) { if (live.status !== st) { live.status = st; emit({ type: 'status', status: st }); } }
  function liveSend(topic, event, payload) {
    if (live.ws && live.ws.readyState === 1) live.ws.send(JSON.stringify({ topic, event, payload, ref: String(++live.ref) }));
  }
  function liveClose() {
    clearInterval(live.hb); live.hb = null;
    clearTimeout(live.retryTimer); live.retryTimer = null;
    const ws = live.ws; live.ws = null;
    if (ws) { ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(); } catch (e) { /* ignore */ } }
  }
  function liveRetry() {
    if (live.retryTimer) return;
    const wait = Math.min(30000, 1000 * Math.pow(2, live.retry++));
    live.retryTimer = setTimeout(() => { live.retryTimer = null; liveConnect(); }, wait);
  }

  async function liveConnect() {
    if (!CONFIGURED || typeof WebSocket === 'undefined') return;
    liveClose();
    setStatus('connecting');
    const tk = (await token()) || KEY;
    let ws;
    try { ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(KEY) + '&vsn=1.0.0'); }
    catch (e) { setStatus('offline'); return liveRetry(); }
    live.ws = ws; live.lastToken = tk;

    ws.onopen = () => {
      const changes = [{ event: '*', schema: 'public', table: 'reports' }];
      if (me && me.role === 'admin') changes.push({ event: '*', schema: 'public', table: 'profiles' });
      liveSend(LIVE_TOPIC, 'phx_join', {
        config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: changes, private: false },
        access_token: tk
      });
      live.hb = setInterval(() => {
        liveSend('phoenix', 'heartbeat', {});
        // perbarui token di channel sebelum kedaluwarsa
        token().then(t => { if (t && t !== live.lastToken) { live.lastToken = t; liveSend(LIVE_TOPIC, 'access_token', { access_token: t }); } });
      }, 25000);
    };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.topic !== LIVE_TOPIC) return;
      if (m.event === 'phx_reply') {
        if (m.payload && m.payload.status === 'ok') {
          const recon = live.retry > 0; live.retry = 0; setStatus('live');
          if (recon) refresh().then(() => emit({ type: 'sync' })); // kejar perubahan saat terputus
        } else { setStatus('offline'); liveClose(); liveRetry(); }
      } else if (m.event === 'postgres_changes') {
        handleChange(m.payload && m.payload.data);
      } else if (m.event === 'phx_error' || m.event === 'phx_close') {
        setStatus('offline'); liveClose(); liveRetry();
      }
    };
    ws.onerror = () => { try { ws.close(); } catch (x) { /* ignore */ } };
    ws.onclose = () => { if (live.ws !== ws) return; live.ws = null; setStatus('offline'); liveClose(); liveRetry(); };
  }

  function handleChange(d) {
    if (!d || !d.record && !d.old_record) return;
    const admin = !!(me && me.role === 'admin');
    if (d.table === 'reports') {
      if (d.type === 'DELETE') {
        const id = d.old_record && d.old_record.id; if (!id) return;
        const n = db.reports.length; db.reports = db.reports.filter(r => r.id !== id);
        if (db.reports.length !== n) emit({ type: 'report', action: 'delete', id });
        return;
      }
      const rep = mapReport(d.record);
      const i = db.reports.findIndex(x => x.id === rep.id);
      if (rep.hidden && !admin && !(me && rep.userId === me.id)) {
        if (i >= 0) { db.reports.splice(i, 1); emit({ type: 'report', action: 'delete', id: rep.id }); }
        return;
      }
      if (i >= 0) { db.reports[i] = rep; emit({ type: 'report', action: 'update', report: rep }); }
      else { db.reports.push(rep); db.reports.sort((a, b) => b.ts - a.ts); emit({ type: 'report', action: 'insert', report: rep }); }
    } else if (d.table === 'profiles' && admin) {
      if (d.type === 'DELETE') { const id = d.old_record && d.old_record.id; db.users = db.users.filter(u => u.id !== id); }
      else {
        const u = mapUser(d.record), i = db.users.findIndex(x => x.id === u.id);
        if (i >= 0) db.users[i] = u; else db.users.push(u);
      }
      emit({ type: 'user' });
    }
  }

  function ensureLive() {
    if (live.started || !CONFIGURED) return;
    live.started = true;
    ready.then(() => {
      liveConnect();
      // cadangan: polling pelan saat realtime aktif (mis. laporan yang disembunyikan admin tidak
      // dikirim ke pengunjung biasa oleh RLS), lebih sering saat realtime putus
      setInterval(() => {
        if (document.hidden) return;
        if (live.status === 'live' && ++live.tick % 4) return;
        refresh().then(() => emit({ type: 'sync' }));
      }, 15000);
      window.addEventListener('online', () => { if (live.status !== 'live') { live.retry = 0; liveConnect(); } });
      document.addEventListener('visibilitychange', () => { if (!document.hidden && live.status !== 'live') { live.retry = 0; liveConnect(); } });
    });
  }
  function onChange(fn) {
    listeners.push(fn); ensureLive();
    return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }
  const liveStatus = () => live.status;
  const reconnectLive = () => { if (live.started) { live.retry = 0; liveConnect(); } };

  global.CC = global.CC || {};
  Object.assign(global.CC, {
    LEVELS, CATEGORIES, TAGS, pctToLevel,
    ready, onReady, refresh, configured: CONFIGURED, onChange, liveStatus,
    currentUser, login, logout, register,
    places, place, reports, visibleReports, users, activeUserCount,
    crowd, bestWindow, peakHour,
    addReport, updateReport, deleteReport, savePlace, deletePlace, updateUser
  });
})(window);
