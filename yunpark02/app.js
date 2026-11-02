/* ゆんぱーく 武勲記録 — 動作ロジック。データは data.js (window.DATA) から読む。 */
(function () {
  'use strict';
  // ---- バッジ設定：1週間の武勲がこの値以上で獲得（数字を書き換えれば変更できます）----
  const BADGE_TIERS = [
    { min: 400000, label: '40万', cls: 't1' },
    { min: 750000, label: '75万', cls: 't2' },
    { min: 1000000, label: '100万', cls: 't3' },
    { min: 1500000, label: '150万', cls: 't4' }
  ];
  const DATA = window.DATA;
  const SQUADS = DATA.squads, SQUAD_ORDER = DATA.squadOrder;
  const HAS_SQUADS = SQUAD_ORDER.length > 0;
  const WEEKS = DATA.weeks.map(w => ({ label: w.label, data: w.rows.map(r => ({ name: r[0], b: r[1], s: r[2] })) }));
  WEEKS.forEach(w => { w.map = new Map(w.data.map(r => [r.name, r])); });
  const latest = WEEKS[WEEKS.length - 1];
  const prev = WEEKS.length > 1 ? WEEKS[WEEKS.length - 2] : WEEKS[0];

  // ---- 週ごとの順位（同値は同順位）／実戦週（武勲が入っている週）----
  WEEKS.forEach((w, i) => {
    w.idx = i; w.play = w.data.some(r => r.b > 0);
    const rk = key => { const m = new Map(); w.data.forEach(r => m.set(r.name, 1 + w.data.filter(o => o[key] > r[key]).length)); return m; };
    w.rankB = rk('b'); w.rankS = rk('s');
  });
  const PLAY = WEEKS.filter(w => w.play);

  // ---- バッジ ----
  const tierIdxOf = b => { let k = -1; BADGE_TIERS.forEach((t, i) => { if (b >= t.min) k = i; }); return k; };
  const badgeHtml = k => k < 0 ? '' : '<span class="bdg ' + BADGE_TIERS[k].cls + '">★' + BADGE_TIERS[k].label + '</span>';

  // ---- 通算（シーズン合計）----
  const AGG = new Map();
  WEEKS.forEach(w => w.data.forEach(r => {
    let a = AGG.get(r.name);
    if (!a) AGG.set(r.name, a = { name: r.name, tot: 0, cnt: 0, best: 0, bestLabel: '' });
    a.tot += r.b;
    if (w.play) { a.cnt++; if (r.b > a.best) { a.best = r.b; a.bestLabel = w.label; } }
  }));
  AGG.forEach(a => { a.tierIdx = tierIdxOf(a.best); a.avg = a.cnt ? Math.round(a.tot / a.cnt) : 0; });
  const totalList = [...AGG.values()].filter(a => a.cnt > 0);
  totalList.forEach(a => { a.trank = 1 + totalList.filter(o => o.tot > a.tot).length; });

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
  const avgOf = (w, k) => Math.round(w.data.reduce((a, r) => a + r[k], 0) / w.data.length);
  const avgB = avgOf(latest, 'b'), avgS = avgOf(latest, 's');
  const hasPrev = WEEKS.length > 1;
  const dTxt = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v)) + ' 前週比';
  const dCls = v => v > 0 ? 'up' : v < 0 ? 'dn' : '';

  document.getElementById('sub').innerHTML =
    '<b>' + prev.label + '</b> と <b>' + latest.label + '</b> を比較 ・ 全<b>' + names.size + '</b>名' +
    (HAS_SQUADS ? ' ・ ' + SQUAD_ORDER.length + '分隊' : '');
  document.getElementById('foot').textContent =
    '継続 ' + nCont + ' / 新加入 ' + nNew + ' / 脱退 ' + nLeft + ' ・ データ：同盟成員一覧より集計';
  const stats = [
    { k: latest.label + ' 在籍', v: latest.data.length, s: '最新週', c: '' },
    { k: '新加入', v: nNew, s: latest.label + ' で加入', c: 'new' },
    { k: '脱退', v: nLeft, s: latest.label + ' で離脱', c: 'left' },
    { k: '勢力値プラス', v: upS + '名', s: '継続' + nCont + '名中', c: '' },
    { k: '平均武勲', v: avgB, s: (hasPrev && prev.play) ? dTxt(avgB - avgOf(prev, 'b'), n => n.toLocaleString('ja-JP')) : '全在籍の平均', sc: (hasPrev && prev.play) ? dCls(avgB - avgOf(prev, 'b')) : '', c: '' },
    { k: '平均勢力値', v: avgS, s: hasPrev ? dTxt(avgS - avgOf(prev, 's'), n => n.toLocaleString('ja-JP')) : '全在籍の平均', sc: hasPrev ? dCls(avgS - avgOf(prev, 's')) : '', c: '' }
  ];
  document.getElementById('stats').innerHTML = stats.map(t =>
    '<div class="tablet ' + t.c + '"><div class="k">' + t.k + '</div><div class="v">' +
    (typeof t.v === 'number' ? t.v.toLocaleString('ja-JP') : t.v) + '</div><div class="s ' + (t.sc || '') + '">' + t.s + '</div></div>').join('');

  // ---- helpers ----
  const fmt = n => n == null ? '—' : n.toLocaleString('ja-JP');
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rankPill = r => { if (r == null) return '<span class="rk na">–</span>'; const c = r === 1 ? 'm1' : r === 2 ? 'm2' : r === 3 ? 'm3' : ''; return '<span class="rk ' + c + '">' + r + '</span>'; };
  const nmSpan = n => '<span class="nm" data-name="' + encodeURIComponent(n) + '">' + esc(n) + '</span>';
  const seasonBadge = n => { const a = AGG.get(n); return a ? badgeHtml(a.tierIdx) : ''; };
  const fmtW = n => n == null ? '—' : (Math.abs(n) >= 100000 ? (Math.round(n / 100) / 100).toLocaleString('ja-JP') + '万' : n.toLocaleString('ja-JP'));
  const signed = (v, f) => v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));
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
  let view = 'trend', squadFilter = 'all', weekSel = latest.label;
  const trendSorts = [{ label: 'ランキング', key: 'bL', dir: -1 }, { label: '勢力値の伸び', key: 'ds', dir: -1 }, { label: '武勲の伸び', key: 'db', dir: -1 }, { label: '勢力値', key: 'sL', dir: -1 }];
  const weekSorts = [{ label: '武勲', key: 'b', dir: -1 }, { label: '勢力値', key: 's', dir: -1 }];
  const totalSorts = [{ label: '通算武勲', key: 'tot', dir: -1 }, { label: '週平均', key: 'avg', dir: -1 }, { label: '参加週数', key: 'cnt', dir: -1 }];
  const squadSorts = [{ label: '合計勢力値', key: 'ss', dir: -1 }, { label: '合計武勲', key: 'sb', dir: -1 }, { label: '平均勢力値', key: 'as', dir: -1 }, { label: '平均武勲', key: 'ab', dir: -1 }, { label: '人数', key: 'n', dir: -1 }];
  let sortKey = 'bL', sortDir = -1;
  const isTrend = () => view === 'trend', isSquad = () => view === 'squad', isGraph = () => view === 'graph';
  const isAward = () => view === 'award', isTotal = () => view === 'total';
  const isWeek = () => weekViews.some(w => w.label === view);
  const isTable = () => !isGraph();
  const activeWeek = () => weekViews.find(w => w.label === view);
  const sortsFor = () => isSquad() ? squadSorts : (isTrend() ? trendSorts : (isTotal() ? totalSorts : weekSorts));

  function colsFor() {
    const sq = HAS_SQUADS ? [{ h: '分隊', cls: 'c-squad' }] : [];
    if (isSquad()) return [{ h: '分隊', cls: 'name' }, { h: '人数', k: 'n', cls: 'c-num' }, { h: '合計武勲', k: 'sb', cls: 'c-num' }, { h: '平均武勲', k: 'ab', cls: 'c-num' }, { h: '合計勢力値', k: 'ss', cls: 'c-num' }, { h: '平均勢力値', k: 'as', cls: 'c-num' }];
    if (isTotal()) return [{ h: 'メンバー', cls: 'name' }].concat(sq, [{ h: '通算武勲', k: 'tot', cls: 'c-num' }, { h: '週平均', k: 'avg', cls: 'c-num' }, { h: '参加', k: 'cnt', cls: 'c-num' }], PLAY.map((w, pi) => ({ h: '武勲 ' + w.label, k: 'w' + pi, cls: 'c-num' })));
    if (isTrend()) return [{ h: 'メンバー', cls: 'name' }].concat(sq, [{ h: '状態', cls: 'c-status' }, { h: '武勲 ' + latest.label, k: 'bL', cls: 'c-num' }, { h: '武勲 増減', k: 'db', cls: 'c-delta' }, { h: '勢力値 ' + latest.label, k: 'sL', cls: 'c-num' }, { h: '勢力値 増減', k: 'ds', cls: 'c-delta' }, { h: '武勲 ' + prev.label, k: 'bP', cls: 'c-num dim' }, { h: '勢力値 ' + prev.label, k: 'sP', cls: 'c-num dim' }]);
    return [{ h: 'メンバー', cls: 'name' }].concat(sq, [{ h: '武勲', k: 'b', cls: 'c-num' }, { h: '勢力値', k: 's', cls: 'c-num' }]);
  }
  function totalRows() {
    return totalList.map(a => {
      const o = { name: a.name, squad: SQUADS[a.name] || '', tot: a.tot, avg: a.avg, cnt: a.cnt, trank: a.trank, tier: a.tierIdx, left: !latest.map.has(a.name) };
      PLAY.forEach((w, pi) => { const r = w.map.get(a.name); o['w' + pi] = r ? r.b : null; o['r' + pi] = r ? w.rankB.get(a.name) : null; });
      return o;
    });
  }
  function currentRows() {
    if (isSquad()) return squadAgg();
    if (isTotal()) return totalRows();
    return isTrend() ? merged.slice() : activeWeek().data.map(r => ({ ...r, squad: SQUADS[r.name] || '' }));
  }
  function buildSeg() {
    const on = v => (v === 'week' ? isWeek() : view === v) ? ' on' : '';
    const tabs = [['trend', '推移']]
      .concat(PLAY.length ? [['award', '表彰'], ['total', '通算']] : [])
      .concat(HAS_SQUADS ? [['squad', '分隊']] : [])
      .concat([['graph', 'グラフ'], ['week', '週別']]);
    document.getElementById('seg').innerHTML = tabs.map(t => '<button data-v="' + t[0] + '" class="' + on(t[0]).trim() + '">' + t[1] + '</button>').join('');
  }
  function buildWkChips() {
    document.getElementById('wkchips').innerHTML = weekViews.map(w => '<button class="chip' + (view === w.label ? ' on' : '') + '" data-w="' + w.label + '">' + w.label + '</button>').join('');
  }
  function buildChips() { document.getElementById('chips').innerHTML = sortsFor().map(o => '<button class="chip' + (o.key === sortKey ? ' on' : '') + '" data-k="' + o.key + '" data-d="' + o.dir + '">' + o.label + '</button>').join(''); }
  function buildSqFilter() {
    const chips = ['<button class="chip' + (squadFilter === 'all' ? ' on' : '') + '" data-s="all">全体</button>']
      .concat(SQUAD_ORDER.map(s => '<button class="chip' + (squadFilter === s ? ' on' : '') + '" data-s="' + s + '">' + s + '</button>'));
    document.getElementById('sqfilter').innerHTML = chips.join('');
  }
  function applyView() {
    const graph = isGraph(), award = isAward(), tbl = !graph && !award;
    document.getElementById('rowWeek').style.display = isWeek() ? 'flex' : 'none';
    document.getElementById('rowSearch').style.display = tbl ? 'flex' : 'none';
    document.getElementById('rowSquad').style.display = (!HAS_SQUADS || !tbl || isSquad()) ? 'none' : 'flex';
    document.getElementById('count').style.display = tbl ? 'block' : 'none';
    document.getElementById('tableWrap').style.display = tbl ? 'block' : 'none';
    document.getElementById('graphView').style.display = graph ? 'block' : 'none';
    document.getElementById('awardView').style.display = award ? 'block' : 'none';
    document.getElementById('tnote').style.display = tbl ? 'block' : 'none';
    if (graph) initGraphs();
    if (award) renderAwards();
  }
  function render() {
    if (isGraph() || isAward()) return;
    const q = document.getElementById('q').value.trim().toLowerCase();
    const cols = colsFor(), tbl = document.getElementById('tbl');
    tbl.className = isSquad() ? 'squad' : (isTrend() ? 'trend' : (isTotal() ? 'total' : 'week'));
    document.getElementById('thead').innerHTML = '<tr>' + cols.map(c => { const sorted = c.k && c.k === sortKey, ar = sorted ? (sortDir < 0 ? '▼' : '▲') : ''; return '<th class="' + (c.cls || '') + (sorted ? ' sorted' : '') + '" data-k="' + (c.k || '') + '">' + c.h + '<span class="ar">' + ar + '</span></th>'; }).join('') + '</tr>';
    let rows = currentRows();
    if (sortKey) rows.sort((a, b) => { let av = a[sortKey], bv = b[sortKey]; if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv), 'ja') * sortDir; av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv; return (av - bv) * sortDir; });
    if (!isSquad() && squadFilter !== 'all') rows = rows.filter(r => r.squad === squadFilter);
    const filtered = q ? rows.filter(r => (r.name || '').toLowerCase().includes(q)) : rows;
    const maxDb = isTrend() ? maxAbs(merged, 'db') : 1, maxDs = isTrend() ? maxAbs(merged, 'ds') : 1;
    const tb = document.getElementById('tbody');
    if (!filtered.length) { tb.innerHTML = '<tr><td class="empty" colspan="' + cols.length + '">該当するデータがありません</td></tr>'; setCount(0, rows.length, q); return; }
    const sqCell = r => HAS_SQUADS ? '<td class="c-squad"><span class="sq">' + esc(r.squad) + '</span></td>' : '';
    tb.innerHTML = filtered.map(r => {
      if (isSquad()) return '<tr><td class="name"><span class="sqname">' + esc(r.squad) + '</span></td><td class="c-num">' + fmt(r.n) + '</td><td class="c-num">' + fmt(r.sb) + '</td><td class="c-num">' + fmt(r.ab) + '</td><td class="c-num">' + fmt(r.ss) + '</td><td class="c-num">' + fmt(r.as) + '</td></tr>';
      const hit = q && r.name.toLowerCase().includes(q);
      if (isTotal()) {
        const tc = PLAY.map((w, pi) => '<td class="c-num">' + (r['w' + pi] == null ? '<span class="dim">—</span>' : fmt(r['w' + pi]) + '<span class="wr">' + r['r' + pi] + '位</span>') + '</td>').join('');
        return '<tr class="' + (hit ? 'hit' : '') + '"><td class="name">' + rankPill(r.trank) + nmSpan(r.name) + badgeHtml(r.tier) + (r.left ? '<span class="badge l lf">脱退</span>' : '') + '</td>' + sqCell(r) + '<td class="c-num">' + fmt(r.tot) + '</td><td class="c-num">' + fmt(r.avg) + '</td><td class="c-num">' + r.cnt + '週</td>' + tc + '</tr>';
      }
      if (isTrend()) { const badge = r.status === '新加入' ? '<span class="badge n">新加入</span>' : r.status === '脱退' ? '<span class="badge l">脱退</span>' : '<span class="badge">継続</span>'; return '<tr class="' + (hit ? 'hit' : '') + '"><td class="name">' + rankPill(r.rank) + nmSpan(r.name) + seasonBadge(r.name) + '</td>' + sqCell(r) + '<td class="c-status">' + badge + '</td><td class="c-num">' + fmt(r.bL) + '</td>' + deltaCell(r.db, maxDb) + '<td class="c-num">' + fmt(r.sL) + '</td>' + deltaCell(r.ds, maxDs) + '<td class="c-num dim">' + fmt(r.bP) + '</td><td class="c-num dim">' + fmt(r.sP) + '</td></tr>'; }
      return '<tr class="' + (hit ? 'hit' : '') + '"><td class="name">' + nmSpan(r.name) + badgeHtml(tierIdxOf(r.b)) + '</td>' + sqCell(r) + '<td class="c-num">' + fmt(r.b) + '</td><td class="c-num">' + fmt(r.s) + '</td></tr>';
    }).join('');
    setCount(filtered.length, rows.length, q);
  }
  function setCount(shown, total, q) {
    const el = document.getElementById('count');
    if (isSquad()) { el.innerHTML = '<b>' + SQUAD_ORDER.length + '</b> 分隊 ・ 全' + latest.data.length + '名（' + latest.label + '）'; return; }
    const suff = squadFilter !== 'all' ? '（' + squadFilter + '）' : '';
    el.innerHTML = q ? '「' + esc(q) + '」で <b>' + shown + '</b> 件' + suff : '<b>' + shown + '</b> 名を表示' + suff;
  }

  document.getElementById('seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v === 'week' ? weekSel : b.dataset.v; const def = sortsFor()[0]; sortKey = def.key; sortDir = def.dir; buildSeg(); buildWkChips(); buildChips(); buildSqFilter(); applyView(); render(); });
  document.getElementById('wkchips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; view = weekSel = c.dataset.w; const def = sortsFor()[0]; sortKey = def.key; sortDir = def.dir; buildSeg(); buildWkChips(); buildChips(); applyView(); render(); });
  document.getElementById('chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; const k = c.dataset.k; if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = parseInt(c.dataset.d); } buildChips(); render(); });
  document.getElementById('sqfilter').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; squadFilter = c.dataset.s; buildSqFilter(); render(); });
  document.getElementById('thead').addEventListener('click', e => { const th = e.target.closest('th'); if (!th || !th.dataset.k) return; const k = th.dataset.k; if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = -1; } buildChips(); render(); });
  const q = document.getElementById('q'), qx = document.getElementById('qx');
  q.addEventListener('input', () => { qx.style.display = q.value ? 'block' : 'none'; render(); });
  qx.addEventListener('click', () => { q.value = ''; qx.style.display = 'none'; render(); q.focus(); });

  // ================= グラフ =================
  const GOLD = '#d6b25c', JADE = '#79c39a', PAPER = '#ece2cd', MUTED = '#a8997c', GLINE = 'rgba(160,140,100,.14)';
  const SQCOL = { '成龍': '#d6b25c', '八宝菜': '#79c39a', '奇兵隊': '#dd6e5a', '剣ぱ': '#7aa2d6', '煽り紳士': '#c58fd0', '浪子': '#e0a45c', 'べぽ': '#6fc3c0' };
  const weekLabels = WEEKS.map(w => w.label);
  const gfmt = n => n == null ? '' : n.toLocaleString('ja-JP');
  const allianceSeries = (m, avg) => WEEKS.map(w => { const t = w.data.reduce((a, r) => a + (m === 's' ? r.s : r.b), 0); return avg ? Math.round(t / w.data.length) : t; });
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

  let graphInit = false, sqChart, meChart, alSChart, alBChart, chartDefaultsSet = false;
  function ensureChartDefaults() {
    if (chartDefaultsSet) return; chartDefaultsSet = true;
    Chart.defaults.color = MUTED; Chart.defaults.font.family = '"Noto Sans JP",sans-serif'; Chart.defaults.font.size = 11;
  }
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
    ensureChartDefaults();
    drawAlliance();
    document.getElementById('al_agg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;[...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b)); drawAlliance(); });
    drawSquad();
    // member select
    const sel = document.getElementById('msel');
    const mnames = latest.data.map(r => r.name);
    sel.innerHTML = mnames.map(n => '<option>' + esc(n) + '</option>').join('');
    sel.value = mnames.includes('剣権羽 kenkenpa') ? '剣権羽 kenkenpa' : mnames[0];
    drawMember();
    sel.addEventListener('change', drawMember);
    document.getElementById('sq_metric').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;[...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b)); drawSquad(); });
    document.getElementById('sq_agg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;[...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b)); drawSquad(); });
  }
  function activeToggle(id) { const on = document.querySelector('#' + id + ' button.on'); return on ? on.dataset.v : null; }
  function drawAlliance() {
    const avg = activeToggle('al_agg') === 'avg', ttl = t => ({ legend: { display: false }, tooltip: baseOpts(false).plugins.tooltip, title: { display: true, text: t, color: '#e7cd8a', font: { size: 13, weight: '700' } } });
    if (alSChart) alSChart.destroy(); if (alBChart) alBChart.destroy();
    alSChart = new Chart(document.getElementById('c_alS'), {
      type: 'line', data: { labels: weekLabels, datasets: [lineDS(avg ? '平均勢力値' : '合計勢力値', allianceSeries('s', avg), GOLD)] },
      options: Object.assign(baseOpts(false), { plugins: ttl(avg ? '平均勢力値' : '合計勢力値') })
    });
    alBChart = new Chart(document.getElementById('c_alB'), {
      type: 'bar', data: { labels: weekLabels, datasets: [{ label: avg ? '平均武勲' : '合計武勲', data: allianceSeries('b', avg), backgroundColor: 'rgba(214,178,92,.85)', borderColor: GOLD }] },
      options: Object.assign(baseOpts(false), { plugins: ttl(avg ? '平均武勲（週ごと）' : '合計武勲（週ごと）') })
    });
  }
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

  // ================= 表彰 =================
  let awardWi = PLAY.length ? PLAY[PLAY.length - 1].idx : 0;
  function awardCards(wi) {
    const cur = WEEKS[wi], pv = wi > 0 ? WEEKS[wi - 1] : null, pvPlay = !!(pv && pv.play);
    const rows = cur.data.map(r => {
      const p = pv ? pv.map.get(r.name) : null;
      return { name: r.name, b: r.b, s: r.s, isNew: !!pv && !p, db: p ? r.b - p.b : null, ds: p ? r.s - p.s : null, dr: (p && pvPlay) ? pv.rankB.get(r.name) - cur.rankB.get(r.name) : null };
    });
    const pick = (list, key) => {
      const L = list.filter(r => r[key] != null && r[key] > 0);
      return L.map(r => ({ r, rank: 1 + L.filter(o => o[key] > r[key]).length })).filter(x => x.rank <= 3).sort((a, b) => a.rank - b.rank).slice(0, 5);
    };
    const cards = [];
    const add = (title, desc, list, key, vf) => { const it = pick(list, key); if (it.length) cards.push({ title, desc, items: it.map(x => ({ name: x.r.name, rank: x.rank, val: vf(x.r), badge: '', tl: '' })) }); };
    add('武勲王', 'この週の武勲トップ', rows, 'b', r => fmtW(r.b));
    add('勢力値王', 'この週の勢力値トップ', rows, 's', r => fmt(r.s));
    if (pvPlay) add('武勲の伸び王', '前の週からの武勲の増加が最大', rows, 'db', r => '+' + fmtW(r.db));
    if (pv) add('勢力値の伸び王', '前の週からの勢力値の増加が最大', rows, 'ds', r => '+' + fmt(r.ds));
    if (pvPlay) add('順位ジャンプ賞', '武勲順位の上昇幅が最大', rows, 'dr', r => '▲' + r.dr + '位');
    if (pvPlay) add('新加入の奮闘賞', 'この週に加入したメンバーで武勲が最大', rows.filter(r => r.isNew), 'b', r => fmtW(r.b));
    const maxPrev = n => { let m = -1; for (let i = 0; i < wi; i++) { const x = WEEKS[i].map.get(n); if (x) m = Math.max(m, tierIdxOf(x.b)); } return m; };
    const got = rows.map(r => ({ r, t: tierIdxOf(r.b) })).filter(x => x.t >= 0 && x.t > maxPrev(x.r.name)).sort((a, b) => b.t - a.t || b.r.b - a.r.b);
    if (got.length) cards.push({ title: '新バッジ獲得', desc: 'この週にはじめてその段階へ到達', items: got.slice(0, 12).map(x => ({ name: x.r.name, rank: 0, val: fmtW(x.r.b), badge: badgeHtml(x.t), tl: BADGE_TIERS[x.t].label })), more: Math.max(0, got.length - 12) });
    return cards;
  }
  const cardHtml = c => '<section class="acard"><h3>' + c.title + '</h3><div class="ad">' + c.desc + '</div><ol>' +
    c.items.map((it, i) => '<li class="' + (i === 0 ? 'first' : '') + '">' + (it.rank ? rankPill(it.rank) : '') + '<span class="who">' + nmSpan(it.name) + it.badge + '</span><span class="val">' + it.val + '</span></li>').join('') +
    '</ol>' + (c.more ? '<div class="more">ほか ' + c.more + '名</div>' : '') + '</section>';
  function renderAwards() {
    const wrap = document.getElementById('awardView');
    if (!PLAY.length) { wrap.innerHTML = '<div class="empty">表彰はまだありません</div>'; return; }
    const cards = awardCards(awardWi);
    const opts = [...PLAY].reverse().map(w => '<option value="' + w.idx + '"' + (w.idx === awardWi ? ' selected' : '') + '>' + w.label + '</option>').join('');
    wrap.innerHTML = '<div class="ahead"><span class="lbl">対象の週</span><select class="sel" id="awsel">' + opts + '</select><span class="grow"></span><button class="btn" id="awcopy" type="button">結果をコピー</button></div>' +
      (cards.length ? '<div class="agrid">' + cards.map(cardHtml).join('') + '</div>' : '<div class="empty">この週の表彰データがありません</div>');
  }
  function awardText(wi) {
    return '【ゆんぱーく ' + WEEKS[wi].label + ' 今週の表彰】\n' + awardCards(wi).map(c => '■' + c.title + '\n' + c.items.map(it => (it.rank ? it.rank + '位 ' : '') + it.name + (it.tl ? ' ★' + it.tl : '') + '  ' + it.val).join('\n')).join('\n\n');
  }
  function copyText(t, btn) {
    const done = () => { const o = btn.textContent; btn.textContent = 'コピーしました'; setTimeout(() => { btn.textContent = o; }, 1600); };
    const fb = () => { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { } document.body.removeChild(ta); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fb); else fb();
  }
  const awardView = document.getElementById('awardView');
  awardView.addEventListener('change', e => { if (e.target.id === 'awsel') { awardWi = parseInt(e.target.value, 10); renderAwards(); } });
  awardView.addEventListener('click', e => { const b = e.target.closest('#awcopy'); if (b) copyText(awardText(awardWi), b); });

  // ================= 個人ページ =================
  const pm = document.getElementById('pm'), pmBody = document.getElementById('pmBody'), pmBox = document.getElementById('pmBox');
  let pmCharts = [];
  const personNames = [...latest.data.map(r => r.name), ...[...AGG.keys()].filter(n => !latest.map.has(n))];
  const tablet = (k, v, sub, c) => '<div class="tablet ' + (c || '') + '"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + (sub || '&nbsp;') + '</div></div>';
  function personHtml(name) {
    const per = WEEKS.map(w => w.map.get(name) || null);
    let li = -1; per.forEach((r, i) => { if (r) li = i; });
    const a = AGG.get(name), w = WEEKS[li], r = per[li], pr = li > 0 ? per[li - 1] : null, pw = li > 0 ? WEEKS[li - 1] : null;
    const state = li === WEEKS.length - 1 ? '在籍中' : '脱退（' + w.label + ' まで）';
    const sq = HAS_SQUADS && SQUADS[name] ? '<span class="sq">' + esc(SQUADS[name]) + '</span> ・ ' : '';
    const dB = (pr && pw.play && w.play) ? r.b - pr.b : null, dS = pr ? r.s - pr.s : null;
    const cls = v => v == null ? '' : (v > 0 ? 'new' : (v < 0 ? 'left' : ''));
    const stats = [
      tablet('武勲 ' + w.label, w.play ? fmt(r.b) : '—', w.play ? w.rankB.get(name) + '位 / ' + w.data.length + '名' : ''),
      tablet('勢力値', fmt(r.s), w.rankS.get(name) + '位 / ' + w.data.length + '名'),
      tablet('武勲 前週比', signed(dB, fmt), pw ? pw.label + ' から' : '', cls(dB)),
      tablet('勢力値 前週比', signed(dS, fmt), pw ? pw.label + ' から' : '', cls(dS)),
      tablet('通算武勲', a && a.cnt ? fmt(a.tot) : '—', a && a.cnt ? a.trank + '位 / ' + totalList.length + '名（' + a.cnt + '週）' : ''),
      tablet('最高週の武勲', a && a.cnt ? fmt(a.best) : '—', a && a.cnt ? a.bestLabel : '')
    ].join('');
    const earned = per.map((x, i) => (x && WEEKS[i].play && tierIdxOf(x.b) >= 0) ? { label: WEEKS[i].label, t: tierIdxOf(x.b) } : null).filter(Boolean);
    const nt = a ? BADGE_TIERS[a.tierIdx + 1] : null;
    const next = !a || !a.cnt ? '' : nt ? '次の ★' + nt.label + ' まで、最高週からあと ' + fmt(nt.min - a.best) : '全バッジ獲得！';
    const opts = personNames.map(n => '<option value="' + encodeURIComponent(n) + '"' + (n === name ? ' selected' : '') + '>' + esc(n) + (latest.map.has(n) ? '' : '（脱退）') + '</option>').join('');
    return '<div class="pmhead"><div class="pmt"><div class="pmn">' + esc(name) + '</div><div class="pms">' + sq + state + (a ? badgeHtml(a.tierIdx) : '') + '</div></div><select class="sel" id="pmsel">' + opts + '</select></div>' +
      '<div class="pmstats">' + stats + '</div>' +
      '<div class="pmbdg"><span class="lbl">獲得バッジ</span>' + (earned.length ? earned.map(e => '<span class="pmb"><i>' + e.label + '</i>' + badgeHtml(e.t) + '</span>').join('') : '<span class="dim">まだありません</span>') + (next ? '<div class="pmnext">' + next + '</div>' : '') + '</div>' +
      '<div class="pmcard"><h4>勢力値と武勲の推移</h4><div class="chartbox sm"><canvas id="c_pm1"></canvas></div></div>' +
      '<div class="pmcard"><h4>順位の推移</h4><div class="ad">数字が小さいほど上位</div><div class="chartbox sm"><canvas id="c_pm2"></canvas></div></div>';
  }
  function drawPersonCharts(name) {
    ensureChartDefaults();
    const per = WEEKS.map(w => w.map.get(name) || null);
    pmCharts.push(new Chart(document.getElementById('c_pm1'), {
      type: 'line',
      data: { labels: weekLabels, datasets: [lineDS('勢力値', per.map(x => x ? x.s : null), GOLD, { yAxisID: 'y' }), lineDS('武勲', per.map((x, i) => x && WEEKS[i].play ? x.b : null), JADE, { yAxisID: 'y1' })] },
      options: baseOpts(true)
    }));
    const o2 = baseOpts(false);
    o2.scales.y = { reverse: true, min: 1, grid: { color: GLINE }, ticks: { color: MUTED, precision: 0, callback: v => Number.isInteger(v) ? v + '位' : '' } };
    o2.plugins.tooltip.callbacks.label = c => ' ' + c.dataset.label + ': ' + c.parsed.y + '位';
    pmCharts.push(new Chart(document.getElementById('c_pm2'), {
      type: 'line',
      data: { labels: weekLabels, datasets: [lineDS('武勲順位', per.map((x, i) => x && WEEKS[i].play ? WEEKS[i].rankB.get(name) : null), JADE), lineDS('勢力値順位', per.map((x, i) => x ? WEEKS[i].rankS.get(name) : null), GOLD)] },
      options: o2
    }));
  }
  function destroyPmCharts() { pmCharts.forEach(c => c.destroy()); pmCharts = []; }
  function openPerson(name) {
    if (!AGG.has(name)) return;
    destroyPmCharts();
    pmBody.innerHTML = personHtml(name);
    pm.hidden = false; document.body.classList.add('modal-open'); pmBox.scrollTop = 0;
    drawPersonCharts(name);
    try { history.replaceState(null, '', '#m=' + encodeURIComponent(name)); } catch (e) { }
  }
  function closePerson() {
    destroyPmCharts(); pm.hidden = true; document.body.classList.remove('modal-open');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  }
  document.addEventListener('click', e => { const el = e.target.closest('[data-name]'); if (el) openPerson(decodeURIComponent(el.dataset.name)); });
  pmBody.addEventListener('change', e => { if (e.target.id === 'pmsel') openPerson(decodeURIComponent(e.target.value)); });
  document.getElementById('pmx').addEventListener('click', closePerson);
  pm.addEventListener('click', e => { if (e.target === pm) closePerson(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pm.hidden) closePerson(); });

  // ---- init ----
  const sqCard = document.getElementById('sqCard');
  if (sqCard) sqCard.style.display = HAS_SQUADS ? '' : 'none';
  document.getElementById('tnote').innerHTML += ' <b>バッジ：</b>1週間の武勲が ' + BADGE_TIERS.map(t => '★' + t.label).join('・') + ' に届くと付きます（このページでは今シーズンの最高、各週のタブではその週の到達）。名前をタップすると個人ページが開きます。';
  buildSeg(); buildWkChips(); buildChips(); buildSqFilter(); applyView(); render();
  const hm = /^#m=(.+)$/.exec(location.hash);
  if (hm) { try { openPerson(decodeURIComponent(hm[1])); } catch (e) { } }
})();
