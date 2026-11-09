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
    if (graph) { if (!graphInit) ycLoading(1100, true); initGraphs(); }
    if (award) renderAwards();
    updateShareBtn();
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
    if (!filtered.length) { tb.innerHTML = '<tr><td class="empty" colspan="' + cols.length + '">該当するデータがありません</td></tr>'; setCount(0, rows.length, q); if (q) ycNoHit(); return; }
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

  document.getElementById('seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ycLoading(1000); view = b.dataset.v === 'week' ? weekSel : b.dataset.v; const def = sortsFor()[0]; sortKey = def.key; sortDir = def.dir; buildSeg(); buildWkChips(); buildChips(); buildSqFilter(); applyView(); render(); });
  document.getElementById('wkchips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; view = weekSel = c.dataset.w; const def = sortsFor()[0]; sortKey = def.key; sortDir = def.dir; buildSeg(); buildWkChips(); buildChips(); applyView(); render(); });
  document.getElementById('chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; const k = c.dataset.k; if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = parseInt(c.dataset.d); } buildChips(); render(); });
  document.getElementById('sqfilter').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; squadFilter = c.dataset.s; buildSqFilter(); render(); });
  document.getElementById('thead').addEventListener('click', e => { const th = e.target.closest('th'); if (!th || !th.dataset.k) return; const k = th.dataset.k; if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = -1; } buildChips(); render(); });
  const q = document.getElementById('q'), qx = document.getElementById('qx');
  q.addEventListener('input', () => { qx.style.display = q.value ? 'block' : 'none'; render(); });
  qx.addEventListener('click', () => { q.value = ''; qx.style.display = 'none'; render(); q.focus(); });

  // ================= グラフ =================
  let YUNA, GOLD, JADE, PAPER, MUTED, GLINE, SQCOL;
  function setPalette() {
    YUNA = document.documentElement.classList.contains('yuna');
    GOLD = YUNA ? '#ff5fa2' : '#d6b25c'; JADE = YUNA ? '#13b38a' : '#79c39a'; PAPER = YUNA ? '#5a2744' : '#ece2cd';
    MUTED = YUNA ? '#a8688a' : '#a8997c'; GLINE = YUNA ? 'rgba(255,111,174,.18)' : 'rgba(160,140,100,.14)';
    SQCOL = YUNA
      ? { 'べぽ': '#ff5fa2', '煽り紳士': '#9b7bff', '奇兵隊': '#ff8a5c', '春うらら': '#4fd1ab', '成龍': '#ffb703', '剣ぱーく': '#4aa8ff', '鬼軍団': '#c04fd1' }
      : { 'べぽ': '#6fc3c0', '煽り紳士': '#c58fd0', '奇兵隊': '#dd6e5a', '春うらら': '#79c39a', '成龍': '#d6b25c', '剣ぱーく': '#7aa2d6', '鬼軍団': '#e0a45c' };
  }
  setPalette();
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
    Chart.defaults.color = MUTED; Chart.defaults.font.family = YUNA ? '"Zen Maru Gothic",sans-serif' : '"Noto Sans JP",sans-serif'; Chart.defaults.font.size = 11;
  }
  const gridX = () => ({ grid: { color: GLINE }, ticks: { color: MUTED } });
  const gridY = () => ({ grid: { color: GLINE }, ticks: { color: MUTED, callback: v => v >= 10000 ? (v / 10000) + '万' : v } });
  function baseOpts(dual) {
    return {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { usePointStyle: true, boxWidth: 8, padding: 12, color: PAPER } },
        tooltip: { backgroundColor: YUNA ? '#fff' : '#26201a', borderColor: YUNA ? '#ffb8d4' : '#4a3d2c', borderWidth: 1, titleColor: GOLD, bodyColor: PAPER, padding: 10, callbacks: { label: c => ' ' + c.dataset.label + ': ' + gfmt(c.parsed.y) } }
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
    const avg = activeToggle('al_agg') === 'avg', ttl = t => ({ legend: { display: false }, tooltip: baseOpts(false).plugins.tooltip, title: { display: true, text: t, color: YUNA ? '#d6337f' : '#e7cd8a', font: { size: 13, weight: '700' } } });
    if (alSChart) alSChart.destroy(); if (alBChart) alBChart.destroy();
    alSChart = new Chart(document.getElementById('c_alS'), {
      type: 'line', data: { labels: weekLabels, datasets: [lineDS(avg ? '平均勢力値' : '合計勢力値', allianceSeries('s', avg), GOLD)] },
      options: Object.assign(baseOpts(false), { plugins: ttl(avg ? '平均勢力値' : '合計勢力値') })
    });
    alBChart = new Chart(document.getElementById('c_alB'), {
      type: 'bar', data: { labels: weekLabels, datasets: [{ label: avg ? '平均武勲' : '合計武勲', data: allianceSeries('b', avg), backgroundColor: YUNA ? 'rgba(255,111,174,.85)' : 'rgba(214,178,92,.85)', borderColor: GOLD }] },
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
    ycLoading(700); drawPersonCharts(name); ycUpdate(); ycPerson(name);
    try { history.replaceState(null, '', '#m=' + encodeURIComponent(name)); } catch (e) { }
  }
  function closePerson() {
    destroyPmCharts(); pm.hidden = true; document.body.classList.remove('modal-open'); ycUpdate();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  }
  document.addEventListener('click', e => { const el = e.target.closest('[data-name]'); if (el) openPerson(decodeURIComponent(el.dataset.name)); });
  pmBody.addEventListener('change', e => { if (e.target.id === 'pmsel') openPerson(decodeURIComponent(e.target.value)); });
  document.getElementById('pmx').addEventListener('click', closePerson);
  pm.addEventListener('click', e => { if (e.target === pm) closePerson(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pm.hidden) closePerson(); });

  // ================= 画像で共有（武勲TOP10）=================
  const SH_W = 1080, SH_H = 1350;
  const SH_THEME = {
    dark: {
      title: '900 56px "Noto Serif JP",serif', big: '900 46px "Noto Serif JP",serif', name: '700 38px "Noto Sans JP",sans-serif', nameTop: '900 44px "Noto Sans JP",sans-serif', sub: '700 22px "Noto Sans JP",sans-serif', val: '900 46px "Noto Serif JP",serif', small: '500 21px "Noto Sans JP",sans-serif',
      ink: '#ece2cd', ink1: '#f3dc9b', kick: '#9f8340', title_c: '#e7cd8a', muted: '#a8997c', foot: '#8c7f66', footb: '#d6b25c', val_c: '#e7cd8a', sq: '#9f8340', row: '#2f261a', frame: '#4a3d2c', frame2: '#2e2518', track: '#2a2116', bar: ['#9f8340', '#e7cd8a'], hi: 'rgba(214,178,92,.10)', logoBd: '#4a3d2c',
      medal: [['#f0d68a', '#c69f45', '#1c1608'], ['#e0e0e6', '#a9a9b2', '#17130d'], ['#dcae7f', '#b07b48', '#17130d']], medal0: ['#00000000', '#4a3d2c', '#a8997c'],
      tier: [['#e0b48a', '#8a5f38', 'rgba(176,123,72,.16)'], ['#dcdce2', '#8b8b95', 'rgba(169,169,178,.14)'], ['#f0d68a', '#c69f45', 'rgba(198,159,69,.2)'], ['#ffd9cf', '#dd6e5a', 'rgba(221,110,90,.3)']]
    },
    yuna: {
      title: '400 54px "Mochiy Pop One","Zen Maru Gothic",sans-serif', big: '400 44px "Mochiy Pop One","Zen Maru Gothic",sans-serif', name: '700 38px "Zen Maru Gothic",sans-serif', nameTop: '700 44px "Zen Maru Gothic",sans-serif', sub: '700 22px "Zen Maru Gothic",sans-serif', val: '400 42px "Mochiy Pop One","Zen Maru Gothic",sans-serif', small: '500 21px "Zen Maru Gothic",sans-serif',
      ink: '#5a2744', ink1: '#d6337f', kick: '#ff6fae', title_c: '#ff4f9a', muted: '#b8709a', foot: '#b8709a', footb: '#d6337f', val_c: '#d6337f', sq: '#d6609a', row: '#ffd0e3', frame: '#ff9cc7', frame2: '#ffd0e3', track: '#ffe3ef', bar: ['#ff8fc0', '#ff4f9a'], hi: 'rgba(255,143,191,.22)', logoBd: '#ffffff',
      medal: [['#ffe58a', '#ffc531', '#6a4300'], ['#eceaf7', '#c6c2e3', '#4c4a63'], ['#ffd0b0', '#ffa77a', '#6a3318']], medal0: ['#ffffff', '#ffc6dd', '#c4568a'],
      tier: [['#b3541f', '#ffb590', '#ffeadd'], ['#5b5d86', '#c7c9ea', '#eef0ff'], ['#8a5a00', '#ffc531', '#fff1bd'], ['#ffffff', '#ff4f9a', '#ff6fae']]
    }
  };
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  const top10Of = w => w.data.slice().sort((p, q) => q.b - p.b).filter(r => w.rankB.get(r.name) <= 10).slice(0, 10);
  const shareWeek = () => isWeek() ? activeWeek() : (isTrend() ? latest : null);
  async function drawShare(w, yuna) {
    const T = SH_THEME[yuna ? 'yuna' : 'dark'], rows = top10Of(w), max = rows[0].b;
    const cv = document.createElement('canvas'); cv.width = SH_W; cv.height = SH_H; const c = cv.getContext('2d');
    const sample = rows.map(r => r.name).join('') + 'ゆんぱーく同盟武勲記録ランキングTOP10全名平均Season5〜★万剣奇兵隊べぽ煽り紳士春うらら成龍鬼軍団0123456789.';
    try { await Promise.all([T.title, T.big, T.name, T.nameTop, T.sub, T.val, T.small].map(f => document.fonts.load(f, sample))); } catch (e) { }
    const [logo, tile, chara] = await Promise.all([loadImg('favicon-180.png'), yuna ? loadImg('yuna-bg.png') : null, yuna ? loadImg(ycCur) : null]);
    // 背景
    if (yuna) {
      const g = c.createLinearGradient(0, 0, 0, SH_H); g.addColorStop(0, '#fff3f9'); g.addColorStop(1, '#ffdcec'); c.fillStyle = g; c.fillRect(0, 0, SH_W, SH_H);
      if (tile) { c.fillStyle = c.createPattern(tile, 'repeat'); c.fillRect(0, 0, SH_W, SH_H); }
      c.fillStyle = 'rgba(255,255,255,.78)'; rr(c, 22, 22, SH_W - 44, SH_H - 44, 14); c.fill();
      c.lineWidth = 4; c.strokeStyle = T.frame; c.setLineDash([12, 8]); rr(c, 22, 22, SH_W - 44, SH_H - 44, 14); c.stroke(); c.setLineDash([]);
    } else {
      const g = c.createLinearGradient(0, 0, 0, SH_H); g.addColorStop(0, '#1a140c'); g.addColorStop(1, '#120d07'); c.fillStyle = g; c.fillRect(0, 0, SH_W, SH_H);
      const rg = c.createRadialGradient(540, -80, 0, 540, -80, 560); rg.addColorStop(0, 'rgba(51,39,26,1)'); rg.addColorStop(1, 'rgba(51,39,26,0)'); c.fillStyle = rg; c.fillRect(0, 0, SH_W, 500);
      c.lineWidth = 2; c.strokeStyle = T.frame; rr(c, 22, 22, SH_W - 44, SH_H - 44, 14); c.stroke();
    }
    c.lineWidth = yuna ? 2 : 1; c.strokeStyle = T.frame2; rr(c, 30, 30, SH_W - 60, SH_H - 60, 9); c.stroke();
    // ヘッダー
    if (logo) {
      c.save(); c.translate(118, 110); if (yuna) c.rotate(-5 * Math.PI / 180);
      if (yuna) { c.shadowColor = 'rgba(255,111,174,.45)'; c.shadowBlur = 16; c.shadowOffsetY = 6; }
      rr(c, -48, -48, 96, 96, 22); c.save(); c.clip(); c.drawImage(logo, -48, -48, 96, 96); c.restore();
      c.shadowColor = 'transparent'; c.lineWidth = yuna ? 4 : 2; c.strokeStyle = T.logoBd; rr(c, -48, -48, 96, 96, 22); c.stroke(); c.restore();
    }
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = T.kick; c.font = '700 22px ' + T.sub.split('px ')[1]; if ('letterSpacing' in c) c.letterSpacing = '8px'; c.fillText('ゆんぱーく ・ 同盟武勲記録', 190, 96); if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.font = T.title; c.fillStyle = T.title_c; if (yuna) { c.save(); c.fillStyle = '#fff'; c.fillText('武勲ランキング TOP10', 193, 152); c.restore(); c.fillStyle = T.title_c; } c.fillText('武勲ランキング TOP10', 190, 149);
    c.textAlign = 'right'; c.font = T.big; c.fillStyle = yuna ? '#c42a78' : T.ink; c.fillText(w.label, 1010, 118);
    c.font = '500 20px ' + T.small.split('px ')[1]; c.fillStyle = T.muted; c.fillText('全' + w.data.length + '名', 1010, 152); c.textAlign = 'left';
    // 行
    const top = 196, RH = 100, barX = 165, barEnd = 770;
    rows.forEach((r, i) => {
      const y = top + i * RH, rank = w.rankB.get(r.name);
      if (i < 3) { const g = c.createLinearGradient(70, 0, 1010, 0); g.addColorStop(0, T.hi); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(70, y, 940, RH); }
      c.strokeStyle = T.row; c.lineWidth = yuna ? 2 : 1; if (yuna) c.setLineDash([8, 6]); c.beginPath(); c.moveTo(70, y + RH - 1); c.lineTo(1010, y + RH - 1); c.stroke(); c.setLineDash([]);
      // メダル
      const mx = 80, my = y + 19, ms = 62;
      if (rank <= 3) { const m = T.medal[rank - 1], g = c.createLinearGradient(0, my, 0, my + ms); g.addColorStop(0, m[0]); g.addColorStop(1, m[1]); c.fillStyle = g; rr(c, mx, my, ms, ms, 8); c.fill(); c.fillStyle = m[2]; }
      else { const m = T.medal0; c.fillStyle = m[0]; rr(c, mx, my, ms, ms, 8); c.fill(); c.lineWidth = yuna ? 3 : 2; c.strokeStyle = m[1]; rr(c, mx + 1, my + 1, ms - 2, ms - 2, 8); c.stroke(); c.fillStyle = m[2]; }
      c.font = '900 ' + (rank >= 10 ? 30 : 34) + 'px ' + T.sub.split('px ')[1]; c.textAlign = 'center'; c.fillText(String(rank), mx + ms / 2, my + ms / 2 + 12); c.textAlign = 'left';
      // 名前＋バッジ＋分隊
      const k = tierIdxOf(r.b), sq = SQUADS[r.name] || '', ny = y + 46;
      c.font = '700 22px ' + T.sub.split('px ')[1]; const sqW = sq ? c.measureText(sq).width : 0;
      let bw = 0, bt = ''; if (k >= 0) { bt = '★' + BADGE_TIERS[k].label; c.font = '700 21px ' + T.sub.split('px ')[1]; bw = c.measureText(bt).width + 30 + 12; }
      const maxNameW = barEnd - barX - bw - sqW - 24;
      let px = i === 0 ? 44 : 38; const fam = T.name.split('px ')[1], wt = i === 0 ? '900' : '700';
      c.font = (yuna ? '700' : wt) + ' ' + px + 'px ' + fam; while (c.measureText(r.name).width > maxNameW && px > 22) { px -= 2; c.font = (yuna ? '700' : wt) + ' ' + px + 'px ' + fam; }
      let nm = r.name; if (c.measureText(nm).width > maxNameW) { while (nm.length > 1 && c.measureText(nm + '…').width > maxNameW) nm = nm.slice(0, -1); nm += '…'; }
      c.fillStyle = i === 0 ? T.ink1 : T.ink; c.fillText(nm, barX, ny); const nw = c.measureText(nm).width;
      if (k >= 0) { const tc = T.tier[k], bx = barX + nw + 12, bh = 32, by = ny - 28; c.font = '700 21px ' + T.sub.split('px ')[1];
        if (yuna && k === 3) { const g = c.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#ff8fc0'); g.addColorStop(1, '#ff4f9a'); c.fillStyle = g; } else c.fillStyle = tc[2];
        rr(c, bx, by, bw - 12, bh, 16); c.fill(); c.lineWidth = 2; c.strokeStyle = tc[1]; rr(c, bx, by, bw - 12, bh, 16); c.stroke(); c.fillStyle = tc[0]; c.textAlign = 'center'; c.fillText(bt, bx + (bw - 12) / 2, by + 23); c.textAlign = 'left'; }
      if (sq) { c.font = '700 22px ' + T.sub.split('px ')[1]; c.fillStyle = T.sq; c.textAlign = 'right'; c.fillText(sq, barEnd - 10, ny - 4); c.textAlign = 'left'; }
      // バー
      const by2 = y + 64; c.fillStyle = T.track; rr(c, barX, by2, barEnd - barX, 10, 5); c.fill();
      const g = c.createLinearGradient(barX, 0, barEnd, 0); g.addColorStop(0, T.bar[0]); g.addColorStop(1, T.bar[1]); c.fillStyle = g; rr(c, barX, by2, Math.max(10, (barEnd - barX) * r.b / max), 10, 5); c.fill();
      // 武勲
      c.font = T.val; c.fillStyle = T.val_c; c.textAlign = 'right'; c.fillText(fmtW(r.b), 1000, y + 66); c.textAlign = 'left';
    });
    // フッター
    c.strokeStyle = yuna ? '#ffc6dd' : '#3b3125'; c.lineWidth = yuna ? 3 : 1; if (yuna) c.setLineDash([10, 7]); c.beginPath(); c.moveTo(70, 1246); c.lineTo(1010, 1246); c.stroke(); c.setLineDash([]);
    if (yuna && chara) { const k = Math.min(230 / chara.width, 146 / chara.height), dw = Math.round(chara.width * k), dh = Math.round(chara.height * k); c.drawImage(chara, 560 - Math.round(dw / 2), 1332 - dh, dw, dh); }
    c.font = T.small; c.fillStyle = T.foot; c.fillText('同盟平均武勲 ', 70, 1292); const lw = c.measureText('同盟平均武勲 ').width;
    c.font = '700 ' + T.small.split(' ').slice(1).join(' '); c.fillStyle = T.footb; c.fillText((Math.round(avgOf(w, 'b') / 1000) / 10).toLocaleString('ja-JP') + '万', 70 + lw, 1292);
    c.font = T.small; c.fillStyle = T.foot; c.textAlign = 'right'; c.fillText('Season 5 ・ ゆんぱーく', 1010, 1292); c.textAlign = 'left';
    return cv;
  }
  async function shareTop10(btn) {
    const w = shareWeek(); if (!w || !w.play) return;
    const label = btn.textContent, t0 = Date.now(); btn.disabled = true; btn.textContent = '画像を作っています…'; ycLoading(9000, true);
    try {
      const cv = await drawShare(w, YUNA); setTimeout(ycLoadHide, Math.max(0, 700 - (Date.now() - t0)));
      const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
      const fname = 'yunpark_' + w.label.replace('〜', '').replace('/', '-') + '_TOP10.png';
      const file = new File([blob], fname, { type: 'image/png' });
      const touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
      if (touch && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'ゆんぱーく ' + w.label + ' 武勲TOP10' }); btn.textContent = label; btn.disabled = false; return; } catch (e) { if (e && e.name === 'AbortError') { btn.textContent = label; btn.disabled = false; return; } } }
      const u = URL.createObjectURL(blob), el = document.createElement('a'); el.href = u; el.download = fname; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
      btn.textContent = '保存しました ✓';
    } catch (e) { ycLoadHide(); btn.textContent = '作れませんでした'; }
    setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 1800);
  }
  function updateShareBtn() {
    const w = shareWeek(), bar = document.getElementById('sharebar');
    bar.style.display = (w && w.play) ? 'flex' : 'none';
  }
  document.getElementById('sharebtn').addEventListener('click', e => shareTop10(e.currentTarget));

  // ================= ゆなっこちゃん（ゆなっこモード専用）=================
  const yc = document.getElementById('yc'), ycIn = document.getElementById('ycin'), ycB = document.getElementById('ycb');
  const YC_H = 124, reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AV = '20261109b', YC_PEEK = ['yuna-chara1.webp?v=' + AV, 'yuna-chara2.webp?v=' + AV], ycImg = document.getElementById('ycimg'), ycLd = document.getElementById('ycload');
  YC_PEEK.concat(['yuna-load.webp?v=' + AV]).forEach(s => { const im = new Image(); im.src = s; });
  let ycCur = YC_PEEK[0], ycWasOn = false, ycLoadT = 0, ycLoadLast = 0, ycTimer = 0, ycFlying = false, ycTaps = 0, ycTapT = 0, ycLast = '', ycTemp = 0;
  const ycLw = PLAY.length ? PLAY[PLAY.length - 1] : null;
  // ボイス: セリフ → 音声ファイル。録音が増えたら、ここに1行足してファイルを voice/ に置く
  const YC_VOICE = { '今日もおつかれさま♡': 'voice/otsukare.mp3' };
  let ycVoiceOn = true, ycAudio = null; // 初期はオン（自分でオフにした人だけオフ）
  try { if (localStorage.getItem('yc_voice') === 'off') ycVoiceOn = false; } catch (e) { }
  const ycSnd = document.getElementById('ycsnd');
  function ycSndPaint() { ycSnd.textContent = ycVoiceOn ? '🔊' : '🔇'; ycSnd.setAttribute('aria-pressed', ycVoiceOn ? 'true' : 'false'); ycSnd.title = ycVoiceOn ? 'ボイス：オン' : 'ボイス：オフ'; }
  function ycPlay(msg) {
    if (!ycVoiceOn || !YC_VOICE[msg]) return;
    try { if (ycAudio) ycAudio.pause(); ycAudio = new Audio(YC_VOICE[msg] + '?v=' + AV); const p = ycAudio.play(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
  }
  ycSndPaint();
  ycSnd.addEventListener('click', () => {
    ycVoiceOn = !ycVoiceOn; try { localStorage.setItem('yc_voice', ycVoiceOn ? 'on' : 'off'); } catch (e) { }
    if (!ycVoiceOn && ycAudio) ycAudio.pause();
    ycSndPaint();
    if (ycVoiceOn) ycSay('ボイス、オンにしたよ♡', null, 1800);
  });
  function ycLines() {
    const L = ['今日もおつかれさま♡', 'ちゃんと水分とってる?', 'もっともっと頑張っちゃお〜!', 'えへへ、つっついた?', 'ピンヒールで踏むわよ！'];
    if (ycLw) {
      const t = top10Of(ycLw)[0];
      if (t) L.push('今週の武勲王は' + t.name + 'さんだよ!');
      L.push('同盟の平均武勲は' + (Math.round(avgOf(ycLw, 'b') / 1000) / 10).toLocaleString('ja-JP') + '万!');
    }
    return L;
  }
  function ycSay(msg, mood, ms) {
    if (!YUNA) return;
    ycB.textContent = msg; ycB.classList.add('show'); ycLast = msg; ycPlay(msg);
    clearTimeout(ycTimer); ycTimer = setTimeout(() => ycB.classList.remove('show'), ms || 3400);
    if (mood) { yc.classList.remove('sad', 'cheer'); void yc.offsetWidth; yc.classList.add(mood); setTimeout(() => yc.classList.remove(mood), 1500); }
  }
  function ycHearts(n) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span'); s.className = 'yc-h'; s.textContent = ['♥', '✦', '♥', '✿'][i % 4];
      s.style.setProperty('--dx', (Math.random() * 90 - 70) + 'px'); s.style.setProperty('--dy', (-40 - Math.random() * 70) + 'px'); s.style.animationDelay = (i * 60) + 'ms';
      ycIn.appendChild(s); setTimeout(() => s.remove(), 1500 + i * 60);
    }
  }
  function ycConfetti() {
    const cols = ['#ff6fae', '#ffb703', '#9b7bff', '#4fd1ab', '#ff8a5c', '#4aa8ff'];
    for (let i = 0; i < 46; i++) {
      const s = document.createElement('span'); s.className = 'yc-cf'; s.style.left = (Math.random() * 100) + 'vw'; s.style.background = cols[i % cols.length];
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's'; s.style.animationDelay = (Math.random() * 0.5) + 's'; s.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(s); setTimeout(() => s.remove(), 3600);
    }
  }
  // yuna.css が古いまま（キャッシュ等）だと見た目が崩れるため、新しいCSSが読めているときだけ表示する
  const ycCssOk = () => !!getComputedStyle(document.documentElement).getPropertyValue('--yc-ok').trim();
  function ycLoading(ms, force) {
    if (!YUNA || !ycCssOk()) return; const now = Date.now(); if (!force && now - ycLoadLast < 2200) return;
    ycLoadLast = now; ycLd.classList.add('show'); clearTimeout(ycLoadT); ycLoadT = setTimeout(ycLoadHide, ms || 1000);
  }
  function ycLoadHide() { clearTimeout(ycLoadT); ycLd.classList.remove('show'); }
  function ycUpdate() {
    if (!YUNA || !ycCssOk()) { yc.classList.remove('on'); yc.hidden = true; return; }
    yc.hidden = false;
    const y = window.scrollY, vh = window.innerHeight, max = Math.max(1, document.documentElement.scrollHeight - vh), p = Math.min(1, y / max);
    const modal = !pm.hidden, show = y > 240 || ycTemp > Date.now() || modal;
    if (show && !ycWasOn) { const o = YC_PEEK.filter(s => s !== ycCur); ycCur = o[Math.floor(Math.random() * o.length)]; ycImg.src = ycCur; }
    ycWasOn = show; yc.classList.toggle('on', show);
    yc.classList.toggle('end', p > .97 && y > 240);
  }
  function ycToTop() {
    if (ycFlying) return;
    ycSay('いってきまーす♡', null, 1400); ycHearts(8);
    if (reduceMotion()) { window.scrollTo(0, 0); return; }
    ycFlying = true; yc.classList.add('fly'); window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { ycFlying = false; yc.classList.remove('fly'); ycUpdate(); }, 950);
  }
  function ycTalk() {
    ycTaps++; clearTimeout(ycTapT); ycTapT = setTimeout(() => { ycTaps = 0; }, 1800);
    if (ycTaps >= 10) { ycTaps = 0; ycConfetti(); ycHearts(10); ycSay('わーい！ありがとう♡', 'cheer', 3000); return; }
    const L = ycLines().filter(t => t !== ycLast); ycSay(L[Math.floor(Math.random() * L.length)]); ycHearts(2);
  }
  function ycPerson(name) {
    const a = AGG.get(name); if (!YUNA || !a || a.tierIdx < 0) return;
    ycSay(name + 'さん、★' + BADGE_TIERS[a.tierIdx].label + 'おめでとう!', 'cheer', 4200); ycHearts(5);
  }
  function ycNoHit() { if (!YUNA) return; ycTemp = Date.now() + 4000; ycUpdate(); if (ycLast !== '見つからないよ〜' || !ycB.classList.contains('show')) ycSay('見つからないよ〜', 'sad', 3600); setTimeout(ycUpdate, 4100); }
  document.getElementById('ycup').addEventListener('click', ycToTop);
  document.getElementById('ycchr').addEventListener('click', ycTalk);
  window.addEventListener('scroll', ycUpdate, { passive: true }); window.addEventListener('resize', ycUpdate);

  // ================= テーマ切替（ゆなっこモード）=================
  (function () {
    const b = document.getElementById('themebtn');
    const paint = () => { b.textContent = YUNA ? '🌙 ダークモード' : '🎀 ゆなっこモード'; };
    paint();
    b.addEventListener('click', () => {
      const on = !document.documentElement.classList.contains('yuna');
      document.documentElement.classList.toggle('yuna', on);
      try { localStorage.setItem('theme', on ? 'yuna' : 'dark'); } catch (e) { }
      setPalette(); paint(); chartDefaultsSet = false; ycUpdate();
      if (graphInit) { ensureChartDefaults(); drawAlliance(); drawSquad(); drawMember(); }
      if (!pm.hidden && /^#m=/.test(location.hash)) { destroyPmCharts(); drawPersonCharts(decodeURIComponent(location.hash.slice(3))); }
    });
  })();
  // ---- init ----
  ycUpdate();
  const sqCard = document.getElementById('sqCard');
  if (sqCard) sqCard.style.display = HAS_SQUADS ? '' : 'none';
  document.getElementById('tnote').innerHTML += ' <b>バッジ：</b>1週間の武勲が ' + BADGE_TIERS.map(t => '★' + t.label).join('・') + ' に届くと付きます（このページでは今シーズンの最高、各週のタブではその週の到達）。名前をタップすると個人ページが開きます。';
  buildSeg(); buildWkChips(); buildChips(); buildSqFilter(); applyView(); render();
  const hm = /^#m=(.+)$/.exec(location.hash);
  if (hm) { try { openPerson(decodeURIComponent(hm[1])); } catch (e) { } }
})();
