import { useMemo, useState, useEffect } from 'react';
import { Tabs, Tag, Empty, Table, Space, Select, Button, Modal, Input, Checkbox, message } from 'antd';
import { sb } from '../supabase';

// 樣品狀態下拉選項（與業務 Excel 的下拉一致）
const STATUS_OPTIONS = ['待進單', '待製版', '待測布', '待進行', '進行中', '待業務確認', '待細節', '已完成', '已上傳', '製版澄清中', '待開發處內部澄清', '待完成檢查', '製版中', '退回版師'];
const STATUS_COLOR = {
  待進單: 'default', 待製版: 'cyan', 待測布: 'gold', 待進行: 'default', 進行中: 'blue',
  待業務確認: 'orange', 待細節: 'orange', 已完成: 'green', 已上傳: 'green',
  製版澄清中: 'purple', 待開發處內部澄清: 'volcano', 待完成檢查: 'geekblue', 製版中: 'magenta', 退回版師: 'red',
};
const statusLabel = (s) => (s && String(s).trim()) || '未上傳';
const statusColor = (s) => STATUS_COLOR[statusLabel(s)] || 'default';

// 摘要樞紐表的列分類。欄分類另有一組（見 SUMMARY_COL_OPTIONS），兩邊可自由搭配，
// 例如「列＝布料、欄＝季度」就能看出哪一季哪塊布用得最多
const SUMMARY_GROUP_OPTIONS = [
  { value: 'season', label: '季度' },
  { value: 'brand', label: '品牌' },
  { value: 'fabric', label: '布料' },
  { value: 'due', label: '交期' },
  { value: 'status', label: '狀態' },
];

// 排序下拉的選項依分頁而定：款式進度排款號，季度摘要排合計次數
const STYLE_SORT_OPTIONS = [
  { value: 'default', label: '排序：預設' },
  { value: 'style', label: '款號 A→Z' },
  { value: 'style_desc', label: '款號 Z→A' },
];
const SUMMARY_SORT_OPTIONS = [
  { value: 'default', label: '排序：預設' },
  { value: 'total_desc', label: '合計 高→低' },
  { value: 'total', label: '合計 低→高' },
];

const SUMMARY_COL_OPTIONS = [
  { value: 'status', label: '狀態' },
  { value: 'season', label: '季度' },
  { value: 'brand', label: '品牌' },
];

// 篩選／排序記在瀏覽器 localStorage，離開頁面再回來不會重置
const TRACKER_FILTERS_KEY = 'dsg-tracker-filters';
function loadSavedFilters() {
  try { return JSON.parse(localStorage.getItem(TRACKER_FILTERS_KEY)) || {}; } catch { return {}; }
}

// 業務的布料欄偶爾一格填好幾塊布，用換行分隔，前面還會帶標示，例如：
//   "1. DB245822-B-H / 2. DB245821-A-H / 3. TSP-900221"、"Body: 119556-DWR / Lining: TBA"、"上衣SZD6188D / 裙XS10340"
// 不拆 + 和 /：+AM、+UPF 是後加工，X/J 是料號的一部分，都算同一塊布
// （212333 與 212333-W+AM 後加工不同，是兩塊不同的布料，不可合併）。
const FABRIC_SPLIT = /[\r\n、;；]+/;
const stripFabricLabel = (s) => String(s)
  .replace(/^\s*\d+\s*[.、)]\s*/, '')                  // 1. / 2) 這類編號
  .replace(/^[^:：]{0,12}[:：]\s*/, '')                 // Body: / option 1 : / 裡布：
  .replace(/^[\u4e00-\u9fa5]+(?=[A-Za-z0-9])/, '')     // 上衣SZD6188D → SZD6188D
  // 只拿掉 (option N) 這種註記；(LKN1423) 之類的括號是料號的一部分，要留著
  .replace(/\s*\(\s*option[^)]*\)\s*$/i, '')
  .trim();
const splitFabrics = (raw) => String(raw || '').split(FABRIC_SPLIT).map(stripFabricLabel).filter(Boolean);

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
// keyFn 回傳陣列時，同一筆會被算進每一個分組（用在一款多塊布的情況）
function groupBy(list, keyFn, fallback) {
  const g = {}, order = [];
  list.forEach((r) => {
    const raw = keyFn(r);
    const keys = Array.isArray(raw) ? (raw.length ? raw : [fallback]) : [raw || fallback];
    keys.forEach((k) => { if (!g[k]) { g[k] = []; order.push(k); } g[k].push(r); });
  });
  return { g, order };
}

function StatusCell({ r, value, editable, onChange, showSeason }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span
        className="mono" title={r.style_no || ''}
        style={{ fontWeight: 600, color: 'var(--brand)', width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {r.style_no || ''}
      </span>
      <span
        title={r.style_name || r.product}
        style={{ width: 220, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {r.style_name || r.product}
      </span>
      <span
        className="page-desc" title={r.fabric || ''}
        style={{ margin: 0, width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {r.fabric ? `🧵 ${r.fabric}` : ''}
      </span>
      {showSeason && <Tag>{r.season}</Tag>}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {r.sample_due && <span className="page-desc" style={{ margin: 0, width: 130, flexShrink: 0, whiteSpace: 'nowrap' }}>交期 {r.sample_due}</span>}
        {editable ? (
          <Select size="small" style={{ width: 160, flexShrink: 0 }} value={value || undefined} placeholder="未上傳" allowClear
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            onChange={(v) => onChange(r, v ?? null)} />
        ) : (
          <Tag
            color={statusColor(value)} title={statusLabel(value)}
            style={{ width: 160, flexShrink: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}
          >
            {statusLabel(value)}
          </Tag>
        )}
      </div>
    </div>
  );
}

export default function TrackerPage({ data }) {
  const saved = loadSavedFilters();
  const [view, setView] = useState(saved.view || 'styles');
  const [seasonTab, setSeasonTab] = useState(saved.seasonTab ?? null);
  // 篩選／排序（作用於目前季度，記在瀏覽器 localStorage，重整/切頁不會不見）
  const [seasonFilter, setSeasonFilter] = useState(saved.seasonFilter || []);
  const [brandFilter, setBrandFilter] = useState(saved.brandFilter || []);
  const [statusFilter, setStatusFilter] = useState(saved.statusFilter || []);
  const [fabricFilter, setFabricFilter] = useState(saved.fabricFilter || []);
  const [dueFilter, setDueFilter] = useState(saved.dueFilter || []);
  const [sortKey, setSortKey] = useState(saved.sortKey || 'default');
  const [search, setSearch] = useState(saved.search || '');
  const [crossSeason, setCrossSeason] = useState(saved.crossSeason || false);
  const [summaryGroupBy, setSummaryGroupBy] = useState(saved.summaryGroupBy || 'season');
  const [summaryColBy, setSummaryColBy] = useState(saved.summaryColBy || 'status');
  useEffect(() => {
    localStorage.setItem(TRACKER_FILTERS_KEY, JSON.stringify({
      view, seasonTab, seasonFilter, brandFilter, statusFilter, fabricFilter, dueFilter, sortKey, search, crossSeason, summaryGroupBy, summaryColBy,
    }));
  }, [view, seasonTab, seasonFilter, brandFilter, statusFilter, fabricFilter, dueFilter, sortKey, search, crossSeason, summaryGroupBy, summaryColBy]);
  const rows = data.sampleRequests || [];

  const allBrands = useMemo(
    () => Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const allFabrics = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => splitFabrics(r.fabric)))).sort((a, b) => a.localeCompare(b)),
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
    if (fabricFilter.length) out = out.filter((r) => splitFabrics(r.fabric).some((f) => fabricFilter.includes(f)));
    if (dueFilter.length) out = out.filter((r) => dueFilter.includes(r.sample_due));
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => `${r.style_no || ''} ${r.product || ''} ${r.style_name || ''} ${r.fabric || ''}`.toLowerCase().includes(q));
    return out;
  };
  const renderBrandGroups = (list) => {
    const { g, order } = groupBy(list, (r) => r.brand, '其他');
    return order.map((brand) => (
      <div key={brand} style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, color: 'var(--brand)', margin: '10px 0 4px' }}>{brand}　<Tag>{g[brand].length}</Tag></div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 14px' }}>
          {sortList(g[brand]).map((r) => (
            <StatusCell key={r.id} r={r} value={effStatus(r)} editable={loggedIn} onChange={saveStatus} showSeason={crossSeason} />
          ))}
        </div>
      </div>
    ));
  };
  const sortOptions = view === 'summary' ? SUMMARY_SORT_OPTIONS : STYLE_SORT_OPTIONS;
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
      <Select value={sortOptions.some((o) => o.value === sortKey) ? sortKey : 'default'}
        onChange={setSortKey} style={{ minWidth: 140 }} options={sortOptions} />
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

  // 樞紐表：列＝可選分類（季度／品牌／布料／交期／狀態），欄＝狀態（選「狀態」當列時欄改用季度）
  // 只顯示有資料的欄，避免全零欄位塞滿報表
  const summary = (() => {
    const filtered = applyFilters(rows);
    if (!filtered.length) return <Empty description="沒有符合條件的款式" />;

    const keyFns = {
      season: (r) => r.season,
      brand: (r) => r.brand,
      fabric: (r) => splitFabrics(r.fabric),
      due: (r) => r.sample_due,
      status: (r) => statusLabel(effStatus(r)),
    };
    // 列和欄選到同一種分類會排出一張對角線表，沒有意義，這時欄自動退回狀態（狀態當列時退回季度）
    const colBy = summaryColBy === summaryGroupBy
      ? (summaryGroupBy === 'status' ? 'season' : 'status')
      : summaryColBy;
    const colIsStatus = colBy === 'status';
    const rowKeyFn = keyFns[summaryGroupBy];
    const colKeyFn = keyFns[colBy];

    const { g: byRow, order: rowOrder } = groupBy(filtered, rowKeyFn, '未填');
    if (summaryGroupBy === 'season') rowOrder.sort(seasonCmp);
    else if (summaryGroupBy !== 'status') rowOrder.sort((a, b) => String(a).localeCompare(String(b)));

    const rowsData = rowOrder.map((key) => {
      const list = byRow[key];
      const { g: byCol } = groupBy(list, colKeyFn, colIsStatus ? '未上傳' : '未分類');
      const done = list.filter((r) => ['已上傳', '已完成'].includes(statusLabel(effStatus(r)))).length;
      return { key, total: list.length, pct: Math.round((done / list.length) * 100), byCol };
    });
    if (sortKey === 'total_desc') rowsData.sort((a, b) => b.total - a.total);
    else if (sortKey === 'total') rowsData.sort((a, b) => a.total - b.total);

    // 只列出真的有資料的欄，避免整排全零把表撐爆
    const colUniverse = {
      status: [...STATUS_OPTIONS, '未上傳'],
      season: [...seasons].sort(seasonCmp),
      brand: [...allBrands].sort((a, b) => String(a).localeCompare(String(b))),
    }[colBy];
    const usedCols = colUniverse.filter((c) => rowsData.some((r) => (r.byCol[c] || []).length > 0));

    const rowLabel = SUMMARY_GROUP_OPTIONS.find((o) => o.value === summaryGroupBy).label;
    const columns = [
      { title: rowLabel, dataIndex: 'key', key: 'key', fixed: 'left',
        sorter: (a, b) => (summaryGroupBy === 'season' ? seasonCmp(a.key, b.key) : String(a.key).localeCompare(String(b.key))),
        render: (k) => <b>{summaryGroupBy === 'season' ? '📅 ' : ''}{k}</b> },
      ...usedCols.map((c) => ({
        title: c, key: c, align: 'center',
        sorter: (a, b) => (a.byCol[c] || []).length - (b.byCol[c] || []).length,
        render: (_, r) => {
          const n = (r.byCol[c] || []).length;
          return n ? <Tag color={colIsStatus ? statusColor(c) : undefined}>{n}</Tag> : <span style={{ color: 'var(--text-muted)' }}>–</span>;
        },
      })),
      { title: '合計', key: 'total', align: 'center', sorter: (a, b) => a.total - b.total,
        defaultSortOrder: null, render: (_, r) => <b>{r.total}</b> },
      // 選「狀態」當列時，每列本身就是一種狀態，「完成率」這個指標沒有意義，故不顯示
      ...(summaryGroupBy === 'status' ? [] : [{ title: '完成率', key: 'pct', align: 'center',
        sorter: (a, b) => a.pct - b.pct, render: (_, r) => <Tag color="green">{r.pct}%</Tag> }]),
    ];
    return (
      <div>
        <Space style={{ margin: '12px 0' }}>
          <span className="page-desc" style={{ margin: 0 }}>列：</span>
          <Select value={summaryGroupBy} onChange={setSummaryGroupBy} style={{ width: 120 }} options={SUMMARY_GROUP_OPTIONS} />
          <span className="page-desc" style={{ margin: 0 }}>欄：</span>
          <Select value={summaryColBy} onChange={setSummaryColBy} style={{ width: 120 }}
            options={SUMMARY_COL_OPTIONS.filter((o) => o.value !== summaryGroupBy)} />
          <span className="page-desc" style={{ margin: 0 }}>
            點欄位標題可依數量排序{summaryGroupBy === 'fabric' ? '；一款用多塊布會在每塊布各算一次，故各列相加會多於總計' : ''}
          </span>
        </Space>
        <Table
          size="small" pagination={false} rowKey="key" columns={columns} dataSource={rowsData} scroll={{ x: true }} style={{ background: 'var(--surface)' }}
          summary={() => {
            // 一款用多塊布時會在每塊布各算一次，所以總計不能把各列加起來（會重複），
            // 直接從款式本身算才是實際的款數
            const colFallback = colIsStatus ? '未上傳' : '未分類';
            const totalByCol = {};
            usedCols.forEach((c) => {
              totalByCol[c] = filtered.filter((r) => (colKeyFn(r) || colFallback) === c).length;
            });
            const grandTotal = filtered.length;
            const doneTotal = filtered.filter((r) => ['已上傳', '已完成'].includes(statusLabel(effStatus(r)))).length;
            const grandPct = grandTotal ? Math.round((doneTotal / grandTotal) * 100) : 0;
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><b>總計</b></Table.Summary.Cell>
                {usedCols.map((c, i) => (
                  <Table.Summary.Cell key={c} index={i + 1} align="center">
                    {totalByCol[c] ? <Tag color={colIsStatus ? statusColor(c) : undefined}>{totalByCol[c]}</Tag> : <span style={{ color: 'var(--text-muted)' }}>–</span>}
                  </Table.Summary.Cell>
                ))}
                <Table.Summary.Cell index={usedCols.length + 1} align="center"><b>{grandTotal}</b></Table.Summary.Cell>
                {summaryGroupBy !== 'status' && (
                  <Table.Summary.Cell index={usedCols.length + 2} align="center"><Tag color="green">{grandPct}%</Tag></Table.Summary.Cell>
                )}
              </Table.Summary.Row>
            );
          }}
        />
      </div>
    );
  })();

  const pendingBase = applyFilters(rows.filter((r) => !['已上傳', '已完成'].includes(statusLabel(effStatus(r)))));
  const pending = sortKey === 'default'
    ? [...pendingBase].sort((a, b) => seasonCmp(a.season, b.season))
    : sortList(pendingBase);
  const todo = pending.length ? (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 14px' }}>
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
