import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import 'antd/dist/reset.css';
import { buildTheme } from './theme';
import Root from './App';
import './index.css';

const THEME_KEY = 'dsg-theme';

// 沒選過就跟著作業系統的深色設定走
const initialDark = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

// 在 React 掛載前先設好，避免夜間模式的人開頁面時先閃一下白畫面
const applyTheme = (dark) => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; };
applyTheme(initialDark());

function Shell() {
  const [dark, setDark] = useState(initialDark);
  useEffect(() => {
    applyTheme(dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <ConfigProvider theme={buildTheme(dark)} locale={zhTW}>
      <AntApp style={{ height: '100%' }}>
        <Root dark={dark} onToggleDark={() => setDark((d) => !d)} />
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>,
);
