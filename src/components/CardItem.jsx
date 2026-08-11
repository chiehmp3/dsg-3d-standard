import { useCallback, useEffect, useRef, useState } from 'react';
import { Tag, Typography, Image, Button, message } from 'antd';
import { LinkOutlined, MailOutlined, CopyOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { imgUrl, SOURCE_TAG } from '../theme';

// 點擊才顯示的內容（例如密碼），避免明文一直露在畫面上被路過的人看到
function Reveal({ text }) {
  const [shown, setShown] = useState(false);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className="mono">{shown ? text : '•'.repeat(Math.max(text.length, 6))}</span>
      <Button
        type="text" size="small" style={{ padding: '0 4px' }}
        icon={shown ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={() => setShown((s) => !s)}
      />
    </span>
  );
}

// 內文中的網址自動變連結；**文字** 變粗體；||文字|| 變點擊才顯示
function linkify(text) {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => {
    if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>;
    const chunks = p.split(/(\*\*[^*]+\*\*|\|\|[^|]+\|\|)/g);
    return <span key={i}>{chunks.map((c, j) => {
      const bold = c.match(/^\*\*([^*]+)\*\*$/);
      if (bold) return <strong key={j}>{bold[1]}</strong>;
      const secret = c.match(/^\|\|([^|]+)\|\|$/);
      if (secret) return <Reveal key={j} text={secret[1]} />;
      return c;
    })}</span>;
  });
}

function PathRow({ raw }) {
  const hasSep = raw.includes('｜');
  const label = hasSep ? raw.split('｜')[0].trim() : '';
  const value = hasSep ? raw.split('｜').slice(1).join('｜').trim() : raw.trim();
  const isUrl = value.startsWith('http');
  const isMail = value.includes('@') && !isUrl;
  const isPath = /^\\\\/.test(value) || /^[a-zA-Z]:\\/.test(value); // UNC 或本機路徑
  // 瀏覽器基於安全性會擋掉 file:// 連結導覽，網路路徑無法用按鈕直接開啟，改成一鍵複製路徑貼到檔案總管
  const copyPath = () => { navigator.clipboard.writeText(value); message.success('已複製路徑，貼到檔案總管網址列即可開啟'); };
  return (
    <div className="path-row">
      {label && <span style={{ color: 'var(--text-muted)', fontSize: 13, minWidth: 120 }}>{label}</span>}
      {isUrl ? (
        <>
          <Button size="small" icon={<LinkOutlined />} href={value} target="_blank">開啟</Button>
          <span className="path-val">{value}</span>
        </>
      ) : isMail ? (
        <>
          <Button size="small" icon={<MailOutlined />} href={`mailto:${value}`}>寄信</Button>
          <span className="path-val">{value}</span>
        </>
      ) : isPath ? (
        <>
          <Button size="small" icon={<CopyOutlined />} onClick={copyPath}>複製路徑</Button>
          <span className="path-val">{value}</span>
        </>
      ) : (
        <Typography.Text className="path-val" copyable={{ text: value }}>{value}</Typography.Text>
      )}
    </div>
  );
}

// 卡片標題列（含來源標籤 + 圖示旗標）
export function CardHeader({ entry }) {
  const tag = SOURCE_TAG[entry.source] || SOURCE_TAG.internal;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600 }}>{entry.title}</span>
      <Tag color={tag.color} style={{ marginInlineEnd: 0 }}>{tag.label}</Tag>
      {(entry.images || []).length ? <Tag>🖼 圖示</Tag> : null}
    </span>
  );
}

// 底色固定白色（不跟著夜間模式）：這些截圖都是 CLO 的淺色介面，
// 有些還是去背 PNG，墊深色底反而看不清楚
function CardImage({ src, onLoad }) {
  return (
    <Image src={imgUrl(src)} onLoad={onLoad}
      style={{ maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }} />
  );
}

const IMG_GAP = 12;
const IMG_BORDER = 2; // 左右各 1px 外框，不從可分配寬度裡先扣掉的話每張高度會差幾 px
// 一列排下來如果每張都矮於這個高度就不併排，改回直排——擠成一列反而看不清楚
const MIN_ROW_HEIGHT = 240;

// 量容器寬度，用來算多張圖並排時能有多高。視窗縮放要重量。
function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  const measure = useCallback(() => setWidth(ref.current?.getBoundingClientRect().width || 0), []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  return [ref, width, measure];
}

// 卡片內容（展開後顯示）
export function CardBody({ entry }) {
  const paths = entry.paths || [];
  const images = entry.images || [];
  const hasContent = !!entry.content;

  // 多張圖排成一列時，每張的寬度要跟它的長寬比成正比，高度才會一致且剛好填滿整列。
  // 長寬比要等圖載入才知道，所以先直排、載完再決定。
  const [boxRef, boxWidth] = useElementWidth();
  const [ratios, setRatios] = useState({});
  const onImgLoad = (i) => (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.target;
    if (w && h) setRatios((r) => (r[i] ? r : { ...r, [i]: w / h }));
  };
  const allLoaded = images.length > 1 && images.every((_, i) => ratios[i]);
  const ratioSum = allLoaded ? images.reduce((s, _, i) => s + ratios[i], 0) : 0;
  const rowHeight = allLoaded && boxWidth
    ? (boxWidth - IMG_GAP * (images.length - 1) - IMG_BORDER * images.length) / ratioSum
    : 0;
  const oneRow = rowHeight >= MIN_ROW_HEIGHT;

  return (
    <div>
      {hasContent && <div className="card-content">{linkify(entry.content)}</div>}
      {paths.length > 0 && (
        <div style={{ marginTop: hasContent ? 12 : 0 }}>
          {paths.map((p, i) => <PathRow key={i} raw={p} />)}
        </div>
      )}
      {images.length > 0 && (
        // 多張圖排成一列、等高；一列會擠到太小就退回直排。要看細節點圖放大就是原尺寸
        <div ref={boxRef} className={oneRow ? 'card-imgs card-imgs-row' : 'card-imgs'}
          style={{ marginTop: hasContent || paths.length ? 12 : 0 }}>
          <Image.PreviewGroup>
            {images.map((p, i) => (
              <div key={i} className="card-imgs-cell"
                style={oneRow ? { flexGrow: ratios[i], flexBasis: IMG_BORDER } : undefined}>
                <CardImage src={p} onLoad={onImgLoad(i)} />
              </div>
            ))}
          </Image.PreviewGroup>
        </div>
      )}
    </div>
  );
}
