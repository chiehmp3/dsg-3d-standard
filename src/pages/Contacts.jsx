import { useMemo, useState } from 'react';
import { Card, Tag, Empty, Row, Col, Button, Checkbox, Space } from 'antd';
import { MailOutlined, ClearOutlined } from '@ant-design/icons';

// 收件人：優先用實際信箱（如運籌共用信箱），否則用英文名（Outlook 按「檢查名稱」自動辨識）
const recipientOf = (c) => c.email || c.owner_name_en || null;

export default function ContactsPage({ data }) {
  const [sel, setSel] = useState([]); // 已選的收件人 token（英文名或信箱）

  const groups = useMemo(() => {
    const g = {}, order = [];
    data.contacts.forEach((c) => { const k = c.category_group || '其他'; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(c); });
    return { g, order };
  }, [data.contacts]);

  if (!data.contacts.length) return <Empty description="尚無聯絡人資料" />;

  const toggle = (r) => setSel((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  const groupRecipients = (list) => list.map(recipientOf).filter(Boolean);
  const setGroup = (rs, on) => setSel((s) => (on ? Array.from(new Set([...s, ...rs])) : s.filter((x) => !rs.includes(x))));

  const openMail = () => {
    if (!sel.length) return;
    // Outlook 收件人以分號分隔；空白等字元編碼，開信後按「檢查名稱」辨識
    window.location.href = 'mailto:' + sel.map(encodeURIComponent).join(';');
  };

  return (
    <div style={{ paddingBottom: sel.length ? 72 : 0 }}>
      <p className="page-desc">勾選要聯繫的窗口，右下角按「開啟郵件」會把英文名帶入收件人；在 Outlook 按一下「檢查名稱」即會自動辨識出對應信箱。</p>

      {groups.order.map((groupName) => {
        const list = groups.g[groupName];
        const rs = groupRecipients(list);
        const selectedInGroup = rs.filter((r) => sel.includes(r));
        const allOn = rs.length > 0 && selectedInGroup.length === rs.length;
        const someOn = selectedInGroup.length > 0 && !allOn;
        return (
          <div key={groupName} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 12px' }}>
              <div className="group-title" style={{ margin: 0 }}>{groupName}</div>
              {rs.length > 0 && (
                <Checkbox checked={allOn} indeterminate={someOn} onChange={(e) => setGroup(rs, e.target.checked)}>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>全選此區（{rs.length}）</span>
                </Checkbox>
              )}
            </div>
            <Row gutter={[12, 12]}>
              {list.map((c, i) => {
                const r = recipientOf(c);
                const checked = !!r && sel.includes(r);
                return (
                  <Col key={i} xs={24} sm={12} lg={8}>
                    <Card size="small" style={{ height: '100%', borderColor: checked ? '#006150' : undefined }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Checkbox checked={checked} disabled={!r} onChange={() => toggle(r)} style={{ marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <div className="page-desc" style={{ marginTop: 0, marginBottom: 6 }}>
                            {[c.brand, c.category].filter(Boolean).join(' · ')}
                          </div>
                          {c.owner_name_zh && (
                            <div style={{ marginBottom: 4 }}>
                              <b>{c.owner_name_zh}</b> {c.owner_name_en && <Tag color="green">{c.owner_name_en}</Tag>}
                            </div>
                          )}
                          {c.backup_name_zh && (
                            <div style={{ marginBottom: 4, fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>
                              職代：{c.backup_name_zh} {c.backup_name_en && <Tag>{c.backup_name_en}</Tag>}
                            </div>
                          )}
                          {c.note && <div className="page-desc">{c.note}</div>}
                        </div>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>
        );
      })}

      {sel.length > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
          background: '#fff', borderTop: '1px solid #e8e8e8', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <b style={{ color: '#006150' }}>已選 {sel.length} 位窗口</b>
          <div style={{ flex: 1 }} />
          <Space>
            <Button icon={<ClearOutlined />} onClick={() => setSel([])}>清除</Button>
            <Button type="primary" icon={<MailOutlined />} onClick={openMail}>開啟郵件</Button>
          </Space>
        </div>
      )}
    </div>
  );
}
