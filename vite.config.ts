import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // 站点挂在 GitHub Pages 子路径下，资源统一用相对路径，放进 dist/ 也能正确加载
  base: './',
  plugins: [vue()],
  build: {
    // 多入口：只把「打卡记录」编译进 dist/，首页 index.html 保持纯静态九宫格
    rollupOptions: {
      input: {
        checkin: 'checkin.html',
      },
    },
  },
})
