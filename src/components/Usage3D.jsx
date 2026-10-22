import { useMemo } from 'react';
import { Table, Progress, Empty, Tag } from 'antd';

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

// 每季 Proto 階段的 3D 使用占比。一列＝一個款（匯入時已去重），款數口徑＝有做 3D 的款 ÷ Proto 款
export default function Usage3D({ data }) {
  const rows = data.proto3d || [];

  const { tableData, total, updatedAt } = useMemo(() => {
    const bySeason = {};
    rows.forEach((r) => {
      const s = r.season || '未分類', b = r.brand || '未填';
      const sea = (bySeason[s] ||= { key: s, label: s, total: 0, d3: 0, brands: {} });
      const br = (sea.brands[b] ||= { key: `${s}||${b}`, label: b, total: 0, d3: 0 });
      [sea, br].forEach((x) => { x.total += 1; x.d3 += r.has_3d ? 1 : 0; });
    });
    const tableData = Object.values(bySeason)
      .sort((a, b) => seasonCmp(b.label, a.label)) // 新季度在最上面
      .map((s) => ({
        ...s,
        children: Object.values(s.brands).sort((a, b) => b.total - a.total),
      }));
    const total = tableData.reduce((t, s) => ({ total: t.total + s.total, d3: t.d3 + s.d3 }), { total: 0, d3: 0 });
    const updatedAt = rows.reduce((m, r) => (r.created_at > m ? r.created_at : m), '');
    return { tableData, total, updatedAt };
  }, [rows]);

  if (!rows.length) {
    return <Empty description="還沒有 3D 占比資料。請先在 Supabase 跑 proto-3d-usage.sql 建表，再雙擊「匯入3D占比.bat」灌資料。" />;
  }

  const columns = [
    { title: '季度 / 品牌', dataIndex: 'label', key: 'label', render: (v, r) => (r.children ? <b>📅 {v}</b> : v) },
    { title: 'Proto 款數', dataIndex: 'total', key: 'total', align: 'center', sorter: (a, b) => a.total - b.total },
    { title: '3D 款數', dataIndex: 'd3', key: 'd3', align: 'center', sorter: (a, b) => a.d3 - b.d3,
      render: (v) => (v ? <Tag color="blue">{v}</Tag> : <span style={{ color: 'var(--text-muted)' }}>–</span>) },
    { title: '實樣款數', key: 'real', align: 'center', render: (_, r) => r.total - r.d3 },
    { title: '3D 占比', key: 'pct', width: 260, sorter: (a, b) => pct(a.d3, a.total) - pct(b.d3, b.total),
      render: (_, r) => <Progress percent={pct(r.d3, r.total)} size="small" format={(p) => `${p}%`} /> },
  ];

  return (
    <div>
      <p className="page-desc" style={{ margin: '12px 0' }}>
        只算 Proto 階段，以「款」為單位：該款任一筆 Proto 有做 3D（含同時做實樣）就算 3D。
        資料更新：{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}。點季度左邊的 ▸ 可展開各品牌。
      </p>
      <Table
        size="small" pagination={false} columns={columns} dataSource={tableData}
        expandable={{ indentSize: 18 }} style={{ background: 'var(--surface)' }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}><b>全部季度</b></Table.Summary.Cell>
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
