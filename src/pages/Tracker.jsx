import { useMemo, useState } from 'react';
import { Tabs, Tag, Empty, Card, Space } from 'antd';

// 樣品狀態顏色
const STATUS_COLOR = {
  已上傳: 'green', 已完成: 'blue', 已退單: 'red',
  澄清中: 'orange', 待業務確認: 'orange', 待細節: 'orange',
  進行中: 'blue', 待進單: 'default', 已進單: 'cyan',
};
const statusLabel = (s) => (s && String(s).trim()) || '未上傳';
const statusColor = (s) => STATUS_COLOR[statusLabel(s)] || 'default';

// 季度排序：年份→季節(春夏秋冬)→季度Q，皆由舊到新
const SEASON_RANK = { SP: 1, SS: 1, SU: 2, FA: 3, AU: 3, HO: 4, WI: 4 };
function seasonSortVal(s) {
  const m = String(s).match(/([A-Za-z]{2})\s*(\d{2}).*?Q\s*(\d)/i);
  if (!m) return [9999, 9, 9];
  return [2000 + parseInt(m[2], 10), SEASON_RANK[m[1].toUpperCase()] ?? 9, parseInt(m[3], 10)];
}
function seasonCmp(a, b) {
  const A = seasonSortVal(a), B = seasonSortVal(b);
  return A[0] - B[0] || A[1] - B[1] || A[2] - B[2] || String(a).localeCompare(String(b));
}

// 依 key 分組並保留出現順序
function groupBy(list, keyFn, fallback) {
  const g = {}, order = [];
  list.forEach((r) => { const k = keyFn(r) || fallback; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(r); });
  return { g, order };
}

function StyleRow({ r, showSeason }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
      {r.style_no && <span className="mono" style={{ fontWeight: 600, color: '#006150', minWidth: 90 }}>{r.style_no}</span>}
      <span style={{ flex: 1, minWidth: 180 }}>{r.style_name || r.product}</span>
      {showSeason && <Tag>{r.season}</Tag>}
      <Tag color={statusColor(r.sample_status)}>{statusLabel(r.sample_status)}</Tag>
      {r.fabric && <span className="page-desc" style={{ margin: 0 }}>{r.fabric}</span>}
    </div>
  );
}

export default function TrackerPage({ data }) {
  const [view, setView] = useState('styles');
  const [seasonTab, setSeasonTab] = useState(null);
  const rows = data.sampleRequests || [];

  const { g: bySeason, order: seasons } = useMemo(() => {
    const grp = groupBy(rows, (r) => r.season, '未分類');
    grp.order.sort(seasonCmp);
    return grp;
  }, [rows]);

  if (!rows.length) {
    return <Empty description="目前尚無送樣資料。請先在 Supabase 跑 sample-requests-schema.sql 建表，再用「匯入開發追蹤.bat」灌入最新送樣清單。" />;
  }

  const activeSeason = seasonTab && seasons.includes(seasonTab) ? seasonTab : seasons[0];

  // 款式進度：季度分頁 → 同季內依品牌分組
  const styles = (
    <div>
      <Tabs size="small" activeKey={activeSeason} onChange={setSeasonTab}
        items={seasons.map((s) => ({ key: s, label: `📅 ${s}（${bySeason[s].length}）` }))} />
      {activeSeason && (() => {
        const { g, order } = groupBy(bySeason[activeSeason], (r) => r.brand, '其他');
        return order.map((brand) => (
          <div key={brand} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: '#006150', margin: '10px 0 4px' }}>
              {brand}　<Tag>{g[brand].length}</Tag>
            </div>
            <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '4px 14px' }}>
              {g[brand].map((r) => <StyleRow key={r.id} r={r} />)}
            </div>
          </div>
        ));
      })()}
    </div>
  );

  // 季度摘要：每季各狀態數量
  const summary = (
    <div>
      {seasons.map((s) => {
        const list = bySeason[s];
        const { g: byStatus } = groupBy(list, (r) => statusLabel(r.sample_status), '未上傳');
        const done = (byStatus['已上傳'] || []).length + (byStatus['已完成'] || []).length;
        const pct = Math.round((done / list.length) * 100);
        return (
          <Card key={s} size="small" style={{ marginBottom: 12 }}
            title={<span>📅 {s}　<Tag color="green">{list.length} 款 · 已上傳 {pct}%</Tag></span>}>
            <Space wrap>
              {Object.keys(byStatus).map((st) => (
                <Tag key={st} color={statusColor(st)}>{st} {byStatus[st].length}</Tag>
              ))}
            </Space>
          </Card>
        );
      })}
    </div>
  );

  // 待辦：尚未上傳/被退的款（跨季）
  const pending = rows
    .filter((r) => !['已上傳', '已完成'].includes(statusLabel(r.sample_status)))
    .sort((a, b) => seasonCmp(a.season, b.season));
  const todo = pending.length ? (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '4px 14px' }}>
      {pending.map((r) => <StyleRow key={r.id} r={r} showSeason />)}
    </div>
  ) : <Empty description="目前所有款式都已上傳或完成 🎉" />;

  return (
    <div>
      <p className="page-desc">各季送樣申請與狀態（資料來源：業務「3D Development Sample Request &amp; Status」，以一鍵工具同步）。</p>
      <Tabs activeKey={view} onChange={setView} items={[
        { key: 'styles', label: '📋 款式進度' },
        { key: 'summary', label: '📊 季度摘要' },
        { key: 'todo', label: '⏰ 待辦' },
      ]} />
      {view === 'styles' ? styles : view === 'summary' ? summary : todo}
    </div>
  );
}
