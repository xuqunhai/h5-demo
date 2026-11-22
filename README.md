# h5-demo

家庭常用小工具的合集，用 GitHub Pages 从本仓库根目录直接发布。

线上地址：<https://xuqunhai.github.io/h5-demo/>

## 页面结构

| 入口 | 说明 |
| --- | --- |
| `index.html` | 九宫格首页（纯静态，不需要构建） |
| `photo.html` | 照片排版打印工具：上传照片 → 设置纸面尺寸（mm）→ 拖拽 / 缩放 / 1mm 微调 → 打印或导出 PDF，只打印虚线框内内容 |
| `checkin.html` | 「打卡记录」Vue 应用源码入口，构建后产出 `dist/checkin.html` |
| `dist/checkin.html` | 打卡记录的实际页面（九宫格「打卡记录」指向这里） |
| `mp-wechat/` | 小程序版本：`pages/checkin` 打卡、`pages/print` 打印图片（对应 `photo.html`） |

## 修改与发布流程

```bash
npm install          # 首次
npm run build        # 编译打卡应用到 dist/，并把 photo.html 同步到 public/
```

- **改照片打印工具**：只改根目录 `photo.html`。`npm run build` 会自动把它同步到 `public/photo.html`，再由 Vite 复制进 `dist/photo.html`，三处内容保持一致。
- **改打卡记录**：改 `src/`，然后 `npm run build`，产物落在 `dist/`（已提交进仓库，Pages 直接读它）。
- **发布**：`git add -A && git commit && git push`，几十秒后线上生效（Pages 从 `main` 分支根目录发布）。
- `vite build` 会清空 `dist/` 后重建，`dist/` 里不要手工放文件。

## 本地预览

```bash
python3 -m http.server 8123   # 然后访问 http://127.0.0.1:8123/
```
