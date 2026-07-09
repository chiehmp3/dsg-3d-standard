import { Tag, Typography, Image, Button, message } from 'antd';
import { LinkOutlined, MailOutlined, CopyOutlined } from '@ant-design/icons';
import { imgUrl, SOURCE_TAG } from '../theme';

// 內文中的網址自動變連結
function linkify(text) {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>
      : <span key={i}>{p}</span>,
  );
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
      {label && <span style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13, minWidth: 120 }}>{label}</span>}
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

// 卡片內容（展開後顯示）
export function CardBody({ entry }) {
  const paths = entry.paths || [];
  const images = entry.images || [];
  const hasContent = !!entry.content;
  return (
    <div>
      {hasContent && <div className="card-content">{linkify(entry.content)}</div>}
      {paths.length > 0 && (
        <div style={{ marginTop: hasContent ? 12 : 0 }}>
          {paths.map((p, i) => <PathRow key={i} raw={p} />)}
        </div>
      )}
      {images.length > 0 && (
        <div className="card-imgs" style={{ marginTop: hasContent || paths.length ? 12 : 0 }}>
          <Image.PreviewGroup>
            {images.map((p, i) => (
              <Image key={i} src={imgUrl(p)} style={{ border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff' }} />
            ))}
          </Image.PreviewGroup>
        </div>
      )}
    </div>
  );
}
