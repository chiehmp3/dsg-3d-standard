import { useEffect, useMemo, useState } from 'react';
import { Layout, Menu, Input, Spin, Alert, Empty, Button, Space } from 'antd';
import { loadAll } from './data';
import { sb } from './supabase';
import SectionPage from './pages/Section';
import ChecklistPage from './pages/Checklist';
import AvatarPage from './pages/Avatar';
import TrackerPage from './pages/Tracker';
import DatabasePage from './pages/Database';
import ContactsPage from './pages/Contacts';
import SearchPage from './pages/Search';
import MessageBoardPage from './pages/MessageBoard';

const { Sider, Header, Content } = Layout;

const EXTRA_MGMT = [
  { key: 'contacts', label: '👥 聯絡人' },
  { key: 'feedback', label: '💬 留言板' },
];

export default function App() {
  const [data, setData] = useState(null);
  const [slug, setSlug] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadAll().then((d) => {
      setData(d);
      const h = decodeURIComponent(location.hash.replace('#', ''));
      const valid = d.sections.some((s) => s.slug === h) || h === 'contacts' || h === 'feedback';
      setSlug(valid && h ? h : d.sections[0]?.slug || null);
    });
  }, []);
  useEffect(() => { if (slug && !query.trim()) location.hash = slug; }, [slug, query]);

  const menuItems = useMemo(() => {
    if (!data) return [];
    const bySide = {}, order = [];
    data.sections.forEach((s) => { if (!bySide[s.group_name]) { bySide[s.group_name] = []; order.push(s.group_name); } bySide[s.group_name].push(s); });
    return order.map((gn) => ({
      type: 'group', label: gn,
      children: [
        ...bySide[gn].map((s) => ({ key: s.slug, label: `${s.icon || ''} ${s.name}` })),
        ...(gn === '管理' ? EXTRA_MGMT : []),
      ],
    }));
  }, [data]);

  if (!data) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>;
  if (data.error || !data.sections.length) {
    return (
      <div style={{ maxWidth: 480, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <Alert type="warning" showIcon
          message="內容載入不完整"
          description="可能是登入權限或連線暫時異常。請先「重新載入」；若仍空白，按「登出並重新載入」以訪客身分開啟。" />
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={() => location.reload()}>重新載入</Button>
          <Button onClick={async () => { try { await sb.auth.signOut(); } catch (e) { /* ignore */ } location.reload(); }}>登出並重新載入</Button>
        </Space>
      </div>
    );
  }

  const renderContent = () => {
    if (query.trim()) return <SearchPage data={data} query={query} onOpen={(s) => { setQuery(''); setSlug(s); }} />;
    if (slug === 'contacts') return <><h1 style={{ fontSize: 24, marginTop: 0 }}>👥 聯絡人</h1><ContactsPage data={data} /></>;
    if (slug === 'feedback') return <><h1 style={{ fontSize: 24, marginTop: 0 }}>💬 留言板</h1><MessageBoardPage /></>;
    const section = data.sections.find((s) => s.slug === slug);
    if (!section) return <Empty description="找不到此分類" />;
    let body;
    if (section.slug === 'checklist') body = <ChecklistPage section={section} data={data} />;
    else if (section.slug === 'avatar') body = <AvatarPage section={section} data={data} />;
    else if (section.slug === 'tracker-info') body = <TrackerPage section={section} data={data} />;
    else if (section.slug === 'database') body = <DatabasePage section={section} data={data} />;
    else body = <SectionPage section={section} data={data} />;
    return (
      <>
        <h1 style={{ fontSize: 24, marginTop: 0, marginBottom: 16 }}>{section.icon} {section.name}</h1>
        {body}
      </>
    );
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #f0f0f0', padding: '0 20px' }}>
        <span className="dsg-logo">DSG</span>
        <span style={{ fontSize: 18, fontWeight: 500 }}>DSG 3D Standard</span>
      </Header>
      <Layout>
        <Sider width={248} theme="light" breakpoint="lg" collapsedWidth={0} style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
          <div style={{ padding: 12 }}>
            <Input.Search placeholder="搜尋…" allowClear value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Menu mode="inline" selectedKeys={[query.trim() ? '' : slug]} items={menuItems}
            onClick={({ key }) => { setQuery(''); setSlug(key); }} style={{ borderInlineEnd: 'none' }} />
        </Sider>
        <Content style={{ overflow: 'auto', padding: '24px 32px' }}>{renderContent()}</Content>
      </Layout>
    </Layout>
  );
}
