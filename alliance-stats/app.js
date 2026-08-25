/* 同盟 武勲記録 — 動作ロジック。
   データは window.initApp(DATA) を呼び出すことで描画される（DATAは bukun.html 側の
   ブートストラップが GAS から fetch して渡す。もう data.js には依存しない）。 */
window.initApp = function (DATA) {
  'use strict';
  const SQUADS = DATA.squads, SQUAD_ORDER = DATA.squadOrder;
  const WEEKS = DATA.weeks.map(w => ({ label: w.label, data: w.rows.map(r => ({ name: r[0], b: r[1], s: r[2] })) }));
  WEEKS.forEach(w => { w.map = new Map(w.data.map(r => [r.name, r])); });
  const latest = WEEKS[WEEKS.length - 1];
  const prev = WEEKS.length > 1 ? WEEKS[WEEKS.length - 2] : WEEKS[0];

  // ---- 推移（最新2週の比較）----
  const names = new Set([...prev.map.keys(), ...latest.map.keys()]);
  let merged = [...names].map(n => {
    const a = prev.map.get(n), b = latest.map.get(n);
    const st = (a && b) ? '継続' : (b ? '新加入' : '脱退');
    return {
      name: n, squad: SQUADS[n] || '', status: st,
      bL: b ? b.b : null, bP: a ? a.b : null, db: (a && b) ? b.b - a.b : null,
      sL: b ? b.s : null, sP: a ? a.s : null, ds: (a && b) ? b.s - a.s : null
    };
  });
  merged.sort((x, y) => (y.bL ?? -1) - (x.bL ?? -1));
  merged.forEach((r, i) => r.rank = r.bL != null ? i + 1 : null);
  const nNew = merged.filter(r => r.status === '新加入').length;
  const nLeft = merged.filter(r => r.status === '脱退').length;
  const nCont = merged.filter(r => r.status === '継続').length;
  const upS = merged.filter(r => r.ds > 0).length;

  document.getElementById('sub').innerHTML =
    '<b>' + prev.label + '</b> と <b>' + latest.label + '</b> を比較 ・ 全<b>' + names.size + '</b>名 ・ ' + SQUAD_ORDER.length + '分隊';
  document.getElementById('foot').textContent =
    '継続 ' + nCont + ' / 新加入 ' + nNew + ' / 脱退 ' + nLeft + ' ・ データ：同盟成員一覧より集計';
  const stats = [
    { k: latest.label + ' 在籍', v: latest.data.length, s: '最新週', c: '' },
    { k: '新加入', v: nNew, s: latest.label + ' で加入', c: 'new' },
    { k: '脱退', v: nLeft, s: latest.label + ' で離脱', c: 'left' },
    { k: '勢力値プラス', v: upS + '名', s: '継続' + nCont + '名中', c: '' }
  ];
  document.getElementById('stats').innerHTML = stats.map(t =>
    '<div class="tablet ' + t.c + '"><div class="k">' + t.k + '</div><div class="v">' +
    (typeof t.v === 'number' ? t.v.toLocaleString('ja-JP') : t.v) + '</div><div class="s">' + t.s + '</div></div>').join('');

  // ---- helpers ----
  const fmt = n => n == null ? '—' : n.toLocaleString('ja-JP');
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rankPill = r => { if (r == null) return '<span class="rk na">–</span>'; const c = r === 1 ? 'm1' : r === 2 ? 'm2' : r === 3 ? 'm3' : ''; return '<span class="rk ' + c + '">' + r + '</span>'; };
  const maxAbs = (rows, key) => Math.max(1, ...rows.map(r => Math.abs(r[key] || 0)));
  function deltaCell(v, max) {
    if (v == null) return '<td class="c-delta dim">—</td>';
    const cls = v > 0 ? 'up' : v < 0 ? 'dn' : 'ze', ar = v > 0 ? '▲' : v < 0 ? '▼' : '', sign = v > 0 ? '+' : '';
    const w = Math.min(100, Math.abs(v) / max * 100);
    const bar = v !== 0 ? '<span class="bar" style="width:' + w + '%"></span>' : '';
    return '<td class="c-delta"><span class="delta ' + cls + '">' + ar + ' ' + sign + v.toLocaleString('ja-JP') + bar + '</span></td>';
  }
  function squadAgg() {
    const agg = {}; SQUAD_ORDER.forEach(s => agg[s] = { squad: s, n: 0, sb: 0, ss: 0 });
    latest.data.forEach(r => { const s = SQUADS[r.name]; if (!agg[s]) return; agg[s].n++; agg[s].sb += r.b; agg[s].ss += r.s; });
    return SQUAD_ORDER.map(s => { const a = agg[s]; return { squad: s, n: a.n, sb: a.sb, ab: a.n ? Math.round(a.sb / a.n) : 0, ss: a.ss, as: a.n ? Math.round(a.ss / a.n) : 0 }; });
  }

  // ---- table views ----
  const weekViews = [...WEEKS].reverse();
  let view = 'trend', squadFilter = 'all';
  const trendSorts = [{ label: 'ランキング', key: 'bL', dir: -1 }, { label: '勢力値の伸び', key: 'ds', dir: -1 }, { label: '武勲の伸び', key: 'db', dir: -1 }, { label: '勢力値', key: 'sL', dir: -1 }];
  const weekSorts = [{ label: '武勲', key: 'b', dir: -1 }, { label: '勢力値', key: 's', dir: -1 }];
  const squadSorts = [{ label: '合計勢力値', key: 'ss', dir: -1 }, { label: '合計武勲', key: 'sb', dir: -1 }, { label: '平均勢力値', key: 'as', dir: -1 }, { label: '平均武勲', key: 'ab', dir: -1 }, { label: '人数', key: 'n', dir: -1 }];
  let sortKey = 'bL', sortDir = -1;
  const isTrend = () => view === 'trend', isSquad = () => view === 'squad', isGraph = () => view === 'graph';
  const activeWeek = () => weekViews.find(w => w.label === view);
  const sortsFor = () => isSquad() ? squadSorts : (isTrend() ? trendSorts : weekSorts);

  function colsFor() {
    if (isSquad()) return [{ h: '分隊', cls: 'name' }, { h: '人数', k: 'n', cls: 'c-num' }, { h: '合計武勲', k: 'sb', cls: 'c-num' }, { h: '平均武勲', k: 'ab', cls: 'c-num' }, { h: '合計勢力値', k: 'ss', cls: 'c-num' }, { h: '平均勢力値', k: 'as', cls: 'c-num' }];
    if (isTrend()) return [{ h: 'メンバー', cls: 'name' }, { h: '分隊', cls: 'c-squad' }, { h: '状態', cls: 'c-status' }, { h: '武勲 ' + latest.label, k: 'bL', cls: 'c-num' }, { h: '武勲 増減', k: 'db', cls: 'c-delta' }, { h: '勢力値 ' + latest.label, k: 'sL', cls: 'c-num' }, { h: '勢力値 増減', k: 'ds', cls: 'c-delta' }, { h: '武勲 ' + prev.label, k: 'bP', cls: 'c-num dim' }, { h: '勢力値 ' + prev.label, k: 'sP', cls: 'c-num dim' }];
    return [{ h: 'メンバー', cls: 'name' }, { h: '分隊', cls: 'c-squad' }, { h: '武勲', k: 'b', cls: 'c-num' }, { h: '勢力値', k: 's', cls: 'c-num' }];
  }
  function currentRows() {
    if (isSquad()) return squadAgg();
    return isTrend() ? merged.slice() : activeWeek().data.map(r => ({ ...r, squad: SQUADS[r.name] || '' }));
  }
  function buildSeg() {
    const b = ['<button data-v="trend" class="' + (view === 'trend' ? 'on' : '') + '">推移</button>',
      '<button data-v="squad" class="' + (view === 'squad' ? 'on' : '') + '">分隊</button>',
      '<button data-v="graph" class="' + (view === 'graph' ? 'on' : '') + '">グラフ</button>']
      .concat(weekViews.map(w => '<button data-v="' + w.label + '" class="' + (view === w.label ? 'on' : '') + '">' + w.label + '</button>'));
    document.getElementById('seg').innerHTML = b.join('');
  }
  function buildChips() { document.getElementById('chips').innerHTML = sortsFor().map(o => '<button class="chip' + (o.key === sortKey ? ' on' : '') + '" data-k="' + o.key + '" data-d="' + o.dir + '">' + o.label + '</button>').join(''); }
  function buildSqFilter() {
    const chips = ['<button class="chip' + (squadFilter === 'all' ? ' on' : '') + '" data-s="all">全体</button>']
      .concat(SQUAD_ORDER.map(s => '<button class="chip' + (squadFilter === s ? ' on' : '') + '" data-s="' + s + '">' + s + '</button>'));
    document.getElementById('sqfilter').innerHTML = chips.join('');
  }
  function applyView() {
    const graph = isGraph();
    document.getElementById('rowSearch').style.display = graph ? 'none' : 'flex';
    document.getElementById('rowSquad').style.display = (graph || isSquad()) ? 'none' : 'flex';
    document.getElementById('count').style.display = graph ? 'none' : 'block';
    document.getElementById('tableWrap').style.display = graph ? 'none' : 'block';
    document.getElementById('graphView').style.display = graph ? 'block' : 'none';
    document.getElementById('tnote').style.display = graph ? 'none' : 'block';
    if (graph) initGraphs();
  }
  function render() {
    if (isGraph()) return;
    const q = document.getElementById('q').value.trim().toLowerCase();
    const cols = colsFor(), tbl = document.getElementById('tbl');
    tbl.className = isSquad() ? 'squad' : (isTrend() ? 'trend' : 'week');
    document.getElementById('thead').innerHTML = '<tr>' + cols.map(c => { const sorted = c.k && c.k === sortKey, ar = sorted ? (sortDir < 0 ? '▼' : '▲') : ''; return '<th class="' + (c.cls || '') + (sorted ? ' sorted' : '') + '" data-k="' + (c.k || '') + '">' + c.h + '<span class="ar">' + ar + '</span></th>'; }).join('') + '</tr>';
    let rows = currentRows();
    if (sortKey) rows.sort((a, b) => { let av = a[sortKey], bv = b[sortKey]; if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv), 'ja') * sortDir; av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv; return (av - bv) * sortDir; });
    if (!isSquad() && squadFilter !== 'all') rows = rows.filter(r => r.squad === squadFilter);
    const filtered = q ? rows.filter(r => String(r.name || '').toLowerCase().includes(q)) : rows;
    const maxDb = isTrend() ? maxAbs(merged, 'db') : 1, maxDs = isTrend() ? maxAbs(merged, 'ds') : 1;
    const tb = document.getElementById('tbody');
    if (!filtered.length) { tb.innerHTML = '<tr><td class="empty" colspan="' + cols.length + '">該当するデータがありません</td></tr>'; setCount(0, rows.length, q); return; }
    tb.innerHTML = filtered.map(r => {
      if (isSquad()) return '<tr><td class="name"><span class="sqname">' + esc(r.squad) + '</span></td><td class="c-num">' + fmt(r.n) + '</td><td class="c-num">' + fmt(r.sb) + '</td><td class="c-num">' + fmt(r.ab) + '</td><td class="c-num">' + fmt(r.ss) + '</td><td class="c-num">' + fmt(r.as) + '</td></tr>';
      const hit = q && String(r.name).toLowerCase().includes(q);
      if (isTrend()) { const badge = r.status === '新加入' ? '<span class="badge n">新加入</span>' : r.status === '脱退' ? '<span class="badge l">脱退</span>' : '<span class="badge">継続</span>'; return '<tr class="' + (hit ? 'hit' : '') + '"><td class="name">' + rankPill(r.rank) + '<span class="nm">' + esc(r.name) + '</span></td><td class="c-squad"><span class="sq">' + esc(r.squad) + '</span></td><td class="c-status">' + badge + '</td><td class="c-num">' + fmt(r.bL) + '</td>' + deltaCell(r.db, maxDb) + '<td class="c-num">' + fmt(r.sL) + '</td>' + deltaCell(r.ds, maxDs) + '<td class="c-num dim">' + fmt(r.bP) + '</td><td class="c-num dim">' + fmt(r.sP) + '</td></tr>'; }
      return '<tr class="' + (hit ? 'hit' : '') + '"><td class="name"><span class="nm">' + esc(r.name) + '</span></td><td class="c-squad"><span class="sq">' + esc(r.squad) + '</span></td><td class="c-num">' + fmt(r.b) + '</td><td class="c-num">' + fmt(r.s) + '</td></tr>';
    }).join('');
    setCount(filtered.length, rows.length, q);
  }
  function setCount(shown, total, q) {
    const el = document.getElementById('count');
    if (isSquad()) { el.innerHTML = '<b>' + SQUAD_ORDER.length + '</b> 分隊 ・ 全' + latest.data.length + '名（' + latest.label + '）'; return; }
    const suff = squadFilter !== 'all' ? '（' + squadFilter + '）' : '';
    el.innerHTML = q ? '「' + esc(q) + '」で <b>' + shown + '</b> 件' + suff : '<b>' + shown + '</b> 名を表示' + suff;
  }

  document.getElementById('seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; const def = sortsFor()[0]; sortKey = def.key; sortDir = def.dir; buildSeg(); buildChips(); buildSqFilter(); applyView(); render(); });
  document.getElementById('chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; const k = c.dataset.k; if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = parseInt(c.dataset.d); } buildChips(); render(); });
  document.getElementById('sqfilter').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; squadFilter = c.dataset.s; buildSqFilter(); render(); });
  document.getElementById('thead').addEventListener('click', e => { const th = e.target.closest('th'); if (!th || !th.dataset.k) return; const k = th.dataset.k; if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = -1; } buildChips(); render(); });
  const q = document.getElementById('q'), qx = document.getElementById('qx');
  q.addEventListener('input', () => { qx.style.display = q.value ? 'block' : 'none'; render(); });
  qx.addEventListener('click', () => { q.value = ''; qx.style.display = 'none'; render(); q.focus(); });

  // ================= グラフ =================
  const GOLD = '#d6b25c', JADE = '#79c39a', PAPER = '#ece2cd', MUTED = '#a8997c', GLINE = 'rgba(160,140,100,.14)';
  // 分隊の色は同盟ごとに分隊名が変わるため、ハードコードせず自動割り当てにする
  const PALETTE = ['#d6b25c', '#79c39a', '#dd6e5a', '#7aa2d6', '#c58fd0', '#e0a45c', '#6fc3c0', '#e0798f', '#8fd6a0', '#b8a6e0'];
  const SQCOL = {}; SQUAD_ORDER.forEach((s, i) => { SQCOL[s] = PALETTE[i % PALETTE.length]; });
  const weekLabels = WEEKS.map(w => w.label);
  const gfmt = n => n == null ? '' : n.toLocaleString('ja-JP');
  const allianceSeries = m => WEEKS.map(w => w.data.reduce((a, r) => a + (m === 's' ? r.s : r.b), 0));
  function squadSeries(metric, agg) {
    return SQUAD_ORDER.map(s => {
      const ms = Object.keys(SQUADS).filter(n => SQUADS[n] === s);
      const data = WEEKS.map(w => {
        const vals = ms.map(n => w.map.get(n)).filter(Boolean).map(r => metric === 's' ? r.s : r.b);
        if (!vals.length) return null;
        const sum = vals.reduce((a, b) => a + b, 0);
        return agg === 'avg' ? Math.round(sum / vals.length) : sum;
      });
      return { label: s, data, borderColor: SQCOL[s], backgroundColor: SQCOL[s] };
    });
  }
  const memberSeries = (name, m) => WEEKS.map(w => { const r = w.map.get(name); return r ? (m === 's' ? r.s : r.b) : null; });

  let graphInit = false, sqChart, meChart;
  const gridX = () => ({ grid: { color: GLINE }, ticks: { color: MUTED } });
  const gridY = () => ({ grid: { color: GLINE }, ticks: { color: MUTED, callback: v => v >= 10000 ? (v / 10000) + '万' : v } });
  function baseOpts(dual) {
    return {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { usePointStyle: true, boxWidth: 8, padding: 12, color: PAPER } },
        tooltip: { backgroundColor: '#26201a', borderColor: '#4a3d2c', borderWidth: 1, titleColor: GOLD, bodyColor: PAPER, padding: 10, callbacks: { label: c => ' ' + c.dataset.label + ': ' + gfmt(c.parsed.y) } }
      },
      scales: dual
        ? { x: gridX(), y: Object.assign({ position: 'left' }, gridY()), y1: Object.assign({ position: 'right' }, gridY(), { grid: { drawOnChartArea: false } }) }
        : { x: gridX(), y: gridY() }
    };
  }
  const lineDS = (label, data, color, opts) => Object.assign({ label, data, borderColor: color, backgroundColor: color, pointRadius: 3.5, pointHoverRadius: 5, borderWidth: 2.4, tension: .25, spanGaps: true }, opts || {});

  function initGraphs() {
    if (graphInit) return; graphInit = true;
    Chart.defaults.color = MUTED; Chart.defaults.font.family = '"Noto Sans JP",sans-serif'; Chart.defaults.font.size = 11;
    // 同盟 勢力値
    new Chart(document.getElementById('c_alS'), {
      type: 'line', data: { labels: weekLabels, datasets: [lineDS('合計勢力値', allianceSeries('s'), GOLD)] },
      options: Object.assign(baseOpts(false), { plugins: { legend: { display: false }, tooltip: baseOpts(false).plugins.tooltip, title: { display: true, text: '合計勢力値', color: '#e7cd8a', font: { size: 13, weight: '700' } } } })
    });
    // 同盟 武勲
    new Chart(document.getElementById('c_alB'), {
      type: 'bar', data: { labels: weekLabels, datasets: [{ label: '合計武勲', data: allianceSeries('b'), backgroundColor: 'rgba(214,178,92,.85)', borderColor: GOLD }] },
      options: Object.assign(baseOpts(false), { plugins: { legend: { display: false }, tooltip: baseOpts(false).plugins.tooltip, title: { display: true, text: '合計武勲（週ごと）', color: '#e7cd8a', font: { size: 13, weight: '700' } } } })
    });
    drawSquad();
    // member select
    const sel = document.getElementById('msel');
    const mnames = latest.data.map(r => r.name);
    sel.innerHTML = mnames.map(n => '<option>' + esc(n) + '</option>').join('');
    sel.value = mnames[0] || '';
    drawMember();
    sel.addEventListener('change', drawMember);
    document.getElementById('sq_metric').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;[...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b)); drawSquad(); });
    document.getElementById('sq_agg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;[...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b)); drawSquad(); });
  }
  function activeToggle(id) { const on = document.querySelector('#' + id + ' button.on'); return on ? on.dataset.v : null; }
  function drawSquad() {
    const metric = activeToggle('sq_metric') || 's', agg = activeToggle('sq_agg') || 'sum';
    if (sqChart) sqChart.destroy();
    sqChart = new Chart(document.getElementById('c_sq'), { type: 'line', data: { labels: weekLabels, datasets: squadSeries(metric, agg).map(d => lineDS(d.label, d.data, d.borderColor)) }, options: baseOpts(false) });
  }
  function drawMember() {
    const name = document.getElementById('msel').value;
    if (meChart) meChart.destroy();
    meChart = new Chart(document.getElementById('c_me'), {
      type: 'line', data: { labels: weekLabels, datasets: [lineDS('勢力値', memberSeries(name, 's'), GOLD, { yAxisID: 'y' }), lineDS('武勲', memberSeries(name, 'b'), JADE, { yAxisID: 'y1' })] },
      options: baseOpts(true)
    });
  }

  // ---- init ----
  buildSeg(); buildChips(); buildSqFilter(); applyView(); render();
};
