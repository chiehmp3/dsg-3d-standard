import { useMemo, useState } from 'react';
import { Card, Tag, Empty, Row, Col, Button, Checkbox, Space, App } from 'antd';
import { MailOutlined, ClearOutlined } from '@ant-design/icons';

export default function ContactsPage({ data }) {
  const { message } = App.useApp();
  const [sel, setSel] = useState([]); // 已選的 email 陣列

  const groups = useMemo(() => {
    const g = {}, order = [];
    data.contacts.forEach((c) => { const k = c.category_group || '其他'; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(c); });
    return { g, order };
  }, [data.contacts]);

  if (!data.contacts.length) return <Empty description="尚無聯絡人資料" />;

  const toggle = (email) => setSel((s) => (s.includes(email) ? s.filter((x) => x !== email) : [...s, email]));
  const groupEmails = (list) => list.map((c) => c.email).filter(Boolean);
  const setGroup = (emails, on) => setSel((s) => (on ? Array.from(new Set([...s, ...emails])) : s.filter((x) => !emails.includes(x))));

  const openMail = () => {
    if (!sel.length) return;
    window.location.href = 'mailto:' + sel.join(',');
  };

  return (
    <div style={{ paddingBottom: sel.length ? 72 : 0 }}>
      <p className="page-desc">勾選要聯繫的窗口，右下角按「開啟郵件」即可一次帶入所有收件人。（灰色代表尚無 email）</p>

      {groups.order.map((groupName) => {
        const list = groups.g[groupName];
        const emails = groupEmails(list);
        const selectedInGroup = emails.filter((e) => sel.includes(e));
        const allOn = emails.length > 0 && selectedInGroup.length === emails.length;
        const someOn = selectedInGroup.length > 0 && !allOn;
        return (
          <div key={groupName} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 12px' }}>
              <div className="group-title" style={{ margin: 0 }}>{groupName}</div>
              {emails.length > 0 && (
                <Checkbox checked={allOn} indeterminate={someOn} onChange={(e) => setGroup(emails, e.target.checked)}>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>全選此區（{emails.length}）</span>
                </Checkbox>
              )}
            </div>
            <Row gutter={[12, 12]}>
              {list.map((c, i) => {
                const hasMail = !!c.email;
                const checked = hasMail && sel.includes(c.email);
                return (
                  <Col key={i} xs={24} sm={12} lg={8}>
                    <Card size="small" style={{ height: '100%', borderColor: checked ? '#006150' : undefined }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Checkbox checked={checked} disabled={!hasMail} onChange={() => toggle(c.email)} style={{ marginTop: 2 }} />
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
                          {hasMail ? (
                            <Button size="small" icon={<MailOutlined />} href={`mailto:${c.email}`} style={{ marginTop: 4 }}>{c.email}</Button>
                          ) : (
                            <span style={{ fontSize: 12, color: '#bfbfbf' }}>（尚無 email）</span>
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
