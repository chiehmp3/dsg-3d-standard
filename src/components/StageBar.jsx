import { Fragment } from 'react';
import { Button, Tooltip } from 'antd';
import { CardBody } from './CardItem';

// 開發階段（原本獨立的「開發階段流程」分頁，現在併進 Prefit流程／細節流程 頁面上方）。
// skip = 這個階段不做 Prefit 也不做細節，直接輸出 snapshot 給業務確認，所以按鈕反灰。
export const STAGES = [
  { key: 'PROTO', label: 'PROTO' },
  { key: 'FIT', label: 'FIT' },
  { key: 'CRS', label: 'CRS', skip: true },
  { key: 'PLACEMENT', label: '對條格定位', skip: true },
  { key: 'JSS', label: 'JSS' },
  { key: 'PP', label: 'PP' },
];

export const FIRST_STAGE = STAGES.find((s) => !s.skip).key;
export const stageLabel = (key) => STAGES.find((s) => s.key === key)?.label || key;

// 只當資料容器、不出現在側邊欄的 section
export const STAGE_INFO_SLUG = 'stages';
export const QUICK_PATHS_SLUG = 'quick-paths';

export function StageBar({ value, onChange, skipNote }) {
  return (
    <div className="stage-bar">
      {STAGES.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 && <span className="stage-arrow">→</span>}
          <div className="stage-cell">
            {/* 反灰的按鈕不會觸發滑鼠事件，Tooltip 要靠外層 span 才顯示得出來 */}
            <Tooltip title={s.skip ? skipNote : undefined}>
              <span>
                <Button
                  type={value === s.key ? 'primary' : 'default'}
                  disabled={s.skip}
                  autoInsertSpace={false}
                  onClick={() => onChange(s.key)}
                >
                  {s.label}
                </Button>
              </span>
            </Tooltip>
            {s.skip && <span className="stage-note">{skipNote}</span>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

// 選到的階段是什麼（目的／協作部門／布料／流程）
export function StageInfo({ entry }) {
  if (!entry) return null;
  return (
    <div className="stage-info">
      <div className="stage-info-title">{entry.title}</div>
      <CardBody entry={entry} />
    </div>
  );
}

// 常用路徑 & 連結：一筆資料、兩個流程頁共用，不隨階段變動
export function QuickPaths({ entry }) {
  if (!entry?.paths?.length) return null;
  return (
    <div className="chip-panel">
      <div className="chip-panel-head" style={{ fontWeight: 600 }}>📁 {entry.title}</div>
      <CardBody entry={entry} />
    </div>
  );
}
