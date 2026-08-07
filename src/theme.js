// antd 主題與共用常數
import { theme as antdTheme } from 'antd';

// 亮／暗兩套 antd 主題。CSS 變數那一套（index.css）負責我們自己寫的樣式，
// 這裡負責 antd 元件；兩邊的色值要對齊，改一邊記得改另一邊。
export function buildTheme(dark) {
  const brand = dark ? '#4dcaad' : '#006150';
  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: brand,
      colorInfo: brand,
      colorLink: brand,
      // 實心主色按鈕上的文字。夜間的薄荷綠夠亮，配白字只有 2.7:1（低於 WCAG AA），改用深色墨
      ...(dark ? { colorTextLightSolid: '#10241f' } : {}),
      borderRadius: 8,
      fontFamily: "'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 14,
    },
    components: {
      Layout: dark
        ? { siderBg: '#1f1f1f', headerBg: '#1f1f1f', bodyBg: '#141414' }
        : { siderBg: '#ffffff', headerBg: '#ffffff', bodyBg: '#f5f5f5' },
      Menu: {
        itemSelectedBg: dark ? 'rgba(77,202,173,0.16)' : 'rgba(0,97,80,0.10)',
        itemSelectedColor: brand,
        itemBorderRadius: 8,
      },
      Collapse: { headerBg: dark ? '#1f1f1f' : '#ffffff' },
    },
  };
}

// 三種來源標籤 → 明顯不同色相（官方=綠、內部=藍、重要=紅）
export const SOURCE_TAG = {
  official: { color: 'green', label: '官方規範' },
  internal: { color: 'blue', label: '內部 SOP' },
  warning: { color: 'red', label: '重要' },
};

// 圖片路徑：Supabase 存的是 'images/pXX.png'，加上 base 前綴以配合 Pages 子路徑
export const imgUrl = (p) => (p ? import.meta.env.BASE_URL + p : '');
