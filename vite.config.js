import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 開發用根路徑 '/'（本機預覽方便）；build 用 GitHub Pages 子路徑。
// 圖片一律用 import.meta.env.BASE_URL 前綴，兩種情況都正確。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/dsg-3d-standard/' : '/',
}));
