import { useMemo, useState } from 'react';
import { Tabs, Segmented, Button, Tag, Collapse, App, Alert } from 'antd';
import { CopyOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { groupByName } from '../data';
import { CardHeader, CardBody } from '../components/CardItem';

function buildAvatarData(avatars) {
  const genders = {};
  avatars.forEach((r) => {
    if (!genders[r.gender]) genders[r.gender] = { key: r.gender, label: r.gender_label, icon: r.gender_icon, _order: r.gender_order || 0, _subs: {}, shared: null };
    const g = genders[r.gender];
    if (r.is_shared) { g.shared = { size: r.size, code: r.code, note: r.shared_note }; return; }
    if (!g._subs[r.subgroup]) g._subs[r.subgroup] = { key: r.subgroup, label: r.subgroup_label, _order: r.subgroup_order || 0, folder: r.folder, sizes: [] };
    g._subs[r.subgroup].sizes.push({ size: r.size, code: r.code, base: !!r.is_base, rare: !!r.is_rare, _order: r.sort_order || 0 });
  });
  return Object.values(genders).sort((a, b) => a._order - b._order).map((g) => ({
    ...g,
    subgroups: Object.values(g._subs).sort((a, b) => a._order - b._order).map((s) => ({ ...s, sizes: [...s.sizes].sort((a, b) => a._order - b._order) })),
  }));
}

export default function AvatarPage({ section, data }) {
  const { message } = App.useApp();
  const genders = useMemo(() => buildAvatarData(data.avatars), [data.avatars]);
  const [gi, setGi] = useState(0);
  const [subKey, setSubKey] = useState(null);

  const refEntries = useMemo(() => data.entries.filter((e) => e.section_id === section.id), [data.entries, section.id]);
  const refGroups = useMemo(() => groupByName(refEntries), [refEntries]);

  if (!genders.length) return <Alert type="error" message="人台資料載入失敗，請確認 Supabase 的 avatars 表已建立" />;

  const g = genders[gi] || genders[0];
  const sub = g.subgroups.find((s) => s.key === subKey) || g.subgroups[0];

  return (
    <div>
      <p className="page-desc">選擇性別與尺碼分類，複製資料夾路徑後，於檔案總管中依人台編號取用檔案。</p>

      <Tabs
        activeKey={String(gi)}
        onChange={(k) => { setGi(Number(k)); setSubKey(null); }}
        items={genders.map((gg, i) => ({ key: String(i), label: `${gg.icon || ''} ${gg.label}` }))}
        style={{ marginTop: 8 }}
      />

      {g.shared && (
        <Alert type="warning" showIcon style={{ marginBottom: 14 }}
          message={g.shared.note}
          description={<span><b className="mono">{g.shared.size}</b>　<span className="mono">{g.shared.code}</span></span>} />
      )}

      {g.subgroups.length > 1 && (
        <Segmented style={{ marginBottom: 14 }}
          value={sub.key}
          onChange={(v) => setSubKey(v)}
          options={g.subgroups.map((s) => ({ label: s.label, value: s.key }))} />
      )}

      {sub.folder && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'rgba(0,97,80,0.05)', border: '1px solid rgba(0,97,80,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <FolderOpenOutlined style={{ color: '#006150' }} />
          <span className="mono" style={{ flex: 1, minWidth: 200, wordBreak: 'break-all' }}>{sub.folder}</span>
          <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(sub.folder); message.success('已複製資料夾路徑'); }}>複製路徑</Button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
        {sub.sizes.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px',
            borderBottom: i < sub.sizes.length - 1 ? '1px solid #f5f5f5' : 'none',
            background: s.base ? 'rgba(0,97,80,0.06)' : '#fff',
            borderLeft: s.base ? '3px solid #006150' : '3px solid transparent',
            opacity: s.rare ? 0.55 : 1,
          }}>
            <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: s.base ? '#006150' : '#262626', minWidth: 90 }}>
              {s.base ? '★ ' : ''}{s.size}
            </span>
            {s.base && <Tag color="green">基準碼</Tag>}
            {s.rare && <Tag>少用</Tag>}
            <span className="mono" style={{ flex: 1, color: '#006150', wordBreak: 'break-all' }}>{s.code}</span>
          </div>
        ))}
      </div>

      <Alert type="info" showIcon style={{ marginTop: 14 }}
        message={<span>★ 標示為「基準碼」是該分類最常用的尺碼；標示「少用」的尺碼通常不用，需要時再取用。</span>} />

      {refEntries.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>📄 人台相關規範</h3>
          {refGroups.map((grp, ix) => (
            <div key={ix}>
              {grp.name && <div className="group-title">{grp.name}</div>}
              <Collapse style={{ background: '#fff', marginBottom: 12 }}
                items={grp.items.map((e) => ({ key: e.id, label: <CardHeader entry={e} />, children: <CardBody entry={e} /> }))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
