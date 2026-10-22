import { useMemo, useState } from 'react';
import { Table, Progress, Empty, Tag, Segmented, Select } from 'antd';

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
// 款數太少的品牌（例如只有 1 款）算出來的百分比沒有參考價值，圖上淡化處理
const SMALL_N = 5;

// 100% 堆疊橫條：整條＝該列全部的款，彩色那段＝有做 3D 的款，長度直接對應占比，列與列才好比
function ShareBars({ items }) {
  return (
    <div className="u3d-bars">
      {items.map((it) => (
        <div key={it.key} className="u3d-row" style={{ opacity: it.total < SMALL_N ? 0.5 : 1 }}
          title={it.total < SMALL_N ? `只有 ${it.total} 款，占比僅供參考` : undefined}>
          <span className="u3d-label">{it.label}</span>
          <div className="u3d-track">
            <div className="u3d-fill" style={{ width: `${pct(it.d3, it.total)}%` }} />
            <div className="u3d-half" />
          </div>
          <span className="u3d-pct">{pct(it.d3, it.total)}%</span>
          <span className="u3d-n">{it.d3} / {it.total} 款</span>
        </div>
      ))}
    </div>
  );
}

// 每季 Proto 階段的 3D 使用占比。一列＝一個款（匯入時已去重），款數口徑＝有做 3D 的款 ÷ Proto 款
export default function Usage3D({ data }) {
  const rows = data.proto3d || [];
  const [mode, setMode] = useState('season');   // season＝各季（全品牌）、brand＝各品牌
  const [scope, setScope] = useState('all');    // 各品牌模式下的範圍：全部季度或單一季度

  const { seasons, bySeason, byBrand, total, updatedAt } = useMemo(() => {
    const add = (m, key, r) => {
      const x = (m[key] ||= { key, label: key, total: 0, d3: 0 });
      x.total += 1; x.d3 += r.has_3d ? 1 : 0;
    };
    const bySeasonMap = {}, byBrandAll = {}, byBrandSeason = {};
    rows.forEach((r) => {
      const s = r.season || '未分類', b = r.brand || '未填';
      add(bySeasonMap, s, r);
      add(byBrandAll, b, r);
      add((byBrandSeason[s] ||= {}), b, r);
    });
    const sortBrands = (m) => Object.values(m).sort((a, b) => b.total - a.total);
    const seasons = Object.keys(bySeasonMap).sort((a, b) => seasonCmp(b, a)); // 新→舊
    return {
      seasons,
      bySeason: seasons.map((s) => ({ ...bySeasonMap[s], brands: sortBrands(byBrandSeason[s]) })),
      byBrand: { all: sortBrands(byBrandAll), ...Object.fromEntries(seasons.map((s) => [s, sortBrands(byBrandSeason[s])])) },
      total: rows.reduce((t, r) => ({ total: t.total + 1, d3: t.d3 + (r.has_3d ? 1 : 0) }), { total: 0, d3: 0 }),
      updatedAt: rows.reduce((m, r) => (r.created_at > m ? r.created_at : m), ''),
    };
  }, [rows]);

  if (!rows.length) {
    return <Empty description="還沒有 3D 占比資料。請先在 Supabase 跑 proto-3d-usage.sql 建表，再雙擊「匯入3D占比.bat」灌資料。" />;
  }

  const tableData = bySeason.map((s) => ({
    ...s, label: `${s.label}　全品牌`,
    children: s.brands.map((b) => ({ ...b, key: `${s.key}||${b.key}` })),
  }));
  const columns = [
    { title: '季度 / 品牌', dataIndex: 'label', key: 'label', render: (v, r) => (r.children ? <b>📅 {v}</b> : v) },
    { title: 'Proto 款數', dataIndex: 'total', key: 'total', align: 'center', sorter: (a, b) => a.total - b.total },
    { title: '3D 款數', dataIndex: 'd3', key: 'd3', align: 'center', sorter: (a, b) => a.d3 - b.d3,
      render: (v) => (v ? <Tag color="blue">{v}</Tag> : <span style={{ color: 'var(--text-muted)' }}>–</span>) },
    { title: '實樣款數', key: 'real', align: 'center', render: (_, r) => r.total - r.d3 },
    { title: '3D 占比', key: 'pct', width: 260, sorter: (a, b) => pct(a.d3, a.total) - pct(b.d3, b.total),
      render: (_, r) => <Progress percent={pct(r.d3, r.total)} size="small" format={(p) => `${p}%`} /> },
  ];

  const barItems = mode === 'season' ? bySeason : byBrand[scope] || byBrand.all;
  const scopeTotal = mode === 'season'
    ? total
    : barItems.reduce((t, b) => ({ total: t.total + b.total, d3: t.d3 + b.d3 }), { total: 0, d3: 0 });

  return (
    <div>
      <p className="page-desc" style={{ margin: '12px 0' }}>
        只算 Proto 階段，以「款」為單位：該款任一筆 Proto 有做 3D（含同時做實樣）就算 3D。
        資料更新：{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}。
      </p>

      {/* 全品牌合計：每季一張，最新季在左 */}
      <div className="u3d-kpis">
        {bySeason.map((s) => (
          <div key={s.key} className="u3d-kpi">
            <div className="u3d-kpi-season">{s.label}　全品牌</div>
            <div className="u3d-kpi-pct">{pct(s.d3, s.total)}%</div>
            <div className="u3d-kpi-n">{s.d3} / {s.total} 款有做 3D</div>
          </div>
        ))}
        <div className="u3d-kpi u3d-kpi-all">
          <div className="u3d-kpi-season">所有季度合計</div>
          <div className="u3d-kpi-pct">{pct(total.d3, total.total)}%</div>
          <div className="u3d-kpi-n">{total.d3} / {total.total} 款有做 3D</div>
        </div>
      </div>

      <div className="chip-panel">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <Segmented value={mode} onChange={setMode}
            options={[{ label: '各季度（全品牌）', value: 'season' }, { label: '各品牌', value: 'brand' }]} />
          {mode === 'brand' && (
            <Select value={scope} onChange={setScope} style={{ width: 170 }}
              options={[{ value: 'all', label: '全部季度合計' }, ...seasons.map((s) => ({ value: s, label: s }))]} />
          )}
          <span className="page-desc" style={{ margin: 0 }}>
            整條＝全部 Proto 款，彩色＝有做 3D　·　合計 {pct(scopeTotal.d3, scopeTotal.total)}%（{scopeTotal.d3} / {scopeTotal.total} 款）
          </span>
        </div>
        <ShareBars items={barItems} />
        {mode === 'brand' && (
          <div className="page-desc" style={{ fontSize: 12, marginTop: 10 }}>淡色＝款數少於 {SMALL_N} 款，占比僅供參考。虛線＝50%。</div>
        )}
      </div>

      <Table
        size="small" pagination={false} columns={columns} dataSource={tableData}
        expandable={{ indentSize: 18 }} style={{ background: 'var(--surface)' }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}><b>所有季度　全品牌</b></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><b>{total.total}</b></Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="center"><b>{total.d3}</b></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="center">{total.total - total.d3}</Table.Summary.Cell>
            <Table.Summary.Cell index={4}><Progress percent={pct(total.d3, total.total)} size="small" /></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </div>
  );
}
