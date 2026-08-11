import { useMemo, useState } from 'react';
import { Collapse, Button, Space, Empty, Modal, Input, App } from 'antd';
import { SwapOutlined, LockOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { groupByName } from '../data';
import { CardHeader, CardBody } from '../components/CardItem';
import GroupButtons from '../components/GroupButtons';
import { StageBar, StageInfo, QuickPaths, FIRST_STAGE, stageLabel, STAGE_INFO_SLUG, QUICK_PATHS_SLUG } from '../components/StageBar';

// 卡片較多的頁面：不用手風琴，改用頁面上方的分組按鈕列（點按鈕，下面直接顯示內容）
const BUTTON_LAYOUT_SLUGS = ['prefit', 'prefit-flow', 'detail-flow', 'upload'];

// 依開發階段分流的頁面：上方多一排 Stage 按鈕，只顯示該階段的卡片
const STAGE_LAYOUT_SLUGS = ['prefit-flow', 'detail-flow'];
const SKIP_NOTE = { 'prefit-flow': '不需 Prefit', 'detail-flow': '不需細節' };

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
            style={{ background: 'var(--surface)', marginBottom: 12 }}
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
    background: 'var(--surface)', border: '1px dashed var(--accent)', borderRadius: 8,
    cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <HolderOutlined style={{ color: 'var(--accent)' }} />
      <CardHeader entry={entry} />
    </div>
  );
}

export default function SectionPage({ section, data }) {
  const { message } = App.useApp();
  const isStageLayout = STAGE_LAYOUT_SLUGS.includes(section.slug);
  const [stage, setStage] = useState(FIRST_STAGE);

  const sectionEntries = useMemo(
    () => data.entries
      .filter((e) => e.section_id === section.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [data.entries, section.id],
  );
  // 分階段的頁面一次只看一個階段，排序、顯示都只針對目前這個階段的卡片
  const entries = useMemo(
    () => (isStageLayout ? sectionEntries.filter((e) => e.stage === stage) : sectionEntries),
    [sectionEntries, isStageLayout, stage],
  );

  // 階段說明與常用路徑存在不顯示於側邊欄的 section，兩個流程頁共用同一份資料
  const stageInfo = useMemo(() => {
    const sec = data.sections.find((s) => s.slug === STAGE_INFO_SLUG);
    return sec ? data.entries.find((e) => e.section_id === sec.id && e.stage === stage) : null;
  }, [data.sections, data.entries, stage]);
  const quickPaths = useMemo(() => {
    const sec = data.sections.find((s) => s.slug === QUICK_PATHS_SLUG);
    return sec ? data.entries.find((e) => e.section_id === sec.id) : null;
  }, [data.sections, data.entries]);

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
      {isStageLayout && (
        <>
          <StageBar value={stage} onChange={setStage} skipNote={SKIP_NOTE[section.slug]} />
          <StageInfo entry={stageInfo} />
          <QuickPaths entry={quickPaths} />
        </>
      )}

      <Space style={{ marginBottom: 16 }}>
        {!editing ? (
          <Button icon={<SwapOutlined rotate={90} />} onClick={startReorder} disabled={!entries.length}>調整排序</Button>
        ) : (
          <>
            <span style={{ color: 'var(--text-muted)' }}>拖曳卡片調整順序，完成後按「鎖定」</span>
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
      ) : BUTTON_LAYOUT_SLUGS.includes(section.slug) ? (
        <GroupButtons
          entries={entries}
          emptyText={isStageLayout ? `${stageLabel(stage)} 階段的內容還沒建立` : undefined}
        />
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
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>要讓所有人都看到這個順序，請把下面 SQL 貼到 Supabase → SQL Editor → Run。</p>
        <Input.TextArea value={sql || ''} readOnly autoSize={{ minRows: 6, maxRows: 12 }} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }} />
      </Modal>
    </div>
  );
}
