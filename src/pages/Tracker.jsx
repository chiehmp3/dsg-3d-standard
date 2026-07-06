import { useMemo, useState, useEffect } from 'react';
import { Tabs, Tag, Empty, Card, Space, Select, Button, Modal, Input, Checkbox, message } from 'antd';
import { sb } from '../supabase';

// 樣品狀態下拉選項（與業務 Excel 的下拉一致，K2:K13）
const STATUS_OPTIONS = ['待進單', '已進單', '待測布', '待進行', '進行中', '待業務確認', '待細節', '已完成', '已上傳', '已退單', '澄清中', '待完成檢查'];
const STATUS_COLOR = {
  待進單: 'default', 已進單: 'cyan', 待測布: 'gold', 待進行: 'default', 進行中: 'blue',
  待業務確認: 'orange', 待細節: 'orange', 已完成: 'green', 已上傳: 'green', 已退單: 'red',
  澄清中: 'purple', 待完成檢查: 'geekblue',
};
const statusLabel = (s) => (s && String(s).trim()) || '未上傳';
const statusColor = (s) => STATUS_COLOR[statusLabel(s)] || 'default';

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
function groupBy(list, keyFn, fallback) {
  const g = {}, order = [];
  list.forEach((r) => { const k = keyFn(r) || fallback; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(r); });
  return { g, order };
}

function StatusCell({ r, value, editable, onChange, showSeason }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
      {r.style_no && <span className="mono" style={{ fontWeight: 600, color: '#006150', minWidth: 90 }}>{r.style_no}</span>}
      <span style={{ minWidth: 160 }}>{r.style_name || r.product}</span>
      {r.fabric && <span className="page-desc" style={{ margin: 0 }}>🧵 {r.fabric}</span>}
      {showSeason && <Tag>{r.season}</Tag>}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {r.sample_due && <span className="page-desc" style={{ margin: 0 }}>交期 {r.sample_due}</span>}
        {editable ? (
          <Select size="small" style={{ minWidth: 128 }} value={value || undefined} placeholder="未上傳" allowClear
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            onChange={(v) => onChange(r, v ?? null)} />
        ) : (
          <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>
        )}
      </div>
    </div>
  );
}

export default function TrackerPage({ data }) {
  const [view, setView] = useState('styles');
  const [seasonTab, setSeasonTab] = useState(null);
  // 篩選／排序（作用於目前季度）
  const [seasonFilter, setSeasonFilter] = useState([]);
  const [brandFilter, setBrandFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [fabricFilter, setFabricFilter] = useState([]);
  const [dueFilter, setDueFilter] = useState([]);
  const [sortKey, setSortKey] = useState('default');
  const [search, setSearch] = useState('');
  const [crossSeason, setCrossSeason] = useState(false);
  const rows = data.sampleRequests || [];

  const allBrands = useMemo(
    () => Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const allFabrics = useMemo(
    () => Array.from(new Set(rows.map((r) => r.fabric).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const allDueDates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.sample_due).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))),
    [rows],
  );

  // 登入狀態
  const [session, setSession] = useState(null);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const loggedIn = !!session;

  // 登入對話框
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const doLogin = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) { message.error('登入失敗：' + error.message); return; }
    message.success('登入成功，現在可以編輯狀態'); setLoginOpen(false); setPw('');
  };
  const doLogout = async () => { await sb.auth.signOut(); message.info('已登出'); };

  // 樣品狀態的本機覆蓋（編輯後即時反映，不必重載）
  const [overrides, setOverrides] = useState({});
  const effStatus = (r) => (Object.prototype.hasOwnProperty.call(overrides, r.id) ? overrides[r.id] : r.sample_status);
  const saveStatus = async (r, v) => {
    const { error } = await sb.from('sample_requests').update({ sample_status: v }).eq('id', r.id);
    if (error) { message.error('儲存失敗：' + error.message); return; }
    setOverrides((o) => ({ ...o, [r.id]: v }));
    message.success(`${r.style_no || r.product}：${statusLabel(v)}`);
  };

  const { g: bySeason, order: seasons } = useMemo(() => {
    const grp = groupBy(rows, (r) => r.season, '未分類');
    grp.order.sort(seasonCmp);
    return grp;
  }, [rows]);

  if (!rows.length) {
    return <Empty description="目前尚無送樣資料。請先跑 sample-requests-schema.sql 建表，再用「匯入開發追蹤.bat」灌入。" />;
  }

  // 款式進度的季度分頁清單跟著季度篩選走（避免兩個季度選擇器衝突）
  const visibleSeasons = seasonFilter.length ? seasons.filter((s) => seasonFilter.includes(s)) : seasons;
  const activeSeason = seasonTab && visibleSeasons.includes(seasonTab) ? seasonTab : visibleSeasons[0];

  const sortList = (arr) => {
    if (sortKey === 'style') return [...arr].sort((a, b) => String(a.style_no || '').localeCompare(String(b.style_no || '')));
    if (sortKey === 'style_desc') return [...arr].sort((a, b) => String(b.style_no || '').localeCompare(String(a.style_no || '')));
    return arr; // 預設＝原順序
  };
  const applyFilters = (list) => {
    let out = list;
    if (seasonFilter.length) out = out.filter((r) => seasonFilter.includes(r.season));
    if (brandFilter.length) out = out.filter((r) => brandFilter.includes(r.brand));
    if (statusFilter.length) out = out.filter((r) => statusFilter.includes(statusLabel(effStatus(r))));
    if (fabricFilter.length) out = out.filter((r) => fabricFilter.includes(r.fabric));
    if (dueFilter.length) out = out.filter((r) => dueFilter.includes(r.sample_due));
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => `${r.style_no || ''} ${r.product || ''} ${r.style_name || ''} ${r.fabric || ''}`.toLowerCase().includes(q));
    return out;
  };
  const renderBrandGroups = (list) => {
    const { g, order } = groupBy(list, (r) => r.brand, '其他');
    return order.map((brand) => (
      <div key={brand} style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, color: '#006150', margin: '10px 0 4px' }}>{brand}　<Tag>{g[brand].length}</Tag></div>
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '4px 14px' }}>
          {sortList(g[brand]).map((r) => (
            <StatusCell key={r.id} r={r} value={effStatus(r)} editable={loggedIn} onChange={saveStatus} showSeason={crossSeason} />
          ))}
        </div>
      </div>
    ));
  };
  const filterBar = (
    <Space wrap style={{ margin: '12px 0' }}>
      <Select mode="multiple" allowClear placeholder="季度（全部）" value={seasonFilter} onChange={setSeasonFilter}
        style={{ minWidth: 180 }} maxTagCount="responsive"
        options={seasons.map((s) => ({ value: s, label: s }))} />
      <Select mode="multiple" allowClear placeholder="品牌（全部）" value={brandFilter} onChange={setBrandFilter}
        style={{ minWidth: 180 }} maxTagCount="responsive"
        options={allBrands.map((b) => ({ value: b, label: b }))} />
      <Select mode="multiple" allowClear placeholder="狀態（全部）" value={statusFilter} onChange={setStatusFilter}
        style={{ minWidth: 160 }} maxTagCount="responsive"
        options={[...STATUS_OPTIONS, '未上傳'].map((s) => ({ value: s, label: s }))} />
      <Select mode="multiple" allowClear placeholder="布料（全部）" value={fabricFilter} onChange={setFabricFilter}
        style={{ minWidth: 180 }} maxTagCount="responsive" showSearch optionFilterProp="label"
        options={allFabrics.map((f) => ({ value: f, label: f }))} />
      <Select mode="multiple" allowClear placeholder="交期（全部）" value={dueFilter} onChange={setDueFilter}
        style={{ minWidth: 170 }} maxTagCount="responsive" showSearch optionFilterProp="label"
        options={allDueDates.map((d) => ({ value: d, label: d }))} />
      <Select value={sortKey} onChange={setSortKey} style={{ minWidth: 130 }}
        options={[
          { value: 'default', label: '排序：預設' },
          { value: 'style', label: '款號 A→Z' },
          { value: 'style_desc', label: '款號 Z→A' },
        ]} />
      <Input allowClear placeholder="搜尋款號 / 品名 / 布料" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
      {view === 'styles' && <Checkbox checked={crossSeason} onChange={(e) => setCrossSeason(e.target.checked)}>跨所有季度</Checkbox>}
    </Space>
  );

  const styles = (
    <div>
      {!crossSeason && (
        <Tabs size="small" activeKey={activeSeason} onChange={setSeasonTab}
          items={visibleSeasons.map((s) => ({ key: s, label: `📅 ${s}（${bySeason[s].length}）` }))} />
      )}
      {(() => {
        if (crossSeason) {
          const list = applyFilters(rows);
          if (!list.length) return <Empty description="沒有符合條件的款式" />;
          const { g, order } = groupBy(list, (r) => r.season, '未分類');
          order.sort(seasonCmp);
          return order.map((s) => (
            <div key={s} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, margin: '6px 0' }}>📅 {s}　<Tag>{g[s].length}</Tag></div>
              {renderBrandGroups(g[s])}
            </div>
          ));
        }
        const list = applyFilters(bySeason[activeSeason] || []);
        if (!list.length) return <Empty description="這一季沒有符合條件的款式" />;
        return renderBrandGroups(list);
      })()}
    </div>
  );

  const summary = (() => {
    const shown = seasons.map((s) => ({ s, list: applyFilters(bySeason[s]) })).filter((x) => x.list.length);
    if (!shown.length) return <Empty description="沒有符合條件的款式" />;
    return (
      <div>
        {shown.map(({ s, list }) => {
          const { g: byStatus } = groupBy(list, (r) => statusLabel(effStatus(r)), '未上傳');
          const done = (byStatus['已上傳'] || []).length + (byStatus['已完成'] || []).length;
          const pct = Math.round((done / list.length) * 100);
          return (
            <Card key={s} size="small" style={{ marginBottom: 12 }}
              title={<span>📅 {s}　<Tag color="green">{list.length} 款 · 已上傳/完成 {pct}%</Tag></span>}>
              <Space wrap>
                {Object.keys(byStatus).map((st) => (<Tag key={st} color={statusColor(st)}>{st} {byStatus[st].length}</Tag>))}
              </Space>
            </Card>
          );
        })}
      </div>
    );
  })();

  const pendingBase = applyFilters(rows.filter((r) => !['已上傳', '已完成'].includes(statusLabel(effStatus(r)))));
  const pending = sortKey === 'default'
    ? [...pendingBase].sort((a, b) => seasonCmp(a.season, b.season))
    : sortList(pendingBase);
  const todo = pending.length ? (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '4px 14px' }}>
      {pending.map((r) => (
        <StatusCell key={r.id} r={r} value={effStatus(r)} editable={loggedIn} onChange={saveStatus} showSeason />
      ))}
    </div>
  ) : <Empty description="目前所有款式都已上傳或完成 🎉" />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <p className="page-desc" style={{ flex: 1 }}>各季送樣申請與狀態（來源：業務 Sample Request，以一鍵工具同步）。{loggedIn ? '登入中，可直接用下拉改狀態。' : '登入後可編輯狀態。'}</p>
        {loggedIn ? (
          <Space><span className="page-desc" style={{ margin: 0 }}>👤 {session.user.email}</span><Button size="small" onClick={doLogout}>登出</Button></Space>
        ) : (
          <Button size="small" onClick={() => setLoginOpen(true)}>🔒 登入以編輯</Button>
        )}
      </div>

      <Tabs activeKey={view} onChange={setView} items={[
        { key: 'styles', label: '📋 款式進度' },
        { key: 'summary', label: '📊 季度摘要' },
        { key: 'todo', label: '⏰ 待辦' },
      ]} />
      {filterBar}
      {view === 'styles' ? styles : view === 'summary' ? summary : todo}

      <Modal title="登入以編輯狀態" open={loginOpen} onOk={doLogin} onCancel={() => setLoginOpen(false)} okText="登入" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} onPressEnter={doLogin} />
          <Input.Password placeholder="密碼" value={pw} onChange={(e) => setPw(e.target.value)} onPressEnter={doLogin} />
        </Space>
      </Modal>
    </div>
  );
}
