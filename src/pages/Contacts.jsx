import { useMemo, useState } from 'react';
import { Card, Tag, Empty, Row, Col, Button, Space } from 'antd';
import { MailOutlined, ClearOutlined } from '@ant-design/icons';

// 每筆聯絡人的收件人 token：優先用實際信箱，否則用英文名（Outlook 按「檢查名稱」辨識）
// 職代（backup）以「/」分隔多人，逐一拆成獨立收件人
const recipientsOf = (c) => {
  const owner = c.email || c.owner_name_en || null;
  const backups = (c.backup_name_en || '').split('/').map((s) => s.trim()).filter(Boolean);
  return [owner, ...backups].filter(Boolean);
};

const keyOf = (c) => c.id ?? `${c.category_group}|${c.owner_name_zh}|${c.category}`;
const uniq = (arr) => Array.from(new Set(arr));

const TO_COLOR = '#006150';   // 收件者（綠）
const CC_COLOR = '#2f54eb';   // 副本（藍）

export default function ContactsPage({ data }) {
  const [toSel, setToSel] = useState([]); // 收件者：選取的 key 陣列
  const [ccSel, setCcSel] = useState([]); // 副本：選取的 key 陣列

  const byKey = useMemo(() => {
    const m = {};
    data.contacts.forEach((c) => { m[keyOf(c)] = c; });
    return m;
  }, [data.contacts]);

  const groups = useMemo(() => {
    const g = {}, order = [];
    data.contacts.forEach((c) => { const k = c.category_group || '其他'; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(c); });
    return { g, order };
  }, [data.contacts]);

  if (!data.contacts.length) return <Empty description="尚無聯絡人資料" />;

  // 把某張卡放進「收件者」或「副本」，兩者互斥；再點一次同一鈕＝取消
  const pickTo = (k) => {
    setToSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
    setCcSel((s) => s.filter((x) => x !== k));
  };
  const pickCc = (k) => {
    setCcSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
    setToSel((s) => s.filter((x) => x !== k));
  };
  // 全選此區：每張卡依「建議欄位」(mail_role) 分別放入收件者或副本
  const selectGroup = (list) => {
    const toKeys = list.filter((c) => (c.mail_role || 'to') === 'to').map(keyOf);
    const ccKeys = list.filter((c) => (c.mail_role || 'to') === 'cc').map(keyOf);
    setToSel((s) => uniq([...s.filter((x) => !ccKeys.includes(x)), ...toKeys]));
    setCcSel((s) => uniq([...s.filter((x) => !toKeys.includes(x)), ...ccKeys]));
  };
  const clearAll = () => { setToSel([]); setCcSel([]); };

  const openMail = () => {
    const to = uniq(toSel.flatMap((k) => recipientsOf(byKey[k])));
    // 副本去掉已在收件者的人，避免重複
    const cc = uniq(ccSel.flatMap((k) => recipientsOf(byKey[k]))).filter((x) => !to.includes(x));
    if (!to.length && !cc.length) return;
    let url = 'mailto:' + to.map(encodeURIComponent).join(';');
    if (cc.length) url += '?cc=' + cc.map(encodeURIComponent).join(';');
    window.location.href = url;
  };

  const total = toSel.length + ccSel.length;

  return (
    <div style={{ paddingBottom: total ? 76 : 0 }}>
      <p className="page-desc">
        每張卡可選「<b style={{ color: TO_COLOR }}>收</b>＝收件者」或「<b style={{ color: CC_COLOR }}>副</b>＝副本」。
        一般業務／版師窗口放收件者，主管／運籌／TD／群組信箱放副本；TD 窗口可視情況（Fit／JSS／PP 時改列收件者）。
        勾好按右下角「開啟郵件」，職代會自動一起帶入；在 Outlook 按「檢查名稱」辨識信箱。
      </p>

      {groups.order.map((groupName) => {
        const list = groups.g[groupName];
        return (
          <div key={groupName} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 12px' }}>
              <div className="group-title" style={{ margin: 0 }}>{groupName}</div>
              <Button size="small" type="text" onClick={() => selectGroup(list)}
                style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
                全選此區（依建議）
              </Button>
            </div>
            <Row gutter={[12, 12]}>
              {list.map((c) => {
                const k = keyOf(c);
                const inTo = toSel.includes(k);
                const inCc = ccSel.includes(k);
                const rec = (c.mail_role || 'to'); // 建議欄位，用來提示
                const borderColor = inTo ? TO_COLOR : inCc ? CC_COLOR : undefined;
                return (
                  <Col key={k} xs={24} sm={12} lg={8}>
                    <Card size="small" style={{ height: '100%', borderColor }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <Space direction="vertical" size={4} style={{ marginTop: 2 }}>
                          <Button size="small" onClick={() => pickTo(k)}
                            type={inTo ? 'primary' : 'default'}
                            style={inTo ? { background: TO_COLOR, borderColor: TO_COLOR }
                              : rec === 'to' ? { borderColor: TO_COLOR, color: TO_COLOR } : undefined}>
                            收
                          </Button>
                          <Button size="small" onClick={() => pickCc(k)}
                            type={inCc ? 'primary' : 'default'}
                            style={inCc ? { background: CC_COLOR, borderColor: CC_COLOR }
                              : rec === 'cc' ? { borderColor: CC_COLOR, color: CC_COLOR } : undefined}>
                            副
                          </Button>
                        </Space>
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

      {total > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
          background: '#fff', borderTop: '1px solid #e8e8e8', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <b style={{ color: TO_COLOR }}>收件者 {toSel.length} 位</b>
          <b style={{ color: CC_COLOR }}>副本 {ccSel.length} 位</b>
          <div style={{ flex: 1 }} />
          <Space>
            <Button icon={<ClearOutlined />} onClick={clearAll}>清除</Button>
            <Button type="primary" icon={<MailOutlined />} onClick={openMail}>開啟郵件</Button>
          </Space>
        </div>
      )}
    </div>
  );
}
