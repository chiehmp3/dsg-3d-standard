import { useMemo } from 'react';
import { Card, Tag, Empty, Row, Col, Button } from 'antd';
import { MailOutlined } from '@ant-design/icons';

export default function ContactsPage({ data }) {
  const groups = useMemo(() => {
    const g = {}, order = [];
    data.contacts.forEach((c) => { const k = c.category_group || '其他'; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(c); });
    return { g, order };
  }, [data.contacts]);

  if (!data.contacts.length) return <Empty description="尚無聯絡人資料" />;

  return (
    <div>
      <p className="page-desc">公司內部 TD 組負責人與職代。</p>
      {groups.order.map((groupName) => (
        <div key={groupName} style={{ marginBottom: 24 }}>
          <div className="group-title">{groupName}</div>
          <Row gutter={[12, 12]}>
            {groups.g[groupName].map((c, i) => (
              <Col key={i} xs={24} sm={12} lg={8}>
                <Card size="small" style={{ height: '100%' }}>
                  <div className="page-desc" style={{ marginTop: 0, marginBottom: 8 }}>
                    {[c.brand, c.category].filter(Boolean).join(' · ')}
                  </div>
                  {c.owner_name_zh && <div style={{ marginBottom: 4 }}><span style={{ color: 'rgba(0,0,0,0.45)', marginRight: 8 }}>負責</span><b>{c.owner_name_zh}</b> {c.owner_name_en && <Tag color="green">{c.owner_name_en}</Tag>}</div>}
                  {c.backup_name_zh && <div style={{ marginBottom: 4 }}><span style={{ color: 'rgba(0,0,0,0.45)', marginRight: 8 }}>職代</span>{c.backup_name_zh} {c.backup_name_en && <Tag>{c.backup_name_en}</Tag>}</div>}
                  {c.email && <Button size="small" icon={<MailOutlined />} href={`mailto:${c.email}`} style={{ marginTop: 6 }}>{c.email}</Button>}
                  {c.note && <div className="page-desc">{c.note}</div>}
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
}
