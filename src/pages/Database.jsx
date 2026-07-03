import { useEffect, useState } from 'react';
import { Card, Button, Input, Modal, Space, App } from 'antd';
import { EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { sb } from '../supabase';
import SectionPage from './Section';

// 資料庫分頁：頂端顯示/編輯 CLO 版本，下方沿用一般 SectionPage 顯示資料夾卡
export default function DatabasePage({ section, data }) {
  const { message } = App.useApp();
  const [version, setVersion] = useState(data.settings?.clo_version || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // 登入狀態
  const [session, setSession] = useState(null);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const loggedIn = !!session;

  // 登入對話框
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const doLogin = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) { message.error('登入失敗：' + error.message); return; }
    message.success('登入成功，可編輯版本'); setLoginOpen(false); setPw('');
  };

  const startEdit = () => { setDraft(version); setEditing(true); };
  const save = async () => {
    const v = draft.trim();
    const { error } = await sb.from('app_settings')
      .update({ value: v, updated_at: new Date().toISOString() })
      .eq('key', 'clo_version');
    if (error) { message.error('儲存失敗：' + error.message); return; }
    setVersion(v); setEditing(false); message.success('版本已更新');
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 20, borderColor: '#006150', background: '#f6fbf9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>🖥️</span>
          <span style={{ color: 'rgba(0,0,0,0.55)' }}>目前 CLO 版本</span>
          {editing ? (
            <Space>
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} onPressEnter={save}
                style={{ width: 180 }} placeholder="例：2026.0.312" />
              <Button type="primary" size="small" icon={<CheckOutlined />} onClick={save}>儲存</Button>
              <Button size="small" icon={<CloseOutlined />} onClick={() => setEditing(false)}>取消</Button>
            </Space>
          ) : (
            <>
              <b className="mono" style={{ fontSize: 20, color: '#006150' }}>{version || '—'}</b>
              {loggedIn ? (
                <Button size="small" icon={<EditOutlined />} onClick={startEdit}>編輯</Button>
              ) : (
                <Button size="small" type="text" onClick={() => setLoginOpen(true)} style={{ color: 'rgba(0,0,0,0.45)' }}>🔒 登入以編輯</Button>
              )}
            </>
          )}
        </div>
      </Card>

      <SectionPage section={section} data={data} />

      <Modal title="登入以編輯" open={loginOpen} onOk={doLogin} onCancel={() => setLoginOpen(false)} okText="登入" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} onPressEnter={doLogin} />
          <Input.Password placeholder="密碼" value={pw} onChange={(e) => setPw(e.target.value)} onPressEnter={doLogin} />
        </Space>
      </Modal>
    </div>
  );
}
