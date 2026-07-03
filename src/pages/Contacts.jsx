import { useMemo, useState } from 'react';
import { Card, Tag, Empty, Row, Col, Button, Space, App } from 'antd';
import { MailOutlined, ClearOutlined, CopyOutlined } from '@ant-design/icons';

// 每筆聯絡人的收件人 token：優先用實際信箱，否則用英文名（Outlook 按「檢查名稱」辨識）
// 職代（backup）以「/」分隔多人，逐一拆成獨立收件人
const recipientsOf = (c) => {
  const owner = c.email || c.owner_name_en || null;
  const backups = (c.backup_name_en || '').split('/').map((s) => s.trim()).filter(Boolean);
  return [owner, ...backups].filter(Boolean);
};

const keyOf = (c) => c.id ?? `${c.category_group}|${c.owner_name_zh}|${c.category}`;
const uniq = (arr) => Array.from(new Set(arr));
const roleOf = (c) => c.mail_role || 'to';
const isBiz = (gn) => String(gn || '').startsWith('業務');

const TO_COLOR = '#006150';   // 收件者（綠）
const CC_COLOR = '#2f54eb';   // 副本（藍）

export default function ContactsPage({ data }) {
  const { message } = App.useApp();
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

  // 品牌快捷：category_group 以「業務」開頭的群組
  const brandGroups = useMemo(() => groups.order.filter(isBiz), [groups.order]);
  // 通用副本：mail_role='cc' 且非業務群組（運籌／TD 各區／TD 群組／版師主管）
  const universalCcKeys = useMemo(
    () => data.contacts.filter((c) => roleOf(c) === 'cc' && !isBiz(c.category_group)).map(keyOf),
    [data.contacts],
  );

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
    const toKeys = list.filter((c) => roleOf(c) === 'to').map(keyOf);
    const ccKeys = list.filter((c) => roleOf(c) === 'cc').map(keyOf);
    setToSel((s) => uniq([...s.filter((x) => !ccKeys.includes(x)), ...toKeys]));
    setCcSel((s) => uniq([...s.filter((x) => !toKeys.includes(x)), ...ccKeys]));
  };
  const clearAll = () => { setToSel([]); setCcSel([]); };

  // 品牌快捷：帶出該品牌名單（取代目前選取）→ 收件者=該品牌窗口，副本=該品牌主管＋通用副本
  const applyBrandPreset = (gn) => {
    const list = groups.g[gn] || [];
    const toKeys = list.filter((c) => roleOf(c) === 'to').map(keyOf);
    const brandCc = list.filter((c) => roleOf(c) === 'cc').map(keyOf);
    setToSel(uniq(toKeys));
    setCcSel(uniq([...brandCc, ...universalCcKeys]));
    message.success(`已帶入「${gn.replace(/^業務\s*·?\s*/, '')}」名單，可再手動微調`);
  };

  const toTokens = () => uniq(toSel.flatMap((k) => recipientsOf(byKey[k])));
  // 副本去掉已在收件者的人，避免重複
  const ccTokens = () => { const to = toTokens(); return uniq(ccSel.flatMap((k) => recipientsOf(byKey[k]))).filter((x) => !to.includes(x)); };

  const openMail = () => {
    const to = toTokens();
    const cc = ccTokens();
    if (!to.length && !cc.length) return;
    let url = 'mailto:' + to.map(encodeURIComponent).join(';');
    if (cc.length) url += '?cc=' + cc.map(encodeURIComponent).join(';');
    window.location.href = url;
  };
  const copy = (tokens, label) => {
    if (!tokens.length) { message.info(`${label}目前是空的`); return; }
    navigator.clipboard.writeText(tokens.join('; ')).then(
      () => message.success(`已複製${label} ${tokens.length} 位，貼到 CC/收件者欄即可`),
      () => message.error('複製失敗，請改用「開啟郵件」'),
    );
  };

  const total = toSel.length + ccSel.length;

  return (
    <div style={{ paddingBottom: total ? 76 : 0 }}>
      <p className="page-desc">
        <b>快速用法</b>：先點下面「品牌快捷」帶出該品牌整份名單（收件者＝業務窗口、副本＝主管/運籌/TD/版師主管等），
        再視情況手動微調每張卡的「<b style={{ color: TO_COLOR }}>收</b>/<b style={{ color: CC_COLOR }}>副</b>」。
        完成後可「開啟郵件」（Outlook）或「複製」貼到 Gmail/Outlook 的收件者/副本欄。職代會自動一起帶入。
      </p>

      {brandGroups.length > 0 && (
        <Space wrap style={{ marginBottom: 8 }}>
          <span style={{ color: 'rgba(0,0,0,0.55)', fontSize: 13 }}>品牌快捷：</span>
          {brandGroups.map((gn) => (
            <Button key={gn} size="small" onClick={() => applyBrandPreset(gn)}>
              {gn.replace(/^業務\s*·?\s*/, '')}
            </Button>
          ))}
        </Space>
      )}

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
                const rec = roleOf(c); // 建議欄位，用來提示
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
          padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <b style={{ color: TO_COLOR }}>收件者 {toSel.length} 位</b>
          <b style={{ color: CC_COLOR }}>副本 {ccSel.length} 位</b>
          <div style={{ flex: 1 }} />
          <Space wrap>
            <Button icon={<ClearOutlined />} onClick={clearAll}>清除</Button>
            <Button icon={<CopyOutlined />} onClick={() => copy(toTokens(), '收件者')} disabled={!toSel.length}>複製收件者</Button>
            <Button icon={<CopyOutlined />} onClick={() => copy(ccTokens(), '副本')} disabled={!ccSel.length}>複製副本</Button>
            <Button type="primary" icon={<MailOutlined />} onClick={openMail}>開啟郵件</Button>
          </Space>
        </div>
      )}
    </div>
  );
}
