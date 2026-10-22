import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Empty, Segmented, Select } from 'antd';

// ───────── 工具 ─────────
// 季度碼 SP27 / FA27 → 排序用 [年, 季]（SP 在 FA 前）；認不得的排最後
function seasonRank(s) {
  const m = String(s).match(/^([A-Z]{2})(\d{2})$/);
  return m ? [2000 + Number(m[2]), m[1] === 'SP' ? 1 : 2] : [9999, 9];
}
const seasonCmp = (a, b) => {
  const A = seasonRank(a), B = seasonRank(b);
  return A[0] - B[0] || A[1] - B[1] || String(a).localeCompare(String(b));
};
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

// 多條線／多組柱用的色票（Tableau 10 的子集，淺色深色底都看得清楚）；單一系列用品牌綠
const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2', '#edc948', '#9c755f'];

// 數值是 0 就當作沒有資料：圖上不畫柱子／點、不標 0，表格顯示「–」
const nz = (v) => (v ? v : null);
const METRICS = {
  pct: { label: '3D 占比（%）', val: (c) => (c.total ? nz(pct(c.d3, c.total)) : null), fmt: (v) => `${v}%` },
  d3: { label: '3D 款數', val: (c) => (c.total ? nz(c.d3) : null), fmt: (v) => String(v) },
  real: { label: '實樣款數', val: (c) => (c.total ? nz(c.total - c.d3) : null), fmt: (v) => String(v) },
  total: { label: '款數（款×階段）', val: (c) => (c.total ? c.total : null), fmt: (v) => String(v) },
};
const DIMS = { season: '季度', brand: '品牌', stage: '階段' };
// 階段排序依開發流程：Mock-up → Proto → Fit → JSS → PP → TOP → Wear Test
const STAGE_ORDER = ['Mock-up', 'Proto', 'Fit', 'JSS', 'PP', 'TOP', 'Wear Test'];
// Jump Size、Size Set 都是 JSS。匯入腳本已合併；這裡再保險一次，舊資料也不會分兩列
const STAGE_ALIAS = { 'Jump Size': 'JSS', 'Size Set': 'JSS' };
const stageRank = (s) => { const i = STAGE_ORDER.indexOf(s); return i < 0 ? 99 : i; };

function niceTicks(max) {
  const raw = Math.max(max, 1) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  const measure = useCallback(() => setW(ref.current?.getBoundingClientRect().width || 0), []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  return [ref, w];
}

const short = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
const AXIS = { fill: 'var(--text-muted)', fontSize: 11 };

// ───────── 圖表（純 SVG，三種：直條／橫條／折線）─────────
function Chart({ type, xs, series, cell, metric, width }) {
  const M = METRICS[metric];
  const multi = series.length > 1;
  const W = width || 800;
  const values = xs.flatMap((x) => series.map((s) => M.val(cell(x.key, s.key)))).filter((v) => v != null);
  const { top, ticks } = metric === 'pct'
    ? { top: 100, ticks: [0, 25, 50, 75, 100] }
    : niceTicks(Math.max(0, ...values));

  const tip = (x, s, c) => `${multi ? `${s.label}・` : ''}${x.label}：${c.d3} / ${c.total} 款 3D（${c.total ? pct(c.d3, c.total) : 0}%）`;

  // ── 橫條 ──
  if (type === 'bar') {
    const labelW = Math.min(150, 14 + Math.max(...xs.map((x) => String(x.label).length)) * 8);
    const m = { l: labelW, r: 70, t: 8, b: 26 };
    const barH = multi ? 14 : 20, gap = 3, groupH = series.length * barH + (series.length - 1) * gap, pad = 14;
    const H = m.t + m.b + xs.length * (groupH + pad);
    const plotW = W - m.l - m.r;
    const sx = (v) => m.l + (plotW * v) / top;
    return (
      <svg width={W} height={H} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={m.t} y2={H - m.b} style={{ stroke: 'var(--border)' }} />
            <text x={sx(t)} y={H - 8} textAnchor="middle" style={AXIS}>{metric === 'pct' ? `${t}%` : t}</text>
          </g>
        ))}
        {xs.map((x, i) => {
          const y0 = m.t + i * (groupH + pad) + pad / 2;
          return (
            <g key={x.key}>
              <text x={m.l - 8} y={y0 + groupH / 2 + 4} textAnchor="end" style={{ ...AXIS, fontSize: 12, fill: 'var(--text)' }}>{short(x.label, 18)}</text>
              {series.map((s, j) => {
                const c = cell(x.key, s.key), v = M.val(c);
                if (v == null) return null;
                const y = y0 + j * (barH + gap);
                return (
                  <g key={s.key}>
                    <title>{tip(x, s, c)}</title>
                    <rect x={m.l} y={y} width={Math.max(sx(v) - m.l, 1)} height={barH} rx={3} style={{ fill: s.color }} />
                    <text x={sx(v) + 6} y={y + barH / 2 + 4} style={{ ...AXIS, fill: 'var(--text)' }}>{M.fmt(v)}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    );
  }

  // ── 直條／折線 ──
  const m = { l: 42, r: 14, t: 18, b: 36 };
  const H = 300, plotW = W - m.l - m.r, plotH = H - m.t - m.b;
  const band = plotW / xs.length;
  const y = (v) => m.t + plotH * (1 - v / top);
  const cx = (i) => m.l + band * i + band / 2;
  const maxLabel = Math.max(4, Math.floor(band / 8));
  const grid = (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--border)' }} />
          <text x={m.l - 6} y={y(t) + 4} textAnchor="end" style={AXIS}>{metric === 'pct' ? `${t}%` : t}</text>
        </g>
      ))}
      {xs.map((x, i) => <text key={x.key} x={cx(i)} y={H - 12} textAnchor="middle" style={{ ...AXIS, fontSize: 12, fill: 'var(--text)' }}>{short(x.label, maxLabel)}</text>)}
    </>
  );

  if (type === 'line') {
    return (
      <svg width={W} height={H} role="img">
        {grid}
        {series.map((s) => {
          let d = '', pen = false;
          xs.forEach((x, i) => {
            const v = M.val(cell(x.key, s.key));
            if (v == null) { pen = false; return; }
            d += `${pen ? 'L' : 'M'}${cx(i)},${y(v)} `; pen = true;
          });
          return (
            <g key={s.key}>
              <path d={d} fill="none" strokeWidth={2.2} strokeLinejoin="round" style={{ stroke: s.color }} />
              {xs.map((x, i) => {
                const c = cell(x.key, s.key), v = M.val(c);
                if (v == null) return null;
                return (
                  <g key={x.key}>
                    <title>{tip(x, s, c)}</title>
                    <circle cx={cx(i)} cy={y(v)} r={4.5} strokeWidth={2} style={{ stroke: s.color, fill: s.color }} />
                    {!multi && <text x={cx(i)} y={y(v) - 10} textAnchor="middle" style={{ ...AXIS, fill: 'var(--text)' }}>{M.fmt(v)}</text>}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    );
  }

  // 直條
  const groupW = Math.min(band * 0.78, series.length * 56);
  const barW = groupW / series.length;
  return (
    <svg width={W} height={H} role="img">
      {grid}
      {xs.map((x, i) => series.map((s, j) => {
        const c = cell(x.key, s.key), v = M.val(c);
        if (v == null) return null;
        const bx = cx(i) - groupW / 2 + j * barW;
        return (
          <g key={`${x.key}${s.key}`}>
            <title>{tip(x, s, c)}</title>
            <rect x={bx + 1} y={y(v)} width={Math.max(barW - 2, 1)} height={Math.max(m.t + plotH - y(v), 1)} rx={3} style={{ fill: s.color }} />
            {barW >= 26 && <text x={bx + barW / 2} y={y(v) - 5} textAnchor="middle" style={{ ...AXIS, fill: 'var(--text)' }}>{M.fmt(v)}</text>}
          </g>
        );
      }))}
    </svg>
  );
}

// ───────── 頁面 ─────────
const PREF_KEY = 'dsg-usage3d-prefs';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; } };

export default function Usage3D({ data }) {
  const rows = data.stage3d || [];
  const saved = useMemo(loadPrefs, []);
  const [chart, setChart] = useState(saved.chart || 'column');   // column / bar / line
  const [metric, setMetric] = useState(saved.metric || 'pct');
  const [xDim, setXDim] = useState(saved.xDim || 'season');
  const [splitDim, setSplitDim] = useState(saved.splitDim || 'none'); // none / season / brand / stage
  // 預設只看 Proto（維持原本的數字）。同一款在不同階段會各算一次，所以多選階段時「款數」是款×階段
  const [stageSel, setStageSel] = useState(saved.stageSel || ['Proto']);
  const [seasonSel, setSeasonSel] = useState(saved.seasonSel || []);
  const [brandSel, setBrandSel] = useState(saved.brandSel || []);
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ chart, metric, xDim, splitDim, seasonSel, brandSel, stageSel })); } catch { /* 無痕模式等情況存不了就算了 */ }
  }, [chart, metric, xDim, splitDim, seasonSel, brandSel, stageSel]);

  const [boxRef, boxW] = useWidth();

  const seasonOf = (r) => r.season || '未分類';
  const brandOf = (r) => r.brand || '未填';
  const stageOf = (r) => STAGE_ALIAS[r.stage] || r.stage || '未填';
  const dimOf = { season: seasonOf, brand: brandOf, stage: stageOf };

  const allSeasons = useMemo(() => [...new Set(rows.map(seasonOf))].sort((a, b) => seasonCmp(b, a)), [rows]);
  const allBrands = useMemo(() => {
    const n = {}; rows.forEach((r) => { n[brandOf(r)] = (n[brandOf(r)] || 0) + 1; });
    return Object.keys(n).sort((a, b) => n[b] - n[a]);
  }, [rows]);

  const allStages = useMemo(() => [...new Set(rows.map(stageOf))].sort((a, b) => stageRank(a) - stageRank(b)), [rows]);
  const filtered = useMemo(
    () => rows.filter((r) => (!seasonSel.length || seasonSel.includes(seasonOf(r)))
      && (!brandSel.length || brandSel.includes(brandOf(r)))
      && (!stageSel.length || stageSel.includes(stageOf(r)))),
    [rows, seasonSel, brandSel, stageSel],
  );

  // 橫軸與拆分不能是同一個維度
  const split = splitDim === xDim ? 'none' : splitDim;

  const model = useMemo(() => {
    const cellMap = {}, xTot = {}, sTot = {}, grand = { d3: 0, total: 0 };
    const bump = (o, k, r) => { const c = (o[k] ||= { d3: 0, total: 0 }); c.total += 1; c.d3 += r.has_3d ? 1 : 0; };
    filtered.forEach((r) => {
      const x = dimOf[xDim](r), s = split === 'none' ? '__all' : dimOf[split](r);
      bump(cellMap, `${x}||${s}`, r); bump(xTot, x, r); bump(sTot, s, r);
      grand.total += 1; grand.d3 += r.has_3d ? 1 : 0;
    });
    const brandTotal = {}; filtered.forEach((r) => { brandTotal[brandOf(r)] = (brandTotal[brandOf(r)] || 0) + 1; });
    const order = (dim, keys, desc) => {
      const cmp = {
        season: (a, b) => seasonCmp(a, b),
        stage: (a, b) => stageRank(a) - stageRank(b),
        brand: (a, b) => (brandTotal[b] || 0) - (brandTotal[a] || 0),
      }[dim];
      return [...keys].sort((a, b) => (desc && dim !== 'brand' ? cmp(b, a) : cmp(a, b)));
    };
    const desc = chart === 'bar'; // 橫條：新季度在上；直條／折線：時間由左到右
    const xs = order(xDim, Object.keys(xTot), desc).map((k) => ({ key: k, label: k }));
    const sKeys = split === 'none' ? ['__all'] : order(split, Object.keys(sTot), false);
    const series = sKeys.map((k, i) => ({
      key: k, label: k === '__all' ? '合計' : k,
      color: sKeys.length === 1 ? 'var(--brand)' : PALETTE[i % PALETTE.length],
    }));
    const cell = (x, s) => cellMap[`${x}||${s}`] || { d3: 0, total: 0 };
    return { xs, series, cell, xTot, sTot, grand };
  }, [filtered, xDim, split, chart]);

  if (!rows.length) {
    return <Empty description="還沒有 3D 占比資料。請先在 Supabase 跑 stage-3d-usage.sql 建表，再雙擊「匯入3D占比.bat」灌資料。" />;
  }

  const M = METRICS[metric];
  const multi = model.series.length > 1;

  // 樞紐表：列＝橫軸，欄＝拆分。貼齊內容寬度，不讓欄位被拉開
  const showCell = (c) => {
    const v = M.val(c);
    if (v == null) return <span style={{ color: 'var(--text-muted)' }}>–</span>;
    return metric === 'pct'
      ? <span><b>{M.fmt(v)}</b> <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.d3}/{c.total}</span></span>
      : <b>{M.fmt(v)}</b>;
  };
  const columns = [
    { title: DIMS[xDim], dataIndex: 'label', key: 'label', fixed: 'left', render: (v, r) => (r.isTotal ? <b>{v}</b> : v) },
    ...model.series.map((s) => ({
      title: multi ? s.label : M.label, key: s.key, align: 'center',
      render: (_, r) => showCell(r.isTotal ? model.sTot[s.key] || { d3: 0, total: 0 } : model.cell(r.key, s.key)),
    })),
    ...(multi ? [{ title: '合計', key: 'sum', align: 'center', render: (_, r) => showCell(r.isTotal ? model.grand : model.xTot[r.key] || { d3: 0, total: 0 }) }] : []),
  ];
  const tableData = [...model.xs.map((x) => ({ ...x })), { key: '__total', label: '全部', isTotal: true }];

  // 上方每季總占比卡片（受下面的篩選影響）
  const kpiSeasons = [...new Set(filtered.map(seasonOf))].sort((a, b) => seasonCmp(b, a));
  const kpi = kpiSeasons.map((s) => {
    const list = filtered.filter((r) => seasonOf(r) === s);
    return { s, total: list.length, d3: list.filter((r) => r.has_3d).length };
  });

  const updatedAt = rows.reduce((m, r) => (r.created_at > m ? r.created_at : m), '');
  const chartTitle = `${DIMS[xDim]}別${M.label}${split !== 'none' ? `（依${DIMS[split]}拆分）` : ''}`;

  return (
    <div>
      <p className="page-desc" style={{ margin: '12px 0' }}>
        以「款」為單位、各階段各自計算：該款在該階段任一筆申請有做 3D（含同時做實樣）就算 3D。同一款有做 Proto 又做 Fit 會各算一次，所以同時選多個階段時，款數是「款×階段」。
        資料更新：{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}。
      </p>

      {stageSel.length !== 1 && stageSel.length !== 0 && <div className="page-desc" style={{ fontSize: 12, marginBottom: 8 }}>目前合併了 {stageSel.length} 個階段，卡片上的款數是「款×階段」。</div>}
      {stageSel.length === 0 && <div className="page-desc" style={{ fontSize: 12, marginBottom: 8 }}>目前包含全部階段，卡片上的款數是「款×階段」。</div>}
      <div className="u3d-kpis">
        {kpi.map((k) => (
          <div key={k.s} className="u3d-kpi">
            <div className="u3d-kpi-season">{k.s}　合計</div>
            <div className="u3d-kpi-pct">{pct(k.d3, k.total)}%</div>
            <div className="u3d-kpi-n">{k.d3} / {k.total} 款有做 3D</div>
          </div>
        ))}
        <div className="u3d-kpi u3d-kpi-all">
          <div className="u3d-kpi-season">全部合計</div>
          <div className="u3d-kpi-pct">{pct(model.grand.d3, model.grand.total)}%</div>
          <div className="u3d-kpi-n">{model.grand.d3} / {model.grand.total} 款有做 3D</div>
        </div>
      </div>

      {/* 樞紐設定：選要看什麼、怎麼分、用什麼圖 */}
      <div className="u3d-controls">
        <label>指標<Select value={metric} onChange={setMetric} style={{ width: 150 }}
          options={Object.entries(METRICS).map(([value, v]) => ({ value, label: v.label }))} /></label>
        <label>橫軸<Select value={xDim} onChange={setXDim} style={{ width: 90 }}
          options={Object.entries(DIMS).map(([value, label]) => ({ value, label }))} /></label>
        <label>拆分<Select value={split} onChange={setSplitDim} style={{ width: 110 }}
          options={[{ value: 'none', label: '不拆分' }, ...Object.entries(DIMS).filter(([v]) => v !== xDim).map(([value, label]) => ({ value, label: `依${label}` }))]} /></label>
        <label>季度<Select mode="multiple" allowClear placeholder="全部" value={seasonSel} onChange={setSeasonSel}
          style={{ minWidth: 150 }} maxTagCount="responsive" options={allSeasons.map((s) => ({ value: s, label: s }))} /></label>
        <label>階段<Select mode="multiple" allowClear placeholder="全部" value={stageSel} onChange={setStageSel}
          style={{ minWidth: 150 }} maxTagCount="responsive" options={allStages.map((g) => ({ value: g, label: g }))} /></label>
        <label>品牌<Select mode="multiple" allowClear placeholder="全部" value={brandSel} onChange={setBrandSel}
          style={{ minWidth: 150 }} maxTagCount="responsive" options={allBrands.map((b) => ({ value: b, label: b }))} /></label>
        <Segmented value={chart} onChange={setChart}
          options={[{ label: '直條圖', value: 'column' }, { label: '橫條圖', value: 'bar' }, { label: '折線圖', value: 'line' }]} />
      </div>

      <div className="chip-panel">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{chartTitle}</div>
        {multi && (
          <div className="u3d-legend">
            {model.series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
          </div>
        )}
        <div ref={boxRef}>
          {filtered.length ? (
            <Chart type={chart} xs={model.xs} series={model.series} cell={model.cell} metric={metric} width={boxW} />
          ) : <Empty description="沒有符合條件的資料" />}
        </div>
        <div className="page-desc" style={{ fontSize: 12, marginTop: 6 }}>滑鼠移到柱子或點上可看款數。</div>
      </div>

      <div className="u3d-table">
        <Table size="small" pagination={false} columns={columns} dataSource={tableData} scroll={{ x: 'max-content' }}
          style={{ background: 'var(--surface)' }} />
      </div>
    </div>
  );
}
