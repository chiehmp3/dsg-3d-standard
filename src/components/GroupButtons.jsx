import { useEffect, useMemo, useState } from 'react';
import { Button, Empty } from 'antd';
import { groupByName } from '../data';
import { CardHeader, CardBody } from './CardItem';

// 把第二層（group_name）做成頁面上方的按鈕列，點下去下方直接顯示該組所有卡片的完整內容。
// 取代原本「左側手風琴選單」——同事反應要先點開大標題才看得到子項，多兩次點擊、不直覺。

// 沒有 group_name 的卡片（例如「人台」的前四張）不併成一個叫「其他」的大雜燴，
// 而是每張卡自己當一個按鈕，用卡片標題當按鈕文字。
function buildChips(entries) {
  return groupByName(entries).flatMap((g, gi) => (
    g.name
      ? [{ key: `g${gi}`, label: g.name, items: g.items }]
      : g.items.map((e) => ({ key: e.id, label: e.title, items: [e] }))
  ));
}

export default function GroupButtons({ entries, emptyText }) {
  const chips = useMemo(() => buildChips(entries), [entries]);
  const [activeKey, setActiveKey] = useState(chips[0]?.key);
  useEffect(() => {
    if (!chips.some((c) => c.key === activeKey)) setActiveKey(chips[0]?.key);
  }, [chips]);

  if (!entries.length) return <Empty description={emptyText || '此分類尚無內容'} />;
  const active = chips.find((c) => c.key === activeKey) || chips[0];

  return (
    <div>
      <div className="chip-row">
        {chips.map((c) => (
          <Button
            key={c.key}
            type={c.key === active?.key ? 'primary' : 'default'}
            onClick={() => setActiveKey(c.key)}
            /* antd 預設會在兩個中文字之間插一個空格（「顏色」→「顏 色」），這裡用的是原始標題，關掉 */
            autoInsertSpace={false}
          >
            {c.label}
          </Button>
        ))}
      </div>
      {active?.items.map((e) => (
        <div key={e.id} className="chip-panel">
          <div className="chip-panel-head"><CardHeader entry={e} /></div>
          <CardBody entry={e} />
        </div>
      ))}
    </div>
  );
}
