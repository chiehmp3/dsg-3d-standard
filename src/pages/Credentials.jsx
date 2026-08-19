import { useMemo, useState } from 'react';
import { Card, Col, Row, Button, Space, Empty, Typography, App } from 'antd';
import { LockOutlined, UnlockOutlined, LinkOutlined, CopyOutlined } from '@ant-design/icons';
import { Reveal } from '../components/CardItem';

// 解鎖狀態只記在這個瀏覽器分頁，關掉就要再答一次
const UNLOCK_KEY = 'dsg-accounts-unlocked';

// 這道題只是「內部人才知道答案」的門檻，擋掉路過的人；
// 網站本身是公開的，題目、答案、帳密都存在公開可讀的資料庫，能看原始碼的人一樣拿得到。
function Gate({ question, options, answer, onPass }) {
  const { message } = App.useApp();
  const [wrong, setWrong] = useState(false);
  const pick = (opt) => {
    if (opt === answer) {
      sessionStorage.setItem(UNLOCK_KEY, '1');
      onPass();
      message.success('已解鎖');
      return;
    }
    setWrong(true);
    message.error('答案不對，再想想');
  };
  return (
    <Card style={{ maxWidth: 520, borderColor: wrong ? undefined : 'var(--border)' }}>
      <Space align="start" size={14}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>🔒</span>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{question}</div>
          <Space wrap>
            {options.map((o) => (
              <Button key={o} onClick={() => pick(o)} autoInsertSpace={false}>{o}</Button>
            ))}
          </Space>
        </div>
      </Space>
    </Card>
  );
}

function CredentialCard({ row }) {
  const { message } = App.useApp();
  const copy = (v, what) => { navigator.clipboard.writeText(v); message.success(`已複製${what}`); };
  return (
    <Card size="small" style={{ height: '100%' }}
      title={<span style={{ fontWeight: 600 }}>🔑 {row.label}</span>}>
      {row.account && (
        <div className="cred-row">
          <span className="cred-key">帳號</span>
          <span className="mono cred-val">{row.account}</span>
          <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copy(row.account, '帳號')} />
        </div>
      )}
      {row.password && (
        <div className="cred-row">
          <span className="cred-key">密碼</span>
          <span className="cred-val"><Reveal text={row.password} /></span>
          <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copy(row.password, '密碼')} />
        </div>
      )}
      {row.url && (
        <div className="cred-row">
          <span className="cred-key">連結</span>
          <Button size="small" icon={<LinkOutlined />} href={row.url} target="_blank">開啟</Button>
          <Typography.Text className="path-val" ellipsis={{ tooltip: row.url }}>{row.url}</Typography.Text>
        </div>
      )}
      {row.note && <div className="page-desc" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{row.note}</div>}
    </Card>
  );
}

export default function CredentialsPage({ data }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1');
  const rows = data.credentials || [];
  const s = data.settings || {};
  const options = useMemo(
    () => (s.unlock_options || '').split('|').map((o) => o.trim()).filter(Boolean),
    [s.unlock_options],
  );

  if (!s.unlock_question || !options.length || !s.unlock_answer) {
    return <Empty description="解鎖題目還沒設定（app_settings 的 unlock_question / unlock_options / unlock_answer）" />;
  }

  if (!unlocked) {
    return (
      <div>
        <p className="page-desc" style={{ marginBottom: 14 }}>答對問題才會顯示帳密，關掉瀏覽器後要重新解鎖。</p>
        <Gate question={s.unlock_question} options={options} answer={s.unlock_answer}
          onPass={() => setUnlocked(true)} />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 14 }}>
        <UnlockOutlined style={{ color: 'var(--brand)' }} />
        <span className="page-desc" style={{ margin: 0 }}>已解鎖。密碼點眼睛圖示才顯示。</span>
        <Button size="small" icon={<LockOutlined />}
          onClick={() => { sessionStorage.removeItem(UNLOCK_KEY); setUnlocked(false); }}>重新鎖上</Button>
      </Space>
      {!rows.length ? (
        <Empty description="還沒有任何帳密資料" />
      ) : (
        <Row gutter={[12, 12]}>
          {rows.map((r) => (
            <Col key={r.id} xs={24} sm={12} lg={8}><CredentialCard row={r} /></Col>
          ))}
        </Row>
      )}
    </div>
  );
}
