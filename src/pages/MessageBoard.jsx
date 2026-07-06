import { useEffect, useState } from 'react';
import { Empty, Input, Button, Space, Modal, Select, Tag, message } from 'antd';
import { sb } from '../supabase';

const DEPARTMENT_OPTIONS = ['開發處內部', '業務', 'DPC', '客人', '其他'];
const DEPARTMENT_COLOR = { 開發處內部: 'blue', 業務: 'orange', DPC: 'purple', 客人: 'green', 其他: 'default' };

export default function MessageBoardPage() {
  const [rows, setRows] = useState([]);
  const load = () => {
    sb.from('messages').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) { message.error('留言載入失敗：' + error.message); return; }
      setRows(data || []);
    });
  };
  useEffect(load, []);

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
    message.success('登入成功，現在可以管理留言'); setLoginOpen(false); setPw('');
  };
  const doLogout = async () => { await sb.auth.signOut(); message.info('已登出'); };

  // 發文
  const [authorName, setAuthorName] = useState('');
  const [department, setDepartment] = useState();
  const [content, setContent] = useState('');
  const submit = async () => {
    const name = authorName.trim(), text = content.trim();
    if (!name || !department || !text) { message.warning('請輸入姓名、部門與內容'); return; }
    const { data, error } = await sb.from('messages').insert({ author_name: name, department, content: text }).select().single();
    if (error) { message.error('送出失敗：' + error.message); return; }
    setRows((r) => [data, ...(r || [])]);
    setContent('');
    message.success('留言成功');
  };

  const remove = async (id) => {
    const { error } = await sb.from('messages').delete().eq('id', id);
    if (error) { message.error('刪除失敗：' + error.message); return; }
    setRows((r) => r.filter((m) => m.id !== id));
    message.success('已刪除');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <p className="page-desc" style={{ flex: 1 }}>team 留言交流，任何人都能留言；登入後可管理（刪除）留言。</p>
        {loggedIn ? (
          <Space><span className="page-desc" style={{ margin: 0 }}>👤 {session.user.email}</span><Button size="small" onClick={doLogout}>登出</Button></Space>
        ) : (
          <Button size="small" onClick={() => setLoginOpen(true)}>🔒 登入以管理</Button>
        )}
      </div>

      <Space direction="vertical" style={{ width: '100%', margin: '12px 0' }}>
        <Space wrap>
          <Input placeholder="你的姓名" value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={50} style={{ width: 200 }} />
          <Select placeholder="選擇部門" value={department} onChange={setDepartment} style={{ width: 160 }}
            options={DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))} />
        </Space>
        <Input.TextArea placeholder="留言內容…" value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} rows={3} />
        <Button type="primary" onClick={submit}>送出</Button>
      </Space>

      {!rows.length ? (
        <Empty description="目前還沒有留言，來留第一則吧！" />
      ) : (
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '4px 14px' }}>
          {rows.map((m) => (
            <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600 }}>{m.author_name}</span>
                  {m.department && <Tag color={DEPARTMENT_COLOR[m.department] || 'default'}>{m.department}</Tag>}
                  <span className="page-desc" style={{ margin: 0, fontSize: 12 }}>{new Date(m.created_at).toLocaleString()}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
              {loggedIn && <Button size="small" danger onClick={() => remove(m.id)}>刪除</Button>}
            </div>
          ))}
        </div>
      )}

      <Modal title="登入以管理留言" open={loginOpen} onOk={doLogin} onCancel={() => setLoginOpen(false)} okText="登入" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} onPressEnter={doLogin} />
          <Input.Password placeholder="密碼" value={pw} onChange={(e) => setPw(e.target.value)} onPressEnter={doLogin} />
        </Space>
      </Modal>
    </div>
  );
}
