import { useEffect, useMemo, useState } from 'react';
import { Collapse, Menu, Tag, Button, Space, Empty, Modal, Input, App } from 'antd';
import { SwapOutlined, LockOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { groupByName } from '../data';
import { CardHeader, CardBody } from '../components/CardItem';
import { SOURCE_TAG } from '../theme';

// Prefit／細節：卡片多，全部展開會太長，改用左側分頁＋右側單一內容檢視
const TAB_LAYOUT_SLUGS = ['prefit', 'construction'];

// 左側選單的精簡標籤：單行截斷＋來源標籤靠右，避免在窄欄位裡被擠成兩三行
function TabLabel({ entry }) {
  const tag = SOURCE_TAG[entry.source] || SOURCE_TAG.internal;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.title}>
        {entry.title}
      </span>
      <Tag color={tag.color} style={{ margin: 0, flexShrink: 0 }}>{tag.label}</Tag>
    </span>
  );
}

// 分頁式檢視：左側依 group_name 分組的可捲動選單（大標題點開才展開子項，一次只開一組）
// 右側只顯示目前選到那一張卡的內容
function TabReadView({ entries }) {
  const groups = useMemo(() => groupByName(entries), [entries]);
  const groupKey = (g, gi) => g.name || `_group_${gi}`;

  const [activeId, setActiveId] = useState(entries[0]?.id);
  useEffect(() => {
    if (!entries.some((e) => e.id === activeId)) setActiveId(entries[0]?.id);
  }, [entries]);
  const active = entries.find((e) => e.id === activeId) || entries[0];

  const activeGroupKey = useMemo(() => {
    const gi = groups.findIndex((g) => g.items.some((e) => e.id === active?.id));
    return gi >= 0 ? groupKey(groups[gi], gi) : undefined;
  }, [groups, active]);

  const [openKeys, setOpenKeys] = useState(activeGroupKey ? [activeGroupKey] : []);
  useEffect(() => { if (activeGroupKey) setOpenKeys([activeGroupKey]); }, [activeGroupKey]);

  if (!entries.length) return <Empty description="此分類尚無內容" />;

  const menuItems = groups.map((g, gi) => ({
    key: groupKey(g, gi),
    label: g.name || '其他',
    children: g.items.map((e) => ({ key: e.id, label: <TabLabel entry={e} /> })),
  }));
  // 手風琴模式：一次只展開一個大標題
  const onOpenChange = (keys) => {
    const latest = keys.find((k) => !openKeys.includes(k));
    setOpenKeys(latest ? [latest] : []);
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 260px)', minHeight: 420 }}>
      <div style={{ width: 300, flexShrink: 0, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff' }}>
        <Menu mode="inline" selectedKeys={[active?.id]} openKeys={openKeys} onOpenChange={onOpenChange}
          items={menuItems} onClick={({ key }) => setActiveId(key)} style={{ borderInlineEnd: 'none' }} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff', padding: '16px 20px' }}>
        {active && (
          <>
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
              <CardHeader entry={active} />
            </div>
            <CardBody entry={active} />
          </>
        )}
      </div>
    </div>
  );
}

// 一般（唯讀）檢視：依 group_name 分子群組，每群組一個 Collapse
function ReadView({ entries }) {
  const groups = useMemo(() => groupByName(entries), [entries]);
  if (!entries.length) return <Empty description="此分類尚無內容" />;
  return (
    <div>
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.name && <div className="group-title">{g.name}</div>}
          <Collapse
            accordion={false}
            bordered
            items={g.items.map((e) => ({
              key: e.id,
              label: <CardHeader entry={e} />,
              children: <CardBody entry={e} />,
            }))}
            style={{ background: '#fff', marginBottom: 12 }}
          />
        </div>
      ))}
    </div>
  );
}

function SortableRow({ entry }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', marginBottom: 8,
    background: '#fff', border: '1px dashed #f89b34', borderRadius: 8,
    cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <HolderOutlined style={{ color: '#f89b34' }} />
      <CardHeader entry={entry} />
    </div>
  );
}

export default function SectionPage({ section, data }) {
  const { message } = App.useApp();
  const entries = useMemo(
    () => data.entries
      .filter((e) => e.section_id === section.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [data.entries, section.id],
  );
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState([]);
  const [sql, setSql] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const startReorder = () => { setOrder(entries.map((e) => e.id)); setEditing(true); };
  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setOrder((o) => arrayMove(o, o.indexOf(active.id), o.indexOf(over.id)));
    }
  };
  const lock = () => {
    const lines = order.map((id, i) => `update public.entries set sort_order=${i + 1} where id='${id}';`);
    setSql('-- 排序更新（貼到 Supabase SQL Editor 執行即可固定順序）\n' + lines.join('\n'));
    setEditing(false);
  };

  const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
  const orderedEntries = editing ? order.map((id) => byId[id]).filter(Boolean) : entries;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        {!editing ? (
          <Button icon={<SwapOutlined rotate={90} />} onClick={startReorder} disabled={!entries.length}>調整排序</Button>
        ) : (
          <>
            <span style={{ color: 'rgba(0,0,0,0.5)' }}>拖曳卡片調整順序，完成後按「鎖定」</span>
            <Button type="primary" icon={<LockOutlined />} onClick={lock}>鎖定並儲存</Button>
            <Button onClick={() => setEditing(false)}>取消</Button>
          </>
        )}
      </Space>

      {editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {orderedEntries.map((e) => <SortableRow key={e.id} entry={e} />)}
          </SortableContext>
        </DndContext>
      ) : TAB_LAYOUT_SLUGS.includes(section.slug) ? (
        <TabReadView entries={entries} />
      ) : (
        <ReadView entries={entries} />
      )}

      <Modal
        open={!!sql}
        title="🔒 排序已鎖定 — 貼到 Supabase 執行即永久生效"
        onCancel={() => setSql(null)}
        footer={[
          <Button key="copy" type="primary" onClick={() => { navigator.clipboard.writeText(sql); message.success('已複製 SQL'); }}>複製 SQL</Button>,
          <Button key="close" onClick={() => setSql(null)}>關閉</Button>,
        ]}
      >
        <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>要讓所有人都看到這個順序，請把下面 SQL 貼到 Supabase → SQL Editor → Run。</p>
        <Input.TextArea value={sql || ''} readOnly autoSize={{ minRows: 6, maxRows: 12 }} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }} />
      </Modal>
    </div>
  );
}
