import { useEffect, useRef, useState } from 'react';
import { Empty, Input, Button, Space, Modal, Select, Tag, Image, message } from 'antd';
import { DeleteOutlined, PictureOutlined, CheckOutlined, UndoOutlined } from '@ant-design/icons';
import { sb } from '../supabase';

const DEPARTMENT_OPTIONS = ['開發處內部', '業務', 'DPC', '客人', '其他'];
const DEPARTMENT_COLOR = { 開發處內部: 'blue', 業務: 'orange', DPC: 'purple', 客人: 'green', 其他: 'default' };
const IMAGE_BUCKET = 'message-images';
const imgPublicUrl = (path) => sb.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
// Supabase Storage 的 key 不接受中文等非 ASCII 字元（例如螢幕截圖預設檔名「影像.png」），只留副檔名、其餘用亂碼檔名避免衝突
const safeStoragePath = (file) => {
  const m = file.name.match(/\.[a-zA-Z0-9]+$/);
  const ext = m ? m[0] : '';
  return `${crypto.randomUUID()}${ext}`;
};

// 剪貼簿裡的圖片（螢幕截圖直接 Ctrl+V），大家最常用的貼圖方式
const imagesFromClipboard = (e) => Array.from(e.clipboardData?.items || [])
  .filter((it) => it.type.startsWith('image/'))
  .map((it) => it.getAsFile())
  .filter(Boolean);

// 預覽用的 blob URL 只在檔案清單變動時重建並回收，避免每打一個字重新 render 就洩漏一批 URL
function useObjectUrls(files) {
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  return urls;
}

// 待上傳圖片的縮圖＋移除鈕
function Thumb({ src, onRemove }) {
  return (
    <div style={{ position: 'relative' }}>
      <img src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }} />
      <Button size="small" danger shape="circle" icon={<DeleteOutlined />}
        style={{ position: 'absolute', top: -8, right: -8 }} onClick={onRemove} />
    </div>
  );
}

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
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const previews = useObjectUrls(files);

  const onFilesSelected = (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles((f) => [...f, ...picked]);
    e.target.value = '';
  };
  const removeFile = (idx) => setFiles((f) => f.filter((_, i) => i !== idx));
  const onPaste = (e) => {
    const imgs = imagesFromClipboard(e);
    if (!imgs.length) return;
    e.preventDefault();
    setFiles((f) => [...f, ...imgs]);
    message.success(`已貼上 ${imgs.length} 張圖片`);
  };

  const submit = async () => {
    const name = authorName.trim(), text = content.trim();
    if (!name || !department || !text) { message.warning('請輸入姓名、部門與內容'); return; }
    setSubmitting(true);
    const imagePaths = [];
    for (const file of files) {
      const path = safeStoragePath(file);
      const { error: upErr } = await sb.storage.from(IMAGE_BUCKET).upload(path, file);
      if (upErr) { message.error('圖片上傳失敗：' + upErr.message); setSubmitting(false); return; }
      imagePaths.push(path);
    }
    const { data, error } = await sb.from('messages')
      .insert({ author_name: name, department, content: text, images: imagePaths }).select().single();
    setSubmitting(false);
    if (error) { message.error('送出失敗：' + error.message); return; }
    setRows((r) => [data, ...(r || [])]);
    setContent(''); setFiles([]);
    message.success('留言成功');
  };

  const toggleResolved = async (m) => {
    const { data, error } = await sb.from('messages').update({ resolved: !m.resolved }).eq('id', m.id).select().single();
    if (error) { message.error('更新失敗：' + error.message); return; }
    setRows((r) => r.map((x) => (x.id === m.id ? data : x)));
    message.success(data.resolved ? '已標記為已解決' : '已取消標記');
  };

  const remove = async (id) => {
    const target = rows.find((m) => m.id === id);
    if (target?.images?.length) await sb.storage.from(IMAGE_BUCKET).remove(target.images);
    const { error } = await sb.from('messages').delete().eq('id', id);
    if (error) { message.error('刪除失敗：' + error.message); return; }
    setRows((r) => r.filter((m) => m.id !== id));
    message.success('已刪除');
  };

  // 編輯
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState();
  const [editContent, setEditContent] = useState('');
  const [editImages, setEditImages] = useState([]); // 保留的舊圖片路徑
  const [editNewFiles, setEditNewFiles] = useState([]); // 新增的圖片
  const [savingEdit, setSavingEdit] = useState(false);
  const editFileInputRef = useRef(null);
  const editPreviews = useObjectUrls(editNewFiles);

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditName(m.author_name);
    setEditDept(m.department);
    setEditContent(m.content);
    setEditImages(m.images || []);
    setEditNewFiles([]);
  };
  const cancelEdit = () => setEditingId(null);
  const onEditFilesSelected = (e) => {
    const picked = Array.from(e.target.files || []);
    setEditNewFiles((f) => [...f, ...picked]);
    e.target.value = '';
  };
  const onEditPaste = (e) => {
    const imgs = imagesFromClipboard(e);
    if (!imgs.length) return;
    e.preventDefault();
    setEditNewFiles((f) => [...f, ...imgs]);
    message.success(`已貼上 ${imgs.length} 張圖片`);
  };

  const saveEdit = async (id) => {
    const name = editName.trim(), text = editContent.trim();
    if (!name || !editDept || !text) { message.warning('請輸入姓名、部門與內容'); return; }
    setSavingEdit(true);
    const removed = (rows.find((m) => m.id === id)?.images || []).filter((p) => !editImages.includes(p));
    if (removed.length) await sb.storage.from(IMAGE_BUCKET).remove(removed);
    const newPaths = [];
    for (const file of editNewFiles) {
      const path = safeStoragePath(file);
      const { error: upErr } = await sb.storage.from(IMAGE_BUCKET).upload(path, file);
      if (upErr) { message.error('圖片上傳失敗：' + upErr.message); setSavingEdit(false); return; }
      newPaths.push(path);
    }
    const images = [...editImages, ...newPaths];
    const { data, error } = await sb.from('messages')
      .update({ author_name: name, department: editDept, content: text, images }).eq('id', id).select().single();
    setSavingEdit(false);
    if (error) { message.error('儲存失敗：' + error.message); return; }
    setRows((r) => r.map((m) => (m.id === id ? data : m)));
    setEditingId(null);
    message.success('已更新');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <p className="page-desc" style={{ flex: 1 }}>team 留言交流，任何人都能留言；登入後可管理（編輯／刪除）留言。</p>
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
        <Input.TextArea placeholder="留言內容…（截圖可直接 Ctrl+V 貼進來）" value={content}
          onChange={(e) => setContent(e.target.value)} onPaste={onPaste} maxLength={2000} rows={3} />
        <Space align="center">
          <Button icon={<PictureOutlined />} onClick={() => fileInputRef.current?.click()}>加圖片</Button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFilesSelected} style={{ display: 'none' }} />
          <span className="page-desc" style={{ margin: 0 }}>
            {files.length > 0 ? `已選 ${files.length} 張` : '可一次選多張（按住 Ctrl 複選），或直接 Ctrl+V 貼上截圖'}
          </span>
        </Space>
        {files.length > 0 && (
          <Space wrap>
            {files.map((f, i) => (
              <Thumb key={i} src={previews[i]} onRemove={() => removeFile(i)} />
            ))}
          </Space>
        )}
        <Button type="primary" onClick={submit} loading={submitting}>送出</Button>
      </Space>

      {!rows.length ? (
        <Empty description="目前還沒有留言，來留第一則吧！" />
      ) : (
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '4px 14px' }}>
          {rows.map((m) => (
            <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f5f5f5', opacity: m.resolved && editingId !== m.id ? 0.55 : 1 }}>
              {editingId === m.id ? (
                <div style={{ flex: 1 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space wrap>
                      <Input placeholder="你的姓名" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} style={{ width: 200 }} />
                      <Select placeholder="選擇部門" value={editDept} onChange={setEditDept} style={{ width: 160 }}
                        options={DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))} />
                    </Space>
                    <Input.TextArea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      onPaste={onEditPaste} maxLength={2000} rows={3} />
                    <Space wrap>
                      {editImages.map((path, i) => (
                        <Thumb key={path} src={imgPublicUrl(path)}
                          onRemove={() => setEditImages((imgs) => imgs.filter((_, j) => j !== i))} />
                      ))}
                      {editNewFiles.map((f, i) => (
                        <Thumb key={i} src={editPreviews[i]}
                          onRemove={() => setEditNewFiles((fs) => fs.filter((_, j) => j !== i))} />
                      ))}
                      <Button icon={<PictureOutlined />} onClick={() => editFileInputRef.current?.click()}>加圖片</Button>
                      <input ref={editFileInputRef} type="file" accept="image/*" multiple onChange={onEditFilesSelected} style={{ display: 'none' }} />
                    </Space>
                    <Space>
                      <Button type="primary" onClick={() => saveEdit(m.id)} loading={savingEdit}>儲存</Button>
                      <Button onClick={cancelEdit}>取消</Button>
                    </Space>
                  </Space>
                </div>
              ) : (
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600 }}>{m.author_name}</span>
                    {m.department && <Tag color={DEPARTMENT_COLOR[m.department] || 'default'}>{m.department}</Tag>}
                    {m.resolved && <Tag color="success" icon={<CheckOutlined />}>已解決</Tag>}
                    <span className="page-desc" style={{ margin: 0, fontSize: 12 }}>{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  {m.images?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Image.PreviewGroup>
                        <Space wrap>
                          {m.images.map((path, i) => (
                            <Image key={i} src={imgPublicUrl(path)}
                              style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }} />
                          ))}
                        </Space>
                      </Image.PreviewGroup>
                    </div>
                  )}
                </div>
              )}
              {loggedIn && editingId !== m.id && (
                <Space>
                  <Button size="small" icon={m.resolved ? <UndoOutlined /> : <CheckOutlined />} onClick={() => toggleResolved(m)}>
                    {m.resolved ? '取消已解決' : '標記已解決'}
                  </Button>
                  <Button size="small" onClick={() => startEdit(m)}>編輯</Button>
                  <Button size="small" danger onClick={() => remove(m.id)}>刪除</Button>
                </Space>
              )}
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
