import { useMemo, useState } from 'react';
import { Tabs, Collapse, Tag, Progress, Empty, Card, Space } from 'antd';

const STAGE_DEFS = [
  { key: 'proto', name: 'PROTO' }, { key: 'fit', name: 'FIT' }, { key: 'crs', name: 'CRS' },
  { key: 'placement', name: '對條格' }, { key: 'jss', name: 'JSS' }, { key: 'pp', name: 'PP' },
];
const STATUS_COLOR = { 已完成: 'green', 進行中: 'blue', 待回覆: 'orange', 已退單: 'red', 未開始: 'default' };
const STATUS_ORDER = ['已完成', '進行中', '待回覆', '已退單', '未開始'];
const normSeason = (s) => (s ? String(s).replace(/^[A-Za-z]+-/, '').trim() : '');
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '');

function stageIndex(v) {
  if (!v) return -1;
  const x = String(v).toLowerCase();
  return STAGE_DEFS.findIndex((s) => s.key === x || s.name.toLowerCase() === x);
}
function StageProgress({ stage, status }) {
  const total = STAGE_DEFS.length, idx = stageIndex(stage), done = status === '已完成';
  const reached = done ? total : (idx < 0 ? 0 : idx + 1);
  return <Progress percent={Math.round((reached / total) * 100)} size="small" strokeColor="#006150"
    format={() => (done ? '完成' : idx < 0 ? '—' : STAGE_DEFS[idx].name)} style={{ maxWidth: 160, marginBottom: 0 }} />;
}

function useGroups(developments) {
  return useMemo(() => {
    const map = {}, order = [];
    developments.forEach((r) => { const k = r.style_no || '(無款號)'; if (!map[k]) { map[k] = { key: k, rows: [] }; order.push(k); } map[k].rows.push(r); });
    order.forEach((k) => {
      const rows = map[k].rows.slice().sort((a, b) => (a.iteration || 0) - (b.iteration || 0));
      map[k].rows = rows;
      map[k].latest = rows.reduce((acc, r) => ((r.iteration || 0) >= (acc.iteration || 0) ? r : acc), rows[0]);
    });
    const seasons = {}, sOrder = [];
    order.forEach((k) => { const s = normSeason(map[k].latest.season) || '未分類'; if (!seasons[s]) { seasons[s] = []; sOrder.push(s); } seasons[s].push(map[k]); });
    const yearOf = (s) => { const m = String(s).match(/(\d{4})/); return m ? +m[1] : 0; };
    // 季節先後：春→夏→秋→冬（使用者按季節開發）
    const SEASON_RANK = { SP: 1, SS: 1, SU: 2, FA: 3, AU: 3, FW: 3, WI: 4, HO: 4 };
    const seasonRank = (s) => SEASON_RANK[String(s).replace(/\d{4}/, '').trim().toUpperCase()] ?? 9;
    // 時間軸順序：年份舊到新 → 同一年內依春夏秋冬（例：SP 2026 → SU 2026 → FA 2026 → SP 2027）
    sOrder.sort((a, b) => (yearOf(a) - yearOf(b)) || (seasonRank(a) - seasonRank(b)) || String(a).localeCompare(String(b)));
    return { map, order, seasons, sOrder };
  }, [developments]);
}

function IterList({ rows }) {
  return (
    <div>
      {rows.map((r, i) => {
        const ret = (r.return_sales || 0) + (r.return_pattern || 0);
        const dates = [r.start_date && `開始 ${fmtDate(r.start_date)}`, r.end_date && `完成 ${fmtDate(r.end_date)}`].filter(Boolean).join('　→　');
        return (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: i < rows.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
            <span className="mono" style={{ color: '#006150', fontWeight: 600 }}>3D #{r.iteration}</span>
            <b>{r.stage || r.dev_type || ''}</b>
            <Tag color={STATUS_COLOR[r.status] || 'default'}>{r.status}</Tag>
            {dates && <span className="page-desc" style={{ margin: 0 }}>{dates}</span>}
            {r.lt ? <span className="page-desc" style={{ margin: 0 }}>LT {r.lt}</span> : null}
            {ret ? <span style={{ color: '#d46b08', fontSize: 13 }}>退回 {ret} 次</span> : null}
            {r.modeler && <span className="page-desc" style={{ margin: 0 }}>3D：{r.modeler}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function TrackerPage({ data }) {
  const [view, setView] = useState('styles');
  const [seasonTab, setSeasonTab] = useState(null);
  const { map, order, seasons, sOrder } = useGroups(data.developments);

  if (!data.developments.length) {
    return <Empty description="目前尚無開發資料。請在 Supabase 的 developments 表新增款式，這裡就會自動顯示。" />;
  }

  // 款式進度：每個季度一個分頁（依時間軸排序，最舊在前）
  const activeSeason = seasonTab && sOrder.includes(seasonTab) ? seasonTab : sOrder[0];
  const styles = (
    <div>
      <Tabs size="small" activeKey={activeSeason} onChange={setSeasonTab}
        items={sOrder.map((s) => ({ key: s, label: `📅 ${s}（${seasons[s].length}）` }))} />
      {activeSeason && (
        <Collapse items={seasons[activeSeason].map((gr) => {
          const d = gr.latest;
          return {
            key: gr.key,
            label: (
              <Space wrap>
                <span className="mono" style={{ fontWeight: 600, color: '#006150' }}>{d.style_no}</span>
                <span className="page-desc" style={{ margin: 0 }}>{d.brand} · {d.product_item} · {d.gender}</span>
                <Tag color={STATUS_COLOR[d.status] || 'default'}>{d.status}</Tag>
                <span className="page-desc" style={{ margin: 0 }}>{gr.rows.length} 次</span>
              </Space>
            ),
            children: <IterList rows={gr.rows} />,
          };
        })} style={{ background: '#fff' }} />
      )}
    </div>
  );

  const season = (
    <div>
      {sOrder.map((s) => {
        const groups = seasons[s]; const total = groups.length; const byStatus = {};
        groups.forEach((gr) => { const st = gr.latest.status || '未分類'; byStatus[st] = (byStatus[st] || 0) + 1; });
        const pct = Math.round(((byStatus['已完成'] || 0) / total) * 100);
        return (
          <Card key={s} size="small" style={{ marginBottom: 12 }}
            title={<span>📅 {s}　<Tag color="green">{total} 款 · 完成 {pct}%</Tag></span>}>
            <Space wrap>
              {STATUS_ORDER.filter((st) => byStatus[st]).map((st) => (
                <Tag key={st} color={STATUS_COLOR[st] || 'default'}>{st} {byStatus[st]}</Tag>
              ))}
            </Space>
          </Card>
        );
      })}
    </div>
  );

  const rank = (s) => ({ 已退單: 0, 待回覆: 1, 進行中: 2, 未開始: 3 }[s] ?? 4);
  const flagged = order.map((k) => map[k]).filter((gr) => (gr.latest.status || '') !== '已完成').sort((a, b) => rank(a.latest.status) - rank(b.latest.status));
  const todo = flagged.length ? (
    <div>
      {flagged.map((gr) => {
        const d = gr.latest;
        return (
          <div key={gr.key} style={{ padding: '11px 14px', marginBottom: 6, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
            <Space wrap>
              <span className="mono" style={{ fontWeight: 600 }}>{d.style_no}</span>
              <span className="page-desc" style={{ margin: 0 }}>{d.brand}</span>
              <Tag color={STATUS_COLOR[d.status] || 'default'}>{d.status}</Tag>
            </Space>
            <div className="page-desc">{normSeason(d.season)}{d.product_item ? ` · ${d.product_item}` : ''}{d.td ? ` · TD ${d.td}` : ''} · 最新 3D #{d.iteration} {d.stage || ''}</div>
          </div>
        );
      })}
    </div>
  ) : <Empty description="目前所有款式的最新狀態都是「已完成」🎉" />;

  return (
    <div>
      <p className="page-desc">各季 3D 開發進度追蹤（資料於 Supabase 的 developments 表維護）。</p>
      <Tabs activeKey={view} onChange={setView} items={[
        { key: 'styles', label: '📋 款式進度' },
        { key: 'season', label: '📊 季度摘要' },
        { key: 'todo', label: '⏰ 待辦' },
      ]} />
      {view === 'styles' ? styles : view === 'season' ? season : todo}
    </div>
  );
}
