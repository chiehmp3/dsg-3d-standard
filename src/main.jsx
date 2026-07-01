import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import 'antd/dist/reset.css';
import { theme } from './theme';
import Root from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={theme} locale={zhTW}>
      <AntApp style={{ height: '100%' }}>
        <Root />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
