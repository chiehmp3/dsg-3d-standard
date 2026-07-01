import { useMemo } from 'react';
import { Empty, Tag } from 'antd';
import { SOURCE_TAG } from '../theme';

export default function SearchPage({ data, query, onOpen }) {
  const kws = query.toLowerCase().split(/\s+/).filter(Boolean);
  const entryHits = useMemo(() => data.entries.filter((e) => {
    const text = [e.title, e.content, ...(e.paths || [])].join(' ').toLowerCase();
    return kws.some((k) => text.includes(k));
  }), [data.entries, query]);
  const contactHits = useMemo(() => data.contacts.filter((c) => {
    const text = [c.owner_name_zh, c.owner_name_en, c.backup_name_zh, c.backup_name_en, c.category, c.email].join(' ').toLowerCase();
    return kws.some((k) => text.includes(k));
  }), [data.contacts, query]);

  if (!entryHits.length && !contactHits.length) return <Empty description="找不到相關結果，試試其他關鍵字" />;

  const sectionOf = (id) => data.sections.find((s) => s.id === id);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>🔍 搜尋結果</h2>
      {entryHits.map((e) => {
        const sec = sectionOf(e.section_id);
        const tag = SOURCE_TAG[e.source] || SOURCE_TAG.internal;
        return (
          <div key={e.id} onClick={() => sec && onOpen(sec.slug)}
            style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px', marginBottom: 8, cursor: 'pointer' }}>
            <div className="page-desc" style={{ marginTop: 0 }}>📂 {sec?.name || ''}</div>
            <div style={{ fontWeight: 600, margin: '4px 0' }}>{e.title} <Tag color={tag.color}>{tag.label}</Tag></div>
            {e.content && <div className="page-desc" style={{ whiteSpace: 'pre-wrap' }}>{e.content.slice(0, 160)}{e.content.length > 160 ? '…' : ''}</div>}
          </div>
        );
      })}
      {contactHits.map((c, i) => (
        <div key={i} onClick={() => onOpen('contacts')}
          style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px', marginBottom: 8, cursor: 'pointer' }}>
          <div className="page-desc" style={{ marginTop: 0 }}>📂 聯絡人</div>
          <div style={{ fontWeight: 600 }}>{c.category}</div>
          <div className="page-desc">負責：{c.owner_name_zh} {c.owner_name_en}</div>
        </div>
      ))}
    </div>
  );
}
