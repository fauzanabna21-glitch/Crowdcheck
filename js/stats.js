document.addEventListener('DOMContentLoaded', function () {
  const { $, esc, qs, pad, badge } = CC.ui;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const LV = { 1: css('--lv1'), 2: css('--lv2'), 3: css('--lv3'), 4: css('--lv4') };
  const INK = css('--ink'), BRAND = css('--brand'), MUTED = css('--muted'), LINE = '#e8e3d7';
  Chart.defaults.font.family = css('--font');
  Chart.defaults.color = MUTED;

  const places = CC.places().sort((a, b) => a.name.localeCompare(b.name));
  const sel = $('#placeSel');
  sel.innerHTML = places.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const pre = qs('place');
  if (pre && CC.place(pre)) sel.value = pre;

  const charts = {};
  const mk = (id, cfg) => { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($('#' + id), cfg); };
  const labelsH = Array.from({ length: 24 }, (_, h) => pad(h) + ':00');

  function kpis(p) {
    const c = CC.crowd(p), bw = CC.bestWindow(p), pk = CC.peakHour(p);
    const week = CC.visibleReports().filter(r => r.placeId === p.id && Date.now() - r.ts < 7 * 864e5);
    const avg = week.length ? (week.reduce((s, r) => s + r.level, 0) / week.length) : null;
    $('#kpis').innerHTML = `
      <div class="card kpi"><span class="k">Kondisi sekarang</span><span class="v" style="padding:.15em 0">${badge(c.level)}</span><span class="s">${CC.ui.srcText(c)}</span></div>
      <div class="card kpi"><span class="k">Jam puncak</span><span class="v">${pad(pk)}:00</span><span class="s">paling padat sepanjang hari</span></div>
      <div class="card kpi"><span class="k">Waktu terbaik</span><span class="v">${pad(bw.from)}–${pad(bw.to)}</span><span class="s">rentang paling lengang (08–22)</span></div>
      <div class="card kpi"><span class="k">Laporan 7 hari</span><span class="v">${week.length}</span><span class="s">${avg ? 'rata-rata level ' + avg.toFixed(1) + ' dari 4' : 'belum ada laporan'}</span></div>`;
  }

  function hourChart(p) {
    $('#pName').textContent = p.name;
    // titik dari laporan 24 jam terakhir (rata-rata level per jam → persen)
    const sums = Array(24).fill(0), n = Array(24).fill(0);
    CC.visibleReports().filter(r => r.placeId === p.id && Date.now() - r.ts < 864e5)
      .forEach(r => { const h = new Date(r.ts).getHours(); sums[h] += r.level; n[h]++; });
    const pts = sums.map((s, h) => n[h] ? Math.round((s / n[h]) * 25 - 12.5) : null);
    const now = new Date().getHours();
    mk('cHour', {
      type: 'line',
      data: {
        labels: labelsH,
        datasets: [
          { label: 'Pola khas (%)', data: p.pattern, borderColor: BRAND, backgroundColor: 'rgba(47,91,234,.14)', fill: true, tension: .35, pointRadius: 0, borderWidth: 3 },
          { label: 'Laporan 24 jam terakhir', data: pts, showLine: false, borderColor: INK, backgroundColor: INK, pointRadius: 5, pointStyle: 'rectRot' },
          { label: 'Sekarang', data: p.pattern.map((v, h) => h === now ? v : null), showLine: false, borderColor: '#fff', backgroundColor: LV[CC.crowd(p).level], pointRadius: 9, borderWidth: 3 }
        ]
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: { y: { min: 0, max: 100, grid: { color: LINE }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }
      }
    });
  }

  function rankChart(p) {
    const rows = CC.places().map(x => ({ x, c: CC.crowd(x) })).sort((a, b) => b.c.score - a.c.score);
    mk('cRank', {
      type: 'bar',
      data: {
        labels: rows.map(r => r.x.name),
        datasets: [{ data: rows.map(r => +r.c.score.toFixed(2)), backgroundColor: rows.map(r => LV[r.c.level]), borderRadius: 6,
          borderColor: rows.map(r => r.x.id === p.id ? INK : 'transparent'), borderWidth: rows.map(r => r.x.id === p.id ? 3 : 0) }]
      },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        scales: { x: { min: 0, max: 4, grid: { color: LINE }, ticks: { stepSize: 1, callback: v => CC.LEVELS[v] ? CC.LEVELS[v].label : '' } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' Skor ' + c.parsed.x.toFixed(1) + ' / 4' } } }
      }
    });
  }

  function distChart() {
    const cnt = [0, 0, 0, 0];
    CC.places().forEach(p => cnt[CC.crowd(p).level - 1]++);
    mk('cDist', {
      type: 'doughnut',
      data: { labels: [1, 2, 3, 4].map(i => CC.LEVELS[i].label), datasets: [{ data: cnt, backgroundColor: [1, 2, 3, 4].map(i => LV[i]), borderColor: '#fff', borderWidth: 3 }] },
      options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } }
    });
  }

  function daysChart() {
    const labels = [], data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const s = d.getTime(), e = s + 864e5;
      labels.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
      data.push(CC.visibleReports().filter(r => r.ts >= s && r.ts < e).length);
    }
    mk('cDays', {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Laporan', data, backgroundColor: BRAND, borderRadius: 8 }] },
      options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: LINE }, ticks: { precision: 0 } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });
  }

  function render() {
    const p = CC.place(sel.value);
    kpis(p); hourChart(p); rankChart(p);
  }
  sel.addEventListener('change', render);
  distChart(); daysChart(); render();
});
