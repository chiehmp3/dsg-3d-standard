import { useMemo, useState } from 'react';
import { Card, Tag, Empty, Row, Col, Button, Space, Tabs, App } from 'antd';
import { MailOutlined, ClearOutlined, CopyOutlined } from '@ant-design/icons';

// 收件人 token：優先實際信箱，否則英文名（Outlook 檢查名稱辨識）；職代以「/」拆多人
const recipientsOf = (c) => {
  const owner = c.email || c.owner_name_en || null;
  const backups = (c.backup_name_en || '').split('/').map((s) => s.trim()).filter(Boolean);
  return [owner, ...backups].filter(Boolean);
};
const keyOf = (c) => c.id ?? `${c.category_group}|${c.owner_name_zh}|${c.category}`;
const uniq = (arr) => Array.from(new Set(arr));
const roleOf = (c) => c.mail_role || 'to';
const isBiz = (gn) => String(gn || '').startsWith('業務');

// 三層＋運籌：頂層分頁
function topLayerOf(c) {
  const g = c.category_group || '';
  if (isBiz(g)) return '業務';
  if (g === '版師主管') return '版師主管';
  if (g === '運籌') return '運籌';
  return 'TD'; // 部門主管 / TOP… / BOTTOM / TD 群組 / 其他
}
// 各層的子群組鍵：業務→品牌、版師主管→產區(brand)、TD→category_group、運籌→運籌
function subGroupOf(c) {
  const g = c.category_group || '';
  if (isBiz(g)) return g.replace(/^業務\s*·?\s*/, '') || '業務';
  if (g === '版師主管') return c.brand || '其他';
  if (g === '運籌') return '運籌';
  return g;
}
const LAYER_ORDER = ['業務', '版師主管', 'TD', '運籌'];

const TO_COLOR = '#006150';   // 收件者（綠）
const CC_COLOR = '#2f54eb';   // 副本（藍）

export default function ContactsPage({ data }) {
  const { message } = App.useApp();
  const [toSel, setToSel] = useState([]);
  const [ccSel, setCcSel] = useState([]);

  const byKey = useMemo(() => {
    const m = {};
    data.contacts.forEach((c) => { m[keyOf(c)] = c; });
    return m;
  }, [data.contacts]);

  // 分層結構：layer → { subOrder, subs, count }
  const layers = useMemo(() => {
    const byLayer = {};
    data.contacts.forEach((c) => {
      const L = topLayerOf(c), S = subGroupOf(c);
      if (!byLayer[L]) byLayer[L] = { subOrder: [], subs: {}, count: 0 };
      if (!byLayer[L].subs[S]) { byLayer[L].subs[S] = []; byLayer[L].subOrder.push(S); }
      byLayer[L].subs[S].push(c); byLayer[L].count++;
    });
    const order = LAYER_ORDER.filter((l) => byLayer[l]);
    Object.keys(byLayer).forEach((l) => { if (!order.includes(l)) order.push(l); });
    return { byLayer, order };
  }, [data.contacts]);

  // 通用副本：mail_role='cc' 且非業務（版師主管／TD／TD群組／運籌）
  const universalCcKeys = useMemo(
    () => data.contacts.filter((c) => roleOf(c) === 'cc' && !isBiz(c.category_group)).map(keyOf),
    [data.contacts],
  );
  // TD 群組信箱：不管選誰都自動帶進副本
  const tdGroupTokens = useMemo(
    () => uniq(data.contacts.filter((c) => c.category_group === 'TD 群組').flatMap(recipientsOf)),
    [data.contacts],
  );

  if (!data.contacts.length) return <Empty description="尚無聯絡人資料" />;

  const pickTo = (k) => {
    setToSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
    setCcSel((s) => s.filter((x) => x !== k));
  };
  const pickCc = (k) => {
    setCcSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
    setToSel((s) => s.filter((x) => x !== k));
  };
  const selectGroup = (list) => {
    const toKeys = list.filter((c) => roleOf(c) === 'to').map(keyOf);
    const ccKeys = list.filter((c) => roleOf(c) === 'cc').map(keyOf);
    setToSel((s) => uniq([...s.filter((x) => !ccKeys.includes(x)), ...toKeys]));
    setCcSel((s) => uniq([...s.filter((x) => !toKeys.includes(x)), ...ccKeys]));
  };
  const clearAll = () => { setToSel([]); setCcSel([]); };

  // 品牌快捷（業務層的子群組）：收件者=該品牌窗口，副本=該品牌主管＋通用副本
  const bizLayer = layers.byLayer['業務'];
  const applyBrandPreset = (sub) => {
    const list = bizLayer.subs[sub] || [];
    const toKeys = list.filter((c) => roleOf(c) === 'to').map(keyOf);
    const brandCc = list.filter((c) => roleOf(c) === 'cc').map(keyOf);
    setToSel(uniq(toKeys));
    setCcSel(uniq([...brandCc, ...universalCcKeys]));
    message.success(`已帶入「${sub}」名單，可再手動微調`);
  };

  const anySelected = () => toSel.length + ccSel.length > 0;
  const toTokens = () => uniq(toSel.flatMap((k) => recipientsOf(byKey[k])));
  const ccTokens = () => {
    const to = toTokens();
    const base = ccSel.flatMap((k) => recipientsOf(byKey[k]));
    // 有任何選取時，副本一律含 TD 群組信箱
    const withGroup = anySelected() ? [...base, ...tdGroupTokens] : base;
    return uniq(withGroup).filter((x) => !to.includes(x));
  };

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
      () => message.success(`已複製${label} ${tokens.length} 位，貼到收件者/副本欄即可`),
      () => message.error('複製失敗，請改用「開啟郵件」'),
    );
  };

  const renderCard = (c) => {
    const k = keyOf(c);
    const inTo = toSel.includes(k);
    const inCc = ccSel.includes(k);
    const rec = roleOf(c);
    const borderColor = inTo ? TO_COLOR : inCc ? CC_COLOR : undefined;
    return (
      <Col key={k} xs={24} sm={12} lg={8}>
        <Card size="small" style={{ height: '100%', borderColor }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Space direction="vertical" size={4} style={{ marginTop: 2 }}>
              <Button size="small" onClick={() => pickTo(k)} type={inTo ? 'primary' : 'default'}
                style={inTo ? { background: TO_COLOR, borderColor: TO_COLOR } : rec === 'to' ? { borderColor: TO_COLOR, color: TO_COLOR } : undefined}>收</Button>
              <Button size="small" onClick={() => pickCc(k)} type={inCc ? 'primary' : 'default'}
                style={inCc ? { background: CC_COLOR, borderColor: CC_COLOR } : rec === 'cc' ? { borderColor: CC_COLOR, color: CC_COLOR } : undefined}>副</Button>
            </Space>
            <div style={{ flex: 1 }}>
              <div className="page-desc" style={{ marginTop: 0, marginBottom: 6 }}>{[c.brand, c.category].filter(Boolean).join(' · ')}</div>
              {c.owner_name_zh && (<div style={{ marginBottom: 4 }}><b>{c.owner_name_zh}</b> {c.owner_name_en && <Tag color="green">{c.owner_name_en}</Tag>}</div>)}
              {c.backup_name_zh && (<div style={{ marginBottom: 4, fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>職代：{c.backup_name_zh} {c.backup_name_en && <Tag>{c.backup_name_en}</Tag>}</div>)}
              {c.note && <div className="page-desc">{c.note}</div>}
            </div>
          </div>
        </Card>
      </Col>
    );
  };

  const renderSubGroup = (sub, list) => (
    <div key={sub} style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 10px' }}>
        <div className="group-title" style={{ margin: 0 }}>{sub}</div>
        <Button size="small" type="text" onClick={() => selectGroup(list)} style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>全選此區（依建議）</Button>
      </div>
      <Row gutter={[12, 12]}>{list.map(renderCard)}</Row>
    </div>
  );

  const total = toSel.length + ccSel.length;

  return (
    <div style={{ paddingBottom: total ? 76 : 0 }}>
      <p className="page-desc">
        分頁切換<b>業務／版師主管／TD／運籌</b>。可先點下方「品牌快捷」一鍵帶出整份名單，再手動微調各卡「
        <b style={{ color: TO_COLOR }}>收</b>/<b style={{ color: CC_COLOR }}>副</b>」。完成後「開啟郵件」或「複製」貼到 Gmail/Outlook。
        職代自動帶入；<b>TD 群組信箱一律自動加入副本</b>。
      </p>

      {bizLayer && (
        <Space wrap style={{ marginBottom: 8 }}>
          <span style={{ color: 'rgba(0,0,0,0.55)', fontSize: 13 }}>品牌快捷：</span>
          {bizLayer.subOrder.map((sub) => (
            <Button key={sub} size="small" onClick={() => applyBrandPreset(sub)}>{sub}</Button>
          ))}
        </Space>
      )}

      <Tabs items={layers.order.map((L) => {
        const layer = layers.byLayer[L];
        return {
          key: L,
          label: `${L}（${layer.count}）`,
          children: <div>{layer.subOrder.map((S) => renderSubGroup(S, layer.subs[S]))}</div>,
        };
      })} />

      {total > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
          background: '#fff', borderTop: '1px solid #e8e8e8', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
          padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <b style={{ color: TO_COLOR }}>收件者 {toSel.length} 位</b>
          <b style={{ color: CC_COLOR }}>副本 {ccSel.length} 位{tdGroupTokens.length ? '＋TD群組' : ''}</b>
          <div style={{ flex: 1 }} />
          <Space wrap>
            <Button icon={<ClearOutlined />} onClick={clearAll}>清除</Button>
            <Button icon={<CopyOutlined />} onClick={() => copy(toTokens(), '收件者')} disabled={!toSel.length}>複製收件者</Button>
            <Button icon={<CopyOutlined />} onClick={() => copy(ccTokens(), '副本')} disabled={!ccTokens().length}>複製副本</Button>
            <Button type="primary" icon={<MailOutlined />} onClick={openMail}>開啟郵件</Button>
          </Space>
        </div>
      )}
    </div>
  );
}
