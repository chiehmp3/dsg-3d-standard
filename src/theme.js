// antd 主題與共用常數

export const theme = {
  token: {
    colorPrimary: '#006150',
    colorInfo: '#006150',
    colorLink: '#006150',
    borderRadius: 8,
    fontFamily: "'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
  },
  components: {
    Layout: { siderBg: '#ffffff', headerBg: '#ffffff', bodyBg: '#f5f5f5' },
    Menu: { itemSelectedBg: 'rgba(0,97,80,0.10)', itemSelectedColor: '#006150', itemBorderRadius: 8 },
    Collapse: { headerBg: '#ffffff' },
  },
};

// 三種來源標籤 → 明顯不同色相（官方=綠、內部=藍、重要=紅）
export const SOURCE_TAG = {
  official: { color: 'green', label: '官方規範' },
  internal: { color: 'blue', label: '內部 SOP' },
  warning: { color: 'red', label: '重要' },
};

// 圖片路徑：Supabase 存的是 'images/pXX.png'，加上 base 前綴以配合 Pages 子路徑
export const imgUrl = (p) => (p ? import.meta.env.BASE_URL + p : '');
