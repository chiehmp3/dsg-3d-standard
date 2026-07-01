import { useMemo, useState } from 'react';
import { Checkbox, Button, Divider } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

export default function ChecklistPage({ section, data }) {
  const items = useMemo(
    () => data.entries.filter((e) => e.section_id === section.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [data.entries, section.id],
  );
  const [done, setDone] = useState({});
  const toggle = (id) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <div>
      <p className="page-desc">送出 3D 樣品到 CLO-SET 前，請依序確認以下項目。</p>
      <div style={{ marginTop: 16 }}>
        {items.map((e) => {
          const isHeader = /^【.*】$/.test(e.title);
          if (isHeader) {
            return (
              <Divider key={e.id} orientation="left" orientationMargin={0}
                style={{ color: '#006150', fontWeight: 700, fontSize: 13, marginTop: 24 }}>
                {e.title.replace(/^【|】$/g, '')}
              </Divider>
            );
          }
          const checked = !!done[e.id];
          return (
            <div key={e.id} onClick={() => toggle(e.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', marginBottom: 6,
                background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, cursor: 'pointer',
                opacity: checked ? 0.5 : 1,
              }}>
              <Checkbox checked={checked} onClick={(ev) => ev.stopPropagation()} onChange={() => toggle(e.id)} />
              <div style={{ flex: 1, textDecoration: checked ? 'line-through' : 'none' }}>
                <span>{e.title}</span>
                {e.content && <div className="page-desc">{e.content}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <Button icon={<ReloadOutlined />} onClick={() => setDone({})} style={{ marginTop: 16 }}>重置所有勾選</Button>
    </div>
  );
}
